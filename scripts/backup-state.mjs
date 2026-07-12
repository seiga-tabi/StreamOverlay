import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));

function readOption(name, fallback) {
  const prefix = `${name}=`;
  const match = [...args].find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function fail(message) {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

function safeRelativePath(value) {
  return value && !path.isAbsolute(value) && value !== ".." && !value.startsWith(`..${path.sep}`);
}

async function sha256(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function collectFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = path.relative(root, absolutePath);
    if (!safeRelativePath(relativePath)) fail("상태 디렉터리 밖의 경로가 감지되었습니다.");
    if (entry.isSymbolicLink()) fail("상태 디렉터리의 심볼릭 링크는 백업할 수 없습니다.");
    if (entry.isDirectory()) files.push(...await collectFiles(root, absolutePath));
    else if (entry.isFile() && !entry.name.endsWith(".tmp")) files.push({ absolutePath, relativePath });
  }
  return files;
}

if (args.has("--help")) {
  console.log("사용법: npm run backup:state -- [--dry-run] [--state-dir=/path] [--output-dir=/path]");
  process.exit(0);
}

const stateDir = path.resolve(readOption("--state-dir", process.env.STREAMOPS_STATE_DIR || ".streamops"));
const outputDir = path.resolve(readOption("--output-dir", process.env.STREAMOPS_BACKUP_DIR || ".streamops-backups"));
const dryRun = args.has("--dry-run");

let stateStat;
try {
  stateStat = await fs.lstat(stateDir);
} catch {
  fail("상태 디렉터리를 찾을 수 없습니다.");
}
if (!stateStat.isDirectory() || stateStat.isSymbolicLink()) fail("상태 경로는 실제 디렉터리여야 합니다.");
if (stateDir === path.parse(stateDir).root) fail("파일 시스템 루트는 상태 디렉터리로 사용할 수 없습니다.");

const sourceFiles = await collectFiles(stateDir);
let totalBytes = 0;
for (const file of sourceFiles) {
  const stat = await fs.stat(file.absolutePath);
  totalBytes += stat.size;
  if (dryRun) await sha256(file.absolutePath);
}

if (dryRun) {
  console.log(`[backup] dry-run 통과: ${sourceFiles.length}개 파일, ${totalBytes} bytes`);
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const finalDir = path.join(outputDir, `state-${timestamp}`);
const temporaryDir = `${finalDir}.tmp-${process.pid}`;
await fs.mkdir(temporaryDir, { recursive: true, mode: 0o700 });

const manifestFiles = [];
for (const file of sourceFiles) {
  const destination = path.join(temporaryDir, file.relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fs.copyFile(file.absolutePath, destination);
  await fs.chmod(destination, 0o600);
  const stat = await fs.stat(destination);
  manifestFiles.push({
    path: file.relativePath.split(path.sep).join("/"),
    size: stat.size,
    sha256: await sha256(destination)
  });
}

const manifest = {
  formatVersion: 1,
  createdAt: new Date().toISOString(),
  sourceName: path.basename(stateDir),
  files: manifestFiles
};
const manifestPath = path.join(temporaryDir, "manifest.json");
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await fs.mkdir(outputDir, { recursive: true, mode: 0o700 });
await fs.rename(temporaryDir, finalDir);
console.log(`[backup] 완료: ${finalDir} (${manifestFiles.length}개 파일, ${totalBytes} bytes)`);

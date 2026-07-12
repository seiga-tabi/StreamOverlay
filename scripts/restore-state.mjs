import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));

function readOption(name, fallback = "") {
  const prefix = `${name}=`;
  const match = [...args].find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function fail(message) {
  console.error(`[restore] ${message}`);
  process.exit(1);
}

function normalizeManifestPath(value) {
  if (typeof value !== "string" || !value || path.isAbsolute(value)) fail("manifest에 잘못된 파일 경로가 있습니다.");
  const normalized = path.normalize(value);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) fail("manifest 경로가 백업 범위를 벗어납니다.");
  return normalized;
}

async function sha256(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

if (args.has("--help")) {
  console.log("사용법: npm run restore:state -- --source=/backup [--state-dir=/path] [--apply --server-stopped]");
  process.exit(0);
}

const sourceDirValue = readOption("--source");
if (!sourceDirValue) fail("--source=/backup 경로가 필요합니다.");
const sourceDir = path.resolve(sourceDirValue);
const stateDir = path.resolve(readOption("--state-dir", process.env.STREAMOPS_STATE_DIR || ".streamops"));
const apply = args.has("--apply");

if (stateDir === path.parse(stateDir).root) fail("파일 시스템 루트는 복원 대상이 될 수 없습니다.");
if (apply && !args.has("--server-stopped")) {
  fail("실제 복원에는 서버 중지를 확인하는 --server-stopped 플래그가 필요합니다.");
}

let manifest;
try {
  manifest = JSON.parse(await fs.readFile(path.join(sourceDir, "manifest.json"), "utf8"));
} catch {
  fail("유효한 manifest.json을 읽을 수 없습니다.");
}
if (manifest?.formatVersion !== 1 || !Array.isArray(manifest.files)) fail("지원하지 않는 백업 형식입니다.");

const verifiedFiles = [];
for (const entry of manifest.files) {
  const relativePath = normalizeManifestPath(entry?.path);
  const sourcePath = path.join(sourceDir, relativePath);
  const stat = await fs.lstat(sourcePath).catch(() => undefined);
  if (!stat?.isFile() || stat.isSymbolicLink()) fail("백업 파일이 없거나 일반 파일이 아닙니다.");
  if (stat.size !== entry.size || await sha256(sourcePath) !== entry.sha256) fail("백업 파일 무결성 검증에 실패했습니다.");
  verifiedFiles.push({ sourcePath, relativePath });
}

if (!apply) {
  console.log(`[restore] 검증 통과(dry-run): ${verifiedFiles.length}개 파일, 대상 ${stateDir}`);
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const safetyDir = path.resolve(path.dirname(stateDir), `${path.basename(stateDir)}-pre-restore-${timestamp}`);
await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
await fs.mkdir(safetyDir, { recursive: true, mode: 0o700 });

let preserved = 0;
for (const file of verifiedFiles) {
  const destination = path.join(stateDir, file.relativePath);
  const existing = await fs.lstat(destination).catch(() => undefined);
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink()) fail("복원 대상에 일반 파일이 아닌 항목이 있습니다.");
    const safetyPath = path.join(safetyDir, file.relativePath);
    await fs.mkdir(path.dirname(safetyPath), { recursive: true, mode: 0o700 });
    await fs.copyFile(destination, safetyPath);
    await fs.chmod(safetyPath, 0o600);
    preserved += 1;
  }

  await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const temporaryPath = `${destination}.restore-${process.pid}.tmp`;
  await fs.copyFile(file.sourcePath, temporaryPath);
  await fs.chmod(temporaryPath, 0o600);
  await fs.rename(temporaryPath, destination);
}

console.log(`[restore] 완료: ${verifiedFiles.length}개 파일 복원, 기존 ${preserved}개 파일 보존 위치 ${safetyDir}`);

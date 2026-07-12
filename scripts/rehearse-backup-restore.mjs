import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rehearsalRoot = await fs.mkdtemp(path.join(os.tmpdir(), "yoro-backup-rehearsal-"));
const sourceDir = path.join(rehearsalRoot, "state");
const backupDir = path.join(rehearsalRoot, "backups");
const restoredDir = path.join(rehearsalRoot, "restored");

function runScript(script, args) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts", script), ...args], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${script} 실행이 종료 코드 ${result.status}로 실패했습니다.`);
}

try {
  await fs.mkdir(path.join(sourceDir, "nested"), { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(sourceDir, "store.json"), `${JSON.stringify({ participation: { isOpen: true, queue: [] } })}\n`, { mode: 0o600 });
  await fs.writeFile(path.join(sourceDir, "nested", "twitch-token.json"), `${JSON.stringify({ encrypted: true })}\n`, { mode: 0o600 });

  runScript("backup-state.mjs", [`--state-dir=${sourceDir}`, `--output-dir=${backupDir}`]);
  const backups = (await fs.readdir(backupDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("state-"))
    .map((entry) => path.join(backupDir, entry.name));
  if (backups.length !== 1) throw new Error(`예상한 backup 1개 대신 ${backups.length}개가 생성되었습니다.`);

  runScript("restore-state.mjs", [`--source=${backups[0]}`, `--state-dir=${restoredDir}`]);
  runScript("restore-state.mjs", [`--source=${backups[0]}`, `--state-dir=${restoredDir}`, "--apply", "--server-stopped"]);

  const original = await fs.readFile(path.join(sourceDir, "store.json"), "utf8");
  const restored = await fs.readFile(path.join(restoredDir, "store.json"), "utf8");
  if (original !== restored) throw new Error("복원된 상태 파일이 원본과 일치하지 않습니다.");
  console.log("[rehearsal] backup 생성, manifest 검증, 격리 복원 비교를 통과했습니다.");
} finally {
  await fs.rm(rehearsalRoot, { recursive: true, force: true });
}

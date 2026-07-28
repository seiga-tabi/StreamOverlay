import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  postgresEnvironment,
  readArgument,
  readBackupManifest,
  readDatabaseUrlFile,
  runProgram,
  safeErrorCode
} from "./postgres-backup-common.mjs";

const __filename = fileURLToPath(import.meta.url);
const scriptsRoot = path.dirname(__filename);

async function main() {
  const backup = await readBackupManifest(readArgument("--manifest"));
  const parsed = await readDatabaseUrlFile(readArgument("--database-url-file"));
  const targetDatabase = `streamops_restore_${crypto.randomBytes(8).toString("hex")}`;
  const env = postgresEnvironment(parsed);
  await runProgram("createdb", [targetDatabase], env);
  try {
    await runProgram(
      process.execPath,
      [
        path.join(scriptsRoot, "restore-postgres.mjs"),
        "--apply",
        "--server-stopped",
        `--manifest=${backup.manifestPath}`,
        `--database-url-file=${readArgument("--database-url-file")}`,
        `--target-database=${targetDatabase}`
      ],
      env
    );
    console.log(JSON.stringify({ ok: true, rehearsal: "completed" }));
  } finally {
    await runProgram("dropdb", ["--if-exists", targetDatabase], env).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: safeErrorCode(error) }));
  process.exitCode = 1;
});

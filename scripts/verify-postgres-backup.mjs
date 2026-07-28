import {
  postgresEnvironment,
  readArgument,
  readBackupManifest,
  runProgram,
  safeErrorCode
} from "./postgres-backup-common.mjs";

async function main() {
  const result = await readBackupManifest(readArgument("--manifest"));
  await runProgram("pg_restore", ["--list", result.backupPath], postgresEnvironment(new URL(
    "postgresql://backup_verification@localhost/verification"
  )), { capture: true });
  console.log(JSON.stringify({
    ok: true,
    backupFile: result.manifest.backupFile,
    migrations: result.manifest.migrations.length
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: safeErrorCode(error) }));
  process.exitCode = 1;
});

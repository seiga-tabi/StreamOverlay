import { Pool } from "pg";
import {
  nodePostgresSsl,
  postgresEnvironment,
  readArgument,
  readBackupManifest,
  readDatabaseUrlFile,
  runProgram,
  safeErrorCode
} from "./postgres-backup-common.mjs";

async function main() {
  const backup = await readBackupManifest(readArgument("--manifest"));
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({
      ok: true,
      mode: "verify_only",
      backupFile: backup.manifest.backupFile,
      migrations: backup.manifest.migrations.length
    }));
    return;
  }
  if (!process.argv.includes("--server-stopped")) {
    throw new Error("Restore 적용에는 --server-stopped 확인이 필요합니다.");
  }
  const targetDatabase = readArgument("--target-database");
  if (!targetDatabase || !/^streamops_restore_[a-z0-9_]{1,48}$/u.test(targetDatabase)) {
    throw new Error("Restore target은 streamops_restore_* 전용 Database 이름만 허용합니다.");
  }
  const parsed = await readDatabaseUrlFile(readArgument("--database-url-file"));
  await runProgram(
    "pg_restore",
    [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      "--dbname",
      targetDatabase,
      backup.backupPath
    ],
    postgresEnvironment(parsed, targetDatabase)
  );

  const targetUrl = new URL(parsed);
  targetUrl.pathname = `/${targetDatabase}`;
  const pool = new Pool({
    connectionString: targetUrl.toString(),
    ssl: nodePostgresSsl(),
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: "yoro-postgres-restore-verification"
  });
  try {
    const result = await pool.query(
      `SELECT migration_id, checksum_sha256
       FROM schema_migrations
       WHERE dirty = FALSE
       ORDER BY migration_id ASC`
    );
    const restored = result.rows.map((row) => ({
      id: row.migration_id,
      checksumSha256: row.checksum_sha256
    }));
    if (JSON.stringify(restored) !== JSON.stringify(backup.manifest.migrations)) {
      throw new Error("Restore 후 migration checksum 상태가 일치하지 않습니다.");
    }
  } finally {
    await pool.end();
  }
  console.log(JSON.stringify({ ok: true, mode: "restored", targetDatabase }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: safeErrorCode(error) }));
  process.exitCode = 1;
});

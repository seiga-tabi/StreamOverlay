import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import {
  nodePostgresSsl,
  postgresEnvironment,
  readArgument,
  readDatabaseUrlFile,
  requireAbsolutePath,
  runProgram,
  safeErrorCode,
  sha256File
} from "./postgres-backup-common.mjs";

async function main() {
  const outputDirectory = requireAbsolutePath(readArgument("--output-dir"), "--output-dir");
  const parsed = await readDatabaseUrlFile(readArgument("--database-url-file"));
  await fs.mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(outputDirectory, 0o700);

  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[-:.]/gu, "").replace("Z", "Z");
  const fileName = `streamops-postgres-${stamp}.dump`;
  const outputPath = path.join(outputDirectory, fileName);
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  const env = postgresEnvironment(parsed);
  try {
    await runProgram(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", temporaryPath],
      env
    );
    await fs.chmod(temporaryPath, 0o600);
    await fs.rename(temporaryPath, outputPath);

    const pool = new Pool({
      connectionString: parsed.toString(),
      ssl: nodePostgresSsl(),
      max: 1,
      connectionTimeoutMillis: 5_000,
      application_name: "yoro-postgres-backup"
    });
    let migrations;
    try {
      const result = await pool.query(
        `SELECT migration_id, checksum_sha256
         FROM schema_migrations
         WHERE dirty = FALSE
         ORDER BY migration_id ASC`
      );
      migrations = result.rows.map((row) => ({
        id: row.migration_id,
        checksumSha256: row.checksum_sha256
      }));
    } finally {
      await pool.end();
    }
    const sourceIdentity = `${parsed.hostname}:${parsed.port || "5432"}/${parsed.pathname.slice(1)}`;
    const manifest = {
      schemaVersion: 1,
      createdAt,
      backupFile: fileName,
      backupSha256: await sha256File(outputPath),
      sourceIdentitySha256: crypto.createHash("sha256").update(sourceIdentity).digest("hex"),
      migrations
    };
    const manifestPath = `${outputPath}.manifest.json`;
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    console.log(JSON.stringify({
      ok: true,
      backupFile: fileName,
      manifestFile: path.basename(manifestPath),
      migrations: migrations.length
    }));
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    await fs.rm(outputPath, { force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, code: safeErrorCode(error) }));
  process.exitCode = 1;
});

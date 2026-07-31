import { appConfig, assertRuntimeConfig } from "../config.js";
import { collectDatabaseAudit } from "../database/database-audit.js";
import { closeDatabasePool, databasePool } from "../database/pool.js";

async function main(): Promise<void> {
  assertRuntimeConfig();
  if (!appConfig.database.enabled) throw new Error("database_disabled");
  const pool = databasePool();
  if (!pool) throw new Error("database_unavailable");
  const report = await collectDatabaseAudit(pool);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  await main();
} catch {
  process.stderr.write("Database read-only audit failed: safe_error\n");
  process.exitCode = 1;
} finally {
  await closeDatabasePool().catch(() => {
    process.exitCode = 1;
  });
}

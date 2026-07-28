import { appConfig, assertRuntimeConfig } from "../config.js";
import { SafeDatabaseError } from "../database/errors.js";
import { loadMigrationManifest } from "../database/migration-manifest.js";
import { applyPendingMigrations, inspectMigrationState } from "../database/migration-runner.js";
import { closeDatabasePool, databasePool } from "../database/pool.js";

type Command = "check" | "plan" | "apply";

function commandFromArgs(): Command {
  const command = process.argv[2];
  if (command === "check" || command === "plan" || command === "apply") return command;
  throw new Error("Database migration 명령은 check, plan, apply 중 하나여야 합니다.");
}

async function main(): Promise<void> {
  assertRuntimeConfig();
  if (!appConfig.database.enabled) {
    throw new SafeDatabaseError("DATABASE_DISABLED", false, "Database 기능이 비활성화되어 있습니다.");
  }
  const pool = databasePool();
  if (!pool) throw new SafeDatabaseError("DATABASE_DISABLED", false);
  const manifest = await loadMigrationManifest();
  const command = commandFromArgs();
  if (command === "apply") {
    if (!process.argv.includes("--apply")) {
      throw new Error("Migration 적용에는 --apply 확인이 필요합니다.");
    }
    if (appConfig.nodeEnv === "production" && !process.argv.includes("--confirm-production")) {
      throw new Error("production migration 적용에는 --confirm-production 확인이 필요합니다.");
    }
    const allowDestructive = process.argv.includes("--allow-destructive");
    const applied = await applyPendingMigrations(pool, manifest, { allowDestructive });
    console.log(JSON.stringify({
      command,
      applied: applied.length,
      migrationIds: applied
    }));
    return;
  }
  const inspection = await inspectMigrationState(pool, manifest);
  if (command === "plan") {
    console.log(JSON.stringify({
      command,
      status: inspection.status,
      pending: inspection.pending.map((migration) => ({
        id: migration.id,
        description: migration.description,
        destructive: migration.destructive,
        transaction: migration.transaction
      }))
    }));
    if (inspection.status === "mismatch") process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify({
    command,
    status: inspection.status,
    applied: inspection.applied.length,
    pending: inspection.pending.length
  }));
  if (inspection.status !== "ready") process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  const code = error instanceof SafeDatabaseError ? error.code : "DATABASE_MIGRATION_FAILED";
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
} finally {
  await closeDatabasePool().catch(() => {
    process.exitCode = 1;
  });
}

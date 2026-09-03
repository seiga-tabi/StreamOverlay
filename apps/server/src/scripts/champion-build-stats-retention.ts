import { appConfig, assertRuntimeConfig } from "../config.js";
import { SafeDatabaseError } from "../database/errors.js";
import { closeDatabasePool, databasePool } from "../database/pool.js";
import {
  countChampionMatchBuildsOlderThan,
  deleteChampionMatchBuildsOlderThan
} from "../database/repositories/champion-build-stats-repository.js";

const RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1_000;

function shouldApply(): boolean {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run" && arg !== "--apply")) {
    throw new Error("보존 배치 옵션은 --dry-run 또는 --apply만 사용할 수 있습니다.");
  }
  if (args.includes("--dry-run") && args.includes("--apply")) {
    throw new Error("--dry-run과 --apply를 동시에 사용할 수 없습니다.");
  }
  return args.includes("--apply");
}

async function main(): Promise<void> {
  assertRuntimeConfig();
  const apply = shouldApply();
  if (!appConfig.database.enabled) {
    throw new SafeDatabaseError(
      "DATABASE_DISABLED",
      false,
      "Database 기능이 비활성화되어 있습니다."
    );
  }
  const pool = databasePool();
  if (!pool) throw new SafeDatabaseError("DATABASE_DISABLED", false);

  const cutoffIso = new Date(Date.now() - RETENTION_DAYS * DAY_MS).toISOString();
  const targetCount = await countChampionMatchBuildsOlderThan(pool, cutoffIso);
  process.stdout.write(`${JSON.stringify({
    type: "champion_build_stats.retention_plan",
    mode: apply ? "apply" : "dry-run",
    retentionDays: RETENTION_DAYS,
    cutoffIso,
    targetCount
  })}\n`);

  if (!apply) return;
  const deletedCount = await deleteChampionMatchBuildsOlderThan(pool, cutoffIso);
  process.stdout.write(`${JSON.stringify({
    type: "champion_build_stats.retention_applied",
    cutoffIso,
    deletedCount
  })}\n`);
}

try {
  await main();
} catch (error) {
  const code = error instanceof SafeDatabaseError
    ? error.code
    : "CHAMPION_BUILD_STATS_RETENTION_FAILED";
  process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
  process.exitCode = 1;
} finally {
  await closeDatabasePool().catch(() => {
    process.exitCode = 1;
  });
}

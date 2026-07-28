import type { Pool, PoolClient, QueryResultRow } from "pg";
import { appConfig } from "../config.js";
import { SafeDatabaseError, toSafeDatabaseError } from "./errors.js";
import type { MigrationDefinition, MigrationManifest } from "./migration-manifest.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type AppliedMigrationRow = QueryResultRow & {
  migration_id: string;
  checksum_sha256: string;
  dirty: boolean;
};

export type MigrationInspection = Readonly<{
  status: "ready" | "pending" | "mismatch";
  applied: readonly string[];
  pending: readonly MigrationDefinition[];
  errorCode?: "DATABASE_MIGRATION_MISMATCH";
}>;

export const MIGRATION_LOCK_KEY = "8247659012476501";

async function migrationTableExists(queryable: Queryable): Promise<boolean> {
  const result = await queryable.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.schema_migrations')::TEXT AS table_name"
  );
  return result.rows[0]?.table_name === "schema_migrations";
}

export async function inspectMigrationState(
  queryable: Queryable,
  manifest: MigrationManifest
): Promise<MigrationInspection> {
  let rows: AppliedMigrationRow[] = [];
  if (await migrationTableExists(queryable)) {
    const result = await queryable.query<AppliedMigrationRow>(
      `SELECT migration_id, checksum_sha256, dirty
       FROM schema_migrations
       ORDER BY migration_id ASC`
    );
    rows = result.rows;
  }
  const definitions = new Map(manifest.migrations.map((migration) => [migration.id, migration]));
  for (const [index, row] of rows.entries()) {
    const definition = definitions.get(row.migration_id);
    if (
      !definition
      || manifest.migrations[index]?.id !== row.migration_id
      || row.dirty
      || row.checksum_sha256 !== definition.checksumSha256
    ) {
      return {
        status: "mismatch",
        applied: Object.freeze(rows.map((candidate) => candidate.migration_id)),
        pending: Object.freeze([]),
        errorCode: "DATABASE_MIGRATION_MISMATCH"
      };
    }
  }
  const applied = new Set(rows.map((row) => row.migration_id));
  const pending = manifest.migrations.filter((migration) => !applied.has(migration.id));
  return {
    status: pending.length === 0 ? "ready" : "pending",
    applied: Object.freeze(rows.map((row) => row.migration_id)),
    pending: Object.freeze(pending)
  };
}

export async function applyPendingMigrations(
  pool: Pool,
  manifest: MigrationManifest,
  options: { allowDestructive?: boolean } = {}
): Promise<readonly string[]> {
  const client = await pool.connect().catch((error: unknown) => {
    throw toSafeDatabaseError(error);
  });
  const applied: string[] = [];
  let locked = false;
  try {
    const lockResult = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1::BIGINT) AS locked",
      [MIGRATION_LOCK_KEY]
    );
    locked = lockResult.rows[0]?.locked === true;
    if (!locked) throw new SafeDatabaseError("DATABASE_MIGRATION_LOCKED", true);

    const inspection = await inspectMigrationState(client, manifest);
    if (inspection.status === "mismatch") {
      throw new SafeDatabaseError("DATABASE_MIGRATION_MISMATCH", false);
    }
    if (
      inspection.pending.some((migration) => migration.destructive)
      && options.allowDestructive !== true
    ) {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    for (const migration of inspection.pending) {
      const startedAt = performance.now();
      let began = false;
      try {
        await client.query("BEGIN");
        began = true;
        await client.query(
          "SELECT set_config('statement_timeout', $1, true)",
          [String(appConfig.database.statementTimeoutMs)]
        );
        await client.query(migration.sql);
        const executionMs = Math.max(0, Math.round(performance.now() - startedAt));
        await client.query(
          `INSERT INTO schema_migrations (
             migration_id,
             checksum_sha256,
             execution_ms,
             application_version,
             dirty
           ) VALUES ($1, $2, $3, $4, FALSE)`,
          [
            migration.id,
            migration.checksumSha256,
            executionMs,
            appConfig.build.version
          ]
        );
        await client.query("COMMIT");
        applied.push(migration.id);
      } catch (error) {
        if (began) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // rollback 오류로 원래 migration 오류를 덮지 않습니다.
          }
        }
        throw toSafeDatabaseError(error);
      }
    }
    return Object.freeze(applied);
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1::BIGINT)", [MIGRATION_LOCK_KEY]);
      } catch {
        // 연결 종료 시 session advisory lock은 자동 해제됩니다.
      }
    }
    client.release();
  }
}

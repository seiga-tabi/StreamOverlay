import assert from "node:assert/strict";
import crypto from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseHealthMonitor } from "../dist/database/health.js";
import { SafeDatabaseError } from "../dist/database/errors.js";
import { loadMigrationManifest } from "../dist/database/migration-manifest.js";
import { inspectMigrationState } from "../dist/database/migration-runner.js";
import { createTenantContext } from "../dist/database/tenant-context.js";
import { withTransaction } from "../dist/database/transaction.js";

const __filename = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(__filename), "..");
const migrationsRoot = path.join(serverRoot, "migrations");

test("migration manifest와 SQL checksum을 strict하게 검증한다", async () => {
  const manifest = await loadMigrationManifest(migrationsRoot);
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(
    manifest.migrations.map((migration) => migration.id),
    [
      "0001_database_foundation",
      "0002_discord_saas_core",
    "0003_status_and_notification",
    "0004_discord_oauth_onboarding",
    "0005_discord_bot_setup_binding",
    "0006_bot_management_and_agent_bootstrap"
    ]
  );

  const tempRoot = mkdtempSync(path.join(tmpdir(), "streamops-migrations-"));
  try {
    cpSync(migrationsRoot, tempRoot, { recursive: true });
    const parsed = JSON.parse(readFileSync(path.join(tempRoot, "manifest.json"), "utf8"));
    parsed.unexpected = true;
    writeFileSync(path.join(tempRoot, "manifest.json"), `${JSON.stringify(parsed)}\n`);
    await assert.rejects(
      loadMigrationManifest(tempRoot),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_MIGRATION_MISMATCH"
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("migration check는 빈 Database를 변경하지 않고 pending으로 판정한다", async () => {
  const manifest = await loadMigrationManifest(migrationsRoot);
  const queries = [];
  const queryable = {
    async query(text) {
      queries.push(text);
      return { rows: [{ table_name: null }], rowCount: 1 };
    }
  };

  const result = await inspectMigrationState(queryable, manifest);
  assert.equal(result.status, "pending");
  assert.equal(result.pending.length, 6);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT to_regclass/u);
});

test("적용 순서가 깨진 migration은 mismatch로 판정한다", async () => {
  const manifest = await loadMigrationManifest(migrationsRoot);
  const second = manifest.migrations[1];
  let calls = 0;
  const queryable = {
    async query() {
      calls += 1;
      if (calls === 1) return { rows: [{ table_name: "schema_migrations" }], rowCount: 1 };
      return {
        rows: [{
          migration_id: second.id,
          checksum_sha256: second.checksumSha256,
          dirty: false
        }],
        rowCount: 1
      };
    }
  };

  const result = await inspectMigrationState(queryable, manifest);
  assert.equal(result.status, "mismatch");
  assert.equal(result.errorCode, "DATABASE_MIGRATION_MISMATCH");
});

test("Database health는 비활성화와 pending 상태를 구분한다", async () => {
  const disabled = new DatabaseHealthMonitor(false, undefined, undefined);
  assert.deepEqual(disabled.snapshot(), {
    enabled: false,
    ready: true,
    state: "disabled"
  });

  const manifest = await loadMigrationManifest(migrationsRoot);
  const pool = {
    async query() {
      return { rows: [{ table_name: null }], rowCount: 1 };
    }
  };
  const pending = new DatabaseHealthMonitor(true, pool, manifest);
  await pending.checkNow();
  assert.equal(pending.snapshot().ready, false);
  assert.equal(pending.snapshot().state, "migration_pending");
  assert.equal(pending.snapshot().errorCode, "DATABASE_MIGRATION_PENDING");
});

test("transaction helper는 rollback·client 반환과 중첩 차단을 보장한다", async () => {
  const queries = [];
  let released = 0;
  const client = {
    async query(text) {
      queries.push(text);
      return { rows: [], rowCount: 0 };
    },
    release() {
      released += 1;
    }
  };
  const pool = {
    async connect() {
      return client;
    }
  };

  await assert.rejects(
    withTransaction(pool, async () => {
      await withTransaction(pool, async () => undefined);
    }),
    (error) => error instanceof SafeDatabaseError
      && error.code === "DATABASE_INVALID_INPUT"
  );
  assert.equal(queries[0], "BEGIN");
  assert.ok(queries.includes("ROLLBACK"));
  assert.equal(released, 1);
});

test("tenant context는 UUID를 정규화하고 잘못된 ID를 차단한다", () => {
  const organizationId = crypto.randomUUID().toUpperCase();
  const context = createTenantContext({ organizationId });
  assert.equal(context.organizationId, organizationId.toLowerCase());
  assert.throws(
    () => createTenantContext({ organizationId: "not-a-uuid" }),
    (error) => error instanceof SafeDatabaseError
      && error.code === "DATABASE_INVALID_INPUT"
  );
});

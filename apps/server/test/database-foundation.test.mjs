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
      "0006_bot_management_and_agent_bootstrap",
      "0007_agent_registration_and_ingestion",
      "0008_web_management_guild_claim",
      "0009_yoro_account_identity_and_session",
      "0010_yoro_dashboard_preferences",
      "0011_yoro_twitch_viewer_credentials",
      "0012_single_palworld_server",
      "0013_discord_bot_control_plane",
      "0014_discord_palworld_player_command",
      "0015_discord_command_message_cleanup",
      "0016_discord_bot_english_response_locale",
      "0017_discord_participation_announcement",
      "0018_discord_guild_directory_cache",
      "0019_admin_audit_logs",
      "0020_yoro_riot_rso_identity",
      "0021_yoro_valorant_record_consent",
      "0022_twitch_extension_settings",
      "0023_reaction_records",
      "0024_streamer_board",
      "0025_admin_audit_admin_access"
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

test("0019 관리자 감사 migration은 global index와 finalize-only lifecycle을 선언한다", () => {
  const sql = readFileSync(path.join(migrationsRoot, "0019_admin_audit_logs.sql"), "utf8");
  assert.match(sql, /CREATE INDEX audit_logs_admin_recent_idx\s+ON audit_logs \(created_at DESC, id DESC\)/u);
  assert.match(sql, /CREATE TABLE admin_audit_logs/u);
  assert.match(sql, /actor_reference_hash BYTEA NOT NULL[\s\S]*octet_length\(actor_reference_hash\) = 32/u);
  assert.match(sql, /target_reference_hash BYTEA NOT NULL[\s\S]*octet_length\(target_reference_hash\) = 32/u);
  assert.match(sql, /NEW\.outcome = 'started'/u);
  assert.match(sql, /OLD\.outcome = 'started'[\s\S]*NEW\.outcome IN \('succeeded', 'failed'\)/u);
  assert.match(sql, /BEFORE INSERT OR UPDATE OR DELETE ON admin_audit_logs/u);
  assert.match(sql, /BEFORE TRUNCATE ON admin_audit_logs/u);
  assert.match(sql, /ENABLE ALWAYS TRIGGER admin_audit_logs_finalize_only/u);
  assert.match(sql, /ENABLE ALWAYS TRIGGER admin_audit_logs_no_truncate/u);
  assert.doesNotMatch(sql, /actor_(?:user|session)_id|target_id|session_reference/u);
});

test("0020 Riot RSO migration은 Riot을 link identity로만 허용한다", () => {
  const sql = readFileSync(
    path.join(migrationsRoot, "0020_yoro_riot_rso_identity.sql"),
    "utf8"
  );
  assert.match(sql, /provider IN \('discord', 'twitch', 'riot'\)/u);
  assert.match(sql, /provider_subject ~ '\^\[A-Za-z0-9_-\]\{40,128\}\$'/u);
  assert.match(sql, /provider <> 'riot' OR purpose = 'link_identity'/u);
  assert.doesNotMatch(sql, /ALTER TABLE yoro_sessions/u);
});

test("0021 발로란트 전적 동의는 Riot identity와 분리되고 상태 전이를 제약한다", () => {
  const sql = readFileSync(
    path.join(migrationsRoot, "0021_yoro_valorant_record_consent.sql"),
    "utf8"
  );
  assert.match(sql, /CREATE TABLE yoro_valorant_record_consents/u);
  assert.match(sql, /REFERENCES external_identities\(id\) ON DELETE RESTRICT/u);
  assert.match(sql, /enabled = TRUE AND consented_at IS NOT NULL AND revoked_at IS NULL/u);
  assert.match(sql, /enabled = FALSE AND revoked_at IS NOT NULL/u);
});

test("0022 Twitch Extension 설정은 계정·채널 소유권과 허용값을 DB에서도 제약한다", () => {
  const sql = readFileSync(
    path.join(migrationsRoot, "0022_twitch_extension_settings.sql"),
    "utf8"
  );
  assert.match(sql, /user_id UUID PRIMARY KEY REFERENCES users\(id\) ON DELETE RESTRICT/u);
  assert.match(sql, /streamer_twitch_user_id TEXT NOT NULL UNIQUE[\s\S]*\^\[0-9\]\{1,32\}\$/u);
  assert.match(sql, /inactive_behavior IN \('hide', 'message'\)/u);
  assert.match(sql, /extension_type IN \('panel', 'overlay'\)/u);
  assert.match(sql, /revision BIGINT NOT NULL DEFAULT 1 CHECK \(revision >= 1\)/u);
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
  // 빈 DB 에서는 manifest 전체가 pending 입니다. migration 추가 때마다 숫자를 고치지 않습니다.
  assert.equal(result.pending.length, manifest.migrations.length);
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

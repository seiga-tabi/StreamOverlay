import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { SafeDatabaseError } from "../dist/database/errors.js";
import { loadMigrationManifest } from "../dist/database/migration-manifest.js";
import {
  MIGRATION_LOCK_KEY,
  applyPendingMigrations,
  inspectMigrationState
} from "../dist/database/migration-runner.js";
import { EntitlementRepository } from "../dist/database/repositories/entitlement-repository.js";
import { DiscordOnboardingRepository } from "../dist/database/repositories/discord-onboarding-repository.js";
import { DiscordManagementRepository } from "../dist/database/repositories/discord-management-repository.js";
import { GameServerRepository } from "../dist/database/repositories/game-server-repository.js";
import { NotificationJobRepository } from "../dist/database/repositories/notification-job-repository.js";
import { OrganizationRepository } from "../dist/database/repositories/organization-repository.js";
import { createTenantContext } from "../dist/database/tenant-context.js";
import { withTransaction } from "../dist/database/transaction.js";

const connectionString = process.env.DATABASE_TEST_URL;
if (!connectionString) {
  throw new Error("DATABASE_TEST_URL이 필요합니다. 운영 Database를 사용하지 마세요.");
}
const parsedDatabaseUrl = new URL(connectionString);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.slice(1));
if (!/^streamops_test(?:_[a-z0-9_]+)?$/u.test(databaseName)) {
  throw new Error("Database 통합 테스트는 streamops_test* 이름의 전용 Database만 허용합니다.");
}

const pool = new Pool({
  connectionString,
  max: 4,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  application_name: "yoro-streamops-database-test"
});

async function resetTestSchema() {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
}

test("PostgreSQL migration과 tenant 격리를 실제 Database에서 검증한다", async (t) => {
  await resetTestSchema();
  t.after(async () => {
    await resetTestSchema();
    await pool.end();
  });

  const manifest = await loadMigrationManifest();

  await t.test("check와 plan 기반 검사는 빈 DB를 변경하지 않는다", async () => {
    const inspection = await inspectMigrationState(pool, manifest);
    assert.equal(inspection.status, "pending");
    assert.equal(inspection.pending.length, 6);
    const table = await pool.query(
      "SELECT to_regclass('public.schema_migrations')::TEXT AS name"
    );
    assert.equal(table.rows[0].name, null);
  });

  await t.test("빈 DB 적용과 두 번째 no-op 및 checksum 기록", async () => {
    const applied = await applyPendingMigrations(pool, manifest);
    assert.deepEqual(applied, manifest.migrations.map((migration) => migration.id));
    assert.deepEqual(await applyPendingMigrations(pool, manifest), []);
    const inspection = await inspectMigrationState(pool, manifest);
    assert.equal(inspection.status, "ready");

    const rows = await pool.query(
      `SELECT migration_id, checksum_sha256, dirty
       FROM schema_migrations ORDER BY migration_id ASC`
    );
    assert.deepEqual(
      rows.rows.map((row) => ({
        id: row.migration_id,
        checksum: row.checksum_sha256,
        dirty: row.dirty
      })),
      manifest.migrations.map((migration) => ({
        id: migration.id,
        checksum: migration.checksumSha256,
        dirty: false
      }))
    );
  });

  await t.test("checksum 변조와 미래 migration을 fail-closed 처리한다", async () => {
    const first = manifest.migrations[0];
    const changedManifest = Object.freeze({
      ...manifest,
      migrations: Object.freeze([
        Object.freeze({ ...first, checksumSha256: "f".repeat(64) }),
        ...manifest.migrations.slice(1)
      ])
    });
    assert.equal((await inspectMigrationState(pool, changedManifest)).status, "mismatch");

    await withTransaction(pool, async (client) => {
      await client.query(
        `INSERT INTO schema_migrations (
           migration_id, checksum_sha256, execution_ms, application_version, dirty
         ) VALUES ('9999_future_schema', $1, 0, 'test', FALSE)`,
        ["a".repeat(64)]
      );
      assert.equal((await inspectMigrationState(client, manifest)).status, "mismatch");
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }).catch((error) => {
      assert.equal(error.code, "DATABASE_INVALID_INPUT");
    });
    assert.equal((await inspectMigrationState(pool, manifest)).status, "ready");
  });

  await t.test("advisory lock은 동시 migration runner를 차단한다", async () => {
    const lockClient = await pool.connect();
    try {
      await lockClient.query("SELECT pg_advisory_lock($1::BIGINT)", [MIGRATION_LOCK_KEY]);
      await assert.rejects(
        applyPendingMigrations(pool, manifest),
        (error) => error instanceof SafeDatabaseError
          && error.code === "DATABASE_MIGRATION_LOCKED"
      );
    } finally {
      await lockClient.query("SELECT pg_advisory_unlock($1::BIGINT)", [MIGRATION_LOCK_KEY]);
      lockClient.release();
    }
  });

  await t.test("실패한 migration은 table과 적용 기록을 남기지 않는다", async () => {
    const failing = Object.freeze({
      id: "0005_failure_probe",
      file: "0005_failure_probe.sql",
      description: "rollback 검증",
      checksumSha256: crypto.createHash("sha256").update("probe").digest("hex"),
      destructive: false,
      transaction: true,
      sql: "CREATE TABLE migration_failure_probe (id INTEGER); SELECT invalid syntax"
    });
    const failingManifest = Object.freeze({
      ...manifest,
      migrations: Object.freeze([...manifest.migrations, failing])
    });
    await assert.rejects(applyPendingMigrations(pool, failingManifest));
    const result = await pool.query(
      `SELECT
         to_regclass('public.migration_failure_probe')::TEXT AS table_name,
         EXISTS (
           SELECT 1 FROM schema_migrations WHERE migration_id = '0005_failure_probe'
         ) AS migration_recorded`
    );
    assert.equal(result.rows[0].table_name, null);
    assert.equal(result.rows[0].migration_recorded, false);
  });

  await t.test("setup token과 OAuth state는 hash만 저장되고 동시 요청 하나만 성공한다", async () => {
    const setupId = crypto.randomUUID();
    const rawSetupToken = "setup_token_SENTINEL_never_store_plaintext";
    const setupTokenHash = crypto.createHash("sha256").update(rawSetupToken).digest();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await new DiscordOnboardingRepository(pool).issueSetupSession({
      id: setupId,
      tokenHash: setupTokenHash,
      expiresAt,
      issuedVia: "operator_test"
    });

    const begin = async () => withTransaction(pool, async (client) =>
      new DiscordOnboardingRepository(client).beginOAuthSession({
        setupTokenHash,
        oauthSessionId: crypto.randomUUID(),
        stateHash: crypto.randomBytes(32),
        cookieBindingHash: crypto.randomBytes(32),
        csrfTokenHash: crypto.randomBytes(32),
        encryptedPkceVerifier: crypto.randomBytes(64),
        expiresAt
      })
    );
    const created = await Promise.all([begin(), begin()]);
    assert.equal(created.filter(Boolean).length, 1);

    const stored = await pool.query(
      `SELECT
         encode(token_hash, 'escape') AS token_hash_text,
         COUNT(oauth.id)::INTEGER AS oauth_count
       FROM discord_setup_sessions setup
       LEFT JOIN discord_oauth_sessions oauth ON oauth.setup_session_id = setup.id
       WHERE setup.id = $1
       GROUP BY setup.token_hash`,
      [setupId]
    );
    assert.doesNotMatch(stored.rows[0].token_hash_text, /SENTINEL/u);
    assert.equal(stored.rows[0].oauth_count, 1);

    const oauth = await pool.query(
      `SELECT state_hash, cookie_binding_hash
       FROM discord_oauth_sessions
       WHERE setup_session_id = $1`,
      [setupId]
    );
    const consume = async () => withTransaction(pool, async (client) =>
      new DiscordOnboardingRepository(client).consumeOAuthState({
        stateHash: oauth.rows[0].state_hash,
        cookieBindingHash: oauth.rows[0].cookie_binding_hash
      })
    );
    const consumed = await Promise.all([consume(), consume()]);
    assert.equal(consumed.filter(Boolean).length, 1);
  });

  await t.test("Bot setup binding은 같은 Guild·사용자 활성 session을 하나만 허용한다", async () => {
    const repository = new DiscordOnboardingRepository(pool);
    const binding = {
      requestedApplicationId: "100000000000000001",
      requestedDiscordGuildId: "100000000000000002",
      requestedByDiscordUserId: "100000000000000003",
      issuedVia: "bot_command"
    };
    await repository.issueSetupSession({
      id: crypto.randomUUID(),
      tokenHash: crypto.randomBytes(32),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      ...binding
    });
    await assert.rejects(
      repository.issueSetupSession({
        id: crypto.randomUUID(),
        tokenHash: crypto.randomBytes(32),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        ...binding
      }),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_CONFLICT"
    );
  });

  const organizationA = crypto.randomUUID();
  const organizationB = crypto.randomUUID();
  const userA = crypto.randomUUID();
  const userB = crypto.randomUUID();
  const contextA = createTenantContext({ organizationId: organizationA, actorUserId: userA });
  const contextB = createTenantContext({ organizationId: organizationB, actorUserId: userB });
  const organizations = new OrganizationRepository(pool);
  const gameServers = new GameServerRepository(pool);
  const entitlements = new EntitlementRepository(pool);
  const jobs = new NotificationJobRepository(pool);

  await t.test("A/B 조직 기반과 동일 이름 서버를 독립 생성한다", async () => {
    await organizations.create(contextA, "Organization A");
    await organizations.create(contextB, "Organization B");
    await pool.query(
      `INSERT INTO users (id, twitch_user_id) VALUES ($1, $2), ($3, $4)`,
      [userA, "tenant-a", userB, "tenant-b"]
    );
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner'), ($3, $4, 'owner')`,
      [organizationA, userA, organizationB, userB]
    );
    await entitlements.ensureDefault(contextA);
    await entitlements.ensureDefault(contextB);

    const serverA = await gameServers.create(contextA, {
      displayName: "Palworld Main",
      region: "asia-northeast",
      connectionType: "agent"
    });
    const serverB = await gameServers.create(contextB, {
      displayName: "Palworld Main",
      region: "asia-northeast",
      connectionType: "agent"
    });
    assert.equal((await gameServers.find(contextA, serverB.id)), undefined);
    assert.equal((await gameServers.rename(contextA, serverB.id, "침범 시도")), undefined);
    assert.equal(await gameServers.remove(contextA, serverB.id), false);
    assert.equal((await gameServers.find(contextB, serverB.id)).displayName, "Palworld Main");
    assert.equal((await entitlements.find(contextA)).maxGameServers, 1);

    await assert.rejects(
      pool.query(
        `INSERT INTO agent_installations (
           id, organization_id, game_server_id, status,
           credential_hash, credential_version
         ) VALUES ($1, $2, $3, 'pending', $4, 1)`,
        [crypto.randomUUID(), organizationA, serverB.id, Buffer.alloc(32, 7)]
      ),
      (error) => error.code === "23503"
    );

    await pool.query(
      `INSERT INTO discord_guilds (
         id, organization_id, discord_guild_id, display_name
       ) VALUES ($1, $2, 'guild-b', 'Guild B')`,
      [crypto.randomUUID(), organizationB]
    );
    await assert.rejects(
      pool.query(
        `INSERT INTO discord_installations (
           id, organization_id, discord_guild_id,
           application_id, installed_by_user_id, status
         ) VALUES ($1, $2, 'guild-b', 'application', $3, 'active')`,
        [crypto.randomUUID(), organizationA, userA]
      ),
      (error) => error.code === "23503"
    );

    const jobA = await jobs.enqueue(contextA, {
      gameServerId: serverA.id,
      jobType: "status_changed",
      deduplicationKey: "a-status",
      payload: { online: true }
    });
    await jobs.enqueue(contextB, {
      gameServerId: serverB.id,
      jobType: "status_changed",
      deduplicationKey: "b-status",
      payload: { online: true }
    });
    assert.deepEqual((await jobs.listPending(contextA)).map((job) => job.id), [jobA.id]);
    assert.equal(await jobs.complete(contextB, jobA.id), false);
  });

  await t.test("transaction 실패 후 client를 pool에 반환한다", async () => {
    const before = pool.totalCount;
    await assert.rejects(
      withTransaction(pool, async (client) => {
        await client.query(
          "UPDATE organizations SET display_name = '변경되면 안 됨' WHERE id = $1",
          [organizationA]
        );
        throw new Error("rollback probe");
      }),
      (error) => error instanceof SafeDatabaseError
    );
    assert.equal((await organizations.find(contextA)).displayName, "Organization A");
    assert.ok(pool.totalCount >= before);
    assert.equal(pool.waitingCount, 0);
  });

  await t.test("Agent bootstrap token은 tenant에 귀속되고 hash만 저장된다", async () => {
    const management = new DiscordManagementRepository(pool);
    const serverA = (await gameServers.list(contextA))[0];
    const serverB = (await gameServers.list(contextB))[0];
    const membershipA = await management.requireMembership(userA, organizationA);
    const rawToken = "AGENT_SENTINEL_token_must_never_be_stored_plaintext";
    await withTransaction(pool, async (client) => {
      await new DiscordManagementRepository(client).issueAgentBootstrap({
        context: membershipA.context,
        role: membershipA.role,
        gameServerId: serverA.id,
        tokenHash: crypto.createHash("sha256").update(rawToken).digest(),
        expiresAt: new Date(Date.now() + 10 * 60_000)
      });
    });
    const stored = await pool.query(
      `SELECT encode(token_hash, 'escape') AS token_text, status
       FROM agent_bootstrap_sessions
       WHERE organization_id = $1 AND game_server_id = $2`,
      [organizationA, serverA.id]
    );
    assert.equal(stored.rows[0].status, "issued");
    assert.doesNotMatch(stored.rows[0].token_text, /SENTINEL/u);
    await assert.rejects(
      withTransaction(pool, async (client) => {
        await new DiscordManagementRepository(client).issueAgentBootstrap({
          context: membershipA.context,
          role: membershipA.role,
          gameServerId: serverB.id,
          tokenHash: crypto.randomBytes(32),
          expiresAt: new Date(Date.now() + 10 * 60_000)
        });
      }),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
    );
  });

  await t.test("management session은 opaque token과 CSRF hash만 저장하고 즉시 폐기된다", async () => {
    const repository = new DiscordManagementRepository(pool);
    const rawSession = "MANAGEMENT_SESSION_SENTINEL_plaintext_forbidden";
    const rawCsrf = "MANAGEMENT_CSRF_SENTINEL_plaintext_forbidden";
    const sessionHash = crypto.createHash("sha256").update(rawSession).digest();
    const csrfHash = crypto.createHash("sha256").update(rawCsrf).digest();
    await repository.createSession({
      id: crypto.randomUUID(),
      userId: userA,
      sessionTokenHash: sessionHash,
      csrfTokenHash: csrfHash,
      idleExpiresAt: new Date(Date.now() + 60 * 60_000),
      absoluteExpiresAt: new Date(Date.now() + 2 * 60 * 60_000)
    });
    const stored = await pool.query(
      `SELECT encode(session_token_hash, 'escape') AS session_text,
         encode(csrf_token_hash, 'escape') AS csrf_text
       FROM discord_management_sessions
       WHERE user_id = $1`,
      [userA]
    );
    assert.doesNotMatch(stored.rows[0].session_text, /SENTINEL/u);
    assert.doesNotMatch(stored.rows[0].csrf_text, /SENTINEL/u);
    assert.ok(await repository.findActiveSession(
      sessionHash,
      new Date(Date.now() + 60 * 60_000)
    ));
    await repository.revokeSession(sessionHash);
    assert.equal(await repository.findActiveSession(
      sessionHash,
      new Date(Date.now() + 60 * 60_000)
    ), undefined);
  });

  await t.test("management OAuth 실패는 소비된 state의 PKCE 암호문을 제약 위반 없이 폐기한다", async () => {
    const repository = new DiscordManagementRepository(pool);
    const oauthSessionId = crypto.randomUUID();
    const stateHash = crypto.randomBytes(32);
    const cookieBindingHash = crypto.randomBytes(32);
    const pkceSentinel = Buffer.from(
      "MANAGEMENT_PKCE_SENTINEL_ciphertext_must_be_cleared",
      "utf8"
    );
    await repository.createOAuthSession({
      id: oauthSessionId,
      stateHash,
      cookieBindingHash,
      encryptedPkceVerifier: pkceSentinel,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    });
    assert.ok(await repository.consumeOAuthState({ stateHash, cookieBindingHash }));
    await repository.clearOAuthSecret(oauthSessionId, true);
    const stored = await pool.query(
      `SELECT status, consumed_at,
         encode(pkce_verifier_encrypted, 'escape') AS verifier_text
       FROM discord_management_oauth_sessions
       WHERE id = $1`,
      [oauthSessionId]
    );
    assert.equal(stored.rows[0].status, "security_failed");
    assert.equal(stored.rows[0].consumed_at, null);
    assert.doesNotMatch(stored.rows[0].verifier_text, /SENTINEL/u);
  });

  await t.test("entitlement lock은 동시 서버 생성이 Free 한도를 넘지 못하게 한다", async () => {
    const organization = crypto.randomUUID();
    const user = crypto.randomUUID();
    const context = createTenantContext({ organizationId: organization, actorUserId: user });
    await pool.query(
      "INSERT INTO users (id, discord_user_id) VALUES ($1, $2)",
      [user, `race-${Date.now()}`]
    );
    await pool.query(
      "INSERT INTO organizations (id, display_name) VALUES ($1, 'Race Organization')",
      [organization]
    );
    await pool.query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [organization, user]
    );
    await pool.query(
      "INSERT INTO entitlements (organization_id) VALUES ($1)",
      [organization]
    );
    const create = (name) => withTransaction(pool, async (client) =>
      new DiscordManagementRepository(client).createGameServer({
        context,
        role: "owner",
        displayName: name,
        region: "asia"
      })
    );
    const results = await Promise.allSettled([create("Race A"), create("Race B")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const count = await pool.query(
      `SELECT COUNT(*)::INTEGER AS count FROM game_servers
       WHERE organization_id = $1 AND is_enabled = TRUE`,
      [organization]
    );
    assert.equal(count.rows[0].count, 1);
  });

  await t.test("상태·history·notification index가 tenant 선두 key를 사용한다", async () => {
    const serverA = (await gameServers.list(contextA))[0];
    await pool.query(
      `INSERT INTO server_current_status (
         organization_id, game_server_id, online, players, max_players,
         observed_at, payload_version
       ) VALUES ($1, $2, TRUE, 1, 10, NOW(), 1)`,
      [organizationA, serverA.id]
    );
    await pool.query(
      `INSERT INTO server_status_history (
         id, organization_id, game_server_id, online, players, max_players,
         observed_at, payload_version
       ) VALUES ($1, $2, $3, TRUE, 1, 10, NOW(), 1)`,
      [crypto.randomUUID(), organizationA, serverA.id]
    );
    const indexes = await pool.query(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'server_status_history_recent_idx',
           'notification_jobs_dequeue_idx'
         )
       ORDER BY indexname`
    );
    assert.deepEqual(indexes.rows.map((row) => row.indexname), [
      "notification_jobs_dequeue_idx",
      "server_status_history_recent_idx"
    ]);
  });

  await t.test("100개 조직·1,000개 서버 fixture에서 index와 pool 상한을 관찰한다", async () => {
    const client = await pool.connect();
    const startedAt = performance.now();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO organizations (id, display_name)
         SELECT (
           '10000000-0000-4000-8000-' || LPAD(series::TEXT, 12, '0')
         )::UUID, 'Load Organization ' || series
         FROM generate_series(1000, 1099) AS series`
      );
      await client.query(
        `INSERT INTO game_servers (
           id, organization_id, game_type, display_name, region, connection_type
         )
         SELECT
           ('20000000-0000-4000-8000-' || LPAD(series::TEXT, 12, '0'))::UUID,
           (
             '10000000-0000-4000-8000-'
             || LPAD((1000 + (series % 100))::TEXT, 12, '0')
           )::UUID,
           'palworld',
           'Load Server ' || series,
           'test',
           'agent'
         FROM generate_series(1, 1000) AS series`
      );
      await client.query(
        `INSERT INTO server_current_status (
           organization_id, game_server_id, online, players, max_players,
           observed_at, payload_version
         )
         SELECT organization_id, id, TRUE, 0, 32, NOW(), 1
         FROM game_servers
         WHERE id::TEXT LIKE '20000000-%'
         ON CONFLICT (organization_id, game_server_id) DO UPDATE
           SET observed_at = EXCLUDED.observed_at
           WHERE server_current_status.observed_at < EXCLUDED.observed_at`
      );
      await client.query(
        `INSERT INTO server_status_history (
           id, organization_id, game_server_id, online, players, max_players,
           observed_at, payload_version
         )
         SELECT
           ('30000000-0000-4000-8000-' || LPAD(ROW_NUMBER() OVER ()::TEXT, 12, '0'))::UUID,
           organization_id, id, TRUE, 0, 32, NOW(), 1
         FROM game_servers
         WHERE id::TEXT LIKE '20000000-%'`
      );
      await client.query("SET LOCAL enable_seqscan = off");
      const plan = await client.query(
        `EXPLAIN (FORMAT TEXT)
         SELECT *
         FROM server_status_history
         WHERE organization_id = $1 AND game_server_id = $2
         ORDER BY observed_at DESC
         LIMIT 20`,
        [
          "10000000-0000-4000-8000-000000001001",
          "20000000-0000-4000-8000-000000000001"
        ]
      );
      assert.match(
        plan.rows.map((row) => row["QUERY PLAN"]).join("\n"),
        /server_status_history_recent_idx/u
      );
      assert.ok(pool.options.max <= 10);
      assert.equal(pool.waitingCount, 0);
      t.diagnostic(`fixture 처리 시간 ${Math.round(performance.now() - startedAt)}ms`);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

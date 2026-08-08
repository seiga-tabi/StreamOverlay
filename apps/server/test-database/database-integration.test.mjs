import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { appConfig } from "../dist/config.js";
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
import { DiscordBotControlRepository } from "../dist/database/repositories/discord-bot-control-repository.js";
import { DiscordGuildDirectoryRepository } from "../dist/database/repositories/discord-guild-directory-repository.js";
import { DiscordParticipationAnnouncementRepository } from "../dist/database/repositories/discord-participation-announcement-repository.js";
import { YoroAccountRepository } from "../dist/database/repositories/yoro-account-repository.js";
import { DiscordManagementService } from "../dist/services/discord-management-service.js";
import { YoroAccountService } from "../dist/services/yoro-account-service.js";
import {
  decryptTwitchTokenDocument,
  encryptTwitchTokenDocument
} from "../dist/services/twitch-token-encryption.js";
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
    // 빈 DB에서는 manifest 전체가 pending 이어야 합니다.
    // 숫자를 고정하면 migration 을 추가할 때마다 여기서만 깨집니다.
    assert.equal(inspection.pending.length, manifest.migrations.length);
    const table = await pool.query(
      "SELECT to_regclass('public.schema_migrations')::TEXT AS name"
    );
    assert.equal(table.rows[0].name, null);
  });

  await t.test("빈 DB 적용과 두 번째 no-op 및 checksum 기록", async () => {
    await assert.rejects(
      applyPendingMigrations(pool, manifest),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_INVALID_INPUT"
    );
    const applied = await applyPendingMigrations(pool, manifest, {
      allowDestructive: true
    });
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

  await t.test("웹 management setup 목적은 기존 Bot setup과 함께 허용된다", async () => {
    const setupId = crypto.randomUUID();
    await new DiscordOnboardingRepository(pool).issueSetupSession({
      id: setupId,
      tokenHash: crypto.randomBytes(32),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      requestedApplicationId: "100000000000000001",
      issuedVia: "web_management"
    });
    const stored = await pool.query(
      `SELECT issued_via, requested_application_id
       FROM discord_setup_sessions
       WHERE id = $1`,
      [setupId]
    );
    assert.deepEqual(stored.rows[0], {
      issued_via: "web_management",
      requested_application_id: "100000000000000001"
    });
  });

  await t.test("웹 Guild claim은 Organization·설치·management session을 원자적으로 확정한다", async () => {
    const repository = new DiscordOnboardingRepository(pool);
    const setupSessionId = crypto.randomUUID();
    const oauthSessionId = crypto.randomUUID();
    const discordIdentityId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();
    const applicationId = "100000000000000011";
    const discordGuildId = "100000000000000012";
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const stateHash = crypto.randomBytes(32);
    const cookieBindingHash = crypto.randomBytes(32);
    const csrfTokenHash = crypto.randomBytes(32);

    await repository.issueSetupSession({
      id: setupSessionId,
      tokenHash: crypto.randomBytes(32),
      expiresAt,
      requestedApplicationId: applicationId,
      issuedVia: "web_management"
    });
    await withTransaction(pool, async (client) =>
      new DiscordOnboardingRepository(client).beginOAuthSession({
        setupTokenHash: (await client.query(
          "SELECT token_hash FROM discord_setup_sessions WHERE id = $1",
          [setupSessionId]
        )).rows[0].token_hash,
        oauthSessionId,
        stateHash,
        cookieBindingHash,
        csrfTokenHash,
        encryptedPkceVerifier: crypto.randomBytes(64),
        expiresAt
      })
    );
    await withTransaction(pool, async (client) => {
      const transactional = new DiscordOnboardingRepository(client);
      assert.ok(await transactional.consumeOAuthState({ stateHash, cookieBindingHash }));
      const identity = await transactional.upsertDiscordIdentity({
        identityId: discordIdentityId,
        userId,
        discordUserId: "100000000000000013",
        displayName: "Web Owner"
      });
      await transactional.authenticateOAuthSession({
        oauthSessionId,
        setupSessionId,
        identityId: identity.identityId,
        encryptedTokenRecord: crypto.randomBytes(64),
        tokenExpiresAt: expiresAt
      });
      await transactional.replaceGuildCandidates(oauthSessionId, [{
        id: discordGuildId,
        name: "Web Guild"
      }]);
      await transactional.observeBotInstallation({ applicationId, guildId: discordGuildId });
    });

    const managementSessionId = crypto.randomUUID();
    const rawManagementToken = "MANAGEMENT_SENTINEL_must_not_be_stored";
    const rawCsrfToken = "CSRF_SENTINEL_must_not_be_stored";
    await withTransaction(pool, async (client) => {
      const transactional = new DiscordOnboardingRepository(client);
      const locked = await transactional.lockSetupForConnection(
        setupSessionId,
        discordIdentityId
      );
      assert.equal(locked?.issuedVia, "web_management");
      await transactional.requireObservedBotInstallation({
        applicationId,
        guildId: discordGuildId
      });
      await transactional.createOrganizationForGuild({
        organizationId,
        userId,
        displayName: "Web Guild"
      });
      await transactional.connectGuild({
        guildRecordId: crypto.randomUUID(),
        organizationId,
        discordGuildId,
        displayName: "Web Guild",
        setupSessionId,
        oauthSessionId,
        actorUserId: userId,
        auditId: crypto.randomUUID(),
        targetHash: crypto.randomBytes(32),
        installationId: crypto.randomUUID(),
        applicationId,
        managementSession: {
          id: managementSessionId,
          sessionTokenHash: crypto.createHash("sha256").update(rawManagementToken).digest(),
          csrfTokenHash: crypto.createHash("sha256").update(rawCsrfToken).digest(),
          idleExpiresAt: expiresAt,
          absoluteExpiresAt: new Date(Date.now() + 60 * 60_000)
        }
      });
    });

    const connected = await pool.query(
      `SELECT
         setup.status AS setup_status,
         oauth.status AS oauth_status,
         oauth.encrypted_token_record,
         guild.organization_id,
         installation.status AS installation_status,
         session.session_token_hash,
         session.csrf_token_hash,
         member.role,
         entitlement.max_discord_guilds
       FROM discord_setup_sessions setup
       JOIN discord_oauth_sessions oauth ON oauth.setup_session_id = setup.id
       JOIN discord_guilds guild ON guild.discord_guild_id = $2
       JOIN discord_installations installation
         ON installation.organization_id = guild.organization_id
        AND installation.discord_guild_id = guild.discord_guild_id
       JOIN discord_management_sessions session ON session.id = $3
       JOIN organization_members member
         ON member.organization_id = guild.organization_id
        AND member.user_id = $4
       JOIN entitlements entitlement ON entitlement.organization_id = guild.organization_id
       WHERE setup.id = $1`,
      [setupSessionId, discordGuildId, managementSessionId, userId]
    );
    assert.equal(connected.rows.length, 1);
    const unifiedManagement = new DiscordManagementService(
      pool,
      undefined,
      fetch,
      {
        authenticateForManagement: async () => ({
          userId,
          csrfToken: rawCsrfToken,
          csrfTokenHash: crypto.createHash("sha256").update(rawCsrfToken).digest()
        })
      }
    );
    const dashboardSession = await unifiedManagement.session(
      `${rawManagementToken}.${rawCsrfToken}`
    );
    assert.equal(dashboardSession?.authenticated, true);
    assert.equal(dashboardSession?.organizations.length, 1);
    assert.equal(dashboardSession?.organizations[0]?.id, organizationId);
    assert.equal(connected.rows[0].setup_status, "completed");
    assert.equal(connected.rows[0].oauth_status, "consumed");
    assert.equal(connected.rows[0].encrypted_token_record, null);
    assert.equal(connected.rows[0].organization_id, organizationId);
    assert.equal(connected.rows[0].installation_status, "active");
    assert.equal(connected.rows[0].role, "owner");
    assert.equal(connected.rows[0].max_discord_guilds, 1);
    assert.notEqual(
      connected.rows[0].session_token_hash.toString("utf8"),
      rawManagementToken
    );
    assert.notEqual(connected.rows[0].csrf_token_hash.toString("utf8"), rawCsrfToken);

    await repository.revokeBotInstallation({ applicationId, guildId: discordGuildId });
    const revoked = await pool.query(
      `SELECT installation.status AS installation_status,
         observation.status AS observation_status
       FROM discord_installations installation
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       WHERE installation.organization_id = $1
         AND installation.discord_guild_id = $2
         AND installation.application_id = $3`,
      [organizationId, discordGuildId, applicationId]
    );
    assert.deepEqual(revoked.rows[0], {
      installation_status: "revoked",
      observation_status: "revoked"
    });

    await repository.observeBotInstallation({ applicationId, guildId: discordGuildId });
    const restored = await pool.query(
      `SELECT installation.status AS installation_status,
         observation.status AS observation_status
       FROM discord_installations installation
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       WHERE installation.organization_id = $1
         AND installation.discord_guild_id = $2
         AND installation.application_id = $3`,
      [organizationId, discordGuildId, applicationId]
    );
    assert.deepEqual(restored.rows[0], {
      installation_status: "active",
      observation_status: "observed"
    });

    await assert.rejects(
      withTransaction(pool, async (client) => {
        const transactional = new DiscordOnboardingRepository(client);
        assert.equal(
          (await transactional.lockSetupForConnection(
            setupSessionId,
            discordIdentityId
          ))?.status,
          "completed"
        );
        throw new SafeDatabaseError("DATABASE_CONFLICT", false);
      }),
      (error) => error instanceof SafeDatabaseError
    );
    assert.equal(
      (await pool.query(
        "SELECT COUNT(*)::INTEGER AS count FROM discord_guilds WHERE discord_guild_id = $1",
        [discordGuildId]
      )).rows[0].count,
      1
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
      connectionType: "rest"
    });
    const serverB = await gameServers.create(contextB, {
      displayName: "Palworld Main",
      region: "asia-northeast",
      connectionType: "rest"
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

  await t.test("길드 채널 캐시는 설치된 Guild만 저장하고 tenant로 격리한다", async () => {
    const applicationId = "910000000000000001";
    const guildA = "910000000000000002";
    const unknownGuild = "910000000000000009";
    await pool.query(
      `INSERT INTO discord_guilds (id, organization_id, discord_guild_id, display_name)
       VALUES ($1, $2, $3, 'Directory Guild A')`,
      [crypto.randomUUID(), organizationA, guildA]
    );
    await pool.query(
      `INSERT INTO discord_installations (
         id, organization_id, discord_guild_id, application_id,
         installed_by_user_id, status
       ) VALUES ($1, $2, $3, $4, $5, 'active')`,
      [crypto.randomUUID(), organizationA, guildA, applicationId, userA]
    );

    const repository = new DiscordGuildDirectoryRepository(pool);
    const report = {
      applicationId,
      guildId: guildA,
      channels: [
        { id: "911000000000000001", name: "참여-알림" },
        { id: "911000000000000002", name: "공지" }
      ],
      roles: [{ id: "912000000000000001", name: "참여알림" }],
      channelsTruncated: false,
      rolesTruncated: false
    };
    assert.equal(await repository.replaceReport(report), true);

    // 설치되지 않은 Guild 보고는 저장하지 않고 조용히 무시합니다.
    assert.equal(
      await repository.replaceReport({ ...report, guildId: unknownGuild }),
      false
    );

    const listed = await repository.listForOrganizations([organizationA]);
    const entry = listed.find((item) => item.discordGuildId === guildA);
    assert.ok(entry);
    assert.deepEqual(entry.channels.map((channel) => channel.id), [
      "911000000000000001",
      "911000000000000002"
    ]);

    // 다른 tenant 는 같은 캐시를 볼 수 없습니다.
    assert.deepEqual(await repository.listForOrganizations([organizationB]), []);

    // 후보 안의 채널만 저장을 허용합니다.
    assert.equal(await repository.allowsChannel({
      organizationId: organizationA,
      discordGuildId: guildA,
      channelId: "911000000000000001"
    }), true);
    assert.equal(await repository.allowsChannel({
      organizationId: organizationA,
      discordGuildId: guildA,
      channelId: "911000000000000099"
    }), false);
    // 역할도 후보 안에 있어야 합니다.
    assert.equal(await repository.allowsChannel({
      organizationId: organizationA,
      discordGuildId: guildA,
      channelId: "911000000000000001",
      mentionRoleId: "912000000000000001"
    }), true);
    assert.equal(await repository.allowsChannel({
      organizationId: organizationA,
      discordGuildId: guildA,
      channelId: "911000000000000001",
      mentionRoleId: "912000000000000099"
    }), false);
    // 다른 tenant 로는 허용 판정이 나오지 않습니다.
    assert.equal(await repository.allowsChannel({
      organizationId: organizationB,
      discordGuildId: guildA,
      channelId: "911000000000000001"
    }), false);

    // 재보고는 통째로 교체합니다.
    assert.equal(await repository.replaceReport({
      ...report,
      channels: [{ id: "911000000000000003", name: "새-채널" }],
      channelsTruncated: true
    }), true);
    const replaced = (await repository.listForOrganizations([organizationA]))
      .find((item) => item.discordGuildId === guildA);
    assert.deepEqual(replaced.channels.map((channel) => channel.id), [
      "911000000000000003"
    ]);
    assert.equal(replaced.channelsTruncated, true);
    assert.equal(await repository.allowsChannel({
      organizationId: organizationA,
      discordGuildId: guildA,
      channelId: "911000000000000001"
    }), false);
  });

  await t.test("참여 알림 대상은 본인 organization·후보 채널·길드 거부권을 강제한다", async () => {
    const applicationId = "920000000000000001";
    const guildA = "920000000000000002";
    const channelOk = "921000000000000001";
    const roleOk = "922000000000000001";
    const streamerTwitchId = "923000000000000001";
    await pool.query(
      `INSERT INTO discord_guilds (id, organization_id, discord_guild_id, display_name)
       VALUES ($1, $2, $3, 'Announce Guild A')`,
      [crypto.randomUUID(), organizationA, guildA]
    );
    await pool.query(
      `INSERT INTO discord_installations (
         id, organization_id, discord_guild_id, application_id,
         installed_by_user_id, status
       ) VALUES ($1, $2, $3, $4, $5, 'active')`,
      [crypto.randomUUID(), organizationA, guildA, applicationId, userA]
    );
    await new DiscordGuildDirectoryRepository(pool).replaceReport({
      applicationId,
      guildId: guildA,
      channels: [{ id: channelOk, name: "참여-알림" }],
      roles: [{ id: roleOk, name: "참여알림" }],
      channelsTruncated: false,
      rolesTruncated: false
    });

    const repository = new DiscordParticipationAnnouncementRepository(pool);
    const base = { userId: userA, streamerTwitchUserId: streamerTwitchId };

    const empty = await repository.read(base);
    assert.equal(empty.enabled, false);
    assert.deepEqual(empty.targets, []);
    // 앞선 테스트가 만든 길드도 후보에 들어오므로 대상 길드만 찾습니다.
    const candidate = empty.available.find((item) => item.discordGuildId === guildA);
    assert.ok(candidate, "설치된 길드는 후보에 있어야 합니다.");
    assert.equal(candidate.announcementAllowed, true);
    assert.deepEqual(candidate.channels.map((entry) => entry.id), [channelOk]);

    await repository.replace({
      ...base,
      enabled: true,
      targets: [{
        organizationId: organizationA,
        discordGuildId: guildA,
        channelId: channelOk,
        mentionRoleId: roleOk
      }]
    });
    const saved = await repository.read(base);
    assert.equal(saved.enabled, true);
    assert.equal(saved.targets.length, 1);
    assert.equal(saved.targets[0].channelName, "참여-알림");
    assert.equal(saved.targets[0].mentionRoleName, "참여알림");
    assert.equal(saved.targets[0].deliverable, "ok");

    // 후보에 없는 채널은 저장할 수 없습니다.
    await assert.rejects(
      repository.replace({
        ...base,
        enabled: true,
        targets: [{
          organizationId: organizationA,
          discordGuildId: guildA,
          channelId: "921000000000000099"
        }]
      }),
      (error) => error.code === "DATABASE_INVALID_INPUT"
    );

    // 후보에 없는 역할도 막습니다.
    await assert.rejects(
      repository.replace({
        ...base,
        enabled: true,
        targets: [{
          organizationId: organizationA,
          discordGuildId: guildA,
          channelId: channelOk,
          mentionRoleId: "922000000000000099"
        }]
      }),
      (error) => error.code === "DATABASE_INVALID_INPUT"
    );

    // 본인이 멤버가 아닌 organization 은 "없는 것"으로 다룹니다(403 아님).
    await assert.rejects(
      repository.replace({
        ...base,
        enabled: true,
        targets: [{
          organizationId: organizationB,
          discordGuildId: guildA,
          channelId: channelOk
        }]
      }),
      (error) => error.code === "DATABASE_REFERENCE_INVALID"
    );

    // 상한 초과
    await assert.rejects(
      repository.replace({
        ...base,
        enabled: true,
        targets: Array.from({ length: 4 }, () => ({
          organizationId: organizationA,
          discordGuildId: guildA,
          channelId: channelOk
        }))
      }),
      (error) => error.code === "DATABASE_INVALID_INPUT"
    );

    // 다른 스트리머는 이 설정을 보지 못합니다.
    const otherStreamer = await repository.read({
      userId: userA,
      streamerTwitchUserId: "923000000000000099"
    });
    assert.deepEqual(otherStreamer.targets, []);

    // 길드 관리자가 끄면 저장을 막고, 기존 대상은 사유를 드러냅니다.
    await pool.query(
      `INSERT INTO discord_bot_control_configs (
         organization_id, discord_guild_id, application_id,
         participation_announce_enabled, updated_by_user_id
       ) VALUES ($1, $2, $3, FALSE, $4)
       ON CONFLICT (organization_id, discord_guild_id, application_id)
       DO UPDATE SET participation_announce_enabled = FALSE`,
      [organizationA, guildA, applicationId, userA]
    );
    const blocked = await repository.read(base);
    const blockedCandidate = blocked.available
      .find((item) => item.discordGuildId === guildA);
    assert.equal(blockedCandidate.announcementAllowed, false);
    assert.equal(blocked.targets[0].deliverable, "blocked_by_guild");
    await assert.rejects(
      repository.replace({
        ...base,
        enabled: true,
        targets: [{
          organizationId: organizationA,
          discordGuildId: guildA,
          channelId: channelOk
        }]
      }),
      (error) => error.code === "DATABASE_CONFLICT"
    );

    // 이 테스트가 만든 행은 되돌립니다. 뒤 테스트가 같은 organization 을 씁니다.
    await pool.query(
      `DELETE FROM discord_participation_announcement_targets
        WHERE streamer_twitch_user_id = $1`,
      [streamerTwitchId]
    );
    await pool.query(
      `DELETE FROM discord_bot_control_configs WHERE discord_guild_id = $1`,
      [guildA]
    );
  });

  await t.test("Discord Bot 제어 설정은 tenant·role·revision을 강제한다", async () => {
    const applicationId = "900000000000000001";
    const guildA = "900000000000000002";
    const guildB = "900000000000000003";
    const discordUserA = "900000000000000004";
    const discordUserB = "900000000000000005";
    await pool.query(
      `INSERT INTO discord_guilds (
         id, organization_id, discord_guild_id, display_name
       ) VALUES
         ($1, $2, $3, 'Control Guild A'),
         ($4, $5, $6, 'Control Guild B')`,
      [
        crypto.randomUUID(),
        organizationA,
        guildA,
        crypto.randomUUID(),
        organizationB,
        guildB
      ]
    );
    await pool.query(
      `INSERT INTO discord_installations (
         id, organization_id, discord_guild_id, application_id,
         installed_by_user_id, status
       ) VALUES
         ($1, $2, $3, $4, $5, 'active'),
         ($6, $7, $8, $4, $9, 'active')`,
      [
        crypto.randomUUID(),
        organizationA,
        guildA,
        applicationId,
        userA,
        crypto.randomUUID(),
        organizationB,
        guildB,
        userB
      ]
    );
    await pool.query(
      `INSERT INTO discord_bot_installation_observations (
         discord_guild_id, application_id, status
       ) VALUES ($1, $3, 'observed'), ($2, $3, 'observed')`,
      [guildA, guildB, applicationId]
    );
    await pool.query(
      `INSERT INTO external_identities (
         id, user_id, provider, provider_subject, display_name
       ) VALUES
         ($1, $2, 'discord', $3, 'Control User A'),
         ($4, $5, 'discord', $6, 'Control User B')`,
      [
        crypto.randomUUID(),
        userA,
        discordUserA,
        crypto.randomUUID(),
        userB,
        discordUserB
      ]
    );
    const repository = new DiscordBotControlRepository(pool);
    const initialA = await repository.overview({
      context: contextA,
      role: "owner",
      applicationId,
      globalPrefixCommandsEnabled: true
    });
    assert.equal(initialA.installation.guildId, guildA);
    assert.equal(initialA.settings.revision, 0);

    const updatedA = await withTransaction(pool, async (client) =>
      new DiscordBotControlRepository(client).update({
        context: contextA,
        role: "owner",
        applicationId,
        globalPrefixCommandsEnabled: true,
        value: {
          publicCommandsEnabled: true,
          palworldStatusEnabled: true,
          statusCommandEnabled: false,
          playerCommandEnabled: true,
          guideCommandEnabled: true,
          deleteInvocationAfterReply: true,
          preferredLocale: "ja",
          statusFields: {
            players: true,
            version: false,
            latency: false,
            observedAt: true
          },
          participationAnnounceEnabled: true,
          expectedRevision: 0
        }
      })
    );
    assert.equal(updatedA.settings.revision, 1);
    assert.equal(updatedA.settings.statusCommandEnabled, false);
    assert.equal(updatedA.settings.playerCommandEnabled, true);
    assert.deepEqual(await repository.commandPolicy({
      applicationId,
      guildId: guildA,
      command: "status"
    }), {
      allowed: false,
      commands: {
        help: true,
        status: false,
        player: true,
        guide: true
      },
      deleteInvocationAfterReply: true,
      preferredLocale: "ja",
      statusFields: {
        players: true,
        version: false,
        latency: false,
        observedAt: true
      },
      revision: 1,
      reason: "command_disabled"
    });
    const defaultB = await repository.commandPolicy({
      applicationId,
      guildId: guildB,
      command: "status"
    });
    assert.equal(defaultB.allowed, true);
    assert.equal(defaultB.revision, 0);

    const localeUpdate = await withTransaction(pool, async (client) =>
      new DiscordBotControlRepository(client).updateResponseLocale({
        applicationId,
        guildId: guildA,
        userId: discordUserA,
        preferredLocale: "en"
      })
    );
    assert.deepEqual(localeUpdate, { preferredLocale: "en", revision: 2 });
    const englishPolicy = await repository.commandPolicy({
      applicationId,
      guildId: guildA,
      command: "status"
    });
    assert.equal(englishPolicy.preferredLocale, "en");
    assert.equal(englishPolicy.commands.status, false);
    assert.equal(englishPolicy.revision, 2);
    await assert.rejects(
      withTransaction(pool, async (client) =>
        new DiscordBotControlRepository(client).updateResponseLocale({
          applicationId,
          guildId: guildA,
          userId: discordUserB,
          preferredLocale: "ko"
        })
      ),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
    );

    await assert.rejects(
      withTransaction(pool, async (client) =>
        new DiscordBotControlRepository(client).update({
          context: contextA,
          role: "owner",
          applicationId,
          globalPrefixCommandsEnabled: true,
          value: {
            publicCommandsEnabled: true,
            palworldStatusEnabled: true,
            statusCommandEnabled: true,
            playerCommandEnabled: true,
            guideCommandEnabled: true,
            deleteInvocationAfterReply: false,
            preferredLocale: "auto",
            statusFields: {
              players: true,
              version: true,
              latency: true,
              observedAt: true
            },
            participationAnnounceEnabled: true,
            expectedRevision: 1
          }
        })
      ),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_CONFLICT"
    );
    await assert.rejects(
      repository.update({
        context: contextA,
        role: "viewer",
        applicationId,
        globalPrefixCommandsEnabled: true,
        value: {
          publicCommandsEnabled: true,
          palworldStatusEnabled: true,
          statusCommandEnabled: true,
          playerCommandEnabled: true,
          guideCommandEnabled: true,
          deleteInvocationAfterReply: false,
          preferredLocale: "auto",
          statusFields: {
            players: true,
            version: true,
            latency: true,
            observedAt: true
          },
          participationAnnounceEnabled: true,
          expectedRevision: 1
        }
      }),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
    );
    const records = await pool.query(
      `SELECT
         (SELECT COUNT(*)::INTEGER FROM discord_bot_control_configs
          WHERE organization_id = $1) AS config_count,
         (SELECT COUNT(*)::INTEGER FROM discord_bot_control_configs
          WHERE organization_id = $2) AS other_config_count,
         (SELECT COUNT(*)::INTEGER FROM discord_bot_control_revisions
          WHERE organization_id = $1) AS revision_count,
         (SELECT COUNT(*)::INTEGER FROM audit_logs
          WHERE organization_id = $1
            AND action = 'discord.bot.settings.updated') AS audit_count`,
      [organizationA, organizationB]
    );
    assert.deepEqual(records.rows[0], {
      config_count: 1,
      other_config_count: 0,
      revision_count: 2,
      audit_count: 1
    });
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

  await t.test("Discord onboarding과 YORO 로그인은 동일한 provider subject를 같은 사용자로 통합한다", async () => {
    const loginFirstSubject = "909000000000000001";
    const loginFirstUser = await withTransaction(pool, async (client) =>
      new YoroAccountRepository(client).resolveUserForLogin({
        provider: "discord",
        providerSubject: loginFirstSubject,
        displayName: "Dashboard 우선 사용자"
      })
    );
    const loginFirstIdentity = await withTransaction(pool, async (client) =>
      new DiscordOnboardingRepository(client).upsertDiscordIdentity({
        identityId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        requiredUserId: loginFirstUser,
        discordUserId: loginFirstSubject,
        displayName: "Dashboard 우선 사용자"
      })
    );
    assert.equal(loginFirstIdentity.userId, loginFirstUser);
    await assert.rejects(
      withTransaction(pool, async (client) =>
        new DiscordOnboardingRepository(client).upsertDiscordIdentity({
          identityId: crypto.randomUUID(),
          userId: crypto.randomUUID(),
          requiredUserId: crypto.randomUUID(),
          discordUserId: loginFirstSubject,
          displayName: "다른 로그인 사용자"
        })
      ),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_CONFLICT"
    );

    const onboardingFirstSubject = "909000000000000002";
    const onboardingFirstUser = crypto.randomUUID();
    const onboardingFirstIdentity = await withTransaction(pool, async (client) =>
      new DiscordOnboardingRepository(client).upsertDiscordIdentity({
        identityId: crypto.randomUUID(),
        userId: onboardingFirstUser,
        discordUserId: onboardingFirstSubject,
        displayName: "Bot 설정 우선 사용자"
      })
    );
    assert.equal(onboardingFirstIdentity.userId, onboardingFirstUser);
    assert.equal(
      await withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).resolveUserForLogin({
          provider: "discord",
          providerSubject: onboardingFirstSubject,
          displayName: "Bot 설정 우선 사용자"
        })
      ),
      onboardingFirstUser
    );

    const synchronized = await pool.query(
      `SELECT identity.discord_user_id, identity.user_id AS onboarding_user_id,
         external.user_id AS yoro_user_id
       FROM discord_identities identity
       JOIN external_identities external
         ON external.provider = 'discord'
        AND external.provider_subject = identity.discord_user_id
       WHERE identity.discord_user_id = ANY($1::TEXT[])
       ORDER BY identity.discord_user_id`,
      [[loginFirstSubject, onboardingFirstSubject]]
    );
    assert.equal(synchronized.rowCount, 2);
    assert.equal(
      synchronized.rows.every((row) => row.onboarding_user_id === row.yoro_user_id),
      true
    );
  });

  await t.test("YORO 계정은 provider subject로만 식별하고 session·CSRF 평문을 저장하지 않는다", async () => {
    const discordSubject = "910000000000000001";
    const twitchSubject = "920000000000000001";
    const rawSessionToken = "YORO_SESSION_SENTINEL_never_store_plaintext_0001";
    const rawCsrfToken = "YORO_CSRF_SENTINEL_never_store_plaintext_0000001";
    const repository = new YoroAccountRepository(pool);

    const userId = await withTransaction(pool, async (client) =>
      new YoroAccountRepository(client).resolveUserForLogin({
        provider: "discord",
        providerSubject: discordSubject,
        displayName: "Discord 사용자"
      })
    );
    assert.equal(
      await withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).resolveUserForLogin({
          provider: "discord",
          providerSubject: discordSubject,
          displayName: "변경된 표시 이름"
        })
      ),
      userId
    );
    const concurrentSubject = "910000000000000003";
    const concurrentUsers = await Promise.all([
      withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).resolveUserForLogin({
          provider: "discord",
          providerSubject: concurrentSubject,
          displayName: "동시 로그인 A"
        })
      ),
      withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).resolveUserForLogin({
          provider: "discord",
          providerSubject: concurrentSubject,
          displayName: "동시 로그인 B"
        })
      )
    ]);
    assert.equal(concurrentUsers[0], concurrentUsers[1]);
    assert.equal(
      await withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).linkIdentity({
          userId,
          provider: "twitch",
          providerSubject: twitchSubject,
          displayName: "Twitch 사용자"
        })
      ),
      "linked"
    );

    const otherUserId = await withTransaction(pool, async (client) =>
      new YoroAccountRepository(client).resolveUserForLogin({
        provider: "discord",
        providerSubject: "910000000000000002",
        displayName: "다른 사용자"
      })
    );
    assert.equal(
      await withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).linkIdentity({
          userId: otherUserId,
          provider: "twitch",
          providerSubject: twitchSubject,
          displayName: "Twitch 사용자"
        })
      ),
      "conflict"
    );

    const sessionId = crypto.randomUUID();
    await repository.createSession({
      id: sessionId,
      userId,
      sessionTokenHash: crypto.createHash("sha256").update(rawSessionToken).digest(),
      csrfTokenHash: crypto.createHash("sha256").update(rawCsrfToken).digest(),
      authenticationProvider: "discord",
      idleExpiresAt: new Date(Date.now() + 60_000),
      absoluteExpiresAt: new Date(Date.now() + 120_000)
    });
    const stored = await pool.query(
      `SELECT
         encode(session_token_hash, 'escape') AS session_hash,
         encode(csrf_token_hash, 'escape') AS csrf_hash
       FROM yoro_sessions
       WHERE id = $1`,
      [sessionId]
    );
    assert.doesNotMatch(stored.rows[0].session_hash, /SENTINEL/u);
    assert.doesNotMatch(stored.rows[0].csrf_hash, /SENTINEL/u);
    assert.deepEqual(
      (await repository.listIdentities(userId)).map((identity) => identity.provider),
      ["discord", "twitch"]
    );
    assert.deepEqual(await repository.getUserPreferences(userId), {
      locale: "ko",
      defaultDashboardPage: "overview",
      reducedMotion: false
    });
    assert.deepEqual(
      await repository.saveUserPreferences(userId, {
        locale: "ja",
        defaultDashboardPage: "organizations",
        reducedMotion: true
      }),
      {
        locale: "ja",
        defaultDashboardPage: "organizations",
        reducedMotion: true
      }
    );
    assert.deepEqual(await repository.getUserPreferences(userId), {
      locale: "ja",
      defaultDashboardPage: "organizations",
      reducedMotion: true
    });
    assert.deepEqual(await repository.getUserPreferences(otherUserId), {
      locale: "ko",
      defaultDashboardPage: "overview",
      reducedMotion: false
    });

    const twitchCredentialSentinel = "YORO_TWITCH_ACCESS_SENTINEL_never_store_plaintext";
    const twitchCredentialKey = crypto.randomBytes(32);
    const twitchCredentialAad = `yoro-twitch-viewer:${userId}`;
    const encryptedCredential = Buffer.from(
      encryptTwitchTokenDocument(
        JSON.stringify({
          accessToken: twitchCredentialSentinel,
          refreshToken: "YORO_TWITCH_REFRESH_SENTINEL_never_store_plaintext",
          scopes: ["user:read:follows", "user:read:subscriptions"]
        }),
        twitchCredentialKey,
        twitchCredentialAad
      ),
      "utf8"
    );
    await repository.upsertTwitchCredential({
      userId,
      encryptedTokenRecord: encryptedCredential,
      tokenExpiresAt: new Date(Date.now() + 60_000)
    });
    const credentialRow = await pool.query(
      `SELECT encode(encrypted_token_record, 'escape') AS encrypted_text,
         status, revoked_at
       FROM yoro_twitch_viewer_credentials
       WHERE user_id = $1`,
      [userId]
    );
    assert.doesNotMatch(credentialRow.rows[0].encrypted_text, /YORO_TWITCH/u);
    assert.equal(credentialRow.rows[0].status, "active");
    const lockedCredential = await withTransaction(pool, async (client) =>
      new YoroAccountRepository(client).lockTwitchCredential(userId)
    );
    assert.ok(lockedCredential);
    assert.equal(
      JSON.parse(
        decryptTwitchTokenDocument(
          lockedCredential.encrypted_token_record.toString("utf8"),
          twitchCredentialKey,
          twitchCredentialAad
        ).plaintext
      ).accessToken,
      twitchCredentialSentinel
    );

    assert.equal(
      await withTransaction(pool, async (client) => {
        const transactionRepository = new YoroAccountRepository(client);
        const revoked = await transactionRepository.revokeIdentity(userId, "twitch");
        await transactionRepository.revokeTwitchCredential(userId);
        return revoked;
      }),
      true
    );
    const revokedCredential = await pool.query(
      `SELECT encrypted_token_record, status, revoked_at
       FROM yoro_twitch_viewer_credentials
       WHERE user_id = $1`,
      [userId]
    );
    assert.equal(revokedCredential.rows[0].encrypted_token_record, null);
    assert.equal(revokedCredential.rows[0].status, "revoked");
    assert.ok(revokedCredential.rows[0].revoked_at);
    assert.equal(
      await withTransaction(pool, async (client) =>
        new YoroAccountRepository(client).revokeIdentity(userId, "discord")
      ),
      false
    );
  });

  await t.test("YORO Twitch 로그인은 LIVE scope와 암호화 credential을 session에 연결한다", async () => {
    const previousConfig = {
      clientId: appConfig.twitch.clientId,
      clientSecret: appConfig.twitch.clientSecret,
      publicRedirectUri: appConfig.twitch.publicRedirectUri,
      tokenEncryptionKey: appConfig.twitch.tokenEncryptionKey
    };
    appConfig.twitch.clientId = "yoro-twitch-client";
    appConfig.twitch.clientSecret = "yoro-twitch-client-secret";
    appConfig.twitch.publicRedirectUri = "http://localhost:3000/api/public/twitch/auth/callback";
    appConfig.twitch.tokenEncryptionKey = crypto.randomBytes(32).toString("base64");
    const rawAccessToken = "YORO_TWITCH_ACCESS_SENTINEL_service_never_store_plaintext";
    const rawRefreshToken = "YORO_TWITCH_REFRESH_SENTINEL_service_never_store_plaintext";
    const twitchUserId = "930000000000000001";
    const fetchImpl = async (url) => {
      if (url === "https://id.twitch.tv/oauth2/token") {
        return new Response(JSON.stringify({
          access_token: rawAccessToken,
          refresh_token: rawRefreshToken,
          expires_in: 3600,
          scope: ["user:read:follows", "user:read:subscriptions"],
          token_type: "bearer"
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url === "https://api.twitch.tv/helix/users") {
        return new Response(JSON.stringify({
          data: [{
            id: twitchUserId,
            login: "yoro_viewer",
            display_name: "YORO Viewer",
            profile_image_url: "https://static-cdn.jtvnw.net/jtv_user_pictures/yoro-viewer.png"
          }]
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw new Error(`예상하지 못한 Twitch URL: ${url}`);
    };

    try {
      const service = new YoroAccountService(pool, undefined, fetchImpl);
      const started = await service.beginOAuth({
        provider: "twitch",
        purpose: "login",
        returnPath: "/lol"
      });
      const authorizationUrl = new URL(started.authorizationUrl);
      assert.deepEqual(
        authorizationUrl.searchParams.get("scope")?.split(" ").sort(),
        ["user:read:follows", "user:read:subscriptions"]
      );
      const completed = await service.completeOAuth({
        provider: "twitch",
        state: authorizationUrl.searchParams.get("state"),
        code: "oauth-code",
        oauthCookie: started.cookieValue
      });
      assert.equal(completed.returnPath, "/lol");
      const context = await service.getTwitchAccessContext(completed.sessionToken);
      assert.ok(context);
      assert.equal(context.userId, twitchUserId);
      assert.equal(context.accessToken, rawAccessToken);
      assert.equal(context.user.displayName, "YORO Viewer");

      const stored = await pool.query(
        `SELECT encode(credential.encrypted_token_record, 'escape') AS encrypted_text,
           credential.status, identity.provider_subject
         FROM yoro_twitch_viewer_credentials credential
         JOIN external_identities identity ON identity.user_id = credential.user_id
         WHERE identity.provider = 'twitch' AND identity.provider_subject = $1`,
        [twitchUserId]
      );
      assert.equal(stored.rows[0].status, "active");
      assert.equal(stored.rows[0].provider_subject, twitchUserId);
      assert.doesNotMatch(stored.rows[0].encrypted_text, /YORO_TWITCH/u);
    } finally {
      appConfig.twitch.clientId = previousConfig.clientId;
      appConfig.twitch.clientSecret = previousConfig.clientSecret;
      appConfig.twitch.publicRedirectUri = previousConfig.publicRedirectUri;
      appConfig.twitch.tokenEncryptionKey = previousConfig.tokenEncryptionKey;
    }
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
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organization]
    );
    assert.equal(count.rows[0].count, 1);

    const current = await pool.query(
      `SELECT id, display_name FROM game_servers
       WHERE organization_id = $1 AND deleted_at IS NULL`,
      [organization]
    );
    await pool.query(
      `INSERT INTO agent_bootstrap_sessions (
         id, organization_id, game_server_id, issued_by_user_id,
         token_hash, expires_at
       ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '10 minutes')`,
      [
        crypto.randomUUID(),
        organization,
        current.rows[0].id,
        user,
        crypto.randomBytes(32)
      ]
    );
    await pool.query(
      `INSERT INTO agent_installations (
         id, organization_id, game_server_id, status,
         credential_hash, credential_version
       ) VALUES ($1, $2, $3, 'pending', $4, 1)`,
      [
        crypto.randomUUID(),
        organization,
        current.rows[0].id,
        crypto.randomBytes(32)
      ]
    );
    await pool.query(
      `INSERT INTO server_connections (
         id, organization_id, game_server_id, connection_type,
         encrypted_config, encryption_key_version, schema_version
       ) VALUES ($1, $2, $3, 'rest', $4, 1, 1)`,
      [
        crypto.randomUUID(),
        organization,
        current.rows[0].id,
        crypto.randomBytes(32)
      ]
    );
    await assert.rejects(
      withTransaction(pool, async (client) =>
        new DiscordManagementRepository(client).deleteGameServer({
          context,
          role: "manager",
          gameServerId: current.rows[0].id
        })
      ),
      (error) => error instanceof SafeDatabaseError
        && error.code === "DATABASE_REFERENCE_INVALID"
    );
    const deleted = await withTransaction(pool, async (client) =>
      new DiscordManagementRepository(client).deleteGameServer({
        context,
        role: "owner",
        gameServerId: current.rows[0].id
      })
    );
    assert.equal(deleted, true);
    assert.deepEqual(
      await new DiscordManagementRepository(pool).listGameServers(context, "owner"),
      []
    );

    const replacement = await create(current.rows[0].display_name);
    assert.equal(replacement.displayName, current.rows[0].display_name);
    const lifecycle = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::INTEGER AS registered_count,
         COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::INTEGER AS deleted_count
       FROM game_servers
       WHERE organization_id = $1`,
      [organization]
    );
    assert.deepEqual(lifecycle.rows[0], {
      registered_count: 1,
      deleted_count: 1
    });
    const revokedCredentials = await pool.query(
      `SELECT
         (SELECT status FROM agent_bootstrap_sessions
          WHERE organization_id = $1 AND game_server_id = $2) AS bootstrap_status,
         (SELECT status FROM agent_installations
          WHERE organization_id = $1 AND game_server_id = $2) AS installation_status,
         (SELECT COUNT(*)::INTEGER FROM server_connections
          WHERE organization_id = $1 AND game_server_id = $2) AS connection_count`,
      [organization, current.rows[0].id]
    );
    assert.deepEqual(revokedCredentials.rows[0], {
      bootstrap_status: "revoked",
      installation_status: "revoked",
      connection_count: 0
    });
    await assert.rejects(
      pool.query(
        `INSERT INTO game_servers (
           id, organization_id, game_type, display_name, region,
           connection_type, connection_status
         ) VALUES ($1, $2, 'palworld', 'Constraint Probe', 'asia', 'rest', 'not_configured')`,
        [crypto.randomUUID(), organization]
      ),
      (error) => error?.code === "23505"
    );
    const audits = await pool.query(
      `SELECT action
       FROM audit_logs
       WHERE organization_id = $1
         AND action = 'organization.game_server.deleted'`,
      [organization]
    );
    assert.equal(audits.rowCount, 1);
  });

  await t.test("상태·history·notification index가 tenant 선두 key를 사용한다", async () => {
    const serverA = (await gameServers.list(contextA))[0];
    await pool.query(
      `INSERT INTO server_current_status (
         organization_id, game_server_id, online, players, max_players,
         observed_at, payload_version
       ) VALUES ($1, $2, TRUE, 1, 10, NOW(), 1)
       ON CONFLICT (organization_id, game_server_id) DO UPDATE
         SET online = EXCLUDED.online,
             players = EXCLUDED.players,
             max_players = EXCLUDED.max_players,
             observed_at = EXCLUDED.observed_at,
             payload_version = EXCLUDED.payload_version`,
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
           id, organization_id, game_type, display_name, region, connection_type,
           connection_status, is_enabled, deleted_at
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
           'agent',
           CASE WHEN series <= 100 THEN 'not_configured' ELSE 'revoked' END,
           series <= 100,
           CASE WHEN series <= 100 THEN NULL ELSE NOW() END
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

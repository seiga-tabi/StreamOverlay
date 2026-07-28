import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(__filename), "..");

function strongSecret(label) {
  return `${label}_${"a".repeat(48)}`;
}

function strongEncryptionKey(seed = 0) {
  return Buffer.from(Array.from({ length: 32 }, (_, index) => (index + seed) % 256)).toString("base64");
}

function runConfigValidation(envPatch, dotenvMode = 0o600) {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-runtime-config-"));
  const emptyEnv = path.join(dir, ".env");
  writeFileSync(emptyEnv, "", { encoding: "utf8", mode: dotenvMode });
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DOTENV_CONFIG_PATH: emptyEnv,
    NODE_ENV: "production",
    APP_VERSION: "1.4.5",
    GIT_SHA: "af4e7b9",
    BUILD_TIME: "2026-07-27T07:35:19Z",
    PUBLIC_BASE_URL: "https://bot.example.com",
    DASHBOARD_BASE_URL: "https://bot.example.com",
    OVERLAY_BASE_URL: "https://bot.example.com/overlay",
    TWITCH_REDIRECT_URI: "https://bot.example.com/api/twitch/auth/callback",
    CORS_ORIGINS: "https://bot.example.com",
    DASHBOARD_AUTH_TOKEN: strongSecret("dashboard"),
    OVERLAY_ACCESS_TOKEN: strongSecret("overlay"),
    BRIDGE_SHARED_SECRET: strongSecret("bridge"),
    TWITCH_TOKEN_ENCRYPTION_KEY: strongEncryptionKey(4),
    LEGAL_OPERATOR_NAME: "Yoro Individual Service Operator",
    LEGAL_CONTACT_ADDRESS: "1-2-3 Chiyoda, Tokyo, Japan",
    LEGAL_PRIVACY_OFFICER_NAME: "Privacy Operations Lead",
    LEGAL_CONTACT_EMAIL: "support@yoro.gg",
    LEGAL_EFFECTIVE_DATE: "2026-07-11",
    LEGAL_MINIMUM_AGE: "14",
    LEGAL_GOVERNING_LAW_KO: "운영자 소재지의 법률과 이용자 거주지의 강행규정",
    LEGAL_GOVERNING_LAW_JA: "運営者所在地の法令および利用者居住地の強行法規",
    LEGAL_DISPUTE_VENUE_KO: "우선 협의 후 운영자 소재지의 관할 법원",
    LEGAL_DISPUTE_VENUE_JA: "事前協議後、運営者所在地を管轄する裁判所",
    LEGAL_PROCESSORS_KO: "호스팅, CDN 보안 및 이메일 수신 수탁자를 공개 고지",
    LEGAL_PROCESSORS_JA: "ホスティング、CDNセキュリティおよびメール受信委託先を公開",
    LEGAL_CROSS_BORDER_TRANSFER_KO: "이전받는 자, 국가, 항목, 목적, 방법과 보유기간을 공개 고지",
    LEGAL_CROSS_BORDER_TRANSFER_JA: "移転先、国、項目、目的、方法および保存期間を公開",
    ...envPatch
  };
  const script = `
    import("./dist/config.js")
      .then(({ validateRuntimeConfig }) => {
        const result = validateRuntimeConfig();
        console.log(JSON.stringify(result));
        process.exit(result.ok ? 0 : 2);
      })
      .catch((error) => {
        console.error(error.message);
        process.exit(3);
      });
  `;
  try {
    return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: serverRoot,
      env,
      encoding: "utf8"
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runConfigSnapshot(envPatch) {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-runtime-config-snapshot-"));
  const emptyEnv = path.join(dir, ".env");
  writeFileSync(emptyEnv, "", { encoding: "utf8", mode: 0o600 });
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DOTENV_CONFIG_PATH: emptyEnv,
    ...envPatch
  };
  const script = `
    import("./dist/config.js")
      .then(({ appConfig }) => {
        console.log(JSON.stringify({
          nodeEnv: appConfig.nodeEnv,
          localNoAuth: appConfig.security.localNoAuth,
          dashboardAuthRequired: !appConfig.security.localNoAuth,
          dashboardTokenConfigured: Boolean(appConfig.security.dashboardAuthToken),
          overlayAuthRequired: Boolean(appConfig.security.overlayAccessToken),
          bridgeSecret: appConfig.bridge.sharedSecret
        }));
      })
      .catch((error) => {
        console.error(error.message);
        process.exit(3);
      });
  `;
  try {
    return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: serverRoot,
      env,
      encoding: "utf8"
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("production 설정은 강한 secret과 https origin이면 통과한다", () => {
  const result = runConfigValidation({});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { ok: true });
});

test("production 설정은 실제 build version·Git SHA·build 시각을 요구한다", () => {
  const result = runConfigValidation({
    APP_VERSION: "not-a-version",
    GIT_SHA: "unknown",
    BUILD_TIME: "unknown"
  });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /APP_VERSION/);
  assert.match(result.stdout, /GIT_SHA/);
  assert.match(result.stdout, /BUILD_TIME/);
  assert.doesNotMatch(result.stdout, /not-a-version/);

  const explicitTestIdentity = runConfigValidation({
    APP_VERSION: "0.0.0-test",
    GIT_SHA: "0000000000000000000000000000000000000000",
    BUILD_TIME: "1970-01-01T00:00:00.000Z"
  });
  assert.equal(explicitTestIdentity.status, 2);
  assert.match(explicitTestIdentity.stdout, /development\/test identity/u);
  assert.match(explicitTestIdentity.stdout, /Git commit SHA/u);
});

test("production 설정은 runtime identity와 Docker image metadata 불일치를 차단한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-release-metadata-"));
  const metadataPath = path.join(dir, "release.json");
  try {
    writeFileSync(metadataPath, JSON.stringify({
      version: "1.4.5",
      gitSha: "0123456789abcdef0123456789abcdef01234567",
      builtAt: "2026-07-27T07:35:19Z"
    }), { mode: 0o444 });
    const mismatch = runConfigValidation({ IMAGE_RELEASE_METADATA_PATH: metadataPath });
    assert.equal(mismatch.status, 2, mismatch.stderr || mismatch.stdout);
    assert.match(mismatch.stdout, /Docker image metadata/u);

    const matching = runConfigValidation({
      IMAGE_RELEASE_METADATA_PATH: metadataPath,
      GIT_SHA: "0123456789abcdef0123456789abcdef01234567"
    });
    assert.equal(matching.status, 0, matching.stderr || matching.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("production 설정은 확정된 공개 법적 운영정보를 요구한다", () => {
  const result = runConfigValidation({
    LEGAL_OPERATOR_NAME: "초안 운영자 정보",
    LEGAL_CONTACT_ADDRESS: undefined,
    LEGAL_EFFECTIVE_DATE: "2026-02-31",
    LEGAL_CONTACT_EMAIL: "invalid-address",
    LEGAL_CROSS_BORDER_TRANSFER_JA: "未定"
  });

  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.match(result.stdout, /LEGAL_OPERATOR_NAME/);
  assert.match(result.stdout, /LEGAL_CONTACT_ADDRESS/);
  assert.match(result.stdout, /LEGAL_EFFECTIVE_DATE/);
  assert.match(result.stdout, /LEGAL_CONTACT_EMAIL/);
  assert.match(result.stdout, /LEGAL_CROSS_BORDER_TRANSFER_JA/);
  assert.doesNotMatch(result.stdout, /초안 운영자 정보/);
});

test("production 설정은 너무 열린 dotenv 파일 권한을 거부한다", () => {
  const result = runConfigValidation({}, 0o644);
  assert.equal(result.status, 2, result.stderr || result.stdout);
  const validation = JSON.parse(result.stdout);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("0600")));
});

test("production 지원 메일함은 webhook secret과 32바이트 암호화 key를 요구한다", () => {
  const valid = runConfigValidation({
    SUPPORT_MAILBOX_ENABLED: "true",
    SUPPORT_MAILBOX_ADDRESS: "support@yoro.gg",
    SUPPORT_MAILBOX_WEBHOOK_SECRET: strongSecret("support_webhook"),
    SUPPORT_MAILBOX_ENCRYPTION_KEY: strongEncryptionKey(5)
  });
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);

  const invalid = runConfigValidation({
    SUPPORT_MAILBOX_ENABLED: "true",
    SUPPORT_MAILBOX_ADDRESS: "not-an-email",
    SUPPORT_MAILBOX_WEBHOOK_SECRET: "weak",
    SUPPORT_MAILBOX_ENCRYPTION_KEY: "invalid"
  });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stdout, /SUPPORT_MAILBOX_WEBHOOK_SECRET/);
  assert.match(invalid.stdout, /SUPPORT_MAILBOX_ADDRESS/);
  assert.match(invalid.stdout, /SUPPORT_MAILBOX_ENCRYPTION_KEY/);
  assert.doesNotMatch(invalid.stdout, /support_webhook/);
});

test("production 설정은 Twitch OAuth token 암호화 key를 요구한다", () => {
  const missing = runConfigValidation({ TWITCH_TOKEN_ENCRYPTION_KEY: undefined });
  assert.equal(missing.status, 2);
  assert.match(missing.stdout, /TWITCH_TOKEN_ENCRYPTION_KEY/);

  const invalid = runConfigValidation({ TWITCH_TOKEN_ENCRYPTION_KEY: "invalid" });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stdout, /TWITCH_TOKEN_ENCRYPTION_KEY/);
  assert.doesNotMatch(invalid.stdout, /invalid/);

  const weak = runConfigValidation({ TWITCH_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64") });
  assert.equal(weak.status, 2);
  assert.match(weak.stdout, /TWITCH_TOKEN_ENCRYPTION_KEY/);
});

test("Discord SaaS는 feature·Database 상태에 따라 안전하게 설정을 검증한다", () => {
  const disabled = runConfigValidation({
    DISCORD_SAAS_ENABLED: "false"
  });
  assert.equal(disabled.status, 0, disabled.stderr || disabled.stdout);

  const databaseDisabled = runConfigValidation({
    DISCORD_SAAS_ENABLED: "true",
    DATABASE_ENABLED: "false"
  });
  assert.equal(databaseDisabled.status, 0, databaseDisabled.stderr || databaseDisabled.stdout);

  const databaseUrl = "postgresql://streamops_app:correct-horse-battery-staple@postgres/streamops";
  const missing = runConfigValidation({
    DATABASE_ENABLED: "true",
    DATABASE_URL: databaseUrl,
    DISCORD_SAAS_ENABLED: "true"
  });
  assert.equal(missing.status, 2);
  assert.match(missing.stdout, /DISCORD_CLIENT_ID/u);
  assert.match(missing.stdout, /DISCORD_CLIENT_SECRET/u);
  assert.match(missing.stdout, /DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY/u);

  const reusedKey = strongEncryptionKey(4);
  const reuse = runConfigValidation({
    DATABASE_ENABLED: "true",
    DATABASE_URL: databaseUrl,
    DISCORD_SAAS_ENABLED: "true",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: strongSecret("discord_client"),
    DISCORD_OAUTH_REDIRECT_URI: "https://bot.example.com/api/discord/oauth/callback",
    DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY: reusedKey
  });
  assert.equal(reuse.status, 2);
  assert.match(reuse.stdout, /Twitch token encryption key를 재사용할 수 없습니다/u);
  assert.doesNotMatch(reuse.stdout, new RegExp(reusedKey, "u"));

  const valid = runConfigValidation({
    DATABASE_ENABLED: "true",
    DATABASE_URL: databaseUrl,
    DISCORD_SAAS_ENABLED: "true",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: strongSecret("discord_client"),
    DISCORD_OAUTH_REDIRECT_URI: "https://bot.example.com/api/discord/oauth/callback",
    DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY: strongEncryptionKey(12)
  });
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
});

test("Discord Bot 내부 API는 별도 secret file과 기존 기능 준비 상태를 요구한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-discord-bot-secret-"));
  const internalKeyPath = path.join(dir, "discord_bot_internal_auth_key");
  writeFileSync(internalKeyPath, strongSecret("discord_bot_internal"), { mode: 0o600 });
  const databaseUrl = "postgresql://streamops_app:correct-horse-battery-staple@postgres/streamops";
  const base = {
    DATABASE_ENABLED: "true",
    DATABASE_URL: databaseUrl,
    DISCORD_SAAS_ENABLED: "true",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: strongSecret("discord_client"),
    DISCORD_OAUTH_REDIRECT_URI: "https://bot.example.com/api/discord/oauth/callback",
    DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY: strongEncryptionKey(12),
    DISCORD_BOT_INTERNAL_API_ENABLED: "true",
    DISCORD_APPLICATION_ID: "123456789012345678"
  };
  try {
    const valid = runConfigValidation({
      ...base,
      DISCORD_BOT_INTERNAL_AUTH_KEY: undefined,
      DISCORD_BOT_INTERNAL_AUTH_KEY_FILE: internalKeyPath
    });
    assert.equal(valid.status, 0, valid.stderr || valid.stdout);

    const direct = runConfigValidation({
      ...base,
      DISCORD_BOT_INTERNAL_AUTH_KEY: strongSecret("discord_bot_direct"),
      DISCORD_BOT_INTERNAL_AUTH_KEY_FILE: undefined
    });
    assert.equal(direct.status, 2);
    assert.match(direct.stdout, /DISCORD_BOT_INTERNAL_AUTH_KEY_FILE/u);
    assert.doesNotMatch(direct.stdout, /discord_bot_direct/u);

    const databaseDisabled = runConfigValidation({
      ...base,
      DATABASE_ENABLED: "false",
      DISCORD_BOT_INTERNAL_AUTH_KEY: undefined,
      DISCORD_BOT_INTERNAL_AUTH_KEY_FILE: internalKeyPath
    });
    assert.equal(databaseDisabled.status, 2);
    assert.match(databaseDisabled.stdout, /Database와 Discord SaaS/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Discord Bot 관리 기능은 Database·Discord SaaS와 정확한 callback·TTL을 요구한다", () => {
  const databaseUrl = "postgresql://streamops_app:correct-horse-battery-staple@postgres/streamops";
  const base = {
    DATABASE_ENABLED: "true",
    DATABASE_URL: databaseUrl,
    DISCORD_SAAS_ENABLED: "true",
    DISCORD_CLIENT_ID: "123456789012345678",
    DISCORD_CLIENT_SECRET: strongSecret("discord_client"),
    DISCORD_OAUTH_REDIRECT_URI: "https://bot.example.com/api/discord/oauth/callback",
    DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY: strongEncryptionKey(12),
    DISCORD_BOT_MANAGEMENT_ENABLED: "true",
    DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI:
      "https://bot.example.com/api/discord/management/oauth/callback"
  };

  const valid = runConfigValidation(base);
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);

  const databaseDisabled = runConfigValidation({
    ...base,
    DATABASE_ENABLED: "false"
  });
  assert.equal(databaseDisabled.status, 2);
  assert.match(databaseDisabled.stdout, /Database와 Discord SaaS/u);

  const unsafeCallback = runConfigValidation({
    ...base,
    DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI:
      "https://attacker.example/api/discord/management/oauth/callback?next=external",
    DISCORD_MANAGEMENT_IDLE_TTL_SECONDS: "28801",
    AGENT_BOOTSTRAP_TTL_SECONDS: "1801"
  });
  assert.equal(unsafeCallback.status, 2);
  assert.match(unsafeCallback.stdout, /정확한 관리 callback URL/u);
  assert.match(unsafeCallback.stdout, /DISCORD_MANAGEMENT_IDLE_TTL_SECONDS/u);
  assert.match(unsafeCallback.stdout, /AGENT_BOOTSTRAP_TTL_SECONDS/u);
  assert.doesNotMatch(unsafeCallback.stdout, /attacker\.example/u);
});

test("Agent Ingestion은 기본 비활성이고 활성화 시 안전한 범위만 허용한다", () => {
  const disabledDatabase = runConfigValidation({
    AGENT_INGESTION_ENABLED: "true",
    DATABASE_ENABLED: "false"
  });
  assert.equal(disabledDatabase.status, 0, disabledDatabase.stderr || disabledDatabase.stdout);

  const invalid = runConfigValidation({
    AGENT_INGESTION_ENABLED: "true",
    AGENT_CREDENTIAL_TTL_DAYS: "0",
    AGENT_CLOCK_SKEW_SECONDS: "10",
    AGENT_NONCE_TTL_SECONDS: "5",
    AGENT_MAXIMUM_BODY_BYTES: "999",
    AGENT_RATE_LIMIT_PER_MINUTE: "601"
  });
  assert.equal(invalid.status, 2);
  assert.match(invalid.stdout, /AGENT_CREDENTIAL_TTL_DAYS/u);
  assert.match(invalid.stdout, /AGENT_CLOCK_SKEW_SECONDS/u);
  assert.match(invalid.stdout, /AGENT_NONCE_TTL_SECONDS/u);
  assert.match(invalid.stdout, /AGENT_MAXIMUM_BODY_BYTES/u);
  assert.match(invalid.stdout, /AGENT_RATE_LIMIT_PER_MINUTE/u);
});

test("production 설정은 약한 secret, http URL, wildcard CORS를 거부하고 secret 값을 출력하지 않는다", () => {
  const result = runConfigValidation({
    BRIDGE_SHARED_SECRET: "dev-secret-change-me",
    PUBLIC_BASE_URL: "http://localhost:3000",
    TWITCH_REDIRECT_URI: "http://localhost:3000/api/twitch/auth/callback",
    CORS_ORIGINS: "*"
  });

  assert.equal(result.status, 2);
  assert.match(result.stdout, /BRIDGE_SHARED_SECRET/);
  assert.match(result.stdout, /PUBLIC_BASE_URL/);
  assert.match(result.stdout, /TWITCH_REDIRECT_URI/);
  assert.match(result.stdout, /CORS_ORIGINS/);
  assert.doesNotMatch(result.stdout, /dev-secret-change-me/);
});

test("secret은 *_FILE에서 읽을 수 있고 직접 값과 동시에 설정하면 실패한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-secret-file-"));
  const dashboardSecretPath = path.join(dir, "dashboard_secret");
  writeFileSync(dashboardSecretPath, `${strongSecret("dashboard_file")}\n`, "utf8");

  try {
    const ok = runConfigValidation({
      DASHBOARD_AUTH_TOKEN: undefined,
      DASHBOARD_AUTH_TOKEN_FILE: dashboardSecretPath
    });
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);

    const conflict = runConfigValidation({
      DASHBOARD_AUTH_TOKEN: strongSecret("dashboard_direct"),
      DASHBOARD_AUTH_TOKEN_FILE: dashboardSecretPath
    });
    assert.equal(conflict.status, 3);
    assert.match(conflict.stderr, /DASHBOARD_AUTH_TOKEN.*DASHBOARD_AUTH_TOKEN_FILE/);
    assert.doesNotMatch(conflict.stderr, /dashboard_direct/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Database는 기본 비활성 상태에서 연결 secret을 요구하거나 파일을 읽지 않는다", () => {
  const result = runConfigValidation({
    DATABASE_ENABLED: "false",
    DATABASE_URL: undefined,
    DATABASE_URL_FILE: "/존재하지-않는-경로/database_url"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("production Database는 안전한 범위와 credential을 검증한다", () => {
  const password = "Q7x9vK2mN4pR6tW8yZ1cD3fG5hJ7";
  const valid = runConfigValidation({
    DATABASE_ENABLED: "true",
    DATABASE_URL: `postgresql://streamops_app:${password}@postgres/streamops`,
    DATABASE_SSL_MODE: "disable",
    DATABASE_POOL_MAX: "10",
    DATABASE_CONNECTION_TIMEOUT_MS: "5000",
    DATABASE_STATEMENT_TIMEOUT_MS: "10000"
  });
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);

  const invalid = runConfigValidation({
    DATABASE_ENABLED: "true",
    DATABASE_URL: "postgresql://postgres:password@db.example.com/streamops",
    DATABASE_SSL_MODE: "disable",
    DATABASE_POOL_MAX: "11",
    DATABASE_MIGRATION_MODE: "apply"
  });
  assert.equal(invalid.status, 2, invalid.stderr || invalid.stdout);
  assert.match(invalid.stdout, /DATABASE_POOL_MAX/u);
  assert.match(invalid.stdout, /DATABASE_MIGRATION_MODE/u);
  assert.match(invalid.stdout, /credential/u);
  assert.match(invalid.stdout, /verify-full/u);
  assert.doesNotMatch(invalid.stdout, /postgresql:\/\//u);
  assert.doesNotMatch(invalid.stdout, /password@/u);
});

test("DATABASE_URL과 DATABASE_URL_FILE 동시 설정을 secret 노출 없이 차단한다", () => {
  const result = runConfigValidation({
    DATABASE_ENABLED: "false",
    DATABASE_URL: "postgresql://private-user:private-password@postgres/streamops",
    DATABASE_URL_FILE: "/tmp/database-url-secret"
  });

  assert.equal(result.status, 3);
  assert.match(result.stderr, /DATABASE_URL.*DATABASE_URL_FILE/u);
  assert.doesNotMatch(result.stderr, /private-user|private-password/u);
});

test("local no-auth mode는 dashboard와 overlay token 입력을 요구하지 않는다", () => {
  const result = runConfigSnapshot({
    NODE_ENV: "development",
    STREAMOPS_LOCAL_NO_AUTH: "true",
    DASHBOARD_AUTH_TOKEN: strongSecret("dashboard_local"),
    OVERLAY_ACCESS_TOKEN: strongSecret("overlay_local")
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    nodeEnv: "development",
    localNoAuth: true,
    dashboardAuthRequired: false,
    dashboardTokenConfigured: false,
    overlayAuthRequired: false,
    bridgeSecret: "dev-secret-change-me"
  });
});

test("development 기본값은 dashboard 인증을 요구하고 token 미설정 상태를 구분한다", () => {
  const result = runConfigSnapshot({
    NODE_ENV: "development",
    STREAMOPS_LOCAL_NO_AUTH: "false",
    DASHBOARD_AUTH_TOKEN: undefined,
    OVERLAY_ACCESS_TOKEN: undefined
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    nodeEnv: "development",
    localNoAuth: false,
    dashboardAuthRequired: true,
    dashboardTokenConfigured: false,
    overlayAuthRequired: false,
    bridgeSecret: "dev-secret-change-me"
  });
});

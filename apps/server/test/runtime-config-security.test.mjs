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

function runConfigValidation(envPatch, dotenvMode = 0o600) {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-runtime-config-"));
  const emptyEnv = path.join(dir, ".env");
  writeFileSync(emptyEnv, "", { encoding: "utf8", mode: dotenvMode });
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DOTENV_CONFIG_PATH: emptyEnv,
    NODE_ENV: "production",
    PUBLIC_BASE_URL: "https://bot.example.com",
    DASHBOARD_BASE_URL: "https://bot.example.com",
    OVERLAY_BASE_URL: "https://bot.example.com/overlay",
    TWITCH_REDIRECT_URI: "https://bot.example.com/api/twitch/auth/callback",
    CORS_ORIGINS: "https://bot.example.com",
    DASHBOARD_AUTH_TOKEN: strongSecret("dashboard"),
    OVERLAY_ACCESS_TOKEN: strongSecret("overlay"),
    BRIDGE_SHARED_SECRET: strongSecret("bridge"),
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
    SUPPORT_MAILBOX_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString("base64")
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

test("production Palworld 서버 상태 기능은 별도 32바이트 key와 destination allowlist를 요구한다", () => {
  const palworldKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64");
  const valid = runConfigValidation({
    PALWORLD_SERVER_STATUS_ENABLED: "true",
    PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY: palworldKey,
    PALWORLD_REST_ALLOWED_ORIGINS: "https://pal.example.com:8212,http://10.0.0.15:8212,10.0.0.0/24"
  });
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);

  const invalid = runConfigValidation({
    PALWORLD_SERVER_STATUS_ENABLED: "true",
    PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY: "invalid",
    PALWORLD_REST_ALLOWED_ORIGINS: "*"
  });
  assert.equal(invalid.status, 2, invalid.stderr || invalid.stdout);
  assert.match(invalid.stdout, /PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY/);
  assert.match(invalid.stdout, /PALWORLD_REST_ALLOWED_ORIGINS/);
  assert.doesNotMatch(invalid.stdout, /pal\.example\.com/);

  const cidrOnly = runConfigValidation({
    PALWORLD_SERVER_STATUS_ENABLED: "true",
    PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY: palworldKey,
    PALWORLD_REST_ALLOWED_ORIGINS: "10.0.0.0/24"
  });
  assert.equal(cidrOnly.status, 2, cidrOnly.stderr || cidrOnly.stdout);
  assert.match(cidrOnly.stdout, /exact origin/);
});

test("Palworld 암호화 key는 다른 secret과 재사용하거나 직접 값과 _FILE을 동시에 사용할 수 없다", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "streamops-palworld-key-file-"));
  const keyPath = path.join(directory, "palworld_key");
  const key = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 11)).toString("base64");
  writeFileSync(keyPath, `${key}\n`, "utf8");
  try {
    const fromFile = runConfigValidation({
      PALWORLD_SERVER_STATUS_ENABLED: "true",
      PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY: undefined,
      PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY_FILE: keyPath,
      PALWORLD_REST_ALLOWED_ORIGINS: "https://pal.example.com:8212"
    });
    assert.equal(fromFile.status, 0, fromFile.stderr || fromFile.stdout);

    const conflict = runConfigValidation({
      PALWORLD_SERVER_STATUS_ENABLED: "true",
      PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY: key,
      PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY_FILE: keyPath,
      PALWORLD_REST_ALLOWED_ORIGINS: "https://pal.example.com:8212"
    });
    assert.equal(conflict.status, 3);
    assert.match(conflict.stderr, /PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY.*PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY_FILE/);
    assert.equal(conflict.stderr.includes(key), false);

    const reused = runConfigValidation({
      PALWORLD_SERVER_STATUS_ENABLED: "true",
      PALWORLD_SERVER_CREDENTIALS_ENCRYPTION_KEY: key,
      PALWORLD_REST_ALLOWED_ORIGINS: "https://pal.example.com:8212",
      DASHBOARD_AUTH_TOKEN: key
    });
    assert.equal(reused.status, 2);
    assert.match(reused.stdout, /같은 값을 재사용/);
    assert.equal(reused.stdout.includes(key), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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

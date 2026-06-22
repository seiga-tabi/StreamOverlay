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

function runConfigValidation(envPatch) {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-runtime-config-"));
  const emptyEnv = path.join(dir, ".env");
  writeFileSync(emptyEnv, "", "utf8");
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DOTENV_CONFIG_PATH: emptyEnv,
    NODE_ENV: "production",
    PUBLIC_BASE_URL: "https://bot.example.com",
    TWITCH_REDIRECT_URI: "https://bot.example.com/api/twitch/auth/callback",
    CORS_ORIGINS: "https://bot.example.com",
    DASHBOARD_AUTH_TOKEN: strongSecret("dashboard"),
    OVERLAY_ACCESS_TOKEN: strongSecret("overlay"),
    BRIDGE_SHARED_SECRET: strongSecret("bridge"),
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
  writeFileSync(emptyEnv, "", "utf8");
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

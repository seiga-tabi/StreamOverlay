import assert from "node:assert/strict";
import test from "node:test";
import {
  parseYoroRuntimeConfig,
  YoroRuntimeConfigError
} from "../dist/yoro-runtime-config.js";

function validRuntime() {
  return {
    schemaVersion: 1,
    environment: "production",
    public: {
      baseUrl: "https://yoro.gg",
      dashboardOrigin: "https://yoro.gg"
    },
    features: {
      database: true,
      discordSaas: true,
      discordBot: true,
      discordBotManagement: true,
      agentIngestion: true,
      twitchEventSub: true
    },
    database: {
      poolMax: 10,
      sslMode: "disable"
    },
    discord: {
      clientId: "123456789",
      applicationId: "123456789",
      oauthRedirectUri: "https://yoro.gg/api/discord/oauth/callback",
      managementOauthRedirectUri: "https://yoro.gg/api/discord/management/oauth/callback"
    },
    twitch: {
      clientId: "public-client-id",
      eventSubSubscriptions: ["stream.online", "stream.offline"]
    },
    riot: {
      accountRegion: "asia",
      lolPlatform: "kr"
    },
    agent: {
      statusIntervalSeconds: 300
    }
  };
}

test("runtime config는 알려지지 않은 필드와 secret 형태 필드를 거부한다", () => {
  assert.throws(
    () => parseYoroRuntimeConfig({ ...validRuntime(), password: "노출되면 안 됨" }),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_unknown_field"
  );
});

test("production runtime config는 HTTPS 공개 origin만 허용한다", () => {
  const value = validRuntime();
  value.public.baseUrl = "http://yoro.gg";
  assert.throws(
    () => parseYoroRuntimeConfig(value),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_public_base_url_invalid"
  );
});

test("활성 Discord 기능은 공개 ID와 callback 설정을 요구한다", () => {
  const value = validRuntime();
  delete value.discord;
  assert.throws(
    () => parseYoroRuntimeConfig(value),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_discord_required"
  );
});

test("정상 runtime config를 정규화한다", () => {
  const value = validRuntime();
  value.discord.prefixCommandsEnabled = true;
  const parsed = parseYoroRuntimeConfig(value);
  assert.equal(parsed.environment, "production");
  assert.equal(parsed.public.baseUrl, "https://yoro.gg");
  assert.equal(parsed.features.agentIngestion, true);
  assert.equal(parsed.database?.poolMax, 10);
  assert.equal(parsed.discord?.prefixCommandsEnabled, true);
});

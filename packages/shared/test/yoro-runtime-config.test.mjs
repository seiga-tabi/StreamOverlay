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
      discordParticipationAnnounce: true,
      riotRso: false,
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

test("legacy overlay origin도 허용 전에 HTTPS origin으로 검증한다", () => {
  const value = validRuntime();
  value.public.overlayOrigin = "http://overlay.yoro.gg";
  assert.throws(
    () => parseYoroRuntimeConfig(value),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_public_overlay_origin_invalid"
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

test("참여 모집 Discord 알림은 누락 시 false이고 boolean만 허용한다", () => {
  const omitted = validRuntime();
  delete omitted.features.discordParticipationAnnounce;
  assert.equal(parseYoroRuntimeConfig(omitted).features.discordParticipationAnnounce, false);

  const invalid = validRuntime();
  invalid.features.discordParticipationAnnounce = "true";
  assert.throws(
    () => parseYoroRuntimeConfig(invalid),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_features_discord_participation_announce_invalid"
  );
});

test("참여 모집 Discord 알림은 Database와 Discord 전체 기능을 요구한다", () => {
  const value = validRuntime();
  value.features.database = false;
  value.features.discordSaas = false;
  value.features.discordBot = false;
  value.features.discordBotManagement = false;
  assert.throws(
    () => parseYoroRuntimeConfig(value),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_discord_participation_announce_dependency"
  );
});

test("Twitch Extension은 누락 시 비활성이고 활성화 시 DB와 공개 client ID를 요구한다", () => {
  const omitted = validRuntime();
  delete omitted.features.twitchExtension;
  assert.equal(parseYoroRuntimeConfig(omitted).features.twitchExtension, false);

  const missing = validRuntime();
  missing.features.twitchExtension = true;
  assert.throws(
    () => parseYoroRuntimeConfig(missing),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_twitch_extension_dependency"
  );

  const enabled = validRuntime();
  enabled.features.twitchExtension = true;
  enabled.twitch.extensionClientId = "publictwitchextensionclientid";
  assert.equal(parseYoroRuntimeConfig(enabled).features.twitchExtension, true);
});

test("Riot RSO는 누락 시 false이고 활성화 시 Twitch·계정 기반과 callback을 요구한다", () => {
  const omitted = validRuntime();
  delete omitted.features.riotRso;
  assert.equal(parseYoroRuntimeConfig(omitted).features.riotRso, false);

  const missing = validRuntime();
  missing.features.riotRso = true;
  assert.throws(
    () => parseYoroRuntimeConfig(missing),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_riot_rso_required"
  );

  const enabled = validRuntime();
  enabled.features.riotRso = true;
  enabled.riot.rsoClientId = "riot-rso-client-id";
  enabled.riot.rsoRedirectUri = "https://yoro.gg/api/account/oauth/riot/callback";
  enabled.riot.rsoLogoutRedirectUri = "https://yoro.gg/api/account/oauth/riot/logout/callback";
  assert.equal(parseYoroRuntimeConfig(enabled).features.riotRso, true);

  const foreignOrigin = structuredClone(enabled);
  foreignOrigin.riot.rsoRedirectUri = "https://account.example.com/api/account/oauth/riot/callback";
  assert.throws(
    () => parseYoroRuntimeConfig(foreignOrigin),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_riot_rso_origin_mismatch"
  );
});

test("Riot RSO는 Database·Discord 관리 계정·Twitch OAuth 의존성을 강제한다", () => {
  const value = validRuntime();
  value.features.riotRso = true;
  value.riot.rsoClientId = "riot-rso-client-id";
  value.riot.rsoRedirectUri = "https://yoro.gg/api/account/oauth/riot/callback";
  value.riot.rsoLogoutRedirectUri = "https://yoro.gg/api/account/oauth/riot/logout/callback";
  value.features.twitchEventSub = false;
  delete value.twitch;
  assert.throws(
    () => parseYoroRuntimeConfig(value),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_riot_rso_dependency"
  );
});

test("발로란트 공개 기능과 Riot 프로덕션 승인 게이트를 분리한다", () => {
  const omitted = validRuntime();
  delete omitted.features.valorantPublic;
  assert.equal(parseYoroRuntimeConfig(omitted).features.valorantPublic, false);

  const invalid = validRuntime();
  invalid.riot.valorantProductionApproved = true;
  assert.throws(
    () => parseYoroRuntimeConfig(invalid),
    (error) => error instanceof YoroRuntimeConfigError
      && error.code === "runtime_valorant_approval_feature_dependency"
  );

  const enabled = validRuntime();
  enabled.features.valorantPublic = true;
  enabled.riot.valorantProductionApproved = true;
  enabled.riot.valorantCurrentActId = "d816f426-48ea-f052-117f-9697a155b319";
  const parsed = parseYoroRuntimeConfig(enabled);
  assert.equal(parsed.features.valorantPublic, true);
  assert.equal(parsed.riot?.valorantProductionApproved, true);
  assert.equal(parsed.riot?.valorantCurrentActId, "d816f426-48ea-f052-117f-9697a155b319");
});

test("정상 runtime config를 정규화하고 제거된 legacy 설정은 활성화하지 않는다", () => {
  const value = validRuntime();
  value.public.overlayOrigin = "https://overlay.yoro.gg";
  value.discord.prefixCommandsEnabled = true;
  const parsed = parseYoroRuntimeConfig(value);
  assert.equal(parsed.environment, "production");
  assert.equal(parsed.public.baseUrl, "https://yoro.gg");
  assert.equal(Object.hasOwn(parsed.public, "overlayOrigin"), false);
  assert.equal(Object.hasOwn(parsed.features, "agentIngestion"), false);
  assert.equal(parsed.features.discordParticipationAnnounce, true);
  assert.equal(Object.hasOwn(parsed, "agent"), false);
  assert.equal(parsed.database?.poolMax, 10);
  assert.equal(parsed.discord?.prefixCommandsEnabled, true);
});

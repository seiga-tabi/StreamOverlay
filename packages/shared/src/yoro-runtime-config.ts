export type YoroRuntimeEnvironment = "development" | "test" | "production";

export type YoroRuntimeConfig = Readonly<{
  schemaVersion: 1;
  environment: YoroRuntimeEnvironment;
  public: Readonly<{
    baseUrl: string;
    dashboardOrigin: string;
  }>;
  features: Readonly<{
    database: boolean;
    discordSaas: boolean;
    discordBot: boolean;
    discordBotManagement: boolean;
    twitchEventSub: boolean;
  }>;
  database?: Readonly<{
    poolMax?: number;
    sslMode?: "disable" | "require" | "verify-full";
  }>;
  discord?: Readonly<{
    clientId: string;
    applicationId: string;
    oauthRedirectUri: string;
    managementOauthRedirectUri: string;
    prefixCommandsEnabled?: boolean;
  }>;
  twitch?: Readonly<{
    clientId: string;
    redirectUri?: string;
    publicRedirectUri?: string;
    eventSubSubscriptions?: readonly string[];
    extraScopes?: readonly string[];
    broadcasterId?: string;
    botUserId?: string;
    chatSenderId?: string;
    chatMode?: "broadcaster" | "bot";
  }>;
  riot?: Readonly<{
    accountRegion?: string;
    lolPlatform?: string;
  }>;
}>;

export class YoroRuntimeConfigError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "YoroRuntimeConfigError";
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new YoroRuntimeConfigError(`${path}_object_required`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new YoroRuntimeConfigError(`${path}_unknown_field`);
  }
}

function text(value: unknown, path: string, maximum = 2_048): string {
  if (
    typeof value !== "string"
    || !value.trim()
    || value.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new YoroRuntimeConfigError(`${path}_invalid`);
  }
  return value.trim();
}

function optionalText(value: unknown, path: string, maximum = 2_048): string | undefined {
  return value === undefined ? undefined : text(value, path, maximum);
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new YoroRuntimeConfigError(`${path}_invalid`);
  return value;
}

function optionalInteger(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < minimum || value > maximum) {
    throw new YoroRuntimeConfigError(`${path}_invalid`);
  }
  return value;
}

function origin(value: unknown, path: string, environment: YoroRuntimeEnvironment): string {
  const raw = text(value, path);
  try {
    const parsed = new URL(raw);
    if (
      parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
      || !["http:", "https:"].includes(parsed.protocol)
      || (environment === "production" && parsed.protocol !== "https:")
    ) {
      throw new Error("invalid");
    }
    return parsed.origin;
  } catch {
    throw new YoroRuntimeConfigError(`${path}_invalid`);
  }
}

function callbackUrl(
  value: unknown,
  path: string,
  expectedPath: string,
  environment: YoroRuntimeEnvironment
): string {
  const raw = text(value, path);
  try {
    const parsed = new URL(raw);
    if (
      parsed.username
      || parsed.password
      || parsed.pathname !== expectedPath
      || parsed.search
      || parsed.hash
      || !["http:", "https:"].includes(parsed.protocol)
      || (environment === "production" && parsed.protocol !== "https:")
    ) {
      throw new Error("invalid");
    }
    return parsed.toString();
  } catch {
    throw new YoroRuntimeConfigError(`${path}_invalid`);
  }
}

export function parseYoroRuntimeConfig(value: unknown): YoroRuntimeConfig {
  const root = record(value, "runtime");
  exactKeys(root, [
    "schemaVersion",
    "environment",
    "public",
    "features",
    "database",
    "discord",
    "twitch",
    "riot",
    "agent"
  ], "runtime");
  if (root.schemaVersion !== 1) throw new YoroRuntimeConfigError("runtime_schema_version_unsupported");
  if (!["development", "test", "production"].includes(String(root.environment))) {
    throw new YoroRuntimeConfigError("runtime_environment_invalid");
  }
  const environment = root.environment as YoroRuntimeEnvironment;

  const publicConfig = record(root.public, "runtime_public");
  // schema v1 운영 파일에 존재하던 overlayOrigin은 사용처가 제거됐지만,
  // 기존 배포 설정을 깨지 않도록 형식만 검증한 뒤 런타임 결과에서는 무시합니다.
  exactKeys(publicConfig, ["baseUrl", "dashboardOrigin", "overlayOrigin"], "runtime_public");
  const baseUrl = origin(publicConfig.baseUrl, "runtime_public_base_url", environment);
  const dashboardOrigin = origin(
    publicConfig.dashboardOrigin,
    "runtime_public_dashboard_origin",
    environment
  );
  if (publicConfig.overlayOrigin !== undefined) {
    origin(publicConfig.overlayOrigin, "runtime_public_overlay_origin", environment);
  }

  const features = record(root.features, "runtime_features");
  exactKeys(features, [
    "database",
    "discordSaas",
    "discordBot",
    "discordBotManagement",
    // schema v1 운영 파일의 하위 호환을 위해 읽기만 허용하고 기능에는 반영하지 않습니다.
    "agentIngestion",
    "twitchEventSub"
  ], "runtime_features");
  if (features.agentIngestion !== undefined) {
    bool(features.agentIngestion, "runtime_features_agent_ingestion");
  }
  const featureConfig = {
    database: bool(features.database, "runtime_features_database"),
    discordSaas: bool(features.discordSaas, "runtime_features_discord_saas"),
    discordBot: bool(features.discordBot, "runtime_features_discord_bot"),
    discordBotManagement: bool(
      features.discordBotManagement,
      "runtime_features_discord_bot_management"
    ),
    twitchEventSub: bool(features.twitchEventSub, "runtime_features_twitch_eventsub")
  };

  let database: YoroRuntimeConfig["database"];
  if (root.database !== undefined) {
    const item = record(root.database, "runtime_database");
    exactKeys(item, ["poolMax", "sslMode"], "runtime_database");
    const sslMode = optionalText(item.sslMode, "runtime_database_ssl_mode", 16);
    if (sslMode !== undefined && !["disable", "require", "verify-full"].includes(sslMode)) {
      throw new YoroRuntimeConfigError("runtime_database_ssl_mode_invalid");
    }
    database = {
      ...(optionalInteger(item.poolMax, "runtime_database_pool_max", 1, 10) !== undefined
        ? { poolMax: item.poolMax as number }
        : {}),
      ...(sslMode !== undefined ? { sslMode: sslMode as "disable" | "require" | "verify-full" } : {})
    };
  }

  let discord: YoroRuntimeConfig["discord"];
  if (root.discord !== undefined) {
    const item = record(root.discord, "runtime_discord");
    exactKeys(item, [
      "clientId",
      "applicationId",
      "oauthRedirectUri",
      "managementOauthRedirectUri",
      "prefixCommandsEnabled"
    ], "runtime_discord");
    const clientId = text(item.clientId, "runtime_discord_client_id", 32);
    const applicationId = text(item.applicationId, "runtime_discord_application_id", 32);
    if (!/^\d{1,32}$/u.test(clientId) || !/^\d{1,32}$/u.test(applicationId)) {
      throw new YoroRuntimeConfigError("runtime_discord_id_invalid");
    }
    discord = {
      clientId,
      applicationId,
      oauthRedirectUri: callbackUrl(
        item.oauthRedirectUri,
        "runtime_discord_oauth_redirect_uri",
        "/api/discord/oauth/callback",
        environment
      ),
      managementOauthRedirectUri: callbackUrl(
        item.managementOauthRedirectUri,
        "runtime_discord_management_redirect_uri",
        "/api/discord/management/oauth/callback",
        environment
      ),
      ...(item.prefixCommandsEnabled === undefined
        ? {}
        : {
            prefixCommandsEnabled: bool(
              item.prefixCommandsEnabled,
              "runtime_discord_prefix_commands_enabled"
            )
          })
    };
  }

  let twitch: YoroRuntimeConfig["twitch"];
  if (root.twitch !== undefined) {
    const item = record(root.twitch, "runtime_twitch");
    exactKeys(item, [
      "clientId",
      "redirectUri",
      "publicRedirectUri",
      "eventSubSubscriptions",
      "extraScopes",
      "broadcasterId",
      "botUserId",
      "chatSenderId",
      "chatMode"
    ], "runtime_twitch");
    const subscriptions = item.eventSubSubscriptions;
    if (
      subscriptions !== undefined
      && (!Array.isArray(subscriptions)
        || subscriptions.length > 32
        || subscriptions.some((entry) => typeof entry !== "string" || !entry || entry.length > 128))
    ) {
      throw new YoroRuntimeConfigError("runtime_twitch_subscriptions_invalid");
    }
    const extraScopes = item.extraScopes;
    if (
      extraScopes !== undefined
      && (!Array.isArray(extraScopes)
        || extraScopes.length > 32
        || extraScopes.some((entry) => typeof entry !== "string" || !entry || entry.length > 128))
    ) {
      throw new YoroRuntimeConfigError("runtime_twitch_scopes_invalid");
    }
    const chatMode = optionalText(item.chatMode, "runtime_twitch_chat_mode", 16);
    if (chatMode !== undefined && !["broadcaster", "bot"].includes(chatMode)) {
      throw new YoroRuntimeConfigError("runtime_twitch_chat_mode_invalid");
    }
    twitch = {
      clientId: text(item.clientId, "runtime_twitch_client_id", 128),
      ...(item.redirectUri !== undefined
        ? {
            redirectUri: callbackUrl(
              item.redirectUri,
              "runtime_twitch_redirect_uri",
              "/api/twitch/auth/callback",
              environment
            )
          }
        : {}),
      ...(item.publicRedirectUri !== undefined
        ? {
            publicRedirectUri: callbackUrl(
              item.publicRedirectUri,
              "runtime_twitch_public_redirect_uri",
              "/api/public/twitch/auth/callback",
              environment
            )
          }
        : {}),
      ...(Array.isArray(subscriptions)
        ? { eventSubSubscriptions: subscriptions as string[] }
        : {}),
      ...(Array.isArray(extraScopes) ? { extraScopes: extraScopes as string[] } : {}),
      ...(item.broadcasterId !== undefined
        ? { broadcasterId: text(item.broadcasterId, "runtime_twitch_broadcaster_id", 32) }
        : {}),
      ...(item.botUserId !== undefined
        ? { botUserId: text(item.botUserId, "runtime_twitch_bot_user_id", 32) }
        : {}),
      ...(item.chatSenderId !== undefined
        ? { chatSenderId: text(item.chatSenderId, "runtime_twitch_chat_sender_id", 32) }
        : {}),
      ...(chatMode ? { chatMode: chatMode as "broadcaster" | "bot" } : {})
    };
  }

  let riot: YoroRuntimeConfig["riot"];
  if (root.riot !== undefined) {
    const item = record(root.riot, "runtime_riot");
    exactKeys(item, ["accountRegion", "lolPlatform"], "runtime_riot");
    riot = {
      ...(optionalText(item.accountRegion, "runtime_riot_account_region", 32) !== undefined
        ? { accountRegion: text(item.accountRegion, "runtime_riot_account_region", 32) }
        : {}),
      ...(optionalText(item.lolPlatform, "runtime_riot_lol_platform", 32) !== undefined
        ? { lolPlatform: text(item.lolPlatform, "runtime_riot_lol_platform", 32) }
        : {})
    };
  }

  // 제거된 Agent 설정은 기존 production runtime.json을 깨지 않도록 schema v1에서만
  // 엄격히 검증한 뒤 무시합니다.
  if (root.agent !== undefined) {
    const item = record(root.agent, "runtime_agent");
    exactKeys(item, [
      "enabled",
      "serverOrigin",
      "palworldOrigin",
      "statusIntervalSeconds",
      "requestTimeoutMs",
      "maxRetryAttempts",
      "ingestionCredentialTtlDays"
    ], "runtime_agent");
    if (item.enabled !== undefined) bool(item.enabled, "runtime_agent_enabled");
    if (item.serverOrigin !== undefined) {
      origin(item.serverOrigin, "runtime_agent_server_origin", environment);
    }
    if (item.palworldOrigin !== undefined) {
      origin(item.palworldOrigin, "runtime_agent_palworld_origin", "development");
    }
    optionalInteger(item.statusIntervalSeconds, "runtime_agent_interval", 60, 3_600);
    optionalInteger(item.requestTimeoutMs, "runtime_agent_timeout", 500, 30_000);
    optionalInteger(item.maxRetryAttempts, "runtime_agent_retries", 0, 5);
    optionalInteger(item.ingestionCredentialTtlDays, "runtime_agent_credential_ttl", 1, 365);
  }

  if ((featureConfig.discordSaas || featureConfig.discordBot) && !discord) {
    throw new YoroRuntimeConfigError("runtime_discord_required");
  }
  if (
    (featureConfig.discordSaas
      || featureConfig.discordBot
      || featureConfig.discordBotManagement)
    && !featureConfig.database
  ) {
    throw new YoroRuntimeConfigError("runtime_database_feature_dependency");
  }
  if (
    (featureConfig.discordBot || featureConfig.discordBotManagement)
    && !featureConfig.discordSaas
  ) {
    throw new YoroRuntimeConfigError("runtime_discord_feature_dependency");
  }
  if (featureConfig.twitchEventSub && !twitch) {
    throw new YoroRuntimeConfigError("runtime_twitch_required");
  }

  return Object.freeze({
    schemaVersion: 1,
    environment,
    public: Object.freeze({
      baseUrl,
      dashboardOrigin
    }),
    features: Object.freeze(featureConfig),
    ...(database ? { database: Object.freeze(database) } : {}),
    ...(discord ? { discord: Object.freeze(discord) } : {}),
    ...(twitch ? { twitch: Object.freeze(twitch) } : {}),
    ...(riot ? { riot: Object.freeze(riot) } : {})
  });
}

import dotenv from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadConfiguredRuntime,
  loadFixedSecret,
  loadYoroLegalConfig,
  YORO_SECRET_FILES
} from "./runtime-configuration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = path.resolve(__dirname, "..");
export const projectRoot = path.resolve(serverRoot, "..", "..");

const configuredRuntime = loadConfiguredRuntime();
const legacyEnvironmentMode = configuredRuntime === undefined;
const dotenvPaths: string[] = [];

if (legacyEnvironmentMode) {
  const explicitDotenvPath = process.env.DOTENV_CONFIG_PATH;
  dotenvPaths.push(...(explicitDotenvPath
    ? [path.resolve(explicitDotenvPath)]
    : [path.resolve(projectRoot, ".env"), path.resolve(serverRoot, ".env")]));
  for (const dotenvPath of dotenvPaths) {
    dotenv.config({ path: dotenvPath });
  }
}

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function envOrFile(name: string, fallback = ""): string {
  const direct = process.env[name];
  const filePath = process.env[`${name}_FILE`];
  if (direct && filePath) {
    throw new Error(`${name}와 ${name}_FILE은 동시에 설정할 수 없습니다.`);
  }
  if (filePath) {
    try {
      return fs.readFileSync(filePath, "utf8").trim();
    } catch {
      throw new Error(`${name}_FILE을 읽을 수 없습니다.`);
    }
  }
  return direct ?? fallback;
}

function secretEnvOrFile(name: string): string {
  const direct = process.env[name];
  const filePath = process.env[`${name}_FILE`];
  if (direct && filePath) {
    throw new Error(`${name}와 ${name}_FILE은 동시에 설정할 수 없습니다.`);
  }
  if (!filePath) return direct ?? "";
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid secret file");
    if (nodeEnv === "production" && (stat.mode & 0o077) !== 0) {
      throw new Error("insecure secret file");
    }
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    throw new Error(`${name}_FILE을 안전하게 읽을 수 없습니다.`);
  }
}

function boolEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function listEnv(name: string, fallback = ""): string[] {
  return env(name, fallback)
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizedOrigin(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

function imageReleaseMetadata(): { version: string; gitSha: string; builtAt: string } | undefined {
  const metadataPath = process.env.IMAGE_RELEASE_METADATA_PATH?.trim();
  if (!metadataPath) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    if (
      typeof parsed.version !== "string"
      || typeof parsed.gitSha !== "string"
      || typeof parsed.builtAt !== "string"
    ) return undefined;
    return { version: parsed.version, gitSha: parsed.gitSha, builtAt: parsed.builtAt };
  } catch {
    return undefined;
  }
}

const DEFAULT_EVENTSUB_SUBSCRIPTIONS = [
  "stream.online",
  "stream.offline",
  "channel.chat.message",
  "channel.channel_points_custom_reward_redemption.add"
].join(" ");

const DEFAULTS = Object.freeze({
  port: 3_000,
  twitch: Object.freeze({
    chatThrottleMs: 1_500,
    chatCooldownMs: 10_000,
    chatMaxQueue: 20,
    chatMaxLength: 500,
    chatTemplateValueMaxLength: 120,
    apiTimeoutMs: 10_000
  }),
  database: Object.freeze({
    poolMax: 10,
    idleTimeoutMs: 30_000,
    connectionTimeoutMs: 5_000,
    statementTimeoutMs: 10_000,
    migrationMode: "check",
    sslMode: "disable"
  }),
  discord: Object.freeze({
    setupLinkTtlSeconds: 600,
    oauthSessionTtlSeconds: 900,
    apiTimeoutMs: 10_000,
    managementOauthTtlSeconds: 600,
    managementIdleTtlSeconds: 28_800,
    managementAbsoluteTtlSeconds: 86_400
  }),
  riot: Object.freeze({
    accountRegion: "asia",
    lolPlatform: "kr",
    apiTimeoutMs: 10_000,
    rateLimitPerSecond: 20,
    rateLimitPerTwoMinutes: 100,
    rateLimitQueueMax: 500
  }),
  translation: Object.freeze({
    maxInputLength: 180,
    cacheTtlMs: 10 * 60 * 1_000,
    maxTranslationsPerMinute: 30
  }),
  logging: Object.freeze({
    maxBytes: 10 * 1_024 * 1_024,
    maxFiles: 5
  }),
  dashboardSessionTtlMs: 8 * 60 * 60 * 1_000
});

const nodeEnv = configuredRuntime?.environment ?? env("NODE_ENV", "development");
const runtimePath = (productionPath: string, developmentPath: string): string => (
  configuredRuntime && nodeEnv === "production" ? productionPath : developmentPath
);
const defaultStateDir = configuredRuntime
  ? runtimePath("/app/.streamops", path.resolve(projectRoot, ".streamops"))
  : env("STREAMOPS_STATE_DIR", path.resolve(projectRoot, ".streamops"));
const localNoAuthRequested = configuredRuntime
  ? false
  : boolEnv("STREAMOPS_LOCAL_NO_AUTH", false);
const localNoAuth = localNoAuthRequested && nodeEnv !== "production";
const dashboardAuthToken = localNoAuth
  ? ""
  : configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.dashboardAuthToken, { required: nodeEnv === "production" })
    : envOrFile("DASHBOARD_AUTH_TOKEN");
const overlayAccessToken = localNoAuth
  ? ""
  : configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.overlayAccessToken, { required: nodeEnv === "production" })
    : envOrFile("OVERLAY_ACCESS_TOKEN");
const bridgeSharedSecret = configuredRuntime
  ? loadFixedSecret(YORO_SECRET_FILES.bridgeSharedSecret, { required: nodeEnv === "production" })
  : envOrFile("BRIDGE_SHARED_SECRET", "dev-secret-change-me");
const imageBuild = imageReleaseMetadata();
const databaseEnabled = configuredRuntime?.features.database ?? boolEnv("DATABASE_ENABLED", false);
if (legacyEnvironmentMode && process.env.DATABASE_URL && process.env.DATABASE_URL_FILE) {
  throw new Error("DATABASE_URL과 DATABASE_URL_FILE은 동시에 설정할 수 없습니다.");
}
const databaseUrl = databaseEnabled
  ? configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.databaseUrl, { required: true })
    : envOrFile("DATABASE_URL")
  : "";
const discordSaasEnabled = configuredRuntime?.features.discordSaas
  ?? boolEnv("DISCORD_SAAS_ENABLED", false);
const discordClientSecret = discordSaasEnabled
  ? configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.discordClientSecret, { required: true })
    : secretEnvOrFile("DISCORD_CLIENT_SECRET")
  : "";
const discordTokenEncryptionKey = discordSaasEnabled
  ? configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.discordOAuthEncryptionKey, { required: true })
    : secretEnvOrFile("DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY")
  : "";
const discordBotInternalApiEnabled = configuredRuntime?.features.discordBot
  ?? boolEnv("DISCORD_BOT_INTERNAL_API_ENABLED", false);
const discordBotInternalAuthKey = discordBotInternalApiEnabled
  ? configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.discordInternalAuthKey, { required: true })
    : secretEnvOrFile("DISCORD_BOT_INTERNAL_AUTH_KEY")
  : "";
const discordBotManagementEnabled = configuredRuntime?.features.discordBotManagement
  ?? boolEnv("DISCORD_BOT_MANAGEMENT_ENABLED", false);
const twitchEventSubEnabled = configuredRuntime?.features.twitchEventSub
  ?? boolEnv("TWITCH_ENABLE_EVENTSUB", false);
const twitchClientSecret = twitchEventSubEnabled
  ? configuredRuntime
    ? loadFixedSecret(YORO_SECRET_FILES.twitchClientSecret, { required: true })
    : envOrFile("TWITCH_CLIENT_SECRET")
  : configuredRuntime
    ? configuredRuntime.twitch
      ? loadFixedSecret(YORO_SECRET_FILES.twitchClientSecret)
      : ""
    : envOrFile("TWITCH_CLIENT_SECRET");
const twitchTokenEncryptionKey = configuredRuntime
  ? configuredRuntime.twitch
    ? loadFixedSecret(YORO_SECRET_FILES.twitchTokenEncryptionKey, {
        required: nodeEnv === "production"
      })
    : ""
  : envOrFile("TWITCH_TOKEN_ENCRYPTION_KEY");
const riotApiKey = configuredRuntime?.riot
  ? loadFixedSecret(YORO_SECRET_FILES.riotApiKey)
  : configuredRuntime ? "" : envOrFile("RIOT_API_KEY");
const legalFileConfig = configuredRuntime && nodeEnv === "production"
  ? loadYoroLegalConfig()
  : undefined;

export const appConfig = {
  nodeEnv,
  configurationSource: configuredRuntime ? "runtime_file" : "legacy_environment",
  build: {
    version: env("APP_VERSION", imageBuild?.version ?? "0.1.0"),
    gitSha: env("GIT_SHA", imageBuild?.gitSha ?? "unknown"),
    builtAt: env("BUILD_TIME", imageBuild?.builtAt ?? "unknown")
  },
  imageBuild,
  allowInsecureDev: configuredRuntime ? false : boolEnv("ALLOW_INSECURE_DEV", false),
  port: configuredRuntime ? DEFAULTS.port : Number(env("PORT", String(DEFAULTS.port))),
  publicBaseUrl: configuredRuntime?.public.baseUrl ?? env("PUBLIC_BASE_URL", "http://localhost:3000"),
  dashboardBaseUrl: configuredRuntime?.public.dashboardOrigin
    ?? env("DASHBOARD_BASE_URL", "http://localhost:5173"),
  overlayBaseUrl: configuredRuntime?.public.overlayOrigin
    ?? env("OVERLAY_BASE_URL", "http://localhost:5174"),
  twitch: {
    enableEventSub: twitchEventSubEnabled,
    eventSubSubscriptions: configuredRuntime?.twitch?.eventSubSubscriptions
      ? [...configuredRuntime.twitch.eventSubSubscriptions]
      : configuredRuntime
        ? DEFAULT_EVENTSUB_SUBSCRIPTIONS.split(" ")
        : listEnv("TWITCH_EVENTSUB_SUBSCRIPTIONS", DEFAULT_EVENTSUB_SUBSCRIPTIONS),
    clientId: configuredRuntime?.twitch?.clientId ?? env("TWITCH_CLIENT_ID"),
    clientSecret: twitchClientSecret,
    redirectUri: configuredRuntime?.twitch?.redirectUri
      ?? env(
        "TWITCH_REDIRECT_URI",
        `${configuredRuntime?.public.baseUrl ?? env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/twitch/auth/callback`
      ),
    publicRedirectUri: configuredRuntime?.twitch?.publicRedirectUri
      ?? env(
        "TWITCH_PUBLIC_REDIRECT_URI",
        `${configuredRuntime?.public.baseUrl ?? env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/public/twitch/auth/callback`
      ),
    extraScopes: configuredRuntime?.twitch?.extraScopes
      ? [...configuredRuntime.twitch.extraScopes]
      : configuredRuntime ? [] : listEnv("TWITCH_EXTRA_SCOPES"),
    tokenStorePath: configuredRuntime
      ? path.resolve(defaultStateDir, "twitch-token.json")
      : env("TWITCH_TOKEN_STORE_PATH", path.resolve(projectRoot, ".streamops", "twitch-token.json")),
    tokenEncryptionKey: twitchTokenEncryptionKey,
    userAccessToken: configuredRuntime ? "" : env("TWITCH_USER_ACCESS_TOKEN"),
    broadcasterId: configuredRuntime?.twitch?.broadcasterId ?? env("TWITCH_BROADCASTER_ID"),
    botUserId: configuredRuntime?.twitch?.botUserId ?? env("TWITCH_BOT_USER_ID"),
    chatSenderId: configuredRuntime?.twitch?.chatSenderId
      ?? configuredRuntime?.twitch?.botUserId
      ?? env("TWITCH_CHAT_SENDER_ID", env("TWITCH_BOT_USER_ID")),
    chatMode: configuredRuntime?.twitch?.chatMode ?? env("TWITCH_CHAT_MODE", "broadcaster"),
    chatThrottleMs: configuredRuntime
      ? DEFAULTS.twitch.chatThrottleMs
      : intEnv("TWITCH_CHAT_THROTTLE_MS", DEFAULTS.twitch.chatThrottleMs),
    chatCooldownMs: configuredRuntime
      ? DEFAULTS.twitch.chatCooldownMs
      : intEnv("TWITCH_CHAT_COOLDOWN_MS", DEFAULTS.twitch.chatCooldownMs),
    chatMaxQueue: configuredRuntime
      ? DEFAULTS.twitch.chatMaxQueue
      : intEnv("TWITCH_CHAT_MAX_QUEUE", DEFAULTS.twitch.chatMaxQueue),
    chatMaxLength: configuredRuntime
      ? DEFAULTS.twitch.chatMaxLength
      : intEnv("TWITCH_CHAT_MAX_LENGTH", DEFAULTS.twitch.chatMaxLength),
    chatTemplateValueMaxLength: configuredRuntime
      ? DEFAULTS.twitch.chatTemplateValueMaxLength
      : intEnv("TWITCH_CHAT_TEMPLATE_VALUE_MAX_LENGTH", DEFAULTS.twitch.chatTemplateValueMaxLength),
    apiTimeoutMs: configuredRuntime
      ? DEFAULTS.twitch.apiTimeoutMs
      : Math.max(1_000, intEnv("TWITCH_API_TIMEOUT_MS", DEFAULTS.twitch.apiTimeoutMs))
  },
  bridge: {
    sharedSecret: bridgeSharedSecret
  },
  database: {
    enabled: databaseEnabled,
    url: databaseUrl,
    poolMax: configuredRuntime?.database?.poolMax
      ?? (configuredRuntime ? DEFAULTS.database.poolMax : intEnv("DATABASE_POOL_MAX", DEFAULTS.database.poolMax)),
    idleTimeoutMs: configuredRuntime
      ? DEFAULTS.database.idleTimeoutMs
      : intEnv("DATABASE_IDLE_TIMEOUT_MS", DEFAULTS.database.idleTimeoutMs),
    connectionTimeoutMs: configuredRuntime
      ? DEFAULTS.database.connectionTimeoutMs
      : intEnv("DATABASE_CONNECTION_TIMEOUT_MS", DEFAULTS.database.connectionTimeoutMs),
    statementTimeoutMs: configuredRuntime
      ? DEFAULTS.database.statementTimeoutMs
      : intEnv("DATABASE_STATEMENT_TIMEOUT_MS", DEFAULTS.database.statementTimeoutMs),
    migrationMode: configuredRuntime
      ? DEFAULTS.database.migrationMode
      : env("DATABASE_MIGRATION_MODE", DEFAULTS.database.migrationMode),
    sslMode: configuredRuntime?.database?.sslMode
      ?? (configuredRuntime ? DEFAULTS.database.sslMode : env("DATABASE_SSL_MODE", DEFAULTS.database.sslMode))
  },
  discordSaas: {
    enabled: discordSaasEnabled,
    clientId: configuredRuntime?.discord?.clientId ?? env("DISCORD_CLIENT_ID").trim(),
    clientSecret: discordClientSecret,
    redirectUri: configuredRuntime?.discord?.oauthRedirectUri
      ?? env(
        "DISCORD_OAUTH_REDIRECT_URI",
        `${configuredRuntime?.public.baseUrl ?? env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/discord/oauth/callback`
      ).trim(),
    tokenEncryptionKey: discordTokenEncryptionKey,
    tokenEncryptionKeyVersion: 1,
    setupLinkTtlSeconds: configuredRuntime
      ? DEFAULTS.discord.setupLinkTtlSeconds
      : intEnv("DISCORD_SETUP_LINK_TTL_SECONDS", DEFAULTS.discord.setupLinkTtlSeconds),
    oauthSessionTtlSeconds: configuredRuntime
      ? DEFAULTS.discord.oauthSessionTtlSeconds
      : intEnv("DISCORD_OAUTH_SESSION_TTL_SECONDS", DEFAULTS.discord.oauthSessionTtlSeconds),
    apiTimeoutMs: configuredRuntime
      ? DEFAULTS.discord.apiTimeoutMs
      : intEnv("DISCORD_API_TIMEOUT_MS", DEFAULTS.discord.apiTimeoutMs)
  },
  discordBotInternal: {
    enabled: discordBotInternalApiEnabled,
    authKey: discordBotInternalAuthKey,
    applicationId: configuredRuntime?.discord?.applicationId
      ?? env("DISCORD_APPLICATION_ID").trim(),
    prefixCommandsEnabled: configuredRuntime?.discord?.prefixCommandsEnabled
      ?? boolEnv("DISCORD_BOT_PREFIX_COMMANDS_ENABLED", false)
  },
  discordBotManagement: {
    enabled: discordBotManagementEnabled,
    redirectUri: configuredRuntime?.discord?.managementOauthRedirectUri
      ?? env(
        "DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI",
        `${configuredRuntime?.public.baseUrl ?? env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/discord/management/oauth/callback`
      ).trim(),
    oauthTtlSeconds: configuredRuntime
      ? DEFAULTS.discord.managementOauthTtlSeconds
      : intEnv("DISCORD_MANAGEMENT_OAUTH_TTL_SECONDS", DEFAULTS.discord.managementOauthTtlSeconds),
    idleTtlSeconds: configuredRuntime
      ? DEFAULTS.discord.managementIdleTtlSeconds
      : intEnv("DISCORD_MANAGEMENT_IDLE_TTL_SECONDS", DEFAULTS.discord.managementIdleTtlSeconds),
    absoluteTtlSeconds: configuredRuntime
      ? DEFAULTS.discord.managementAbsoluteTtlSeconds
      : intEnv("DISCORD_MANAGEMENT_ABSOLUTE_TTL_SECONDS", DEFAULTS.discord.managementAbsoluteTtlSeconds)
  },
  riot: {
    apiKey: riotApiKey,
    accountRegion: configuredRuntime?.riot?.accountRegion
      ?? (configuredRuntime ? DEFAULTS.riot.accountRegion : env("RIOT_ACCOUNT_REGION", DEFAULTS.riot.accountRegion)),
    lolPlatform: configuredRuntime?.riot?.lolPlatform
      ?? (configuredRuntime ? DEFAULTS.riot.lolPlatform : env("RIOT_LOL_PLATFORM", "jp1")),
    apiTimeoutMs: configuredRuntime
      ? DEFAULTS.riot.apiTimeoutMs
      : Math.max(1_000, intEnv("RIOT_API_TIMEOUT_MS", DEFAULTS.riot.apiTimeoutMs)),
    rateLimit: {
      enabled: configuredRuntime ? true : boolEnv("RIOT_RATE_LIMIT_ENABLED", true),
      perSecond: configuredRuntime
        ? DEFAULTS.riot.rateLimitPerSecond
        : Math.max(1, intEnv("RIOT_RATE_LIMIT_PER_SECOND", DEFAULTS.riot.rateLimitPerSecond)),
      perTwoMinutes: configuredRuntime
        ? DEFAULTS.riot.rateLimitPerTwoMinutes
        : Math.max(1, intEnv("RIOT_RATE_LIMIT_PER_TWO_MINUTES", DEFAULTS.riot.rateLimitPerTwoMinutes)),
      queueMax: configuredRuntime
        ? DEFAULTS.riot.rateLimitQueueMax
        : Math.max(1, intEnv("RIOT_RATE_LIMIT_QUEUE_MAX", DEFAULTS.riot.rateLimitQueueMax))
    }
  },
  translation: {
    chatEnabled: configuredRuntime ? false : boolEnv("CHAT_TRANSLATION_ENABLED", false),
    provider: configuredRuntime ? "mock" : env("CHAT_TRANSLATION_PROVIDER", "mock"),
    maxInputLength: configuredRuntime
      ? DEFAULTS.translation.maxInputLength
      : intEnv("CHAT_TRANSLATION_MAX_INPUT_LENGTH", DEFAULTS.translation.maxInputLength),
    cacheTtlMs: configuredRuntime
      ? DEFAULTS.translation.cacheTtlMs
      : intEnv("CHAT_TRANSLATION_CACHE_TTL_MS", DEFAULTS.translation.cacheTtlMs),
    maxTranslationsPerMinute: configuredRuntime
      ? DEFAULTS.translation.maxTranslationsPerMinute
      : intEnv("CHAT_TRANSLATION_MAX_PER_MINUTE", DEFAULTS.translation.maxTranslationsPerMinute)
  },
  paths: {
    logs: configuredRuntime
      ? runtimePath("/app/logs", path.resolve(projectRoot, "logs"))
      : env("STREAMOPS_LOGS_DIR", path.resolve(projectRoot, "logs")),
    state: defaultStateDir,
    reports: configuredRuntime
      ? runtimePath("/app/reports", path.resolve(projectRoot, "reports"))
      : env("STREAMOPS_REPORTS_DIR", path.resolve(projectRoot, "reports")),
    prompts: path.resolve(projectRoot, "prompts"),
    config: path.resolve(serverRoot, "config"),
    dashboardStatic: configuredRuntime
      ? runtimePath("/app/apps/dashboard/dist", path.resolve(projectRoot, "apps", "dashboard", "dist"))
      : env("DASHBOARD_STATIC_DIR", path.resolve(projectRoot, "apps", "dashboard", "dist")),
    overlayStatic: configuredRuntime
      ? runtimePath("/app/apps/overlay/dist", path.resolve(projectRoot, "apps", "overlay", "dist"))
      : env("OVERLAY_STATIC_DIR", path.resolve(projectRoot, "apps", "overlay", "dist"))
  },
  logging: {
    maxBytes: configuredRuntime
      ? DEFAULTS.logging.maxBytes
      : Math.max(64 * 1_024, intEnv("LOG_MAX_BYTES", DEFAULTS.logging.maxBytes)),
    maxFiles: configuredRuntime
      ? DEFAULTS.logging.maxFiles
      : Math.max(1, Math.min(20, intEnv("LOG_MAX_FILES", DEFAULTS.logging.maxFiles)))
  },
  supportMailbox: {
    enabled: configuredRuntime ? false : boolEnv("SUPPORT_MAILBOX_ENABLED", false),
    address: configuredRuntime ? "support@yoro.gg" : env("SUPPORT_MAILBOX_ADDRESS", "support@yoro.gg").trim().toLowerCase(),
    webhookSecret: configuredRuntime ? "" : envOrFile("SUPPORT_MAILBOX_WEBHOOK_SECRET"),
    encryptionKey: configuredRuntime ? "" : envOrFile("SUPPORT_MAILBOX_ENCRYPTION_KEY"),
    statePath: configuredRuntime
      ? path.resolve(defaultStateDir, "support-mailbox.json.enc")
      : env("SUPPORT_MAILBOX_STATE_PATH", path.resolve(defaultStateDir, "support-mailbox.json.enc")),
    retentionDays: configuredRuntime ? 90 : Math.max(1, intEnv("SUPPORT_MAILBOX_RETENTION_DAYS", 90)),
    maxMessages: configuredRuntime ? 1_000 : Math.max(1, intEnv("SUPPORT_MAILBOX_MAX_MESSAGES", 1_000))
  },
  legal: {
    operatorName: legalFileConfig?.operatorName ?? (configuredRuntime ? "" : env("LEGAL_OPERATOR_NAME").trim()),
    contactAddress: legalFileConfig?.contactAddress ?? (configuredRuntime ? "" : env("LEGAL_CONTACT_ADDRESS").trim()),
    privacyOfficerName: legalFileConfig?.privacyOfficerName
      ?? (configuredRuntime ? "" : env("LEGAL_PRIVACY_OFFICER_NAME").trim()),
    contactEmail: (
      legalFileConfig?.contactEmail
      ?? (configuredRuntime
        ? "support@yoro.gg"
        : env("LEGAL_CONTACT_EMAIL", env("SUPPORT_MAILBOX_ADDRESS", "support@yoro.gg")))
    ).trim().toLowerCase(),
    contactPhone: legalFileConfig?.contactPhone ?? (configuredRuntime ? "" : env("LEGAL_CONTACT_PHONE").trim()),
    effectiveDate: legalFileConfig?.effectiveDate ?? (configuredRuntime ? "" : env("LEGAL_EFFECTIVE_DATE").trim()),
    minimumAge: legalFileConfig?.minimumAge ?? (configuredRuntime ? 14 : Math.max(14, intEnv("LEGAL_MINIMUM_AGE", 14))),
    governingLawKo: legalFileConfig?.governingLawKo ?? (configuredRuntime ? "" : env("LEGAL_GOVERNING_LAW_KO").trim()),
    governingLawJa: legalFileConfig?.governingLawJa ?? (configuredRuntime ? "" : env("LEGAL_GOVERNING_LAW_JA").trim()),
    disputeVenueKo: legalFileConfig?.disputeVenueKo ?? (configuredRuntime ? "" : env("LEGAL_DISPUTE_VENUE_KO").trim()),
    disputeVenueJa: legalFileConfig?.disputeVenueJa ?? (configuredRuntime ? "" : env("LEGAL_DISPUTE_VENUE_JA").trim()),
    processorsKo: legalFileConfig?.processorsKo ?? (configuredRuntime ? "" : env("LEGAL_PROCESSORS_KO").trim()),
    processorsJa: legalFileConfig?.processorsJa ?? (configuredRuntime ? "" : env("LEGAL_PROCESSORS_JA").trim()),
    crossBorderTransferKo: legalFileConfig?.crossBorderTransferKo
      ?? (configuredRuntime ? "" : env("LEGAL_CROSS_BORDER_TRANSFER_KO").trim()),
    crossBorderTransferJa: legalFileConfig?.crossBorderTransferJa
      ?? (configuredRuntime ? "" : env("LEGAL_CROSS_BORDER_TRANSFER_JA").trim())
  },
  security: {
    localNoAuth,
    localNoAuthRequested,
    corsOrigins: configuredRuntime
      ? Array.from(new Set([
          configuredRuntime.public.baseUrl,
          configuredRuntime.public.dashboardOrigin,
          configuredRuntime.public.overlayOrigin
        ].filter((value): value is string => Boolean(value))))
      : listEnv("CORS_ORIGINS", "http://localhost:3000 http://localhost:5173 http://localhost:5174"),
    dashboardAuthToken,
    overlayAccessToken,
    dashboardSessionTtlMs: configuredRuntime
      ? DEFAULTS.dashboardSessionTtlMs
      : intEnv("DASHBOARD_SESSION_TTL_MS", DEFAULTS.dashboardSessionTtlMs),
    trustProxy: configuredRuntime ? nodeEnv === "production" : boolEnv("TRUST_PROXY", false),
    allowLegacyWsQueryAuth: configuredRuntime
      ? false
      : boolEnv("ALLOW_LEGACY_WS_QUERY_AUTH", false)
  }
};

export type RuntimeConfigValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const WEAK_SECRET_PATTERNS = [
  "changeme",
  "change-me",
  "change_me",
  "replace",
  "default",
  "secret",
  "password",
  "streamops",
  "dev-secret",
  "test-secret"
];

function isProduction(): boolean {
  return appConfig.nodeEnv === "production";
}

function isWeakSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return WEAK_SECRET_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function validateSecret(errors: string[], name: string, value: string): void {
  if (!value) {
    errors.push(`${name}이 설정되지 않았습니다.`);
    return;
  }
  if (value.length < 32) errors.push(`${name}은 최소 32자 이상의 랜덤 값이어야 합니다.`);
  if (isWeakSecret(value)) errors.push(`${name}이 예측 가능한 기본값 또는 약한 패턴을 포함합니다.`);
}

function validateHttpsUrl(errors: string[], name: string, value: string): void {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") errors.push(`${name}은 production에서 https:// URL이어야 합니다.`);
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      errors.push(`${name}은 production에서 localhost 주소를 사용할 수 없습니다.`);
    }
    if (parsed.username || parsed.password) errors.push(`${name}에 URL 인증 정보를 포함할 수 없습니다.`);
  } catch {
    errors.push(`${name}이 올바른 URL이 아닙니다.`);
  }
}

function isPrivateDatabaseHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "localhost"
    || normalized === "postgres"
    || normalized.endsWith(".localhost")
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal")
  ) return true;
  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b! >= 16 && b! <= 31)
      || (a === 192 && b === 168);
  }
  if (ipVersion === 6) {
    return normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe8")
      || normalized.startsWith("fe9")
      || normalized.startsWith("fea")
      || normalized.startsWith("feb");
  }
  return false;
}

function validateDatabaseConfig(errors: string[]): void {
  const config = appConfig.database;
  if (!config.enabled) return;
  if (!config.url) {
    errors.push("DATABASE_ENABLED=true이면 DATABASE_URL 또는 DATABASE_URL_FILE이 필요합니다.");
    return;
  }
  if (config.poolMax < 1 || config.poolMax > 10) {
    errors.push("DATABASE_POOL_MAX는 1에서 10 사이여야 합니다.");
  }
  if (config.idleTimeoutMs < 1_000 || config.idleTimeoutMs > 300_000) {
    errors.push("DATABASE_IDLE_TIMEOUT_MS는 1000에서 300000 사이여야 합니다.");
  }
  if (config.connectionTimeoutMs < 500 || config.connectionTimeoutMs > 30_000) {
    errors.push("DATABASE_CONNECTION_TIMEOUT_MS는 500에서 30000 사이여야 합니다.");
  }
  if (config.statementTimeoutMs < 500 || config.statementTimeoutMs > 60_000) {
    errors.push("DATABASE_STATEMENT_TIMEOUT_MS는 500에서 60000 사이여야 합니다.");
  }
  if (config.migrationMode !== "check") {
    errors.push("DATABASE_MIGRATION_MODE는 check만 허용합니다.");
  }
  if (!["disable", "require", "verify-full"].includes(config.sslMode)) {
    errors.push("DATABASE_SSL_MODE는 disable, require, verify-full 중 하나여야 합니다.");
  }
  try {
    const parsed = new URL(config.url);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
      errors.push("Database 연결 설정은 PostgreSQL URL이어야 합니다.");
      return;
    }
    if (!parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
      errors.push("Database 연결 설정에 host와 database 이름이 필요합니다.");
    }
    if (parsed.searchParams.has("sslmode")) {
      errors.push("Database URL의 sslmode query는 허용하지 않으며 DATABASE_SSL_MODE을 사용해야 합니다.");
    }
    if (isProduction()) {
      if (!parsed.username || !parsed.password) {
        errors.push("production Database 연결 설정에는 username과 password가 필요합니다.");
      }
      if (
        parsed.username.toLowerCase() === "postgres"
        || parsed.password.length < 20
        || isWeakSecret(parsed.password)
      ) {
        errors.push("production Database credential은 기본 계정이나 약한 password를 사용할 수 없습니다.");
      }
      if (!isPrivateDatabaseHostname(parsed.hostname) && config.sslMode !== "verify-full") {
        errors.push("공개 Database hostname은 production에서 DATABASE_SSL_MODE=verify-full이 필요합니다.");
      }
    }
  } catch {
    errors.push("Database 연결 설정이 올바른 PostgreSQL URL이 아닙니다.");
  }
}

function validateDiscordSaasConfig(errors: string[]): void {
  const config = appConfig.discordSaas;
  if (!config.enabled) return;
  if (!appConfig.database.enabled) return;
  if (!config.clientId || !/^\d{1,32}$/u.test(config.clientId)) {
    errors.push("DISCORD_CLIENT_ID가 올바르지 않습니다.");
  }
  if (!config.clientSecret || config.clientSecret.length < 24 || isWeakSecret(config.clientSecret)) {
    errors.push("DISCORD_CLIENT_SECRET이 설정되지 않았거나 약한 값입니다.");
  }
  if (!isValidEncryptionKey(config.tokenEncryptionKey)) {
    errors.push("DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY는 강한 32바이트 key여야 합니다.");
  }
  if (
    config.tokenEncryptionKey
    && appConfig.twitch.tokenEncryptionKey
    && secretsEqual(config.tokenEncryptionKey, appConfig.twitch.tokenEncryptionKey)
  ) {
    errors.push("Discord OAuth와 Twitch token encryption key를 재사용할 수 없습니다.");
  }
  if (
    config.tokenEncryptionKey
    && appConfig.security.dashboardAuthToken
    && secretsEqual(config.tokenEncryptionKey, appConfig.security.dashboardAuthToken)
  ) {
    errors.push("Discord OAuth encryption key와 Dashboard 인증 secret을 재사용할 수 없습니다.");
  }
  try {
    const redirect = new URL(config.redirectUri);
    if (
      redirect.username
      || redirect.password
      || redirect.hash
      || redirect.search
      || redirect.pathname !== "/api/discord/oauth/callback"
    ) {
      errors.push("DISCORD_OAUTH_REDIRECT_URI는 query·fragment 없는 정확한 callback URL이어야 합니다.");
    }
    if (isProduction() && redirect.protocol !== "https:") {
      errors.push("DISCORD_OAUTH_REDIRECT_URI는 production에서 HTTPS여야 합니다.");
    }
    if (!isProduction() && !["http:", "https:"].includes(redirect.protocol)) {
      errors.push("DISCORD_OAUTH_REDIRECT_URI protocol이 올바르지 않습니다.");
    }
  } catch {
    errors.push("DISCORD_OAUTH_REDIRECT_URI가 올바른 URL이 아닙니다.");
  }
  if (config.setupLinkTtlSeconds < 60 || config.setupLinkTtlSeconds > 1_800) {
    errors.push("DISCORD_SETUP_LINK_TTL_SECONDS는 60에서 1800 사이여야 합니다.");
  }
  if (config.oauthSessionTtlSeconds < 300 || config.oauthSessionTtlSeconds > 3_600) {
    errors.push("DISCORD_OAUTH_SESSION_TTL_SECONDS는 300에서 3600 사이여야 합니다.");
  }
  if (config.apiTimeoutMs < 1_000 || config.apiTimeoutMs > 30_000) {
    errors.push("DISCORD_API_TIMEOUT_MS는 1000에서 30000 사이여야 합니다.");
  }
}

function validateDiscordBotInternalConfig(errors: string[]): void {
  const config = appConfig.discordBotInternal;
  if (!config.enabled) return;
  if (!appConfig.database.enabled || !appConfig.discordSaas.enabled) {
    errors.push("Discord Bot 내부 API에는 Database와 Discord SaaS 활성화가 필요합니다.");
  }
  if (!/^[0-9]{1,32}$/u.test(config.applicationId)) {
    errors.push("DISCORD_APPLICATION_ID가 올바르지 않습니다.");
  }
  if (config.authKey.length < 32 || isWeakSecret(config.authKey)) {
    errors.push("DISCORD_BOT_INTERNAL_AUTH_KEY는 32자 이상의 강한 별도 secret이어야 합니다.");
  }
  if (
    isProduction()
    && process.env.DISCORD_BOT_INTERNAL_AUTH_KEY
    && !process.env.DISCORD_BOT_INTERNAL_AUTH_KEY_FILE
  ) {
    errors.push("production에서는 DISCORD_BOT_INTERNAL_AUTH_KEY_FILE을 사용해야 합니다.");
  }
  for (const other of [
    appConfig.discordSaas.clientSecret,
    appConfig.discordSaas.tokenEncryptionKey,
    appConfig.twitch.tokenEncryptionKey,
    appConfig.security.dashboardAuthToken,
    appConfig.bridge.sharedSecret
  ]) {
    if (other && config.authKey && secretsEqual(config.authKey, other)) {
      errors.push("Discord Bot 내부 인증 key는 다른 credential과 재사용할 수 없습니다.");
      break;
    }
  }
}

function validateDiscordBotManagementConfig(errors: string[]): void {
  const config = appConfig.discordBotManagement;
  if (!config.enabled) return;
  if (!appConfig.database.enabled || !appConfig.discordSaas.enabled) {
    errors.push("Discord Bot 관리 기능에는 Database와 Discord SaaS 활성화가 필요합니다.");
  }
  try {
    const redirect = new URL(config.redirectUri);
    if (
      redirect.username
      || redirect.password
      || redirect.hash
      || redirect.search
      || redirect.pathname !== "/api/discord/management/oauth/callback"
    ) {
      errors.push("DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI는 정확한 관리 callback URL이어야 합니다.");
    }
    if (isProduction() && redirect.protocol !== "https:") {
      errors.push("DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI는 production에서 HTTPS여야 합니다.");
    }
    if (!isProduction() && !["http:", "https:"].includes(redirect.protocol)) {
      errors.push("DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI protocol이 올바르지 않습니다.");
    }
  } catch {
    errors.push("DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI가 올바른 URL이 아닙니다.");
  }
  if (config.oauthTtlSeconds < 300 || config.oauthTtlSeconds > 1_800) {
    errors.push("DISCORD_MANAGEMENT_OAUTH_TTL_SECONDS는 300에서 1800 사이여야 합니다.");
  }
  if (config.idleTtlSeconds < 900 || config.idleTtlSeconds > 28_800) {
    errors.push("DISCORD_MANAGEMENT_IDLE_TTL_SECONDS는 900에서 28800 사이여야 합니다.");
  }
  if (
    config.absoluteTtlSeconds < config.idleTtlSeconds
    || config.absoluteTtlSeconds > 86_400
  ) {
    errors.push("DISCORD_MANAGEMENT_ABSOLUTE_TTL_SECONDS는 idle 이상 86400 이하여야 합니다.");
  }
}

function validateCorsOrigins(errors: string[]): void {
  if (appConfig.security.corsOrigins.length === 0) {
    errors.push("CORS_ORIGINS가 설정되지 않았습니다.");
    return;
  }
  for (const origin of appConfig.security.corsOrigins) {
    if (origin === "*") {
      errors.push("CORS_ORIGINS는 production에서 wildcard *를 허용하지 않습니다.");
      continue;
    }
    const normalized = normalizedOrigin(origin);
    if (!normalized) {
      errors.push("CORS_ORIGINS에는 정확한 origin만 설정해야 합니다.");
      continue;
    }
    validateHttpsUrl(errors, "CORS_ORIGINS", normalized);
  }
}

function validateBuildMetadata(errors: string[]): void {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(appConfig.build.version)) {
    errors.push("APP_VERSION은 production에서 유효한 semantic version이어야 합니다.");
  } else if (/(?:^|[.-])(?:dev|test)(?:[.+-]|$)/i.test(appConfig.build.version)) {
    errors.push("APP_VERSION은 production에서 development/test identity를 사용할 수 없습니다.");
  }
  if (!/^[a-f0-9]{7,40}$/i.test(appConfig.build.gitSha) || /^0+$/u.test(appConfig.build.gitSha)) {
    errors.push("GIT_SHA는 production에서 실제 Git commit SHA여야 합니다.");
  }
  const builtAt = Date.parse(appConfig.build.builtAt);
  if (!Number.isFinite(builtAt) || !/^\d{4}-\d{2}-\d{2}T/.test(appConfig.build.builtAt)) {
    errors.push("BUILD_TIME은 production에서 유효한 ISO-8601 시각이어야 합니다.");
  }
  if (process.env.IMAGE_RELEASE_METADATA_PATH && !appConfig.imageBuild) {
    errors.push("Docker image release metadata를 읽거나 검증할 수 없습니다.");
  }
  if (
    appConfig.imageBuild
    && (
      appConfig.imageBuild.version !== appConfig.build.version
      || appConfig.imageBuild.gitSha !== appConfig.build.gitSha
      || appConfig.imageBuild.builtAt !== appConfig.build.builtAt
    )
  ) {
    errors.push("runtime release identity와 Docker image metadata가 일치하지 않습니다.");
  }
}

function validateDotenvPermissions(errors: string[]): void {
  for (const dotenvPath of dotenvPaths) {
    if (!fs.existsSync(dotenvPath)) continue;
    try {
      const mode = fs.statSync(dotenvPath).mode & 0o777;
      if ((mode & 0o077) !== 0) {
        errors.push(`${path.basename(dotenvPath)} 파일 권한은 production에서 0600 이하이어야 합니다.`);
      }
    } catch {
      errors.push(`${path.basename(dotenvPath)} 파일 권한을 확인할 수 없습니다.`);
    }
  }
}

function encryptionKeyBytes(value: string): Buffer | undefined {
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return Buffer.from(trimmed, "hex");
  try {
    const decoded = Buffer.from(trimmed, "base64");
    return decoded.byteLength === 32 ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function isValidEncryptionKey(value: string): boolean {
  const key = encryptionKeyBytes(value);
  return Boolean(key && key.byteLength === 32 && new Set(key).size >= 8);
}

function secretMaterial(value: string): Buffer {
  return encryptionKeyBytes(value) ?? Buffer.from(value, "utf8");
}

function secretsEqual(left: string, right: string): boolean {
  const leftMaterial = secretMaterial(left);
  const rightMaterial = secretMaterial(right);
  return leftMaterial.byteLength === rightMaterial.byteLength
    && crypto.timingSafeEqual(leftMaterial, rightMaterial);
}

const LEGAL_PLACEHOLDER_PATTERNS = [
  /^(?:yoro(?:\.gg)?|operator|company)$/i,
  /(?:example|placeholder|todo|tbd|미정|초안|입력 필요|운영자 정보|未定|草案|要入力)/i
];

function validateLegalText(errors: string[], name: string, value: string, minimumLength = 2): void {
  if (!value) {
    errors.push(`${name}이 설정되지 않았습니다.`);
    return;
  }
  if (value.length < minimumLength) errors.push(`${name}이 너무 짧아 공개 고지로 사용할 수 없습니다.`);
  if (LEGAL_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
    errors.push(`${name}에 placeholder 또는 미확정 문구를 사용할 수 없습니다.`);
  }
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function collectLegalConfigErrors(): string[] {
  const errors: string[] = [];
  validateLegalText(errors, "LEGAL_OPERATOR_NAME", appConfig.legal.operatorName);
  validateLegalText(errors, "LEGAL_CONTACT_ADDRESS", appConfig.legal.contactAddress, 8);
  validateLegalText(errors, "LEGAL_PRIVACY_OFFICER_NAME", appConfig.legal.privacyOfficerName);
  validateLegalText(errors, "LEGAL_GOVERNING_LAW_KO", appConfig.legal.governingLawKo, 4);
  validateLegalText(errors, "LEGAL_GOVERNING_LAW_JA", appConfig.legal.governingLawJa, 4);
  validateLegalText(errors, "LEGAL_DISPUTE_VENUE_KO", appConfig.legal.disputeVenueKo, 4);
  validateLegalText(errors, "LEGAL_DISPUTE_VENUE_JA", appConfig.legal.disputeVenueJa, 4);
  validateLegalText(errors, "LEGAL_PROCESSORS_KO", appConfig.legal.processorsKo, 10);
  validateLegalText(errors, "LEGAL_PROCESSORS_JA", appConfig.legal.processorsJa, 10);
  validateLegalText(errors, "LEGAL_CROSS_BORDER_TRANSFER_KO", appConfig.legal.crossBorderTransferKo, 10);
  validateLegalText(errors, "LEGAL_CROSS_BORDER_TRANSFER_JA", appConfig.legal.crossBorderTransferJa, 10);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appConfig.legal.contactEmail)) {
    errors.push("LEGAL_CONTACT_EMAIL이 올바른 이메일 주소가 아닙니다.");
  }
  if (!isValidIsoDate(appConfig.legal.effectiveDate)) {
    errors.push("LEGAL_EFFECTIVE_DATE는 실제 날짜를 YYYY-MM-DD 형식으로 설정해야 합니다.");
  }
  if (appConfig.legal.minimumAge < 14 || appConfig.legal.minimumAge > 19) {
    errors.push("LEGAL_MINIMUM_AGE는 14에서 19 사이여야 합니다.");
  }
  return errors;
}

export function legalRuntimeConfigReady(): boolean {
  return collectLegalConfigErrors().length === 0;
}

export function validateRuntimeConfig(): RuntimeConfigValidationResult {
  const errors: string[] = [];
  validateDatabaseConfig(errors);
  validateDiscordSaasConfig(errors);
  validateDiscordBotInternalConfig(errors);
  validateDiscordBotManagementConfig(errors);
  if (isProduction()) {
    validateBuildMetadata(errors);
    if (appConfig.allowInsecureDev) errors.push("ALLOW_INSECURE_DEV는 production에서 사용할 수 없습니다.");
    if (appConfig.security.localNoAuthRequested) errors.push("STREAMOPS_LOCAL_NO_AUTH는 production에서 사용할 수 없습니다.");
    if (appConfig.security.allowLegacyWsQueryAuth) errors.push("ALLOW_LEGACY_WS_QUERY_AUTH는 production에서 사용할 수 없습니다.");
    validateSecret(errors, "DASHBOARD_AUTH_TOKEN", appConfig.security.dashboardAuthToken);
    validateSecret(errors, "OVERLAY_ACCESS_TOKEN", appConfig.security.overlayAccessToken);
    validateSecret(errors, "BRIDGE_SHARED_SECRET", appConfig.bridge.sharedSecret);
    const secrets: Array<[string, string]> = [
      ["DASHBOARD_AUTH_TOKEN", appConfig.security.dashboardAuthToken],
      ["OVERLAY_ACCESS_TOKEN", appConfig.security.overlayAccessToken],
      ["BRIDGE_SHARED_SECRET", appConfig.bridge.sharedSecret],
      ["TWITCH_TOKEN_ENCRYPTION_KEY", appConfig.twitch.tokenEncryptionKey],
      ...(appConfig.supportMailbox.enabled
        ? [
            ["SUPPORT_MAILBOX_WEBHOOK_SECRET", appConfig.supportMailbox.webhookSecret] as [string, string],
            ["SUPPORT_MAILBOX_ENCRYPTION_KEY", appConfig.supportMailbox.encryptionKey] as [string, string]
          ]
        : []),
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    for (let i = 0; i < secrets.length; i += 1) {
      const [leftName, leftValue] = secrets[i]!;
      for (let j = i + 1; j < secrets.length; j += 1) {
        const [rightName, rightValue] = secrets[j]!;
        if (secretsEqual(leftValue, rightValue)) errors.push(`${leftName}와 ${rightName}는 같은 값을 재사용할 수 없습니다.`);
      }
    }
    validateHttpsUrl(errors, "PUBLIC_BASE_URL", appConfig.publicBaseUrl);
    validateHttpsUrl(errors, "DASHBOARD_BASE_URL", appConfig.dashboardBaseUrl);
    validateHttpsUrl(errors, "OVERLAY_BASE_URL", appConfig.overlayBaseUrl);
    validateHttpsUrl(errors, "TWITCH_REDIRECT_URI", appConfig.twitch.redirectUri);
    validateHttpsUrl(errors, "TWITCH_PUBLIC_REDIRECT_URI", appConfig.twitch.publicRedirectUri);
    validateCorsOrigins(errors);
    validateDotenvPermissions(errors);
    errors.push(...collectLegalConfigErrors());
    if (!isValidEncryptionKey(appConfig.twitch.tokenEncryptionKey)) {
      errors.push("TWITCH_TOKEN_ENCRYPTION_KEY는 32바이트 base64 또는 64자리 hex 값이어야 합니다.");
    }
    if (appConfig.supportMailbox.enabled) {
      validateSecret(errors, "SUPPORT_MAILBOX_WEBHOOK_SECRET", appConfig.supportMailbox.webhookSecret);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appConfig.supportMailbox.address)) {
        errors.push("SUPPORT_MAILBOX_ADDRESS가 올바른 이메일 주소가 아닙니다.");
      }
      if (!isValidEncryptionKey(appConfig.supportMailbox.encryptionKey)) {
        errors.push("SUPPORT_MAILBOX_ENCRYPTION_KEY는 32바이트 base64 또는 64자리 hex 값이어야 합니다.");
      }
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function assertRuntimeConfig(): void {
  const result = validateRuntimeConfig();
  if (result.ok) return;
  throw new Error(`Runtime configuration validation failed:\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
}

export function originAllowed(origin: string): boolean {
  const normalized = normalizedOrigin(origin);
  return Boolean(normalized && appConfig.security.corsOrigins.includes(normalized));
}

import dotenv from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = path.resolve(__dirname, "..");
export const projectRoot = path.resolve(serverRoot, "..", "..");

const explicitDotenvPath = process.env.DOTENV_CONFIG_PATH;
const dotenvPaths = explicitDotenvPath
  ? [path.resolve(explicitDotenvPath)]
  : [path.resolve(projectRoot, ".env"), path.resolve(serverRoot, ".env")];
for (const dotenvPath of dotenvPaths) {
  dotenv.config({ path: dotenvPath });
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

const defaultStateDir = env("STREAMOPS_STATE_DIR", path.resolve(projectRoot, ".streamops"));
const nodeEnv = env("NODE_ENV", "development");
const localNoAuthRequested = boolEnv("STREAMOPS_LOCAL_NO_AUTH", false);
const localNoAuth = localNoAuthRequested && nodeEnv !== "production";
const dashboardAuthToken = localNoAuth ? "" : envOrFile("DASHBOARD_AUTH_TOKEN");
const overlayAccessToken = localNoAuth ? "" : envOrFile("OVERLAY_ACCESS_TOKEN");
const bridgeSharedSecret = envOrFile("BRIDGE_SHARED_SECRET", "dev-secret-change-me");
const imageBuild = imageReleaseMetadata();
const databaseEnabled = boolEnv("DATABASE_ENABLED", false);
if (process.env.DATABASE_URL && process.env.DATABASE_URL_FILE) {
  throw new Error("DATABASE_URL과 DATABASE_URL_FILE은 동시에 설정할 수 없습니다.");
}
const databaseUrl = databaseEnabled ? envOrFile("DATABASE_URL") : "";
const discordSaasEnabled = boolEnv("DISCORD_SAAS_ENABLED", false);
const discordClientSecret = secretEnvOrFile("DISCORD_CLIENT_SECRET");
const discordTokenEncryptionKey = secretEnvOrFile("DISCORD_OAUTH_TOKEN_ENCRYPTION_KEY");
const discordBotInternalApiEnabled = boolEnv("DISCORD_BOT_INTERNAL_API_ENABLED", false);
const discordBotInternalAuthKey = discordBotInternalApiEnabled
  ? secretEnvOrFile("DISCORD_BOT_INTERNAL_AUTH_KEY")
  : "";
const discordBotManagementEnabled = boolEnv("DISCORD_BOT_MANAGEMENT_ENABLED", false);
const agentIngestionEnabled = boolEnv("AGENT_INGESTION_ENABLED", false);

export const appConfig = {
  nodeEnv,
  build: {
    version: env("APP_VERSION", "0.1.0"),
    gitSha: env("GIT_SHA", "unknown"),
    builtAt: env("BUILD_TIME", "unknown")
  },
  imageBuild,
  allowInsecureDev: boolEnv("ALLOW_INSECURE_DEV", false),
  port: Number(env("PORT", "3000")),
  publicBaseUrl: env("PUBLIC_BASE_URL", "http://localhost:3000"),
  dashboardBaseUrl: env("DASHBOARD_BASE_URL", "http://localhost:5173"),
  overlayBaseUrl: env("OVERLAY_BASE_URL", "http://localhost:5174"),
  twitch: {
    enableEventSub: boolEnv("TWITCH_ENABLE_EVENTSUB", false),
    eventSubSubscriptions: listEnv("TWITCH_EVENTSUB_SUBSCRIPTIONS", DEFAULT_EVENTSUB_SUBSCRIPTIONS),
    clientId: env("TWITCH_CLIENT_ID"),
    clientSecret: env("TWITCH_CLIENT_SECRET"),
    redirectUri: env("TWITCH_REDIRECT_URI", `${env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/twitch/auth/callback`),
    publicRedirectUri: env("TWITCH_PUBLIC_REDIRECT_URI", `${env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/public/twitch/auth/callback`),
    extraScopes: listEnv("TWITCH_EXTRA_SCOPES"),
    tokenStorePath: env("TWITCH_TOKEN_STORE_PATH", path.resolve(projectRoot, ".streamops", "twitch-token.json")),
    tokenEncryptionKey: envOrFile("TWITCH_TOKEN_ENCRYPTION_KEY"),
    userAccessToken: env("TWITCH_USER_ACCESS_TOKEN"),
    broadcasterId: env("TWITCH_BROADCASTER_ID"),
    botUserId: env("TWITCH_BOT_USER_ID"),
    chatSenderId: env("TWITCH_CHAT_SENDER_ID", env("TWITCH_BOT_USER_ID")),
    chatMode: env("TWITCH_CHAT_MODE", "broadcaster"),
    chatThrottleMs: intEnv("TWITCH_CHAT_THROTTLE_MS", 1500),
    chatCooldownMs: intEnv("TWITCH_CHAT_COOLDOWN_MS", 10_000),
    chatMaxQueue: intEnv("TWITCH_CHAT_MAX_QUEUE", 20),
    chatMaxLength: intEnv("TWITCH_CHAT_MAX_LENGTH", 500),
    chatTemplateValueMaxLength: intEnv("TWITCH_CHAT_TEMPLATE_VALUE_MAX_LENGTH", 120),
    apiTimeoutMs: Math.max(1000, intEnv("TWITCH_API_TIMEOUT_MS", 10_000))
  },
  bridge: {
    sharedSecret: bridgeSharedSecret
  },
  database: {
    enabled: databaseEnabled,
    url: databaseUrl,
    poolMax: intEnv("DATABASE_POOL_MAX", 10),
    idleTimeoutMs: intEnv("DATABASE_IDLE_TIMEOUT_MS", 30_000),
    connectionTimeoutMs: intEnv("DATABASE_CONNECTION_TIMEOUT_MS", 5_000),
    statementTimeoutMs: intEnv("DATABASE_STATEMENT_TIMEOUT_MS", 10_000),
    migrationMode: env("DATABASE_MIGRATION_MODE", "check"),
    sslMode: env("DATABASE_SSL_MODE", "disable")
  },
  discordSaas: {
    enabled: discordSaasEnabled,
    clientId: env("DISCORD_CLIENT_ID").trim(),
    clientSecret: discordClientSecret,
    redirectUri: env(
      "DISCORD_OAUTH_REDIRECT_URI",
      `${env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/discord/oauth/callback`
    ).trim(),
    tokenEncryptionKey: discordTokenEncryptionKey,
    tokenEncryptionKeyVersion: 1,
    setupLinkTtlSeconds: intEnv("DISCORD_SETUP_LINK_TTL_SECONDS", 600),
    oauthSessionTtlSeconds: intEnv("DISCORD_OAUTH_SESSION_TTL_SECONDS", 900),
    apiTimeoutMs: intEnv("DISCORD_API_TIMEOUT_MS", 10_000)
  },
  discordBotInternal: {
    enabled: discordBotInternalApiEnabled,
    authKey: discordBotInternalAuthKey,
    applicationId: env("DISCORD_APPLICATION_ID").trim()
  },
  discordBotManagement: {
    enabled: discordBotManagementEnabled,
    redirectUri: env(
      "DISCORD_MANAGEMENT_OAUTH_REDIRECT_URI",
      `${env("PUBLIC_BASE_URL", "http://localhost:3000")}/api/discord/management/oauth/callback`
    ).trim(),
    oauthTtlSeconds: intEnv("DISCORD_MANAGEMENT_OAUTH_TTL_SECONDS", 600),
    idleTtlSeconds: intEnv("DISCORD_MANAGEMENT_IDLE_TTL_SECONDS", 28_800),
    absoluteTtlSeconds: intEnv("DISCORD_MANAGEMENT_ABSOLUTE_TTL_SECONDS", 86_400),
    agentTokenTtlSeconds: intEnv("AGENT_BOOTSTRAP_TTL_SECONDS", 600)
  },
  agentIngestion: {
    enabled: agentIngestionEnabled,
    credentialTtlDays: intEnv("AGENT_CREDENTIAL_TTL_DAYS", 90),
    clockSkewSeconds: intEnv("AGENT_CLOCK_SKEW_SECONDS", 300),
    nonceTtlSeconds: intEnv("AGENT_NONCE_TTL_SECONDS", 600),
    maximumBodyBytes: intEnv("AGENT_MAXIMUM_BODY_BYTES", 16 * 1024),
    rateLimitPerMinute: intEnv("AGENT_RATE_LIMIT_PER_MINUTE", 120)
  },
  riot: {
    apiKey: env("RIOT_API_KEY"),
    accountRegion: env("RIOT_ACCOUNT_REGION", "asia"),
    lolPlatform: env("RIOT_LOL_PLATFORM", "jp1"),
    apiTimeoutMs: Math.max(1000, intEnv("RIOT_API_TIMEOUT_MS", 10_000)),
    rateLimit: {
      enabled: boolEnv("RIOT_RATE_LIMIT_ENABLED", true),
      perSecond: Math.max(1, intEnv("RIOT_RATE_LIMIT_PER_SECOND", 20)),
      perTwoMinutes: Math.max(1, intEnv("RIOT_RATE_LIMIT_PER_TWO_MINUTES", 100)),
      queueMax: Math.max(1, intEnv("RIOT_RATE_LIMIT_QUEUE_MAX", 500))
    }
  },
  translation: {
    chatEnabled: boolEnv("CHAT_TRANSLATION_ENABLED", false),
    provider: env("CHAT_TRANSLATION_PROVIDER", "mock"),
    maxInputLength: intEnv("CHAT_TRANSLATION_MAX_INPUT_LENGTH", 180),
    cacheTtlMs: intEnv("CHAT_TRANSLATION_CACHE_TTL_MS", 10 * 60 * 1000),
    maxTranslationsPerMinute: intEnv("CHAT_TRANSLATION_MAX_PER_MINUTE", 30)
  },
  paths: {
    logs: env("STREAMOPS_LOGS_DIR", path.resolve(projectRoot, "logs")),
    state: defaultStateDir,
    reports: env("STREAMOPS_REPORTS_DIR", path.resolve(projectRoot, "reports")),
    prompts: path.resolve(projectRoot, "prompts"),
    config: path.resolve(serverRoot, "config"),
    dashboardStatic: env("DASHBOARD_STATIC_DIR", path.resolve(projectRoot, "apps", "dashboard", "dist")),
    overlayStatic: env("OVERLAY_STATIC_DIR", path.resolve(projectRoot, "apps", "overlay", "dist"))
  },
  logging: {
    maxBytes: Math.max(64 * 1024, intEnv("LOG_MAX_BYTES", 10 * 1024 * 1024)),
    maxFiles: Math.max(1, Math.min(20, intEnv("LOG_MAX_FILES", 5)))
  },
  supportMailbox: {
    enabled: boolEnv("SUPPORT_MAILBOX_ENABLED", false),
    address: env("SUPPORT_MAILBOX_ADDRESS", "support@yoro.gg").trim().toLowerCase(),
    webhookSecret: envOrFile("SUPPORT_MAILBOX_WEBHOOK_SECRET"),
    encryptionKey: envOrFile("SUPPORT_MAILBOX_ENCRYPTION_KEY"),
    statePath: env("SUPPORT_MAILBOX_STATE_PATH", path.resolve(defaultStateDir, "support-mailbox.json.enc")),
    retentionDays: Math.max(1, intEnv("SUPPORT_MAILBOX_RETENTION_DAYS", 90)),
    maxMessages: Math.max(1, intEnv("SUPPORT_MAILBOX_MAX_MESSAGES", 1000))
  },
  legal: {
    operatorName: env("LEGAL_OPERATOR_NAME").trim(),
    contactAddress: env("LEGAL_CONTACT_ADDRESS").trim(),
    privacyOfficerName: env("LEGAL_PRIVACY_OFFICER_NAME").trim(),
    contactEmail: env("LEGAL_CONTACT_EMAIL", env("SUPPORT_MAILBOX_ADDRESS", "support@yoro.gg")).trim().toLowerCase(),
    contactPhone: env("LEGAL_CONTACT_PHONE").trim(),
    effectiveDate: env("LEGAL_EFFECTIVE_DATE").trim(),
    minimumAge: Math.max(14, intEnv("LEGAL_MINIMUM_AGE", 14)),
    governingLawKo: env("LEGAL_GOVERNING_LAW_KO").trim(),
    governingLawJa: env("LEGAL_GOVERNING_LAW_JA").trim(),
    disputeVenueKo: env("LEGAL_DISPUTE_VENUE_KO").trim(),
    disputeVenueJa: env("LEGAL_DISPUTE_VENUE_JA").trim(),
    processorsKo: env("LEGAL_PROCESSORS_KO").trim(),
    processorsJa: env("LEGAL_PROCESSORS_JA").trim(),
    crossBorderTransferKo: env("LEGAL_CROSS_BORDER_TRANSFER_KO").trim(),
    crossBorderTransferJa: env("LEGAL_CROSS_BORDER_TRANSFER_JA").trim()
  },
  security: {
    localNoAuth,
    localNoAuthRequested,
    corsOrigins: listEnv("CORS_ORIGINS", "http://localhost:3000 http://localhost:5173 http://localhost:5174"),
    dashboardAuthToken,
    overlayAccessToken,
    dashboardSessionTtlMs: intEnv("DASHBOARD_SESSION_TTL_MS", 8 * 60 * 60 * 1000),
    trustProxy: boolEnv("TRUST_PROXY", false),
    allowLegacyWsQueryAuth: boolEnv("ALLOW_LEGACY_WS_QUERY_AUTH", false)
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
  if (config.agentTokenTtlSeconds < 60 || config.agentTokenTtlSeconds > 1_800) {
    errors.push("AGENT_BOOTSTRAP_TTL_SECONDS는 60에서 1800 사이여야 합니다.");
  }
}

function validateAgentIngestionConfig(errors: string[]): void {
  const config = appConfig.agentIngestion;
  if (!config.enabled) return;
  if (config.credentialTtlDays < 1 || config.credentialTtlDays > 365) {
    errors.push("AGENT_CREDENTIAL_TTL_DAYS는 1에서 365 사이여야 합니다.");
  }
  if (config.clockSkewSeconds < 30 || config.clockSkewSeconds > 900) {
    errors.push("AGENT_CLOCK_SKEW_SECONDS는 30에서 900 사이여야 합니다.");
  }
  if (config.nonceTtlSeconds < config.clockSkewSeconds || config.nonceTtlSeconds > 3_600) {
    errors.push("AGENT_NONCE_TTL_SECONDS는 clock skew 이상 3600 이하여야 합니다.");
  }
  if (config.maximumBodyBytes < 1_024 || config.maximumBodyBytes > 65_536) {
    errors.push("AGENT_MAXIMUM_BODY_BYTES는 1024에서 65536 사이여야 합니다.");
  }
  if (config.rateLimitPerMinute < 1 || config.rateLimitPerMinute > 600) {
    errors.push("AGENT_RATE_LIMIT_PER_MINUTE는 1에서 600 사이여야 합니다.");
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
  validateAgentIngestionConfig(errors);
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

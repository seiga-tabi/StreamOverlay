import dotenv from "dotenv";
import fs from "node:fs";
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

export const appConfig = {
  nodeEnv,
  build: {
    version: env("APP_VERSION", "0.1.0"),
    gitSha: env("GIT_SHA", "unknown"),
    builtAt: env("BUILD_TIME", "unknown")
  },
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
  localTts: {
    enabled: boolEnv("LOCAL_TTS_ENABLED", false),
    provider: env("LOCAL_TTS_PROVIDER", "voicevox"),
    baseUrl: env("LOCAL_TTS_BASE_URL", "http://127.0.0.1:50021"),
    speaker: intEnv("LOCAL_TTS_SPEAKER", 3),
    broadcastWaitMs: intEnv("LOCAL_TTS_BROADCAST_WAIT_MS", 15_000),
    timeoutMs: intEnv("LOCAL_TTS_TIMEOUT_MS", 15_000),
    maxTextLength: intEnv("LOCAL_TTS_MAX_TEXT_LENGTH", 300),
    cacheDir: env("LOCAL_TTS_CACHE_DIR", path.resolve(defaultStateDir, "tts-cache")),
    publicPath: env("LOCAL_TTS_PUBLIC_PATH", "/tts")
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

function isValidMailboxEncryptionKey(value: string): boolean {
  const trimmed = value.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return true;
  try {
    return Buffer.from(trimmed, "base64").byteLength === 32;
  } catch {
    return false;
  }
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
  if (isProduction()) {
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
      ...(appConfig.supportMailbox.enabled
        ? [
            ["SUPPORT_MAILBOX_WEBHOOK_SECRET", appConfig.supportMailbox.webhookSecret] as [string, string],
            ["SUPPORT_MAILBOX_ENCRYPTION_KEY", appConfig.supportMailbox.encryptionKey] as [string, string]
          ]
        : [])
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    for (let i = 0; i < secrets.length; i += 1) {
      const [leftName, leftValue] = secrets[i]!;
      for (let j = i + 1; j < secrets.length; j += 1) {
        const [rightName, rightValue] = secrets[j]!;
        if (leftValue === rightValue) errors.push(`${leftName}와 ${rightName}는 같은 값을 재사용할 수 없습니다.`);
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
    if (appConfig.supportMailbox.enabled) {
      validateSecret(errors, "SUPPORT_MAILBOX_WEBHOOK_SECRET", appConfig.supportMailbox.webhookSecret);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appConfig.supportMailbox.address)) {
        errors.push("SUPPORT_MAILBOX_ADDRESS가 올바른 이메일 주소가 아닙니다.");
      }
      if (!isValidMailboxEncryptionKey(appConfig.supportMailbox.encryptionKey)) {
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

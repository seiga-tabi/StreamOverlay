const SNOWFLAKE_PATTERN = /^[0-9]{1,32}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,86}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export const DISCORD_INTERNAL_AUTH_VERSION = "v1" as const;

export type DiscordSetupSessionRequest = Readonly<{
  applicationId: string;
  guildId: string;
  interactionId: string;
  userId: string;
}>;

export type DiscordInstallationObservationRequest = Readonly<{
  applicationId: string;
  guildId: string;
}>;

export function isDiscordSnowflake(value: unknown): value is string {
  return typeof value === "string" && SNOWFLAKE_PATTERN.test(value);
}

export function discordInternalCanonicalRequest(input: {
  bodySha256: string;
  method: string;
  nonce: string;
  path: string;
  timestamp: string;
  version?: string;
}): string {
  const version = input.version ?? DISCORD_INTERNAL_AUTH_VERSION;
  if (version !== DISCORD_INTERNAL_AUTH_VERSION) {
    throw new Error("지원하지 않는 Discord 내부 인증 버전입니다.");
  }
  if (!/^[0-9]{10}$/u.test(input.timestamp)) {
    throw new Error("Discord 내부 인증 timestamp가 올바르지 않습니다.");
  }
  if (!NONCE_PATTERN.test(input.nonce)) {
    throw new Error("Discord 내부 인증 nonce가 올바르지 않습니다.");
  }
  if (!SHA256_PATTERN.test(input.bodySha256)) {
    throw new Error("Discord 내부 인증 body hash가 올바르지 않습니다.");
  }
  const method = input.method.toUpperCase();
  if (!["GET", "POST"].includes(method)) {
    throw new Error("Discord 내부 API method가 올바르지 않습니다.");
  }
  if (!input.path.startsWith("/internal/discord/") || input.path.includes("?")) {
    throw new Error("Discord 내부 API path가 올바르지 않습니다.");
  }
  return [
    version,
    input.timestamp,
    input.nonce,
    method,
    input.path,
    input.bodySha256
  ].join("\n");
}

export function parseDiscordSetupSessionRequest(
  value: unknown
): DiscordSetupSessionRequest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "applicationId,guildId,interactionId,userId"
    || !isDiscordSnowflake(record.applicationId)
    || !isDiscordSnowflake(record.guildId)
    || !isDiscordSnowflake(record.interactionId)
    || !isDiscordSnowflake(record.userId)
  ) return undefined;
  return Object.freeze({
    applicationId: record.applicationId,
    guildId: record.guildId,
    interactionId: record.interactionId,
    userId: record.userId
  });
}

export function parseDiscordInstallationObservationRequest(
  value: unknown
): DiscordInstallationObservationRequest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(",") !== "applicationId,guildId"
    || !isDiscordSnowflake(record.applicationId)
    || !isDiscordSnowflake(record.guildId)
  ) return undefined;
  return Object.freeze({
    applicationId: record.applicationId,
    guildId: record.guildId
  });
}

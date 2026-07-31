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

export const DISCORD_GAME_SERVER_STATUS_STATES = [
  "not_configured",
  "checking",
  "online",
  "degraded",
  "offline",
  "stale",
  "auth_failed",
  "blocked_by_policy",
  "unavailable"
] as const;

export type DiscordGameServerStatusState =
  (typeof DISCORD_GAME_SERVER_STATUS_STATES)[number];

export const DISCORD_GAME_SERVER_STATUS_REASONS = [
  "status_not_configured",
  "status_feature_disabled",
  "credentials_unavailable",
  "auth_failed",
  "network_policy_blocked",
  "upstream_unavailable",
  "stale_data",
  "partial_data"
] as const;

export type DiscordGameServerStatusReason =
  (typeof DISCORD_GAME_SERVER_STATUS_REASONS)[number];

export type DiscordGameServerStatusRequest = Readonly<{
  applicationId: string;
  guildId: string;
}>;

export type DiscordGameServerStatusResponse = Readonly<{
  connected: boolean;
  server?: Readonly<{
    displayName: string;
    status: DiscordGameServerStatusState;
    reason?: DiscordGameServerStatusReason;
    source: "agent" | "rest";
    players?: Readonly<{
      current: number;
      max: number;
    }>;
    version?: string;
    latencyMs?: number;
    observedAt?: string;
  }>;
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

export const parseDiscordGameServerStatusRequest =
  parseDiscordInstallationObservationRequest;

export function parseDiscordGameServerStatusResponse(
  value: unknown
): DiscordGameServerStatusResponse | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => ["connected", "server"].includes(key))) {
    return undefined;
  }
  if (typeof record.connected !== "boolean") return undefined;
  if (record.server === undefined) {
    return Object.keys(record).length === 1
      ? Object.freeze({ connected: record.connected })
      : undefined;
  }
  if (!record.connected || !record.server || typeof record.server !== "object"
    || Array.isArray(record.server)) return undefined;
  const server = record.server as Record<string, unknown>;
  const allowedServerKeys = [
    "displayName",
    "status",
    "reason",
    "source",
    "players",
    "version",
    "latencyMs",
    "observedAt"
  ];
  if (!Object.keys(server).every((key) => allowedServerKeys.includes(key))) return undefined;
  if (
    typeof server.displayName !== "string"
    || server.displayName.length < 1
    || server.displayName.length > 120
    || /[\u0000-\u001f\u007f]/u.test(server.displayName)
    || !DISCORD_GAME_SERVER_STATUS_STATES.includes(
      server.status as DiscordGameServerStatusState
    )
    || (
      server.reason !== undefined
      && !DISCORD_GAME_SERVER_STATUS_REASONS.includes(
        server.reason as DiscordGameServerStatusReason
      )
    )
    || (server.source !== "agent" && server.source !== "rest")
  ) return undefined;
  let players: { current: number; max: number } | undefined;
  if (server.players !== undefined) {
    if (!server.players || typeof server.players !== "object" || Array.isArray(server.players)) {
      return undefined;
    }
    const candidate = server.players as Record<string, unknown>;
    if (
      Object.keys(candidate).sort().join(",") !== "current,max"
      || !Number.isSafeInteger(candidate.current)
      || !Number.isSafeInteger(candidate.max)
      || (candidate.current as number) < 0
      || (candidate.max as number) < (candidate.current as number)
      || (candidate.max as number) > 1_000_000
    ) return undefined;
    players = {
      current: candidate.current as number,
      max: candidate.max as number
    };
  }
  if (
    server.version !== undefined
    && (typeof server.version !== "string"
      || server.version.length < 1
      || server.version.length > 80
      || /[\u0000-\u001f\u007f]/u.test(server.version))
  ) return undefined;
  if (
    server.latencyMs !== undefined
    && (!Number.isSafeInteger(server.latencyMs)
      || (server.latencyMs as number) < 0
      || (server.latencyMs as number) > 300_000)
  ) return undefined;
  if (
    server.observedAt !== undefined
    && (typeof server.observedAt !== "string"
      || !Number.isFinite(Date.parse(server.observedAt)))
  ) return undefined;
  return Object.freeze({
    connected: true,
    server: Object.freeze({
      displayName: server.displayName,
      status: server.status as DiscordGameServerStatusState,
      ...(server.reason === undefined
        ? {}
        : { reason: server.reason as DiscordGameServerStatusReason }),
      source: server.source,
      ...(players ? { players: Object.freeze(players) } : {}),
      ...(server.version === undefined ? {} : { version: server.version }),
      ...(server.latencyMs === undefined ? {} : { latencyMs: server.latencyMs as number }),
      ...(server.observedAt === undefined ? {} : { observedAt: server.observedAt })
    })
  });
}

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
    source: "rest";
    players?: Readonly<{
      current: number;
      max: number;
    }>;
    version?: string;
    latencyMs?: number;
    observedAt?: string;
  }>;
}>;

export type DiscordPalworldPlayerLookupRequest = Readonly<{
  applicationId: string;
  guildId: string;
  nickname?: string;
}>;

export const DISCORD_PALWORLD_PLAYER_LOOKUP_REASONS = [
  "server_not_configured",
  "rest_not_configured",
  "rest_auth_failed",
  "rest_timeout",
  "rest_invalid_response",
  "rest_unreachable",
  "upstream_unavailable"
] as const;

export type DiscordPalworldPlayerLookupReason =
  (typeof DISCORD_PALWORLD_PLAYER_LOOKUP_REASONS)[number];

export type DiscordPalworldPlayerProfile = Readonly<{
  nickname: string;
  level: number;
  buildingCount?: number;
}>;

export type DiscordPalworldPlayerLookupResponse = Readonly<{
  connected: boolean;
  serverConfigured: boolean;
  displayName?: string;
  reason?: DiscordPalworldPlayerLookupReason;
  result?:
    | Readonly<{
        kind: "list";
        nicknames: readonly string[];
        total: number;
      }>
    | Readonly<{
        kind: "profile";
        player: DiscordPalworldPlayerProfile;
      }>
    | Readonly<{
        kind: "not_found";
        suggestions: readonly string[];
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

export function parseDiscordPalworldPlayerLookupRequest(
  value: unknown
): DiscordPalworldPlayerLookupRequest | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !["applicationId", "guildId", "nickname"].includes(key)
    )
    || !Object.hasOwn(record, "applicationId")
    || !Object.hasOwn(record, "guildId")
    || !isDiscordSnowflake(record.applicationId)
    || !isDiscordSnowflake(record.guildId)
    || (
      record.nickname !== undefined
      && (
        typeof record.nickname !== "string"
        || record.nickname.length < 1
        || record.nickname.length > 80
        || record.nickname !== record.nickname.trim()
        || /[\u0000-\u001f\u007f]/u.test(record.nickname)
      )
    )
  ) return undefined;
  return Object.freeze({
    applicationId: record.applicationId,
    guildId: record.guildId,
    ...(record.nickname === undefined ? {} : { nickname: record.nickname })
  });
}

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
    || server.source !== "rest"
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

function parseSafePlayerNickname(value: unknown): string | undefined {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 80
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : undefined;
}

function parsePlayerProfile(
  value: unknown
): DiscordPalworldPlayerProfile | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const nickname = parseSafePlayerNickname(record.nickname);
  if (
    Object.keys(record).some(
      (key) => !["buildingCount", "level", "nickname"].includes(key)
    )
    || !Object.hasOwn(record, "level")
    || !Object.hasOwn(record, "nickname")
    || !nickname
    || !Number.isSafeInteger(record.level)
    || (record.level as number) < 0
    || (record.level as number) > 1_000
    || (
      record.buildingCount !== undefined
      && (
        !Number.isSafeInteger(record.buildingCount)
        || (record.buildingCount as number) < 0
        || (record.buildingCount as number) > 100_000_000
      )
    )
  ) return undefined;
  return Object.freeze({
    nickname,
    level: record.level as number,
    ...(record.buildingCount === undefined
      ? {}
      : { buildingCount: record.buildingCount as number })
  });
}

function parseNicknameList(
  value: unknown,
  maxItems: number
): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > maxItems) return undefined;
  const result: string[] = [];
  for (const entry of value) {
    const nickname = parseSafePlayerNickname(entry);
    if (!nickname) return undefined;
    result.push(nickname);
  }
  return Object.freeze(result);
}

export function parseDiscordPalworldPlayerLookupResponse(
  value: unknown
): DiscordPalworldPlayerLookupResponse | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => ![
        "connected",
        "serverConfigured",
        "displayName",
        "reason",
        "result"
      ].includes(key)
    )
    || typeof record.connected !== "boolean"
    || typeof record.serverConfigured !== "boolean"
    || (
      record.displayName !== undefined
      && (
        typeof record.displayName !== "string"
        || record.displayName.length < 1
        || record.displayName.length > 120
        || /[\u0000-\u001f\u007f]/u.test(record.displayName)
      )
    )
    || (
      record.reason !== undefined
      && !DISCORD_PALWORLD_PLAYER_LOOKUP_REASONS.includes(
        record.reason as DiscordPalworldPlayerLookupReason
      )
    )
  ) return undefined;
  if (!record.connected && (record.serverConfigured || record.displayName !== undefined)) {
    return undefined;
  }
  if (record.serverConfigured && record.displayName === undefined) return undefined;
  if (record.reason !== undefined && record.result !== undefined) return undefined;
  if (!record.serverConfigured && record.result !== undefined) return undefined;

  let result: DiscordPalworldPlayerLookupResponse["result"];
  if (record.result !== undefined) {
    if (!record.result || typeof record.result !== "object" || Array.isArray(record.result)) {
      return undefined;
    }
    const candidate = record.result as Record<string, unknown>;
    if (candidate.kind === "list") {
      const nicknames = parseNicknameList(candidate.nicknames, 64);
      if (
        Object.keys(candidate).sort().join(",") !== "kind,nicknames,total"
        || !nicknames
        || !Number.isSafeInteger(candidate.total)
        || (candidate.total as number) < nicknames.length
        || (candidate.total as number) > 1_000_000
      ) return undefined;
      result = Object.freeze({
        kind: "list",
        nicknames,
        total: candidate.total as number
      });
    } else if (candidate.kind === "profile") {
      const player = parsePlayerProfile(candidate.player);
      if (
        Object.keys(candidate).sort().join(",") !== "kind,player"
        || !player
      ) return undefined;
      result = Object.freeze({ kind: "profile", player });
    } else if (candidate.kind === "not_found") {
      const suggestions = parseNicknameList(candidate.suggestions, 5);
      if (
        Object.keys(candidate).sort().join(",") !== "kind,suggestions"
        || !suggestions
      ) return undefined;
      result = Object.freeze({ kind: "not_found", suggestions });
    } else {
      return undefined;
    }
  }
  return Object.freeze({
    connected: record.connected,
    serverConfigured: record.serverConfigured,
    ...(record.displayName === undefined
      ? {}
      : { displayName: record.displayName as string }),
    ...(record.reason === undefined
      ? {}
      : { reason: record.reason as DiscordPalworldPlayerLookupReason }),
    ...(result ? { result } : {})
  });
}

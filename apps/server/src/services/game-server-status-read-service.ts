import {
  PALWORLD_SERVER_ERROR_CODES,
  type DiscordGameServerStatusResponse,
  type DiscordGameServerStatusReason,
  type DiscordGameServerStatusState,
  type DiscordPalworldPlayerLookupReason,
  type DiscordPalworldPlayerLookupRequest,
  type DiscordPalworldPlayerLookupResponse,
  type PalworldOnlinePlayer,
  type PalworldServerAvailabilityErrorCode,
  type PalworldServerDashboardResponse,
  type PalworldServerErrorCode,
  type PalworldServerStatus
} from "@streamops/shared";
import type {
  GameServerStatusReadRecord,
  GameServerStatusReadRepositoryContract
} from "../database/repositories/game-server-status-read-repository.js";

type RestStatusReader = Readonly<{
  getDashboardResponse(ownerId: string): PalworldServerDashboardResponse;
  listOnlinePlayers(
    ownerId: string
  ): Promise<readonly PalworldOnlinePlayer[]>;
}>;

type StatusReadFailure = Readonly<{
  operation: "players";
  errorCode: PalworldServerErrorCode | "unknown";
  schemaIssue?: string;
}>;

function safeErrorCode(error: unknown): PalworldServerErrorCode | "unknown" {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "string"
    && (PALWORLD_SERVER_ERROR_CODES as readonly string[]).includes(code)
    ? code as PalworldServerErrorCode
    : "unknown";
}

function safeSchemaIssue(error: unknown): string | undefined {
  const issue = (error as { schemaIssue?: unknown } | undefined)?.schemaIssue;
  return typeof issue === "string" && /^[A-Za-z0-9_.\[\]]{1,160}$/u.test(issue)
    ? issue
    : undefined;
}

function playerLookupReason(
  errorCode: PalworldServerErrorCode | "unknown"
): DiscordPalworldPlayerLookupReason {
  if (errorCode === "not_configured") return "rest_not_configured";
  if (errorCode === "auth_failed" || errorCode === "password_required") {
    return "rest_auth_failed";
  }
  if (errorCode === "request_timeout") return "rest_timeout";
  if ([
    "invalid_content_type",
    "response_too_large",
    "invalid_json",
    "invalid_schema"
  ].includes(errorCode)) return "rest_invalid_response";
  if ([
    "dns_failed",
    "connection_failed",
    "tls_failed"
  ].includes(errorCode)) return "rest_unreachable";
  return "upstream_unavailable";
}

function restState(state: PalworldServerStatus["state"]): DiscordGameServerStatusState {
  switch (state) {
    case "not_configured":
    case "checking":
    case "online":
    case "degraded":
    case "stale":
    case "auth_failed":
    case "blocked_by_policy":
      return state;
    case "unreachable":
      return "offline";
    case "tls_failed":
    case "invalid_response":
      return "unavailable";
  }
}

const CREDENTIAL_ERROR_CODES = new Set<PalworldServerErrorCode>([
  "config_missing",
  "config_invalid",
  "key_missing",
  "key_invalid",
  "key_permission_denied",
  "key_mismatch",
  "state_damaged"
]);

const NETWORK_POLICY_ERROR_CODES = new Set<PalworldServerErrorCode>([
  "policy_missing",
  "origin_not_allowed",
  "address_blocked"
]);

function restReason(
  status: PalworldServerStatus
): DiscordGameServerStatusReason | undefined {
  if (status.errorCode === "disabled") return "status_feature_disabled";
  if (status.errorCode === "not_configured" || status.state === "not_configured") {
    return "status_not_configured";
  }
  if (status.errorCode && CREDENTIAL_ERROR_CODES.has(status.errorCode)) {
    return "credentials_unavailable";
  }
  if (status.errorCode === "auth_failed" || status.state === "auth_failed") {
    return "auth_failed";
  }
  if (
    (status.errorCode && NETWORK_POLICY_ERROR_CODES.has(status.errorCode))
    || status.state === "blocked_by_policy"
  ) return "network_policy_blocked";
  if (status.state === "stale") return "stale_data";
  if (status.state === "degraded") return "partial_data";
  if (status.state === "unreachable"
    || status.state === "tls_failed"
    || status.state === "invalid_response") {
    return "upstream_unavailable";
  }
  return undefined;
}

function unavailableReason(
  errorCode: PalworldServerAvailabilityErrorCode | undefined
): DiscordGameServerStatusReason {
  if (errorCode === "disabled") return "status_feature_disabled";
  if (errorCode === "policy_missing") return "network_policy_blocked";
  if (errorCode && CREDENTIAL_ERROR_CODES.has(errorCode)) {
    return "credentials_unavailable";
  }
  return "upstream_unavailable";
}

function restServer(
  server: GameServerStatusReadRecord,
  response: PalworldServerDashboardResponse
): NonNullable<DiscordGameServerStatusResponse["server"]> {
  const status = restState(response.status.state);
  const reason = restReason(response.status);
  const exposeCachedDetails = ["online", "degraded", "stale"].includes(status);
  const metrics = exposeCachedDetails ? response.status.metrics : undefined;
  return Object.freeze({
    displayName: server.displayName,
    status,
    ...(reason ? { reason } : {}),
    source: "rest" as const,
    ...(metrics
      ? {
          players: Object.freeze({
            current: metrics.currentPlayers,
            max: metrics.maxPlayers
          })
        }
      : {}),
    ...(exposeCachedDetails && response.status.info?.version
      ? { version: response.status.info.version.slice(0, 80) }
      : {}),
    ...(exposeCachedDetails && response.status.latencyMs !== undefined
      ? { latencyMs: Math.round(response.status.latencyMs) }
      : {}),
    ...(response.status.checkedAt ? { observedAt: response.status.checkedAt } : {})
  });
}

export class GameServerStatusReadService {
  constructor(
    private readonly repository: GameServerStatusReadRepositoryContract,
    private readonly restStatusReader?: RestStatusReader,
    private readonly restUnavailableCode?: PalworldServerAvailabilityErrorCode,
    private readonly onFailure?: (failure: StatusReadFailure) => void
  ) {}

  async read(input: {
    applicationId: string;
    guildId: string;
  }): Promise<DiscordGameServerStatusResponse> {
    const context = await this.repository.resolveGuild(
      input.applicationId,
      input.guildId
    );
    if (!context) return Object.freeze({ connected: false });
    const server = await this.repository.findPalworldServer(context);
    if (!server) return Object.freeze({ connected: true });
    if (!this.restStatusReader) {
      return Object.freeze({
        connected: true,
        server: Object.freeze({
          displayName: server.displayName,
          status: "unavailable",
          reason: unavailableReason(this.restUnavailableCode),
          source: "rest"
        })
      });
    }
    const ownerId = `organization:${context.organizationId}:server:${server.id}`;
    return Object.freeze({
      connected: true,
      server: restServer(
        server,
        this.restStatusReader.getDashboardResponse(ownerId)
      )
    });
  }

  async readPlayers(
    input: DiscordPalworldPlayerLookupRequest
  ): Promise<DiscordPalworldPlayerLookupResponse> {
    const context = await this.repository.resolveGuild(
      input.applicationId,
      input.guildId
    );
    if (!context) {
      return Object.freeze({
        connected: false,
        serverConfigured: false
      });
    }
    const server = await this.repository.findPalworldServer(context);
    if (!server) {
      return Object.freeze({
        connected: true,
        serverConfigured: false,
        reason: "server_not_configured"
      });
    }
    if (!this.restStatusReader) {
      return Object.freeze({
        connected: true,
        serverConfigured: true,
        displayName: server.displayName,
        reason: "rest_not_configured"
      });
    }
    const ownerId = `organization:${context.organizationId}:server:${server.id}`;
    let players: readonly PalworldOnlinePlayer[];
    try {
      players = await this.restStatusReader.listOnlinePlayers(ownerId);
    } catch (error) {
      const errorCode = safeErrorCode(error);
      const schemaIssue = safeSchemaIssue(error);
      this.onFailure?.({
        operation: "players",
        errorCode,
        ...(schemaIssue === undefined ? {} : { schemaIssue })
      });
      return Object.freeze({
        connected: true,
        serverConfigured: true,
        displayName: server.displayName,
        reason: playerLookupReason(errorCode)
      });
    }
    const sorted = [...players].sort((left, right) =>
      left.nickname.localeCompare(right.nickname, "ko")
    );
    if (!input.nickname) {
      return Object.freeze({
        connected: true,
        serverConfigured: true,
        displayName: server.displayName,
        result: Object.freeze({
          kind: "list",
          nicknames: Object.freeze(
            sorted.slice(0, 64).map((player) => player.nickname)
          ),
          total: sorted.length
        })
      });
    }
    const query = input.nickname.normalize("NFKC").toLocaleLowerCase("ko");
    const exact = sorted.find(
      (player) =>
        player.nickname.normalize("NFKC").toLocaleLowerCase("ko") === query
    );
    if (exact) {
      return Object.freeze({
        connected: true,
        serverConfigured: true,
        displayName: server.displayName,
        result: Object.freeze({
          kind: "profile",
          player: Object.freeze({
            nickname: exact.nickname,
            level: exact.level,
            ...(exact.buildingCount === undefined
              ? {}
              : { buildingCount: exact.buildingCount })
          })
        })
      });
    }
    const suggestions = sorted
      .map((player) => ({
        nickname: player.nickname,
        normalized: player.nickname.normalize("NFKC").toLocaleLowerCase("ko")
      }))
      .filter((player) => player.normalized.includes(query))
      .sort((left, right) => {
        const leftPrefix = left.normalized.startsWith(query) ? 0 : 1;
        const rightPrefix = right.normalized.startsWith(query) ? 0 : 1;
        return leftPrefix - rightPrefix
          || left.nickname.localeCompare(right.nickname, "ko");
      })
      .slice(0, 5)
      .map((player) => player.nickname);
    return Object.freeze({
      connected: true,
      serverConfigured: true,
      displayName: server.displayName,
      result: Object.freeze({
        kind: "not_found",
        suggestions: Object.freeze(suggestions)
      })
    });
  }
}

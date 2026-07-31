import type {
  DiscordGameServerStatusResponse,
  DiscordGameServerStatusReason,
  DiscordGameServerStatusState,
  PalworldServerAvailabilityErrorCode,
  PalworldServerDashboardResponse,
  PalworldServerErrorCode,
  PalworldServerStatus
} from "@streamops/shared";
import type {
  GameServerStatusReadRecord,
  GameServerStatusReadRepositoryContract
} from "../database/repositories/game-server-status-read-repository.js";

type RestStatusReader = Readonly<{
  getDashboardResponse(ownerId: string): PalworldServerDashboardResponse;
}>;

const DEFAULT_AGENT_STALE_AFTER_MS = 15 * 60 * 1_000;

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
      ? { latencyMs: response.status.latencyMs }
      : {}),
    ...(response.status.checkedAt ? { observedAt: response.status.checkedAt } : {})
  });
}

function agentServer(
  server: GameServerStatusReadRecord,
  now: number,
  staleAfterMs: number
): NonNullable<DiscordGameServerStatusResponse["server"]> {
  const current = server.current;
  let status: DiscordGameServerStatusState;
  let reason: DiscordGameServerStatusReason | undefined;
  if (server.connectionStatus === "not_configured") {
    status = "not_configured";
    reason = "status_not_configured";
  } else if (server.connectionStatus === "unavailable"
    || server.connectionStatus === "revoked") {
    status = "unavailable";
    reason = "upstream_unavailable";
  } else if (!current) {
    status = "checking";
  } else {
    const observedAt = Date.parse(current.observedAt);
    status = Number.isFinite(observedAt) && now - observedAt > staleAfterMs
      ? "stale"
      : current.online
        ? "online"
        : "offline";
    if (status === "stale") reason = "stale_data";
  }
  return Object.freeze({
    displayName: server.displayName,
    status,
    ...(reason ? { reason } : {}),
    source: "agent" as const,
    ...(current
      ? {
          players: Object.freeze({
            current: current.players,
            max: current.maxPlayers
          }),
          ...(current.version ? { version: current.version } : {}),
          ...(current.latencyMs === undefined ? {} : { latencyMs: current.latencyMs }),
          observedAt: current.observedAt
        }
      : {})
  });
}

export class GameServerStatusReadService {
  constructor(
    private readonly repository: GameServerStatusReadRepositoryContract,
    private readonly restStatusReader?: RestStatusReader,
    private readonly now: () => number = Date.now,
    private readonly agentStaleAfterMs = DEFAULT_AGENT_STALE_AFTER_MS,
    private readonly restUnavailableCode?: PalworldServerAvailabilityErrorCode
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
    if (server.connectionType === "agent") {
      return Object.freeze({
        connected: true,
        server: agentServer(
          server,
          this.now(),
          Math.max(60_000, this.agentStaleAfterMs)
        )
      });
    }
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
}

import type {
  DiscordGameServerStatusResponse,
  DiscordGameServerStatusState,
  PalworldServerDashboardResponse,
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

function restServer(
  server: GameServerStatusReadRecord,
  response: PalworldServerDashboardResponse
): NonNullable<DiscordGameServerStatusResponse["server"]> {
  const status = restState(response.status.state);
  const exposeCachedDetails = ["online", "degraded", "stale"].includes(status);
  const metrics = exposeCachedDetails ? response.status.metrics : undefined;
  return Object.freeze({
    displayName: server.displayName,
    status,
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
  if (server.connectionStatus === "not_configured") {
    status = "not_configured";
  } else if (server.connectionStatus === "unavailable"
    || server.connectionStatus === "revoked") {
    status = "unavailable";
  } else if (!current) {
    status = "checking";
  } else {
    const observedAt = Date.parse(current.observedAt);
    status = Number.isFinite(observedAt) && now - observedAt > staleAfterMs
      ? "stale"
      : current.online
        ? "online"
        : "offline";
  }
  return Object.freeze({
    displayName: server.displayName,
    status,
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
    private readonly agentStaleAfterMs = DEFAULT_AGENT_STALE_AFTER_MS
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

import type { TenantContext } from "../tenant-context.js";
import { createTenantContext } from "../tenant-context.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

type StatusServerRow = {
  id: string;
  display_name: string;
  connection_type: "agent" | "rest";
  connection_status: "not_configured" | "pending" | "ready" | "unavailable" | "revoked";
  online: boolean | null;
  players: number | null;
  max_players: number | null;
  game_version: string | null;
  latency_ms: number | null;
  observed_at: Date | null;
};

export type GameServerStatusReadRecord = Readonly<{
  id: string;
  displayName: string;
  connectionType: "agent" | "rest";
  connectionStatus: StatusServerRow["connection_status"];
  current?: Readonly<{
    online: boolean;
    players: number;
    maxPlayers: number;
    version?: string;
    latencyMs?: number;
    observedAt: string;
  }>;
}>;

export type GameServerStatusReadRepositoryContract = Readonly<{
  resolveGuild(
    applicationId: string,
    guildId: string
  ): Promise<TenantContext | undefined>;
  findPalworldServer(
    context: TenantContext
  ): Promise<GameServerStatusReadRecord | undefined>;
}>;

export class GameServerStatusReadRepository
implements GameServerStatusReadRepositoryContract {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async resolveGuild(
    applicationId: string,
    guildId: string
  ): Promise<TenantContext | undefined> {
    const result = await repositoryQuery<{ organization_id: string }>(
      this.queryable,
      `SELECT guild.organization_id
       FROM discord_guilds guild
       JOIN discord_installations installation
         ON installation.organization_id = guild.organization_id
        AND installation.discord_guild_id = guild.discord_guild_id
       WHERE guild.discord_guild_id = $1
         AND guild.status = 'active'
         AND installation.application_id = $2
         AND installation.status = 'active'
       LIMIT 1`,
      [guildId, applicationId]
    );
    const row = result.rows[0];
    return row
      ? createTenantContext({ organizationId: row.organization_id })
      : undefined;
  }

  async findPalworldServer(
    context: TenantContext
  ): Promise<GameServerStatusReadRecord | undefined> {
    const result = await repositoryQuery<StatusServerRow>(
      this.queryable,
      `SELECT server.id, server.display_name, server.connection_type,
         server.connection_status, current.online, current.players,
         current.max_players, current.game_version, current.latency_ms,
         current.observed_at
       FROM game_servers server
       LEFT JOIN server_current_status current
         ON current.organization_id = server.organization_id
        AND current.game_server_id = server.id
       WHERE server.organization_id = $1
         AND server.game_type = 'palworld'
         AND server.is_enabled = TRUE
         AND server.deleted_at IS NULL
       LIMIT 1`,
      [context.organizationId]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const hasCurrent = row.online !== null
      && row.players !== null
      && row.max_players !== null
      && row.observed_at !== null;
    return Object.freeze({
      id: row.id,
      displayName: row.display_name,
      connectionType: row.connection_type,
      connectionStatus: row.connection_status,
      ...(hasCurrent
        ? {
            current: Object.freeze({
              online: row.online as boolean,
              players: row.players as number,
              maxPlayers: row.max_players as number,
              ...(row.game_version ? { version: row.game_version } : {}),
              ...(row.latency_ms === null ? {} : { latencyMs: row.latency_ms }),
              observedAt: (row.observed_at as Date).toISOString()
            })
          }
        : {})
    });
  }
}

import type { TenantContext } from "../tenant-context.js";
import { createTenantContext } from "../tenant-context.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

type StatusServerRow = {
  id: string;
  display_name: string;
  connection_status: "not_configured" | "pending" | "ready" | "unavailable" | "revoked";
};

export type GameServerStatusReadRecord = Readonly<{
  id: string;
  displayName: string;
  connectionStatus: StatusServerRow["connection_status"];
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
       JOIN discord_bot_installation_observations observation
         ON observation.discord_guild_id = installation.discord_guild_id
        AND observation.application_id = installation.application_id
       WHERE guild.discord_guild_id = $1
         AND guild.status = 'active'
         AND installation.application_id = $2
         AND installation.status = 'active'
         AND observation.status = 'observed'
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
      `SELECT server.id, server.display_name, server.connection_status
       FROM game_servers server
       WHERE server.organization_id = $1
         AND server.game_type = 'palworld'
         AND server.is_enabled = TRUE
         AND server.deleted_at IS NULL
       LIMIT 1`,
      [context.organizationId]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return Object.freeze({
      id: row.id,
      displayName: row.display_name,
      connectionStatus: row.connection_status
    });
  }
}

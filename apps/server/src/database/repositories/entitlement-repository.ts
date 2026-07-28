import type { TenantContext } from "../tenant-context.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

type EntitlementRow = {
  max_discord_guilds: number;
  max_game_servers: number;
  minimum_push_interval_seconds: number;
  history_retention_days: number;
  custom_embed_enabled: boolean;
  resource_metrics_enabled: boolean;
  export_enabled: boolean;
  updated_at: Date;
};

export type EntitlementRecord = Readonly<{
  maxDiscordGuilds: number;
  maxGameServers: number;
  minimumPushIntervalSeconds: number;
  historyRetentionDays: number;
  customEmbedEnabled: boolean;
  resourceMetricsEnabled: boolean;
  exportEnabled: boolean;
  updatedAt: string;
}>;

function mapEntitlement(row: EntitlementRow): EntitlementRecord {
  return Object.freeze({
    maxDiscordGuilds: row.max_discord_guilds,
    maxGameServers: row.max_game_servers,
    minimumPushIntervalSeconds: row.minimum_push_interval_seconds,
    historyRetentionDays: row.history_retention_days,
    customEmbedEnabled: row.custom_embed_enabled,
    resourceMetricsEnabled: row.resource_metrics_enabled,
    exportEnabled: row.export_enabled,
    updatedAt: row.updated_at.toISOString()
  });
}

export class EntitlementRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async ensureDefault(context: TenantContext): Promise<EntitlementRecord> {
    const result = await repositoryQuery<EntitlementRow>(
      this.queryable,
      `INSERT INTO entitlements (organization_id)
       VALUES ($1)
       ON CONFLICT (organization_id) DO UPDATE
         SET organization_id = EXCLUDED.organization_id
       RETURNING max_discord_guilds, max_game_servers,
         minimum_push_interval_seconds, history_retention_days,
         custom_embed_enabled, resource_metrics_enabled, export_enabled, updated_at`,
      [context.organizationId]
    );
    return mapEntitlement(result.rows[0]!);
  }

  async find(context: TenantContext): Promise<EntitlementRecord | undefined> {
    const result = await repositoryQuery<EntitlementRow>(
      this.queryable,
      `SELECT max_discord_guilds, max_game_servers,
         minimum_push_interval_seconds, history_retention_days,
         custom_embed_enabled, resource_metrics_enabled, export_enabled, updated_at
       FROM entitlements
       WHERE organization_id = $1`,
      [context.organizationId]
    );
    return result.rows[0] ? mapEntitlement(result.rows[0]) : undefined;
  }
}

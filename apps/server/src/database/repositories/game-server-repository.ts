import crypto from "node:crypto";
import { SafeDatabaseError } from "../errors.js";
import type { TenantContext } from "../tenant-context.js";
import { requireUuid } from "../tenant-context.js";
import { repositoryQuery, requireBoundedText, type RepositoryQueryable } from "./types.js";

type GameServerRow = {
  id: string;
  display_name: string;
  region: string;
  connection_type: "agent" | "rest";
  connection_status: "not_configured" | "pending" | "ready" | "unavailable" | "revoked";
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

export type GameServerRecord = Readonly<{
  id: string;
  displayName: string;
  gameType: "palworld";
  region: string;
  connectionType: "agent" | "rest";
  connectionStatus: GameServerRow["connection_status"];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}>;

function mapGameServer(row: GameServerRow): GameServerRecord {
  return Object.freeze({
    id: row.id,
    displayName: row.display_name,
    gameType: "palworld",
    region: row.region,
    connectionType: row.connection_type,
    connectionStatus: row.connection_status,
    isEnabled: row.is_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  });
}

function requireConnectionType(value: unknown): "agent" | "rest" {
  if (value === "agent" || value === "rest") return value;
  throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
}

export class GameServerRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async create(
    context: TenantContext,
    input: {
      displayName: string;
      region: string;
      connectionType: "agent" | "rest";
    }
  ): Promise<GameServerRecord> {
    const result = await repositoryQuery<GameServerRow>(
      this.queryable,
      `INSERT INTO game_servers (
         id, organization_id, game_type, display_name, region, connection_type
       ) VALUES ($1, $2, 'palworld', $3, $4, $5)
       RETURNING id, display_name, region, connection_type, connection_status,
         is_enabled, created_at, updated_at`,
      [
        crypto.randomUUID(),
        context.organizationId,
        requireBoundedText(input.displayName, "displayName", 120),
        requireBoundedText(input.region, "region", 64),
        requireConnectionType(input.connectionType)
      ]
    );
    return mapGameServer(result.rows[0]!);
  }

  async find(context: TenantContext, gameServerId: string): Promise<GameServerRecord | undefined> {
    const result = await repositoryQuery<GameServerRow>(
      this.queryable,
      `SELECT id, display_name, region, connection_type, connection_status,
         is_enabled, created_at, updated_at
       FROM game_servers
       WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [context.organizationId, requireUuid(gameServerId, "gameServerId")]
    );
    return result.rows[0] ? mapGameServer(result.rows[0]) : undefined;
  }

  async list(
    context: TenantContext,
    input: { limit?: number; offset?: number } = {}
  ): Promise<readonly GameServerRecord[]> {
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit ?? 50)));
    const offset = Math.max(0, Math.min(100_000, Math.trunc(input.offset ?? 0)));
    const result = await repositoryQuery<GameServerRow>(
      this.queryable,
      `SELECT id, display_name, region, connection_type, connection_status,
         is_enabled, created_at, updated_at
       FROM game_servers
       WHERE organization_id = $1 AND deleted_at IS NULL
       ORDER BY created_at ASC, id ASC
       LIMIT $2 OFFSET $3`,
      [context.organizationId, limit, offset]
    );
    return Object.freeze(result.rows.map(mapGameServer));
  }

  async rename(
    context: TenantContext,
    gameServerId: string,
    displayName: string
  ): Promise<GameServerRecord | undefined> {
    const result = await repositoryQuery<GameServerRow>(
      this.queryable,
      `UPDATE game_servers
       SET display_name = $3, updated_at = NOW()
       WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, display_name, region, connection_type, connection_status,
         is_enabled, created_at, updated_at`,
      [
        context.organizationId,
        requireUuid(gameServerId, "gameServerId"),
        requireBoundedText(displayName, "displayName", 120)
      ]
    );
    return result.rows[0] ? mapGameServer(result.rows[0]) : undefined;
  }

  async remove(context: TenantContext, gameServerId: string): Promise<boolean> {
    const result = await repositoryQuery(
      this.queryable,
      `UPDATE game_servers
       SET deleted_at = NOW(), is_enabled = FALSE, updated_at = NOW()
       WHERE organization_id = $1 AND id = $2 AND deleted_at IS NULL`,
      [context.organizationId, requireUuid(gameServerId, "gameServerId")]
    );
    return result.rowCount === 1;
  }
}

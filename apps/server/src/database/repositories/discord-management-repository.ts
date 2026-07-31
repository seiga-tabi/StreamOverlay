import crypto from "node:crypto";
import type {
  BotManagementGameServer,
  BotManagementOrganization,
  BotManagementRole,
  PalworldServerRegion
} from "@streamops/shared";
import type { TenantContext } from "../tenant-context.js";
import { requireUuid } from "../tenant-context.js";
import { SafeDatabaseError } from "../errors.js";
import { repositoryQuery, requireBoundedText, type RepositoryQueryable } from "./types.js";

type OAuthRow = {
  id: string;
  pkce_verifier_encrypted: Buffer;
};

type SessionRow = {
  id: string;
  user_id: string;
  csrf_token_hash: Buffer;
};

type OrganizationRow = {
  id: string;
  display_name: string;
  role: BotManagementRole;
  discord_guild_id: string | null;
  guild_display_name: string | null;
};

type GameServerRow = {
  id: string;
  display_name: string;
  region: PalworldServerRegion;
  connection_type: "agent" | "rest";
  connection_status: BotManagementGameServer["connectionStatus"];
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

function gameServer(row: GameServerRow): BotManagementGameServer {
  return Object.freeze({
    id: row.id,
    displayName: row.display_name,
    gameType: "palworld" as const,
    region: row.region,
    // Agent 기능 제거 전 생성된 레코드도 같은 REST 관리 흐름으로 복구한다.
    connectionType: "rest",
    connectionStatus: row.connection_status,
    isEnabled: row.is_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  });
}

function requireRole(role: BotManagementRole, allowed: readonly BotManagementRole[]): void {
  if (!allowed.includes(role)) {
    throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
  }
}

export class DiscordManagementRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async createOAuthSession(input: {
    id: string;
    stateHash: Buffer;
    cookieBindingHash: Buffer;
    encryptedPkceVerifier: Buffer;
    expiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_management_oauth_sessions (
         id, state_hash, cookie_binding_hash, pkce_verifier_encrypted, expires_at
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        requireUuid(input.id, "oauthSessionId"),
        input.stateHash,
        input.cookieBindingHash,
        input.encryptedPkceVerifier,
        input.expiresAt
      ]
    );
  }

  async consumeOAuthState(input: {
    stateHash: Buffer;
    cookieBindingHash: Buffer;
  }): Promise<OAuthRow | undefined> {
    const result = await repositoryQuery<OAuthRow>(
      this.queryable,
      `UPDATE discord_management_oauth_sessions
       SET status = 'consumed', consumed_at = NOW(), updated_at = NOW()
       WHERE state_hash = $1
         AND cookie_binding_hash = $2
         AND status = 'pending'
         AND expires_at > NOW()
       RETURNING id, pkce_verifier_encrypted`,
      [input.stateHash, input.cookieBindingHash]
    );
    return result.rows[0];
  }

  async clearOAuthSecret(id: string, failed = false): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_management_oauth_sessions
       SET status = $2,
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           consumed_at = CASE
             WHEN $2 = 'consumed' THEN COALESCE(consumed_at, NOW())
             ELSE NULL
           END,
           updated_at = NOW()
       WHERE id = $1`,
      [requireUuid(id, "oauthSessionId"), failed ? "security_failed" : "consumed"]
    );
  }

  async findIdentityByDiscordUser(discordUserId: string): Promise<{
    userId: string;
    identityId: string;
  } | undefined> {
    const result = await repositoryQuery<{ user_id: string; id: string }>(
      this.queryable,
      `SELECT id, user_id
       FROM discord_identities
       WHERE discord_user_id = $1`,
      [discordUserId]
    );
    const row = result.rows[0];
    return row ? { userId: row.user_id, identityId: row.id } : undefined;
  }

  async userHasOrganization(userId: string): Promise<boolean> {
    const result = await repositoryQuery<{ present: boolean }>(
      this.queryable,
      `SELECT TRUE AS present
       FROM organization_members member
       JOIN organizations organization ON organization.id = member.organization_id
       WHERE member.user_id = $1
         AND organization.status = 'active'
         AND organization.deleted_at IS NULL
       LIMIT 1`,
      [requireUuid(userId, "userId")]
    );
    return Boolean(result.rows[0]?.present);
  }

  async createSession(input: {
    id: string;
    userId: string;
    sessionTokenHash: Buffer;
    csrfTokenHash: Buffer;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO discord_management_sessions (
         id, user_id, session_token_hash, csrf_token_hash,
         idle_expires_at, absolute_expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        requireUuid(input.id, "managementSessionId"),
        requireUuid(input.userId, "userId"),
        input.sessionTokenHash,
        input.csrfTokenHash,
        input.idleExpiresAt,
        input.absoluteExpiresAt
      ]
    );
  }

  async findActiveSession(
    sessionTokenHash: Buffer,
    nextIdleExpiry: Date
  ): Promise<SessionRow | undefined> {
    const result = await repositoryQuery<SessionRow>(
      this.queryable,
      `UPDATE discord_management_sessions
       SET last_seen_at = NOW(),
           idle_expires_at = LEAST($2, absolute_expires_at)
       WHERE session_token_hash = $1
         AND status = 'active'
         AND idle_expires_at > NOW()
         AND absolute_expires_at > NOW()
       RETURNING id, user_id, csrf_token_hash`,
      [sessionTokenHash, nextIdleExpiry]
    );
    return result.rows[0];
  }

  async revokeSession(sessionTokenHash: Buffer): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_management_sessions
       SET status = 'revoked', revoked_at = NOW()
       WHERE session_token_hash = $1 AND status = 'active'`,
      [sessionTokenHash]
    );
  }

  async listOrganizations(userId: string): Promise<readonly BotManagementOrganization[]> {
    const result = await repositoryQuery<OrganizationRow>(
      this.queryable,
      `SELECT organization.id, organization.display_name, member.role,
         guild.discord_guild_id, guild.display_name AS guild_display_name
       FROM organization_members member
       JOIN organizations organization ON organization.id = member.organization_id
       LEFT JOIN LATERAL (
         SELECT discord_guild_id, display_name
         FROM discord_guilds
         WHERE organization_id = organization.id AND status = 'active'
         ORDER BY created_at ASC, id ASC
         LIMIT 1
       ) guild ON TRUE
       WHERE member.user_id = $1
         AND organization.status = 'active'
         AND organization.deleted_at IS NULL
       ORDER BY lower(organization.display_name), organization.id
       LIMIT 100`,
      [requireUuid(userId, "userId")]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({
      id: row.id,
      displayName: row.display_name,
      role: row.role,
      ...(row.discord_guild_id && row.guild_display_name
        ? {
            discordGuild: Object.freeze({
              id: row.discord_guild_id,
              displayName: row.guild_display_name
            })
          }
        : {})
    })));
  }

  async requireMembership(
    userId: string,
    organizationId: string
  ): Promise<{ context: TenantContext; role: BotManagementRole }> {
    const result = await repositoryQuery<{ role: BotManagementRole }>(
      this.queryable,
      `SELECT member.role
       FROM organization_members member
       JOIN organizations organization ON organization.id = member.organization_id
       WHERE member.organization_id = $1
         AND member.user_id = $2
         AND organization.status = 'active'
         AND organization.deleted_at IS NULL`,
      [requireUuid(organizationId, "organizationId"), requireUuid(userId, "userId")]
    );
    const role = result.rows[0]?.role;
    if (!role) throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    return {
      context: Object.freeze({
        organizationId: requireUuid(organizationId, "organizationId"),
        actorUserId: requireUuid(userId, "userId")
      }),
      role
    };
  }

  async listGameServers(
    context: TenantContext,
    role: BotManagementRole
  ): Promise<readonly BotManagementGameServer[]> {
    requireRole(role, ["owner", "manager", "viewer"]);
    const result = await repositoryQuery<GameServerRow>(
      this.queryable,
      `SELECT id, display_name, region, connection_type, connection_status,
         is_enabled, created_at, updated_at
       FROM game_servers
       WHERE organization_id = $1
         AND deleted_at IS NULL
         AND is_enabled = TRUE
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [context.organizationId]
    );
    return Object.freeze(result.rows.map(gameServer));
  }

  async createGameServer(input: {
    context: TenantContext;
    role: BotManagementRole;
    displayName: string;
    region: PalworldServerRegion;
  }): Promise<BotManagementGameServer> {
    requireRole(input.role, ["owner", "manager"]);
    const entitlement = await repositoryQuery<{ max_game_servers: number }>(
      this.queryable,
      `SELECT max_game_servers
       FROM entitlements
       WHERE organization_id = $1
       FOR UPDATE`,
      [input.context.organizationId]
    );
    const maximum = entitlement.rows[0]?.max_game_servers;
    if (maximum === undefined) {
      throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    }
    const count = await repositoryQuery<{ count: string }>(
      this.queryable,
      `SELECT COUNT(*)::TEXT AS count
       FROM game_servers
       WHERE organization_id = $1
         AND deleted_at IS NULL`,
      [input.context.organizationId]
    );
    const allowedMaximum = Math.min(maximum, 1);
    if (Number(count.rows[0]?.count ?? allowedMaximum) >= allowedMaximum) {
      throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    }
    const result = await repositoryQuery<GameServerRow>(
      this.queryable,
      `INSERT INTO game_servers (
         id, organization_id, game_type, display_name, region,
         connection_type, connection_status
       ) VALUES ($1, $2, 'palworld', $3, $4, 'rest', 'not_configured')
       RETURNING id, display_name, region, connection_type, connection_status,
         is_enabled, created_at, updated_at`,
      [
        crypto.randomUUID(),
        input.context.organizationId,
        requireBoundedText(input.displayName, "displayName", 120),
        input.region
      ]
    );
    await this.audit(input.context, "organization.game_server.created", "game_server", result.rows[0]!.id);
    return gameServer(result.rows[0]!);
  }

  async deleteGameServer(input: {
    context: TenantContext;
    role: BotManagementRole;
    gameServerId: string;
  }): Promise<boolean> {
    requireRole(input.role, ["owner"]);
    const id = requireUuid(input.gameServerId, "gameServerId");
    const server = await repositoryQuery<{ id: string }>(
      this.queryable,
      `SELECT id
       FROM game_servers
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
         AND is_enabled = TRUE
       FOR UPDATE`,
      [input.context.organizationId, id]
    );
    if (!server.rows[0]) return false;
    // 이미 배포된 Agent 레코드는 새 기능에서 사용하지 않지만 서버 삭제 시에는
    // 과거 자격 증명이 다시 활성화될 여지를 없애기 위해 함께 폐기한다.
    await repositoryQuery(
      this.queryable,
      `UPDATE agent_bootstrap_sessions
       SET status = 'revoked', revoked_at = NOW()
       WHERE organization_id = $1
         AND game_server_id = $2
         AND status = 'issued'`,
      [input.context.organizationId, id]
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE agent_installations
       SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
       WHERE organization_id = $1
         AND game_server_id = $2
         AND status <> 'revoked'`,
      [input.context.organizationId, id]
    );
    await repositoryQuery(
      this.queryable,
      `DELETE FROM server_connections
       WHERE organization_id = $1 AND game_server_id = $2`,
      [input.context.organizationId, id]
    );
    const result = await repositoryQuery(
      this.queryable,
      `UPDATE game_servers
       SET is_enabled = FALSE,
           connection_status = 'revoked',
           deleted_at = NOW(),
           updated_at = NOW()
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
         AND is_enabled = TRUE`,
      [input.context.organizationId, id]
    );
    if (result.rowCount === 1) {
      await this.audit(input.context, "organization.game_server.deleted", "game_server", id);
    }
    return result.rowCount === 1;
  }

  async expireSessions(): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_management_oauth_sessions
       SET status = 'expired',
           pkce_verifier_encrypted = decode(repeat('00', 32), 'hex'),
           updated_at = NOW()
       WHERE status = 'pending' AND expires_at <= NOW()`,
      []
    );
    await repositoryQuery(
      this.queryable,
      `UPDATE discord_management_sessions
       SET status = 'expired'
       WHERE status = 'active'
         AND (idle_expires_at <= NOW() OR absolute_expires_at <= NOW())`,
      []
    );
  }

  private async audit(
    context: TenantContext,
    action: string,
    targetType: string,
    targetId: string
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO audit_logs (
         id, organization_id, actor_user_id, action, target_type,
         target_reference_hash, safe_metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, '{}'::JSONB)`,
      [
        crypto.randomUUID(),
        context.organizationId,
        context.actorUserId,
        action,
        targetType,
        crypto.createHash("sha256").update(targetId).digest()
      ]
    );
  }
}

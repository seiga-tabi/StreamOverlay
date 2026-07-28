import crypto from "node:crypto";
import type { PalworldAgentStatusPayload } from "@streamops/shared";
import { SafeDatabaseError } from "../errors.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

export type LockedAgentInstallation = Readonly<{
  id: string;
  organizationId: string;
  gameServerId: string;
  credentialHash: Buffer;
  credentialVersion: number;
}>;

export class AgentIngestionRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async register(input: {
    bootstrapTokenHash: Buffer;
    credentialHash: Buffer;
    credentialExpiresAt: Date;
    agentVersion: string;
  }): Promise<{ installationId: string; organizationId: string; gameServerId: string }> {
    const bootstrap = await repositoryQuery<{
      id: string;
      organization_id: string;
      game_server_id: string;
      issued_by_user_id: string;
    }>(
      this.queryable,
      `SELECT bootstrap.id, bootstrap.organization_id, bootstrap.game_server_id,
         bootstrap.issued_by_user_id
       FROM agent_bootstrap_sessions bootstrap
       JOIN game_servers server
         ON server.organization_id = bootstrap.organization_id
        AND server.id = bootstrap.game_server_id
       WHERE bootstrap.token_hash = $1
         AND bootstrap.status = 'issued'
         AND bootstrap.expires_at > NOW()
         AND server.deleted_at IS NULL
         AND server.is_enabled = TRUE
         AND server.connection_type = 'agent'
       FOR UPDATE OF bootstrap, server`,
      [input.bootstrapTokenHash]
    );
    const row = bootstrap.rows[0];
    if (!row) throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
    const previous = await repositoryQuery<{ id: string }>(
      this.queryable,
      `SELECT id
       FROM agent_installations
       WHERE organization_id = $1 AND game_server_id = $2
       FOR UPDATE`,
      [row.organization_id, row.game_server_id]
    );
    const installationId = previous.rows[0]?.id ?? crypto.randomUUID();
    if (previous.rows[0]) {
      await repositoryQuery(
        this.queryable,
        `UPDATE agent_installations
         SET status = 'active', credential_hash = $3, credential_version = credential_version + 1,
             agent_version = $4, credential_expires_at = $5, revoked_at = NULL,
             last_seen_at = NULL, last_credential_used_at = NULL,
             last_payload_version = NULL, updated_at = NOW()
         WHERE organization_id = $1 AND id = $2`,
        [row.organization_id, installationId, input.credentialHash, input.agentVersion, input.credentialExpiresAt]
      );
    } else {
      await repositoryQuery(
        this.queryable,
        `INSERT INTO agent_installations (
           id, organization_id, game_server_id, status, credential_hash,
           credential_version, agent_version, credential_expires_at
         ) VALUES ($1, $2, $3, 'active', $4, 1, $5, $6)`,
        [
          installationId,
          row.organization_id,
          row.game_server_id,
          input.credentialHash,
          input.agentVersion,
          input.credentialExpiresAt
        ]
      );
    }
    const consumed = await repositoryQuery(
      this.queryable,
      `UPDATE agent_bootstrap_sessions
       SET status = 'consumed', consumed_at = NOW()
       WHERE id = $1 AND status = 'issued' AND expires_at > NOW()`,
      [row.id]
    );
    if (consumed.rowCount !== 1) throw new SafeDatabaseError("DATABASE_CONFLICT", false);
    await repositoryQuery(
      this.queryable,
      `UPDATE game_servers
       SET connection_status = 'pending', updated_at = NOW()
       WHERE organization_id = $1 AND id = $2`,
      [row.organization_id, row.game_server_id]
    );
    await repositoryQuery(
      this.queryable,
      `INSERT INTO audit_logs (
         id, organization_id, actor_user_id, action, target_type,
         target_reference_hash, safe_metadata
       ) VALUES ($1, $2, $3, 'agent.registration.completed', 'agent_installation', $4, '{}'::JSONB)`,
      [
        crypto.randomUUID(),
        row.organization_id,
        row.issued_by_user_id,
        crypto.createHash("sha256").update(installationId).digest()
      ]
    );
    return {
      installationId,
      organizationId: row.organization_id,
      gameServerId: row.game_server_id
    };
  }

  async lockInstallationByCredentialHash(
    credentialHash: Buffer
  ): Promise<LockedAgentInstallation | undefined> {
    const result = await repositoryQuery<{
      id: string;
      organization_id: string;
      game_server_id: string;
      credential_hash: Buffer;
      credential_version: number;
    }>(
      this.queryable,
      `SELECT installation.id, installation.organization_id, installation.game_server_id,
         installation.credential_hash, installation.credential_version
       FROM agent_installations installation
       JOIN game_servers server
         ON server.organization_id = installation.organization_id
        AND server.id = installation.game_server_id
       WHERE installation.credential_hash = $1
         AND installation.status = 'active'
         AND (installation.credential_expires_at IS NULL OR installation.credential_expires_at > NOW())
         AND server.is_enabled = TRUE
         AND server.deleted_at IS NULL
       FOR UPDATE OF installation, server`,
      [credentialHash]
    );
    const row = result.rows[0];
    return row && {
      id: row.id,
      organizationId: row.organization_id,
      gameServerId: row.game_server_id,
      credentialHash: row.credential_hash,
      credentialVersion: row.credential_version
    };
  }

  async consumeNonce(input: {
    installation: LockedAgentInstallation;
    nonceHash: Buffer;
    requestTimestamp: Date;
    expiresAt: Date;
  }): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `INSERT INTO agent_request_nonces (
         id, organization_id, agent_installation_id, nonce_hash,
         request_timestamp, expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        crypto.randomUUID(),
        input.installation.organizationId,
        input.installation.id,
        input.nonceHash,
        input.requestTimestamp,
        input.expiresAt
      ]
    );
  }

  async storeStatus(input: {
    installation: LockedAgentInstallation;
    payload: PalworldAgentStatusPayload;
    payloadHash: Buffer;
    ipHash?: Buffer;
  }): Promise<{ currentUpdated: boolean; duplicate: boolean; statusChanged: boolean }> {
    const observedAt = new Date(input.payload.observedAt);
    const existing = await repositoryQuery<{ payload_hash: Buffer }>(
      this.queryable,
      `SELECT payload_hash
       FROM server_status_history
       WHERE organization_id = $1
         AND game_server_id = $2
         AND agent_installation_id = $3
         AND observed_at = $4`,
      [
        input.installation.organizationId,
        input.installation.gameServerId,
        input.installation.id,
        observedAt
      ]
    );
    if (existing.rows[0]) {
      if (!crypto.timingSafeEqual(existing.rows[0].payload_hash, input.payloadHash)) {
        throw new SafeDatabaseError("DATABASE_CONFLICT", false);
      }
      await this.touchInstallation(
        input.installation,
        input.payload.payloadVersion,
        input.ipHash
      );
      return { currentUpdated: false, duplicate: true, statusChanged: false };
    }
    const previous = await repositoryQuery<{ online: boolean; observed_at: Date }>(
      this.queryable,
      `SELECT online, observed_at
       FROM server_current_status
       WHERE organization_id = $1 AND game_server_id = $2
       FOR UPDATE`,
      [input.installation.organizationId, input.installation.gameServerId]
    );
    await repositoryQuery(
      this.queryable,
       `INSERT INTO server_status_history (
         id, organization_id, game_server_id, online, players, max_players,
         game_version, uptime_seconds, cpu_percent, memory_percent, disk_percent,
         latency_ms, observed_at, payload_version, agent_installation_id, payload_hash
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
       )`,
      [
        crypto.randomUUID(),
        input.installation.organizationId,
        input.installation.gameServerId,
        input.payload.online,
        input.payload.players,
        input.payload.maxPlayers,
        input.payload.gameVersion ?? null,
        input.payload.uptimeSeconds ?? null,
        input.payload.cpuPercent ?? null,
        input.payload.memoryPercent ?? null,
        input.payload.diskPercent ?? null,
        input.payload.latencyMs ?? null,
        observedAt,
        input.payload.payloadVersion,
        input.installation.id,
        input.payloadHash
      ]
    );
    const updated = await repositoryQuery(
      this.queryable,
      `INSERT INTO server_current_status (
         organization_id, game_server_id, online, players, max_players,
         game_version, uptime_seconds, cpu_percent, memory_percent, disk_percent,
         latency_ms, observed_at, payload_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (organization_id, game_server_id) DO UPDATE
       SET online = EXCLUDED.online, players = EXCLUDED.players,
           max_players = EXCLUDED.max_players, game_version = EXCLUDED.game_version,
           uptime_seconds = EXCLUDED.uptime_seconds, cpu_percent = EXCLUDED.cpu_percent,
           memory_percent = EXCLUDED.memory_percent, disk_percent = EXCLUDED.disk_percent,
           latency_ms = EXCLUDED.latency_ms, observed_at = EXCLUDED.observed_at,
           received_at = NOW(), payload_version = EXCLUDED.payload_version, updated_at = NOW()
       WHERE server_current_status.observed_at < EXCLUDED.observed_at`,
      [
        input.installation.organizationId,
        input.installation.gameServerId,
        input.payload.online,
        input.payload.players,
        input.payload.maxPlayers,
        input.payload.gameVersion ?? null,
        input.payload.uptimeSeconds ?? null,
        input.payload.cpuPercent ?? null,
        input.payload.memoryPercent ?? null,
        input.payload.diskPercent ?? null,
        input.payload.latencyMs ?? null,
        observedAt,
        input.payload.payloadVersion
      ]
    );
    const currentUpdated = (updated.rowCount ?? 0) > 0;
    const prior = previous.rows[0];
    const statusChanged = Boolean(
      currentUpdated && prior && prior.online !== input.payload.online
    );
    if (statusChanged && prior) {
      const retention = await repositoryQuery<{ history_retention_days: number }>(
        this.queryable,
        `SELECT history_retention_days FROM entitlements WHERE organization_id = $1`,
        [input.installation.organizationId]
      );
      await repositoryQuery(
        this.queryable,
        `INSERT INTO server_events (
           id, organization_id, game_server_id, event_type, occurred_at,
           safe_metadata, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6::JSONB, NOW() + make_interval(days => $7))`,
        [
          crypto.randomUUID(),
          input.installation.organizationId,
          input.installation.gameServerId,
          input.payload.online ? "server.online" : "server.offline",
          observedAt,
          JSON.stringify({ previousOnline: prior.online, online: input.payload.online }),
          retention.rows[0]?.history_retention_days ?? 1
        ]
      );
    }
    await this.touchInstallation(
      input.installation,
      input.payload.payloadVersion,
      input.ipHash
    );
    if (currentUpdated) {
      await repositoryQuery(
        this.queryable,
        `UPDATE game_servers SET connection_status = 'ready', updated_at = NOW()
         WHERE organization_id = $1 AND id = $2`,
        [input.installation.organizationId, input.installation.gameServerId]
      );
    }
    return { currentUpdated, duplicate: false, statusChanged };
  }

  async cleanupExpiredNonces(): Promise<void> {
    await repositoryQuery(this.queryable, "DELETE FROM agent_request_nonces WHERE expires_at <= NOW()", []);
  }

  private async touchInstallation(
    installation: LockedAgentInstallation,
    payloadVersion: number,
    ipHash?: Buffer
  ): Promise<void> {
    await repositoryQuery(
      this.queryable,
      `UPDATE agent_installations
       SET last_seen_at = NOW(), last_credential_used_at = NOW(),
           last_payload_version = $3, last_ip_hash = COALESCE($4, last_ip_hash),
           updated_at = NOW()
       WHERE organization_id = $1 AND id = $2`,
      [installation.organizationId, installation.id, payloadVersion, ipHash ?? null]
    );
  }
}

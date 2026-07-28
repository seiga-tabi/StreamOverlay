import crypto from "node:crypto";
import type { Pool } from "pg";
import {
  YORO_AGENT_PAYLOAD_VERSION,
  type AgentIngestionResponse,
  type AgentRegistrationInput,
  type AgentRegistrationResponse,
  type PalworldAgentStatusPayload
} from "@streamops/shared";
import { appConfig } from "../config.js";
import { SafeDatabaseError } from "../database/errors.js";
import { AgentIngestionRepository } from "../database/repositories/agent-ingestion-repository.js";
import { withTransaction } from "../database/transaction.js";

export type AgentIngestionErrorCode =
  | "agent_registration_invalid"
  | "agent_registration_unavailable"
  | "agent_authentication_failed"
  | "agent_request_expired"
  | "agent_request_replayed"
  | "agent_payload_invalid"
  | "agent_payload_conflict"
  | "agent_rate_limited"
  | "agent_unavailable";

export class AgentIngestionError extends Error {
  constructor(
    readonly code: AgentIngestionErrorCode,
    readonly status: 400 | 401 | 404 | 409 | 429 | 503
  ) {
    super(code);
    this.name = "AgentIngestionError";
  }
}

type AuditLogger = {
  event?: (entry: Record<string, unknown>) => void;
  error?: (entry: Record<string, unknown>) => void;
};

type RateEntry = { startedAt: number; count: number };

const AGENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{48,192}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

function opaqueToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function stablePayload(payload: PalworldAgentStatusPayload): string {
  return JSON.stringify({
    payloadVersion: payload.payloadVersion,
    observedAt: payload.observedAt,
    online: payload.online,
    players: payload.players,
    maxPlayers: payload.maxPlayers,
    gameVersion: payload.gameVersion ?? null,
    uptimeSeconds: payload.uptimeSeconds ?? null,
    cpuPercent: payload.cpuPercent ?? null,
    memoryPercent: payload.memoryPercent ?? null,
    diskPercent: payload.diskPercent ?? null,
    latencyMs: payload.latencyMs ?? null
  });
}

export class AgentIngestionService {
  private readonly rate = new Map<string, RateEntry>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly pool: Pool,
    private readonly logger: AuditLogger
  ) {}

  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      void this.cleanup().catch(() => {
        this.logger.error?.({
          type: "agent.nonce_cleanup_failed",
          errorCode: "agent_unavailable"
        });
      });
    }, 60_000);
    this.cleanupTimer.unref();
  }

  stopCleanup(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  async register(input: AgentRegistrationInput): Promise<AgentRegistrationResponse> {
    const agentToken = opaqueToken();
    const credentialHash = sha256(agentToken);
    try {
      const result = await withTransaction(this.pool, async (client) =>
        new AgentIngestionRepository(client).register({
          bootstrapTokenHash: sha256(input.bootstrapToken),
          credentialHash,
          credentialExpiresAt: new Date(
            Date.now() + appConfig.agentIngestion.credentialTtlDays * 86_400_000
          ),
          agentVersion: input.agentVersion
        })
      );
      return {
        installationId: result.installationId,
        agentToken,
        gameServer: {
          id: result.gameServerId,
          gameType: "palworld"
        },
        ingestion: {
          endpoint: `${appConfig.publicBaseUrl.replace(/\/+$/u, "")}/api/agent/v1/status`,
          payloadVersion: YORO_AGENT_PAYLOAD_VERSION
        }
      };
    } catch (error) {
      this.logger.error?.({
        type: "agent.registration.rejected",
        errorCode: "agent_registration_invalid"
      });
      if (
        error instanceof SafeDatabaseError
        && (error.code === "DATABASE_REFERENCE_INVALID" || error.code === "DATABASE_CONFLICT")
      ) {
        throw new AgentIngestionError("agent_registration_invalid", 401);
      }
      throw new AgentIngestionError("agent_registration_unavailable", 503);
    }
  }

  async ingest(input: {
    agentToken: string;
    requestTimestamp: number;
    nonce: string;
    payload: PalworldAgentStatusPayload;
    ipHash?: string;
  }): Promise<AgentIngestionResponse> {
    if (!AGENT_TOKEN_PATTERN.test(input.agentToken) || !NONCE_PATTERN.test(input.nonce)) {
      throw new AgentIngestionError("agent_authentication_failed", 401);
    }
    const now = Date.now();
    if (
      !Number.isSafeInteger(input.requestTimestamp)
      || Math.abs(now - input.requestTimestamp * 1_000) > appConfig.agentIngestion.clockSkewSeconds * 1_000
    ) {
      throw new AgentIngestionError("agent_request_expired", 401);
    }
    const credentialHash = sha256(input.agentToken);
    this.enforceRateLimit(credentialHash.toString("hex"), now);
    const progress: { stage: "authentication" | "nonce" | "status" } = {
      stage: "authentication"
    };
    try {
      const result = await withTransaction(this.pool, async (client) => {
        const repository = new AgentIngestionRepository(client);
        const installation = await repository.lockInstallationByCredentialHash(credentialHash);
        if (
          !installation
          || installation.credentialHash.length !== credentialHash.length
          || !crypto.timingSafeEqual(installation.credentialHash, credentialHash)
        ) {
          throw new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
        }
        progress.stage = "nonce";
        await repository.consumeNonce({
          installation,
          nonceHash: sha256(input.nonce),
          requestTimestamp: new Date(input.requestTimestamp * 1_000),
          expiresAt: new Date(
            now + appConfig.agentIngestion.nonceTtlSeconds * 1_000
          )
        });
        progress.stage = "status";
          return repository.storeStatus({
            installation,
            payload: input.payload,
            payloadHash: sha256(stablePayload(input.payload)),
            ...(input.ipHash === undefined
              ? {}
              : { ipHash: Buffer.from(input.ipHash, "hex") })
          });
      });
      if (!result.duplicate && !result.currentUpdated) {
        this.logger.event?.({
          type: "agent.status.stale",
          payloadVersion: input.payload.payloadVersion
        });
      }
      if (result.statusChanged) {
        this.logger.event?.({
          type: "server.status.changed",
          payloadVersion: input.payload.payloadVersion
        });
      }
      return {
        accepted: true,
        currentUpdated: result.currentUpdated,
        duplicate: result.duplicate
      };
    } catch (error) {
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_REFERENCE_INVALID") {
        throw new AgentIngestionError("agent_authentication_failed", 401);
      }
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
        throw new AgentIngestionError(
          progress.stage === "nonce" ? "agent_request_replayed" : "agent_payload_conflict",
          409
        );
      }
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_UNAVAILABLE") {
        throw new AgentIngestionError("agent_unavailable", 503);
      }
      throw new AgentIngestionError("agent_unavailable", 503);
    }
  }

  private enforceRateLimit(key: string, now: number): void {
    const existing = this.rate.get(key);
    if (!existing || now - existing.startedAt >= 60_000) {
      this.rate.set(key, { startedAt: now, count: 1 });
      return;
    }
    existing.count += 1;
    if (existing.count > appConfig.agentIngestion.rateLimitPerMinute) {
      throw new AgentIngestionError("agent_rate_limited", 429);
    }
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, value] of this.rate) {
      if (now - value.startedAt >= 120_000) this.rate.delete(key);
    }
    await new AgentIngestionRepository(this.pool).cleanupExpiredNonces();
  }
}

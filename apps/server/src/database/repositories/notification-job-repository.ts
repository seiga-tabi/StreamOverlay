import crypto from "node:crypto";
import { SafeDatabaseError } from "../errors.js";
import type { TenantContext } from "../tenant-context.js";
import { requireUuid } from "../tenant-context.js";
import { repositoryQuery, requireBoundedText, type RepositoryQueryable } from "./types.js";

type NotificationJobRow = {
  id: string;
  game_server_id: string;
  job_type: string;
  deduplication_key: string;
  payload: Record<string, unknown>;
  available_at: Date;
  attempts: number;
  locked_at: Date | null;
  completed_at: Date | null;
  last_error_code: string | null;
  created_at: Date;
};

export type NotificationJobRecord = Readonly<{
  id: string;
  gameServerId: string;
  jobType: string;
  deduplicationKey: string;
  payload: Readonly<Record<string, unknown>>;
  availableAt: string;
  attempts: number;
  lockedAt?: string;
  completedAt?: string;
  lastErrorCode?: string;
  createdAt: string;
}>;

function mapJob(row: NotificationJobRow): NotificationJobRecord {
  return Object.freeze({
    id: row.id,
    gameServerId: row.game_server_id,
    jobType: row.job_type,
    deduplicationKey: row.deduplication_key,
    payload: Object.freeze({ ...row.payload }),
    availableAt: row.available_at.toISOString(),
    attempts: row.attempts,
    ...(row.locked_at === null ? {} : { lockedAt: row.locked_at.toISOString() }),
    ...(row.completed_at === null ? {} : { completedAt: row.completed_at.toISOString() }),
    ...(row.last_error_code === null ? {} : { lastErrorCode: row.last_error_code }),
    createdAt: row.created_at.toISOString()
  });
}

function safePayload(value: Record<string, unknown>): string {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 65_536) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return serialized;
}

export class NotificationJobRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async enqueue(
    context: TenantContext,
    input: {
      gameServerId: string;
      jobType: string;
      deduplicationKey: string;
      payload: Record<string, unknown>;
      availableAt?: Date;
    }
  ): Promise<NotificationJobRecord> {
    const result = await repositoryQuery<NotificationJobRow>(
      this.queryable,
      `INSERT INTO notification_jobs (
         id, organization_id, game_server_id, job_type,
         deduplication_key, payload, available_at
       ) VALUES ($1, $2, $3, $4, $5, $6::JSONB, $7)
       RETURNING id, game_server_id, job_type, deduplication_key, payload,
         available_at, attempts, locked_at, completed_at, last_error_code, created_at`,
      [
        crypto.randomUUID(),
        context.organizationId,
        requireUuid(input.gameServerId, "gameServerId"),
        requireBoundedText(input.jobType, "jobType", 80),
        requireBoundedText(input.deduplicationKey, "deduplicationKey", 160),
        safePayload(input.payload),
        input.availableAt ?? new Date()
      ]
    );
    return mapJob(result.rows[0]!);
  }

  async listPending(
    context: TenantContext,
    limit = 50
  ): Promise<readonly NotificationJobRecord[]> {
    const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const result = await repositoryQuery<NotificationJobRow>(
      this.queryable,
      `SELECT id, game_server_id, job_type, deduplication_key, payload,
         available_at, attempts, locked_at, completed_at, last_error_code, created_at
       FROM notification_jobs
       WHERE organization_id = $1 AND completed_at IS NULL
       ORDER BY available_at ASC, created_at ASC, id ASC
       LIMIT $2`,
      [context.organizationId, boundedLimit]
    );
    return Object.freeze(result.rows.map(mapJob));
  }

  async complete(context: TenantContext, jobId: string): Promise<boolean> {
    const result = await repositoryQuery(
      this.queryable,
      `UPDATE notification_jobs
       SET completed_at = NOW(), locked_at = NULL, locked_by = NULL
       WHERE organization_id = $1 AND id = $2 AND completed_at IS NULL`,
      [context.organizationId, requireUuid(jobId, "jobId")]
    );
    return result.rowCount === 1;
  }
}

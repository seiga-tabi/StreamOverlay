import crypto from "node:crypto";
import {
  adminAuditTargetType,
  isAdminAuditAction,
  isAdminAuditTargetType,
  isGlobalAdminAuditAction,
  parseAdminAuditLogListResponse,
  parseAdminAuditLogMetadata,
  sanitizeAdminAuditLogMetadata,
  type AdminAuditAction,
  type AdminAuditLogEntry,
  type AdminAuditLogListResponse,
  type AdminAuditLogOutcome,
  type AdminAuditTargetType,
  type GlobalAdminAuditAction,
} from "@streamops/shared";
import { SafeDatabaseError } from "../errors.js";
import { requireUuid } from "../tenant-context.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_OFFSET = 10_000;
const DEFAULT_PERIOD_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_PERIOD_MS = 90 * 24 * 60 * 60 * 1_000;
const TOKEN_ACTOR_SENTINEL = "dashboard-token";

type AuditFilters = Readonly<{
  from: string;
  to: string;
  action?: AdminAuditAction;
  target?: AdminAuditTargetType;
  targetReference?: string;
  actor?: string;
  organization?: string;
}>;

export type AdminAuditLogQuery = AuditFilters & Readonly<{
  offset: number;
  limit: number;
}>;

type AuditLogRow = {
  scope: "organization" | "global";
  entry_reference_hash: Buffer;
  organization_reference_hash: Buffer | null;
  actor_reference_hash: Buffer | null;
  action: string;
  target_type: string;
  target_reference_hash: Buffer | null;
  safe_metadata: unknown;
  outcome: AdminAuditLogOutcome | null;
  created_at: Date | string;
  completed_at: Date | string | null;
};

type GlobalAdminAuditMutationFields = Readonly<{
  action: GlobalAdminAuditAction;
  targetIdentifier: string;
  metadata: unknown;
}>;

export type BeginGlobalAdminAuditMutationInput = GlobalAdminAuditMutationFields & (
  | Readonly<{ actorMethod: "session"; actorSessionId: string }>
  | Readonly<{ actorMethod: "token" }>
);

export type GlobalAdminAuditMutation = Readonly<{
  mutationId: string;
}>;

export type CompleteGlobalAdminAuditMutationInput = Readonly<{
  mutationId: string;
  outcome: Exclude<AdminAuditLogOutcome, "started">;
}>;

export class AdminAuditLogQueryError extends Error {
  constructor(readonly code: "INVALID_AUDIT_FILTER") {
    super(code);
    this.name = "AdminAuditLogQueryError";
  }
}

function normalizedTimestamp(value: string | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  if (value.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  return value;
}

function referenceHash(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(normalized)) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  return normalized;
}

function targetReferenceHash(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 64
    || normalized.length > 256
    || normalized.length % 2 !== 0
    || !/^[a-f0-9]+$/u.test(normalized)
  ) throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  return normalized;
}

function singleValue(params: URLSearchParams, key: string): string | undefined {
  const values = params.getAll(key);
  if (values.length > 1) throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  return values[0] ?? undefined;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (value === undefined) return fallback;
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  return parsed;
}

export function parseAdminAuditLogQuery(params: URLSearchParams, now = Date.now()): AdminAuditLogQuery {
  const allowed = new Set([
    "from",
    "to",
    "action",
    "target",
    "targetReference",
    "actor",
    "organization",
    "offset",
    "limit"
  ]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  const defaultTo = new Date(now).toISOString();
  const defaultFrom = new Date(now - DEFAULT_PERIOD_MS).toISOString();
  const from = normalizedTimestamp(singleValue(params, "from"), defaultFrom);
  const to = normalizedTimestamp(singleValue(params, "to"), defaultTo);
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (fromMs > toMs || toMs - fromMs > MAX_PERIOD_MS) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  const actionRaw = singleValue(params, "action");
  const targetRaw = singleValue(params, "target");
  if (actionRaw !== undefined && !isAdminAuditAction(actionRaw)) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  if (targetRaw !== undefined && !isAdminAuditTargetType(targetRaw)) {
    throw new AdminAuditLogQueryError("INVALID_AUDIT_FILTER");
  }
  const targetReference = targetReferenceHash(singleValue(params, "targetReference"));
  const actor = referenceHash(singleValue(params, "actor"));
  const organization = referenceHash(singleValue(params, "organization"));
  return {
    from,
    to,
    ...(actionRaw === undefined ? {} : { action: actionRaw }),
    ...(targetRaw === undefined ? {} : { target: targetRaw }),
    ...(targetReference === undefined ? {} : { targetReference }),
    ...(actor === undefined ? {} : { actor }),
    ...(organization === undefined ? {} : { organization }),
    offset: boundedInteger(singleValue(params, "offset"), 0, 0, MAX_OFFSET),
    limit: boundedInteger(singleValue(params, "limit"), DEFAULT_LIMIT, 1, MAX_LIMIT)
  };
}

/** 응답·저장소에서 원본 식별자를 대신할 안정적인 SHA-256 reference입니다. */
export function safeAuditReference(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function identifierHash(value: string, field: string): Buffer {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false, `${field} 값이 올바르지 않습니다.`);
  }
  return crypto.createHash("sha256").update(normalized, "utf8").digest();
}

function hashHex(value: Buffer | null): string | undefined {
  return value === null ? undefined : Buffer.from(value).toString("hex");
}

function rowTimestamp(value: Date | string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  return timestamp.toISOString();
}

function publicEntry(row: AuditLogRow): AdminAuditLogEntry {
  if (!isAdminAuditAction(row.action) || !isAdminAuditTargetType(row.target_type)) {
    throw new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
  }
  const metadata = sanitizeAdminAuditLogMetadata(row.action, row.safe_metadata);
  if (!metadata) throw new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
  const entry: AdminAuditLogEntry = {
    reference: hashHex(row.entry_reference_hash) ?? "",
    scope: row.scope,
    ...(hashHex(row.organization_reference_hash) === undefined
      ? {}
      : { organizationReference: hashHex(row.organization_reference_hash)! }),
    ...(hashHex(row.actor_reference_hash) === undefined
      ? {}
      : { actorReference: hashHex(row.actor_reference_hash)! }),
    action: row.action,
    targetType: row.target_type,
    ...(hashHex(row.target_reference_hash) === undefined
      ? {}
      : { targetReference: hashHex(row.target_reference_hash)! }),
    metadata,
    ...(row.outcome === null ? {} : { outcome: row.outcome }),
    createdAt: rowTimestamp(row.created_at),
    ...(row.completed_at === null ? {} : { completedAt: rowTimestamp(row.completed_at) })
  };
  return entry;
}

export class AdminAuditLogRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async list(query: AdminAuditLogQuery): Promise<AdminAuditLogListResponse> {
    const values: unknown[] = [query.from, query.to];
    const organizationConditions = [
      "created_at >= $1::timestamptz",
      "created_at <= $2::timestamptz"
    ];
    const globalConditions = [...organizationConditions];
    const add = (
      value: unknown,
      organizationCondition: (index: number) => string,
      globalCondition: (index: number) => string = organizationCondition
    ) => {
      values.push(value);
      const index = values.length;
      organizationConditions.push(organizationCondition(index));
      globalConditions.push(globalCondition(index));
    };
    if (query.action) add(query.action, (index) => `action = $${index}`);
    if (query.target) add(query.target, (index) => `target_type = $${index}`);
    if (query.targetReference) {
      add(query.targetReference, (index) => `target_reference_hash = decode($${index}, 'hex')`);
    }
    if (query.actor) {
      add(
        query.actor,
        (index) => `actor_user_id IS NOT NULL AND sha256(convert_to(actor_user_id::text, 'UTF8')) = decode($${index}, 'hex')`,
        (index) => `actor_reference_hash = decode($${index}, 'hex')`
      );
    }
    if (query.organization) {
      add(
        query.organization,
        (index) => `sha256(convert_to(organization_id::text, 'UTF8')) = decode($${index}, 'hex')`,
        () => "FALSE"
      );
    }
    values.push(query.limit + 1, query.offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;
    const result = await repositoryQuery<AuditLogRow>(
      this.queryable,
      `SELECT scope, entry_reference_hash, organization_reference_hash,
         actor_reference_hash, action, target_type, target_reference_hash,
         safe_metadata, outcome, created_at, completed_at
       FROM (
         SELECT 'organization'::TEXT AS scope,
           sha256(convert_to('organization:' || id::text, 'UTF8')) AS entry_reference_hash,
           sha256(convert_to(organization_id::text, 'UTF8')) AS organization_reference_hash,
           CASE WHEN actor_user_id IS NULL THEN NULL
             ELSE sha256(convert_to(actor_user_id::text, 'UTF8')) END AS actor_reference_hash,
           action, target_type, target_reference_hash, safe_metadata,
           NULL::TEXT AS outcome, created_at, NULL::TIMESTAMPTZ AS completed_at,
           id AS sort_id
         FROM audit_logs
         WHERE ${organizationConditions.join(" AND ")}
         UNION ALL
         SELECT 'global'::TEXT AS scope,
           sha256(convert_to('global:' || id::text, 'UTF8')) AS entry_reference_hash,
           NULL::BYTEA AS organization_reference_hash,
           actor_reference_hash, action, target_type, target_reference_hash,
           safe_metadata, outcome, created_at, completed_at, id AS sort_id
         FROM admin_audit_logs
         WHERE ${globalConditions.join(" AND ")}
       ) AS audit_entries
       ORDER BY created_at DESC, sort_id DESC, scope DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values
    );
    const nextOffset = query.offset + query.limit;
    const hasAdditionalRows = result.rows.length > query.limit;
    const hasMore = hasAdditionalRows && nextOffset <= MAX_OFFSET;
    const truncated = hasAdditionalRows && !hasMore;
    const candidate: AdminAuditLogListResponse = {
      logs: result.rows.slice(0, query.limit).map(publicEntry),
      page: {
        from: query.from,
        to: query.to,
        offset: query.offset,
        limit: query.limit,
        hasMore,
        truncated,
        ...(hasMore ? { nextOffset } : {})
      }
    };
    const response = parseAdminAuditLogListResponse(candidate);
    if (!response) throw new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
    return response;
  }

  async beginGlobalMutation(input: BeginGlobalAdminAuditMutationInput): Promise<GlobalAdminAuditMutation> {
    if (
      !["session", "token"].includes(input.actorMethod)
      || !isGlobalAdminAuditAction(input.action)
      || (input.actorMethod === "session" && !("actorSessionId" in input))
      || (input.actorMethod === "token" && "actorSessionId" in input)
    ) {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    const metadata = parseAdminAuditLogMetadata(input.action, input.metadata);
    if (!metadata) throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    const mutationId = crypto.randomUUID();
    await repositoryQuery(
      this.queryable,
      `INSERT INTO admin_audit_logs (
         id, actor_reference_hash, actor_method, action, target_type,
         target_reference_hash, outcome, safe_metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, 'started', $7::JSONB)`,
      [
        mutationId,
        input.actorMethod === "session"
          ? identifierHash(input.actorSessionId, "actorSessionId")
          : identifierHash(TOKEN_ACTOR_SENTINEL, "actorMethod"),
        input.actorMethod,
        input.action,
        adminAuditTargetType(input.action),
        identifierHash(input.targetIdentifier, "targetIdentifier"),
        JSON.stringify(metadata)
      ]
    );
    return Object.freeze({ mutationId });
  }

  async completeGlobalMutation(input: CompleteGlobalAdminAuditMutationInput): Promise<void> {
    if (input.outcome !== "succeeded" && input.outcome !== "failed") {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    const result = await repositoryQuery(
      this.queryable,
      `UPDATE admin_audit_logs
       SET outcome = $2, completed_at = NOW()
       WHERE id = $1 AND outcome = 'started'`,
      [requireUuid(input.mutationId, "mutationId"), input.outcome]
    );
    if (result.rowCount !== 1) throw new SafeDatabaseError("DATABASE_CONFLICT", false);
  }
}

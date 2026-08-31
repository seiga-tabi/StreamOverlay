export const ADMIN_AUDIT_LOG_SCOPES = ["organization", "global"] as const;
export type AdminAuditLogScope = typeof ADMIN_AUDIT_LOG_SCOPES[number];

export const ADMIN_AUDIT_LOG_OUTCOMES = ["started", "succeeded", "failed"] as const;
export type AdminAuditLogOutcome = typeof ADMIN_AUDIT_LOG_OUTCOMES[number];

export const GLOBAL_ADMIN_AUDIT_ACTOR_METHODS = ["session", "token"] as const;
export type GlobalAdminAuditActorMethod = typeof GLOBAL_ADMIN_AUDIT_ACTOR_METHODS[number];

export const ORGANIZATION_AUDIT_ACTIONS = [
  "discord.guild.connected",
  "organization.game_server.created",
  "organization.game_server.deleted",
  "discord.bot.settings.updated",
  "discord.bot.response_locale.updated"
] as const;
export type OrganizationAuditAction = typeof ORGANIZATION_AUDIT_ACTIONS[number];

export const GLOBAL_ADMIN_AUDIT_ACTIONS = [
  "streamer.riot_id_request.resolved",
  "streamer.dashboard_access.updated"
] as const;
export type GlobalAdminAuditAction = typeof GLOBAL_ADMIN_AUDIT_ACTIONS[number];

export const ADMIN_AUDIT_ACTIONS = [
  ...ORGANIZATION_AUDIT_ACTIONS,
  ...GLOBAL_ADMIN_AUDIT_ACTIONS
] as const;
export type AdminAuditAction = typeof ADMIN_AUDIT_ACTIONS[number];

export const ADMIN_AUDIT_TARGET_TYPES = [
  "discord_guild",
  "game_server",
  "discord_bot_control",
  "streamer_riot_id_request"
] as const;
export type AdminAuditTargetType = typeof ADMIN_AUDIT_TARGET_TYPES[number];

export type AdminAuditLogMetadataValue = string | number | boolean;

export type AdminAuditLogEntry = Readonly<{
  reference: string;
  scope: AdminAuditLogScope;
  organizationReference?: string;
  actorReference?: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetReference?: string;
  metadata: Readonly<Record<string, AdminAuditLogMetadataValue>>;
  outcome?: AdminAuditLogOutcome;
  createdAt: string;
  completedAt?: string;
}>;

export type AdminAuditLogListResponse = Readonly<{
  logs: readonly AdminAuditLogEntry[];
  page: Readonly<{
    from: string;
    to: string;
    offset: number;
    limit: number;
    hasMore: boolean;
    /** offset 상한 때문에 확인된 추가 기록을 다음 페이지로 제공할 수 없음을 나타냅니다. */
    truncated: boolean;
    nextOffset?: number;
  }>;
}>;

const ACTION_TARGET_TYPE: Readonly<Record<AdminAuditAction, AdminAuditTargetType>> = Object.freeze({
  "discord.guild.connected": "discord_guild",
  "organization.game_server.created": "game_server",
  "organization.game_server.deleted": "game_server",
  "discord.bot.settings.updated": "discord_bot_control",
  "discord.bot.response_locale.updated": "discord_bot_control",
  "streamer.riot_id_request.resolved": "streamer_riot_id_request",
  "streamer.dashboard_access.updated": "streamer_riot_id_request"
});

const ADMIN_AUDIT_ACTION_SET = new Set<string>(ADMIN_AUDIT_ACTIONS);
const ORGANIZATION_AUDIT_ACTION_SET = new Set<string>(ORGANIZATION_AUDIT_ACTIONS);
const GLOBAL_ADMIN_AUDIT_ACTION_SET = new Set<string>(GLOBAL_ADMIN_AUDIT_ACTIONS);
const ADMIN_AUDIT_TARGET_TYPE_SET = new Set<string>(ADMIN_AUDIT_TARGET_TYPES);
const ADMIN_AUDIT_LOG_OUTCOME_SET = new Set<string>(ADMIN_AUDIT_LOG_OUTCOMES);

function exactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => allowedKeys.includes(key)) ? record : undefined;
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function boundedNonBlankText(value: unknown, maximum: number): value is string {
  return boundedText(value, maximum) && value.trim().length > 0;
}

function canonicalTimestamp(value: unknown): value is string {
  if (!boundedText(value, 64)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function fixedHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function targetHash(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 64
    && value.length <= 256
    && value.length % 2 === 0
    && /^[a-f0-9]+$/u.test(value);
}

export function isAdminAuditAction(value: unknown): value is AdminAuditAction {
  return typeof value === "string" && ADMIN_AUDIT_ACTION_SET.has(value);
}

export function isOrganizationAuditAction(value: unknown): value is OrganizationAuditAction {
  return typeof value === "string" && ORGANIZATION_AUDIT_ACTION_SET.has(value);
}

export function isGlobalAdminAuditAction(value: unknown): value is GlobalAdminAuditAction {
  return typeof value === "string" && GLOBAL_ADMIN_AUDIT_ACTION_SET.has(value);
}

export function isAdminAuditTargetType(value: unknown): value is AdminAuditTargetType {
  return typeof value === "string" && ADMIN_AUDIT_TARGET_TYPE_SET.has(value);
}

export function adminAuditTargetType(action: AdminAuditAction): AdminAuditTargetType {
  return ACTION_TARGET_TYPE[action];
}

function metadataRecord(
  action: AdminAuditAction,
  value: unknown,
  exact: boolean
): Record<string, AdminAuditLogMetadataValue> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const allowedKeys = action === "discord.bot.settings.updated"
    ? ["revision"]
    : action === "discord.bot.response_locale.updated"
      ? ["revision", "preferredLocale", "source"]
      : action === "streamer.riot_id_request.resolved"
        ? ["decision", "noteProvided", "adminAccountLabel"]
        : action === "streamer.dashboard_access.updated"
          ? ["dashboardEnabled", "noteProvided"]
          : [];
  if (exact && !Object.keys(record).every((key) => allowedKeys.includes(key))) return undefined;

  const metadata: Record<string, AdminAuditLogMetadataValue> = {};
  if (action === "discord.bot.settings.updated" || action === "discord.bot.response_locale.updated") {
    const revisionValid = Number.isSafeInteger(record.revision) && (record.revision as number) >= 0;
    if (exact && record.revision !== undefined && !revisionValid) return undefined;
    if (revisionValid) metadata.revision = record.revision as number;
  }
  if (action === "discord.bot.response_locale.updated") {
    const localeValid = ["auto", "ko", "ja", "en"].includes(record.preferredLocale as string);
    if (exact && record.preferredLocale !== undefined && !localeValid) return undefined;
    if (localeValid) {
      metadata.preferredLocale = record.preferredLocale as string;
    }
    if (exact && record.source !== undefined && record.source !== "discord_command") return undefined;
    if (record.source === "discord_command") metadata.source = record.source;
  }
  if (action === "streamer.riot_id_request.resolved") {
    if (record.decision !== "approved" && record.decision !== "rejected") return undefined;
    if (typeof record.noteProvided !== "boolean") return undefined;
    metadata.decision = record.decision;
    metadata.noteProvided = record.noteProvided;
    if (record.adminAccountLabel !== undefined) {
      if (!boundedNonBlankText(record.adminAccountLabel, 100)) return undefined;
      metadata.adminAccountLabel = record.adminAccountLabel;
    }
  }
  if (action === "streamer.dashboard_access.updated") {
    if (typeof record.dashboardEnabled !== "boolean" || typeof record.noteProvided !== "boolean") {
      return undefined;
    }
    metadata.dashboardEnabled = record.dashboardEnabled;
    metadata.noteProvided = record.noteProvided;
  }
  return metadata;
}

/** DB의 safe_metadata에서 action별 공개 허용 필드만 새 객체로 복사합니다. */
export function sanitizeAdminAuditLogMetadata(
  action: AdminAuditAction,
  value: unknown
): Record<string, AdminAuditLogMetadataValue> | undefined {
  return metadataRecord(action, value, false);
}

/** API 또는 write 입력 metadata가 허용된 키만 정확히 포함하는지 검증합니다. */
export function parseAdminAuditLogMetadata(
  action: AdminAuditAction,
  value: unknown
): Record<string, AdminAuditLogMetadataValue> | undefined {
  return metadataRecord(action, value, true);
}

function parseEntry(value: unknown): AdminAuditLogEntry | undefined {
  const record = exactRecord(value, [
    "reference",
    "scope",
    "organizationReference",
    "actorReference",
    "action",
    "targetType",
    "targetReference",
    "metadata",
    "outcome",
    "createdAt",
    "completedAt"
  ]);
  if (
    !record
    || !fixedHash(record.reference)
    || !ADMIN_AUDIT_LOG_SCOPES.includes(record.scope as AdminAuditLogScope)
    || (record.organizationReference !== undefined && !fixedHash(record.organizationReference))
    || (record.actorReference !== undefined && !fixedHash(record.actorReference))
    || !isAdminAuditAction(record.action)
    || !isAdminAuditTargetType(record.targetType)
    || adminAuditTargetType(record.action) !== record.targetType
    || (record.targetReference !== undefined && !targetHash(record.targetReference))
    || (record.outcome !== undefined && !ADMIN_AUDIT_LOG_OUTCOME_SET.has(record.outcome as string))
    || !canonicalTimestamp(record.createdAt)
    || (record.completedAt !== undefined && !canonicalTimestamp(record.completedAt))
  ) return undefined;
  const metadata = parseAdminAuditLogMetadata(record.action, record.metadata);
  if (!metadata) return undefined;

  if (record.scope === "organization") {
    if (
      !isOrganizationAuditAction(record.action)
      || record.organizationReference === undefined
      || record.outcome !== undefined
      || record.completedAt !== undefined
    ) return undefined;
  } else if (
    !isGlobalAdminAuditAction(record.action)
    || record.organizationReference !== undefined
    || record.actorReference === undefined
    || !fixedHash(record.targetReference)
    || record.outcome === undefined
    || (record.outcome === "started" && record.completedAt !== undefined)
    || (record.outcome !== "started" && record.completedAt === undefined)
    || (
      record.completedAt !== undefined
      && Date.parse(record.completedAt as string) < Date.parse(record.createdAt as string)
    )
  ) return undefined;

  return {
    reference: record.reference,
    scope: record.scope as AdminAuditLogScope,
    ...(record.organizationReference === undefined
      ? {}
      : { organizationReference: record.organizationReference as string }),
    ...(record.actorReference === undefined ? {} : { actorReference: record.actorReference as string }),
    action: record.action,
    targetType: record.targetType,
    ...(record.targetReference === undefined ? {} : { targetReference: record.targetReference as string }),
    metadata,
    ...(record.outcome === undefined ? {} : { outcome: record.outcome as AdminAuditLogOutcome }),
    createdAt: record.createdAt as string,
    ...(record.completedAt === undefined ? {} : { completedAt: record.completedAt as string })
  };
}

/** 관리자 감사 로그 응답에서 식별자 원문·임의 metadata가 섞이는 것을 막습니다. */
export function parseAdminAuditLogListResponse(value: unknown): AdminAuditLogListResponse | undefined {
  const record = exactRecord(value, ["logs", "page"]);
  const page = record
    ? exactRecord(record.page, ["from", "to", "offset", "limit", "hasMore", "truncated", "nextOffset"])
    : undefined;
  if (
    !record
    || !Array.isArray(record.logs)
    || !page
    || !canonicalTimestamp(page.from)
    || !canonicalTimestamp(page.to)
    || Date.parse(page.from) > Date.parse(page.to)
    || !Number.isSafeInteger(page.offset)
    || (page.offset as number) < 0
    || (page.offset as number) > 10_000
    || !Number.isSafeInteger(page.limit)
    || (page.limit as number) < 1
    || (page.limit as number) > 100
    || record.logs.length > (page.limit as number)
    || typeof page.hasMore !== "boolean"
    || typeof page.truncated !== "boolean"
    || (page.nextOffset !== undefined && (
      !Number.isSafeInteger(page.nextOffset)
      || (page.nextOffset as number) < 0
      || (page.nextOffset as number) > 10_000
    ))
    || (page.hasMore && (
      record.logs.length !== page.limit
      || page.truncated
      || page.nextOffset !== (page.offset as number) + (page.limit as number)
    ))
    || (page.truncated && (
      page.hasMore
      || record.logs.length !== page.limit
      || page.nextOffset !== undefined
      || (page.offset as number) + (page.limit as number) <= 10_000
    ))
    || (!page.hasMore && page.nextOffset !== undefined)
  ) return undefined;
  const logs = record.logs.map(parseEntry);
  if (logs.some((entry) => !entry)) return undefined;
  return {
    logs: logs as AdminAuditLogEntry[],
    page: {
      from: page.from as string,
      to: page.to as string,
      offset: page.offset as number,
      limit: page.limit as number,
      hasMore: page.hasMore,
      truncated: page.truncated,
      ...(page.nextOffset === undefined ? {} : { nextOffset: page.nextOffset as number })
    }
  };
}

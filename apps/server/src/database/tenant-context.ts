import { SafeDatabaseError } from "./errors.js";

export type TenantContext = Readonly<{
  organizationId: string;
  actorUserId?: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireUuid(value: string, fieldName: string): string {
  const normalized = value.trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new SafeDatabaseError(
      "DATABASE_INVALID_INPUT",
      false,
      `${fieldName} 형식이 올바르지 않습니다.`
    );
  }
  return normalized;
}

export function createTenantContext(input: {
  organizationId: string;
  actorUserId?: string;
}): TenantContext {
  const organizationId = requireUuid(input.organizationId, "organizationId");
  const actorUserId = input.actorUserId === undefined
    ? undefined
    : requireUuid(input.actorUserId, "actorUserId");
  return Object.freeze({
    organizationId,
    ...(actorUserId === undefined ? {} : { actorUserId })
  });
}

import type { Pool, PoolClient } from "pg";
import { SafeDatabaseError, toSafeDatabaseError } from "../errors.js";

export type RepositoryQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function repositoryQuery<T extends Record<string, unknown>>(
  queryable: RepositoryQueryable,
  text: string,
  values: unknown[]
) {
  try {
    return await queryable.query<T>(text, values);
  } catch (error) {
    throw toSafeDatabaseError(error);
  }
}

export function requireBoundedText(
  value: string,
  field: string,
  maximum: number
): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new SafeDatabaseError(
      "DATABASE_INVALID_INPUT",
      false,
      `${field} 값이 올바르지 않습니다.`
    );
  }
  return normalized;
}

export type DatabaseErrorCode =
  | "DATABASE_DISABLED"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_CONFLICT"
  | "DATABASE_REFERENCE_INVALID"
  | "DATABASE_INVALID_INPUT"
  | "DATABASE_MIGRATION_PENDING"
  | "DATABASE_MIGRATION_MISMATCH"
  | "DATABASE_MIGRATION_LOCKED"
  | "DATABASE_INTERNAL_ERROR";

export class SafeDatabaseError extends Error {
  constructor(
    readonly code: DatabaseErrorCode,
    readonly retryable: boolean,
    message = "Database 작업에 실패했습니다."
  ) {
    super(message);
    this.name = "SafeDatabaseError";
  }
}

type PostgreSqlErrorShape = {
  code?: unknown;
};

export function toSafeDatabaseError(error: unknown): SafeDatabaseError {
  if (error instanceof SafeDatabaseError) return error;
  const code = typeof error === "object" && error !== null
    ? (error as PostgreSqlErrorShape).code
    : undefined;
  if (code === "23505") return new SafeDatabaseError("DATABASE_CONFLICT", false);
  if (code === "23503" || code === "23514") {
    return new SafeDatabaseError("DATABASE_REFERENCE_INVALID", false);
  }
  if (
    code === "ECONNREFUSED"
    || code === "ECONNRESET"
    || code === "ETIMEDOUT"
    || (typeof code === "string" && code.startsWith("08"))
    || code === "40001"
    || code === "40P01"
    || code === "53300"
    || code === "57P01"
    || code === "57P02"
    || code === "57P03"
  ) {
    return new SafeDatabaseError("DATABASE_UNAVAILABLE", true);
  }
  return new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
}

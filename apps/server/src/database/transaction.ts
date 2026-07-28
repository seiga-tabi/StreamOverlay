import { AsyncLocalStorage } from "node:async_hooks";
import type { Pool, PoolClient } from "pg";
import { appConfig } from "../config.js";
import { SafeDatabaseError, toSafeDatabaseError } from "./errors.js";

const transactionScope = new AsyncLocalStorage<boolean>();

export async function withTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  if (transactionScope.getStore()) {
    throw new SafeDatabaseError(
      "DATABASE_INVALID_INPUT",
      false,
      "중첩 transaction은 허용되지 않습니다."
    );
  }
  const client = await pool.connect().catch((error: unknown) => {
    throw toSafeDatabaseError(error);
  });
  let began = false;
  try {
    await client.query("BEGIN");
    began = true;
    await client.query(
      "SELECT set_config('statement_timeout', $1, true)",
      [String(appConfig.database.statementTimeoutMs)]
    );
    const result = await transactionScope.run(true, () => callback(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // rollback 오류가 원래 안전 오류를 덮지 않게 합니다.
      }
    }
    throw toSafeDatabaseError(error);
  } finally {
    client.release();
  }
}

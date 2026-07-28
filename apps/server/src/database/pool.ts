import { Pool, type PoolConfig } from "pg";
import { appConfig } from "../config.js";
import { SafeDatabaseError } from "./errors.js";

let singletonPool: Pool | undefined;

function sslConfig(): PoolConfig["ssl"] {
  if (appConfig.database.sslMode === "disable") return false;
  return { rejectUnauthorized: true };
}

export function databasePool(): Pool | undefined {
  if (!appConfig.database.enabled) return undefined;
  if (singletonPool) return singletonPool;
  if (!appConfig.database.url) {
    throw new SafeDatabaseError("DATABASE_UNAVAILABLE", false);
  }
  singletonPool = new Pool({
    connectionString: appConfig.database.url,
    max: appConfig.database.poolMax,
    idleTimeoutMillis: appConfig.database.idleTimeoutMs,
    connectionTimeoutMillis: appConfig.database.connectionTimeoutMs,
    statement_timeout: appConfig.database.statementTimeoutMs,
    query_timeout: appConfig.database.statementTimeoutMs,
    application_name: "yoro-streamops-server",
    ssl: sslConfig(),
    allowExitOnIdle: false
  });
  singletonPool.on("error", () => {
    // Pool의 idle client 오류에는 credential·host·SQL이 포함될 수 있으므로 여기서 출력하지 않습니다.
  });
  return singletonPool;
}

export async function closeDatabasePool(): Promise<void> {
  const pool = singletonPool;
  singletonPool = undefined;
  if (pool) await pool.end();
}

export function resetDatabasePoolForTests(): void {
  singletonPool = undefined;
}

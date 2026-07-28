import type { Pool } from "pg";
import type { MigrationManifest } from "./migration-manifest.js";
import { inspectMigrationState } from "./migration-runner.js";

export type DatabaseHealthState =
  | "disabled"
  | "connecting"
  | "ready"
  | "migration_pending"
  | "migration_mismatch"
  | "unavailable";

export type DatabaseHealthSnapshot = Readonly<{
  enabled: boolean;
  ready: boolean;
  state: DatabaseHealthState;
  errorCode?: "DATABASE_UNAVAILABLE" | "DATABASE_MIGRATION_PENDING" | "DATABASE_MIGRATION_MISMATCH";
  checkedAt?: string;
}>;

export class DatabaseHealthMonitor {
  private snapshotValue: DatabaseHealthSnapshot;
  private timer: NodeJS.Timeout | undefined;
  private checking: Promise<void> | undefined;

  constructor(
    private readonly enabled: boolean,
    private readonly pool: Pool | undefined,
    private readonly manifest: MigrationManifest | undefined,
    private readonly intervalMs = 10_000
  ) {
    this.snapshotValue = enabled
      ? { enabled: true, ready: false, state: "connecting" }
      : { enabled: false, ready: true, state: "disabled" };
  }

  snapshot(): DatabaseHealthSnapshot {
    return this.snapshotValue;
  }

  async checkNow(): Promise<void> {
    if (!this.enabled) return;
    if (this.checking) return this.checking;
    this.checking = this.performCheck().finally(() => {
      this.checking = undefined;
    });
    return this.checking;
  }

  start(): void {
    if (!this.enabled || this.timer) return;
    void this.checkNow();
    this.timer = setInterval(() => void this.checkNow(), this.intervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async performCheck(): Promise<void> {
    if (!this.pool) {
      this.snapshotValue = {
        enabled: true,
        ready: false,
        state: "unavailable",
        errorCode: "DATABASE_UNAVAILABLE",
        checkedAt: new Date().toISOString()
      };
      return;
    }
    if (!this.manifest) {
      this.snapshotValue = {
        enabled: true,
        ready: false,
        state: "migration_mismatch",
        errorCode: "DATABASE_MIGRATION_MISMATCH",
        checkedAt: new Date().toISOString()
      };
      return;
    }
    try {
      const state = await inspectMigrationState(this.pool, this.manifest);
      const checkedAt = new Date().toISOString();
      if (state.status === "ready") {
        this.snapshotValue = { enabled: true, ready: true, state: "ready", checkedAt };
      } else if (state.status === "pending") {
        this.snapshotValue = {
          enabled: true,
          ready: false,
          state: "migration_pending",
          errorCode: "DATABASE_MIGRATION_PENDING",
          checkedAt
        };
      } else {
        this.snapshotValue = {
          enabled: true,
          ready: false,
          state: "migration_mismatch",
          errorCode: "DATABASE_MIGRATION_MISMATCH",
          checkedAt
        };
      }
    } catch {
      this.snapshotValue = {
        enabled: true,
        ready: false,
        state: "unavailable",
        errorCode: "DATABASE_UNAVAILABLE",
        checkedAt: new Date().toISOString()
      };
    }
  }
}

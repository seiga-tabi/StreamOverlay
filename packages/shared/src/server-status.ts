import type { BotStatus } from "./events.js";

export type DashboardServerStatus = {
  collectedAt: string;
  status: "ready" | "degraded" | "shutting_down";
  uptimeSeconds: number;
  startedAt: string;
  build: {
    version: string;
    gitSha: string;
    builtAt: string;
  };
  runtime: {
    nodeEnv: string;
    nodeVersion: string;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
  };
  readiness: {
    ok: boolean;
    checks: Record<string, boolean>;
    errors: string[];
  };
  connections: {
    http: number;
    dashboardWebSocket: number;
    overlayWebSocket: number;
    bridge: boolean;
  };
  services: BotStatus;
};

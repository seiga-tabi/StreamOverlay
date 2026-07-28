import http, { type Server } from "node:http";

export type DiscordBotState =
  | "disabled"
  | "starting"
  | "connecting"
  | "ready"
  | "resuming"
  | "degraded"
  | "rate_limited"
  | "stopping"
  | "unavailable";

export class DiscordBotHealth {
  private state: DiscordBotState = "starting";
  private gatewayConnected = false;
  private lastHeartbeatAckAt?: string;
  private reconnectCount = 0;

  setState(state: DiscordBotState): void {
    this.state = state;
    this.gatewayConnected = state === "ready" || state === "degraded";
  }

  heartbeatObserved(): void {
    this.lastHeartbeatAckAt = new Date().toISOString();
  }

  reconnected(): void {
    this.reconnectCount += 1;
  }

  snapshot(release: { version: string; gitSha: string; builtAt: string }) {
    return Object.freeze({
      state: this.state,
      gatewayConnected: this.gatewayConnected,
      ...(this.lastHeartbeatAckAt ? { lastHeartbeatAckAt: this.lastHeartbeatAckAt } : {}),
      reconnectCount: this.reconnectCount,
      release
    });
  }

  live(): boolean {
    return this.state !== "stopping";
  }

  ready(): boolean {
    return this.state === "ready" || this.state === "degraded";
  }
}

export function startHealthServer(input: {
  health: DiscordBotHealth;
  port: number;
  release: { version: string; gitSha: string; builtAt: string };
}): Promise<Server> {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    const live = pathname === "/health/live";
    const ready = pathname === "/health/ready";
    if (req.method !== "GET" || (!live && !ready)) {
      res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end('{"error":"not found"}');
      return;
    }
    const ok = live ? input.health.live() : input.health.ready();
    res.writeHead(ok ? 200 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(JSON.stringify(input.health.snapshot(input.release)));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, "0.0.0.0", () => resolve(server));
  });
}

import http from "node:http";

export type AgentHealthState =
  | "disabled"
  | "starting"
  | "registration_required"
  | "registering"
  | "ready"
  | "collecting"
  | "sending"
  | "degraded"
  | "credential_expiring"
  | "credential_rejected"
  | "palworld_unavailable"
  | "stopping";

export type AgentHealthSnapshot = Readonly<{
  state: AgentHealthState;
  ready: boolean;
  lastCollectedAt?: string;
  lastSentAt?: string;
  consecutiveFailures: number;
  errorCode?: string;
  version: string;
}>;

export class AgentHealth {
  private state: AgentHealthState = "starting";
  private ready = false;
  private lastCollectedAt?: string;
  private lastSentAt?: string;
  private consecutiveFailures = 0;
  private errorCode?: string;

  constructor(private readonly version: string) {}

  update(input: Readonly<{
    state: AgentHealthState;
    ready?: boolean;
    collectedAt?: string;
    sentAt?: string;
    failure?: boolean;
    resetFailures?: boolean;
    errorCode?: string;
  }>): void {
    this.state = input.state;
    if (input.ready !== undefined) this.ready = input.ready;
    if (input.collectedAt !== undefined) this.lastCollectedAt = input.collectedAt;
    if (input.sentAt !== undefined) this.lastSentAt = input.sentAt;
    if (input.failure) this.consecutiveFailures += 1;
    if (input.resetFailures) this.consecutiveFailures = 0;
    this.errorCode = input.errorCode;
  }

  snapshot(): AgentHealthSnapshot {
    return Object.freeze({
      state: this.state,
      ready: this.ready,
      ...(this.lastCollectedAt ? { lastCollectedAt: this.lastCollectedAt } : {}),
      ...(this.lastSentAt ? { lastSentAt: this.lastSentAt } : {}),
      consecutiveFailures: this.consecutiveFailures,
      ...(this.errorCode ? { errorCode: this.errorCode } : {}),
      version: this.version
    });
  }
}

export class AgentHealthServer {
  private server?: http.Server;

  constructor(
    private readonly health: AgentHealth,
    private readonly host: "127.0.0.1" | "::1",
    private readonly port: number
  ) {}

  async start(): Promise<number> {
    if (this.server) throw new Error("health_server_already_started");
    this.server = http.createServer((request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      if (request.method !== "GET") {
        response.writeHead(405).end(JSON.stringify({ error: "method_not_allowed" }));
        return;
      }
      if (request.url === "/health/live") {
        response.writeHead(200).end(JSON.stringify({ live: true }));
        return;
      }
      if (request.url === "/health/ready") {
        const snapshot = this.health.snapshot();
        response.writeHead(snapshot.ready ? 200 : 503).end(JSON.stringify(snapshot));
        return;
      }
      response.writeHead(404).end(JSON.stringify({ error: "not_found" }));
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.port, this.host, () => {
        this.server?.off("error", reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("health_address_unavailable");
    return address.port;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

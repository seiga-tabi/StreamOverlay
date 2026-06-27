import type WebSocket from "ws";
import type { DashboardRole } from "../security/auth.js";
import type { Store } from "./store.js";

export class DashboardHub {
  private readonly clients = new Map<WebSocket, DashboardRole>();
  private broadcastTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly store: Store) {}

  add(client: WebSocket, role: DashboardRole = "admin"): void {
    this.clients.set(client, role);
    client.on("close", () => this.clients.delete(client));
    this.sendSnapshot(client);
  }

  sendSnapshot(client: WebSocket): void {
    this.sendPayload(client, this.snapshotPayload(this.clients.get(client) ?? "admin"));
  }

  broadcastSnapshot(): void {
    if (this.clients.size === 0 || this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = undefined;
      if (this.clients.size === 0) return;
      const adminPayload = this.snapshotPayload("admin");
      const streamerPayload = this.snapshotPayload("streamer");
      for (const [client, role] of this.clients) {
        this.sendPayload(client, role === "admin" ? adminPayload : streamerPayload);
      }
    }, 100);
  }

  count(): number {
    return this.clients.size;
  }

  private snapshotPayload(role: DashboardRole): string {
    const payload = {
      type: "dashboard.snapshot",
      status: this.store.getStatus(),
      events: this.store.recentEvents(20),
      actions: this.store.recentActions(20),
      overlay: this.store.getOverlayStatus(),
      questions: this.store.getQuestions(),
      participationQueue: this.store.getParticipationQueue(),
      participationState: this.store.getParticipationState()
    };
    return JSON.stringify(role === "admin"
      ? { ...payload, streamerRiotIdRequests: this.store.listStreamerRiotIdRequests() }
      : payload);
  }

  private sendPayload(client: WebSocket, payload: string): void {
    if (client.readyState !== client.OPEN) return;
    try {
      client.send(payload);
    } catch {
      this.clients.delete(client);
    }
  }
}

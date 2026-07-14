import type WebSocket from "ws";
import type { DashboardRole } from "../security/auth.js";
import type { Store } from "./store.js";

type DashboardClientContext = {
  role: DashboardRole;
  twitchUserId?: string;
};

export class DashboardHub {
  private readonly clients = new Map<WebSocket, DashboardClientContext>();
  private broadcastTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly store: Store) {}

  add(client: WebSocket, context: DashboardRole | DashboardClientContext = "admin"): void {
    this.clients.set(client, typeof context === "string" ? { role: context } : context);
    client.on("close", () => this.clients.delete(client));
    this.sendSnapshot(client);
  }

  sendSnapshot(client: WebSocket): void {
    this.sendPayload(client, this.snapshotPayload(this.clients.get(client) ?? { role: "admin" }));
  }

  broadcastSnapshot(): void {
    if (this.clients.size === 0 || this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = undefined;
      if (this.clients.size === 0) return;
      const adminPayload = this.snapshotPayload({ role: "admin" });
      for (const [client, context] of this.clients) {
        this.sendPayload(client, context.role === "admin" ? adminPayload : this.snapshotPayload(context));
      }
    }, 100);
  }

  count(): number {
    return this.clients.size;
  }

  private snapshotPayload(context: DashboardClientContext): string {
    const streamerId = context.role === "streamer" ? context.twitchUserId : undefined;
    const participationState = this.store.getParticipationState(streamerId);
    const payload = {
      type: "dashboard.snapshot",
      status: streamerId
        ? { ...this.store.getStatus(), participation: participationState.isOpen ? "open" : "closed" }
        : this.store.getStatus(),
      events: this.store.recentEvents(20),
      actions: this.store.recentActions(20),
      overlay: this.store.getOverlayStatus(),
      questions: this.store.getQuestions(),
      participationQueue: this.store.getParticipationQueue(streamerId),
      participationState
    };
    return JSON.stringify(context.role === "admin"
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

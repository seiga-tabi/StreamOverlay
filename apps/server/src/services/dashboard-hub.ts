import type WebSocket from "ws";
import type { Store } from "./store.js";

export class DashboardHub {
  private readonly clients = new Set<WebSocket>();
  private broadcastTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly store: Store) {}

  add(client: WebSocket): void {
    this.clients.add(client);
    client.on("close", () => this.clients.delete(client));
    this.sendSnapshot(client);
  }

  sendSnapshot(client: WebSocket): void {
    this.sendPayload(client, this.snapshotPayload());
  }

  broadcastSnapshot(): void {
    if (this.clients.size === 0 || this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => {
      this.broadcastTimer = undefined;
      if (this.clients.size === 0) return;
      const payload = this.snapshotPayload();
      for (const client of this.clients) this.sendPayload(client, payload);
    }, 100);
  }

  count(): number {
    return this.clients.size;
  }

  private snapshotPayload(): string {
    return JSON.stringify({
      type: "dashboard.snapshot",
      status: this.store.getStatus(),
      events: this.store.recentEvents(20),
      actions: this.store.recentActions(20),
      overlay: this.store.getOverlayStatus(),
      questions: this.store.getQuestions(),
      participationQueue: this.store.getParticipationQueue(),
      participationState: this.store.getParticipationState()
    });
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

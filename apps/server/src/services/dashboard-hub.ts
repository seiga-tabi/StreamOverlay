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

  disconnectStreamer(twitchUserId: string): number {
    const normalizedTwitchUserId = twitchUserId.trim();
    if (!normalizedTwitchUserId) return 0;
    let disconnected = 0;
    for (const [client, context] of this.clients) {
      if (context.role !== "streamer" || context.twitchUserId !== normalizedTwitchUserId) continue;
      this.clients.delete(client);
      disconnected += 1;
      try {
        client.close(1008, "스트리머 대시보드 권한이 해제되었습니다.");
      } catch {
        // close 실패 여부와 관계없이 권한이 해제된 client는 hub에서 즉시 제거한다.
      }
    }
    return disconnected;
  }

  private snapshotPayload(context: DashboardClientContext): string {
    const streamerId = context.role === "streamer" ? context.twitchUserId : undefined;
    const participationState = this.store.getParticipationState(streamerId);
    const status = this.store.getStatus();
    const overlayStatus = this.store.getOverlayStatus();
    const streamerEvents = streamerId
      ? this.store.recentEvents(200).filter((event) =>
        event.type === "participation.entryCreated" && event.streamerId === streamerId
      ).slice(0, 20)
      : this.store.recentEvents(20);
    const payload = {
      type: "dashboard.snapshot",
      status: streamerId
        ? {
            server: status.server,
            twitch: "disabled",
            stream: "unknown",
            bridge: "disconnected",
            obs: "unknown",
            participation: participationState.isOpen ? "open" : "closed"
          }
        : status,
      events: streamerEvents,
      actions: streamerId ? [] : this.store.recentActions(20),
      overlay: streamerId
        ? {
            clientCount: 0,
            clientsByChannel: Object.fromEntries(Object.keys(overlayStatus.clientsByChannel).map((channel) => [channel, 0])),
            recentMessages: []
          }
        : overlayStatus,
      questions: streamerId ? [] : this.store.getQuestions(),
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

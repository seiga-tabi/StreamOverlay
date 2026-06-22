import type WebSocket from "ws";
import type { OverlayChannel, OverlayMessage } from "@streamops/shared";
import {
  OVERLAY_CHANNELS,
  newId,
  normalizeOverlayChannel,
  nowIso,
  overlayChannelForMessage,
  overlayMessageMatchesChannel,
  validateOverlayMessage
} from "@streamops/shared";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "./store.js";

type OverlayClient = {
  socket: WebSocket;
  channel: OverlayChannel;
};

type RetainedOverlayMessage = {
  message: OverlayMessage;
  channel: OverlayChannel;
  expiresAt?: number;
};

export class OverlayHub {
  private readonly clients = new Map<WebSocket, OverlayClient>();
  private readonly retainedMessages = new Map<string, RetainedOverlayMessage>();

  constructor(
    private readonly logger: JsonlLogger,
    private readonly store: Store,
    private readonly onStatusChange?: () => void
  ) {
    this.patchClientStatus();
  }

  add(client: WebSocket, channelInput?: string | null): void {
    const channel = normalizeOverlayChannel(channelInput);
    this.clients.set(client, { socket: client, channel });
    client.on("close", () => {
      this.clients.delete(client);
      this.patchClientStatus();
    });
    this.patchClientStatus();
    this.sendRetainedMessages(client, channel);
  }

  broadcast(message: OverlayMessage): boolean {
    const validation = validateOverlayMessage(message);
    if (!validation.ok) {
      this.logger.error({ type: "overlay.message_invalid", error: validation.error, messageType: (message as { type?: unknown })?.type });
      return false;
    }

    const channel = overlayChannelForMessage(message);
    this.rememberMessage(message, channel);
    this.store.addOverlayMessageLog({
      id: newId("overlay_msg"),
      type: message.type,
      channel,
      source: message.source,
      variant: message.variant,
      messagePreview: this.previewMessage(message),
      createdAt: nowIso()
    });
    this.logger.event({ type: "overlay.message", messageType: message.type, channel, source: message.source, variant: message.variant });

    const payload = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.socket.readyState === client.socket.OPEN && overlayMessageMatchesChannel(message, client.channel)) {
        this.sendToClient(client, payload);
      }
    }
    this.onStatusChange?.();
    return true;
  }

  count(): number {
    return this.clients.size;
  }

  countByChannel(): Record<OverlayChannel, number> {
    const counts = Object.fromEntries(OVERLAY_CHANNELS.map((channel) => [channel, 0])) as Record<OverlayChannel, number>;
    for (const client of this.clients.values()) counts[client.channel] += 1;
    return counts;
  }

  private sendRetainedMessages(client: WebSocket, channel: OverlayChannel): void {
    this.pruneExpiredRetainedMessages();
    for (const retained of this.retainedMessages.values()) {
      if (client.readyState === client.OPEN && overlayMessageMatchesChannel(retained.message, channel)) {
        this.sendToClient({ socket: client, channel }, JSON.stringify(retained.message));
      }
    }
  }

  private sendToClient(client: OverlayClient, payload: string): void {
    try {
      client.socket.send(payload);
    } catch (error) {
      this.clients.delete(client.socket);
      this.logger.error({ type: "overlay.client_send_failed", channel: client.channel, error: error instanceof Error ? error.message : String(error) });
      this.patchClientStatus();
    }
  }

  private rememberMessage(message: OverlayMessage, channel: OverlayChannel): void {
    this.pruneExpiredRetainedMessages();
    if (message.type.endsWith(".clear")) {
      this.retainedMessages.delete(this.retainedKeyForClear(message.type));
      return;
    }

    const ttlMs = this.retainTtlMs(message);
    this.retainedMessages.set(message.type, {
      message,
      channel,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined
    });
  }

  private retainedKeyForClear(type: OverlayMessage["type"]): string {
    if (type === "question.clear") return "question.show";
    if (type === "chat.clear") return "chat.message.add";
    if (type === "participation.selected.clear") return "participation.selected.show";
    if (type === "emergency.clear") return "emergency.show";
    return type;
  }

  private retainTtlMs(message: OverlayMessage): number | undefined {
    if (message.durationMs) return message.durationMs;
    if (message.type === "overlay.banner") return 4000;
    if (message.type === "subtitle.update" && message.isFinal) return 8000;
    if (message.type === "subtitle.boost") return 7000;
    if (message.type === "question.show") return 12_000;
    if (message.type === "participation.selected.show") return message.checkInSeconds * 1000;
    return undefined;
  }

  private pruneExpiredRetainedMessages(): void {
    const now = Date.now();
    for (const [key, retained] of this.retainedMessages) {
      if (retained.expiresAt && retained.expiresAt <= now) this.retainedMessages.delete(key);
    }
  }

  private patchClientStatus(): void {
    this.store.patchOverlayClients(this.countByChannel());
    this.onStatusChange?.();
  }

  private previewMessage(message: OverlayMessage): string | undefined {
    if ("message" in message && typeof message.message === "string") return message.message.slice(0, 120);
    if (message.type === "subtitle.update") return message.translated.slice(0, 120);
    if (message.type === "question.show") return message.question.slice(0, 120);
    if (message.type === "chat.message.add") return `${message.userName}: ${message.message}`.slice(0, 120);
    if (message.type === "mission.update") return `${message.missions.length}개 미션`;
    if (message.type === "participation.queue.update") return `${message.queue.length}명 대기`;
    if (message.type === "participation.selected.show") return message.twitchUserName;
    if (message.type === "participation.status.update") return message.message;
    if (message.type === "participation.teams.update") return `A ${message.teams.a.length}명 / B ${message.teams.b.length}명`;
    return undefined;
  }
}

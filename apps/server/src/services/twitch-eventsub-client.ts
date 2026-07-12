import WebSocket from "ws";
import type { InternalEvent, TwitchChatMessageFragment, TwitchEventSubSubscriptionStatus } from "@streamops/shared";
import { newId, nowIso, toSafeErrorMessage } from "@streamops/shared";
import type { EventBus } from "../core/event-bus.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import { appConfig } from "../config.js";
import type { Store } from "./store.js";
import type { TwitchApiClient } from "./twitch-api.js";
import {
  getEventSubDefinition,
  getMissingScopesForEventSubDefinition,
  type EventSubSubscriptionDefinition
} from "./twitch-eventsub-subscriptions.js";

type EventSubSocket = {
  readonly OPEN: number;
  readyState: number;
  on(event: "open" | "message" | "close" | "error", listener: (...args: any[]) => void): EventSubSocket;
  close(): void;
};

type WebSocketFactory = (url: string) => EventSubSocket;

export type TwitchEventSubClientOptions = {
  webSocketFactory?: WebSocketFactory;
  reconnectDelayMs?: number;
  subscriptions?: string[];
};

type EventSubPayload = {
  metadata?: {
    message_id?: string;
    message_type?: string;
    message_timestamp?: string;
    subscription_type?: string;
  };
  payload?: {
    session?: {
      id?: string;
      reconnect_url?: string | null;
    };
    subscription?: {
      type?: string;
      status?: string;
    };
    event?: Record<string, any>;
  };
};

const DEFAULT_EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const TWITCH_EMOTE_ID_PATTERN = /^[A-Za-z0-9_]+$/;
const TWITCH_EMOTE_SET_ID_PATTERN = /^[A-Za-z0-9_]+$/;

function parseChatFragments(value: unknown): TwitchChatMessageFragment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fragments: TwitchChatMessageFragment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const fragment = item as Record<string, any>;
    const text = typeof fragment.text === "string" ? fragment.text : "";
    if (fragment.type === "emote") {
      const id = typeof fragment.emote?.id === "string" ? fragment.emote.id : "";
      if (TWITCH_EMOTE_ID_PATTERN.test(id)) {
        const emoteSetId = typeof fragment.emote?.emote_set_id === "string" && TWITCH_EMOTE_SET_ID_PATTERN.test(fragment.emote.emote_set_id)
          ? fragment.emote.emote_set_id
          : undefined;
        fragments.push({ type: "emote", id, text: text || id, ...(emoteSetId ? { emoteSetId } : {}) });
        continue;
      }
    }
    if (text) fragments.push({ type: "text", text });
  }
  return fragments.length > 0 ? fragments : undefined;
}

export class TwitchEventSubClient {
  private socket?: EventSubSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectingSocket?: EventSubSocket;
  private readonly suppressedCloseSockets = new WeakSet<EventSubSocket>();
  private readonly webSocketFactory: WebSocketFactory;
  private readonly reconnectDelayMs: number;
  private readonly subscriptions: string[];
  private stopped = false;

  constructor(
    private readonly events: EventBus,
    private readonly twitch: TwitchApiClient,
    private readonly store: Store,
    private readonly logger: JsonlLogger,
    options: TwitchEventSubClientOptions = {}
  ) {
    this.webSocketFactory = options.webSocketFactory ?? ((url) => new WebSocket(url));
    this.reconnectDelayMs = options.reconnectDelayMs ?? 5000;
    this.subscriptions = options.subscriptions ?? appConfig.twitch.eventSubSubscriptions;
  }

  start(): void {
    this.stopped = false;
    if (!appConfig.twitch.enableEventSub) {
      this.store.patchStatus({ twitch: "disabled" });
      this.store.patchTwitchEventSubStatus({ websocket: "disabled" });
      this.logger.event({ type: "twitch.eventsub.disabled" });
      return;
    }
    this.connect();
  }

  reconnect(reason = "manual"): void {
    if (this.stopped) return;
    if (!appConfig.twitch.enableEventSub) {
      this.store.patchTwitchEventSubStatus({ websocket: "disabled" });
      this.logger.event({ type: "twitch.eventsub.reconnect_skipped", reason, enabled: false });
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    for (const socket of [this.socket, this.reconnectingSocket]) {
      if (!socket) continue;
      this.suppressedCloseSockets.add(socket);
      socket.close();
    }
    this.socket = undefined;
    this.reconnectingSocket = undefined;
    this.store.patchTwitchEventSubStatus({ websocket: "reconnecting" });
    this.logger.event({ type: "twitch.eventsub.manual_reconnect", reason });
    this.connect();
  }

  private connect(url = DEFAULT_EVENTSUB_URL, previousSocket?: EventSubSocket): void {
    if (this.stopped) return;
    const socket = this.webSocketFactory(url);
    if (previousSocket) {
      this.reconnectingSocket = socket;
      this.store.patchTwitchEventSubStatus({ websocket: "reconnecting" });
    } else {
      this.socket = socket;
    }

    socket.on("open", () => {
      this.store.patchStatus({ twitch: "connected" });
      this.store.patchTwitchEventSubStatus({ websocket: previousSocket ? "reconnecting" : "connected" });
      this.logger.event({ type: "twitch.eventsub.connected", reconnecting: Boolean(previousSocket) });
    });
    socket.on("message", (raw) => {
      void this.handleMessage(raw?.toString?.() ?? String(raw), socket, previousSocket).catch((error) => {
        this.handleMessageFailure(error, socket);
      });
    });
    socket.on("close", () => this.handleClose(socket));
    socket.on("error", (error) => {
      this.logger.error({ type: "twitch.eventsub.error", error: toSafeErrorMessage(error) });
    });
  }

  private handleClose(socket: EventSubSocket): void {
    if (this.reconnectingSocket === socket) this.reconnectingSocket = undefined;
    if (this.socket === socket) this.socket = undefined;
    if (this.suppressedCloseSockets.has(socket)) return;

    this.store.patchStatus({ twitch: "disconnected" });
    this.store.patchTwitchEventSubStatus({ websocket: "disconnected" });
    this.logger.error({ type: "twitch.eventsub.closed" });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectDelayMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    for (const socket of [this.socket, this.reconnectingSocket]) {
      if (!socket) continue;
      this.suppressedCloseSockets.add(socket);
      socket.close();
    }
    this.socket = undefined;
    this.reconnectingSocket = undefined;
    this.store.patchTwitchEventSubStatus({ websocket: "disabled" });
  }

  private async handleMessage(raw: string, socket: EventSubSocket, previousSocket?: EventSubSocket): Promise<void> {
    let payload: EventSubPayload;
    try {
      payload = JSON.parse(raw) as EventSubPayload;
    } catch (error) {
      this.logger.error({ type: "twitch.eventsub.parse_failed", error: toSafeErrorMessage(error) });
      return;
    }

    const messageType = payload.metadata?.message_type;
    if (messageType === "session_welcome") {
      const sessionId = payload.payload?.session?.id;
      await this.subscribe(sessionId);
      if (previousSocket) {
        this.suppressedCloseSockets.add(previousSocket);
        previousSocket.close();
        this.socket = socket;
        this.reconnectingSocket = undefined;
      }
      return;
    }
    if (messageType === "notification") {
      this.handleNotification(payload);
      return;
    }
    if (messageType === "revocation") {
      this.handleRevocation(payload);
      return;
    }
    if (messageType === "session_keepalive") return;
    if (messageType === "session_reconnect") {
      const reconnectUrl = payload.payload?.session?.reconnect_url;
      if (typeof reconnectUrl === "string" && reconnectUrl.length > 0) {
        this.logger.event({ type: "twitch.eventsub.reconnect_requested" });
        this.connect(reconnectUrl, socket);
      }
    }
  }

  private handleMessageFailure(error: unknown, socket: EventSubSocket): void {
    const safeError = toSafeErrorMessage(error);
    const statuses = this.subscriptions.map<TwitchEventSubSubscriptionStatus>((type) => ({
      type,
      version: getEventSubDefinition(type)?.version ?? "1",
      enabled: true,
      status: "failed",
      requiredScopes: getEventSubDefinition(type)?.requiredScopes ?? [],
      missingScopes: [],
      error: "Twitch OAuth 인증 갱신에 실패했습니다. Twitch 로그인을 다시 연결해주세요."
    }));
    this.store.patchStatus({ twitch: "disconnected" });
    this.store.patchTwitchEventSubStatus({ websocket: "disconnected" });
    this.store.setTwitchEventSubSubscriptions(statuses);
    this.logger.error({ type: "twitch.eventsub.message_failed", error: safeError });
    this.suppressedCloseSockets.add(socket);
    socket.close();
  }

  private async subscribe(sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      this.logger.error({ type: "twitch.eventsub.subscribe_failed", error: "EventSub session_id가 없습니다." });
      return;
    }

    const accessContext = await this.twitch.getEventSubAccessContext();
    if (!accessContext) {
      const statuses = this.subscriptions.map<TwitchEventSubSubscriptionStatus>((type) => ({
        type,
        version: getEventSubDefinition(type)?.version ?? "1",
        enabled: true,
        status: "failed",
        requiredScopes: getEventSubDefinition(type)?.requiredScopes ?? [],
        missingScopes: [],
        error: "OAuth user access token이 없습니다."
      }));
      this.store.patchTwitchEventSubStatus({ sessionId, websocket: "disconnected" });
      this.store.setTwitchEventSubSubscriptions(statuses);
      this.logger.error({ type: "twitch.eventsub.subscribe_failed", error: "OAuth user access token이 없습니다." });
      return;
    }

    const statuses: TwitchEventSubSubscriptionStatus[] = [];
    const context = {
      broadcasterUserId: accessContext.broadcasterId,
      chatUserId: accessContext.senderId
    };

    for (const subscriptionType of [...new Set(this.subscriptions)]) {
      const definition = getEventSubDefinition(subscriptionType);
      if (!definition) {
        const status: TwitchEventSubSubscriptionStatus = {
          type: subscriptionType,
          version: "1",
          enabled: true,
          status: "failed",
          requiredScopes: [],
          missingScopes: [],
          error: "알 수 없는 EventSub subscription type입니다."
        };
        statuses.push(status);
        this.logger.error({ type: "twitch.eventsub.subscribe_failed", subscriptionType, error: status.error });
        continue;
      }

      const missingScopes = getMissingScopesForEventSubDefinition(definition, accessContext.scopes);
      if (missingScopes.length > 0) {
        const status: TwitchEventSubSubscriptionStatus = {
          type: definition.type,
          version: definition.version,
          enabled: true,
          status: "skipped",
          requiredScopes: definition.requiredScopes,
          missingScopes,
          error: "필요한 Twitch scope가 없습니다."
        };
        statuses.push(status);
        this.logger.error({ type: "twitch.eventsub.subscription_skipped", subscriptionType: definition.type, missingScopes });
        continue;
      }

      statuses.push(await this.createSubscription(definition, context, sessionId));
    }

    this.store.patchTwitchEventSubStatus({ sessionId, websocket: "connected" });
    this.store.setTwitchEventSubSubscriptions(statuses);
  }

  private async createSubscription(
    definition: EventSubSubscriptionDefinition,
    context: { broadcasterUserId: string; chatUserId: string },
    sessionId: string
  ): Promise<TwitchEventSubSubscriptionStatus> {
    try {
      const result = await this.twitch.createEventSubSubscription(
        definition.type,
        definition.version,
        definition.buildCondition(context),
        sessionId
      );
      this.logger.event({ type: "twitch.eventsub.subscribed", subscriptionType: definition.type, result });
      return {
        type: definition.type,
        version: definition.version,
        enabled: true,
        status: "active",
        requiredScopes: definition.requiredScopes,
        missingScopes: [],
        subscribedAt: nowIso()
      };
    } catch (error) {
      const safeError = toSafeErrorMessage(error);
      this.logger.error({ type: "twitch.eventsub.subscribe_failed", subscriptionType: definition.type, error: safeError });
      return {
        type: definition.type,
        version: definition.version,
        enabled: true,
        status: "failed",
        requiredScopes: definition.requiredScopes,
        missingScopes: [],
        error: safeError
      };
    }
  }

  private handleNotification(payload: EventSubPayload): void {
    const type = payload.payload?.subscription?.type ?? payload.metadata?.subscription_type;
    const event = payload.payload?.event ?? {};
    const messageId = typeof payload.metadata?.message_id === "string" ? payload.metadata.message_id : undefined;
    const eventId = this.extractEventId(type, event);
    const internalId = messageId ?? eventId ?? newId("twitch_msg");

    if (!this.store.markTwitchEventSeen([messageId, eventId].filter((id): id is string => Boolean(id)))) return;

    this.store.patchTwitchEventSubStatus({ lastEventAt: nowIso() });
    this.logger.event({ type: "twitch.eventsub.raw", subscriptionType: type, messageId: internalId, eventId, payload });

    const internalEvent = this.toInternalEvent(type, event, internalId);
    if (internalEvent) this.events.emit(internalEvent);
  }

  private handleRevocation(payload: EventSubPayload): void {
    const subscriptionType = payload.payload?.subscription?.type ?? payload.metadata?.subscription_type ?? "unknown";
    const status = payload.payload?.subscription?.status ?? "unknown";
    this.logger.error({ type: "twitch.eventsub.revoked", subscriptionType, status });
  }

  private extractEventId(type: string | undefined, event: Record<string, any>): string | undefined {
    if (typeof event.id === "string") return event.id;
    if (type === "channel.chat.message" && typeof event.message_id === "string") return event.message_id;
    if (type === "channel.follow" && typeof event.user_id === "string") return `${event.user_id}:${event.followed_at ?? ""}`;
    return undefined;
  }

  private toInternalEvent(type: string | undefined, event: Record<string, any>, id: string): InternalEvent | undefined {
    if (type === "channel.chat.message") {
      const fragments = parseChatFragments(event.message?.fragments);
      return {
        type: "twitch.chatMessage",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        chatterUserId: String(event.chatter_user_id ?? ""),
        chatterUserName: String(event.chatter_user_name ?? event.chatter_user_login ?? ""),
        message: String(event.message?.text ?? ""),
        ...(fragments ? { fragments } : {}),
        createdAt: nowIso()
      };
    }

    if (type === "channel.channel_points_custom_reward_redemption.add") {
      return {
        type: "twitch.rewardRedemption",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        userId: String(event.user_id ?? ""),
        userName: String(event.user_name ?? event.user_login ?? ""),
        rewardId: String(event.reward?.id ?? ""),
        rewardTitle: String(event.reward?.title ?? ""),
        userInput: typeof event.user_input === "string" ? event.user_input : undefined,
        createdAt: typeof event.redeemed_at === "string" ? event.redeemed_at : nowIso()
      };
    }

    if (type === "stream.online" || type === "stream.offline") {
      return {
        type: type === "stream.online" ? "twitch.streamOnline" : "twitch.streamOffline",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        createdAt: nowIso()
      };
    }

    if (type === "channel.subscribe") {
      return {
        type: "twitch.subscription",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        userId: String(event.user_id ?? ""),
        userName: String(event.user_name ?? event.user_login ?? ""),
        tier: String(event.tier ?? ""),
        isGift: Boolean(event.is_gift),
        createdAt: nowIso()
      };
    }

    if (type === "channel.subscription.message") {
      return {
        type: "twitch.subscriptionMessage",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        userId: String(event.user_id ?? ""),
        userName: String(event.user_name ?? event.user_login ?? ""),
        tier: String(event.tier ?? ""),
        cumulativeMonths: Number(event.cumulative_months ?? 0),
        streakMonths: typeof event.streak_months === "number" ? event.streak_months : undefined,
        message: typeof event.message?.text === "string" ? event.message.text : undefined,
        createdAt: nowIso()
      };
    }

    if (type === "channel.cheer") {
      return {
        type: "twitch.cheer",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        userId: typeof event.user_id === "string" ? event.user_id : undefined,
        userName: typeof event.user_name === "string" ? event.user_name : undefined,
        bits: Number(event.bits ?? 0),
        message: typeof event.message === "string" ? event.message : undefined,
        isAnonymous: Boolean(event.is_anonymous),
        createdAt: nowIso()
      };
    }

    if (type === "channel.raid") {
      return {
        type: "twitch.raid",
        id,
        fromBroadcasterUserId: String(event.from_broadcaster_user_id ?? ""),
        fromBroadcasterUserName: String(event.from_broadcaster_user_name ?? event.from_broadcaster_user_login ?? ""),
        toBroadcasterUserId: String(event.to_broadcaster_user_id ?? ""),
        toBroadcasterUserName: String(event.to_broadcaster_user_name ?? event.to_broadcaster_user_login ?? ""),
        viewers: Number(event.viewers ?? 0),
        createdAt: nowIso()
      };
    }

    if (type === "channel.follow") {
      return {
        type: "twitch.follow",
        id,
        broadcasterUserId: String(event.broadcaster_user_id ?? ""),
        userId: String(event.user_id ?? ""),
        userName: String(event.user_name ?? event.user_login ?? ""),
        followedAt: typeof event.followed_at === "string" ? event.followed_at : undefined,
        createdAt: nowIso()
      };
    }

    return undefined;
  }
}

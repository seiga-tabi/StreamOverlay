import { newId, nowIso, redactSensitiveString, sleep, toSafeErrorMessage } from "@streamops/shared";
import type { TwitchChatMode, TwitchChatStatus } from "@streamops/shared";
import { appConfig } from "../config.js";
import type { TemplateContext } from "../core/template.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "./store.js";
import type { TwitchAuthService } from "./twitch-auth.js";

export type TwitchChatAccessContext = {
  clientId: string;
  accessToken: string;
  broadcasterId: string;
  senderId: string;
  scopes: string[];
  source: "oauth" | "env";
};

export type TwitchChatTokenProvider = {
  getChatAccessContext(mode: TwitchChatMode): Promise<TwitchChatAccessContext | undefined>;
  refreshAfterUnauthorized?(): Promise<boolean>;
};

export type TwitchChatServiceOptions = {
  mode?: TwitchChatMode;
  throttleMs?: number;
  cooldownMs?: number;
  maxQueue?: number;
  maxMessageLength?: number;
  templateValueMaxLength?: number;
};

export type TwitchChatSendResult =
  | { status: "sent"; messageId?: string }
  | { status: "skipped"; reason: "cooldown" | "duplicate_pending"; retryAfterMs?: number };

type ChatQueueItem = {
  id: string;
  message: string;
  normalizedMessage: string;
  reason?: string;
  resolve: (result: TwitchChatSendResult) => void;
  reject: (error: unknown) => void;
};

type TwitchChatSendResponse = {
  data?: Array<{
    message_id?: string;
    is_sent?: boolean;
    drop_reason?: {
      code?: string;
      message?: string;
    };
  }>;
};

export function resolveChatMode(value: string | undefined): TwitchChatMode {
  return value === "bot" ? "bot" : "broadcaster";
}

export function sanitizeChatMessage(input: string, maxLength = 500): string {
  return redactSensitiveString(input)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function renderSafeChatTemplate(
  template: string,
  context: TemplateContext,
  options: { maxMessageLength?: number; templateValueMaxLength?: number } = {}
): string {
  const valueMaxLength = options.templateValueMaxLength ?? 120;
  const rendered = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    const value = context[key];
    return value == null ? "" : sanitizeChatMessage(String(value), valueMaxLength);
  });
  return sanitizeChatMessage(rendered, options.maxMessageLength ?? 500);
}

export function normalizeChatMessageForCooldown(message: string): string {
  return message.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export class TwitchAuthChatTokenProvider implements TwitchChatTokenProvider {
  constructor(private readonly auth: TwitchAuthService) {}

  async getChatAccessContext(mode: TwitchChatMode): Promise<TwitchChatAccessContext | undefined> {
    const authContext = await this.auth.getAccessContext({ refreshIfExpired: true, allowLegacy: true });
    if (!authContext) return undefined;
    return {
      clientId: authContext.clientId,
      accessToken: authContext.accessToken,
      broadcasterId: authContext.broadcasterId,
      senderId: mode === "broadcaster" ? authContext.broadcasterId : authContext.senderId,
      scopes: authContext.scopes,
      source: authContext.source
    };
  }

  async refreshAfterUnauthorized(): Promise<boolean> {
    return this.auth.refreshAfterUnauthorized();
  }
}

export class TwitchChatService {
  private readonly mode: TwitchChatMode;
  private readonly throttleMs: number;
  private readonly cooldownMs: number;
  private readonly maxQueue: number;
  private readonly maxMessageLength: number;
  private readonly templateValueMaxLength: number;
  private readonly queue: ChatQueueItem[] = [];
  private readonly pendingMessageKeys = new Set<string>();
  private readonly lastSentByMessageKey = new Map<string, number>();
  private processing = false;
  private lastSentAt = 0;

  constructor(
    private readonly tokenProvider: TwitchChatTokenProvider,
    private readonly logger: JsonlLogger,
    private readonly store: Store,
    options: TwitchChatServiceOptions = {},
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.mode = options.mode ?? resolveChatMode(appConfig.twitch.chatMode);
    this.throttleMs = Math.max(0, options.throttleMs ?? appConfig.twitch.chatThrottleMs);
    this.cooldownMs = Math.max(0, options.cooldownMs ?? appConfig.twitch.chatCooldownMs);
    this.maxQueue = Math.max(1, options.maxQueue ?? appConfig.twitch.chatMaxQueue);
    this.maxMessageLength = Math.min(500, Math.max(1, options.maxMessageLength ?? appConfig.twitch.chatMaxLength));
    this.templateValueMaxLength = Math.max(1, options.templateValueMaxLength ?? appConfig.twitch.chatTemplateValueMaxLength);
    this.store.patchTwitchChatStatus({
      mode: this.mode,
      queueSize: 0,
      throttleMs: this.throttleMs,
      cooldownMs: this.cooldownMs,
      maxMessageLength: this.maxMessageLength
    });
  }

  getStatus(): TwitchChatStatus {
    return this.store.getTwitchChatStatus();
  }

  renderMessageTemplate(template: string, context: TemplateContext): string {
    return renderSafeChatTemplate(template, context, {
      maxMessageLength: this.maxMessageLength,
      templateValueMaxLength: this.templateValueMaxLength
    });
  }

  async sendChatMessage(message: string, options: { reason?: string } = {}): Promise<TwitchChatSendResult> {
    const sanitizedMessage = sanitizeChatMessage(message, this.maxMessageLength);
    if (!sanitizedMessage) throw new Error("Twitch chat message가 비어 있습니다.");

    const normalizedMessage = normalizeChatMessageForCooldown(sanitizedMessage);
    if (this.pendingMessageKeys.has(normalizedMessage)) {
      return { status: "skipped", reason: "duplicate_pending" };
    }

    const now = Date.now();
    const lastSent = this.lastSentByMessageKey.get(normalizedMessage) ?? 0;
    const retryAfterMs = lastSent + this.cooldownMs - now;
    if (this.cooldownMs > 0 && retryAfterMs > 0) {
      this.logger.event({ type: "twitch.chat.cooldown_skipped", messagePreview: this.preview(sanitizedMessage), retryAfterMs });
      return { status: "skipped", reason: "cooldown", retryAfterMs };
    }

    if (this.queue.length >= this.maxQueue) {
      const error = new Error("Twitch chat queue가 가득 찼습니다.");
      this.recordFailure(sanitizedMessage, error);
      throw error;
    }

    return new Promise<TwitchChatSendResult>((resolve, reject) => {
      this.queue.push({
        id: newId("chat_job"),
        message: sanitizedMessage,
        normalizedMessage,
        reason: options.reason,
        resolve,
        reject
      });
      this.pendingMessageKeys.add(normalizedMessage);
      this.patchQueueSize();
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.processing) return;
    this.processing = true;
    void this.drainQueue().finally(() => {
      this.processing = false;
      if (this.queue.length > 0) this.processQueue();
    });
  }

  private async drainQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const waitMs = this.lastSentAt + this.throttleMs - Date.now();
      if (waitMs > 0) await sleep(waitMs);

      const item = this.queue.shift();
      this.patchQueueSize();
      if (!item) continue;

      try {
        const result = await this.sendNow(item);
        this.lastSentAt = Date.now();
        this.lastSentByMessageKey.set(item.normalizedMessage, this.lastSentAt);
        this.store.patchTwitchChatStatus({ lastSentAt: nowIso() });
        item.resolve(result);
      } catch (error) {
        this.recordFailure(item.message, error);
        item.reject(error);
      } finally {
        this.pendingMessageKeys.delete(item.normalizedMessage);
      }
    }
  }

  private async sendNow(item: ChatQueueItem): Promise<TwitchChatSendResult> {
    const context = await this.getRequiredContext();
    let response = await this.postMessage(context, item.message);

    if (response.status === 401 && this.tokenProvider.refreshAfterUnauthorized) {
      const refreshed = await this.tokenProvider.refreshAfterUnauthorized();
      if (refreshed) {
        const retryContext = await this.getRequiredContext();
        response = await this.postMessage(retryContext, item.message);
      }
    }

    if (!response.ok) {
      const error = new Error(`Twitch chat send failed: ${response.status}`) as Error & { statusCode?: number };
      error.statusCode = response.status;
      throw error;
    }

    const body = (await response.json().catch(() => undefined)) as TwitchChatSendResponse | undefined;
    const result = body?.data?.[0];
    if (result?.is_sent === false) {
      const code = result.drop_reason?.code ?? "unknown";
      const message = result.drop_reason?.message ?? "Twitch가 채팅 메시지를 drop했습니다.";
      throw new Error(`Twitch chat dropped: ${code}: ${message}`);
    }

    this.logger.action({
      type: "twitch.chat",
      status: "sent",
      mode: this.mode,
      reason: item.reason,
      messagePreview: this.preview(item.message),
      messageId: result?.message_id
    });
    return { status: "sent", messageId: result?.message_id };
  }

  private async getRequiredContext(): Promise<TwitchChatAccessContext> {
    const context = await this.tokenProvider.getChatAccessContext(this.mode);
    if (!context) throw new Error("Twitch chat token이 없습니다.");
    if (context.source === "oauth" && !context.scopes.includes("user:write:chat")) {
      throw new Error("Twitch chat token에 user:write:chat scope가 없습니다.");
    }
    return context;
  }

  private async postMessage(context: TwitchChatAccessContext, message: string): Promise<Response> {
    return this.fetchImpl("https://api.twitch.tv/helix/chat/messages", {
      method: "POST",
      headers: {
        "Client-Id": context.clientId,
        Authorization: `Bearer ${context.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        broadcaster_id: context.broadcasterId,
        sender_id: context.senderId,
        message
      })
    });
  }

  private patchQueueSize(): void {
    this.store.patchTwitchChatStatus({ queueSize: this.queue.length });
  }

  private recordFailure(message: string, error: unknown): void {
    const safeError = toSafeErrorMessage(error);
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : undefined;
    const failure = {
      id: newId("chat_failure"),
      messagePreview: this.preview(message),
      reason: safeError,
      statusCode,
      createdAt: nowIso()
    };
    this.store.addTwitchChatFailure(failure);
    this.logger.error({
      type: "twitch.chat.send_failed",
      mode: this.mode,
      statusCode,
      error: safeError,
      messagePreview: failure.messagePreview
    });
  }

  private preview(message: string): string {
    return sanitizeChatMessage(message, 100);
  }
}

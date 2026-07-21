import fs from "node:fs";
import path from "node:path";
import { toSafeErrorMessage, type ChatMessageFragment, type TwitchChatMessageInternalEvent } from "@streamops/shared";
import type { BotModule } from "../core/module.js";
import { appConfig } from "../config.js";
import { sanitizeDisplayName, sanitizeViewerInput } from "../core/safe-text.js";
import { createDefaultChatTranslationService } from "../services/chat-translation-service.js";

type ChatOverlayConfig = {
  enabled: boolean;
  hideCommands: boolean;
  maxMessageLength: number;
};

const DEFAULT_CONFIG: ChatOverlayConfig = {
  enabled: true,
  hideCommands: true,
  maxMessageLength: 220
};
const TWITCH_EMOTE_ID_PATTERN = /^[A-Za-z0-9_]+$/;

function twitchEmoteImageUrl(id: string): string {
  return `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/static/light/3.0`;
}

function safeChatFragments(event: TwitchChatMessageInternalEvent, maxMessageLength: number): ChatMessageFragment[] | undefined {
  if (!event.fragments?.length) return undefined;
  const fragments: ChatMessageFragment[] = [];
  for (const fragment of event.fragments) {
    if (fragment.type === "text") {
      const text = sanitizeViewerInput(fragment.text, maxMessageLength);
      if (text) fragments.push({ type: "text", text });
      continue;
    }
    if (fragment.type === "emote" && TWITCH_EMOTE_ID_PATTERN.test(fragment.id)) {
      fragments.push({
        type: "emote",
        id: fragment.id,
        text: sanitizeViewerInput(fragment.text, 80) || fragment.id,
        imageUrl: twitchEmoteImageUrl(fragment.id)
      });
    }
  }
  return fragments.length > 0 ? fragments : undefined;
}

function loadConfig(): ChatOverlayConfig {
  const filePath = path.join(appConfig.paths.config, "chat-overlay.json");
  if (!fs.existsSync(filePath)) return DEFAULT_CONFIG;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<ChatOverlayConfig>;
  return {
    enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
    hideCommands: parsed.hideCommands ?? DEFAULT_CONFIG.hideCommands,
    maxMessageLength: parsed.maxMessageLength ?? DEFAULT_CONFIG.maxMessageLength
  };
}

function isCommandMessage(message: string): boolean {
  const trimmed = message.trim();
  return trimmed.startsWith("!") || trimmed.startsWith("！");
}

export const chatOverlayModule: BotModule = {
  name: "chat-overlay",
  setup(ctx) {
    const config = loadConfig();
    const translator = createDefaultChatTranslationService();
    if (!config.enabled) {
      ctx.logger.event({ type: "chat_overlay.disabled" });
      return;
    }

    ctx.events.on<TwitchChatMessageInternalEvent>("twitch.chatMessage", async (event) => {
      if (config.hideCommands && isCommandMessage(event.message)) return;
      const message = sanitizeViewerInput(event.message, config.maxMessageLength);
      if (!message) return;

      let profileImageUrl: string | undefined;
      try {
        profileImageUrl = await ctx.twitch.getUserProfileImageUrl?.(event.chatterUserId);
      } catch (error) {
        ctx.logger.error({ type: "chat_overlay.profile_image_lookup_failed", error: toSafeErrorMessage(error) });
      }

      let translation: Awaited<ReturnType<typeof translator.translateChatMessage>> | undefined;
      try {
        translation = await translator.translateChatMessage(message);
        if (translation) {
          ctx.logger.translation({
            type: "chat_overlay.translation",
            userName: sanitizeDisplayName(event.chatterUserName),
            sourceLanguage: translation.sourceLanguage,
            targetLanguage: translation.targetLanguage,
            original: message,
            translated: translation.translatedText
          });
        }
      } catch (error) {
        ctx.logger.error({ type: "chat_overlay.translation_failed", error: toSafeErrorMessage(error) });
      }

      const fragments = safeChatFragments(event, config.maxMessageLength);
      ctx.overlay.broadcast({
        type: "chat.message.add",
        streamerId: event.broadcasterUserId,
        id: event.id,
        userName: sanitizeDisplayName(event.chatterUserName),
        ...(profileImageUrl ? { profileImageUrl } : {}),
        message,
        ...(fragments ? { fragments } : {}),
        ...(translation ? {
          translatedMessage: translation.translatedText,
          translationSourceLanguage: translation.sourceLanguage,
          translationTargetLanguage: translation.targetLanguage
        } : {}),
        createdAt: event.createdAt,
        isBroadcaster: event.chatterUserId === event.broadcasterUserId,
        source: "twitch.chat"
      });
    });
  }
};

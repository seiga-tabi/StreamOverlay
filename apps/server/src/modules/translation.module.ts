import type { TwitchChatMessageInternalEvent } from "@streamops/shared";
import type { BotModule } from "../core/module.js";

function looksJapanese(message: string): boolean {
  return /[ぁ-んァ-ヶ]/.test(message);
}

export const translationModule: BotModule = {
  name: "translation",
  setup(ctx) {
    ctx.events.on<TwitchChatMessageInternalEvent>("twitch.chatMessage", async (event) => {
      if (!looksJapanese(event.message)) return;
      const translated = `[번역 필요] ${event.message}`;
      ctx.logger.translation({ userName: event.chatterUserName, original: event.message, translated, sourceLanguage: "ja", targetLanguage: "ko" });
      await ctx.actions.dispatchOne({ type: "overlay.banner", message: `🇯🇵 ${event.chatterUserName}: ${translated}`, durationMs: 6000, variant: "info" }, {}, "translation.chat");
    });
  }
};

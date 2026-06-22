import fs from "node:fs";
import path from "node:path";
import type { BotAction, TwitchChatMessageInternalEvent } from "@streamops/shared";
import type { BotModule } from "../core/module.js";
import { appConfig } from "../config.js";
import { sanitizeDisplayName, sanitizeViewerInput } from "../core/safe-text.js";

type ChatCommandsConfig = Record<string, BotAction[]>;

const CHAT_COMMAND_ALIASES: Record<string, string> = {
  "!디스코드": "!디코",
  "!discord": "!디코",
  "!dc": "!디코",
  "!ディスコード": "!디코",
  "!ディスコ": "!디코",
  "!今日": "!오늘",
  "!きょう": "!오늘",
  "!today": "!오늘",
  "!schedule": "!오늘",
  "!クリップ": "!클립",
  "!clip": "!클립",
  "!質問": "!질문",
  "!しつもん": "!질문",
  "!question": "!질문",
  "!q": "!질문",
  "!緊急テスト": "!비상테스트",
  "!emergencytest": "!비상테스트",
  "!emergency-test": "!비상테스트"
};

function normalizeCommandToken(command: string): string {
  return command.trim().normalize("NFKC").toLowerCase();
}

function commandKey(command: string): string {
  const normalized = normalizeCommandToken(command);
  return CHAT_COMMAND_ALIASES[normalized] ?? normalized;
}

function loadConfig(): ChatCommandsConfig {
  const filePath = path.join(appConfig.paths.config, "chat-commands.json");
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as ChatCommandsConfig;
  return Object.fromEntries(Object.entries(parsed).map(([command, actions]) => [normalizeCommandToken(command), actions]));
}

export const chatCommandsModule: BotModule = {
  name: "chat-commands",
  setup(ctx) {
    const config = loadConfig();
    ctx.events.on<TwitchChatMessageInternalEvent>("twitch.chatMessage", async (event) => {
      const [command, ...rest] = event.message.trim().split(/\s+/);
      if (!command) return;
      const key = commandKey(command);
      const actions = config[key];
      if (!actions) return;
      const input = sanitizeViewerInput(rest.join(" "));
      await ctx.actions.dispatch(actions, {
        user: sanitizeDisplayName(event.chatterUserName),
        userId: event.chatterUserId,
        input,
        message: sanitizeViewerInput(event.message, 500)
      }, `chat:${key}`);
    });
  }
};

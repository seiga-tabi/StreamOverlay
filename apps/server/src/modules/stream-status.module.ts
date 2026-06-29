import fs from "node:fs";
import path from "node:path";
import type { BotAction, TwitchStreamStatusInternalEvent } from "@streamops/shared";
import type { BotModule } from "../core/module.js";
import { appConfig } from "../config.js";
import { nowIso } from "@streamops/shared";

type StreamEventsConfig = Record<string, BotAction[]>;

function loadConfig(): StreamEventsConfig {
  const filePath = path.join(appConfig.paths.config, "stream-events.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as StreamEventsConfig;
}

export const streamStatusModule: BotModule = {
  name: "stream-status",
  setup(ctx) {
    const config = loadConfig();
    ctx.events.on<TwitchStreamStatusInternalEvent>("twitch.streamOnline", async (event) => {
      ctx.twitch.clearStreamStatusCache?.(event.broadcasterUserId);
      ctx.store.patchStatus({ stream: "online", lastStreamOnlineAt: nowIso(), postStreamReportReady: false });
      await ctx.actions.dispatch(config["stream.online"] ?? [], {}, "stream.online");
      ctx.dashboard.broadcastSnapshot();
    });
    ctx.events.on<TwitchStreamStatusInternalEvent>("twitch.streamOffline", async (event) => {
      ctx.twitch.clearStreamStatusCache?.(event.broadcasterUserId);
      ctx.store.patchStatus({ stream: "offline", lastStreamOfflineAt: nowIso(), postStreamReportReady: true });
      await ctx.actions.dispatch(config["stream.offline"] ?? [], {}, "stream.offline");
      ctx.logger.event({ type: "stream.post_stream_report_ready", approved: false });
      ctx.dashboard.broadcastSnapshot();
    });
  }
};

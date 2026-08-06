import fs from "node:fs";
import path from "node:path";
import { appConfig } from "../config.js";
import type { BotModule } from "../core/module.js";
import { chatCommandsModule } from "./chat-commands.module.js";
import { rewardsModule } from "./rewards.module.js";
import { streamStatusModule } from "./stream-status.module.js";
import { participationModule } from "./participation.module.js";
import { lolProfileEnrichmentModule } from "./lol-profile-enrichment.module.js";
import { lolGameMonitorModule } from "./lol-game-monitor.module.js";
import { translationModule } from "./translation.module.js";

type ModulesConfig = Record<string, boolean>;

function loadModulesConfig(): ModulesConfig {
  const filePath = path.join(appConfig.paths.config, "modules.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as ModulesConfig;
}

export function getEnabledModules(): BotModule[] {
  const config = loadModulesConfig();
  const modules: Array<[string, BotModule]> = [
    ["rewards", rewardsModule],
    ["chatCommands", chatCommandsModule],
    ["streamStatus", streamStatusModule],
    ["participation", participationModule],
    ["lolProfileEnrichment", lolProfileEnrichmentModule],
    ["lolGameMonitor", lolGameMonitorModule],
    ["translation", translationModule]
  ];
  return modules.filter(([key]) => config[key]).map(([, module]) => module);
}

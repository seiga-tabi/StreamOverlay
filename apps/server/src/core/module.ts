import type { EventBus } from "./event-bus.js";
import type { ActionDispatcher } from "./action-dispatcher.js";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import type { Store } from "../services/store.js";
import type { TwitchApiClient } from "../services/twitch-api.js";
import type { RiotApiClient } from "../services/riot-api.js";
import type { LolProfileEnrichmentService } from "../services/lol-profile-enrichment.js";

export type ModuleContext = {
  events: EventBus;
  actions: ActionDispatcher;
  logger: JsonlLogger;
  store: Store;
  twitch: TwitchApiClient;
  riot: RiotApiClient;
  lolProfileEnrichment?: LolProfileEnrichmentService;
};

export type BotModule = {
  name: string;
  setup(ctx: ModuleContext): void | Promise<void>;
};

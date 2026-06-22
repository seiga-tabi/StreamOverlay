import fs from "node:fs";
import path from "node:path";
import type { ParticipationEntryCreatedInternalEvent } from "@streamops/shared";
import type { BotModule, ModuleContext } from "../core/module.js";
import { appConfig } from "../config.js";
import type { LolParticipationProfileConfig, LolProfilePatch } from "../services/lol-profile-enrichment.js";

function loadConfig(): LolParticipationProfileConfig {
  const filePath = path.join(appConfig.paths.config, "lol-participation.json");
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<LolParticipationProfileConfig>;
  return {
    enabled: parsed.enabled ?? true,
    showRiotIdPublicly: parsed.showRiotIdPublicly ?? false,
    profileCacheTtlHours: parsed.profileCacheTtlHours ?? 24,
    matchAnalysisCount: parsed.matchAnalysisCount ?? 20,
    mainRoleMinConfidence: parsed.mainRoleMinConfidence ?? 45,
    enabledQueues: parsed.enabledQueues ?? [],
    rateLimit: {
      backoffMs: parsed.rateLimit?.backoffMs ?? 60_000,
      maxBackoffMs: parsed.rateLimit?.maxBackoffMs ?? 900_000
    }
  };
}

async function broadcastQueue(ctx: ModuleContext, reason: string): Promise<void> {
  await ctx.actions.dispatchOne({
    type: "overlay.participationQueue",
    isOpen: ctx.store.getStatus().participation === "open",
    queue: ctx.store.getParticipationOverlayQueue()
  }, {}, reason);
  ctx.dashboard.broadcastSnapshot();
}

function applyPatch(ctx: ModuleContext, entryId: string, patch: LolProfilePatch): void {
  ctx.store.patchParticipationProfile(entryId, patch);
}

async function analyzeEntry(ctx: ModuleContext, config: LolParticipationProfileConfig, entryId: string, force = false): Promise<boolean> {
  if (!ctx.lolProfileEnrichment) return false;
  const entry = ctx.store.getParticipationEntryById(entryId);
  if (!entry) return false;

  if (!force) {
    const cached = ctx.lolProfileEnrichment.getCachedPatch(entry, config);
    if (cached) {
      applyPatch(ctx, entryId, cached);
      await broadcastQueue(ctx, "lol_profile.cache_hit");
      return true;
    }
  }

  applyPatch(ctx, entryId, { profileStatus: "analyzing" });
  await broadcastQueue(ctx, "lol_profile.analyzing");
  const patch = await ctx.lolProfileEnrichment.enrich(entry, config, force);
  applyPatch(ctx, entryId, patch);
  await broadcastQueue(ctx, "lol_profile.ready");
  return true;
}

export const lolProfileEnrichmentModule: BotModule = {
  name: "lolProfileEnrichment",
  setup(ctx) {
    const config = loadConfig();
    if (!config.enabled) {
      ctx.logger.event({ type: "lol_profile.disabled" });
      return;
    }
    if (!ctx.lolProfileEnrichment) {
      ctx.logger.error({ type: "lol_profile.missing_service" });
      return;
    }

    ctx.events.on<ParticipationEntryCreatedInternalEvent>("participation.entryCreated", (event) => {
      void analyzeEntry(ctx, config, event.entryId).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error({ type: "lol_profile.background_failed", entryId: event.entryId, error: message });
      });
    });
  }
};

export async function refreshLolProfileForEntry(ctx: ModuleContext, entryId: string): Promise<boolean> {
  return analyzeEntry(ctx, loadConfig(), entryId, true);
}

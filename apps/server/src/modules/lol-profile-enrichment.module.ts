import fs from "node:fs";
import path from "node:path";
import type { ParticipationEntryCreatedInternalEvent } from "@streamops/shared";
import type { BotModule, ModuleContext } from "../core/module.js";
import { appConfig } from "../config.js";
import type { LolParticipationProfileConfig, LolProfilePatch } from "../services/lol-profile-enrichment.js";

export type LolParticipationProfileSettings = {
  championSkinOverrides: Record<string, number>;
};

const MAX_CHAMPION_SKIN_OVERRIDES = 50;
const PROFILE_SETTINGS_FILE = "lol-profile-settings.json";

function lolParticipationProfileConfigPath(): string {
  return path.join(appConfig.paths.config, "lol-participation.json");
}

function lolParticipationProfileSettingsPath(): string {
  return path.join(appConfig.paths.state, PROFILE_SETTINGS_FILE);
}

function readJsonRecord(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
}

function readProfileConfigRecord(): Record<string, unknown> {
  return readJsonRecord(lolParticipationProfileConfigPath());
}

function readProfileSettingsRecord(): Record<string, unknown> {
  return readJsonRecord(lolParticipationProfileSettingsPath());
}

function hasOwnValue(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function normalizeChampionSkinOverrides(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    if (Object.keys(result).length >= MAX_CHAMPION_SKIN_OVERRIDES) break;
    const key = rawKey.trim();
    if (!/^[A-Za-z0-9_. -]{1,40}$/.test(key)) continue;
    const skinNum = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(skinNum)) continue;
    const normalized = Math.trunc(skinNum);
    if (normalized < 0 || normalized > 1000) continue;
    result[key] = normalized;
  }
  return result;
}

export function loadLolParticipationProfileConfig(): LolParticipationProfileConfig {
  const parsed = readProfileConfigRecord() as Partial<LolParticipationProfileConfig>;
  const settings = readProfileSettingsRecord();
  const championSkinOverrides = hasOwnValue(settings, "championSkinOverrides")
    ? normalizeChampionSkinOverrides(settings.championSkinOverrides)
    : normalizeChampionSkinOverrides(parsed.championSkinOverrides);
  return {
    enabled: parsed.enabled ?? true,
    showRiotIdPublicly: parsed.showRiotIdPublicly ?? false,
    profileCacheTtlHours: parsed.profileCacheTtlHours ?? 24,
    matchAnalysisCount: parsed.matchAnalysisCount ?? 20,
    mainRoleMinConfidence: parsed.mainRoleMinConfidence ?? 45,
    enabledQueues: parsed.enabledQueues ?? [],
    championSkinOverrides,
    rateLimit: {
      backoffMs: parsed.rateLimit?.backoffMs ?? 60_000,
      maxBackoffMs: parsed.rateLimit?.maxBackoffMs ?? 900_000
    }
  };
}

export function loadLolParticipationProfileSettings(): LolParticipationProfileSettings {
  const config = loadLolParticipationProfileConfig();
  return {
    championSkinOverrides: config.championSkinOverrides ?? {}
  };
}

export function saveLolParticipationProfileSettings(settings: Partial<LolParticipationProfileSettings>): LolParticipationProfileSettings {
  const filePath = lolParticipationProfileSettingsPath();
  const current = readProfileSettingsRecord();
  const next = {
    ...current,
    championSkinOverrides: normalizeChampionSkinOverrides(settings.championSkinOverrides)
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  return loadLolParticipationProfileSettings();
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
    const config = loadLolParticipationProfileConfig();
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
  return analyzeEntry(ctx, loadLolParticipationProfileConfig(), entryId, true);
}

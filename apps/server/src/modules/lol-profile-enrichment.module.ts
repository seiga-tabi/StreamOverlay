import fs from "node:fs";
import path from "node:path";
import type { ParticipationEntry, ParticipationEntryCreatedInternalEvent } from "@streamops/shared";
import { normalizeRiotIdKey } from "@streamops/shared";
import type { BotModule, ModuleContext } from "../core/module.js";
import { appConfig } from "../config.js";
import type { LolParticipationProfileConfig, LolProfilePatch } from "../services/lol-profile-enrichment.js";

export type LolParticipationProfileSettings = {
  championSkinOverrides: Record<string, number>;
};

const MAX_CHAMPION_SKIN_OVERRIDES = 50;
const PROFILE_SETTINGS_FILE = "lol-profile-settings.json";
const PROFILE_ANALYSIS_VISIBLE_LIMIT = 4;
const PROFILE_ANALYSIS_DEFER_MS = 30_000;
const PROFILE_ANALYSIS_PRIORITIES = {
  manual: 100,
  visibleQueue: 50,
  background: 10
} as const;

type ProfileAnalysisJob = {
  key: string;
  ctx: ModuleContext;
  config: LolParticipationProfileConfig;
  entryIds: Set<string>;
  force: boolean;
  priority: number;
  notBefore: number;
  sequence: number;
  resolvers: Array<(value: boolean) => void>;
  rejecters: Array<(error: unknown) => void>;
};

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
    matchAnalysisCount: parsed.matchAnalysisCount ?? 10,
    mainRoleMinConfidence: parsed.mainRoleMinConfidence ?? 45,
    enabledQueues: parsed.enabledQueues ?? [420, 440],
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

function profileIdentityKey(entry: ParticipationEntry): string {
  const puuid = typeof entry.riotPuuid === "string" ? entry.riotPuuid.trim() : "";
  if (puuid) return `puuid:${puuid}`;
  return `riot:${normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine)}`;
}

function visibleQueuePriority(ctx: ModuleContext, entryId: string): number {
  const index = ctx.store.getParticipationQueue().findIndex((entry) => entry.id === entryId);
  return index >= 0 && index < PROFILE_ANALYSIS_VISIBLE_LIMIT
    ? PROFILE_ANALYSIS_PRIORITIES.visibleQueue
    : PROFILE_ANALYSIS_PRIORITIES.background;
}

class LolProfileAnalysisQueue {
  private readonly jobs = new Map<string, ProfileAnalysisJob>();
  private running = false;
  private timer?: ReturnType<typeof setTimeout>;
  private sequence = 0;

  enqueue(
    ctx: ModuleContext,
    config: LolParticipationProfileConfig,
    entryId: string,
    options: { force?: boolean; priority?: number; delayMs?: number } = {}
  ): Promise<boolean> {
    const entry = ctx.store.getParticipationEntryById(entryId);
    if (!entry) return Promise.resolve(false);

    const key = profileIdentityKey(entry);
    const priority = options.priority ?? visibleQueuePriority(ctx, entryId);
    const notBefore = Date.now() + Math.max(0, options.delayMs ?? 0);
    const existing = this.jobs.get(key);

    return new Promise<boolean>((resolve, reject) => {
      if (existing) {
        existing.entryIds.add(entryId);
        existing.force = existing.force || Boolean(options.force);
        existing.priority = Math.max(existing.priority, priority);
        existing.notBefore = Math.min(existing.notBefore, notBefore);
        existing.resolvers.push(resolve);
        existing.rejecters.push(reject);
      } else {
        this.jobs.set(key, {
          key,
          ctx,
          config,
          entryIds: new Set([entryId]),
          force: Boolean(options.force),
          priority,
          notBefore,
          sequence: this.sequence++,
          resolvers: [resolve],
          rejecters: [reject]
        });
      }
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.running) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const next = this.nextReadyJob() ?? this.nextDelayedJob();
    if (!next) return;
    const delayMs = Math.max(0, next.notBefore - Date.now());
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, delayMs);
    this.timer.unref?.();
  }

  private nextReadyJob(): ProfileAnalysisJob | undefined {
    const now = Date.now();
    return this.sortedJobs().find((job) => job.notBefore <= now);
  }

  private nextDelayedJob(): ProfileAnalysisJob | undefined {
    return this.sortedJobs().sort((a, b) => a.notBefore - b.notBefore || b.priority - a.priority || a.sequence - b.sequence)[0];
  }

  private sortedJobs(): ProfileAnalysisJob[] {
    return [...this.jobs.values()].sort((a, b) => b.priority - a.priority || a.notBefore - b.notBefore || a.sequence - b.sequence);
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const job = this.nextReadyJob();
        if (!job) return;
        this.jobs.delete(job.key);
        try {
          const result = await this.runJob(job);
          for (const resolve of job.resolvers) resolve(result);
        } catch (error) {
          for (const reject of job.rejecters) reject(error);
        }
      }
    } finally {
      this.running = false;
      this.schedule();
    }
  }

  private async runJob(job: ProfileAnalysisJob): Promise<boolean> {
    const entryIds = [...job.entryIds];
    const primaryEntryId = entryIds.find((entryId) => job.ctx.store.getParticipationEntryById(entryId));
    if (!primaryEntryId) return false;
    let analyzed = await analyzeEntry(job.ctx, job.config, primaryEntryId, job.force);
    for (const entryId of entryIds) {
      if (entryId === primaryEntryId) continue;
      analyzed = await analyzeEntry(job.ctx, job.config, entryId, false) || analyzed;
    }
    return analyzed;
  }
}

let activeProfileAnalysisQueue: LolProfileAnalysisQueue | undefined;

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
    activeProfileAnalysisQueue = new LolProfileAnalysisQueue();

    ctx.events.on<ParticipationEntryCreatedInternalEvent>("participation.entryCreated", (event) => {
      const priority = visibleQueuePriority(ctx, event.entryId);
      const delayMs = priority >= PROFILE_ANALYSIS_PRIORITIES.visibleQueue ? 0 : PROFILE_ANALYSIS_DEFER_MS;
      void activeProfileAnalysisQueue?.enqueue(ctx, config, event.entryId, { priority, delayMs }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        ctx.logger.error({ type: "lol_profile.background_failed", entryId: event.entryId, error: message });
      });
    });
  }
};

export async function refreshLolProfileForEntry(ctx: ModuleContext, entryId: string): Promise<boolean> {
  const config = loadLolParticipationProfileConfig();
  if (!activeProfileAnalysisQueue) return analyzeEntry(ctx, config, entryId, true);
  return activeProfileAnalysisQueue.enqueue(ctx, config, entryId, {
    force: true,
    priority: PROFILE_ANALYSIS_PRIORITIES.manual,
    delayMs: 0
  });
}

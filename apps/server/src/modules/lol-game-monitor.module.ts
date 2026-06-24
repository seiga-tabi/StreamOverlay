import fs from "node:fs";
import path from "node:path";
import type { LolGameMonitorSettings, ParticipationEntry, ParticipationPublicQueueEntry, ParticipationStreamerProfile } from "@streamops/shared";
import { formatRiotId, parseRiotIdDetailed, toSafeErrorMessage } from "@streamops/shared";
import type { BotModule, ModuleContext } from "../core/module.js";
import { appConfig } from "../config.js";
import type { RiotCurrentGameInfo } from "../services/riot-api.js";
import type { LolProfilePatch } from "../services/lol-profile-enrichment.js";
import { loadLolParticipationProfileConfig } from "./lol-profile-enrichment.module.js";

export type LolGameMonitorConfig = LolGameMonitorSettings;

type ParticipationSettingsFile = {
  mode?: "normal5" | "custom5v5" | "aram" | "onevone";
  checkInSeconds: number;
};

type LolParticipationConfigFile = {
  gameMonitor?: Partial<LolGameMonitorConfig>;
};

const DEFAULT_MONITOR_CONFIG: LolGameMonitorConfig = {
  enabled: false,
  streamerRiotId: "",
  pollIntervalMs: 45_000,
  gameEndDebounceMs: 90_000,
  autoSelectNextAfterGame: true,
  announceInChat: true
};

const DEFAULT_PARTICIPATION_SETTINGS: ParticipationSettingsFile = {
  mode: "normal5",
  checkInSeconds: 60
};

const LOL_PARTICIPATION_CONFIG_FILE = "lol-participation.json";
const LOL_GAME_MONITOR_STATE_FILE = "lol-game-monitor.json";

function lolParticipationConfigPath(): string {
  return path.join(appConfig.paths.config, LOL_PARTICIPATION_CONFIG_FILE);
}

function lolGameMonitorStatePath(): string {
  return path.join(appConfig.paths.state, LOL_GAME_MONITOR_STATE_FILE);
}

function readJsonRecord(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function numberValue(value: unknown, fallback: number, minimum: number): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.trunc(number));
}

function normalizeGameMonitorConfig(config: Partial<LolGameMonitorConfig>): LolGameMonitorConfig {
  return {
    enabled: typeof config.enabled === "boolean" ? config.enabled : DEFAULT_MONITOR_CONFIG.enabled,
    streamerRiotId: typeof config.streamerRiotId === "string" ? config.streamerRiotId : DEFAULT_MONITOR_CONFIG.streamerRiotId,
    pollIntervalMs: numberValue(config.pollIntervalMs, DEFAULT_MONITOR_CONFIG.pollIntervalMs, 10_000),
    gameEndDebounceMs: numberValue(config.gameEndDebounceMs, DEFAULT_MONITOR_CONFIG.gameEndDebounceMs, 0),
    autoSelectNextAfterGame: typeof config.autoSelectNextAfterGame === "boolean" ? config.autoSelectNextAfterGame : DEFAULT_MONITOR_CONFIG.autoSelectNextAfterGame,
    announceInChat: typeof config.announceInChat === "boolean" ? config.announceInChat : DEFAULT_MONITOR_CONFIG.announceInChat
  };
}

function loadConfiguredGameMonitor(): Partial<LolGameMonitorConfig> {
  const parsed = readJsonRecord(lolParticipationConfigPath()) as LolParticipationConfigFile;
  return (objectValue(parsed.gameMonitor) as Partial<LolGameMonitorConfig> | undefined) ?? {};
}

function loadStoredGameMonitor(): Partial<LolGameMonitorConfig> {
  const parsed = readJsonRecord(lolGameMonitorStatePath());
  return (objectValue(parsed.gameMonitor) as Partial<LolGameMonitorConfig> | undefined) ?? (parsed as Partial<LolGameMonitorConfig>);
}

export function loadGameMonitorConfig(): LolGameMonitorConfig {
  return normalizeGameMonitorConfig({
    ...DEFAULT_MONITOR_CONFIG,
    ...loadConfiguredGameMonitor(),
    ...loadStoredGameMonitor()
  });
}

export function saveGameMonitorConfig(patch: Partial<LolGameMonitorConfig>): LolGameMonitorConfig {
  const filePath = lolGameMonitorStatePath();
  const next = normalizeGameMonitorConfig({
    ...loadGameMonitorConfig(),
    ...patch
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return loadGameMonitorConfig();
}

function loadParticipationSettings(): ParticipationSettingsFile {
  const filePath = path.join(appConfig.paths.config, "participation.json");
  if (!fs.existsSync(filePath)) return DEFAULT_PARTICIPATION_SETTINGS;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<ParticipationSettingsFile>;
  return {
    mode: parsed.mode ?? DEFAULT_PARTICIPATION_SETTINGS.mode,
    checkInSeconds: parsed.checkInSeconds ?? DEFAULT_PARTICIPATION_SETTINGS.checkInSeconds
  };
}

function isParticipationOpen(ctx: ModuleContext): boolean {
  return ctx.store.getStatus().participation === "open";
}

function overlayEntryFromParticipation(entry: ParticipationEntry, position: number): ParticipationPublicQueueEntry {
  return {
    position,
    twitchUserName: entry.twitchUserName,
    preferredRole: entry.preferredRole,
    status: entry.status,
    requestedRole: entry.requestedRole,
    profileStatus: entry.profileStatus,
    mainRole: entry.mainRole,
    mainRoleConfidence: entry.mainRoleConfidence,
    topChampions: entry.topChampions ? entry.topChampions.map((champion) => ({ ...champion })) : undefined,
    rankedStats: entry.rankedStats
  };
}

function currentGameParticipantPuuids(game: RiotCurrentGameInfo): string[] {
  return game.participants
    .map((participant) => participant.puuid)
    .filter((puuid): puuid is string => typeof puuid === "string" && puuid.length > 0);
}

function streamerProfileFromPatch(displayName: string, tagLine: string, patch: LolProfilePatch): ParticipationStreamerProfile {
  return {
    displayName,
    riotTagLine: tagLine,
    profileStatus: patch.profileStatus,
    mainRole: patch.mainRole,
    mainRoleConfidence: patch.mainRoleConfidence,
    ladderRank: patch.ladderRank,
    topChampions: patch.topChampions?.map((champion) => ({ ...champion })),
    rankedStats: patch.rankedStats ? { ...patch.rankedStats } : undefined,
    performanceStats: patch.performanceStats ? { ...patch.performanceStats } : undefined,
    recentMatches: patch.recentMatches?.map((match) => ({ ...match })),
    rankHistory: patch.rankHistory?.map((point) => ({ ...point }))
  };
}

function regionFromTagLine(tagLine: string): string {
  const normalized = tagLine.trim().replace(/\d+$/u, "").toUpperCase();
  return normalized || tagLine.trim().toUpperCase() || "KR";
}

function soloRankQueueLabel(profile: ParticipationStreamerProfile | undefined): string {
  if (profile?.rankedStats?.queueType === "RANKED_FLEX_SR") return "Flex";
  return "Solo/Duo";
}

export class LolGameMonitorController {
  private streamerPuuid?: string;
  private streamerRegion?: string;
  private timer?: NodeJS.Timeout;
  private inGame = false;
  private lastGameId?: string;
  private missingSince?: number;

  constructor(
    private readonly ctx: ModuleContext,
    private config: LolGameMonitorConfig,
    private settings: ParticipationSettingsFile,
    private readonly now = () => Date.now()
  ) {}

  getConfig(): LolGameMonitorConfig {
    return { ...this.config };
  }

  async restart(config = this.config, settings = this.settings): Promise<void> {
    this.stop();
    this.config = config;
    this.settings = settings;
    this.streamerPuuid = undefined;
    this.streamerRegion = undefined;
    this.inGame = false;
    this.lastGameId = undefined;
    this.missingSince = undefined;
    await this.start();
  }

  async start(): Promise<void> {
    if (!this.config.enabled) {
      this.ctx.logger.event({ type: "lol_game_monitor.disabled" });
      return;
    }
    if (!this.ctx.riot.isConfigured()) {
      this.ctx.logger.error({ type: "lol_game_monitor.disabled", reason: "RIOT_API_KEY가 없습니다." });
      return;
    }
    if (!this.config.streamerRiotId.trim()) {
      this.ctx.logger.event({ type: "lol_game_monitor.waiting_for_streamer_riot_id" });
      return;
    }

    const parsed = parseRiotIdDetailed(this.config.streamerRiotId);
    if (!parsed.ok) {
      this.ctx.logger.error({ type: "lol_game_monitor.disabled", reason: parsed.message });
      return;
    }

    const riotId = formatRiotId(parsed.gameName, parsed.tagLine);
    let account: Awaited<ReturnType<ModuleContext["riot"]["getAccountByRiotId"]>>;
    try {
      account = await this.ctx.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
    } catch (error) {
      this.ctx.logger.error({ type: "lol_game_monitor.disabled", reason: toSafeErrorMessage(error), riotId });
      return;
    }

    if (!account?.puuid) {
      this.ctx.logger.error({ type: "lol_game_monitor.disabled", reason: "방송자 Riot 계정을 찾을 수 없습니다.", riotId });
      return;
    }

    this.streamerPuuid = account.puuid;
    this.streamerRegion = regionFromTagLine(account.tagLine);
    this.ctx.logger.event({ type: "lol_game_monitor.started", riotId, pollIntervalMs: this.config.pollIntervalMs });
    void this.refreshStreamerProfile(account.gameName, account.tagLine, account.puuid).catch((error) => {
      this.ctx.logger.error({ type: "lol_game_monitor.streamer_profile_failed", error: toSafeErrorMessage(error), riotId });
    });
    await this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), this.config.pollIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async pollOnce(): Promise<void> {
    if (!this.streamerPuuid) return;
    try {
      const currentGame = await this.ctx.riot.getCurrentGameByPuuid(this.streamerPuuid);
      if (currentGame) {
        await this.handleActiveGame(currentGame);
        return;
      }
      await this.handleNoActiveGame();
    } catch (error) {
      this.ctx.logger.error({ type: "lol_game_monitor.poll_failed", error: toSafeErrorMessage(error) });
    }
  }

  async refreshStreamerProfileFromConfig(force = true): Promise<ParticipationStreamerProfile | undefined> {
    if (!this.ctx.riot.isConfigured()) throw new Error("RIOT_API_KEY가 설정되지 않았습니다.");
    const parsed = parseRiotIdDetailed(this.config.streamerRiotId);
    if (!parsed.ok) throw new Error(parsed.message);
    const account = await this.ctx.riot.getAccountByRiotId(parsed.gameName, parsed.tagLine);
    if (!account?.puuid) throw new Error("방송자 Riot 계정을 찾을 수 없습니다.");
    this.streamerPuuid = account.puuid;
    this.streamerRegion = regionFromTagLine(account.tagLine);
    return this.refreshStreamerProfile(account.gameName, account.tagLine, account.puuid, force);
  }

  private async refreshStreamerProfile(gameName: string, tagLine: string, puuid: string, force = false): Promise<ParticipationStreamerProfile | undefined> {
    if (!this.ctx.lolProfileEnrichment) return;
    const profileConfig = loadLolParticipationProfileConfig();
    if (!profileConfig.enabled) return;
    this.ctx.store.setParticipationStreamerProfile({ displayName: gameName, riotTagLine: tagLine, profileStatus: "analyzing" });
    this.broadcastStatus(this.inGame ? "in_game" : "recruiting", this.ctx.store.getNextWaitingParticipationOverlayEntry());
    this.broadcastSoloRankProfile(regionFromTagLine(tagLine));
    const now = new Date().toISOString();
    const profileEntry: ParticipationEntry = {
      id: "streamer-profile",
      twitchUserId: "broadcaster",
      twitchUserName: "Streamer",
      riotGameName: gameName,
      riotTagLine: tagLine,
      riotPuuid: puuid,
      preferredRole: "fill",
      status: "verified",
      source: "dashboard",
      createdAt: now,
      updatedAt: now
    };
    const cached = force ? undefined : this.ctx.lolProfileEnrichment.getCachedPatch(profileEntry, profileConfig);
    const patch = cached ?? await this.ctx.lolProfileEnrichment.enrich(profileEntry, profileConfig, force);
    const profile = this.ctx.store.setParticipationStreamerProfile(streamerProfileFromPatch(gameName, tagLine, patch));
    this.ctx.logger.event({ type: "lol_game_monitor.streamer_profile_ready", riotId: formatRiotId(gameName, tagLine), profileStatus: profile?.profileStatus, mainRole: profile?.mainRole });
    this.broadcastStatus(this.inGame ? "in_game" : "recruiting", this.ctx.store.getNextWaitingParticipationOverlayEntry());
    this.broadcastSoloRankProfile(regionFromTagLine(tagLine));
    this.ctx.dashboard.broadcastSnapshot();
    return profile;
  }

  private async handleActiveGame(game: RiotCurrentGameInfo): Promise<void> {
    const gameId = String(game.gameId);
    this.missingSince = undefined;
    if (this.inGame && this.lastGameId === gameId) return;

    this.inGame = true;
    this.lastGameId = gameId;
    const changed = this.ctx.store.markVisibleParticipationQueueInGame({ participantPuuids: currentGameParticipantPuuids(game) });
    const nextCandidate = this.ctx.store.getNextWaitingParticipationOverlayEntry();
    this.ctx.logger.event({ type: "lol_game_monitor.game_started", gameId, changedEntries: changed.map((entry) => entry.id) });
    this.broadcastStatus("in_game", nextCandidate);
    this.broadcastQueue();
    this.ctx.dashboard.broadcastSnapshot();
  }

  private async handleNoActiveGame(): Promise<void> {
    if (!this.inGame) return;
    const now = this.now();
    if (this.missingSince === undefined) {
      this.missingSince = now;
      if (this.config.gameEndDebounceMs > 0) return;
    }
    if (now - this.missingSince < this.config.gameEndDebounceMs) return;
    await this.handleGameEnded();
  }

  private async handleGameEnded(): Promise<void> {
    const gameId = this.lastGameId;
    this.inGame = false;
    this.lastGameId = undefined;
    this.missingSince = undefined;

    const played = this.ctx.store.markInGameParticipantsPlayed();
    const nextBeforeSelection = this.ctx.store.getNextWaitingParticipationOverlayEntry();
    const selected = this.config.autoSelectNextAfterGame && isParticipationOpen(this.ctx)
      ? this.ctx.store.selectNextParticipant(this.settings.checkInSeconds)
      : undefined;
    const nextCandidate = selected ? overlayEntryFromParticipation(selected, 1) : nextBeforeSelection;

    this.ctx.logger.event({
      type: "lol_game_monitor.game_ended",
      gameId,
      playedEntries: played.map((entry) => entry.id),
      selectedEntryId: selected?.id,
      autoSelectNextAfterGame: this.config.autoSelectNextAfterGame
    });

    this.broadcastStatus("game_ended", nextCandidate);
    this.broadcastQueue();

    this.ctx.dashboard.broadcastSnapshot();
  }

  private broadcastStatus(phase: "recruiting" | "in_game" | "game_ended", nextCandidate?: ParticipationPublicQueueEntry): void {
    this.ctx.overlay.broadcast({
      type: "participation.status.update",
      isOpen: isParticipationOpen(this.ctx),
      mode: this.settings.mode,
      phase,
      nextCandidate,
      streamerProfile: this.ctx.store.getParticipationStreamerProfile(),
      source: "lol.game_monitor"
    });
  }

  private broadcastQueue(): void {
    this.ctx.overlay.broadcast({
      type: "participation.queue.update",
      isOpen: isParticipationOpen(this.ctx),
      queue: this.ctx.store.getParticipationOverlayQueue(),
      source: "lol.game_monitor"
    });
  }

  private broadcastSoloRankProfile(region = this.streamerRegion): void {
    const profile = this.ctx.store.getParticipationStreamerProfile();
    if (!profile) return;
    this.ctx.overlay.broadcast({
      type: "solo-rank.profile.update",
      profile,
      region,
      queueLabel: soloRankQueueLabel(profile),
      ladderRank: profile.ladderRank,
      source: "lol.game_monitor"
    });
  }
}

export const lolGameMonitorModule: BotModule = {
  name: "lol-game-monitor",
  setup(ctx) {
    const controller = new LolGameMonitorController(ctx, loadGameMonitorConfig(), loadParticipationSettings());
    activeLolGameMonitorController = controller;
    void controller.start();
  }
};

let activeLolGameMonitorController: LolGameMonitorController | undefined;

export function getActiveLolGameMonitorController(): LolGameMonitorController | undefined {
  return activeLolGameMonitorController;
}

export async function restartActiveLolGameMonitor(config = loadGameMonitorConfig()): Promise<boolean> {
  if (!activeLolGameMonitorController) return false;
  await activeLolGameMonitorController.restart(config, loadParticipationSettings());
  return true;
}

export async function refreshActiveStreamerProfile(force = true): Promise<ParticipationStreamerProfile | undefined> {
  if (!activeLolGameMonitorController) return undefined;
  return activeLolGameMonitorController.refreshStreamerProfileFromConfig(force);
}

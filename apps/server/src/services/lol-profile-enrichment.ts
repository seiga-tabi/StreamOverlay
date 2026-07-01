import type { LolChampionSummary, LolMainRole, LolPerformanceStats, LolProfileStatus, LolRankedStats, LolRankHistoryPoint, LolRankTier, LolRecentMatchChampion, ParticipationEntry } from "@streamops/shared";
import { formatRiotId, normalizeRiotIdKey, toSafeErrorMessage } from "@streamops/shared";
import type { JsonlLogger } from "../logging/jsonl-logger.js";
import { DataDragonService } from "./data-dragon.js";
import { RiotApiClient, RiotApiHttpError, RiotRateLimitError, type RiotMatch } from "./riot-api.js";
import type { LolProfileCacheEntry, LolProfileRepository } from "./lol-profile-store.js";

export type LolParticipationProfileConfig = {
  enabled: boolean;
  showRiotIdPublicly: boolean;
  profileCacheTtlHours: number;
  matchAnalysisCount: number;
  mainRoleMinConfidence: number;
  enabledQueues: number[];
  championSkinOverrides?: Record<string, number>;
  rateLimit: {
    backoffMs: number;
    maxBackoffMs: number;
  };
};

export type LolProfilePatch = {
  profileStatus: LolProfileStatus;
  profileFailureReason?: string;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  ladderRank?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
  performanceStats?: LolPerformanceStats;
  recentMatches?: LolRecentMatchChampion[];
  rankHistory?: LolRankHistoryPoint[];
  verifiedRank?: string;
  profileAnalyzedAt?: string;
  riotPuuid?: string;
};

const ROLE_ORDER: LolMainRole[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const STREAMER_RECENT_MATCH_LIMIT = 10;
const RANK_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RANK_HISTORY_MAX_POINTS = 64;
const RANK_TIER_SCORE: Record<LolRankTier, number> = {
  UNRANKED: 0,
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 3200,
  CHALLENGER: 3600
};
const RANK_DIVISION_SCORE: Record<string, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300
};
const POSITION_ALIASES: Record<string, LolMainRole> = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MIDDLE: "MIDDLE",
  MID: "MIDDLE",
  BOTTOM: "BOTTOM",
  BOT: "BOTTOM",
  ADC: "BOTTOM",
  UTILITY: "UTILITY",
  SUPPORT: "UTILITY"
};

export function inferMainRoleFromMatches(matches: RiotMatch[], puuid: string, minConfidence = 45): {
  mainRole: LolMainRole;
  confidence: number;
  sampleSize: number;
} {
  const counts = new Map<LolMainRole, number>();
  let sampleSize = 0;

  for (const match of matches) {
    const participant = match.info.participants.find((item) => item.puuid === puuid);
    const rawPosition = participant?.individualPosition || participant?.teamPosition;
    const role = rawPosition ? POSITION_ALIASES[rawPosition.toUpperCase()] : undefined;
    if (!role) continue;
    counts.set(role, (counts.get(role) ?? 0) + 1);
    sampleSize += 1;
  }

  if (sampleSize === 0) return { mainRole: "UNKNOWN", confidence: 0, sampleSize: 0 };
  const [mainRole, count] = ROLE_ORDER
    .map((role) => [role, counts.get(role) ?? 0] as const)
    .sort((a, b) => b[1] - a[1])[0] ?? ["UNKNOWN", 0];
  const confidence = Math.round((count / sampleSize) * 100);
  return {
    mainRole: confidence >= minConfidence ? mainRole : "FILL",
    confidence,
    sampleSize
  };
}

export function topChampionsFromMatches(matches: RiotMatch[], puuid: string): Array<{ championId: number; games: number }> {
  const counts = new Map<number, number>();
  for (const match of matches) {
    const participant = match.info.participants.find((item) => item.puuid === puuid);
    if (!participant?.championId) continue;
    counts.set(participant.championId, (counts.get(participant.championId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([championId, games]) => ({ championId, games }));
}

function roundStat(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function performanceStatsFromMatches(matches: RiotMatch[], puuid: string): LolPerformanceStats | undefined {
  let sampleSize = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;

  for (const match of matches) {
    const participant = match.info.participants.find((item) => item.puuid === puuid);
    if (!participant) continue;
    if (
      typeof participant.kills !== "number" ||
      typeof participant.deaths !== "number" ||
      typeof participant.assists !== "number" ||
      !Number.isFinite(participant.kills) ||
      !Number.isFinite(participant.deaths) ||
      !Number.isFinite(participant.assists)
    ) {
      continue;
    }

    sampleSize += 1;
    kills += Math.max(0, participant.kills);
    deaths += Math.max(0, participant.deaths);
    assists += Math.max(0, participant.assists);
  }

  if (sampleSize === 0) return undefined;
  return {
    sampleSize,
    averageKills: roundStat(kills / sampleSize, 1),
    averageDeaths: roundStat(deaths / sampleSize, 1),
    averageAssists: roundStat(assists / sampleSize, 1),
    kda: roundStat((kills + assists) / Math.max(1, deaths), 2)
  };
}

function skinOverridesKey(config: LolParticipationProfileConfig, entry: ParticipationEntry): string | undefined {
  if (entry.id !== "streamer-profile") return undefined;
  const entries = Object.entries(config.championSkinOverrides ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return entries.length > 0 ? JSON.stringify(entries) : undefined;
}

function isFresh(entry: LolProfileCacheEntry, ttlHours: number, skinKey?: string): boolean {
  if (entry.status !== "ready" || !entry.analyzedAt) return false;
  if (skinKey !== undefined && entry.championSkinOverridesKey !== skinKey) return false;
  const analyzedAt = Date.parse(entry.analyzedAt);
  if (!Number.isFinite(analyzedAt)) return false;
  return Date.now() - analyzedAt < ttlHours * 60 * 60 * 1000;
}

function isBackoffActive(entry: LolProfileCacheEntry): boolean {
  if (entry.status !== "rate_limited" || !entry.nextRetryAt) return false;
  const nextRetryAt = Date.parse(entry.nextRetryAt);
  return Number.isFinite(nextRetryAt) && nextRetryAt > Date.now();
}

function isUsablePuuid(puuid: string | undefined): puuid is string {
  return typeof puuid === "string" && /^[A-Za-z0-9_-]{40,}$/.test(puuid);
}

function rankLabel(stats: LolRankedStats | undefined): string | undefined {
  if (!stats) return undefined;
  if (stats.tier === "UNRANKED") return stats.summonerLevel ? `Unranked Lv.${stats.summonerLevel}` : "Unranked";
  const queue = stats.queueType === "RANKED_FLEX_SR"
    ? "자유랭크"
    : stats.queueType === "RANKED_TEAM_5x5"
      ? "5v5 랭크"
      : "솔로랭크";
  return `${queue} ${stats.tier}${stats.rank ? ` ${stats.rank}` : ""} ${stats.leaguePoints}LP`;
}

function rankScore(stats: LolRankedStats): number {
  if (stats.tier === "UNRANKED") return 0;
  return RANK_TIER_SCORE[stats.tier] + (stats.rank ? RANK_DIVISION_SCORE[stats.rank] ?? 0 : 0) + Math.max(0, Math.trunc(stats.leaguePoints));
}

export function buildRankHistory(previous: LolRankHistoryPoint[] | undefined, stats: LolRankedStats | undefined, analyzedAt: string): LolRankHistoryPoint[] | undefined {
  const cutoff = Date.parse(analyzedAt) - RANK_HISTORY_WINDOW_MS;
  const previousPoints = (previous ?? [])
    .filter((point) => {
      const time = Date.parse(point.date);
      return Number.isFinite(time);
    })
    .map((point) => ({ ...point }))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const baseline = previousPoints
    .filter((point) => Date.parse(point.date) < cutoff)
    .at(-1);
  const history = [
    ...(baseline ? [{ ...baseline }] : []),
    ...previousPoints
      .filter((point) => Date.parse(point.date) >= cutoff)
      .map((point) => ({ ...point }))
  ];

  if (!stats) return history.length > 0 ? history.slice(-RANK_HISTORY_MAX_POINTS) : undefined;

  const point: LolRankHistoryPoint = {
    date: analyzedAt,
    tier: stats.tier,
    rank: stats.rank,
    leaguePoints: stats.leaguePoints,
    wins: stats.wins,
    losses: stats.losses,
    rankScore: rankScore(stats)
  };
  const last = history.at(-1);
  const lastAt = last ? Date.parse(last.date) : 0;
  if (last && Number.isFinite(lastAt) && Date.parse(analyzedAt) - lastAt < 15 * 60 * 1000) {
    history[history.length - 1] = point;
  } else {
    history.push(point);
  }
  return history.slice(-RANK_HISTORY_MAX_POINTS);
}

function patchFromProfile(profile: LolProfileCacheEntry): LolProfilePatch {
  return {
    profileStatus: profile.status,
    mainRole: profile.mainRole,
    mainRoleConfidence: profile.mainRoleConfidence,
    ladderRank: profile.ladderRank,
    topChampions: profile.topChampions?.map((champion) => ({ ...champion })),
    rankedStats: profile.rankedStats ? { ...profile.rankedStats } : undefined,
    performanceStats: profile.performanceStats ? { ...profile.performanceStats } : undefined,
    recentMatches: profile.recentMatches?.map((match) => ({ ...match })),
    rankHistory: profile.rankHistory?.map((point) => ({ ...point })),
    verifiedRank: rankLabel(profile.rankedStats),
    profileAnalyzedAt: profile.analyzedAt,
    profileFailureReason: profile.failedReason,
    riotPuuid: isUsablePuuid(profile.riotPuuid) ? profile.riotPuuid : undefined
  };
}

function profileFailureReason(error: unknown): string {
  if (error instanceof RiotApiHttpError && (error.status === 401 || error.status === 403)) {
    return "RIOT_API_KEY가 유효하지 않거나 만료되었습니다. Riot Developer Portal에서 새 key를 발급한 뒤 dashboard 설정 화면 또는 서버 .env에 적용하세요.";
  }
  if (error instanceof RiotApiHttpError && error.status === 429) return "Riot API rate limit에 도달했습니다.";
  return toSafeErrorMessage(error);
}

function shouldFailProfileAnalysis(error: unknown): boolean {
  return error instanceof RiotRateLimitError || (error instanceof RiotApiHttpError && (error.status === 401 || error.status === 403));
}

export class LolProfileEnrichmentService {
  constructor(
    private readonly riot: RiotApiClient,
    private readonly dataDragon: DataDragonService,
    private readonly profiles: LolProfileRepository,
    private readonly logger: JsonlLogger
  ) {}

  getCachedPatch(entry: ParticipationEntry, config: LolParticipationProfileConfig): LolProfilePatch | undefined {
    const cached = isUsablePuuid(entry.riotPuuid)
      ? this.profiles.getByPuuid(entry.riotPuuid)
      : this.profiles.getByRiotId(entry.riotGameName, entry.riotTagLine);
    if (!cached) return undefined;
    if (isBackoffActive(cached) || isFresh(cached, config.profileCacheTtlHours, skinOverridesKey(config, entry))) return patchFromProfile(cached);
    return undefined;
  }

  async enrich(entry: ParticipationEntry, config: LolParticipationProfileConfig, force = false): Promise<LolProfilePatch> {
    const cached = isUsablePuuid(entry.riotPuuid)
      ? this.profiles.getByPuuid(entry.riotPuuid)
      : this.profiles.getByRiotId(entry.riotGameName, entry.riotTagLine);
    const currentSkinOverridesKey = skinOverridesKey(config, entry);
    const isStreamerProfile = entry.id === "streamer-profile";
    const skinOverrides = isStreamerProfile ? config.championSkinOverrides : undefined;
    const matchQueueIds = isStreamerProfile ? [420] : config.enabledQueues;
    if (!force && cached && (isBackoffActive(cached) || isFresh(cached, config.profileCacheTtlHours, currentSkinOverridesKey))) {
      return patchFromProfile(cached);
    }

    if (!this.riot.isConfigured()) {
      return this.saveFailure(entry, "failed", "RIOT_API_KEY가 설정되지 않았습니다.");
    }

    try {
      const account = isUsablePuuid(entry.riotPuuid)
        ? { puuid: entry.riotPuuid, gameName: entry.riotGameName, tagLine: entry.riotTagLine }
        : await this.riot.getAccountByRiotId(entry.riotGameName, entry.riotTagLine);
      if (!account) return this.saveFailure(entry, "failed", "Riot 계정을 찾을 수 없습니다.");

      const [topChampions, rankedStats, ladderRank, matches] = await Promise.all([
        this.getTopChampions(account.puuid, skinOverrides).catch((error) => {
          if (shouldFailProfileAnalysis(error)) throw error;
          this.logger.error({ type: "lol_profile.mastery_lookup_failed", error: toSafeErrorMessage(error), riotId: formatRiotId(entry.riotGameName, entry.riotTagLine) });
          return [];
        }),
        this.riot.getRankedStatsByPuuid(account.puuid, isStreamerProfile ? ["RANKED_SOLO_5x5"] : undefined).catch((error) => {
          if (shouldFailProfileAnalysis(error)) throw error;
          this.logger.error({ type: "lol_profile.rank_lookup_failed", error: toSafeErrorMessage(error), riotId: formatRiotId(entry.riotGameName, entry.riotTagLine) });
          return undefined;
        }),
        isStreamerProfile && typeof this.riot.getLadderRankByPuuid === "function"
          ? this.riot.getLadderRankByPuuid(account.puuid, ["RANKED_SOLO_5x5"]).catch((error) => {
            if (shouldFailProfileAnalysis(error)) throw error;
            this.logger.error({ type: "lol_profile.ladder_rank_lookup_failed", error: toSafeErrorMessage(error), riotId: formatRiotId(entry.riotGameName, entry.riotTagLine) });
            return undefined;
          })
          : Promise.resolve(undefined),
        this.getRecentMatches(account.puuid, config.matchAnalysisCount, matchQueueIds).catch((error) => {
          if (shouldFailProfileAnalysis(error)) throw error;
          this.logger.error({ type: "lol_profile.match_lookup_failed", error: toSafeErrorMessage(error), riotId: formatRiotId(entry.riotGameName, entry.riotTagLine) });
          return [];
        })
      ]);

      const role = inferMainRoleFromMatches(matches, account.puuid, config.mainRoleMinConfidence);
      const performanceStats = performanceStatsFromMatches(matches, account.puuid);
      const recentMatches = await this.recentMatchChampionsFromMatches(matches, account.puuid);
      const fallbackChampions = topChampions.length > 0
        ? topChampions
        : await Promise.all(topChampionsFromMatches(matches, account.puuid).map((champion) => this.dataDragon.mapChampionSummary({ ...champion, skinOverrides })));
      const analyzedAt = new Date().toISOString();
      const resolvedLadderRank = ladderRank ?? cached?.ladderRank;
      const rankHistory = buildRankHistory(cached?.rankHistory, rankedStats, analyzedAt);
      const profile = this.profiles.save({
        riotPuuid: account.puuid,
        riotGameName: account.gameName,
        riotTagLine: account.tagLine,
        riotIdKey: normalizeRiotIdKey(account.gameName, account.tagLine),
        status: "ready",
        mainRole: role.mainRole,
        mainRoleConfidence: role.confidence,
        ladderRank: resolvedLadderRank,
        topChampions: fallbackChampions,
        rankedStats,
        performanceStats,
        recentMatches,
        rankHistory,
        analyzedAt,
        championSkinOverridesKey: currentSkinOverridesKey
      });
      this.logger.event({ type: "lol_profile.ready", riotId: formatRiotId(entry.riotGameName, entry.riotTagLine), entryId: entry.id, mainRole: profile.mainRole });
      return patchFromProfile(profile);
    } catch (error) {
      if (error instanceof RiotRateLimitError) {
        const backoffMs = Math.min(error.retryAfterMs ?? config.rateLimit.backoffMs, config.rateLimit.maxBackoffMs);
        return this.saveFailure(entry, "rate_limited", "Riot API rate limit", backoffMs);
      }
      const reason = profileFailureReason(error);
      this.logger.error({ type: "lol_profile.enrichment_failed", error: reason, riotId: formatRiotId(entry.riotGameName, entry.riotTagLine), entryId: entry.id });
      return this.saveFailure(entry, "failed", reason);
    }
  }

  private async getTopChampions(puuid: string, skinOverrides?: Record<string, number>): Promise<LolChampionSummary[]> {
    const mastery = await this.riot.getChampionMasteryTopByPuuid(puuid, 3);
    return Promise.all(mastery.slice(0, 3).map((champion) => this.dataDragon.mapChampionSummary({
      championId: champion.championId,
      masteryLevel: champion.championLevel,
      masteryPoints: champion.championPoints,
      skinOverrides
    })));
  }

  private async getRecentMatches(puuid: string, count: number, queueIds: number[] = []): Promise<RiotMatch[]> {
    const matchIds = await this.riot.getRecentMatchIdsByPuuid(puuid, count, queueIds);
    const matches: RiotMatch[] = [];
    for (const matchId of matchIds.slice(0, count)) {
      const match = await this.riot.getMatch(matchId);
      if (match) matches.push(match);
    }
    return matches;
  }

  private async recentMatchChampionsFromMatches(matches: RiotMatch[], puuid: string): Promise<LolRecentMatchChampion[]> {
    const recent: LolRecentMatchChampion[] = [];
    for (const match of matches.slice(0, STREAMER_RECENT_MATCH_LIMIT)) {
      const participant = match.info.participants.find((item) => item.puuid === puuid);
      if (!participant?.championId || typeof participant.win !== "boolean") continue;
      const champion = await this.dataDragon.mapChampionSummary({ championId: participant.championId }).catch((): LolChampionSummary => ({
        championId: participant.championId,
        nameKo: `Champion ${participant.championId}`
      }));
      recent.push({
        championId: champion.championId,
        championKey: champion.championKey,
        nameKo: champion.nameKo,
        nameJa: champion.nameJa,
        iconUrl: champion.iconUrl,
        splashUrl: champion.splashUrl,
        loadingUrl: champion.loadingUrl,
        imageVersion: champion.imageVersion,
        imageLocale: champion.imageLocale,
        won: participant.win
      });
    }
    return recent;
  }

  private saveFailure(entry: ParticipationEntry, status: Exclude<LolProfileStatus, "pending" | "analyzing" | "ready">, reason: string, backoffMs?: number): LolProfilePatch {
    const analyzedAt = new Date().toISOString();
    const profile = this.profiles.save({
      riotPuuid: entry.riotPuuid ?? normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine),
      riotGameName: entry.riotGameName,
      riotTagLine: entry.riotTagLine,
      riotIdKey: normalizeRiotIdKey(entry.riotGameName, entry.riotTagLine),
      status,
      analyzedAt,
      failedReason: reason,
      nextRetryAt: backoffMs ? new Date(Date.now() + backoffMs).toISOString() : undefined
    });
    return patchFromProfile(profile);
  }
}

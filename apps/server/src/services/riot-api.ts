import { appConfig } from "../config.js";
import type { LolRankedStats, LolRankTier } from "@streamops/shared";
import { riotApiKeyStatus, type RiotApiKeyProvider, type RiotApiKeyStatus } from "./riot-api-key-store.js";

export type RiotAccount = {
  puuid: string;
  gameName: string;
  tagLine: string;
};

export type RiotSummoner = {
  id?: string;
  accountId?: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
};

export type RiotLeagueEntry = {
  leagueId?: string;
  summonerId?: string;
  puuid?: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

type RiotLeagueListEntry = {
  summonerId?: string;
  puuid?: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

type RiotLeagueList = {
  leagueId: string;
  entries: RiotLeagueListEntry[];
};

export type RiotChampionMastery = {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime?: number;
};

export type RiotMatchParticipant = {
  participantId?: number;
  puuid: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  teamId?: number;
  championId: number;
  championName?: string;
  champLevel?: number;
  individualPosition?: string;
  teamPosition?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  win?: boolean;
  goldEarned?: number;
  totalDamageDealtToChampions?: number;
  totalDamageDealtToObjectives?: number;
  totalDamageTaken?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  visionScore?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  detectorWardsPlaced?: number;
  largestMultiKill?: number;
  doubleKills?: number;
  tripleKills?: number;
  quadraKills?: number;
  pentaKills?: number;
  turretKills?: number;
  inhibitorKills?: number;
  objectivesStolen?: number;
  totalTimeSpentDead?: number;
  summoner1Id?: number;
  summoner2Id?: number;
  perks?: {
    statPerks?: {
      defense?: number;
      flex?: number;
      offense?: number;
    };
    styles?: Array<{
      description?: string;
      style?: number;
      selections?: Array<{
        perk?: number;
        var1?: number;
        var2?: number;
        var3?: number;
      }>;
    }>;
  };
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  challenges?: {
    killParticipation?: number;
    damagePerMinute?: number;
    goldPerMinute?: number;
    kda?: number;
    laneMinionsFirst10Minutes?: number;
    soloKills?: number;
    visionScorePerMinute?: number;
  };
};

export type RiotMatch = {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation?: number;
    gameDuration?: number;
    gameVersion?: string;
    gameMode?: string;
    gameType?: string;
    mapId?: number;
    queueId?: number;
    participants: RiotMatchParticipant[];
    teams?: Array<{
      teamId: number;
      win?: boolean;
      objectives?: Record<string, { first?: boolean; kills?: number }>;
    }>;
  };
};

export type RiotMatchTimelineEvent = {
  type?: string;
  timestamp?: number;
  participantId?: number;
  itemId?: number;
  skillSlot?: number;
  levelUpType?: string;
};

export type RiotMatchTimeline = {
  metadata: {
    matchId: string;
  };
  info: {
    frames: Array<{
      timestamp?: number;
      events?: RiotMatchTimelineEvent[];
    }>;
  };
};

export type RiotCurrentGameParticipant = {
  puuid?: string;
  summonerId?: string;
  riotId?: string;
  riotIdGameName?: string;
  riotIdTagline?: string;
  summonerName?: string;
  spell1Id?: number;
  spell2Id?: number;
  profileIconId?: number;
  bot?: boolean;
  championId: number;
  teamId: number;
};

export type RiotCurrentGameInfo = {
  gameId: number;
  gameStartTime: number;
  gameLength?: number;
  gameMode?: string;
  gameType?: string;
  gameQueueConfigId?: number;
  mapId?: number;
  participants: RiotCurrentGameParticipant[];
};

export class RiotRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
    readonly route?: string,
    readonly host?: string
  ) {
    super(message);
    this.name = "RiotRateLimitError";
  }
}

export class RiotApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly route: string,
    readonly host: string,
    body: string
  ) {
    super(`Riot API ${route} failed: ${status}${body ? ` ${body}` : ""}`);
    this.name = "RiotApiHttpError";
  }
}

export class RiotApiNetworkError extends Error {
  constructor(
    readonly route: string,
    readonly host: string,
    causeMessage: string,
    readonly causeCode?: string
  ) {
    super(`Riot API ${route} network failed at ${host}: ${causeCode ? `${causeCode} ` : ""}${causeMessage}`);
    this.name = "RiotApiNetworkError";
  }
}

export type RiotRateLimitWindow = {
  limit: number;
  windowMs: number;
};

type RiotRequestLimiterOptions = {
  enabled?: boolean;
  windows?: RiotRateLimitWindow[];
  maxQueueSize?: number;
  now?: () => number;
};

type RiotQueuedRequest<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

type RiotRateLimitBucket = {
  host: string;
  startedAt: number[];
  queue: RiotQueuedRequest<unknown>[];
  timer?: ReturnType<typeof setTimeout>;
  pauseUntil?: number;
};

const DEFAULT_RIOT_RATE_LIMIT_WINDOWS: RiotRateLimitWindow[] = [
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 }
];

const LOL_RANK_TIERS = new Set([
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
  "UNRANKED"
]);

const RANKED_QUEUE_PRIORITY = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR", "RANKED_TEAM_5x5"] as const;
export type RiotRankedQueueType = (typeof RANKED_QUEUE_PRIORITY)[number];
const RANKED_5V5_QUEUE_ALIASES = new Set(["RANKED_TEAM_5x5", "RANKED_PREMADE_5x5", "RANKED_5V5", "RANKED_5x5"]);
const RANK_DIVISION_SCORE: Record<string, number> = {
  I: 3,
  II: 2,
  III: 1,
  IV: 0
};

function normalizeRateLimitWindow(value: RiotRateLimitWindow): RiotRateLimitWindow | undefined {
  const limit = Math.trunc(value.limit);
  const windowMs = Math.trunc(value.windowMs);
  if (!Number.isFinite(limit) || !Number.isFinite(windowMs) || limit <= 0 || windowMs <= 0) return undefined;
  return { limit, windowMs };
}

export class RiotRequestLimiter {
  private readonly buckets = new Map<string, RiotRateLimitBucket>();
  private readonly enabled: boolean;
  private readonly windows: RiotRateLimitWindow[];
  private readonly maxQueueSize: number;
  private readonly now: () => number;
  private readonly maxWindowMs: number;

  constructor(options: RiotRequestLimiterOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.windows = (options.windows ?? DEFAULT_RIOT_RATE_LIMIT_WINDOWS)
      .map(normalizeRateLimitWindow)
      .filter((window): window is RiotRateLimitWindow => Boolean(window))
      .sort((a, b) => a.windowMs - b.windowMs);
    this.maxQueueSize = Math.max(1, Math.trunc(options.maxQueueSize ?? 500));
    this.now = options.now ?? (() => Date.now());
    this.maxWindowMs = Math.max(...this.windows.map((window) => window.windowMs), 0);
  }

  schedule<T>(host: string, run: () => Promise<T>): Promise<T> {
    if (!this.enabled || this.windows.length === 0) return run();
    const bucket = this.bucketFor(host);
    if (bucket.queue.length >= this.maxQueueSize) {
      return Promise.reject(new RiotRateLimitError("Riot API request queue is full", undefined, undefined, host));
    }
    return new Promise<T>((resolve, reject) => {
      bucket.queue.push({ run, resolve, reject } as RiotQueuedRequest<unknown>);
      this.drain(bucket);
    });
  }

  pause(host: string, retryAfterMs: number | undefined): void {
    if (!this.enabled || !retryAfterMs || retryAfterMs <= 0) return;
    const bucket = this.bucketFor(host);
    bucket.pauseUntil = Math.max(bucket.pauseUntil ?? 0, this.now() + retryAfterMs);
    this.scheduleDrain(bucket, retryAfterMs);
  }

  private bucketFor(host: string): RiotRateLimitBucket {
    const safeHostName = host || "unknown";
    const existing = this.buckets.get(safeHostName);
    if (existing) return existing;
    const bucket: RiotRateLimitBucket = {
      host: safeHostName,
      startedAt: [],
      queue: []
    };
    this.buckets.set(safeHostName, bucket);
    return bucket;
  }

  private compact(bucket: RiotRateLimitBucket, now: number): void {
    if (this.maxWindowMs <= 0) {
      bucket.startedAt = [];
      return;
    }
    bucket.startedAt = bucket.startedAt.filter((timestamp) => now - timestamp < this.maxWindowMs);
  }

  private canStart(bucket: RiotRateLimitBucket, now: number): boolean {
    if (bucket.pauseUntil && bucket.pauseUntil > now) return false;
    this.compact(bucket, now);
    return this.windows.every((window) => bucket.startedAt.filter((timestamp) => now - timestamp < window.windowMs).length < window.limit);
  }

  private nextDelayMs(bucket: RiotRateLimitBucket, now: number): number {
    let delayMs = bucket.pauseUntil && bucket.pauseUntil > now ? bucket.pauseUntil - now : 1;
    this.compact(bucket, now);
    for (const window of this.windows) {
      const active = bucket.startedAt
        .filter((timestamp) => now - timestamp < window.windowMs)
        .sort((a, b) => a - b);
      if (active.length < window.limit) continue;
      const oldestBlocking = active[active.length - window.limit] ?? active[0];
      if (oldestBlocking === undefined) continue;
      delayMs = Math.max(delayMs, oldestBlocking + window.windowMs - now + 5);
    }
    return Math.max(1, Math.ceil(delayMs));
  }

  private scheduleDrain(bucket: RiotRateLimitBucket, delayMs: number): void {
    if (bucket.timer) return;
    bucket.timer = setTimeout(() => {
      bucket.timer = undefined;
      this.drain(bucket);
    }, Math.max(1, Math.ceil(delayMs)));
  }

  private drain(bucket: RiotRateLimitBucket): void {
    if (bucket.timer) return;
    while (bucket.queue.length > 0) {
      const now = this.now();
      if (!this.canStart(bucket, now)) {
        this.scheduleDrain(bucket, this.nextDelayMs(bucket, now));
        return;
      }
      const item = bucket.queue.shift();
      if (!item) return;
      bucket.startedAt.push(now);
      void item.run().then(item.resolve, item.reject);
    }
  }
}

function rankedTierIconUrl(tier: LolRankTier): string | undefined {
  return tier === "UNRANKED" ? undefined : `/riot/ranked-emblems/${tier.toLowerCase()}.png?v=ranked-emblems-1`;
}

function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

function rankTier(value: string | undefined): LolRankTier {
  const tier = (value ?? "UNRANKED").toUpperCase();
  return LOL_RANK_TIERS.has(tier) ? (tier as LolRankTier) : "UNRANKED";
}

function safeStat(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function unrankedStatsFromSummoner(summoner: RiotSummoner | null): LolRankedStats {
  return {
    queueType: "UNRANKED",
    tier: "UNRANKED",
    leaguePoints: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    summonerLevel: summoner?.summonerLevel,
    profileIconId: summoner?.profileIconId,
    fetchedAt: new Date().toISOString()
  };
}

function rankedStatsFromEntry(rankedEntry: RiotLeagueEntry, summoner: RiotSummoner | null): LolRankedStats {
  const wins = Math.max(0, Math.trunc(rankedEntry.wins));
  const losses = Math.max(0, Math.trunc(rankedEntry.losses));
  const tier = rankTier(rankedEntry.tier);
  const queueType = rankedEntry.queueType === "RANKED_FLEX_SR"
    ? "RANKED_FLEX_SR"
    : RANKED_5V5_QUEUE_ALIASES.has(rankedEntry.queueType)
      ? "RANKED_TEAM_5x5"
      : "RANKED_SOLO_5x5";
  return {
    queueType,
    tier,
    rank: rankedEntry.rank,
    leaguePoints: Math.max(0, Math.trunc(rankedEntry.leaguePoints)),
    wins,
    losses,
    winRate: winRate(wins, losses),
    summonerLevel: summoner?.summonerLevel,
    profileIconId: summoner?.profileIconId,
    tierIconUrl: rankedTierIconUrl(tier),
    fetchedAt: new Date().toISOString()
  };
}

function rankDivisionScore(value: string | undefined): number {
  return RANK_DIVISION_SCORE[(value ?? "").toUpperCase()] ?? 0;
}

function compareLeagueEntries(a: RiotLeagueListEntry, b: RiotLeagueListEntry): number {
  return rankDivisionScore(b.rank) - rankDivisionScore(a.rank) ||
    safeStat(b.leaguePoints) - safeStat(a.leaguePoints) ||
    safeStat(b.wins) - safeStat(a.wins) ||
    safeStat(a.losses) - safeStat(b.losses);
}

function sameLeagueEntryStats(entry: RiotLeagueListEntry, rankedEntry: RiotLeagueEntry): boolean {
  return (entry.rank ?? "").toUpperCase() === (rankedEntry.rank ?? "").toUpperCase() &&
    safeStat(entry.leaguePoints) === safeStat(rankedEntry.leaguePoints) &&
    safeStat(entry.wins) === safeStat(rankedEntry.wins) &&
    safeStat(entry.losses) === safeStat(rankedEntry.losses);
}

function listEntryFromRankedEntry(entry: RiotLeagueEntry): RiotLeagueListEntry {
  return {
    summonerId: entry.summonerId,
    puuid: entry.puuid,
    rank: entry.rank,
    leaguePoints: safeStat(entry.leaguePoints),
    wins: safeStat(entry.wins),
    losses: safeStat(entry.losses)
  };
}

function normalizeRegion(value: string, fallback: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(normalized) ? normalized : fallback;
}

function normalizePlatformRouting(value: string, fallback: string): string {
  const normalized = normalizeRegion(value, fallback);
  const aliases: Record<string, string> = {
    br: "br1",
    eune: "eun1",
    euw: "euw1",
    jp: "jp1",
    japan: "jp1",
    la: "la1",
    lan: "la1",
    las: "la2",
    na: "na1",
    oce: "oc1",
    tr: "tr1",
    turkey: "tr1"
  };
  return aliases[normalized] ?? normalized;
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 500);
}

function retryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) ? Math.max(0, Math.trunc(seconds * 1000)) : undefined;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

function causeMessage(error: unknown): string {
  const cause = (error as { cause?: unknown } | undefined)?.cause;
  if (cause instanceof Error && cause.message) return cause.message;
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function causeCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: unknown } } | undefined)?.cause;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

type RiotApiClientOptions = {
  rateLimiter?: RiotRequestLimiter;
};

export class RiotApiClient {
  private readonly rateLimiter: RiotRequestLimiter;

  constructor(
    private readonly apiKeyProvider?: RiotApiKeyProvider,
    options: RiotApiClientOptions = {}
  ) {
    this.rateLimiter = options.rateLimiter ?? new RiotRequestLimiter({
      enabled: appConfig.riot.rateLimit.enabled,
      windows: [
        { limit: appConfig.riot.rateLimit.perSecond, windowMs: 1_000 },
        { limit: appConfig.riot.rateLimit.perTwoMinutes, windowMs: 120_000 }
      ],
      maxQueueSize: appConfig.riot.rateLimit.queueMax
    });
  }

  private get apiKey(): string {
    return this.apiKeyProvider?.getApiKey() || appConfig.riot.apiKey;
  }

  private get apiKeySource(): "runtime" | "env" | "none" {
    if (this.apiKeyProvider?.getApiKey()) return "runtime";
    if (appConfig.riot.apiKey) return "env";
    return "none";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private get accountRegion(): string {
    return normalizeRegion(appConfig.riot.accountRegion, "asia");
  }

  private get lolPlatform(): string {
    return normalizePlatformRouting(appConfig.riot.lolPlatform, "jp1");
  }

  routingStatus(): { configured: boolean; source: "runtime" | "env" | "none"; accountRegion: string; lolPlatform: string } {
    return {
      configured: this.isConfigured(),
      source: this.apiKeySource,
      accountRegion: this.accountRegion,
      lolPlatform: this.lolPlatform
    };
  }

  credentialStatus(): RiotApiKeyStatus & { accountRegion: string; lolPlatform: string } {
    return {
      ...riotApiKeyStatus(this.apiKey, this.apiKeySource, this.apiKeySource === "runtime" ? this.apiKeyProvider?.getUpdatedAt() : undefined),
      accountRegion: this.accountRegion,
      lolPlatform: this.lolPlatform
    };
  }

  setRuntimeApiKey(apiKey: string): RiotApiKeyStatus & { accountRegion: string; lolPlatform: string } {
    if (!this.apiKeyProvider) throw new Error("Riot API key 저장소를 사용할 수 없습니다.");
    this.apiKeyProvider.setApiKey(apiKey);
    return this.credentialStatus();
  }

  clearRuntimeApiKey(): RiotApiKeyStatus & { accountRegion: string; lolPlatform: string } {
    this.apiKeyProvider?.clearApiKey();
    return this.credentialStatus();
  }

  private async fetchJson<T>(url: string, route: string): Promise<T | null> {
    const host = safeHost(url);
    await this.rateLimiter.schedule(host, async () => undefined);
    let response: Response;
    try {
      const apiKey = this.apiKey;
      response = await fetch(url, {
        signal: AbortSignal.timeout(appConfig.riot.apiTimeoutMs),
        headers: {
          "X-Riot-Token": apiKey
        }
      });
    } catch (error) {
      throw new RiotApiNetworkError(route, host, causeMessage(error), causeCode(error));
    }
    if (response.status === 404) return null;
    if (response.status === 429) {
      const retryMs = retryAfterMs(response);
      this.rateLimiter.pause(host, retryMs);
      throw new RiotRateLimitError("Riot API rate limit exceeded", retryMs, route, host);
    }
    if (!response.ok) throw new RiotApiHttpError(response.status, route, host, await readErrorBody(response));
    return (await response.json()) as T;
  }

  async getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.accountRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return this.fetchJson<RiotAccount>(url, "account.by_riot_id");
  }

  async getSummonerByPuuid(puuid: string): Promise<RiotSummoner | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
    return this.fetchJson<RiotSummoner>(url, "summoner.by_puuid");
  }

  async getLeagueEntriesBySummonerId(summonerId: string): Promise<RiotLeagueEntry[]> {
    if (!this.isConfigured()) return [];
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
    return (await this.fetchJson<RiotLeagueEntry[]>(url, "league.entries")) ?? [];
  }

  async getLeagueEntriesByPuuid(puuid: string): Promise<RiotLeagueEntry[]> {
    if (!this.isConfigured()) return [];
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
    return (await this.fetchJson<RiotLeagueEntry[]>(url, "league.entries_by_puuid")) ?? [];
  }

  async getLeagueById(leagueId: string): Promise<RiotLeagueList | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/league/v4/leagues/${encodeURIComponent(leagueId)}`;
    return this.fetchJson<RiotLeagueList>(url, "league.by_id");
  }

  async getChampionMasteryTopByPuuid(puuid: string, count = 3): Promise<RiotChampionMastery[]> {
    if (!this.isConfigured()) return [];
    const safeCount = Math.max(1, Math.min(10, Math.trunc(count)));
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${safeCount}`;
    return (await this.fetchJson<RiotChampionMastery[]>(url, "champion_mastery.top")) ?? [];
  }

  async getRecentMatchIdsByPuuid(puuid: string, count = 20, queueIds: number[] = [], start = 0): Promise<string[]> {
    if (!this.isConfigured()) return [];
    const safeStart = Math.max(0, Math.min(1000, Math.trunc(start)));
    const safeCount = Math.max(1, Math.min(100, Math.trunc(count)));
    const safeQueueIds = [...new Set(queueIds)]
      .map((queueId) => Math.trunc(queueId))
      .filter((queueId) => queueId > 0);
    if (safeQueueIds.length === 0) {
      const url = `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${safeStart}&count=${safeCount}`;
      return (await this.fetchJson<string[]>(url, "match.ids")) ?? [];
    }

    const ids = new Set<string>();
    for (const queueId of safeQueueIds) {
      const url = `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${safeStart}&count=${safeCount}&queue=${queueId}`;
      for (const matchId of await this.fetchJson<string[]>(url, "match.ids") ?? []) {
        ids.add(matchId);
        if (ids.size >= safeCount) return [...ids];
      }
    }
    return [...ids];
  }

  async getMatch(matchId: string): Promise<RiotMatch | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return this.fetchJson<RiotMatch>(url, "match.detail");
  }

  async getMatchTimeline(matchId: string): Promise<RiotMatchTimeline | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
    return this.fetchJson<RiotMatchTimeline>(url, "match.timeline");
  }

  async getCurrentGameByPuuid(puuid: string): Promise<RiotCurrentGameInfo | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`;
    return this.fetchJson<RiotCurrentGameInfo>(url, "spectator.active_game");
  }

  async getLadderRankByPuuid(puuid: string, queuePriority: readonly RiotRankedQueueType[] = RANKED_QUEUE_PRIORITY): Promise<number | undefined> {
    if (!this.isConfigured()) return undefined;
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid),
      this.getLeagueEntriesByPuuid(puuid)
    ]);
    const rankedEntry = queuePriority
      .map((queueType) => entries.find((entry) => entry.queueType === queueType))
      .find(Boolean);
    if (!rankedEntry?.leagueId) return undefined;

    const league = await this.getLeagueById(rankedEntry.leagueId);
    const targetSummonerId = rankedEntry.summonerId ?? summoner?.id;
    const sorted = [...(league?.entries ?? [])].sort(compareLeagueEntries);
    const index = sorted.findIndex((entry) => (
      Boolean(entry.puuid && entry.puuid === puuid) ||
      Boolean(targetSummonerId && entry.summonerId === targetSummonerId) ||
      sameLeagueEntryStats(entry, rankedEntry)
    ));
    if (index >= 0) return index + 1;
    if (sorted.length === 0) return undefined;
    const target = listEntryFromRankedEntry(rankedEntry);
    const higherEntries = sorted.filter((entry) => compareLeagueEntries(entry, target) < 0);
    return higherEntries.length + 1;
  }

  async getRankedStatsByPuuid(puuid: string, queuePriority: readonly RiotRankedQueueType[] = RANKED_QUEUE_PRIORITY): Promise<LolRankedStats | undefined> {
    if (!this.isConfigured()) return undefined;
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid),
      this.getLeagueEntriesByPuuid(puuid)
    ]);

    const rankedEntry = queuePriority
      .map((queueType) => entries.find((entry) => entry.queueType === queueType))
      .find(Boolean);

    if (!rankedEntry) {
      return unrankedStatsFromSummoner(summoner);
    }

    return rankedStatsFromEntry(rankedEntry, summoner);
  }

  async getRankedQueueStatsByPuuid(puuid: string): Promise<{ solo?: LolRankedStats; flex?: LolRankedStats; ranked5v5?: LolRankedStats; primary?: LolRankedStats }> {
    if (!this.isConfigured()) return {};
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid),
      this.getLeagueEntriesByPuuid(puuid)
    ]);
    const soloEntry = entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
    const flexEntry = entries.find((entry) => entry.queueType === "RANKED_FLEX_SR");
    const ranked5v5Entry = entries.find((entry) => RANKED_5V5_QUEUE_ALIASES.has(entry.queueType));
    const solo = soloEntry ? rankedStatsFromEntry(soloEntry, summoner) : undefined;
    const flex = flexEntry ? rankedStatsFromEntry(flexEntry, summoner) : undefined;
    const ranked5v5 = ranked5v5Entry ? rankedStatsFromEntry(ranked5v5Entry, summoner) : undefined;
    return {
      solo,
      flex,
      ranked5v5,
      primary: solo ?? flex ?? ranked5v5 ?? unrankedStatsFromSummoner(summoner)
    };
  }
}

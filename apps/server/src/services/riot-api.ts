import { appConfig } from "../config.js";
import {
  lolRegionalRouteForPlatform,
  normalizeLolPlatformId,
  type LolPlatformId,
  type LolRankedStats,
  type LolRankTier,
  type LolRegionalRoute,
  type LolRoutingContext
} from "@streamops/shared";
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
  /* 증강. Match-V5 는 모든 경기에 이 여섯 필드를 담아 주고, 증강이 없는 모드에서는
     값이 0 입니다. 실측: 아레나(queue 1700)는 0 이 아닌 값, 칼바람(450)은 전부 0.
     4개가 아니라 6개입니다. */
  playerAugment1?: number;
  playerAugment2?: number;
  playerAugment3?: number;
  playerAugment4?: number;
  playerAugment5?: number;
  playerAugment6?: number;
  /* 아레나(CHERRY — 큐 1700/1710/1750). 팀은 teamId 가 아니라 playerSubteamId 로
     나뉘고(1750 은 3인×6팀), 승/패 대신 팀 순위가 결과입니다.
     subteamPlacement 가 정식 필드이고 placement 는 초기 스키마의 잔재라 둘 다 받습니다. */
  playerSubteamId?: number;
  subteamPlacement?: number;
  placement?: number;
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

/* 사용자가 검색을 취소해 더 이상 필요 없어진 요청임을 나타내는 전용 에러입니다.
   Riot API 장애(429/5xx/네트워크/timeout)와 명확히 구분해, 취소를 오류 로그·재시도·
   운영 경고로 오인하지 않도록 합니다 — isAbortError()로 판별합니다. */
export class RiotRequestAbortedError extends Error {
  constructor(readonly route?: string, readonly host?: string) {
    super("Riot API request was aborted by the caller");
    this.name = "RiotRequestAbortedError";
  }
}

/* AbortSignal에 의한 취소인지 판별하는 단일 원본입니다. fetch()가 자체적으로
   반환하는 표준 DOMException("AbortError")과, 이 파일에서 만드는
   RiotRequestAbortedError를 모두 인식합니다. */
export function isAbortError(error: unknown): boolean {
  if (error instanceof RiotRequestAbortedError) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  return false;
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
  /* 큐 대기 상한(ms) — 검색을 여러 번 반복해 취소된 이전 요청들이 큐에 쌓이면
     새 검색이 계속 뒤로 밀리다 결국 응답이 오지 않는 문제의 완화책입니다.
     대기가 이 값을 넘으면 빠르게 명확한 오류로 실패시켜, 다음 요청이 밀리지
     않고 클라이언트가 즉시 재시도할 수 있게 합니다(근본 해결인 요청 취소 전파는
     더 큰 리스크의 후속 작업으로 분리). */
  maxQueueWaitMs?: number;
};

type RiotQueuedRequest<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  enqueuedAt: number;
  /* 큐 대기 중 abort 시 waiter를 즉시 제거하기 위한 정리 콜백 —
     addEventListener("abort", ...)의 리스너 해제까지 함께 수행합니다. */
  cleanupAbortListener?: () => void;
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
  private readonly maxQueueWaitMs: number;
  private readonly now: () => number;
  private readonly maxWindowMs: number;

  constructor(options: RiotRequestLimiterOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.windows = (options.windows ?? DEFAULT_RIOT_RATE_LIMIT_WINDOWS)
      .map(normalizeRateLimitWindow)
      .filter((window): window is RiotRateLimitWindow => Boolean(window))
      .sort((a, b) => a.windowMs - b.windowMs);
    this.maxQueueSize = Math.max(1, Math.trunc(options.maxQueueSize ?? 500));
    /* 기본 12초 — 공개 전적 검색 페이지가 사용자에게 보여주는 로딩 타임아웃보다
       짧게 잡아, 화면이 무한 로딩으로 보이기 전에 명확한 오류로 끝나게 합니다. */
    this.maxQueueWaitMs = Math.max(1, Math.trunc(options.maxQueueWaitMs ?? 12_000));
    this.now = options.now ?? (() => Date.now());
    this.maxWindowMs = Math.max(...this.windows.map((window) => window.windowMs), 0);
  }

  schedule<T>(host: string, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    /* 4-1. 이미 취소된 signal이면 queue에 넣지 않고 Riot API도 호출하지 않습니다. */
    if (signal?.aborted) {
      return Promise.reject(new RiotRequestAbortedError(undefined, host));
    }
    if (!this.enabled || this.windows.length === 0) return run();
    const bucket = this.bucketFor(host);
    if (bucket.queue.length >= this.maxQueueSize) {
      return Promise.reject(new RiotRateLimitError("Riot API request queue is full", undefined, undefined, host));
    }
    return new Promise<T>((resolve, reject) => {
      const item: RiotQueuedRequest<unknown> = { run, resolve, reject, enqueuedAt: this.now() } as RiotQueuedRequest<unknown>;
      if (signal) {
        /* 4-2. 큐 대기 중 abort되면 waiter를 큐에서 제거하고 listener를 정리합니다.
           뒤에 있는 정상 요청은 이 항목 제거의 영향을 받지 않고 그대로 진행됩니다. */
        const onAbort = () => {
          const index = bucket.queue.indexOf(item);
          if (index >= 0) bucket.queue.splice(index, 1);
          item.reject(new RiotRequestAbortedError(undefined, host));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        item.cleanupAbortListener = () => signal.removeEventListener("abort", onAbort);
      }
      bucket.queue.push(item);
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
      /* 대기 상한 초과 항목을 실행 전에 걸러냅니다 — 취소된 이전 검색의 잔여
         호출이 큐 앞쪽에 쌓여 있으면 정상 요청까지 함께 계속 밀리므로, 여기서
         빠르게 실패시켜 뒤에 있는 새 요청이 즉시 진행되게 합니다. */
      while (bucket.queue.length > 0 && now - bucket.queue[0]!.enqueuedAt > this.maxQueueWaitMs) {
        const stale = bucket.queue.shift()!;
        stale.cleanupAbortListener?.();
        stale.reject(new RiotRateLimitError("Riot API request queue wait timed out", undefined, undefined, bucket.host));
      }
      if (bucket.queue.length === 0) return;
      if (!this.canStart(bucket, now)) {
        const rateLimitDelayMs = this.nextDelayMs(bucket, now);
        const oldestEnqueuedAt = bucket.queue[0]!.enqueuedAt;
        const staleDelayMs = Math.max(1, this.maxQueueWaitMs - (now - oldestEnqueuedAt) + 1);
        this.scheduleDrain(bucket, Math.min(rateLimitDelayMs, staleDelayMs));
        return;
      }
      const item = bucket.queue.shift();
      if (!item) return;
      item.cleanupAbortListener?.();
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

function normalizeAccountRegion(value: string, fallback: LolRegionalRoute): LolRegionalRoute {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  return normalized === "americas" || normalized === "asia" || normalized === "europe" || normalized === "sea"
    ? normalized
    : fallback;
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

  private get defaultRouting(): LolRoutingContext {
    const lolPlatform: LolPlatformId = normalizeLolPlatformId(appConfig.riot.lolPlatform) ?? "jp1";
    return {
      lolPlatform,
      accountRegion: normalizeAccountRegion(appConfig.riot.accountRegion, lolRegionalRouteForPlatform(lolPlatform))
    };
  }

  private routing(routing?: LolRoutingContext): LolRoutingContext {
    return routing ?? this.defaultRouting;
  }

  routingStatus(routing?: LolRoutingContext): { configured: boolean; source: "runtime" | "env" | "none"; accountRegion: string; lolPlatform: string } {
    const resolved = this.routing(routing);
    return {
      configured: this.isConfigured(),
      source: this.apiKeySource,
      accountRegion: resolved.accountRegion,
      lolPlatform: resolved.lolPlatform
    };
  }

  credentialStatus(): RiotApiKeyStatus & { accountRegion: string; lolPlatform: string } {
    const routing = this.defaultRouting;
    return {
      ...riotApiKeyStatus(this.apiKey, this.apiKeySource, this.apiKeySource === "runtime" ? this.apiKeyProvider?.getUpdatedAt() : undefined),
      accountRegion: routing.accountRegion,
      lolPlatform: routing.lolPlatform
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

  private async fetchJson<T>(url: string, route: string, signal?: AbortSignal): Promise<T | null> {
    const host = safeHost(url);
    /* rate-limit 큐 진입 전/대기 중 취소를 여기서 그대로 반영합니다 —
       queue waiter가 signal.aborted를 감지하면 RiotRequestAbortedError로 reject됩니다. */
    await this.rateLimiter.schedule(host, async () => undefined, signal);
    let response: Response;
    /* 사용자 취소(signal)와 자체 타임아웃을 하나의 signal로 합칩니다 — 어느 쪽이
       먼저 발생해도 fetch가 즉시 중단됩니다. */
    const combinedSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(appConfig.riot.apiTimeoutMs)])
      : AbortSignal.timeout(appConfig.riot.apiTimeoutMs);
    try {
      const apiKey = this.apiKey;
      response = await fetch(url, {
        signal: combinedSignal,
        headers: {
          "X-Riot-Token": apiKey
        }
      });
    } catch (error) {
      /* 사용자 취소로 인한 abort는 네트워크 장애가 아닙니다 — 별도 타입으로
         구분해 상위에서 오류 로그·재시도·운영 경고로 오인하지 않게 합니다. */
      if (signal?.aborted) throw new RiotRequestAbortedError(route, host);
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

  async getAccountByRiotId(gameName: string, tagLine: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotAccount | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.routing(routing).accountRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    return this.fetchJson<RiotAccount>(url, "account.by_riot_id", signal);
  }

  async getSummonerByPuuid(puuid: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotSummoner | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.routing(routing).lolPlatform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
    return this.fetchJson<RiotSummoner>(url, "summoner.by_puuid", signal);
  }

  async getLeagueEntriesBySummonerId(summonerId: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotLeagueEntry[]> {
    if (!this.isConfigured()) return [];
    const url = `https://${this.routing(routing).lolPlatform}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encodeURIComponent(summonerId)}`;
    return (await this.fetchJson<RiotLeagueEntry[]>(url, "league.entries", signal)) ?? [];
  }

  async getLeagueEntriesByPuuid(puuid: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotLeagueEntry[]> {
    if (!this.isConfigured()) return [];
    const url = `https://${this.routing(routing).lolPlatform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
    return (await this.fetchJson<RiotLeagueEntry[]>(url, "league.entries_by_puuid", signal)) ?? [];
  }

  async getLeagueById(leagueId: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotLeagueList | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.routing(routing).lolPlatform}.api.riotgames.com/lol/league/v4/leagues/${encodeURIComponent(leagueId)}`;
    return this.fetchJson<RiotLeagueList>(url, "league.by_id", signal);
  }

  async getChampionMasteryTopByPuuid(puuid: string, count = 3, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotChampionMastery[]> {
    if (!this.isConfigured()) return [];
    const safeCount = Math.max(1, Math.min(10, Math.trunc(count)));
    const url = `https://${this.routing(routing).lolPlatform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${safeCount}`;
    return (await this.fetchJson<RiotChampionMastery[]>(url, "champion_mastery.top", signal)) ?? [];
  }

  async getRecentMatchIdsByPuuid(puuid: string, count = 20, queueIds: number[] = [], start = 0, routing?: LolRoutingContext, signal?: AbortSignal): Promise<string[]> {
    if (!this.isConfigured()) return [];
    const accountRegion = this.routing(routing).accountRegion;
    const safeStart = Math.max(0, Math.min(1000, Math.trunc(start)));
    const safeCount = Math.max(1, Math.min(100, Math.trunc(count)));
    const safeQueueIds = [...new Set(queueIds)]
      .map((queueId) => Math.trunc(queueId))
      .filter((queueId) => queueId > 0);
    if (safeQueueIds.length === 0) {
      const url = `https://${accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${safeStart}&count=${safeCount}`;
      return (await this.fetchJson<string[]>(url, "match.ids", signal)) ?? [];
    }

    const ids = new Set<string>();
    for (const queueId of safeQueueIds) {
      if (signal?.aborted) throw new RiotRequestAbortedError("match.ids", accountRegion);
      const url = `https://${accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${safeStart}&count=${safeCount}&queue=${queueId}`;
      for (const matchId of await this.fetchJson<string[]>(url, "match.ids", signal) ?? []) {
        ids.add(matchId);
        if (ids.size >= safeCount) return [...ids];
      }
    }
    return [...ids];
  }

  async getMatch(matchId: string, routing?: LolRoutingContext): Promise<RiotMatch | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.routing(routing).accountRegion}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`;
    return this.fetchJson<RiotMatch>(url, "match.detail");
  }

  async getMatchTimeline(matchId: string, routing?: LolRoutingContext): Promise<RiotMatchTimeline | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.routing(routing).accountRegion}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}/timeline`;
    return this.fetchJson<RiotMatchTimeline>(url, "match.timeline");
  }

  async getCurrentGameByPuuid(puuid: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<RiotCurrentGameInfo | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.routing(routing).lolPlatform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`;
    return this.fetchJson<RiotCurrentGameInfo>(url, "spectator.active_game", signal);
  }

  async getLadderRankByPuuid(puuid: string, queuePriority: readonly RiotRankedQueueType[] = RANKED_QUEUE_PRIORITY, routing?: LolRoutingContext, signal?: AbortSignal): Promise<number | undefined> {
    if (!this.isConfigured()) return undefined;
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid, routing, signal),
      this.getLeagueEntriesByPuuid(puuid, routing, signal)
    ]);
    const rankedEntry = queuePriority
      .map((queueType) => entries.find((entry) => entry.queueType === queueType))
      .find(Boolean);
    if (!rankedEntry?.leagueId) return undefined;

    const league = await this.getLeagueById(rankedEntry.leagueId, routing, signal);
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

  async getRankedStatsByPuuid(puuid: string, queuePriority: readonly RiotRankedQueueType[] = RANKED_QUEUE_PRIORITY, routing?: LolRoutingContext, signal?: AbortSignal): Promise<LolRankedStats | undefined> {
    if (!this.isConfigured()) return undefined;
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid, routing, signal),
      this.getLeagueEntriesByPuuid(puuid, routing, signal)
    ]);

    const rankedEntry = queuePriority
      .map((queueType) => entries.find((entry) => entry.queueType === queueType))
      .find(Boolean);

    if (!rankedEntry) {
      return unrankedStatsFromSummoner(summoner);
    }

    return rankedStatsFromEntry(rankedEntry, summoner);
  }

  async getRankedStatsByPuuidWithoutSummoner(
    puuid: string,
    queuePriority: readonly RiotRankedQueueType[] = RANKED_QUEUE_PRIORITY,
    routing?: LolRoutingContext,
    signal?: AbortSignal
  ): Promise<LolRankedStats | undefined> {
    if (!this.isConfigured()) return undefined;
    const entries = await this.getLeagueEntriesByPuuid(puuid, routing, signal);
    const rankedEntry = queuePriority
      .map((queueType) => entries.find((entry) => entry.queueType === queueType))
      .find(Boolean);
    return rankedEntry ? rankedStatsFromEntry(rankedEntry, null) : undefined;
  }

  async getRankedQueueStatsByPuuid(puuid: string, routing?: LolRoutingContext, signal?: AbortSignal): Promise<{ solo?: LolRankedStats; flex?: LolRankedStats; ranked5v5?: LolRankedStats; primary?: LolRankedStats }> {
    if (!this.isConfigured()) return {};
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid, routing, signal),
      this.getLeagueEntriesByPuuid(puuid, routing, signal)
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

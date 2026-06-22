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
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export type RiotChampionMastery = {
  championId: number;
  championLevel: number;
  championPoints: number;
  lastPlayTime?: number;
};

export type RiotMatchParticipant = {
  puuid: string;
  championId: number;
  championName?: string;
  individualPosition?: string;
  teamPosition?: string;
};

export type RiotMatch = {
  metadata: {
    matchId: string;
    participants: string[];
  };
  info: {
    gameCreation?: number;
    queueId?: number;
    participants: RiotMatchParticipant[];
  };
};

export type RiotCurrentGameParticipant = {
  puuid?: string;
  summonerId?: string;
  riotId?: string;
  championId: number;
  teamId: number;
};

export type RiotCurrentGameInfo = {
  gameId: number;
  gameStartTime: number;
  gameLength?: number;
  gameMode?: string;
  gameType?: string;
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

const RANKED_QUEUE_PRIORITY = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"] as const;

function winRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return Math.round((wins / total) * 100);
}

function rankTier(value: string | undefined): LolRankTier {
  const tier = (value ?? "UNRANKED").toUpperCase();
  return LOL_RANK_TIERS.has(tier) ? (tier as LolRankTier) : "UNRANKED";
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

export class RiotApiClient {
  constructor(private readonly apiKeyProvider?: RiotApiKeyProvider) {}

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
    return normalizePlatformRouting(appConfig.riot.lolPlatform, "kr");
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
    let response: Response;
    try {
      const apiKey = this.apiKey;
      response = await fetch(url, {
        headers: {
          "X-Riot-Token": apiKey
        }
      });
    } catch (error) {
      throw new RiotApiNetworkError(route, host, causeMessage(error), causeCode(error));
    }
    if (response.status === 404) return null;
    if (response.status === 429) throw new RiotRateLimitError("Riot API rate limit exceeded", retryAfterMs(response), route, host);
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

  async getChampionMasteryTopByPuuid(puuid: string, count = 3): Promise<RiotChampionMastery[]> {
    if (!this.isConfigured()) return [];
    const safeCount = Math.max(1, Math.min(10, Math.trunc(count)));
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}/top?count=${safeCount}`;
    return (await this.fetchJson<RiotChampionMastery[]>(url, "champion_mastery.top")) ?? [];
  }

  async getRecentMatchIdsByPuuid(puuid: string, count = 20, queueIds: number[] = []): Promise<string[]> {
    if (!this.isConfigured()) return [];
    const safeCount = Math.max(1, Math.min(100, Math.trunc(count)));
    const safeQueueIds = [...new Set(queueIds)]
      .map((queueId) => Math.trunc(queueId))
      .filter((queueId) => queueId > 0);
    if (safeQueueIds.length === 0) {
      const url = `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${safeCount}`;
      return (await this.fetchJson<string[]>(url, "match.ids")) ?? [];
    }

    const ids = new Set<string>();
    for (const queueId of safeQueueIds) {
      const url = `https://${this.accountRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${safeCount}&queue=${queueId}`;
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

  async getCurrentGameByPuuid(puuid: string): Promise<RiotCurrentGameInfo | null> {
    if (!this.isConfigured()) return null;
    const url = `https://${this.lolPlatform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`;
    return this.fetchJson<RiotCurrentGameInfo>(url, "spectator.active_game");
  }

  async getRankedStatsByPuuid(puuid: string): Promise<LolRankedStats | undefined> {
    if (!this.isConfigured()) return undefined;
    const [summoner, entries] = await Promise.all([
      this.getSummonerByPuuid(puuid),
      this.getLeagueEntriesByPuuid(puuid)
    ]);

    const rankedEntry = RANKED_QUEUE_PRIORITY
      .map((queueType) => entries.find((entry) => entry.queueType === queueType))
      .find(Boolean);

    if (!rankedEntry) {
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

    const wins = Math.max(0, Math.trunc(rankedEntry.wins));
    const losses = Math.max(0, Math.trunc(rankedEntry.losses));
    return {
      queueType: rankedEntry.queueType === "RANKED_FLEX_SR" ? "RANKED_FLEX_SR" : "RANKED_SOLO_5x5",
      tier: rankTier(rankedEntry.tier),
      rank: rankedEntry.rank,
      leaguePoints: Math.max(0, Math.trunc(rankedEntry.leaguePoints)),
      wins,
      losses,
      winRate: winRate(wins, losses),
      summonerLevel: summoner?.summonerLevel,
      profileIconId: summoner?.profileIconId,
      fetchedAt: new Date().toISOString()
    };
  }
}

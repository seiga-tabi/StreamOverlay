import crypto from "node:crypto";
import type { Pool } from "pg";
import type {
  StreamerRiotIdRequest,
  ValorantLeaderboardRegion,
  ValorantLeaderboardResponse,
  ValorantStreamerListResponse,
  ValorantStreamerMatchesResponse
} from "@streamops/shared";
import { YoroAccountRepository, type EligibleValorantIdentity } from "../database/repositories/yoro-account-repository.js";
import type { ValorantPublicCatalogService } from "./valorant-public-catalog.js";

type FetchLike = typeof fetch;
type Logger = {
  error?: (entry: Record<string, unknown>) => void;
  event?: (entry: Record<string, unknown>) => void;
};
type StreamerRegistry = {
  listApprovedMainStreamerRiotIds(): StreamerRiotIdRequest[];
};

const LEADERBOARD_TTL_MS = 5 * 60_000;
const LEADERBOARD_STALE_MS = 30 * 60_000;
const MATCH_TTL_MS = 60_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const LEADERBOARD_PAGE_SIZE = 200;
const LEADERBOARD_ENTRY_LIMIT = 500;
const RIOT_UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const MATCH_DETAIL_CACHE_LIMIT = 2_000;
const USER_PAGE_CACHE_LIMIT = 2_000;

export class ValorantPublicQueryError extends Error {
  constructor(readonly code: "invalid_query") {
    super(code);
    this.name = "ValorantPublicQueryError";
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function boundedText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFKC").trim();
  return normalized && normalized.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(normalized)
    ? normalized
    : undefined;
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

// Riot API는 값이 0인 숫자 필드를 생략할 수 있다고 문서화하므로, 0이 유효한
// 통계만 명시적으로 0으로 복원합니다. 식별·시간 필드에는 이 규칙을 적용하지 않습니다.
function zeroDefaultInteger(value: unknown, maximum: number): number | undefined {
  return value === undefined ? 0 : integer(value, 0, maximum);
}

function publicStreamerId(userId: string): string {
  return crypto.createHash("sha256").update(`valorant-streamer-v1:${userId}`).digest("hex").slice(0, 32);
}

function setBoundedExpiringCache<K, V extends { expiresAt: number }>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maximum: number
): void {
  const now = Date.now();
  for (const [candidateKey, candidate] of cache) {
    if (candidate.expiresAt <= now) cache.delete(candidateKey);
  }
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > maximum) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function parseRiotTag(displayName: string): string | undefined {
  const normalized = displayName.normalize("NFKC").trim();
  if (normalized.length > 100 || !normalized.includes("#")) return undefined;
  return normalized;
}

function exactQuery(
  searchParams: URLSearchParams,
  keys: readonly string[]
): void {
  const allowed = new Set(keys);
  if (
    [...searchParams.keys()].some((key) => !allowed.has(key))
    || keys.some((key) => searchParams.getAll(key).length > 1)
  ) throw new ValorantPublicQueryError("invalid_query");
}

function matchPageQuery(searchParams: URLSearchParams): { offset: number; limit: number } {
  exactQuery(searchParams, ["offset", "limit"]);
  const rawOffset = searchParams.get("offset") ?? "0";
  const rawLimit = searchParams.get("limit") ?? "20";
  if (!/^(?:0|[1-9]\d{0,4})$/u.test(rawOffset) || !/^[1-9]\d?$/u.test(rawLimit)) {
    throw new ValorantPublicQueryError("invalid_query");
  }
  const offset = Number(rawOffset);
  const limit = Number(rawLimit);
  if (offset > 10_000 || limit > 20) throw new ValorantPublicQueryError("invalid_query");
  return { offset, limit };
}

function leaderboardQuery(
  searchParams: URLSearchParams,
  currentActId: string
): { region: ValorantLeaderboardRegion; actId: string } {
  exactQuery(searchParams, ["region", "act"]);
  const region = searchParams.get("region") ?? "kr";
  const actId = (searchParams.get("act") ?? currentActId).toLowerCase();
  if (!new Set(["kr", "ap", "na"]).has(region) || !RIOT_UUID_PATTERN.test(actId)) {
    throw new ValorantPublicQueryError("invalid_query");
  }
  return { region: region as ValorantLeaderboardRegion, actId };
}

async function fetchJson(
  fetchImpl: FetchLike,
  url: URL,
  apiKey: string,
  timeoutMs: number,
  attempt = 0
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref();
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { "Accept": "application/json", "X-Riot-Token": apiKey },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) {
      if (response.status >= 500 && attempt < 1) {
        return fetchJson(fetchImpl, url, apiKey, timeoutMs, attempt + 1);
      }
      throw new Error(`riot_http_${response.status}`);
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) throw new Error("riot_response_too_large");
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (attempt < 1 && error instanceof TypeError) {
      return fetchJson(fetchImpl, url, apiKey, timeoutMs, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class ValorantPublicService {
  private readonly leaderboardCache = new Map<string, {
    freshUntil: number;
    staleUntil: number;
    response: ValorantLeaderboardResponse & { state: "ready" };
  }>();
  private readonly leaderboardInFlight = new Map<string, Promise<ValorantLeaderboardResponse & { state: "ready" }>>();
  private readonly matchDetailCache = new Map<string, { expiresAt: number; raw: unknown }>();
  private readonly userPageCache = new Map<string, { expiresAt: number; response: ValorantStreamerMatchesResponse & { state: "ready" } }>();
  private readonly userVisibilityVersions = new Map<string, number>();

  constructor(private readonly options: {
    pool?: Pool;
    registry: StreamerRegistry;
    catalog: ValorantPublicCatalogService;
    approved: boolean;
    apiKey: string;
    currentActId: string;
    platform: ValorantLeaderboardRegion;
    timeoutMs: number;
    fetchImpl?: FetchLike;
    logger?: Logger;
  }) {}

  invalidateUser(userId: string): void {
    this.userVisibilityVersions.set(userId, (this.userVisibilityVersions.get(userId) ?? 0) + 1);
    const prefix = `${userId}:`;
    for (const key of this.userPageCache.keys()) {
      if (key.startsWith(prefix)) this.userPageCache.delete(key);
    }
  }

  async leaderboard(searchParams: URLSearchParams): Promise<ValorantLeaderboardResponse> {
    if (!this.options.approved) return { state: "approval_pending" };
    const query = leaderboardQuery(searchParams, this.options.currentActId);
    const act = this.options.catalog.act(query.actId);
    if (!act) throw new ValorantPublicQueryError("invalid_query");
    const key = `${query.region}:${query.actId}`;
    const cached = this.leaderboardCache.get(key);
    const now = Date.now();
    if (cached && cached.freshUntil > now) return cached.response;
    if (cached && cached.staleUntil > now) {
      void this.refreshLeaderboard(query.region, query.actId).catch(() => undefined);
      return cached.response;
    }
    try {
      return await this.refreshLeaderboard(query.region, query.actId);
    } catch {
      return { state: "data_unavailable" };
    }
  }

  async streamers(): Promise<ValorantStreamerListResponse> {
    if (!this.options.approved) return { state: "approval_pending" };
    const eligible = await this.eligibleIdentities();
    if (!eligible) return { state: "data_unavailable" };
    const approvedByTwitch = this.approvedStreamerMap();
    return {
      state: "ready",
      streamers: eligible.flatMap((identity) => {
        const streamer = approvedByTwitch.get(identity.twitchUserId);
        if (!streamer) return [];
        const riotTag = parseRiotTag(identity.riotDisplayName);
        return [{
          id: publicStreamerId(identity.userId),
          displayName: streamer.twitchDisplayName || identity.twitchDisplayName,
          ...(riotTag ? { riotTag } : {})
        }];
      })
    };
  }

  async streamerMatches(
    streamerId: string,
    searchParams: URLSearchParams
  ): Promise<ValorantStreamerMatchesResponse | undefined> {
    if (!this.options.approved) return { state: "approval_pending" };
    if (!/^[a-f0-9]{32}$/u.test(streamerId)) return undefined;
    const page = matchPageQuery(searchParams);
    const eligible = await this.eligibleIdentity(streamerId);
    if (eligible === null) return { state: "data_unavailable" };
    if (!eligible) return undefined;
    const cacheKey = `${eligible.identity.userId}:${page.offset}:${page.limit}`;
    const cached = this.userPageCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;
    const visibilityVersion = this.userVisibilityVersions.get(eligible.identity.userId) ?? 0;
    try {
      const response = await this.loadMatches(eligible.identity, eligible.streamer, page);
      if ((this.userVisibilityVersions.get(eligible.identity.userId) ?? 0) !== visibilityVersion) {
        return undefined;
      }
      setBoundedExpiringCache(
        this.userPageCache,
        cacheKey,
        { expiresAt: Date.now() + MATCH_TTL_MS, response },
        USER_PAGE_CACHE_LIMIT
      );
      return response;
    } catch {
      return { state: "data_unavailable" };
    }
  }

  private async refreshLeaderboard(
    region: ValorantLeaderboardRegion,
    actId: string
  ): Promise<ValorantLeaderboardResponse & { state: "ready" }> {
    const key = `${region}:${actId}`;
    const current = this.leaderboardInFlight.get(key);
    if (current) return current;
    const task = (async () => {
      const players: unknown[] = [];
      for (let startIndex = 0; startIndex < LEADERBOARD_ENTRY_LIMIT; startIndex += LEADERBOARD_PAGE_SIZE) {
        const requestedSize = Math.min(LEADERBOARD_PAGE_SIZE, LEADERBOARD_ENTRY_LIMIT - startIndex);
        const url = new URL(`https://${region}.api.riotgames.com/val/ranked/v1/leaderboards/by-act/${actId}`);
        url.searchParams.set("size", String(requestedSize));
        url.searchParams.set("startIndex", String(startIndex));
        const raw = record(await fetchJson(
          this.options.fetchImpl ?? fetch,
          url,
          this.options.apiKey,
          this.options.timeoutMs
        ));
        if (!raw || !Array.isArray(raw.players) || raw.players.length > requestedSize) {
          throw new Error("leaderboard_invalid");
        }
        players.push(...raw.players);
        if (raw.players.length < requestedSize) break;
      }
      const entries = players.map((candidate, index) => {
        const player = record(candidate);
        const rank = integer(player?.leaderboardRank, 1, 1_000_000);
        const rankedRating = zeroDefaultInteger(player?.rankedRating, 1_000_000);
        const wins = zeroDefaultInteger(player?.numberOfWins, 1_000_000);
        if (rank === undefined || rankedRating === undefined || wins === undefined) throw new Error("leaderboard_player_invalid");
        const gameName = boundedText(player?.gameName, 64);
        const tagLine = boundedText(player?.tagLine, 32);
        const explicitAnonymous = player?.isAnonymized;
        if (explicitAnonymous !== undefined && typeof explicitAnonymous !== "boolean") throw new Error("leaderboard_anonymous_invalid");
        const anonymous = explicitAnonymous === true || !gameName || !tagLine;
        return {
          rank,
          anonymous,
          ...(!anonymous && gameName && tagLine ? { riotId: `${gameName}#${tagLine}` } : {}),
          rankedRating,
          wins,
          index
        };
      }).sort((left, right) => left.rank - right.rank || left.index - right.index)
        .map(({ index: _index, ...entry }) => entry);
      const act = this.options.catalog.act(actId);
      if (!act) throw new Error("leaderboard_act_invalid");
      const response: ValorantLeaderboardResponse & { state: "ready" } = {
        state: "ready",
        act,
        acts: this.options.catalog.acts(),
        region,
        entries,
        updatedAt: new Date().toISOString()
      };
      this.leaderboardCache.set(key, {
        freshUntil: Date.now() + LEADERBOARD_TTL_MS,
        staleUntil: Date.now() + LEADERBOARD_STALE_MS,
        response
      });
      return response;
    })().finally(() => this.leaderboardInFlight.delete(key));
    this.leaderboardInFlight.set(key, task);
    return task;
  }

  private approvedStreamerMap(): Map<string, StreamerRiotIdRequest> {
    return new Map(this.options.registry.listApprovedMainStreamerRiotIds().map((streamer) => [streamer.twitchUserId, streamer]));
  }

  private async eligibleIdentities(): Promise<readonly EligibleValorantIdentity[] | undefined> {
    if (!this.options.pool) return undefined;
    try {
      return await new YoroAccountRepository(this.options.pool).listEligibleValorantIdentities();
    } catch {
      this.options.logger?.error?.({ type: "valorant.public_identity_lookup_failed", errorCode: "database_unavailable" });
      return undefined;
    }
  }

  private async eligibleIdentity(streamerId: string): Promise<{
    identity: EligibleValorantIdentity;
    streamer: StreamerRiotIdRequest;
  } | undefined | null> {
    const eligible = await this.eligibleIdentities();
    if (!eligible) return null;
    const approved = this.approvedStreamerMap();
    const identity = eligible.find((candidate) => publicStreamerId(candidate.userId) === streamerId);
    const streamer = identity ? approved.get(identity.twitchUserId) : undefined;
    return identity && streamer ? { identity, streamer } : undefined;
  }

  private async loadMatches(
    identity: EligibleValorantIdentity,
    streamer: StreamerRiotIdRequest,
    page: { offset: number; limit: number }
  ): Promise<ValorantStreamerMatchesResponse & { state: "ready" }> {
    const platform = this.options.platform;
    const listUrl = new URL(`https://${platform}.api.riotgames.com/val/match/v1/matchlists/by-puuid/${encodeURIComponent(identity.riotPuuid)}`);
    const rawList = record(await fetchJson(
      this.options.fetchImpl ?? fetch,
      listUrl,
      this.options.apiKey,
      this.options.timeoutMs
    ));
    if (!rawList || !Array.isArray(rawList.history) || rawList.history.length > 10_000) throw new Error("matchlist_invalid");
    const histories = rawList.history.slice(page.offset, page.offset + page.limit);
    const matches = [];
    for (const historyCandidate of histories) {
      const history = record(historyCandidate);
      const matchId = boundedText(history?.matchId, 128);
      if (!matchId || !/^[A-Za-z0-9_-]+$/u.test(matchId)) throw new Error("match_id_invalid");
      const detail = await this.matchDetail(platform, matchId);
      matches.push(this.publicMatch(detail, identity.riotPuuid, matchId));
    }
    const riotTag = parseRiotTag(identity.riotDisplayName);
    if (!riotTag) throw new Error("riot_tag_invalid");
    return {
      state: "ready",
      profile: {
        displayName: streamer.twitchDisplayName || identity.twitchDisplayName,
        riotTag,
        consentBadge: true
      },
      offset: page.offset,
      limit: page.limit,
      total: rawList.history.length,
      returned: matches.length,
      hasMore: page.offset + matches.length < rawList.history.length,
      matches
    };
  }

  private async matchDetail(platform: ValorantLeaderboardRegion, matchId: string): Promise<unknown> {
    const cacheKey = `${platform}:${matchId}`;
    const cached = this.matchDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.raw;
    const raw = await fetchJson(
      this.options.fetchImpl ?? fetch,
      new URL(`https://${platform}.api.riotgames.com/val/match/v1/matches/${encodeURIComponent(matchId)}`),
      this.options.apiKey,
      this.options.timeoutMs
    );
    setBoundedExpiringCache(
      this.matchDetailCache,
      cacheKey,
      { expiresAt: Date.now() + MATCH_TTL_MS, raw },
      MATCH_DETAIL_CACHE_LIMIT
    );
    return raw;
  }

  private publicMatch(rawValue: unknown, puuid: string, requestedMatchId: string) {
    const raw = record(rawValue);
    const info = record(raw?.matchInfo);
    const matchId = boundedText(info?.matchId, 128);
    if (!raw || !info || matchId !== requestedMatchId || !Array.isArray(raw.players) || !Array.isArray(raw.teams)) {
      throw new Error("match_invalid");
    }
    const player = raw.players.map(record).find((candidate) => candidate?.puuid === puuid);
    const stats = record(player?.stats);
    const teamId = boundedText(player?.teamId, 32);
    const team = raw.teams.map(record).find((candidate) => candidate?.teamId === teamId);
    const agentId = boundedText(player?.characterId, 128);
    const mapId = boundedText(info.mapId, 128);
    const queueId = boundedText(info.queueId, 128) ?? "unknown";
    const startedMillis = integer(info.gameStartMillis, 1, 9_999_999_999_999);
    const durationMillis = integer(info.gameLengthMillis, 0, 86_400_000);
    const kills = zeroDefaultInteger(stats?.kills, 1_000);
    const deaths = zeroDefaultInteger(stats?.deaths, 1_000);
    const assists = zeroDefaultInteger(stats?.assists, 1_000);
    const roundsWon = zeroDefaultInteger(team?.roundsWon, 100);
    const roundsPlayed = zeroDefaultInteger(team?.roundsPlayed, 100);
    if (
      !player || !stats || !team || !teamId || !agentId || !mapId
      || startedMillis === undefined || durationMillis === undefined
      || kills === undefined || deaths === undefined || assists === undefined
      || roundsWon === undefined || roundsPlayed === undefined || roundsPlayed < roundsWon
    ) throw new Error("match_subject_invalid");
    const won = team.won;
    if (typeof won !== "boolean") throw new Error("match_team_invalid");
    return {
      matchId,
      queue: { id: queueId.toLowerCase(), name: this.options.catalog.queueName(queueId) },
      map: { id: mapId.toLowerCase(), name: this.options.catalog.mapName(mapId) },
      agent: { id: agentId.toLowerCase(), name: this.options.catalog.agentName(agentId) },
      win: won,
      roundsWon,
      roundsLost: roundsPlayed - roundsWon,
      kills,
      deaths,
      assists,
      // match-v1 기본 PlayerStatsDto에는 총 headshot 시도가 없어 추측하지 않습니다.
      headshotPercent: null,
      startedAt: new Date(startedMillis).toISOString(),
      durationSeconds: Math.floor(durationMillis / 1_000)
    };
  }
}

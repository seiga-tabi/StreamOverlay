import { apiBase } from "../../../api/client";
import {
  parsePublicLolMatchRankResponse,
  type LolChampionBuildStatsPosition,
  type LolChampionBuildStatsResponse,
  type LolChampionDetailResponse,
  type LolChampionListResponse,
  type LolPlatformId
} from "@streamops/shared";
import { t } from "../i18n/public-lol-i18n";
import type {
  MatchQueueFilter,
  PublicLolMatchBuildResponse,
  PublicLolMatchTeamsResponse,
  PublicLolMatchPageResponse,
  PublicLolMatchRankResponse,
  PublicLolProfile,
  PublicLolProfileDynamicState,
  SearchSuggestion,
} from "../types/public-lol";

const PUBLIC_LOL_MATCH_PAGE_CLIENT_CACHE_TTL_MS = 2 * 60_000;
const PUBLIC_LOL_MATCH_PAGE_CLIENT_CACHE_MAX = 40;

type PublicLolMatchPageClientCacheEntry = {
  expiresAt: number;
  response: PublicLolMatchPageResponse;
};

const publicLolMatchPageClientCache = new Map<string, PublicLolMatchPageClientCacheEntry>();
const publicLolMatchPageClientInFlight = new Map<string, Promise<PublicLolMatchPageResponse>>();
const publicLolMatchPageClientGeneration = new Map<string, number>();

function publicLolMatchPageProfileKey(riotId: string, platform?: LolPlatformId): string {
  return `${platform ?? ""}\u0000${riotId.trim().normalize("NFKC").toLocaleLowerCase()}`;
}

function publicLolMatchPageClientKey(
  riotId: string,
  start: number,
  platform?: LolPlatformId,
  queue: MatchQueueFilter = "all"
): string {
  return `${publicLolMatchPageProfileKey(riotId, platform)}\u0000${queue}\u0000${Math.max(0, Math.trunc(start))}`;
}

function prunePublicLolMatchPageClientCache(): void {
  while (publicLolMatchPageClientCache.size > PUBLIC_LOL_MATCH_PAGE_CLIENT_CACHE_MAX) {
    const oldestKey = publicLolMatchPageClientCache.keys().next().value as string | undefined;
    if (!oldestKey) return;
    publicLolMatchPageClientCache.delete(oldestKey);
  }
}

function publicLolAbortError(): Error {
  const error = new Error("요청이 취소되었습니다.");
  error.name = "AbortError";
  return error;
}

function awaitPublicLolMatchPage<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(publicLolAbortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(publicLolAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    request.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export async function readPublicApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { code?: unknown; error?: unknown; message?: unknown };
    if (body.code === "LOL_PROFILE_NOT_ON_PLATFORM") return t().summonerNotOnServer;
    if (typeof body.error === "string") return body.error.includes("Riot API key") ? t().riotMissing : body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    return `${response.status}`;
  }
  return `${response.status}`;
}

export async function searchProfile(
  riotId: string,
  options: { refresh?: boolean; signal?: AbortSignal; platform?: LolPlatformId; profileToken?: string } = {}
): Promise<PublicLolProfile> {
  const params = new URLSearchParams();
  if (options.profileToken) params.set("token", options.profileToken);
  else params.set("riotId", riotId);
  if (options.platform) params.set("platform", options.platform);
  if (options.refresh) params.set("refresh", "1");
  const response = await fetch(`${apiBase}/api/lol/profile?${params.toString()}`, {
    credentials: "include",
    signal: options.signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolProfile;
}

export async function getPublicLolProfileDynamicState(
  riotId: string,
  signal?: AbortSignal,
  platform?: LolPlatformId
): Promise<PublicLolProfileDynamicState> {
  const params = new URLSearchParams({ riotId });
  if (platform) params.set("platform", platform);
  const response = await fetch(`${apiBase}/api/lol/profile-state?${params.toString()}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolProfileDynamicState;
}

export async function getPublicLolMatchPage(
  riotId: string,
  start: number,
  platform?: LolPlatformId,
  signal?: AbortSignal,
  queue: MatchQueueFilter = "all"
): Promise<PublicLolMatchPageResponse> {
  const safeStart = Math.max(0, Math.trunc(start));
  const profileKey = publicLolMatchPageProfileKey(riotId, platform);
  const cacheKey = publicLolMatchPageClientKey(riotId, safeStart, platform, queue);
  const cached = publicLolMatchPageClientCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    publicLolMatchPageClientCache.delete(cacheKey);
    publicLolMatchPageClientCache.set(cacheKey, cached);
    return awaitPublicLolMatchPage(Promise.resolve(cached.response), signal);
  }
  if (cached) publicLolMatchPageClientCache.delete(cacheKey);

  let request = publicLolMatchPageClientInFlight.get(cacheKey);
  if (!request) {
    const generation = publicLolMatchPageClientGeneration.get(profileKey) ?? 0;
    const params = new URLSearchParams({ riotId, start: String(safeStart) });
    if (platform) params.set("platform", platform);
    if (queue !== "all") params.set("queue", queue);
    request = (async () => {
      const response = await fetch(`${apiBase}/api/lol/matches?${params.toString()}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
      const page = (await response.json()) as PublicLolMatchPageResponse;
      if ((publicLolMatchPageClientGeneration.get(profileKey) ?? 0) === generation) {
        publicLolMatchPageClientCache.set(cacheKey, {
          expiresAt: Date.now() + PUBLIC_LOL_MATCH_PAGE_CLIENT_CACHE_TTL_MS,
          response: page
        });
        prunePublicLolMatchPageClientCache();
      }
      return page;
    })();
    publicLolMatchPageClientInFlight.set(cacheKey, request);
    void request.then(
      () => {
        if (publicLolMatchPageClientInFlight.get(cacheKey) === request) {
          publicLolMatchPageClientInFlight.delete(cacheKey);
        }
      },
      () => {
        if (publicLolMatchPageClientInFlight.get(cacheKey) === request) {
          publicLolMatchPageClientInFlight.delete(cacheKey);
        }
      }
    );
  }
  return awaitPublicLolMatchPage(request, signal);
}

export async function prefetchPublicLolMatchPage(
  riotId: string,
  start: number,
  platform?: LolPlatformId,
  queue: MatchQueueFilter = "all"
): Promise<void> {
  await getPublicLolMatchPage(riotId, start, platform, undefined, queue);
}

export function invalidatePublicLolMatchPageCache(riotId: string, platform?: LolPlatformId): void {
  const profileKey = publicLolMatchPageProfileKey(riotId, platform);
  const keyPrefix = `${profileKey}\u0000`;
  publicLolMatchPageClientGeneration.set(
    profileKey,
    (publicLolMatchPageClientGeneration.get(profileKey) ?? 0) + 1
  );
  for (const key of publicLolMatchPageClientCache.keys()) {
    if (key.startsWith(keyPrefix)) publicLolMatchPageClientCache.delete(key);
  }
  for (const key of publicLolMatchPageClientInFlight.keys()) {
    if (key.startsWith(keyPrefix)) publicLolMatchPageClientInFlight.delete(key);
  }
}

export async function getPublicLolMatchRanks(
  matchId: string,
  signal?: AbortSignal
): Promise<PublicLolMatchRankResponse> {
  const response = await fetch(`${apiBase}/api/lol/match-ranks?matchId=${encodeURIComponent(matchId)}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  const parsed = parsePublicLolMatchRankResponse(await response.json());
  if (!parsed || parsed.matchId.toUpperCase() !== matchId.trim().toUpperCase()) {
    throw new Error(t().tierUnavailable);
  }
  return parsed;
}

export async function getPublicLolMatchBuild(matchId: string): Promise<PublicLolMatchBuildResponse> {
  const response = await fetch(`${apiBase}/api/lol/match-build?matchId=${encodeURIComponent(matchId)}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolMatchBuildResponse;
}

/* 전체 챔피언 목록 — 요청 파라미터가 없는 정적 목록(서버가 1시간 캐시).
   역할·최근 업데이트 시각은 이 응답에 없습니다(계약 주석 참조). */
export async function getPublicLolChampions(signal?: AbortSignal): Promise<LolChampionListResponse> {
  const response = await fetch(`${apiBase}/api/lol/champions`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  const body: unknown = await response.json();
  if (
    typeof body !== "object"
    || body === null
    || !Array.isArray((body as { champions?: unknown }).champions)
    || typeof (body as { dataDragonVersion?: unknown }).dataDragonVersion !== "string"
  ) {
    throw new Error(t().championListErrorTitle);
  }
  return body as LolChampionListResponse;
}

/* 챔피언 상세(스킬·기본 스탯·이번 패치 변경) — 목업
   `lol-champion-detail-skills-stats.approved-spec.html` §11 계약.
   locale 파라미터가 없습니다(응답이 ko/ja/en 을 함께 담습니다). 이 요청이 실패해도
   기존 빌드 통계 화면은 그대로 살아 있어야 합니다 — 호출부가 fail-soft 로 감쌉니다. */
export async function getChampionDetail(
  championId: number,
  signal?: AbortSignal
): Promise<LolChampionDetailResponse> {
  const response = await fetch(`${apiBase}/api/lol/champion-detail?championId=${encodeURIComponent(String(championId))}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  const body: unknown = await response.json();
  if (
    typeof body !== "object"
    || body === null
    || (body as { championId?: unknown }).championId !== championId
    || !Array.isArray((body as { spells?: unknown }).spells)
    || typeof (body as { baseStats?: unknown }).baseStats !== "object"
    || (body as { baseStats?: unknown }).baseStats === null
  ) {
    throw new Error(t().championDetailSkillsTitle);
  }
  return body as LolChampionDetailResponse;
}

/* 챔피언 글로벌 빌드 통계 — 플랫폼 무관 전역 집계라 platform 을 보내지 않습니다.
   patch 는 서버가 최신 패치로 정합니다(요청 파라미터 없음). */
export async function fetchChampionBuildStats(
  championId: number,
  teamPosition: LolChampionBuildStatsPosition,
  options: { queueId?: number; signal?: AbortSignal } = {}
): Promise<LolChampionBuildStatsResponse> {
  const params = new URLSearchParams({ championId: String(championId), teamPosition });
  if (options.queueId !== undefined) params.set("queueId", String(options.queueId));
  const response = await fetch(`${apiBase}/api/lol/champion-build-stats?${params.toString()}`, {
    credentials: "include",
    signal: options.signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  const body: unknown = await response.json();
  if (
    typeof body !== "object"
    || body === null
    || typeof (body as { championId?: unknown }).championId !== "number"
    || typeof (body as { totalGames?: unknown }).totalGames !== "number"
    || typeof (body as { sampleInsufficient?: unknown }).sampleInsufficient !== "boolean"
  ) {
    throw new Error(t().globalBuildStatsErrorTitle);
  }
  return body as LolChampionBuildStatsResponse;
}

export async function getPublicLolMatchDetail(
  matchId: string,
  riotId: string,
  signal?: AbortSignal
): Promise<PublicLolMatchTeamsResponse> {
  const params = new URLSearchParams({ matchId, riotId });
  const response = await fetch(`${apiBase}/api/lol/match-detail?${params.toString()}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  const body: unknown = await response.json();
  if (
    typeof body !== "object"
    || body === null
    || (body as { status?: unknown }).status !== "ready"
    || typeof (body as { matchId?: unknown }).matchId !== "string"
    || !Array.isArray((body as { teams?: unknown }).teams)
    || typeof (body as { fetchedAt?: unknown }).fetchedAt !== "string"
  ) {
    throw new Error(t().matchDetailLoadFailed);
  }
  return body as PublicLolMatchTeamsResponse;
}

export async function searchSuggestions(query: string, signal: AbortSignal, platform?: LolPlatformId): Promise<SearchSuggestion[]> {
  const params = new URLSearchParams({ q: query });
  if (platform) params.set("platform", platform);
  const response = await fetch(`${apiBase}/api/lol/suggestions?${params.toString()}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) return [];
  const body = await response.json() as { suggestions?: SearchSuggestion[] };
  return Array.isArray(body.suggestions) ? body.suggestions : [];
}

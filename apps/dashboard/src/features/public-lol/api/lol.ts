import { apiBase } from "../../../api/client";
import type { LolPlatformId } from "@streamops/shared";
import { t } from "../i18n/public-lol-i18n";
import type {
  PublicLolMatchBuildResponse,
  PublicLolMatchTeamsResponse,
  PublicLolMatchPageResponse,
  PublicLolMatchRankResponse,
  PublicLolProfile,
  PublicLolProfileDynamicState,
  SearchSuggestion,
} from "../types/public-lol";

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
  options: { refresh?: boolean; signal?: AbortSignal; platform?: LolPlatformId } = {}
): Promise<PublicLolProfile> {
  const params = new URLSearchParams({ riotId });
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
  platform?: LolPlatformId
): Promise<PublicLolMatchPageResponse> {
  const params = new URLSearchParams({ riotId, start: String(Math.max(0, Math.trunc(start))) });
  if (platform) params.set("platform", platform);
  const response = await fetch(`${apiBase}/api/lol/matches?${params.toString()}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolMatchPageResponse;
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
  return (await response.json()) as PublicLolMatchRankResponse;
}

export async function getPublicLolMatchBuild(matchId: string): Promise<PublicLolMatchBuildResponse> {
  const response = await fetch(`${apiBase}/api/lol/match-build?matchId=${encodeURIComponent(matchId)}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolMatchBuildResponse;
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

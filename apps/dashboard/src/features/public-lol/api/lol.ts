import { apiBase } from "../../../api/client";
import { t } from "../i18n/public-lol-i18n";
import type {
  PublicLolMatchBuildResponse,
  PublicLolMatchPageResponse,
  PublicLolMatchRankResponse,
  PublicLolProfile,
  SearchSuggestion,
} from "../types/public-lol";

export async function readPublicApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.error === "string") return body.error.includes("Riot API key") ? t().riotMissing : body.error;
    if (typeof body.message === "string") return body.message;
  } catch {
    return `${response.status}`;
  }
  return `${response.status}`;
}

export async function searchProfile(
  riotId: string,
  options: { refresh?: boolean } = {}
): Promise<PublicLolProfile> {
  const params = new URLSearchParams({ riotId });
  if (options.refresh) params.set("refresh", "1");
  const response = await fetch(`${apiBase}/api/lol/profile?${params.toString()}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolProfile;
}

export async function getPublicLolMatchPage(
  riotId: string,
  start: number
): Promise<PublicLolMatchPageResponse> {
  const params = new URLSearchParams({ riotId, start: String(Math.max(0, Math.trunc(start))) });
  const response = await fetch(`${apiBase}/api/lol/matches?${params.toString()}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await readPublicApiErrorMessage(response));
  return (await response.json()) as PublicLolMatchPageResponse;
}

export async function getPublicLolMatchRanks(matchId: string): Promise<PublicLolMatchRankResponse> {
  const response = await fetch(`${apiBase}/api/lol/match-ranks?matchId=${encodeURIComponent(matchId)}`, {
    credentials: "include"
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

export async function searchSuggestions(query: string, signal: AbortSignal): Promise<SearchSuggestion[]> {
  const response = await fetch(`${apiBase}/api/lol/suggestions?q=${encodeURIComponent(query)}`, {
    credentials: "include",
    signal
  });
  if (!response.ok) return [];
  const body = await response.json() as { suggestions?: SearchSuggestion[] };
  return Array.isArray(body.suggestions) ? body.suggestions : [];
}

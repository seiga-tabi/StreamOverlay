import type { LolRankedStats } from "@streamops/shared";
import type { PublicFavorite, PublicLolProfile, PublicTheme, SearchSuggestion } from "../types/public-lol";
import { normalizeSuggestionKey, normalizedTagLine } from "./riot-id";

const RECENT_SEARCH_STORAGE_KEY = "loltrace.recent.jp";
const FAVORITE_STORAGE_KEY = "loltrace.favorites.jp";
const THEME_STORAGE_KEY = "loltrace.theme";
const MAX_RECENT_SEARCHES = 8;
const MAX_FAVORITES = 24;

export function parseRecentSearches(raw: string | null): SearchSuggestion[] {
  const parsed = JSON.parse(raw ?? "[]") as Array<Partial<SearchSuggestion>>;
  return parsed
    .map((item) => ({
      gameName: typeof item.gameName === "string" ? item.gameName.trim() : "",
      tagLine: typeof item.tagLine === "string" ? normalizedTagLine(item.tagLine) : "JP1",
      source: "recent" as const,
      profileIconUrl: typeof item.profileIconUrl === "string" ? item.profileIconUrl : undefined,
      summonerLevel: typeof item.summonerLevel === "number" ? item.summonerLevel : undefined,
      lolPlatform: typeof item.lolPlatform === "string" ? item.lolPlatform : undefined,
      rankedStats: item.rankedStats && typeof item.rankedStats === "object" ? item.rankedStats as LolRankedStats : undefined,
      lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : undefined
    }))
    .filter((item) => item.gameName && item.tagLine)
    .slice(0, MAX_RECENT_SEARCHES);
}

export function readRecentSearches(): SearchSuggestion[] {
  try {
    return parseRecentSearches(window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecentSearch(profile: PublicLolProfile): void {
  try {
    const next: SearchSuggestion = {
      gameName: profile.gameName,
      tagLine: normalizedTagLine(profile.tagLine),
      source: "recent",
      profileIconUrl: profile.profileIconUrl,
      summonerLevel: profile.summonerLevel,
      lolPlatform: profile.lolPlatform,
      rankedStats: profile.rankedStats,
      lastSeenAt: profile.fetchedAt
    };
    const recent = readRecentSearches().filter((item) => normalizeSuggestionKey(item) !== normalizeSuggestionKey(next));
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify([next, ...recent].slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    // 최근 검색 저장 실패는 전적 조회 흐름을 막지 않습니다.
  }
}

export function readStoredTheme(): PublicTheme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveStoredTheme(theme: PublicTheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 테마 저장 실패는 화면 사용을 막지 않습니다.
  }
}

export function parseFavorites(raw: string | null): PublicFavorite[] {
  const parsed = JSON.parse(raw ?? "[]") as Array<Partial<PublicFavorite>>;
  return parsed
    .map((item) => ({
      gameName: typeof item.gameName === "string" ? item.gameName.trim() : "",
      tagLine: typeof item.tagLine === "string" ? normalizedTagLine(item.tagLine) : "JP1",
      source: "recent" as const,
      profileIconUrl: typeof item.profileIconUrl === "string" ? item.profileIconUrl : undefined,
      summonerLevel: typeof item.summonerLevel === "number" ? item.summonerLevel : undefined,
      lolPlatform: typeof item.lolPlatform === "string" ? item.lolPlatform : undefined,
      rankedStats: item.rankedStats && typeof item.rankedStats === "object" ? item.rankedStats as LolRankedStats : undefined,
      lastSeenAt: typeof item.lastSeenAt === "string" ? item.lastSeenAt : undefined,
      recentGames: typeof item.recentGames === "number" ? item.recentGames : undefined,
      recentWins: typeof item.recentWins === "number" ? item.recentWins : undefined,
      recentWinRate: typeof item.recentWinRate === "number" ? item.recentWinRate : undefined,
      averageKda: typeof item.averageKda === "number" ? item.averageKda : undefined
    }))
    .filter((item) => item.gameName && item.tagLine)
    .slice(0, MAX_FAVORITES);
}

export function readFavorites(): PublicFavorite[] {
  try {
    return parseFavorites(window.localStorage.getItem(FAVORITE_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeFavorites(favorites: PublicFavorite[]): void {
  try {
    window.localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITES)));
  } catch {
    // 즐겨찾기 저장 실패는 전적 화면 사용을 막지 않습니다.
  }
}

export function prependFavorite(favorites: PublicFavorite[], favorite: PublicFavorite): PublicFavorite[] {
  const favoriteKey = normalizeSuggestionKey(favorite);
  return [favorite, ...favorites.filter((item) => normalizeSuggestionKey(item) !== favoriteKey)].slice(0, MAX_FAVORITES);
}

export function favoriteFromProfile(profile: PublicLolProfile): PublicFavorite {
  return {
    gameName: profile.gameName,
    tagLine: normalizedTagLine(profile.tagLine),
    source: "recent",
    profileIconUrl: profile.profileIconUrl,
    summonerLevel: profile.summonerLevel,
    lolPlatform: profile.lolPlatform,
    rankedStats: profile.rankedStats,
    lastSeenAt: profile.fetchedAt,
    recentGames: profile.summary.recentGames,
    recentWins: profile.summary.recentWins,
    recentWinRate: profile.summary.recentWinRate,
    averageKda: profile.summary.averageKda
  };
}

export function isFavoriteProfile(favorites: PublicFavorite[], profile: PublicLolProfile): boolean {
  const key = normalizeSuggestionKey(favoriteFromProfile(profile));
  return favorites.some((favorite) => normalizeSuggestionKey(favorite) === key);
}

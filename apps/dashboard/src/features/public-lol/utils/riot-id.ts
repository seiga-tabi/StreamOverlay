import type { SearchSuggestion } from "../types/public-lol";
import {
  lolPlatformSlug,
  lolRoutingContext,
  normalizeLolPlatformId,
  type LolPlatformId
} from "@streamops/shared";
import { stripPublicLocalePrefix } from "./public-locale-path";

const PUBLIC_SUMMONER_ROUTE_PREFIX = "/lol/summoners/";
const MAX_SEARCH_SUGGESTIONS = 6;
export const DEFAULT_PUBLIC_LOL_PLATFORM: LolPlatformId = "jp1";

export function normalizedTagLine(value: string): string {
  return value.trim().normalize("NFKC").toUpperCase();
}

export function looksLikeSpaceSeparatedTagLine(value: string): boolean {
  const tagLine = normalizedTagLine(value);
  return tagLine.length > 0 && tagLine.length <= 10 && /^[\p{L}\p{N}_-]+$/u.test(tagLine) && /[\p{N}_-]/u.test(tagLine);
}

export function jpRiotIdQuery(value: string): string {
  return riotIdQuery(value, DEFAULT_PUBLIC_LOL_PLATFORM);
}

export function riotIdQuery(value: string, platform: LolPlatformId): string {
  const normalized = value.trim().normalize("NFKC").replace(/＃/g, "#");
  if (!normalized) return "";
  if (normalized.includes("#")) {
    const hashIndex = normalized.lastIndexOf("#");
    const gameName = normalized.slice(0, hashIndex).trim().replace(/\s+/g, " ");
    const tagLine = normalizedTagLine(normalized.slice(hashIndex + 1));
    return gameName && tagLine ? `${gameName}#${tagLine}` : normalized;
  }
  const parts = normalized.split(/\s+/);
  const possibleTag = parts.at(-1);
  if (possibleTag && looksLikeSpaceSeparatedTagLine(possibleTag) && parts.length > 1) {
    return `${parts.slice(0, -1).join(" ")}#${normalizedTagLine(possibleTag)}`;
  }
  if (platform === DEFAULT_PUBLIC_LOL_PLATFORM) {
    return `${normalized.replace(/\s+/g, " ")}#JP1`;
  }
  return normalized.replace(/\s+/g, " ");
}

export function splitRiotIdText(riotId: string): { gameName: string; tagLine: string } | undefined {
  const normalized = riotId.trim().normalize("NFKC").replace(/＃/g, "#");
  const hashIndex = normalized.lastIndexOf("#");
  if (hashIndex <= 0 || hashIndex === normalized.length - 1) return undefined;
  const gameName = normalized.slice(0, hashIndex).trim().replace(/\s+/g, " ");
  const tagLine = normalizedTagLine(normalized.slice(hashIndex + 1));
  return gameName && tagLine ? { gameName, tagLine } : undefined;
}

export function normalizeRiotId(riotId: string): string {
  return riotId.trim().normalize("NFKC").replace(/＃/g, "#").toLocaleLowerCase();
}

export function publicSummonerPath(riotId: string, platform: LolPlatformId = DEFAULT_PUBLIC_LOL_PLATFORM): string {
  const parsed = splitRiotIdText(riotIdQuery(riotId, platform));
  if (!parsed) return "/";
  return `${PUBLIC_SUMMONER_ROUTE_PREFIX}${lolPlatformSlug(platform)}/${encodeURIComponent(`${parsed.gameName}-${parsed.tagLine}`)}`;
}

export function publicSummonerTokenPath(profileToken: string, platform: LolPlatformId): string {
  const token = profileToken.trim();
  if (!/^[A-Za-z0-9_-]{40,512}$/u.test(token)) return "/";
  return `${PUBLIC_SUMMONER_ROUTE_PREFIX}${lolPlatformSlug(platform)}/~${token}`;
}

export type PublicSummonerRoute = {
  riotId: string;
  profileToken?: undefined;
  lolPlatform: LolPlatformId;
} | {
  riotId?: undefined;
  profileToken: string;
  lolPlatform: LolPlatformId;
};

export function publicSummonerRouteFromPath(pathname: string = window.location.pathname): PublicSummonerRoute | undefined {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname.startsWith(PUBLIC_SUMMONER_ROUTE_PREFIX)) return undefined;
  const segments = pathname.slice(PUBLIC_SUMMONER_ROUTE_PREFIX.length).split("/");
  const lolPlatform = lolRoutingContext(segments[0])?.lolPlatform;
  const slug = segments[1];
  if (!lolPlatform) return undefined;
  if (!slug) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug).trim().normalize("NFKC").replace(/＃/g, "#");
  } catch {
    return undefined;
  }
  if (decoded.startsWith("~")) {
    const profileToken = decoded.slice(1);
    return /^[A-Za-z0-9_-]{40,512}$/u.test(profileToken)
      ? { profileToken, lolPlatform }
      : undefined;
  }
  if (decoded.includes("#")) {
    const riotId = riotIdQuery(decoded, lolPlatform);
    return splitRiotIdText(riotId) ? { riotId, lolPlatform } : undefined;
  }
  const separatorIndex = decoded.lastIndexOf("-");
  if (separatorIndex <= 0 || separatorIndex === decoded.length - 1) return undefined;
  const gameName = decoded.slice(0, separatorIndex).trim();
  const tagLine = normalizedTagLine(decoded.slice(separatorIndex + 1));
  return gameName && tagLine ? { riotId: `${gameName}#${tagLine}`, lolPlatform } : undefined;
}

export function riotIdFromPublicSummonerPath(pathname: string = window.location.pathname): string | undefined {
  return publicSummonerRouteFromPath(pathname)?.riotId;
}

export function suggestionRiotId(suggestion: SearchSuggestion): string {
  return `${suggestion.gameName}#${suggestion.tagLine}`;
}

export function normalizeSuggestionKey(suggestion: SearchSuggestion): string {
  const platform = normalizeLolPlatformId(suggestion.lolPlatform) ?? DEFAULT_PUBLIC_LOL_PLATFORM;
  return `${platform}:${suggestionRiotId(suggestion).toLocaleLowerCase()}`;
}

export function searchTextForMatch(value: string): string {
  return value.trim().normalize("NFKC").replace("＃", "#").toLocaleLowerCase();
}

export function inputSuggestion(query: string, platform: LolPlatformId = DEFAULT_PUBLIC_LOL_PLATFORM): SearchSuggestion | undefined {
  const riotId = riotIdQuery(query, platform);
  const hashIndex = riotId.lastIndexOf("#");
  if (hashIndex <= 0 || hashIndex === riotId.length - 1) return undefined;
  const gameName = riotId.slice(0, hashIndex).trim();
  const tagLine = normalizedTagLine(riotId.slice(hashIndex + 1));
  if (!gameName || !tagLine) return undefined;
  return { gameName, tagLine, source: "input", lolPlatform: platform };
}

export function buildSuggestions(query: string, recentSearches: SearchSuggestion[], remoteSuggestions: SearchSuggestion[], platform: LolPlatformId = DEFAULT_PUBLIC_LOL_PLATFORM): SearchSuggestion[] {
  const searchText = searchTextForMatch(query);
  const direct = inputSuggestion(query, platform);
  const merged = [...remoteSuggestions, direct, ...recentSearches]
    .filter((suggestion): suggestion is SearchSuggestion => Boolean(suggestion))
    .filter((suggestion) => (normalizeLolPlatformId(suggestion.lolPlatform) ?? DEFAULT_PUBLIC_LOL_PLATFORM) === platform);
  const unique = new Map<string, SearchSuggestion>();
  for (const suggestion of merged) {
    const key = normalizeSuggestionKey(suggestion);
    if (!unique.has(key)) unique.set(key, suggestion);
  }
  const values = [...unique.values()];
  if (!searchText) return values.slice(0, MAX_SEARCH_SUGGESTIONS);
  const tagOnly = searchText.startsWith("#") ? searchText.slice(1) : "";
  return values
    .filter((suggestion) => {
      if (suggestion.source === "input") return true;
      const riotId = suggestionRiotId(suggestion).toLocaleLowerCase();
      const gameName = suggestion.gameName.toLocaleLowerCase();
      const tagLine = suggestion.tagLine.toLocaleLowerCase();
      if (tagOnly) return tagLine.includes(tagOnly);
      return riotId.includes(searchText) || gameName.includes(searchText) || tagLine.includes(searchText);
    })
    .slice(0, MAX_SEARCH_SUGGESTIONS);
}

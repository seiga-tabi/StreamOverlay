export const LOL_PLATFORM_IDS = [
  "br1",
  "eun1",
  "euw1",
  "jp1",
  "kr",
  "la1",
  "la2",
  "na1",
  "oc1",
  "tr1",
  "ru",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2"
] as const;

export type LolPlatformId = (typeof LOL_PLATFORM_IDS)[number];
export type LolRegionalRoute = "americas" | "asia" | "europe" | "sea";

export type LolRoutingContext = {
  lolPlatform: LolPlatformId;
  accountRegion: LolRegionalRoute;
};

const LOL_PLATFORM_SLUGS: Record<LolPlatformId, string> = {
  br1: "br",
  eun1: "eune",
  euw1: "euw",
  jp1: "jp",
  kr: "kr",
  la1: "lan",
  la2: "las",
  na1: "na",
  oc1: "oce",
  tr1: "tr",
  ru: "ru",
  ph2: "ph",
  sg2: "sg",
  th2: "th",
  tw2: "tw",
  vn2: "vn"
};

const LOL_PLATFORM_REGIONS: Record<LolPlatformId, LolRegionalRoute> = {
  br1: "americas",
  eun1: "europe",
  euw1: "europe",
  jp1: "asia",
  kr: "asia",
  la1: "americas",
  la2: "americas",
  na1: "americas",
  oc1: "sea",
  tr1: "europe",
  ru: "europe",
  ph2: "sea",
  sg2: "sea",
  th2: "sea",
  tw2: "sea",
  vn2: "sea"
};

const LOL_PLATFORM_ALIASES: Readonly<Record<string, LolPlatformId>> = Object.freeze({
  br: "br1",
  br1: "br1",
  brazil: "br1",
  eun1: "eun1",
  eune: "eun1",
  euw: "euw1",
  euw1: "euw1",
  japan: "jp1",
  jp: "jp1",
  jp1: "jp1",
  kr: "kr",
  korea: "kr",
  la1: "la1",
  lan: "la1",
  la2: "la2",
  las: "la2",
  na: "na1",
  na1: "na1",
  oc1: "oc1",
  oce: "oc1",
  ph: "ph2",
  ph2: "ph2",
  ru: "ru",
  sg: "sg2",
  sg2: "sg2",
  th: "th2",
  th2: "th2",
  tr: "tr1",
  tr1: "tr1",
  turkey: "tr1",
  tw: "tw2",
  tw2: "tw2",
  vn: "vn2",
  vn2: "vn2"
});

export function isLolPlatformId(value: unknown): value is LolPlatformId {
  return typeof value === "string" && (LOL_PLATFORM_IDS as readonly string[]).includes(value);
}

export function normalizeLolPlatformId(value: unknown): LolPlatformId | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleLowerCase("en-US");
  return LOL_PLATFORM_ALIASES[normalized];
}

export function lolPlatformSlug(platform: LolPlatformId): string {
  return LOL_PLATFORM_SLUGS[platform];
}

export function lolRegionalRouteForPlatform(platform: LolPlatformId): LolRegionalRoute {
  return LOL_PLATFORM_REGIONS[platform];
}

export function lolRoutingContext(value: unknown): LolRoutingContext | undefined {
  const lolPlatform = normalizeLolPlatformId(value);
  if (!lolPlatform) return undefined;
  return {
    lolPlatform,
    accountRegion: lolRegionalRouteForPlatform(lolPlatform)
  };
}

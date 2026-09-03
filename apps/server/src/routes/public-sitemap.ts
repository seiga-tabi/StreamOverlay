/**
 * 공개 sitemap 생성기.
 *
 * 정적 파일 하나로 관리하면 Palworld 엔티티 URL 수천 개를 손으로 유지해야 하고
 * lastmod가 실제 데이터 갱신과 어긋납니다. 서버가 route 목록과 data service를
 * 단일 원본으로 삼아 sitemap index와 하위 sitemap을 만듭니다.
 */
import {
  PUBLIC_SEO_ORIGIN,
  localizedPublicSeoUrl,
  patchNotesDetailPath,
  palworldBreedingPath,
  palworldEntityPath,
  publicSeoLocalesForPath,
  type PalworldSeoBreedingPair,
  type PalworldEntityKind
} from "./public-seo.js";
import { PATCH_NOTES_MAX_ITEMS, type PatchNote } from "@streamops/shared";

/** sitemap 하나에 담는 URL 상한. 규격 상한(50,000)보다 낮게 잡아 응답 크기를 억제합니다. */
export const SITEMAP_MAX_URLS = 20_000;
/** 교배 상세는 ko·ja·en 3개 URL이 생기므로 shard당 논리 조합 수를 50,000/3으로 제한합니다. */
export const PALWORLD_BREEDING_PAIRS_PER_SITEMAP = 16_666;

export const PUBLIC_SITEMAP_PATHS = {
  index: "/sitemap.xml",
  static: "/sitemap-static.xml",
  patchNotesDetail: "/sitemap-lol-patch-notes.xml",
  pals: "/sitemap-palworld-pals.xml",
  breeding: "/sitemap-palworld-breeding.xml",
  items: "/sitemap-palworld-items.xml",
  skills: "/sitemap-palworld-skills.xml",
  streamerProfiles: "/sitemap-streamer-profiles.xml"
} as const;

export const PALWORLD_SITEMAP_KINDS: Readonly<Record<string, PalworldEntityKind>> = {
  [PUBLIC_SITEMAP_PATHS.pals]: "pal",
  [PUBLIC_SITEMAP_PATHS.items]: "item",
  [PUBLIC_SITEMAP_PATHS.skills]: "skill"
};

/**
 * sitemap에 넣는 정적 공개 경로.
 *
 * 색인 가치가 없거나 비어 있는 화면은 의도적으로 제외합니다.
 * - 법적 고지·문의·로그인·팔로우·참여·검색: 행동 목적 또는 개인화 화면입니다.
 * - 준비 중인 Valorant 화면과 Minecraft 자료실·패치 노트는 완성 후에만 추가합니다.
 */
export const PUBLIC_SITEMAP_STATIC_PATHS: readonly string[] = [
  /* 루트는 전용 메인 홈(멀티게임 검색)입니다 — LoL 홈(/lol)과 별개 화면. */
  "/",
  "/lol",
  "/lol/aram",
  /* 전체 챔피언 목록. 챔피언 상세(/lol/champions/<id>)는 서버가 목록을 알아야
     열거할 수 있어(Data Dragon 왕복) 여기 넣지 않습니다 — 목록 화면의 카드
     링크가 크롤 경로입니다. */
  "/lol/champions",
  "/patch-notes",
  "/bot",
  "/bot/getting-started",
  "/bot/commands",
  "/bot/game-files",
  "/palworld",
  "/palworld/pals",
  "/palworld/breeding",
  "/palworld/items",
  "/palworld/technology",
  "/palworld/skills",
  "/palworld/map",
  "/minecraft",
  "/minecraft/recipes",
  "/minecraft/items",
  "/minecraft/enchants",
  /* 미니게임 — live 인 게임만 올립니다. registry 의 coming(시각반응)은 라우트가
     없어 넣으면 404 URL 을 크롤러에게 제출하게 됩니다. */
  "/games",
  "/games/reaction",
  /* 스트리머 추천 — 목록만 올립니다. 글 상세는 서버가 목록을 알 수 있게 된 뒤
     (Codex handoff) 별도 sitemap 으로 붙입니다. 글쓰기 화면은 로그인 전용이라 제외. */
  "/streamers"
];

export type SitemapEntry = {
  lastmod?: string;
  path: string;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * 잘못된 lastmod는 Google이 사이트 전체의 lastmod를 무시하게 만듭니다.
 * 파싱 가능한 값만 통과시키고 나머지는 생략합니다.
 */
function normalizeLastmod(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

/**
 * 각 로케일 판을 서로 alternate 로 연결한 urlset 을 만듭니다.
 *
 * 로케일 목록은 경로마다 다릅니다 — 영어 본문이 있는 팰월드는 ko·ja·en 3종,
 * 나머지는 ko·ja 2종입니다. sitemap 이 서빙하지 않는 en URL 을 제출하면 크롤러가
 * ko 로 통합되는 페이지를 반복해서 가져가게 됩니다.
 * x-default 는 head 의 hreflang 과 같은 규칙으로 en 이 있으면 en 입니다.
 */
export function buildLocalizedUrlSetSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries.flatMap((entry) => {
    const lastmod = normalizeLastmod(entry.lastmod);
    const locales = publicSeoLocalesForPath(entry.path);
    const alternates = locales.map((locale) => (
      `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(localizedPublicSeoUrl(entry.path, locale))}"/>`
    )).join("");
    const xDefaultLocale = locales.includes("en") ? "en" : "ko";
    const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localizedPublicSeoUrl(entry.path, xDefaultLocale))}"/>`;
    return locales.map((locale) => (
      "<url>"
      + `<loc>${escapeXml(localizedPublicSeoUrl(entry.path, locale))}</loc>`
      + (lastmod ? `<lastmod>${lastmod}</lastmod>` : "")
      + alternates
      + xDefault
      + "</url>"
    ));
  });
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    + ' xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    + urls.join("")
    + "</urlset>";
}

export function buildSitemapIndex(entries: readonly SitemapEntry[]): string {
  const sitemaps = entries.map((entry) => {
    const lastmod = normalizeLastmod(entry.lastmod);
    return "<sitemap>"
      + `<loc>${escapeXml(new URL(entry.path, PUBLIC_SEO_ORIGIN).href)}</loc>`
      + (lastmod ? `<lastmod>${lastmod}</lastmod>` : "")
      + "</sitemap>";
  });
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + sitemaps.join("")
    + "</sitemapindex>";
}

export function publicSitemapStaticPaths(
  options: { minecraftPatchNotesReady?: boolean } = {}
): readonly string[] {
  return options.minecraftPatchNotesReady
    ? [...PUBLIC_SITEMAP_STATIC_PATHS, "/minecraft/patch-notes"]
    : PUBLIC_SITEMAP_STATIC_PATHS;
}

export function buildStaticSitemap(
  lastmod?: string,
  options: { minecraftPatchNotesReady?: boolean } = {}
): string {
  return buildLocalizedUrlSetSitemap(
    publicSitemapStaticPaths(options).map((path) => ({ path, lastmod }))
  );
}

export function buildStreamerProfilesSitemap(
  profiles: readonly {
    platform: "twitch" | "chzzk" | "youtube";
    seoSlug: string;
    lastmod?: string;
  }[]
): string {
  return buildLocalizedUrlSetSitemap(profiles.slice(0, SITEMAP_MAX_URLS).map((profile) => ({
    path: `/streamers/${profile.platform}/${encodeURIComponent(profile.seoSlug)}`,
    ...(profile.lastmod ? { lastmod: profile.lastmod } : {})
  })));
}

/** 패치 피드의 공개일을 각 URL lastmod로 유지하는 ko·ja 상세 sitemap입니다. */
export function buildPatchNotesSitemap(
  notes: readonly PatchNote[],
  lastmod?: string
): string {
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];
  for (const note of notes.slice(0, PATCH_NOTES_MAX_ITEMS)) {
    const patchVersion = note.patchVersion;
    if (!patchVersion || !/^\d{1,3}\.\d{1,3}$/u.test(patchVersion) || seen.has(patchVersion)) continue;
    seen.add(patchVersion);
    entries.push({
      path: patchNotesDetailPath(patchVersion),
      /* 피드 공개일이 URL별 신호의 원본이고, optional 값은 공개일이 비정상인
         직접 호출 fixture에서만 안전한 fallback으로 씁니다. */
      lastmod: Number.isFinite(Date.parse(note.publishedAt)) ? note.publishedAt : lastmod
    });
  }
  return buildLocalizedUrlSetSitemap(entries);
}

export function buildPalworldEntitySitemap(
  kind: PalworldEntityKind,
  ids: readonly string[],
  lastmod?: string
): string {
  return buildLocalizedUrlSetSitemap(
    ids.slice(0, SITEMAP_MAX_URLS).map((id) => ({ path: palworldEntityPath(kind, id), lastmod }))
  );
}

/** 첫 shard는 요청된 고정 파일명을 유지하고, 두 번째부터 번호를 붙입니다. */
export function palworldBreedingSitemapPaths(totalPairs: number): string[] {
  if (!Number.isSafeInteger(totalPairs) || totalPairs <= 0) return [];
  const count = Math.ceil(totalPairs / PALWORLD_BREEDING_PAIRS_PER_SITEMAP);
  return Array.from({ length: count }, (_value, index) => (
    index === 0
      ? PUBLIC_SITEMAP_PATHS.breeding
      : `/sitemap-palworld-breeding-${index + 1}.xml`
  ));
}

/** 알려진 교배 sitemap shard 경로를 0-based shard 번호로 해석합니다. */
export function palworldBreedingSitemapShard(pathname: string): number | undefined {
  if (pathname === PUBLIC_SITEMAP_PATHS.breeding) return 0;
  const match = /^\/sitemap-palworld-breeding-([2-9][0-9]*)\.xml$/u.exec(pathname);
  if (!match?.[1]) return undefined;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) ? number - 1 : undefined;
}

export function buildPalworldBreedingSitemap(
  pairs: readonly PalworldSeoBreedingPair[],
  lastmod?: string
): string {
  if (pairs.length > PALWORLD_BREEDING_PAIRS_PER_SITEMAP) {
    throw new RangeError("교배 sitemap shard의 조합 수가 상한을 초과했습니다.");
  }
  return buildLocalizedUrlSetSitemap(
    pairs.map((pair) => ({ path: palworldBreedingPath(pair), lastmod }))
  );
}

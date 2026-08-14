/**
 * 공개 sitemap 생성기.
 *
 * 정적 파일 하나로 관리하면 Palworld 엔티티 URL 수천 개를 손으로 유지해야 하고
 * lastmod가 실제 데이터 갱신과 어긋납니다. 서버가 route 목록과 data service를
 * 단일 원본으로 삼아 sitemap index와 하위 sitemap을 만듭니다.
 */
import {
  PUBLIC_SEO_LOCALES,
  PUBLIC_SEO_ORIGIN,
  localizedPublicSeoUrl,
  palworldEntityPath,
  type PalworldEntityKind
} from "./public-seo.js";

/** sitemap 하나에 담는 URL 상한. 규격 상한(50,000)보다 낮게 잡아 응답 크기를 억제합니다. */
export const SITEMAP_MAX_URLS = 20_000;

export const PUBLIC_SITEMAP_PATHS = {
  index: "/sitemap.xml",
  static: "/sitemap-static.xml",
  pals: "/sitemap-palworld-pals.xml",
  items: "/sitemap-palworld-items.xml",
  skills: "/sitemap-palworld-skills.xml"
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
  "/",
  "/lol",
  "/lol/aram",
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
  "/minecraft/enchants"
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

/** ko/ja를 서로 alternate로 연결한 urlset을 만듭니다. */
export function buildLocalizedUrlSetSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries.flatMap((entry) => {
    const lastmod = normalizeLastmod(entry.lastmod);
    const alternates = PUBLIC_SEO_LOCALES.map((locale) => (
      `<xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(localizedPublicSeoUrl(entry.path, locale))}"/>`
    )).join("");
    const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localizedPublicSeoUrl(entry.path, "ko"))}"/>`;
    return PUBLIC_SEO_LOCALES.map((locale) => (
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

export function buildStaticSitemap(lastmod?: string): string {
  return buildLocalizedUrlSetSitemap(
    PUBLIC_SITEMAP_STATIC_PATHS.map((path) => ({ path, lastmod }))
  );
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

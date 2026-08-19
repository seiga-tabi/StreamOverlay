/**
 * 공개 페이지 SEO metadata 생성기.
 *
 * dashboard는 CSR app shell이므로 crawler가 받는 HTML에 실제 의미를 담는 책임이 서버에 있습니다.
 * 이 모듈은 `<head>` metadata(title, description, canonical, hreflang, Open Graph, JSON-LD)와
 * `#root` 안에 들어갈 SEO fallback 본문을 함께 만듭니다.
 *
 * fallback 본문은 사용자에게 보이는 값과 동일한 데이터만 사용합니다. crawler에게만 보이는
 * 내용을 넣으면 cloaking이 되므로 화면에 표시되지 않는 정보는 넣지 않습니다.
 */
import {
  isLocalizablePublicDashboardRoute,
  koJaPublicUrlLocale,
  publicUrlLocaleFromPathname,
  stripPublicUrlLocalePrefix,
  type PublicUrlLocale
} from "../routing/public-dashboard-routes.js";

export const PUBLIC_SEO_ORIGIN = "https://yoro.gg";
/** 서버가 메타를 내보내는 로케일 전체. 경로별로 실제 붙는 목록은 아래를 씁니다. */
export const PUBLIC_SEO_LOCALES: readonly PublicUrlLocale[] = ["ko", "ja", "en"];

const PUBLIC_SEO_KO_JA: readonly PublicUrlLocale[] = ["ko", "ja"];

/**
 * 경로별 hreflang·sitemap 대상 로케일.
 *
 * en 은 영어 본문이 있는 섹션(현재 팰월드)에만 붙입니다 — 번역이 없는 경로에
 * en hreflang 을 달면 크롤러에게 존재하지 않는 페이지를 약속하는 셈입니다.
 */
export function publicSeoLocalesForPath(normalizedPath: string): readonly PublicUrlLocale[] {
  return hasEnglishSeoContent(normalizedPath) ? PUBLIC_SEO_LOCALES : PUBLIC_SEO_KO_JA;
}

/**
 * 요청 로케일을 실제로 서빙할 로케일로 접습니다.
 *
 * 영어 본문이 없는 섹션의 /en 은 지금까지처럼 ko 메타로 내려가고 canonical 도
 * /ko 를 가리킵니다(중복 통합). 화면은 그대로 뜨고 색인만 한 판으로 모입니다.
 */
function servedSeoLocale(normalizedPath: string, requested: PublicUrlLocale): PublicUrlLocale {
  return requested === "en" && !hasEnglishSeoContent(normalizedPath) ? "ko" : requested;
}

/**
 * 로케일별 문구. ko·ja 는 모든 경로가 갖고, en 은 영어판이 있는 곳에만 있습니다.
 * 없는 로케일은 ko 로 떨어집니다(빈 문구 금지).
 */
export type PublicSeoLocaleText = Readonly<Record<"ko" | "ja", string>> & { readonly en?: string };

function localeText(text: PublicSeoLocaleText, locale: PublicUrlLocale): string {
  return text[locale] ?? text.ko;
}

/** 문장 하나짜리 로케일 분기. `ja ? A : B` 를 3종으로 넓힌 형태입니다. */
function t(locale: PublicUrlLocale, ko: string, ja: string, en: string): string {
  return locale === "ja" ? ja : locale === "en" ? en : ko;
}

const DEFAULT_SOCIAL_IMAGE = `${PUBLIC_SEO_ORIGIN}/images/yorogg-og.png`;

/* 게임별 정적 소셜 이미지 (1200×630, docs/mockups/sns-link-previews.html §02 기준).
 *
 * X(Twitter)는 카드에서 제목·설명을 표시하지 않으므로 이미지 자체가 페이지 정체성을
 * 전달해야 하고, 전 페이지가 범용 이미지 1장을 공유하면 게임별 링크가 전부 동일하게
 * 보입니다. 경로 접두사가 긴 것부터 먼저 매칭합니다. 소환사 프로필·LoL 패치 노트의
 * 동적 이미지(/social/...)는 이 기본값을 각자의 URL 로 덮어씁니다. */
const SOCIAL_IMAGES_BY_PREFIX: readonly {
  prefix: string;
  url: string;
  /** 이미지 안에 문구가 박힌 페이지는 ja 경로에 ja 판을 내립니다(없으면 url 공용). */
  urlJa?: string;
  alt: PublicSeoLocaleText;
}[] = [
  {
    prefix: "/palworld",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-palworld.png`,
    alt: {
      ko: "YORO.gg 팰월드 데이터베이스 미리보기",
      ja: "YORO.gg パルワールドデータベースのプレビュー",
      en: "YORO.gg Palworld database preview"
    }
  },
  {
    prefix: "/minecraft",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-minecraft.png`,
    alt: { ko: "YORO.gg 마인크래프트 위키 미리보기", ja: "YORO.gg マインクラフト Wiki のプレビュー" }
  },
  {
    prefix: "/valorant",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-valorant.png`,
    alt: { ko: "YORO.gg 발로란트 전적·도감 미리보기", ja: "YORO.gg VALORANT 戦績・データベースのプレビュー" }
  },
  {
    prefix: "/bot",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-bot.png`,
    alt: { ko: "YORO Bot Discord 게임 서버 도우미 미리보기", ja: "YORO Bot Discordゲームサーバーアシスタントのプレビュー" }
  },
  /* prefix 매칭이므로 /games/reaction 등 하위 미니게임은 자동으로 같은 이미지를
     씁니다(팰월드 선례와 동일). 게임별 이미지가 생기면 더 긴 prefix 를 위에 둡니다. */
  {
    prefix: "/games",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-games.png`,
    /* 미니게임 OG 는 이미지에 한국어 문구가 박혀 있어 ja 경로(/ja/games …)에는
       ja 판을 내립니다 — ja 링크가 한국어 이미지로 보이던 실사례(2026-08-17). */
    urlJa: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-games-ja.png`,
    alt: { ko: "YORO.gg 미니게임 미리보기", ja: "YORO.gg ミニゲームのプレビュー" }
  },
  /* LoL 생태(전적·패치 노트·팔로우·참가)와 홈은 LoL 이미지를 사이트 대표로 겸용합니다. */
  {
    prefix: "/lol",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: { ko: "YORO.gg LoL 전적 검색 미리보기", ja: "YORO.gg LoL戦績検索のプレビュー" }
  },
  {
    prefix: "/streamers",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: { ko: "YORO.gg 스트리머 추천 미리보기", ja: "YORO.gg 配信者おすすめのプレビュー" }
  },
  {
    prefix: "/patch-notes",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: { ko: "YORO.gg LoL 전적 검색 미리보기", ja: "YORO.gg LoL戦績検索のプレビュー" }
  },
  {
    prefix: "/follow",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: { ko: "YORO.gg LoL 전적 검색 미리보기", ja: "YORO.gg LoL戦績検索のプレビュー" }
  },
  {
    prefix: "/participation",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: { ko: "YORO.gg LoL 전적 검색 미리보기", ja: "YORO.gg LoL戦績検索のプレビュー" }
  }
];

const HOME_SOCIAL_IMAGE = {
  url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
  alt: { ko: "YORO.gg LoL 전적 검색 미리보기", ja: "YORO.gg LoL戦績検索のプレビュー" }
} as const;

export function socialImageForPath(normalizedPath: string, locale: PublicUrlLocale = "ko"): {
  url: string;
  alt: PublicSeoLocaleText;
} {
  if (normalizedPath === "/") return HOME_SOCIAL_IMAGE;
  const match = SOCIAL_IMAGES_BY_PREFIX.find(({ prefix }) =>
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
  if (match) return { url: locale === "ja" && match.urlJa ? match.urlJa : match.url, alt: match.alt };
  /* 법적 고지·계정 등 게임 외 화면은 기존 범용 이미지를 유지합니다. */
  return {
    url: DEFAULT_SOCIAL_IMAGE,
    alt: { ko: "YORO.gg 서비스 미리보기", ja: "YORO.gg サービスプレビュー" }
  };
}

/** 검색 색인보다 로그인·행동·법적 고지 또는 개발 상태 전달이 중심인 화면입니다. */
const PUBLIC_SEO_NOINDEX_PATHS = new Set([
  "/login",
  "/account",
  "/account/connections",
  "/follow",
  "/participation",
  "/privacy",
  "/terms",
  "/contact",
  "/palworld/search",
  "/valorant",
  "/valorant/agents",
  "/valorant/weapons",
  "/valorant/maps",
  "/valorant/ranked",
  "/minecraft/library",
  "/minecraft/patch-notes"
]);

/** JSON-LD script는 CSP nonce가 필요하므로 정적 HTML과 같은 placeholder를 사용합니다. */
const CSP_NONCE_PLACEHOLDER = "__STREAMOPS_CSP_NONCE__";

export type PublicSeoContent = {
  description: string;
  title: string;
};

export type PublicSeoFact = {
  label: string;
  value: string;
};

/**
 * crawler와 JS 실행 전 사용자가 함께 보는 본문입니다.
 * React가 mount되면 createRoot가 `#root`를 비우면서 그대로 교체됩니다.
 */
/** 본문 소제목 아래 묶이는 한 덩어리. 능력치 표·교배 조합처럼 "목록"이 필요한
 *  페이지가 쓰고, 안 쓰는 페이지는 지금까지처럼 facts/links 만으로 끝냅니다. */
export type PublicSeoSection = {
  heading: string;
  facts?: readonly PublicSeoFact[];
  /** 링크가 아닌 순수 나열(작업 적성·드랍 등). */
  items?: readonly string[];
  links?: readonly { href: string; label: string }[];
  /** 상한을 걸어 잘라낸 경우 "전체 N개" 같은 실값 안내. */
  note?: string;
};

export type PublicSeoFallback = {
  facts: readonly PublicSeoFact[];
  heading: string;
  links: readonly { href: string; label: string }[];
  summary: string;
  sections?: readonly PublicSeoSection[];
};

export type PublicSeoMetadata = {
  /** hreflang 대상. 비지역화 경로는 undefined입니다. */
  alternateUrls?: PublicSeoAlternateUrls;
  canonicalUrl: string;
  description: string;
  fallback?: PublicSeoFallback;
  imageAlt: string;
  imageUrl: string;
  locale: PublicUrlLocale;
  openGraphType: "website" | "profile" | "article";
  /**
   * 색인 제외 여부. 소환사 프로필처럼 URL 공간이 무한한 경로에서, 실제 조회된 적
   * 없는(캐시에 없는) 페이지가 200 + 자기 canonical로 서빙되면 Google이 임의
   * 문자열 URL 전부를 색인 후보로 삼아 soft 404가 쌓입니다. 그런 페이지는 동작은
   * 유지하되 noindex로 색인 대상에서만 제외합니다.
   */
  robotsNoindex?: boolean;
  structuredData: readonly unknown[];
  title: string;
};

export type PalworldEntityKind = "pal" | "item" | "skill";

export type PalworldEntityRoute = {
  id: string;
  kind: PalworldEntityKind;
  locale: PublicUrlLocale;
};

/** palworld-data service의 detail 응답에서 SEO에 쓰는 필드만 구조적으로 받습니다.
 *
 * 아래 "본문용" 필드는 전부 optional 입니다 — 데이터 서비스가 없거나 스냅샷이
 * 비어 있으면 채우지 않고, fallback 은 지금까지의 요약 문구로 자연히 떨어집니다
 * (빈 페이지 금지). 값은 전부 화면에 이미 보이는 것과 같은 데이터입니다(cloaking 금지). */
export type PalworldSeoEntity = {
  descriptionEn?: string | null;
  descriptionJa?: string | null;
  descriptionKo?: string | null;
  elements?: readonly string[];
  id: string;
  nameEn?: string | null;
  nameJa?: string | null;
  nameKo?: string | null;
  number?: number;
  rarity?: number;
  type?: string;
  /* ── 본문용(팰) ── */
  stats?: Readonly<Record<string, number | undefined>>;
  workSuitabilities?: readonly { type: string; level: number }[];
  drops?: readonly { nameKo?: string | null; nameJa?: string | null; nameEn?: string | null }[];
  partnerSkillName?: string | null;
  nocturnal?: boolean;
  /** 이 팰이 나오는 부모 조합(대표 N개). */
  breedingParents?: readonly { a: string; b: string }[];
  breedingParentsTotal?: number;
  /** 이 팰을 부모로 했을 때 나오는 자식(대표 N개). */
  breedingChildren?: readonly { partner: string; child: string }[];
  breedingChildrenTotal?: number;
  /* ── 본문용(아이템) ── */
  sellPrice?: number;
  weight?: number;
  maxStack?: number;
  technologyLevel?: number;
  category?: string;
  /** 제작 재료 "이름 ×수량". */
  craftingMaterials?: readonly { name: string; count: number }[];
  craftingFacilities?: readonly string[];
  /** 획득 방법 문구(이미 로케일별로 조립된 라벨). */
  acquisitionLabels?: readonly string[];
  /** 이 아이템을 드랍하는 팰 — 상세로 이어지는 크롤 경로. */
  dropPals?: readonly { id: string; name: string }[];
  dropPalsTotal?: number;
  /* ── 본문용(스킬) ── */
  skillType?: string;
  element?: string;
  power?: number;
  cooldown?: number;
  passiveTier?: number;
  /** 이 스킬을 가진 팰 — 상세로 이어지는 크롤 경로. */
  relatedPals?: readonly { id: string; name: string }[];
  relatedPalsTotal?: number;
};

const PALWORLD_ENTITY_SEGMENTS: Readonly<Record<string, PalworldEntityKind>> = {
  pals: "pal",
  items: "item",
  skills: "skill"
};

const PALWORLD_ENTITY_LIST_PATH: Readonly<Record<PalworldEntityKind, string>> = {
  pal: "/palworld/pals",
  item: "/palworld/items",
  skill: "/palworld/skills"
};

/** 조작된 경로를 그대로 데이터 조회에 넘기지 않도록 공개 id 형식을 고정합니다. */
const PALWORLD_PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;

export function normalizePublicSeoPath(pathname: string): string {
  const unprefixed = stripPublicUrlLocalePrefix(pathname);
  return unprefixed !== "/" && unprefixed.endsWith("/") ? unprefixed.slice(0, -1) : unprefixed;
}

export function localizedPublicSeoUrl(normalizedPath: string, locale: PublicUrlLocale): string {
  const localizedPath = normalizedPath === "/" ? `/${locale}/` : `/${locale}${normalizedPath}`;
  return new URL(localizedPath, PUBLIC_SEO_ORIGIN).href;
}

/** 경로가 실제로 서빙하는 로케일만 담습니다(en 은 팰월드 등 영어판이 있는 곳만). */
export type PublicSeoAlternateUrls = Readonly<Partial<Record<PublicUrlLocale, string>>>;

export function publicSeoAlternateUrls(normalizedPath: string): PublicSeoAlternateUrls {
  return Object.fromEntries(publicSeoLocalesForPath(normalizedPath)
    .map((locale) => [locale, localizedPublicSeoUrl(normalizedPath, locale)]));
}

function alternateUrlsForPath(normalizedPath: string): PublicSeoAlternateUrls | undefined {
  if (!isLocalizablePublicDashboardRoute(normalizedPath)) return undefined;
  return publicSeoAlternateUrls(normalizedPath);
}

/* ── 반응속도 공유 링크 메타 (목업 reaction-test.html v5 §④-5) ──────────
 *
 * SNS 크롤러는 JS 를 실행하지 않으므로, 기록이 찍힌 미리보기는 서버가 만들어야
 * 합니다. 티어별 고정 이미지 9종을 쓰고 없는 티어는 게임 대표 이미지로 떨어집니다.
 *
 * 응답 어디에도 계정 식별자를 넣지 않습니다 — 표시 이름(공개 기록) 또는 익명
 * 표기까지만 나갑니다.
 */
/** 미니게임은 ko·ja 만 있습니다 — /en 공유 링크는 ko 판으로 봅니다. */
export type ReactionShareRoute = { locale: "ko" | "ja"; shareId: string };

export type ReactionShareSeoInput = {
  averageMs: number;
  tierKey: string;
  tierEmoji: string;
  tierLabel: string;
  displayName?: string;
  percentile?: number;
};

const REACTION_SHARE_IMAGE_TIERS = new Set([
  "challenger", "grandmaster", "master", "diamond", "emerald",
  "gold", "silver", "bronze", "iron"
]);

/** 공유 상세 경로 판정. id 형식이 아니면 일반 경로로 취급합니다. */
export function reactionShareRouteForPath(pathname: string): ReactionShareRoute | undefined {
  const locale = koJaPublicUrlLocale(publicUrlLocaleFromPathname(pathname) ?? "ko");
  const normalized = normalizePublicSeoPath(pathname);
  const match = /^\/games\/reaction\/r\/([A-Za-z0-9_-]{8,64})$/u.exec(normalized);
  if (!match?.[1]) return undefined;
  return { locale, shareId: match[1] };
}

export function reactionShareSeoMetadata(
  route: ReactionShareRoute,
  record: ReactionShareSeoInput
): PublicSeoMetadata {
  const normalizedPath = `/games/reaction/r/${route.shareId}`;
  const ja = route.locale === "ja";
  const who = record.displayName ?? (ja ? "匿名のチャレンジャー" : "익명의 도전자");
  const percentileText = record.percentile === undefined
    ? undefined
    : ja ? `上位 ${record.percentile}%` : `상위 ${record.percentile}%`;
  const description = [
    ja ? `${who}の記録` : `${who}의 기록`,
    percentileText,
    ja ? "あなたも挑戦してみてください" : "나도 도전해 보세요"
  ].filter(Boolean).join(" · ");

  /* 티어 이미지에도 문구가 박혀 있어 ja 는 -ja 판(ko/ja 각 9종 + 대표 이미지 제작 완료). */
  const imageSuffix = ja ? "-ja" : "";
  const imageFile = REACTION_SHARE_IMAGE_TIERS.has(record.tierKey)
    ? `yorogg-og-reaction-${record.tierKey}${imageSuffix}.png`
    : `yorogg-og-games${imageSuffix}.png`;

  return {
    canonicalUrl: localizedPublicSeoUrl(normalizedPath, route.locale),
    description,
    imageAlt: ja
      ? `${record.averageMs}ms ${record.tierLabel} の反応速度記録`
      : `${record.averageMs}ms ${record.tierLabel} 반응속도 기록`,
    imageUrl: `${PUBLIC_SEO_ORIGIN}/images/${imageFile}`,
    locale: route.locale,
    openGraphType: "website",
    structuredData: [],
    title: ja
      ? `${record.averageMs}ms · ${record.tierEmoji} ${record.tierLabel} — YORO.gg 反応速度`
      : `${record.averageMs}ms · ${record.tierEmoji} ${record.tierLabel} — YORO.gg 반응속도`
  };
}

export function palworldEntityRouteForPath(pathname: string): PalworldEntityRoute | undefined {
  const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
  const normalized = normalizePublicSeoPath(pathname);
  const match = /^\/palworld\/(pals|items|skills)\/([^/]+)$/u.exec(normalized);
  if (!match?.[1] || !match[2]) return undefined;
  const kind = PALWORLD_ENTITY_SEGMENTS[match[1]];
  if (!kind) return undefined;
  let id: string;
  try {
    id = decodeURIComponent(match[2]);
  } catch {
    return undefined;
  }
  if (!PALWORLD_PUBLIC_ID_PATTERN.test(id)) return undefined;
  return { id, kind, locale };
}

export function palworldEntityPath(kind: PalworldEntityKind, id: string): string {
  return `${PALWORLD_ENTITY_LIST_PATH[kind]}/${encodeURIComponent(id)}`;
}

/**
 * 기존 `?pal=` query 상세 URL을 신규 경로로 흡수하기 위한 대상 경로를 계산합니다.
 * 하나의 상세만 남기고 나머지 query는 버립니다.
 */
export function palworldEntityRedirectPath(
  pathname: string,
  search: URLSearchParams
): string | undefined {
  const normalized = normalizePublicSeoPath(pathname);
  if (normalized !== "/palworld/pals" && normalized !== "/palworld/items" && normalized !== "/palworld/skills") {
    return undefined;
  }
  const candidates: readonly [string, PalworldEntityKind][] = [
    ["pal", "pal"],
    ["item", "item"],
    ["skill", "skill"]
  ];
  for (const [key, kind] of candidates) {
    const values = search.getAll(key);
    const value = values.length === 1 ? values[0]?.trim() : undefined;
    if (!value || !PALWORLD_PUBLIC_ID_PATTERN.test(value)) continue;
    const locale = publicUrlLocaleFromPathname(pathname);
    const target = palworldEntityPath(kind, value);
    return locale ? `/${locale}${target}` : target;
  }
  return undefined;
}

function palworldEntityName(entity: PalworldSeoEntity, locale: PublicUrlLocale): string {
  const localized = locale === "ja" ? entity.nameJa : locale === "en" ? entity.nameEn : entity.nameKo;
  return localized?.trim() || entity.nameEn?.trim() || entity.nameKo?.trim() || entity.id;
}

function palworldEntityDescription(
  entity: PalworldSeoEntity,
  kind: PalworldEntityKind,
  locale: PublicUrlLocale
): string {
  const name = palworldEntityName(entity, locale);
  const detail = (locale === "ja"
    ? entity.descriptionJa
    : locale === "en"
      ? entity.descriptionEn
      : entity.descriptionKo)?.trim();
  if (detail) return detail.slice(0, 160);
  if (locale === "en") {
    if (kind === "pal") return `Check ${name}'s stats, elements, work suitability and breeding combos in Palworld.`;
    if (kind === "item") return `Check ${name}'s category, crafting materials and how to get it in Palworld.`;
    return `Check the effect of the Palworld skill ${name} and the pals that have it.`;
  }
  if (locale === "ja") {
    if (kind === "pal") return `パルワールドの${name}のステータス、属性、作業適性、配合の組み合わせを確認できます。`;
    if (kind === "item") return `パルワールドの${name}の分類、製作素材、入手方法を確認できます。`;
    return `パルワールドのスキル${name}の効果と関連するパルを確認できます。`;
  }
  if (kind === "pal") return `팰월드 ${name}의 능력치, 속성, 작업 적성과 교배 조합을 확인하세요.`;
  if (kind === "item") return `팰월드 ${name}의 분류, 제작 재료와 획득 방법을 확인하세요.`;
  return `팰월드 스킬 ${name}의 효과와 관련 팰을 확인하세요.`;
}

function palworldEntityTitle(
  entity: PalworldSeoEntity,
  kind: PalworldEntityKind,
  locale: PublicUrlLocale
): string {
  const name = palworldEntityName(entity, locale);
  const english = entity.nameEn?.trim();
  const label = english && english !== name ? `${name}(${english})` : name;
  if (locale === "en") {
    if (kind === "pal") return `${label} Stats & Breeding | Palworld | YORO.gg`;
    if (kind === "item") return `${label} Crafting & Drops | Palworld | YORO.gg`;
    return `${label} Skill Effect | Palworld | YORO.gg`;
  }
  if (locale === "ja") {
    if (kind === "pal") return `${label} ステータス・配合 | パルワールド | YORO.gg`;
    if (kind === "item") return `${label} 製作素材・入手方法 | パルワールド | YORO.gg`;
    return `${label} スキル効果 | パルワールド | YORO.gg`;
  }
  if (kind === "pal") return `${label} 능력치·교배 | 팰월드 | YORO.gg`;
  if (kind === "item") return `${label} 제작 재료·획득처 | 팰월드 | YORO.gg`;
  return `${label} 스킬 효과 | 팰월드 | YORO.gg`;
}

/* 본문 섹션 상한 — HTML 이 무한정 커지지 않게 자릅니다. 잘린 경우 "전체 N개"를
   실값으로 적어 두므로 크롤러도 규모를 알 수 있습니다. */
const PALWORLD_FALLBACK_COMBO_LIMIT = 12;
const PALWORLD_FALLBACK_LIST_LIMIT = 24;

/** 능력치 라벨 — 화면(팰 상세 카드)과 같은 항목만 같은 순서로 냅니다. */
const PALWORLD_STAT_LABELS: readonly ({ key: string } & PublicSeoLocaleText)[] = [
  { key: "hp", ko: "HP", ja: "HP", en: "HP" },
  { key: "attack", ko: "공격", ja: "攻撃", en: "Attack" },
  { key: "defense", ko: "방어", ja: "防御", en: "Defense" },
  { key: "meleeAttack", ko: "근접 공격", ja: "近接攻撃", en: "Melee attack" },
  { key: "shotAttack", ko: "원거리 공격", ja: "遠距離攻撃", en: "Ranged attack" },
  { key: "moveSpeed", ko: "이동 속도", ja: "移動速度", en: "Move speed" },
  { key: "runSpeed", ko: "달리기 속도", ja: "走行速度", en: "Run speed" },
  { key: "rideSprintSpeed", ko: "탑승 질주 속도", ja: "騎乗スプリント速度", en: "Ride sprint speed" },
  { key: "stamina", ko: "스태미나", ja: "スタミナ", en: "Stamina" },
  { key: "food", ko: "식사량", ja: "食事量", en: "Food" }
];

/** 작업 적성 라벨. 데이터가 영문 키로 오므로 표시명만 로케일에 맞춰 붙입니다. */
const PALWORLD_WORK_LABELS: Readonly<Record<string, PublicSeoLocaleText>> = {
  kindling: { ko: "불 붙이기", ja: "点火", en: "Kindling" },
  watering: { ko: "물 주기", ja: "水やり", en: "Watering" },
  planting: { ko: "파종", ja: "植え付け", en: "Planting" },
  generating_electricity: { ko: "발전", ja: "発電", en: "Generating electricity" },
  handiwork: { ko: "수작업", ja: "手作業", en: "Handiwork" },
  gathering: { ko: "채집", ja: "採取", en: "Gathering" },
  lumbering: { ko: "벌목", ja: "伐採", en: "Lumbering" },
  mining: { ko: "채굴", ja: "採掘", en: "Mining" },
  medicine_production: { ko: "약품 제작", ja: "薬品製作", en: "Medicine production" },
  cooling: { ko: "냉각", ja: "冷却", en: "Cooling" },
  transporting: { ko: "운반", ja: "運搬", en: "Transporting" },
  farming: { ko: "목장", ja: "牧場", en: "Farming" }
};

function palworldWorkLabel(type: string, locale: PublicUrlLocale): string {
  const label = PALWORLD_WORK_LABELS[type];
  return label ? localeText(label, locale) : type;
}

/**
 * 팰 상세 본문 섹션 — 능력치·작업 적성·교배 조합·드랍.
 *
 * 롱테일 데이터 사이트라 크롤러가 읽을 실데이터가 본문에 있어야 합니다(외부 SEO
 * 리뷰 2026-08-18: 기존 본문 142자). 값은 전부 화면 카드에 이미 있는 것과 같습니다.
 */
function palworldPalSections(
  entity: PalworldSeoEntity,
  locale: PublicUrlLocale
): PublicSeoSection[] {
  const ja = locale === "ja";
  const sections: PublicSeoSection[] = [];

  const statFacts = PALWORLD_STAT_LABELS
    .map((stat) => ({ label: localeText(stat, locale), value: entity.stats?.[stat.key] }))
    .filter((fact): fact is { label: string; value: number } => typeof fact.value === "number")
    .map((fact) => ({ label: fact.label, value: String(fact.value) }));
  if (statFacts.length > 0) {
    sections.push({ heading: t(locale, "능력치", "ステータス", "Base stats"), facts: statFacts });
  }

  if (entity.workSuitabilities?.length) {
    sections.push({
      heading: t(locale, "작업 적성", "作業適性", "Work suitability"),
      items: entity.workSuitabilities
        .slice(0, PALWORLD_FALLBACK_LIST_LIMIT)
        .map((work) => `${palworldWorkLabel(work.type, locale)} Lv.${work.level}`)
    });
  }

  if (entity.partnerSkillName) {
    sections.push({
      heading: t(locale, "파트너 스킬", "パートナースキル", "Partner skill"),
      items: [entity.partnerSkillName]
    });
  }

  const drops = (entity.drops ?? [])
    .map((drop) => (ja ? drop.nameJa : locale === "en" ? drop.nameEn : drop.nameKo) || drop.nameEn || "")
    .filter((name) => name.length > 0);
  if (drops.length > 0) {
    sections.push({
      heading: t(locale, "드랍 아이템", "ドロップ", "Drops"),
      items: drops.slice(0, PALWORLD_FALLBACK_LIST_LIMIT)
    });
  }

  if (entity.breedingParents?.length) {
    const total = entity.breedingParentsTotal ?? entity.breedingParents.length;
    const shown = entity.breedingParents.slice(0, PALWORLD_FALLBACK_COMBO_LIMIT);
    sections.push({
      heading: t(locale, "이 팰이 나오는 교배 조합", "この個体が生まれる配合", "Breeding combos that produce it"),
      items: shown.map((pair) => `${pair.a} × ${pair.b}`),
      ...(total > shown.length
        ? { note: t(locale, `전체 ${total}개 조합`, `全${total}件の組み合わせ`, `${total} combos in total`) }
        : {})
    });
  }

  if (entity.breedingChildren?.length) {
    const total = entity.breedingChildrenTotal ?? entity.breedingChildren.length;
    const shown = entity.breedingChildren.slice(0, PALWORLD_FALLBACK_COMBO_LIMIT);
    sections.push({
      heading: t(locale, "이 팰을 부모로 한 교배", "この個体を親にした配合", "Breeding with this pal as a parent"),
      items: shown.map((pair) => `× ${pair.partner} → ${pair.child}`),
      ...(total > shown.length
        ? { note: t(locale, `전체 ${total}개 조합`, `全${total}件の組み合わせ`, `${total} combos in total`) }
        : {})
    });
  }

  return sections;
}

/**
 * 아이템 상세 본문 — 기본 정보·제작·획득·드랍 팰.
 *
 * 드랍 팰은 팰 상세로 이어지는 내부 링크라 크롤 경로도 겸합니다.
 * 값은 전부 화면 카드에 이미 있는 것과 같습니다(cloaking 금지).
 */
function palworldItemSections(
  entity: PalworldSeoEntity,
  locale: PublicUrlLocale
): PublicSeoSection[] {
  const ja = locale === "ja";
  const sections: PublicSeoSection[] = [];

  const basics: PublicSeoFact[] = [];
  if (typeof entity.sellPrice === "number") {
    basics.push({ label: t(locale, "판매가", "売却価格", "Sell price"), value: String(entity.sellPrice) });
  }
  if (typeof entity.weight === "number") {
    basics.push({ label: t(locale, "무게", "重量", "Weight"), value: String(entity.weight) });
  }
  if (typeof entity.maxStack === "number") {
    basics.push({ label: t(locale, "최대 보유", "最大スタック", "Max stack"), value: String(entity.maxStack) });
  }
  if (typeof entity.technologyLevel === "number") {
    basics.push({ label: t(locale, "기술 레벨", "テクノロジーLv", "Technology level"), value: String(entity.technologyLevel) });
  }
  if (basics.length > 0) {
    sections.push({ heading: t(locale, "기본 정보", "基本情報", "Basics"), facts: basics });
  }

  if (entity.craftingMaterials?.length) {
    sections.push({
      heading: t(locale, "제작 재료", "製作素材", "Crafting materials"),
      items: entity.craftingMaterials
        .slice(0, PALWORLD_FALLBACK_LIST_LIMIT)
        .map((material) => `${material.name} ×${material.count}`)
    });
  }

  if (entity.craftingFacilities?.length) {
    sections.push({
      heading: t(locale, "제작 시설", "製作施設", "Crafting facility"),
      items: entity.craftingFacilities.slice(0, PALWORLD_FALLBACK_LIST_LIMIT)
    });
  }

  if (entity.acquisitionLabels?.length) {
    sections.push({
      heading: t(locale, "획득 방법", "入手方法", "How to obtain"),
      items: entity.acquisitionLabels.slice(0, PALWORLD_FALLBACK_LIST_LIMIT)
    });
  }

  if (entity.dropPals?.length) {
    const total = entity.dropPalsTotal ?? entity.dropPals.length;
    const shown = entity.dropPals.slice(0, PALWORLD_FALLBACK_COMBO_LIMIT);
    sections.push({
      heading: t(locale, "드랍하는 팰", "ドロップするパル", "Dropped by"),
      links: shown.map((pal) => ({ href: `/${locale}/palworld/pals/${pal.id}`, label: pal.name })),
      ...(total > shown.length
        ? { note: t(locale, `전체 ${total}종의 팰`, `全${total}種のパル`, `${total} pals in total`) }
        : {})
    });
  }

  return sections;
}

/**
 * 스킬 상세 본문 — 기본 정보 + 이 스킬을 가진 팰.
 *
 * passiveEffects 의 원시 타입명(ElementResist_Normal 등)은 화면에 그대로 노출되지
 * 않으므로 본문에도 넣지 않습니다 — 설명문(descriptionKo/Ja)이 이미 그 내용을
 * 사람이 읽는 문장으로 담고 있고, 내부 식별자를 본문에 흘리면 cloaking 에 가깝습니다.
 */
function palworldSkillSections(
  entity: PalworldSeoEntity,
  locale: PublicUrlLocale
): PublicSeoSection[] {
  const ja = locale === "ja";
  const sections: PublicSeoSection[] = [];

  const basics: PublicSeoFact[] = [];
  if (entity.skillType) {
    basics.push({
      label: t(locale, "종류", "種別", "Type"),
      value: entity.skillType === "active"
        ? t(locale, "액티브 스킬", "アクティブスキル", "Active skill")
        : entity.skillType === "passive"
          ? t(locale, "패시브 스킬", "パッシブスキル", "Passive skill")
          : entity.skillType
    });
  }
  if (entity.element) {
    basics.push({ label: t(locale, "속성", "属性", "Element"), value: entity.element });
  }
  if (typeof entity.power === "number") {
    basics.push({ label: t(locale, "위력", "威力", "Power"), value: String(entity.power) });
  }
  if (typeof entity.cooldown === "number") {
    basics.push({ label: t(locale, "쿨타임", "クールタイム", "Cooldown"), value: String(entity.cooldown) });
  }
  if (typeof entity.passiveTier === "number") {
    basics.push({ label: t(locale, "등급", "ランク", "Passive tier"), value: String(entity.passiveTier) });
  }
  if (basics.length > 0) {
    sections.push({ heading: t(locale, "기본 정보", "基本情報", "Basics"), facts: basics });
  }

  if (entity.relatedPals?.length) {
    const total = entity.relatedPalsTotal ?? entity.relatedPals.length;
    const shown = entity.relatedPals.slice(0, PALWORLD_FALLBACK_COMBO_LIMIT);
    sections.push({
      heading: t(locale, "이 스킬을 가진 팰", "このスキルを持つパル", "Related Pals"),
      links: shown.map((pal) => ({ href: `/${locale}/palworld/pals/${pal.id}`, label: pal.name })),
      ...(total > shown.length
        ? { note: t(locale, `전체 ${total}종의 팰`, `全${total}種のパル`, `${total} pals in total`) }
        : {})
    });
  }

  return sections;
}

function palworldEntityFallback(
  entity: PalworldSeoEntity,
  kind: PalworldEntityKind,
  locale: PublicUrlLocale
): PublicSeoFallback {
  const name = palworldEntityName(entity, locale);
  const ja = locale === "ja";
  const facts: PublicSeoFact[] = [];
  if (typeof entity.number === "number") {
    facts.push({ label: t(locale, "도감 번호", "図鑑番号", "Paldeck no."), value: `No.${entity.number}` });
  }
  if (entity.elements?.length) {
    facts.push({ label: t(locale, "속성", "属性", "Elements"), value: entity.elements.join(", ") });
  }
  if (typeof entity.rarity === "number") {
    facts.push({ label: t(locale, "희귀도", "レア度", "Rarity"), value: String(entity.rarity) });
  }
  /* 스킬은 아래 "기본 정보" 섹션이 종류를 사람이 읽는 문구로 다시 냅니다.
     여기서도 내면 원시값("active")과 정제값이 나란히 두 번 보입니다. */
  if (entity.type && kind !== "skill") {
    facts.push({ label: t(locale, "종류", "種別", "Type"), value: entity.type });
  }
  /* 영문 이름은 ko·ja 화면에만 있는 보조 정보입니다 — en 판에서는 제목이 곧
     영문 이름이라 같은 값이 두 번 나옵니다. */
  if (entity.nameEn && locale !== "en") {
    facts.push({ label: t(locale, "영문 이름", "英語名", "English name"), value: entity.nameEn });
  }
  const listPath = PALWORLD_ENTITY_LIST_PATH[kind];
  const links = [
    {
      href: `/${locale}${listPath}`,
      label: kind === "pal"
        ? t(locale, "팰 도감 보기", "パル図鑑を見る", "View Paldeck")
        : kind === "item"
          ? t(locale, "아이템 목록 보기", "アイテム一覧を見る", "View items")
          : t(locale, "스킬 목록 보기", "スキル一覧を見る", "View skills")
    },
    ...(kind === "pal"
      ? [{
          href: `/${locale}/palworld/breeding`,
          label: t(locale, "교배 조합 보기", "配合の組み合わせを見る", "View breeding pairs")
        }]
      : []),
    { href: `/${locale}/palworld`, label: t(locale, "팰월드 데이터베이스", "パルワールドデータベース", "Palworld Database") }
  ];
  const sections = kind === "pal"
    ? palworldPalSections(entity, locale)
    : kind === "item"
      ? palworldItemSections(entity, locale)
      : palworldSkillSections(entity, locale);
  return {
    facts,
    heading: name,
    links,
    summary: palworldEntityDescription(entity, kind, locale),
    ...(sections.length > 0 ? { sections } : {})
  };
}

/** Palworld 엔티티 상세 URL의 metadata를 만듭니다. */
export function palworldEntitySeoMetadata(
  route: PalworldEntityRoute,
  entity: PalworldSeoEntity
): PublicSeoMetadata {
  const { kind, locale } = route;
  const normalizedPath = palworldEntityPath(kind, entity.id);
  const canonicalUrl = localizedPublicSeoUrl(normalizedPath, locale);
  const title = palworldEntityTitle(entity, kind, locale);
  const description = palworldEntityDescription(entity, kind, locale);
  const name = palworldEntityName(entity, locale);
  return {
    alternateUrls: publicSeoAlternateUrls(normalizedPath),
    canonicalUrl,
    description,
    fallback: palworldEntityFallback(entity, kind, locale),
    imageAlt: name,
    imageUrl: socialImageForPath(normalizedPath, locale).url,
    locale,
    openGraphType: "article",
    structuredData: [
      websiteStructuredData(locale),
      breadcrumbStructuredData(normalizedPath, locale, name),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        inLanguage: locale === "ja" ? "ja-JP" : "ko-KR",
        mainEntityOfPage: canonicalUrl,
        about: {
          "@type": "Thing",
          name,
          ...(entity.nameEn ? { alternateName: entity.nameEn } : {})
        },
        isPartOf: {
          "@type": "WebSite",
          name: "YORO.gg",
          url: PUBLIC_SEO_ORIGIN
        },
        publisher: organizationStructuredData()
      }
    ],
    title
  };
}

function websiteStructuredData(locale: PublicUrlLocale): unknown {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "YORO.gg",
    url: `${PUBLIC_SEO_ORIGIN}/${locale}/`,
    inLanguage: locale === "ja" ? "ja-JP" : "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${PUBLIC_SEO_ORIGIN}/${locale}/palworld/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

function organizationStructuredData(): unknown {
  return {
    "@type": "Organization",
    name: "YORO.gg",
    url: PUBLIC_SEO_ORIGIN,
    logo: {
      "@type": "ImageObject",
      url: `${PUBLIC_SEO_ORIGIN}/favicon.png`
    }
  };
}

const BREADCRUMB_SEGMENT_LABELS: Readonly<Record<string, PublicSeoLocaleText>> = {
  "/lol": { ko: "LoL 전적 검색", ja: "LoL戦績検索" },
  "/lol/aram": { ko: "증강 칼바람", ja: "オーグメントARAM" },
  "/patch-notes": { ko: "패치 노트", ja: "パッチノート" },
  /* "/lol/summoners"(목록)는 실제 라우트가 없어 404입니다 — 여기 두면
     genericFallback의 sibling 링크와 breadcrumb JSON-LD가 404 URL을
     크롤러에게 제공합니다. 라벨이 없으면 두 곳 모두에서 자동으로 빠지고,
     소환사 상세 breadcrumb은 "홈 > LoL 전적 검색 > 소환사명"으로 이어집니다. */
  "/palworld": { ko: "팰월드", ja: "パルワールド", en: "Palworld" },
  "/palworld/pals": { ko: "팰 도감", ja: "パル図鑑", en: "Paldeck" },
  "/palworld/items": { ko: "아이템", ja: "アイテム", en: "Items" },
  "/palworld/skills": { ko: "스킬", ja: "スキル", en: "Skills" },
  "/palworld/breeding": { ko: "교배 조합", ja: "配合組み合わせ", en: "Breeding pairs" },
  "/palworld/technology": { ko: "기술 해금", ja: "テクノロジー解放", en: "Technology" },
  "/palworld/map": { ko: "월드 지도", ja: "ワールドマップ", en: "World map" },
  "/palworld/search": { ko: "통합 검색", ja: "統合検索" },
  "/valorant": { ko: "발로란트", ja: "VALORANT" },
  "/valorant/agents": { ko: "요원", ja: "エージェント" },
  "/valorant/weapons": { ko: "무기", ja: "武器" },
  "/valorant/maps": { ko: "맵", ja: "マップ" },
  "/valorant/ranked": { ko: "랭킹", ja: "ランキング" },
  "/minecraft": { ko: "마인크래프트", ja: "マインクラフト" },
  "/minecraft/recipes": { ko: "조합법", ja: "レシピ" },
  "/minecraft/items": { ko: "아이템", ja: "アイテム" },
  "/minecraft/enchants": { ko: "인챈트", ja: "エンチャント" },
  "/minecraft/library": { ko: "자료실", ja: "資料室" },
  "/minecraft/patch-notes": { ko: "패치 노트", ja: "パッチノート" },
  "/bot": { ko: "YORO Bot", ja: "YORO Bot" },
  "/bot/getting-started": { ko: "사용방법", ja: "使い方" },
  "/bot/commands": { ko: "명령어 목록", ja: "コマンド一覧" },
  "/bot/game-files": { ko: "게임파일", ja: "ゲームファイル" },
  "/follow": { ko: "팔로우", ja: "フォロー" },
  "/participation": { ko: "시청자 참여", ja: "視聴者参加" },
  /* 미니게임 — 라벨이 있는 경로만 breadcrumb·sibling 링크에 오릅니다. 준비 중인
     게임(registry 의 coming)은 라우트가 없으므로 여기에 넣지 않습니다. */
  "/games": { ko: "미니게임", ja: "ミニゲーム" },
  "/games/reaction": { ko: "반응속도 테스트", ja: "反応速度テスト" },
  "/streamers": { ko: "스트리머 추천", ja: "配信者おすすめ" },
  "/streamers/new": { ko: "추천 글 쓰기", ja: "おすすめを書く" }
};

function breadcrumbStructuredData(
  normalizedPath: string,
  locale: PublicUrlLocale,
  leafName?: string
): unknown {
  const segments = normalizedPath.split("/").filter(Boolean);
  const items: unknown[] = [{
    "@type": "ListItem",
    position: 1,
    name: "YORO.gg",
    item: `${PUBLIC_SEO_ORIGIN}/${locale}/`
  }];
  let cursor = "";
  for (const [index, segment] of segments.entries()) {
    cursor += `/${segment}`;
    const isLeaf = index === segments.length - 1;
    const labels = BREADCRUMB_SEGMENT_LABELS[cursor];
    const label = (labels ? localeText(labels, locale) : undefined)
      ?? (isLeaf && leafName ? leafName : undefined);
    if (!label) continue;
    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: label,
      item: localizedPublicSeoUrl(cursor, locale)
    });
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
  };
}

function homeFallback(locale: PublicUrlLocale): PublicSeoFallback {
  const ja = locale === "ja";
  return {
    facts: [],
    heading: ja ? "YORO.gg — LoL戦績検索とパルワールドデータベース" : "YORO.gg — LoL 전적 검색과 팰월드 데이터베이스",
    summary: ja
      ? "League of Legendsの戦績検索、配信者のLIVE状況、視聴者参加機能、そしてパルワールドのパル・アイテム・スキル・配合データをまとめて確認できます。"
      : "League of Legends 전적 검색, 스트리머 방송 상태, 시청자 참여 기능과 팰월드 팰·아이템·스킬·교배 데이터를 한곳에서 확인하세요.",
    links: [
      { href: `/${locale}/lol`, label: ja ? "LoL戦績検索" : "LoL 전적 검색" },
      { href: `/${locale}/lol/aram`, label: ja ? "オーグメントARAM" : "증강 칼바람" },
      { href: `/${locale}/patch-notes`, label: ja ? "パッチノート" : "패치 노트" },
      { href: `/${locale}/palworld`, label: t(locale, "팰월드 데이터베이스", "パルワールドデータベース", "Palworld Database") },
      { href: `/${locale}/palworld/pals`, label: ja ? "パル図鑑" : "팰 도감" },
      { href: `/${locale}/palworld/breeding`, label: ja ? "配合組み合わせ" : "교배 조합" },
      { href: `/${locale}/bot`, label: "YORO Bot" }
    ]
  };
}

/** 팰 목록 링크 상한 — 교배 페이지 본문의 크롤 경로용. 574종 전량을 넣으면
 *  HTML 이 과하게 커지므로 상한을 두고 전체 개수를 실값으로 적습니다. */
const PALWORLD_BREEDING_LINK_LIMIT = 60;

/**
 * 교배 페이지 본문 — 시스템 요약 + 팰 상세 내부 링크.
 *
 * 목적은 크롤 경로 확보입니다: 팰 상세는 sitemap 에 전량 있지만, 본문에서
 * 이어지는 내부 링크가 없으면 크롤러가 중요도를 낮게 봅니다.
 * pals 가 비어 오면(스냅샷 없음) 섹션을 만들지 않고 요약만 남깁니다.
 */
export function palworldBreedingFallback(
  base: PublicSeoFallback,
  locale: PublicUrlLocale,
  pals: readonly { id: string; name: string }[],
  totalPals: number
): PublicSeoFallback {
  if (pals.length === 0) return base;
  const ja = locale === "ja";
  const shown = pals.slice(0, PALWORLD_BREEDING_LINK_LIMIT);
  return {
    ...base,
    sections: [
      {
        heading: t(locale, "교배 시스템", "配合の仕組み", "How breeding works"),
        items: locale === "ja"
          ? [
            "2体のパルを牧場に預けるとケーキを消費して卵が生まれます。",
            "生まれるパルは両親の配合ランクの平均で決まります。",
            "特定の組み合わせでのみ生まれる特殊配合があります。"
          ]
          : locale === "en"
            ? [
              "Place two pals in the Breeding Farm and a cake is consumed to produce an egg.",
              "The pal that hatches is decided by the average breeding rank of both parents.",
              "Some pals only come from specific special combinations."
            ]
            : [
              "팰 2마리를 목장에 맡기면 케이크를 소비해 알이 나옵니다.",
              "태어나는 팰은 부모의 교배 랭크 평균으로 정해집니다.",
              "특정 조합에서만 나오는 특수 교배가 있습니다."
            ]
      },
      {
        heading: t(locale, "팰별 교배 조합", "パル別の配合", "Breeding by Pal"),
        links: shown.map((pal) => ({
          href: `/${locale}/palworld/pals/${pal.id}`,
          label: pal.name
        })),
        ...(totalPals > shown.length
          ? { note: t(locale, `전체 ${totalPals}종의 팰`, `全${totalPals}種のパル`, `${totalPals} pals in total`) }
          : {})
      }
    ]
  };
}

function genericFallback(
  content: PublicSeoContent,
  normalizedPath: string,
  locale: PublicUrlLocale
): PublicSeoFallback {
  const ja = locale === "ja";
  const heading = content.title.split("|")[0]?.trim() || content.title;
  const siblings = Object.entries(BREADCRUMB_SEGMENT_LABELS)
    .filter(([routePath]) => routePath !== normalizedPath
      && routePath.startsWith(`/${normalizedPath.split("/").filter(Boolean)[0] ?? ""}`))
    .slice(0, 6)
    .map(([routePath, labels]) => ({ href: `/${locale}${routePath}`, label: localeText(labels, locale) }));
  return {
    facts: [],
    heading,
    summary: content.description,
    links: siblings.length > 0
      ? siblings
      : [{ href: `/${locale}/`, label: t(locale, "홈", "ホーム", "Home") }]
  };
}

const KOREAN_DEFAULT: PublicSeoContent = {
  /* 공유 카드에서 "YORO.gg" 단독은 무엇을 하는 사이트인지 전달하지 못합니다.
     X 카드는 제목만 크게 보이므로 대표 기능 두 개를 제목에 싣습니다. */
  title: "YORO.gg — LoL 전적 검색·팰월드 데이터베이스",
  description: "YORO.gg에서 League of Legends 전적 검색, 스트리머 방송 상태, 팔로우와 시청자 참여 기능을 확인하세요."
};

const KOREAN_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  "/": KOREAN_DEFAULT,
  "/lol": {
    title: "LoL 전적 검색 | YORO.gg",
    description: "League of Legends 전적과 최근 게임 정보를 검색하세요."
  },
  "/lol/aram": {
    title: "증강 칼바람 | YORO.gg",
    description: "증강 칼바람의 증강 정보와 조합 데이터를 확인하세요."
  },
  "/patch-notes": {
    title: "LoL 패치 노트 | YORO.gg",
    description: "리그 오브 레전드 패치 노트를 최신순으로 모아 봅니다. 본문은 Riot Games 원문에서 확인하세요."
  },
  "/follow": {
    title: "팔로우 중인 스트리머 | YORO.gg",
    description: "Twitch에서 팔로우 중인 스트리머의 방송 상태를 확인하세요."
  },
  "/participation": {
    title: "시청자 참여 | YORO.gg",
    description: "YORO.gg 스트리머 방송의 시청자 참여 기능을 이용하세요."
  },
  "/bot": {
    title: "YORO Bot | Discord 게임 서버 도우미",
    description: "Discord 서버와 게임 서버 운영 기능을 안전하게 연결하는 YORO Bot을 확인하세요."
  },
  "/bot/getting-started": {
    title: "사용방법 | YORO Bot",
    description: "Bot 초대부터 Organization, Palworld REST와 Discord Bot 제어 연결까지 순서대로 확인하세요."
  },
  "/bot/commands": {
    title: "명령어 목록 | YORO Bot",
    description: "YORO Bot의 일반 사용자, 작성자와 관리자 명령 및 활성화 조건을 확인하세요."
  },
  "/bot/game-files": {
    title: "Palworld 게임파일 | YORO Bot",
    description: "검증된 PalWorldSettings.ini를 브라우저에서 만들고 안전하게 설치하는 방법을 확인하세요."
  },
  "/privacy": {
    title: "개인정보 처리방침 | YORO.gg",
    description: "YORO.gg의 개인정보 처리방침을 확인하세요."
  },
  "/terms": {
    title: "이용약관 | YORO.gg",
    description: "YORO.gg 서비스 이용약관을 확인하세요."
  },
  "/contact": {
    title: "문의 | YORO.gg",
    description: "YORO.gg 서비스 운영자에게 문의하세요."
  },
  "/palworld": {
    title: "팰월드 데이터베이스 | YORO.gg",
    description: "Pal, 아이템, 스킬과 교배 정보를 한곳에서 확인하세요."
  },
  "/palworld/pals": {
    title: "Pal 도감 | YORO.gg",
    description: "Palworld Pal의 속성, 능력치, 작업 적성과 상세 정보를 확인하세요."
  },
  "/palworld/breeding": {
    title: "교배 조합 | YORO.gg",
    description: "Palworld 일반·특수 교배 결과와 부모 조합을 확인하세요."
  },
  "/palworld/items": {
    title: "아이템 | YORO.gg",
    description: "Palworld 아이템의 분류, 제작 재료와 상세 정보를 확인하세요."
  },
  "/palworld/technology": {
    title: "Palworld 기술 해금 | YORO.gg",
    description: "기술 레벨별로 해금되는 Palworld 아이템을 확인하세요."
  },
  "/palworld/skills": {
    title: "Palworld 스킬 | YORO.gg",
    description: "액티브·파트너·패시브 스킬의 효과와 관련 Pal을 확인하세요."
  },
  "/palworld/map": {
    title: "Palworld 월드 지도 | YORO.gg",
    description: "필드 보스·야생 스폰과 이동·수집 위치를 레이어별로 탐색하세요."
  },
  "/palworld/search": {
    title: "Palworld 통합 검색 | YORO.gg",
    description: "Palworld Pal과 아이템을 한국어·일본어 이름으로 검색하세요."
  },
  "/valorant": {
    title: "발로란트 전적·도감 | YORO.gg",
    description: "공식 발로란트 요원·무기·맵 정보와 동의한 스트리머의 전적, 경쟁전 리더보드를 확인하세요."
  },
  "/valorant/agents": {
    title: "발로란트 요원 도감 | YORO.gg",
    description: "공식 한국어·일본어 이름과 설명으로 발로란트 요원과 스킬을 확인하세요."
  },
  "/valorant/weapons": {
    title: "발로란트 무기 도감 | YORO.gg",
    description: "발로란트 표준 무기를 분류별로 확인하세요."
  },
  "/valorant/maps": {
    title: "발로란트 맵 | YORO.gg",
    description: "발로란트 경쟁전·일반전의 표준 맵 정보를 확인하세요."
  },
  "/valorant/ranked": {
    title: "발로란트 경쟁전 리더보드 | YORO.gg",
    description: "Riot 공식 경쟁전 리더보드를 지역과 액트별로 확인하세요."
  },
  "/minecraft": {
    title: "마인크래프트 위키 | YORO.gg",
    description: "Java 마인크래프트 아이템, 조합법과 인챈트 카탈로그를 확인하세요."
  },
  "/minecraft/recipes": {
    title: "마인크래프트 조합법 | YORO.gg",
    description: "Java 마인크래프트 제작 조합법과 재료 배치를 검색하세요."
  },
  "/minecraft/items": {
    title: "마인크래프트 아이템 | YORO.gg",
    description: "Java 마인크래프트 아이템의 영문 ID, 묶음 수와 내구도를 확인하세요."
  },
  "/minecraft/enchants": {
    title: "마인크래프트 인챈트 | YORO.gg",
    description: "Java 마인크래프트 인챈트의 최대 레벨과 배타 관계를 확인하세요."
  },
  "/minecraft/library": {
    title: "마인크래프트 자료실 준비 중 | YORO.gg",
    description: "마인크래프트 모드·플러그인·셰이더 자료실을 준비하고 있습니다."
  },
  "/minecraft/patch-notes": {
    title: "마인크래프트 패치 노트 준비 중 | YORO.gg",
    description: "Mojang 공식 피드 기반 Java·Bedrock 패치 노트를 준비하고 있습니다."
  },
  "/games": {
    title: "미니게임 | YORO.gg",
    description: "게이머 반사신경 훈련장 — 반응속도 테스트로 내 LoL 티어를 확인해 보세요."
  },
  "/streamers": {
    title: "스트리머 추천 | YORO.gg",
    description: "시청자가 직접 추천한 스트리머를 게임별로 모았습니다. 추천 글은 누구나 읽을 수 있습니다."
  },
  "/streamers/new": {
    title: "추천 글 쓰기 | YORO.gg",
    description: "채널 주소와 주력 게임을 함께 적어 스트리머를 추천해 보세요."
  },
  "/games/reaction": {
    title: "반응속도 테스트 | YORO.gg",
    description: "초록 신호에 최대한 빨리! 5회 평균으로 LoL 티어 등급을 받아보세요."
  }
};

const JAPANESE_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  "/": {
    title: "YORO.gg — LoL戦績検索・パルワールドデータベース",
    description: "YORO.ggでLeague of Legendsの戦績検索、配信者のLIVE状況、フォロー、視聴者参加機能を確認できます。"
  },
  "/lol": {
    title: "LoL戦績検索 | YORO.gg",
    description: "League of Legendsの戦績と最近のゲーム情報を検索できます。"
  },
  "/lol/aram": {
    title: "オーグメントARAM | YORO.gg",
    description: "オーグメントARAMのオーグメント情報と組み合わせデータを確認できます。"
  },
  "/patch-notes": {
    title: "LoLパッチノート | YORO.gg",
    description: "リーグ・オブ・レジェンドのパッチノートを新しい順にまとめます。本文はRiot Gamesの原文でご確認ください。"
  },
  "/follow": {
    title: "フォロー中の配信者 | YORO.gg",
    description: "Twitchでフォロー中の配信者のLIVE状況を確認できます。"
  },
  "/participation": {
    title: "視聴者参加 | YORO.gg",
    description: "YORO.gg配信者の視聴者参加機能を利用できます。"
  },
  "/bot": {
    title: "YORO Bot | Discordゲームサーバーアシスタント",
    description: "Discordサーバーとゲームサーバー運用機能を安全に連携するYORO Botを確認できます。"
  },
  "/bot/getting-started": {
    title: "使い方 | YORO Bot",
    description: "Bot招待からOrganization、Palworld REST、Discord Bot制御の連携まで順番に確認できます。"
  },
  "/bot/commands": {
    title: "コマンド一覧 | YORO Bot",
    description: "YORO Botの一般ユーザー、実行者、管理者コマンドと有効化条件を確認できます。"
  },
  "/bot/game-files": {
    title: "Palworldゲームファイル | YORO Bot",
    description: "検証済みPalWorldSettings.iniをブラウザで作成し、安全に設置する方法を確認できます。"
  },
  "/privacy": {
    title: "プライバシーポリシー | YORO.gg",
    description: "YORO.ggのプライバシーポリシーを確認できます。"
  },
  "/terms": {
    title: "利用規約 | YORO.gg",
    description: "YORO.ggのサービス利用規約を確認できます。"
  },
  "/contact": {
    title: "お問い合わせ | YORO.gg",
    description: "YORO.ggの運営者へお問い合わせいただけます。"
  },
  "/palworld": {
    title: "パルワールドデータベース | YORO.gg",
    description: "パル、アイテム、スキル、配合情報をまとめて確認できます。"
  },
  "/palworld/pals": {
    title: "パル図鑑 | YORO.gg",
    description: "パルの属性、ステータス、作業適性、詳細情報を確認できます。"
  },
  "/palworld/breeding": {
    title: "配合組み合わせ | YORO.gg",
    description: "パルワールドの通常・特殊配合結果と親の組み合わせを確認できます。"
  },
  "/palworld/items": {
    title: "アイテム | YORO.gg",
    description: "パルワールドのアイテム分類、製作素材、詳細情報を確認できます。"
  },
  "/palworld/technology": {
    title: "テクノロジー解放 | YORO.gg",
    description: "テクノロジーレベルごとに解放されるアイテムを確認できます。"
  },
  "/palworld/skills": {
    title: "パルワールドスキル | YORO.gg",
    description: "アクティブ・パートナー・パッシブスキルの効果と関連パルを確認できます。"
  },
  "/palworld/map": {
    title: "パルワールドワールドマップ | YORO.gg",
    description: "フィールドボス、野生スポーン、移動・収集地点をレイヤー別に探索できます。"
  },
  "/palworld/search": {
    title: "パルワールド統合検索 | YORO.gg",
    description: "パルとアイテムを韓国語・日本語の名前で検索できます。"
  },
  "/valorant": {
    title: "VALORANT戦績・データベース | YORO.gg",
    description: "公式のエージェント・武器・マップ情報、同意した配信者の戦績、コンペティティブランキングを確認できます。"
  },
  "/valorant/agents": {
    title: "VALORANTエージェント | YORO.gg",
    description: "公式の韓国語・日本語表記でVALORANTのエージェントとアビリティを確認できます。"
  },
  "/valorant/weapons": {
    title: "VALORANT武器 | YORO.gg",
    description: "VALORANTの標準武器をカテゴリー別に確認できます。"
  },
  "/valorant/maps": {
    title: "VALORANTマップ | YORO.gg",
    description: "VALORANTのコンペティティブ・アンレート用標準マップを確認できます。"
  },
  "/valorant/ranked": {
    title: "VALORANTコンペティティブランキング | YORO.gg",
    description: "Riot公式コンペティティブランキングを地域・Act別に確認できます。"
  },
  "/minecraft": {
    title: "マインクラフト Wiki | YORO.gg",
    description: "Java版マインクラフトのアイテム、レシピ、エンチャントカタログを確認できます。"
  },
  "/minecraft/recipes": {
    title: "マインクラフト レシピ | YORO.gg",
    description: "Java版マインクラフトのクラフトレシピと材料配置を検索できます。"
  },
  "/minecraft/items": {
    title: "マインクラフト アイテム | YORO.gg",
    description: "Java版マインクラフトのアイテムID、スタック数、耐久値を確認できます。"
  },
  "/minecraft/enchants": {
    title: "マインクラフト エンチャント | YORO.gg",
    description: "Java版マインクラフトのエンチャント最大レベルと排他関係を確認できます。"
  },
  "/minecraft/library": {
    title: "マインクラフト 資料室 準備中 | YORO.gg",
    description: "マインクラフトのMOD・プラグイン・シェーダー資料室を準備しています。"
  },
  "/minecraft/patch-notes": {
    title: "マインクラフト パッチノート 準備中 | YORO.gg",
    description: "Mojang公式フィードに基づくJava・Bedrockパッチノートを準備しています。"
  },
  "/games": {
    title: "ミニゲーム | YORO.gg",
    description: "ゲーマーの反射神経トレーニング — 反応速度テストで自分のLoLティアを確認しましょう。"
  },
  "/streamers": {
    title: "配信者おすすめ | YORO.gg",
    description: "視聴者が選んだ配信者をゲーム別にまとめました。おすすめはどなたでも読めます。"
  },
  "/streamers/new": {
    title: "おすすめを書く | YORO.gg",
    description: "チャンネルURLと主なゲームを添えて配信者をおすすめできます。"
  },
  "/games/reaction": {
    title: "反応速度テスト | YORO.gg",
    description: "緑の信号にできるだけ早く! 5回平均でLoLティア等級を確認しましょう。"
  }
};

/* 영어 메타 — 팰월드 섹션만.
 *
 * 문구는 대시보드 palworld-i18n 의 en 표기(Paldeck·Breeding·Technology 등 게임
 * 내 영문 용어)를 기준으로 맞췄습니다. 여기에 없는 경로의 /en 은 servedSeoLocale
 * 이 ko 로 접으므로 ko 메타 + /ko canonical 로 남습니다. */
const ENGLISH_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  "/palworld": {
    title: "Palworld Database | YORO.gg",
    description: "Pals, items, skills and breeding combinations in one place."
  },
  "/palworld/pals": {
    title: "Paldeck | Palworld | YORO.gg",
    description: "Check each Pal's elements, stats and work suitability."
  },
  "/palworld/breeding": {
    title: "Breeding Pairs | Palworld | YORO.gg",
    description: "Check breeding results of two parents, or reverse-search parent pairs."
  },
  "/palworld/items": {
    title: "Items | Palworld | YORO.gg",
    description: "Check Palworld item categories, crafting materials and details."
  },
  "/palworld/technology": {
    title: "Technology | Palworld | YORO.gg",
    description: "See which items unlock at each technology level."
  },
  "/palworld/skills": {
    title: "Skills | Palworld | YORO.gg",
    description: "Check active, partner and passive skill effects with the pals that have them."
  },
  "/palworld/map": {
    title: "World Map | Palworld | YORO.gg",
    description: "Explore field bosses, wild spawns and travel points by layer."
  }
};

/** 영어 메타를 내보내는 경로인지. 팰월드 엔티티 상세도 포함합니다. */
function hasEnglishSeoContent(normalizedPath: string): boolean {
  if (ENGLISH_CONTENT[normalizedPath]) return true;
  return palworldEntityRouteForPath(normalizedPath) !== undefined;
}

function contentForPath(
  normalizedPath: string,
  locale: PublicUrlLocale,
  options: { minecraftPatchNotesReady?: boolean } = {}
): PublicSeoContent {
  if (normalizedPath === "/minecraft/patch-notes" && options.minecraftPatchNotesReady) {
    return locale === "ja"
      ? {
          title: "マインクラフト パッチノート | YORO.gg",
          description: "Mojang公式配布メタデータに基づくJava版パッチ履歴を新しい順に確認できます。"
        }
      : {
          title: "마인크래프트 패치 노트 | YORO.gg",
          description: "Mojang 공식 배포 메타데이터 기반 Java Edition 패치 이력을 최신순으로 확인하세요."
        };
  }
  const table = locale === "ja" ? JAPANESE_CONTENT : KOREAN_CONTENT;
  /* en 은 팰월드만 채워져 있어 표를 먼저 보고, 없으면 아래 ko·ja 흐름을 그대로 탑니다.
     (servedSeoLocale 이 en 을 접어 주므로 여기까지 en 으로 오는 경로는 팰월드뿐입니다.) */
  if (locale === "en") {
    const english = ENGLISH_CONTENT[normalizedPath];
    if (english) return english;
  }
  const exact = table[normalizedPath];
  if (exact) return exact;
  if (normalizedPath.startsWith("/lol/summoners/")) {
    return locale === "ja"
      ? {
          title: "LoLサモナー戦績 | YORO.gg",
          description: "League of Legendsサモナーの戦績と最近のゲーム情報を確認できます。"
        }
      : {
          title: "LoL 소환사 전적 | YORO.gg",
          description: "League of Legends 소환사의 전적과 최근 게임 정보를 확인하세요."
        };
  }
  return table["/"] ?? KOREAN_DEFAULT;
}

export function publicSeoMetadataForPath(
  pathname: string,
  options: { minecraftPatchNotesReady?: boolean } = {}
): PublicSeoMetadata {
  const normalizedPath = normalizePublicSeoPath(pathname);
  const locale = servedSeoLocale(normalizedPath, publicUrlLocaleFromPathname(pathname) ?? "ko");
  const content = contentForPath(normalizedPath, locale, options);
  const canonicalUrl = localizedPublicSeoUrl(normalizedPath, locale);
  const structuredData: unknown[] = [websiteStructuredData(locale)];
  const robotsNoindex = PUBLIC_SEO_NOINDEX_PATHS.has(normalizedPath)
    && !(normalizedPath === "/minecraft/patch-notes" && options.minecraftPatchNotesReady);
  if (normalizedPath !== "/") structuredData.push(breadcrumbStructuredData(normalizedPath, locale));
  if (normalizedPath === "/") {
    structuredData.push({ "@context": "https://schema.org", ...(organizationStructuredData() as object) });
  }
  const socialImage = socialImageForPath(normalizedPath, locale);
  return {
    alternateUrls: alternateUrlsForPath(normalizedPath),
    canonicalUrl,
    description: content.description,
    fallback: normalizedPath === "/"
      ? homeFallback(locale)
      : genericFallback(content, normalizedPath, locale),
    imageAlt: localeText(socialImage.alt, locale),
    imageUrl: socialImage.url,
    locale,
    openGraphType: "website",
    ...(robotsNoindex ? { robotsNoindex: true } : {}),
    structuredData,
    title: content.title
  };
}

/** 소환사 프로필 metadata에 hreflang, JSON-LD, fallback 본문을 덧붙입니다. */
export function withLolProfileSeo(
  base: PublicSeoMetadata,
  input: {
    canonicalPath: string;
    description: string;
    facts: readonly PublicSeoFact[];
    heading: string;
    imageAlt: string;
    imageUrl: string;
    title: string;
  }
): PublicSeoMetadata {
  const { locale } = base;
  const ja = locale === "ja";
  return {
    ...base,
    alternateUrls: publicSeoAlternateUrls(input.canonicalPath),
    canonicalUrl: localizedPublicSeoUrl(input.canonicalPath, locale),
    description: input.description,
    fallback: {
      facts: input.facts,
      heading: input.heading,
      summary: input.description,
      links: [
        { href: `/${locale}/lol`, label: ja ? "LoL戦績検索" : "LoL 전적 검색" },
        { href: `/${locale}/lol/aram`, label: ja ? "オーグメントARAM" : "증강 칼바람" },
        { href: `/${locale}/`, label: ja ? "ホーム" : "홈" }
      ]
    },
    imageAlt: input.imageAlt,
    imageUrl: input.imageUrl,
    openGraphType: "profile",
    structuredData: [
      websiteStructuredData(locale),
      breadcrumbStructuredData(input.canonicalPath, locale, input.heading),
      {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        name: input.title,
        description: input.description,
        inLanguage: ja ? "ja-JP" : "ko-KR",
        mainEntity: {
          "@type": "Person",
          name: input.heading
        },
        isPartOf: {
          "@type": "WebSite",
          name: "YORO.gg",
          url: PUBLIC_SEO_ORIGIN
        }
      }
    ],
    title: input.title
  };
}

export function escapeSeoHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** JSON-LD 본문에서 `</script>`와 HTML 구분자가 문서 구조를 깨지 않도록 escape합니다. */
function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll(" ", "\\u2028")
    .replaceAll(" ", "\\u2029");
}

/* 본문 상한. 섹션이 늘어도 HTML 이 무한정 커지지 않게 막는 마지막 가드입니다.
   각 빌더가 이미 항목 수를 자르므로 여기까지 오는 경우는 사실상 없지만, 새 섹션이
   추가될 때 크기 회귀가 조용히 지나가지 않도록 남겨 둡니다. */
const PUBLIC_SEO_FALLBACK_MAX_BYTES = 30_000;

function renderFallbackHtml(fallback: PublicSeoFallback): string {
  const facts = fallback.facts.length === 0
    ? ""
    : `<dl class="seo-fallback-facts">${fallback.facts
        .map((fact) => `<dt>${escapeSeoHtml(fact.label)}</dt><dd>${escapeSeoHtml(fact.value)}</dd>`)
        .join("")}</dl>`;
  const links = fallback.links.length === 0
    ? ""
    : `<nav class="seo-fallback-links"><ul>${fallback.links
        .map((link) => `<li><a href="${escapeSeoHtml(link.href)}">${escapeSeoHtml(link.label)}</a></li>`)
        .join("")}</ul></nav>`;
  const sections = (fallback.sections ?? [])
    .map((section) => {
      const sectionFacts = section.facts?.length
        ? `<dl class="seo-fallback-facts">${section.facts
            .map((fact) => `<dt>${escapeSeoHtml(fact.label)}</dt><dd>${escapeSeoHtml(fact.value)}</dd>`)
            .join("")}</dl>`
        : "";
      const sectionItems = section.items?.length
        ? `<ul>${section.items.map((item) => `<li>${escapeSeoHtml(item)}</li>`).join("")}</ul>`
        : "";
      const sectionLinks = section.links?.length
        ? `<ul>${section.links
            .map((link) => `<li><a href="${escapeSeoHtml(link.href)}">${escapeSeoHtml(link.label)}</a></li>`)
            .join("")}</ul>`
        : "";
      const note = section.note ? `<p>${escapeSeoHtml(section.note)}</p>` : "";
      return `<section><h2>${escapeSeoHtml(section.heading)}</h2>${sectionFacts}${sectionItems}${sectionLinks}${note}</section>`;
    })
    .join("");
  const head = `<div class="seo-fallback" data-seo-fallback="true">`
    + `<h1>${escapeSeoHtml(fallback.heading)}</h1>`
    + `<p>${escapeSeoHtml(fallback.summary)}</p>`
    + facts;
  const tail = links + `</div>`;
  /* 상한을 넘으면 섹션만 버립니다 — 제목·요약·링크는 남아야 빈 페이지가 되지 않습니다. */
  const full = head + sections + tail;
  return Buffer.byteLength(full, "utf8") <= PUBLIC_SEO_FALLBACK_MAX_BYTES ? full : head + tail;
}

function replaceOrInsertHeadTag(html: string, matcher: RegExp, tag: string): string {
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace(/<\/head>/iu, `${tag}</head>`);
}

/** 이전 응답에서 주입한 hreflang·JSON-LD가 남지 않도록 먼저 제거합니다. */
function stripInjectedSeoTags(html: string): string {
  return html
    .replaceAll(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>/giu, "")
    .replaceAll(/<meta\s+name="robots"[^>]*>/giu, "")
    .replaceAll(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/giu, "");
}

export function applyPublicSeoMetadata(html: string, metadata: PublicSeoMetadata): string {
  const replacements: readonly [RegExp, string][] = [
    [/(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/u, metadata.description],
    [/(<link\s+rel="canonical"\s+href=")[^"]*("\s*\/?>)/u, metadata.canonicalUrl],
    [/(<meta\s+property="og:title"\s+content=")[^"]*("\s*\/?>)/u, metadata.title],
    [/(<meta\s+property="og:description"\s+content=")[^"]*("\s*\/?>)/u, metadata.description],
    [/(<meta\s+property="og:url"\s+content=")[^"]*("\s*\/?>)/u, metadata.canonicalUrl],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*("\s*\/?>)/u, metadata.title],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*("\s*\/?>)/u, metadata.description]
  ];
  let nextHtml = stripInjectedSeoTags(html).replace(
    /<title>[^<]*<\/title>/u,
    `<title>${escapeSeoHtml(metadata.title)}</title>`
  );
  nextHtml = nextHtml.replace(/<html\s+lang="[^"]*"/u, `<html lang="${metadata.locale}"`);
  if (metadata.robotsNoindex) {
    nextHtml = nextHtml.replace(/<\/head>/iu, '<meta name="robots" content="noindex" /></head>');
  }
  for (const [pattern, value] of replacements) {
    nextHtml = nextHtml.replace(pattern, (_match, prefix: string, suffix: string) => (
      `${prefix}${escapeSeoHtml(value)}${suffix}`
    ));
  }
  const OPEN_GRAPH_LOCALES: Readonly<Record<PublicUrlLocale, string>> = {
    ko: "ko_KR",
    ja: "ja_JP",
    en: "en_US"
  };
  const openGraphLocale = OPEN_GRAPH_LOCALES[metadata.locale];
  /* og:locale:alternate 는 태그 1개만 치환하므로, 지금 로케일이 아닌 판 중
     대표 하나를 냅니다(ko 페이지는 ja, 그 외는 ko). */
  const alternateLocale = metadata.locale === "ko" ? "ja_JP" : "ko_KR";
  const additionalTags: readonly [RegExp, string][] = [
    [/<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/iu, `<meta property="og:type" content="${metadata.openGraphType}" />`],
    [/<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/iu, '<meta property="og:site_name" content="YORO.gg" />'],
    [/<meta\s+property="og:locale"\s+content="[^"]*"\s*\/?>/iu, `<meta property="og:locale" content="${openGraphLocale}" />`],
    [/<meta\s+property="og:locale:alternate"\s+content="[^"]*"\s*\/?>/iu, `<meta property="og:locale:alternate" content="${alternateLocale}" />`],
    [/<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/iu, `<meta property="og:image" content="${escapeSeoHtml(metadata.imageUrl)}" />`],
    [/<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/iu, `<meta property="og:image:secure_url" content="${escapeSeoHtml(metadata.imageUrl)}" />`],
    [/<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/iu, `<meta property="og:image:alt" content="${escapeSeoHtml(metadata.imageAlt)}" />`],
    [/<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>/iu, '<meta property="og:image:type" content="image/png" />'],
    [/<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/iu, '<meta property="og:image:width" content="1200" />'],
    [/<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/iu, '<meta property="og:image:height" content="630" />'],
    [/<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/iu, '<meta name="twitter:card" content="summary_large_image" />'],
    [/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/iu, `<meta name="twitter:image" content="${escapeSeoHtml(metadata.imageUrl)}" />`],
    [/<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/?>/iu, `<meta name="twitter:image:alt" content="${escapeSeoHtml(metadata.imageAlt)}" />`]
  ];
  for (const [matcher, tag] of additionalTags) nextHtml = replaceOrInsertHeadTag(nextHtml, matcher, tag);

  const alternateUrls = metadata.alternateUrls;
  if (alternateUrls) {
    /* 서로를 상호 참조해야 Google이 언어 대안으로 인정합니다. 경로가 서빙하지 않는
       로케일(영어판이 없는 섹션의 en)은 아예 빠집니다.
       x-default 는 "언어가 맞지 않는 방문자에게 보일 판"이라, 영어판이 있는 경로는
       en 이 그 자리를 맡고 나머지는 서비스 기본인 ko 가 맡습니다. */
    const xDefaultHref = alternateUrls.en ?? alternateUrls.ko;
    const hreflangTags = [
      ...PUBLIC_SEO_LOCALES.flatMap((locale) => {
        const href = alternateUrls[locale];
        return href
          ? [`<link rel="alternate" hreflang="${locale}" href="${escapeSeoHtml(href)}" />`]
          : [];
      }),
      ...(xDefaultHref
        ? [`<link rel="alternate" hreflang="x-default" href="${escapeSeoHtml(xDefaultHref)}" />`]
        : [])
    ].join("");
    nextHtml = nextHtml.replace(/<\/head>/iu, `${hreflangTags}</head>`);
  }

  if (metadata.structuredData.length > 0) {
    const jsonLd = metadata.structuredData
      .map((entry) => (
        `<script type="application/ld+json" nonce="${CSP_NONCE_PLACEHOLDER}">`
        + `${serializeStructuredData(entry)}</script>`
      ))
      .join("");
    nextHtml = nextHtml.replace(/<\/head>/iu, `${jsonLd}</head>`);
  }

  if (metadata.fallback) {
    // React createRoot가 mount하면서 이 내용을 그대로 교체합니다.
    // 사용자에게 보이는 값과 동일한 데이터만 담으므로 cloaking에 해당하지 않습니다.
    nextHtml = nextHtml.replace(
      /<div id="root">\s*<\/div>/u,
      `<div id="root">${renderFallbackHtml(metadata.fallback)}</div>`
    );
  }
  return nextHtml;
}

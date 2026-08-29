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
import type { PatchNote } from "@streamops/shared";
import type { PatchChangeSummary } from "../services/patch-change-summary.js";

export const PUBLIC_SEO_ORIGIN = "https://yoro.gg";
/** 서버가 메타를 내보내는 로케일 전체. 경로별로 실제 붙는 목록은 아래를 씁니다. */
export const PUBLIC_SEO_LOCALES: readonly PublicUrlLocale[] = ["ko", "ja", "en"];

const PUBLIC_SEO_KO_JA: readonly PublicUrlLocale[] = ["ko", "ja"];
const SEO_LANGUAGE_TAGS: Readonly<Record<PublicUrlLocale, string>> = Object.freeze({
  ko: "ko-KR",
  ja: "ja-JP",
  en: "en-US",
});

/**
 * 경로별 hreflang·sitemap 대상 로케일.
 *
 * en 은 영어 본문이 있는 경로에만 붙입니다 — 번역이 없는 경로에
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
    alt: {
      ko: "YORO.gg 마인크래프트 위키 미리보기",
      ja: "YORO.gg マインクラフト Wiki のプレビュー",
      en: "YORO.gg Minecraft Wiki preview"
    }
  },
  {
    prefix: "/valorant",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-valorant.png`,
    alt: { ko: "YORO.gg 발로란트 전적·도감 미리보기", ja: "YORO.gg VALORANT 戦績・データベースのプレビュー" }
  },
  {
    prefix: "/bot",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-bot.png`,
    alt: {
      ko: "YORO Bot Discord 게임 서버 도우미 미리보기",
      ja: "YORO Bot Discordゲームサーバーアシスタントのプレビュー",
      en: "YORO Bot Discord game server assistant preview"
    }
  },
  /* prefix 매칭이므로 /games/reaction 등 하위 미니게임은 자동으로 같은 이미지를
     씁니다(팰월드 선례와 동일). 게임별 이미지가 생기면 더 긴 prefix 를 위에 둡니다. */
  {
    prefix: "/games",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-games.png`,
    /* 미니게임 OG 는 이미지에 한국어 문구가 박혀 있어 ja 경로(/ja/games …)에는
       ja 판을 내립니다 — ja 링크가 한국어 이미지로 보이던 실사례(2026-08-17). */
    urlJa: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-games-ja.png`,
    alt: {
      ko: "YORO.gg 미니게임 미리보기",
      ja: "YORO.gg ミニゲームのプレビュー",
      en: "YORO.gg mini-games preview"
    }
  },
  /* LoL 생태(전적·패치 노트·팔로우·참가)와 홈은 LoL 이미지를 사이트 대표로 겸용합니다. */
  {
    prefix: "/lol",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: {
      ko: "YORO.gg LoL 전적 검색 미리보기",
      ja: "YORO.gg LoL戦績検索のプレビュー",
      en: "YORO.gg LoL stats preview"
    }
  },
  {
    prefix: "/streamers",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: {
      ko: "YORO.gg 스트리머 추천 미리보기",
      ja: "YORO.gg 配信者おすすめのプレビュー",
      en: "YORO.gg streamer recommendations preview"
    }
  },
  {
    prefix: "/patch-notes",
    url: `${PUBLIC_SEO_ORIGIN}/images/yorogg-og-lol.png`,
    alt: {
      ko: "YORO.gg LoL 전적 검색 미리보기",
      ja: "YORO.gg LoL戦績検索のプレビュー",
      en: "YORO.gg LoL patch notes preview",
    }
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

/* 홈 대표 이미지는 로케일별 동적 렌더링(/social/home/<locale>.png)을 씁니다 —
 * 이전 정적 PNG 1장을 ko/ja/en 전부가 공유해 다국어가 전혀 반영되지 않던 문제의
 * 수정점입니다(실측 확인, docs/mockups/yorogg-home-og-redesign-v1.html 승인).
 * 렌더러: apps/server/src/services/home-social-card.ts */
const HOME_SOCIAL_IMAGE_ALT: PublicSeoLocaleText = {
  ko: "YORO.gg — 게임 데이터, 검색 한 번",
  ja: "YORO.gg — ゲームデータ、検索ひとつで",
  en: "YORO.gg — Game data, one search away"
};

function homeSocialImage(locale: PublicUrlLocale): { url: string; alt: PublicSeoLocaleText } {
  const servedLocale = locale === "en" ? "en" : locale === "ja" ? "ja" : "ko";
  return {
    url: `${PUBLIC_SEO_ORIGIN}/social/home/${servedLocale}.png`,
    alt: HOME_SOCIAL_IMAGE_ALT
  };
}

export function socialImageForPath(normalizedPath: string, locale: PublicUrlLocale = "ko"): {
  url: string;
  alt: PublicSeoLocaleText;
} {
  if (normalizedPath === "/") return homeSocialImage(locale);
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

export type PalworldBreedingSeoGender = "male" | "female";

export type PalworldBreedingRoute = {
  childId: string;
  locale: PublicUrlLocale;
  parentAId: string;
  parentBId: string;
  parentAGender?: PalworldBreedingSeoGender;
  parentBGender?: PalworldBreedingSeoGender;
};

export type PatchNotesDetailRoute = {
  locale: "ko" | "ja";
  patchVersion: string;
};

export type PalworldSeoBreedingPair = {
  child: PalworldSeoBreedingPal;
  genderCondition?: {
    parentA: PalworldBreedingSeoGender | "any";
    parentB: PalworldBreedingSeoGender | "any";
  };
  isSpecial: boolean;
  parentA: PalworldSeoBreedingPal;
  parentB: PalworldSeoBreedingPal;
};

type PalworldSeoBreedingPal = {
  id: string;
  nameEn?: string | null;
  nameJa?: string | null;
  nameKo?: string | null;
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

/** 패치 번호를 sitemap·canonical에서 쓰는 URL-safe 경로로 바꿉니다. */
export function patchNotesDetailPath(patchVersion: string): string {
  if (!/^\d{1,3}\.\d{1,3}$/u.test(patchVersion)) {
    throw new TypeError("패치 번호 형식이 올바르지 않습니다.");
  }
  return `/patch-notes/${patchVersion.replace(".", "-")}`;
}

/**
 * `/ko/patch-notes/26-17` 형태만 상세 경로로 인정합니다.
 * 상세 콘텐츠가 없는 en이나 추가 segment, 점 표기 입력은 모두 거부합니다.
 */
export function patchNotesDetailRouteForPath(pathname: string): PatchNotesDetailRoute | undefined {
  const locale = publicUrlLocaleFromPathname(pathname);
  if (locale !== "ko" && locale !== "ja") return undefined;
  const match = /^\/patch-notes\/(\d{1,3}-\d{1,3})$/u.exec(normalizePublicSeoPath(pathname));
  if (!match?.[1]) return undefined;
  return { locale, patchVersion: match[1].replace("-", ".") };
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

function orderedPalworldBreedingPair(pair: PalworldSeoBreedingPair): PalworldSeoBreedingPair {
  if (pair.parentA.id <= pair.parentB.id) return pair;
  return {
    ...pair,
    parentA: pair.parentB,
    parentB: pair.parentA,
    ...(pair.genderCondition === undefined
      ? {}
      : {
          genderCondition: {
            parentA: pair.genderCondition.parentB,
            parentB: pair.genderCondition.parentA
          }
        })
  };
}

/**
 * 부모·자식의 기존 public ID를 그대로 쓰는 교배 조합 canonical 경로입니다.
 * 부모는 순서가 결과에 영향을 주지 않으므로 정렬하고, 성별에 따라 결과가 갈리는
 * 특수 조합만 마지막 segment를 붙여 모든 조합 URL을 충돌 없이 유지합니다.
 */
export function palworldBreedingPath(pair: PalworldSeoBreedingPair): string {
  const ordered = orderedPalworldBreedingPair(pair);
  const segments = [ordered.parentA.id, ordered.parentB.id, ordered.child.id]
    .map((id) => encodeURIComponent(id));
  const condition = ordered.genderCondition;
  if (
    condition
    && condition.parentA !== "any"
    && condition.parentB !== "any"
  ) {
    segments.push(`${condition.parentA}-${condition.parentB}`);
  }
  return `/palworld/breeding/${segments.join("/")}`;
}

/** 조작된 교배 상세 경로를 데이터 조회 전에 엄격한 public ID/성별 형태로 제한합니다. */
export function palworldBreedingRouteForPath(pathname: string): PalworldBreedingRoute | undefined {
  const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
  const normalized = normalizePublicSeoPath(pathname);
  const match = /^\/palworld\/breeding\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(male|female)-(male|female))?$/u.exec(normalized);
  if (!match?.[1] || !match[2] || !match[3]) return undefined;
  let parentAId: string;
  let parentBId: string;
  let childId: string;
  try {
    parentAId = decodeURIComponent(match[1]);
    parentBId = decodeURIComponent(match[2]);
    childId = decodeURIComponent(match[3]);
  } catch {
    return undefined;
  }
  if (![parentAId, parentBId, childId].every((id) => PALWORLD_PUBLIC_ID_PATTERN.test(id))) {
    return undefined;
  }
  const parentAGender = match[4] as PalworldBreedingSeoGender | undefined;
  const parentBGender = match[5] as PalworldBreedingSeoGender | undefined;
  return {
    childId,
    locale,
    parentAId,
    parentBId,
    ...(parentAGender === undefined ? {} : { parentAGender }),
    ...(parentBGender === undefined ? {} : { parentBGender })
  };
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
        inLanguage: SEO_LANGUAGE_TAGS[locale],
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

function palworldBreedingPalName(
  pal: PalworldSeoBreedingPal,
  locale: PublicUrlLocale
): string {
  const localized = locale === "ja" ? pal.nameJa : locale === "en" ? pal.nameEn : pal.nameKo;
  return localized?.trim() || pal.nameEn?.trim() || pal.nameKo?.trim() || pal.id;
}

/** 실제 부모·자식 데이터가 들어간 개별 교배 조합 metadata와 SSR fallback입니다. */
export function palworldBreedingSeoMetadata(
  route: PalworldBreedingRoute,
  pair: PalworldSeoBreedingPair
): PublicSeoMetadata {
  const ordered = orderedPalworldBreedingPair(pair);
  const { locale } = route;
  const parentAName = palworldBreedingPalName(ordered.parentA, locale);
  const parentBName = palworldBreedingPalName(ordered.parentB, locale);
  const childName = palworldBreedingPalName(ordered.child, locale);
  const normalizedPath = palworldBreedingPath(ordered);
  const canonicalUrl = localizedPublicSeoUrl(normalizedPath, locale);
  const title = t(
    locale,
    `${parentAName} + ${parentBName} 교배 결과: ${childName} | YORO.gg`,
    `${parentAName} + ${parentBName} 配合結果: ${childName} | YORO.gg`,
    `${parentAName} + ${parentBName} Breeding Result: ${childName} | YORO.gg`
  );
  const description = t(
    locale,
    `팰월드 교배 조합 ${parentAName} + ${parentBName}의 결과는 ${childName}입니다. 부모 조합과 교배 결과를 YORO.gg에서 확인하세요.`,
    `パルワールドで${parentAName}と${parentBName}を配合すると${childName}が生まれます。親の組み合わせと配合結果をYORO.ggで確認できます。`,
    `Breeding ${parentAName} with ${parentBName} produces ${childName} in Palworld. Check the parent pair and breeding result on YORO.gg.`
  );
  const gender = ordered.genderCondition;
  const genderValue = gender && gender.parentA !== "any" && gender.parentB !== "any"
    ? `${gender.parentA} + ${gender.parentB}`
    : undefined;
  const heading = `${parentAName} + ${parentBName} → ${childName}`;
  return {
    alternateUrls: publicSeoAlternateUrls(normalizedPath),
    canonicalUrl,
    description,
    fallback: {
      facts: [
        { label: t(locale, "부모 A", "親A", "Parent A"), value: parentAName },
        { label: t(locale, "부모 B", "親B", "Parent B"), value: parentBName },
        { label: t(locale, "교배 결과", "配合結果", "Breeding result"), value: childName },
        {
          label: t(locale, "교배 종류", "配合タイプ", "Breeding type"),
          value: ordered.isSpecial
            ? t(locale, "특수 교배", "特殊配合", "Special breeding")
            : t(locale, "일반 교배", "通常配合", "Normal breeding")
        },
        ...(genderValue === undefined
          ? []
          : [{ label: t(locale, "성별 조건", "性別条件", "Gender condition"), value: genderValue }])
      ],
      heading,
      links: [
        {
          href: `/${locale}${palworldEntityPath("pal", ordered.parentA.id)}`,
          label: parentAName
        },
        {
          href: `/${locale}${palworldEntityPath("pal", ordered.parentB.id)}`,
          label: parentBName
        },
        {
          href: `/${locale}${palworldEntityPath("pal", ordered.child.id)}`,
          label: childName
        },
        {
          href: `/${locale}/palworld/breeding`,
          label: t(locale, "교배 계산기", "配合計算機", "Breeding calculator")
        }
      ],
      summary: description
    },
    imageAlt: heading,
    imageUrl: socialImageForPath(normalizedPath, locale).url,
    locale,
    openGraphType: "article",
    structuredData: [
      websiteStructuredData(locale),
      breadcrumbStructuredData(normalizedPath, locale, heading),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        inLanguage: SEO_LANGUAGE_TAGS[locale],
        mainEntityOfPage: canonicalUrl,
        about: {
          "@type": "Thing",
          name: heading
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

function patchChangeDirectionLabel(
  locale: "ko" | "ja",
  direction: "buff" | "nerf" | "adjust"
): string {
  if (locale === "ja") {
    return direction === "buff" ? "強化" : direction === "nerf" ? "弱体化" : "調整";
  }
  return direction === "buff" ? "버프" : direction === "nerf" ? "너프" : "조정";
}

function patchItemChangeLabel(
  locale: "ko" | "ja",
  kind: "price" | "new" | "removed"
): string {
  if (locale === "ja") {
    return kind === "price" ? "価格変更" : kind === "new" ? "追加" : "削除";
  }
  return kind === "price" ? "가격 변경" : kind === "new" ? "추가" : "제거";
}

/** Riot 본문이 아닌 Data Dragon 비교 결과로 패치 상세 metadata와 fallback을 만듭니다. */
export function patchNotesDetailSeoMetadata(
  route: PatchNotesDetailRoute,
  note: PatchNote,
  changes: PatchChangeSummary | undefined
): PublicSeoMetadata {
  const { locale, patchVersion } = route;
  const normalizedPath = patchNotesDetailPath(patchVersion);
  const canonicalUrl = localizedPublicSeoUrl(normalizedPath, locale);
  const title = t(
    locale,
    `LoL 패치 ${patchVersion} 변경사항 | YORO.gg`,
    `LoL パッチ ${patchVersion} 変更点 | YORO.gg`,
    ""
  );
  const championCount = changes?.championChanges.length ?? 0;
  const itemCount = changes?.itemChanges.length ?? 0;
  const description = changes
    ? t(
        locale,
        `챔피언 ${championCount}종 변경 · 아이템 ${itemCount}종 변경 · ${patchVersion} 패치 요약`,
        `チャンピオン${championCount}体変更 · アイテム${itemCount}種変更 · パッチ${patchVersion}まとめ`,
        ""
      )
    : t(
        locale,
        `LoL ${patchVersion} 패치의 공개 데이터 기반 변경 요약과 Riot 공식 패치노트를 확인하세요.`,
        `LoL パッチ${patchVersion}の公開データに基づく変更概要とRiot公式パッチノートを確認できます。`,
        ""
      );
  const buffCount = changes?.championChanges.filter((change) => change.direction === "buff").length ?? 0;
  const nerfCount = changes?.championChanges.filter((change) => change.direction === "nerf").length ?? 0;
  const adjustCount = changes?.championChanges.filter((change) => change.direction === "adjust").length ?? 0;
  const representativeChanges = changes
    ? [
        ...changes.championChanges.map((change) => (
          `${change.name} · ${patchChangeDirectionLabel(locale, change.direction)}`
        )),
        ...changes.itemChanges.map((change) => (
          `${change.name} · ${patchItemChangeLabel(locale, change.kind)}`
        ))
      ].slice(0, 20)
    : [];
  const publishedDate = Number.isFinite(Date.parse(note.publishedAt))
    ? new Date(note.publishedAt).toISOString().slice(0, 10)
    : note.publishedAt;
  const fallbackFacts: PublicSeoFact[] = [
    { label: t(locale, "패치", "パッチ", ""), value: patchVersion },
    { label: t(locale, "공개일", "公開日", ""), value: publishedDate },
    ...(changes
      ? [
          { label: t(locale, "시스템 변경", "システム変更", ""), value: String(changes.systemChanges.length) },
          { label: t(locale, "챔피언 버프", "チャンピオン強化", ""), value: String(buffCount) },
          { label: t(locale, "챔피언 너프", "チャンピオン弱体化", ""), value: String(nerfCount) },
          { label: t(locale, "챔피언 조정", "チャンピオン調整", ""), value: String(adjustCount) },
          { label: t(locale, "아이템 변경", "アイテム変更", ""), value: String(itemCount) }
        ]
      : [])
  ];
  const footer = t(
    locale,
    "정확한 스킬 변경 및 상세 설명은 Riot 공식 패치노트를 확인하세요.",
    "正確なスキル変更と詳細説明はRiot公式パッチノートをご確認ください。",
    ""
  );
  return {
    alternateUrls: {
      ko: localizedPublicSeoUrl(normalizedPath, "ko"),
      ja: localizedPublicSeoUrl(normalizedPath, "ja")
    },
    canonicalUrl,
    description,
    fallback: {
      facts: fallbackFacts,
      heading: title.replace(" | YORO.gg", ""),
      links: [
        { href: `/${locale}/patch-notes`, label: t(locale, "전체 패치 노트", "パッチノート一覧", "") },
        { href: note.url, label: t(locale, "Riot 공식 패치노트 원문 보기", "Riot公式パッチノートを見る", "") }
      ],
      summary: changes
        ? description
        : t(
            locale,
            "이 패치는 유효합니다. 비교 가능한 Data Dragon 변경 요약은 없으며 Riot 원문 링크를 제공합니다.",
            "このパッチは有効です。比較可能なData Dragon変更概要はなく、Riot原文へのリンクを案内します。",
            ""
          ),
      sections: [
        ...(representativeChanges.length > 0
          ? [{
              heading: t(locale, "대표 변경 항목", "主な変更項目", ""),
              items: representativeChanges,
              ...(championCount + itemCount > representativeChanges.length
                ? {
                    note: t(
                      locale,
                      `전체 ${championCount + itemCount}개 중 상위 ${representativeChanges.length}개`,
                      `全${championCount + itemCount}件中${representativeChanges.length}件を表示`,
                      ""
                    )
                  }
                : {})
            }]
          : []),
        {
          heading: t(locale, "상세 안내", "詳細案内", ""),
          links: [{ href: note.url, label: t(locale, "Riot 공식 패치노트", "Riot公式パッチノート", "") }],
          note: footer
        }
      ]
    },
    imageAlt: t(locale, `LoL 패치 ${patchVersion} 변경사항`, `LoL パッチ ${patchVersion} 変更点`, ""),
    imageUrl: socialImageForPath(normalizedPath, locale).url,
    locale,
    openGraphType: "article",
    structuredData: [
      websiteStructuredData(locale),
      breadcrumbStructuredData(normalizedPath, locale, patchVersion),
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        datePublished: note.publishedAt,
        inLanguage: SEO_LANGUAGE_TAGS[locale],
        mainEntityOfPage: canonicalUrl,
        isPartOf: { "@type": "WebSite", name: "YORO.gg", url: PUBLIC_SEO_ORIGIN },
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
    inLanguage: SEO_LANGUAGE_TAGS[locale],
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
  "/lol": { ko: "LoL 전적 검색", ja: "LoL戦績検索", en: "LoL stats" },
  "/lol/aram": { ko: "증강 칼바람", ja: "オーグメントARAM", en: "Augment ARAM" },
  "/patch-notes": { ko: "패치 노트", ja: "パッチノート", en: "Patch notes" },
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
  "/minecraft": { ko: "마인크래프트", ja: "マインクラフト", en: "Minecraft" },
  "/minecraft/recipes": { ko: "조합법", ja: "レシピ", en: "Recipes" },
  "/minecraft/items": { ko: "아이템", ja: "アイテム", en: "Items" },
  "/minecraft/enchants": { ko: "인챈트", ja: "エンチャント", en: "Enchantments" },
  "/minecraft/library": { ko: "자료실", ja: "資料室", en: "Library" },
  "/minecraft/patch-notes": { ko: "패치 노트", ja: "パッチノート", en: "Patch notes" },
  "/bot": { ko: "YORO Bot", ja: "YORO Bot", en: "YORO Bot" },
  "/bot/getting-started": { ko: "사용방법", ja: "使い方", en: "Getting started" },
  "/bot/commands": { ko: "명령어 목록", ja: "コマンド一覧", en: "Commands" },
  "/bot/game-files": { ko: "게임파일", ja: "ゲームファイル", en: "Game files" },
  "/follow": { ko: "팔로우", ja: "フォロー" },
  "/participation": { ko: "시청자 참여", ja: "視聴者参加" },
  /* 미니게임 — 라벨이 있는 경로만 breadcrumb·sibling 링크에 오릅니다. 준비 중인
     게임(registry 의 coming)은 라우트가 없으므로 여기에 넣지 않습니다. */
  "/games": { ko: "미니게임", ja: "ミニゲーム", en: "Mini-games" },
  "/games/reaction": { ko: "반응속도 테스트", ja: "反応速度テスト", en: "Reaction time test" },
  "/streamers": { ko: "스트리머 추천", ja: "配信者おすすめ", en: "Streamer recommendations" },
  "/streamers/new": { ko: "추천 글 쓰기", ja: "おすすめを書く", en: "Write a recommendation" }
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

/* 크롤러가 JS 없이 읽는 본문. 화면(PublicHomePage)이 말하는 것과 같은 것을 말해야
   합니다 — 다르면 렌더 전후가 어긋나 cloaking 으로 읽힙니다. */
function homeFallback(locale: PublicUrlLocale): PublicSeoFallback {
  const ja = locale === "ja";
  return {
    facts: [],
    heading: t(
      locale,
      "YORO.gg — 게임 데이터, 검색 한 번",
      "YORO.gg — ゲームデータ、検索ひとつで",
      "YORO.gg — Game data, one search"
    ),
    summary: t(
      locale,
      "YORO.gg에서 LoL 전적과 최근 경기, 증강 칼바람 정보를 검색하고 팰월드 도감·아이템·스킬·교배 조합을 살펴보세요. 방송 중인 스트리머의 게임을 확인하고 시청자 참여 기능으로 함께 플레이할 기회도 찾을 수 있습니다.",
      "YORO.ggでは、LoLの戦績・最近の試合・オーグメントARAMを検索し、パルワールドの図鑑、アイテム、スキル、配合組み合わせをまとめて確認できます。配信中のストリーマーの試合を見つけ、視聴者参加機能から一緒にプレイする機会も気軽に探せます。",
      "LoL match history, ARAM augments, the Palworld Paldeck and breeding calculator — one search box. Watch live streamers and join their games as a viewer."
    ),
    links: [
      { href: `/${locale}/lol`, label: t(locale, "LoL 전적 검색", "LoL戦績検索", "LoL stats") },
      { href: `/${locale}/lol/aram`, label: t(locale, "증강 칼바람", "オーグメントARAM", "ARAM augments") },
      { href: `/${locale}/patch-notes`, label: t(locale, "패치 노트", "パッチノート", "Patch notes") },
      { href: `/${locale}/palworld`, label: t(locale, "팰월드 데이터베이스", "パルワールドデータベース", "Palworld Database") },
      { href: `/${locale}/palworld/pals`, label: t(locale, "팰 도감", "パル図鑑", "Paldeck") },
      { href: `/${locale}/palworld/breeding`, label: t(locale, "교배 조합", "配合組み合わせ", "Breeding pairs") },
      { href: `/${locale}/bot`, label: "YORO Bot" }
    ]
  };
}

/** 팰 목록 링크 상한 — 교배 페이지 본문의 크롤 경로용. 574종 전량을 넣으면
 *  HTML 이 과하게 커지므로 상한을 두고 전체 개수를 실값으로 적습니다. */
const PALWORLD_BREEDING_LINK_LIMIT = 60;
/** Palworld 허브 본문에 실을 대표 항목 수. 화면의 첫 목록보다 조금 넓게 잡되
 *  30KB HTML 상한 안에서 상세 페이지 크롤 경로를 충분히 제공합니다. */
const PALWORLD_HUB_LIST_LIMIT = 30;

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

type PalworldSeoListEntry = Readonly<{ id: string; name: string }>;

/** 팰 도감 허브 본문 — 도감 번호순 대표 팰과 실제 전체 등록 수. */
export function palworldPalsFallback(
  base: PublicSeoFallback,
  locale: PublicUrlLocale,
  pals: readonly PalworldSeoListEntry[],
  totalPals: number
): PublicSeoFallback {
  if (pals.length === 0) return base;
  const shown = pals.slice(0, PALWORLD_HUB_LIST_LIMIT);
  return {
    ...base,
    facts: [
      ...base.facts,
      {
        label: t(locale, "등록된 팰", "登録パル", "Registered pals"),
        value: t(locale, `${totalPals}종`, `${totalPals}種`, String(totalPals))
      }
    ],
    sections: [{
      heading: t(locale, "대표 팰", "代表パル", "Featured pals"),
      links: shown.map((pal) => ({
        href: `/${locale}${palworldEntityPath("pal", pal.id)}`,
        label: pal.name
      })),
      note: t(locale, `전체 ${totalPals}종의 팰`, `全${totalPals}種のパル`, `${totalPals} pals in total`)
    }]
  };
}

/** 아이템 허브 본문 — 이름순 대표 아이템과 실제 전체 등록 수. */
export function palworldItemsFallback(
  base: PublicSeoFallback,
  locale: PublicUrlLocale,
  items: readonly PalworldSeoListEntry[],
  totalItems: number
): PublicSeoFallback {
  if (items.length === 0) return base;
  const shown = items.slice(0, PALWORLD_HUB_LIST_LIMIT);
  return {
    ...base,
    facts: [
      ...base.facts,
      {
        label: t(locale, "등록된 아이템", "登録アイテム", "Registered items"),
        value: t(locale, `${totalItems}개`, `${totalItems}件`, String(totalItems))
      }
    ],
    sections: [{
      heading: t(locale, "대표 아이템", "代表アイテム", "Featured items"),
      links: shown.map((item) => ({
        href: `/${locale}${palworldEntityPath("item", item.id)}`,
        label: item.name
      })),
      note: t(locale, `전체 ${totalItems}개 아이템`, `全${totalItems}件のアイテム`, `${totalItems} items in total`)
    }]
  };
}

/** 스킬 허브 본문 — 이름순 대표 스킬과 실제 전체 등록 수. */
export function palworldSkillsFallback(
  base: PublicSeoFallback,
  locale: PublicUrlLocale,
  skills: readonly PalworldSeoListEntry[],
  totalSkills: number
): PublicSeoFallback {
  if (skills.length === 0) return base;
  const shown = skills.slice(0, PALWORLD_HUB_LIST_LIMIT);
  return {
    ...base,
    facts: [
      ...base.facts,
      {
        label: t(locale, "등록된 스킬", "登録スキル", "Registered skills"),
        value: t(locale, `${totalSkills}개`, `${totalSkills}件`, String(totalSkills))
      }
    ],
    sections: [{
      heading: t(locale, "대표 스킬", "代表スキル", "Featured skills"),
      links: shown.map((skill) => ({
        href: `/${locale}${palworldEntityPath("skill", skill.id)}`,
        label: skill.name
      })),
      note: t(locale, `전체 ${totalSkills}개 스킬`, `全${totalSkills}件のスキル`, `${totalSkills} skills in total`)
    }]
  };
}

/** 기술 해금 허브 본문 — 기술 레벨순 대표 항목과 실제 전체 등록 수. */
export function palworldTechnologyFallback(
  base: PublicSeoFallback,
  locale: PublicUrlLocale,
  unlocks: readonly { name: string; technologyLevel: number }[],
  totalUnlocks: number
): PublicSeoFallback {
  if (unlocks.length === 0) return base;
  const shown = unlocks.slice(0, PALWORLD_HUB_LIST_LIMIT);
  return {
    ...base,
    facts: [
      ...base.facts,
      {
        label: t(locale, "기술 해금 항목", "テクノロジー解放項目", "Technology unlocks"),
        value: t(locale, `${totalUnlocks}개`, `${totalUnlocks}件`, String(totalUnlocks))
      }
    ],
    sections: [{
      heading: t(locale, "대표 기술 해금", "主なテクノロジー解放", "Featured technology unlocks"),
      facts: shown.map((unlock) => ({
        label: unlock.name,
        value: t(
          locale,
          `레벨 ${unlock.technologyLevel}`,
          `レベル ${unlock.technologyLevel}`,
          `Level ${unlock.technologyLevel}`
        )
      })),
      note: t(
        locale,
        `전체 ${totalUnlocks}개 기술 해금 항목`,
        `全${totalUnlocks}件のテクノロジー解放項目`,
        `${totalUnlocks} technology unlocks in total`
      )
    }]
  };
}

/** Bot 사용방법 화면과 같은 5단계 연결 흐름. */
function botGettingStartedFallback(base: PublicSeoFallback, locale: PublicUrlLocale): PublicSeoFallback {
  return {
    ...base,
    sections: [{
      heading: t(locale, "YORO Bot 5단계 연결 순서", "YORO Bot 5ステップ連携手順", "Connect YORO Bot in five steps"),
      items: [
        t(locale, "YORO Bot 추가 — YORO Bot을 관리할 Discord 서버에 초대합니다.", "YORO Botを追加 — YORO Botを管理するDiscordサーバーへ招待します。", "Add YORO Bot — invite it to the Discord server you want to manage."),
        t(locale, "로그인 및 Organization 연결 — Discord로 로그인하고 관리할 서버를 Organization에 연결합니다.", "ログインとOrganization連携 — Discordでログインし、管理するサーバーをOrganizationへ連携します。", "Sign in and connect an Organization — sign in with Discord and link the server you manage."),
        t(locale, "Palworld REST 연결 — Dashboard에서 게임 서버의 읽기 전용 REST 연결을 확인합니다.", "Palworld REST連携 — Dashboardでゲームサーバーの読み取り専用REST接続を確認します。", "Connect Palworld REST — verify the game server's read-only REST connection in the Dashboard."),
        t(locale, "사용할 명령 활성화 — Discord Bot 제어에서 서버 구성원에게 제공할 명령을 선택합니다.", "利用コマンドを有効化 — Discord Bot制御からサーバーメンバーに提供するコマンドを選択します。", "Enable commands — choose which commands server members can use in Discord Bot controls."),
        t(locale, "Discord에서 사용 시작 — 영어 명령을 입력해 첫 서버 상태를 확인합니다.", "Discordで利用開始 — 英語コマンドを入力して最初のサーバー状態を確認します。", "Start in Discord — enter an English command to check your first server status response.")
      ]
    }]
  };
}

/** 명령어 화면의 user·admin 탭에 실제 표시되는 명령과 설명. */
function botCommandsFallback(base: PublicSeoFallback, locale: PublicUrlLocale): PublicSeoFallback {
  return {
    ...base,
    sections: [
      {
        heading: t(locale, "유저 명령어", "ユーザーコマンド", "User commands"),
        facts: [
          { label: "/yoro status", value: t(locale, "Palworld 서버의 온라인 상태와 핵심 지표를 확인합니다.", "Palworldサーバーのオンライン状態と主要指標を確認します。", "Check a Palworld server's online status and key metrics.") },
          { label: "/yoro player", value: t(locale, "현재 접속자 목록을 보거나 게임 내 닉네임으로 공개 프로필을 검색합니다.", "現在の接続者一覧を確認し、ゲーム内ニックネームから公開プロフィールを検索します。", "View connected players or find a public profile by its exact in-game nickname.") },
          { label: "/yoro guide", value: t(locale, "Palworld 전용 서버의 REST 설정과 YORO 연결 순서를 확인합니다.", "Palworld専用サーバーのREST設定とYORO連携手順を確認します。", "Review REST settings and the YORO connection steps for a Palworld dedicated server.") },
          { label: "/yoro dashboard", value: t(locale, "고정된 YORO Dashboard 주소를 실행자에게만 제공합니다.", "固定されたYORO Dashboardアドレスを実行者だけに提供します。", "Send the fixed YORO Dashboard address only to the person running the command.") },
          { label: "/yoro help", value: t(locale, "현재 Dashboard에서 활성화된 명령만 언어에 맞춰 보여줍니다.", "Dashboardで現在有効なコマンドだけを言語に合わせて表示します。", "Show only the commands currently enabled in the Dashboard, in the selected language.") }
        ]
      },
      {
        heading: t(locale, "관리자 명령어", "管理者コマンド", "Administrator commands"),
        facts: [
          { label: "/yoro setup", value: t(locale, "Discord 서버와 YORO Organization을 연결하는 일회용 설정 흐름을 시작합니다.", "DiscordサーバーとYORO Organizationを連携するワンタイム設定を開始します。", "Start the one-time setup flow that links a Discord server to a YORO Organization.") },
          { label: "/yoro language locale:<auto|ko|ja|en>", value: t(locale, "이 Discord 서버에서 YORO Bot이 전송하는 메시지 언어를 변경합니다.", "このDiscordサーバーでYORO Botが送信するメッセージ言語を変更します。", "Change the language YORO Bot uses for messages in this Discord server.") }
        ]
      }
    ]
  };
}

/** PalWorldSettings.ini 생성·설치 화면과 같은 핵심 안내. */
function botGameFilesFallback(base: PublicSeoFallback, locale: PublicUrlLocale): PublicSeoFallback {
  return {
    ...base,
    sections: [
      {
        heading: t(locale, "전용 서버 설정 만들기", "専用サーバー設定を作成", "Create dedicated server settings"),
        items: [
          t(locale, "필요한 옵션만 조정해 PalWorldSettings.ini 파일을 만드세요. 모든 작업은 이 브라우저 안에서만 처리됩니다.", "必要なオプションだけを調整して PalWorldSettings.ini を作成できます。すべての処理はこのブラウザ内だけで行われます。", "Adjust only the options you need to create PalWorldSettings.ini. All processing stays in this browser."),
          t(locale, "입력값은 YORO 서버로 전송하거나 계정에 저장하지 않습니다.", "入力値をYOROサーバーへ送信したり、アカウントへ保存したりしません。", "Your input is not sent to YORO servers or saved to an account."),
          t(locale, "게임 업데이트의 기본값 변경 영향을 줄이기 위해 변경한 옵션만 생성합니다.", "ゲーム更新によるデフォルト値変更の影響を抑えるため、変更したオプションだけを生成します。", "Only changed options are generated, reducing the effect of default changes in game updates.")
        ]
      },
      {
        heading: t(locale, "파일 적용 위치", "ファイルの配置先", "Where to install the file"),
        items: [
          t(locale, "서버를 한 번 실행해 설정 디렉터리를 만든 뒤 서버를 종료하고 파일을 교체하세요. DefaultPalWorldSettings.ini를 직접 수정해도 적용되지 않습니다.", "サーバーを一度起動して設定ディレクトリを作成し、サーバーを停止してからファイルを置き換えてください。DefaultPalWorldSettings.iniを直接編集しても反映されません。", "Run the server once to create its configuration directory, stop it, then replace the file. Editing DefaultPalWorldSettings.ini directly has no effect."),
          "Windows: steamapps\\common\\PalServer\\Pal\\Saved\\Config\\WindowsServer\\PalWorldSettings.ini",
          "Linux: steamapps/common/PalServer/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini"
        ]
      },
      {
        heading: t(locale, "공개 포트 보안", "公開ポートのセキュリティ", "Public port security"),
        items: [t(locale, "REST API와 RCON은 기본적으로 비활성 상태입니다. 활성화하더라도 인터넷에 직접 노출하지 말고 방화벽, VPN 또는 접근 제어 프록시를 사용하세요.", "REST APIとRCONはデフォルトで無効です。有効にする場合もインターネットへ直接公開せず、ファイアウォール、VPN、またはアクセス制御プロキシを使用してください。", "REST API and RCON are disabled by default. If enabled, do not expose them directly to the internet; use a firewall, VPN, or access-controlled proxy.")]
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

function fallbackForPath(
  content: PublicSeoContent,
  normalizedPath: string,
  locale: PublicUrlLocale
): PublicSeoFallback {
  if (normalizedPath === "/") return homeFallback(locale);
  const base = genericFallback(content, normalizedPath, locale);
  if (normalizedPath === "/bot/getting-started") return botGettingStartedFallback(base, locale);
  if (normalizedPath === "/bot/commands") return botCommandsFallback(base, locale);
  if (normalizedPath === "/bot/game-files") return botGameFilesFallback(base, locale);
  return base;
}

const KOREAN_DEFAULT: PublicSeoContent = {
  /* 공유 카드에서 "YORO.gg" 단독은 무엇을 하는 사이트인지 전달하지 못합니다.
     X 카드는 제목만 크게 보이므로 대표 기능 두 개를 제목에 싣습니다. */
  title: "YORO.gg — LoL 전적 검색·팰월드 데이터베이스",
  description: "YORO.gg에서 League of Legends 전적 검색, 스트리머 방송 상태, 팔로우와 시청자 참여 기능을 확인하세요."
};

const KOREAN_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  /* 루트는 전용 메인 홈입니다. 문구의 단일 원본은 대시보드
     apps/dashboard/src/features/public-home/i18n/home-i18n.ts 의 seoTitle·seoDescription
     이고, 서버가 크롤러에게 먼저 주는 값이라 여기로 복제했습니다. 한쪽만 고치면
     크롤러가 받는 값과 화면이 덮어쓰는 값이 어긋납니다 —
     test/public-home-seo.test.mjs 가 두 파일의 문구를 대조합니다. */
  "/": {
    title: "YORO.gg — 게임 데이터, 검색 한 번",
    description: "YORO.gg에서 LoL 전적과 최근 경기, 증강 칼바람 정보를 검색하고 팰월드 도감·아이템·스킬·교배 조합을 살펴보세요. 방송 중인 스트리머의 게임을 확인하고 시청자 참여 기능으로 함께 플레이할 기회도 찾을 수 있습니다."
  },
  /* 문구의 단일 원본은 대시보드 public-home/i18n/lol-home-i18n.ts 의 seoTitle·seoDescription 입니다.
     서버가 크롤러에게 먼저 주는 값이라 여기로 복제했고, 두 곳이 어긋나면
     test/public-home-seo.test.mjs 가 먼저 깨집니다. */
  "/lol": {
    title: "YORO.gg — LoL 전적, 검색 한 번",
    description: "Riot ID로 League of Legends 소환사의 랭크와 최근 경기, 챔피언 숙련도와 포지션 성향을 확인하세요. 증강 칼바람 도감과 패치 노트를 함께 살펴보고, 방송 중인 LoL 스트리머와 시청자 참여 기회도 찾을 수 있습니다."
  },
  "/lol/aram": {
    title: "증강 칼바람 | YORO.gg",
    description: "League of Legends 증강 칼바람에서 사용할 수 있는 증강을 이름과 설명으로 검색하고 실버·골드·프리즘·레전드 등급별로 필터링하세요. 각 증강의 효과와 아이콘을 확인하고, 검색한 소환사의 최근 경기에서 선택한 증강 기록도 함께 살펴볼 수 있습니다."
  },
  "/patch-notes": {
    title: "LoL 패치 노트 | YORO.gg",
    description: "League of Legends 패치 노트를 최신순으로 시즌별 확인하세요. 패치 번호나 제목으로 목록을 검색하고, 소환사 Riot ID를 입력하면 각 패치 기간에 플레이한 최근 경기와 승률을 함께 볼 수 있습니다. 전체 변경 내용은 연결된 Riot Games 공식 원문에서 확인합니다."
  },
  /* 문구의 단일 원본은 대시보드 public-home/i18n/lol-streamers-i18n.ts 의 seoTitle·seoDescription 입니다.
     서버가 크롤러에게 먼저 주는 값이라 여기로 복제했고, 두 곳이 어긋나면
     test/public-home-seo.test.mjs 가 먼저 깨집니다. */
  "/follow": {
    title: "YORO.gg — 팔로우한 LoL 스트리머",
    description: "Twitch에서 팔로우한 LoL 스트리머의 방송 상태와 전적을 한 화면에서 확인하세요."
  },
  "/participation": {
    title: "시청자 참여 | YORO.gg",
    description: "YORO.gg 스트리머 방송의 시청자 참여 기능을 이용하세요."
  },
  "/bot": {
    title: "YORO Bot | Discord 게임 서버 도우미",
    description: "YORO Bot으로 Palworld 서버 상태, 접속 인원, 버전과 응답 시간을 Discord에서 확인하세요. Organization과 읽기 전용 REST 연결, 공개 명령은 Web Dashboard에서 관리하며 설정과 AdminPassword는 Discord에 노출하지 않습니다."
  },
  "/bot/getting-started": {
    title: "사용방법 | YORO Bot",
    description: "YORO Bot을 Discord에 초대하고 로그인한 뒤 관리할 서버를 Organization에 연결하는 과정을 확인하세요. Web Dashboard에서 Palworld 서버의 읽기 전용 REST 연결을 검증하고, 구성원에게 제공할 명령을 활성화해 첫 서버 상태를 조회할 수 있습니다."
  },
  "/bot/commands": {
    title: "명령어 목록 | YORO Bot",
    description: "YORO Bot의 /yoro status, player, guide, dashboard, help와 관리자용 setup, language 명령을 확인하세요. 공개·비공개 응답 방식, 필요한 권한과 Dashboard 활성화 조건, 접두사 명령 별칭까지 실제 제공 범위에 맞춰 안내합니다."
  },
  "/bot/game-files": {
    title: "Palworld 게임파일 | YORO Bot",
    description: "Palworld 서버에 필요 옵션만 선택해 PalWorldSettings.ini를 브라우저에서 만들고 Windows·Linux 설치 위치를 확인하세요. 입력값은 YORO 서버나 계정에 저장되지 않으며, REST API와 RCON을 직접 노출하지 않는 방화벽·VPN 원칙을 안내합니다."
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
    description: "Palworld의 Pal 도감, 아이템, 액티브·파트너·패시브 스킬과 기술 해금 정보를 한곳에서 확인하세요. 부모 Pal 두 마리의 교배 결과와 원하는 자식의 부모 조합을 검색하고, 필드 보스·야생 스폰·이동 지점이 표시된 월드 지도도 함께 탐색할 수 있습니다."
  },
  "/palworld/pals": {
    title: "Pal 도감 | YORO.gg",
    description: "Palworld Pal 도감에서 각 Pal의 도감 번호와 속성, 희귀도, 체력·공격·방어 능력치와 작업 적성을 확인하세요. 파트너 스킬과 드랍 아이템, 해당 Pal이 태어나는 부모 교배 조합, 부모로 사용했을 때 나오는 자식 조합까지 상세 페이지에서 함께 살펴볼 수 있습니다."
  },
  "/palworld/breeding": {
    title: "교배 조합 | YORO.gg",
    description: "Palworld 교배 계산기에서 부모 Pal 두 마리를 선택해 태어나는 자식을 확인하거나, 원하는 자식 Pal을 기준으로 가능한 부모 조합을 역검색하세요. 일반 교배와 특정 조합에서만 성립하는 특수 교배를 구분하고, 각 조합의 부모·자식 도감 상세 정보로 바로 이동할 수 있습니다."
  },
  "/palworld/items": {
    title: "아이템 | YORO.gg",
    description: "Palworld 아이템을 이름과 분류로 찾고 판매가, 무게, 최대 보유 수량과 기술 해금 레벨을 확인하세요. 각 아이템의 제작 재료와 제작 시설, 획득 방법을 살펴보고 해당 아이템을 드랍하는 Pal의 도감 상세 페이지까지 연결해 필요한 제작·수집 정보를 한곳에서 확인할 수 있습니다."
  },
  "/palworld/technology": {
    title: "Palworld 기술 해금 | YORO.gg",
    description: "Palworld 기술 해금 목록을 레벨별로 살펴보고 각 단계에서 제작할 수 있게 되는 아이템과 건축물을 확인하세요. 기술 이름이나 아이템을 검색해 필요한 해금 레벨을 빠르게 찾고, 제작에 필요한 상세 정보가 제공되는 아이템 데이터베이스와 함께 성장·거점 계획을 정리할 수 있습니다."
  },
  "/palworld/skills": {
    title: "Palworld 스킬 | YORO.gg",
    description: "Palworld의 액티브 스킬, 파트너 스킬과 패시브 스킬을 이름과 종류로 찾아보세요. 속성, 위력, 쿨타임, 패시브 등급과 효과 설명을 확인하고, 각 스킬을 보유한 Pal 목록에서 도감 상세 페이지로 이동해 능력치·작업 적성·교배 조합 등 관련 정보를 함께 살펴볼 수 있습니다."
  },
  "/palworld/map": {
    title: "Palworld 월드 지도 | YORO.gg",
    description: "Palworld 월드 지도에서 필드 보스와 야생 Pal 스폰, 빠른 이동 지점과 수집 위치를 레이어별로 탐색하세요. 필요한 위치 유형만 켜고 끄며 지도를 확대·이동할 수 있고, 표시된 Pal의 이름과 위치 정보를 확인해 도감·교배 데이터와 함께 탐험 및 포획 계획에 활용할 수 있습니다."
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
    description: "Java Edition 마인크래프트 위키에서 아이템 이름이나 영문 ID를 검색하고 제작 조합법, 묶음 수와 내구도, 적용 가능한 인챈트 정보를 확인하세요. 3×3 제작대 재료 배치와 인챈트 최대 레벨·상충 관계를 카탈로그별로 살펴보고 필요한 항목을 빠르게 찾을 수 있습니다."
  },
  "/minecraft/recipes": {
    title: "마인크래프트 조합법 | YORO.gg",
    description: "Java Edition 마인크래프트 조합법을 결과 아이템 이름이나 영문 ID로 검색하고 제작, 제련, 양조, 대장장이와 석재 절단 유형별로 살펴보세요. 3×3 제작대 그리드 재료 배치, 자유 배치 여부와 사용할 수 있는 재료 변형을 확인해 원하는 아이템의 제작 방법을 찾을 수 있습니다."
  },
  "/minecraft/items": {
    title: "마인크래프트 아이템 | YORO.gg",
    description: "Java Edition 마인크래프트 아이템 카탈로그를 이름이나 영문 ID로 검색하세요. 블록·도구·재료 등 각 항목의 이미지와 최대 묶음 수, 내구도 및 적용 가능한 인챈트 수를 확인하고, 조합법 데이터와 함께 필요한 아이템의 식별자와 기본 속성을 빠르게 비교할 수 있습니다."
  },
  "/minecraft/enchants": {
    title: "마인크래프트 인챈트 | YORO.gg",
    description: "Java Edition 마인크래프트 인챈트를 이름으로 검색하고 각 효과의 최대 레벨, 저주·보물 전용 여부와 주민 거래 가능 여부를 확인하세요. 함께 적용할 수 없는 인챈트의 상충 관계와 인챈트 테이블·거래 획득 경로를 살펴보고 장비에 맞는 조합을 정리할 수 있습니다."
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
    description: "YORO.gg 미니게임에서 초록 신호 순간 클릭하는 반응속도 테스트에 도전하세요. 다섯 번 측정한 평균으로 LoL 티어를 확인하고, 최고 기록은 브라우저에 저장할 수 있습니다. Twitch 로그인 후 공개 또는 익명으로 기록을 등록해 리더보드와 공유 페이지에서도 비교할 수 있습니다."
  },
  "/streamers": {
    title: "스트리머 추천 | YORO.gg",
    description: "시청자가 직접 작성한 스트리머 추천 글을 전체·한국·일본 범위와 게임별로 모아 살펴보세요. 채널 링크, 주력 게임과 추천 이유가 담긴 글은 로그인 없이 읽을 수 있고, Twitch로 로그인하면 새로운 스트리머를 추천하거나 기존 글에 댓글과 좋아요를 남길 수 있습니다."
  },
  "/streamers/new": {
    title: "추천 글 쓰기 | YORO.gg",
    description: "채널 주소와 주력 게임을 함께 적어 스트리머를 추천해 보세요."
  },
  "/games/reaction": {
    title: "반응속도 테스트 | YORO.gg",
    description: "화면이 초록색으로 바뀌는 순간 마우스·터치·Space로 반응하는 테스트를 다섯 번 진행하고 평균에 맞는 LoL 티어를 확인하세요. 신호 전 입력은 무효 처리되며, 최고 기록은 브라우저에 저장됩니다. 로그인하면 공개 또는 익명으로 등록해 리더보드와 공유 링크에서 비교할 수 있습니다."
  }
};

const JAPANESE_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  "/": {
    title: "YORO.gg — ゲームデータ、検索ひとつで",
    description: "YORO.ggでは、LoLの戦績・最近の試合・オーグメントARAMを検索し、パルワールドの図鑑、アイテム、スキル、配合組み合わせをまとめて確認できます。配信中のストリーマーの試合を見つけ、視聴者参加機能から一緒にプレイする機会も気軽に探せます。"
  },
  "/lol": {
    title: "YORO.gg — LoL戦績、検索ひとつで",
    description: "Riot IDからLeague of Legendsサモナーのランク、最近の試合、チャンピオン熟練度、ロール傾向を確認できます。オーグメントARAM図鑑とパッチノートもあわせて閲覧し、配信中のLoLストリーマーや視聴者参加の機会を探せます。"
  },
  "/lol/aram": {
    title: "オーグメントARAM | YORO.gg",
    description: "League of LegendsのオーグメントARAMで利用できるオーグメントを名前や説明から検索し、シルバー・ゴールド・プリズム・レジェンドのレアリティ別に絞り込めます。各効果とアイコンを確認し、検索したサモナーが最近の試合で選んだオーグメント記録もあわせて閲覧できます。"
  },
  "/patch-notes": {
    title: "LoLパッチノート | YORO.gg",
    description: "League of Legendsのパッチノートを最新バージョンからシーズン別に確認できます。パッチ番号やタイトルで一覧を検索し、サモナーのRiot IDを入力すると各パッチ期間にプレイした最近の試合と勝率も表示します。変更内容の全文はリンク先のRiot Games公式原文でご確認ください。"
  },
  "/follow": {
    title: "YORO.gg — フォロー中のLoLストリーマー",
    description: "TwitchでフォローしたLoLストリーマーの配信状況と戦績をひとつの画面で確認できます。"
  },
  "/participation": {
    title: "視聴者参加 | YORO.gg",
    description: "YORO.gg配信者の視聴者参加機能を利用できます。"
  },
  "/bot": {
    title: "YORO Bot | Discordゲームサーバーアシスタント",
    description: "YORO Botを使ってPalworld専用サーバーのオンライン状態、接続人数、ゲームバージョン、応答時間をDiscordから確認できます。Organization、読み取り専用REST接続、公開コマンドの有効化はWeb Dashboardで管理し、機密設定やAdminPasswordをDiscordへ公開しません。"
  },
  "/bot/getting-started": {
    title: "使い方 | YORO Bot",
    description: "YORO BotをDiscordサーバーへ招待し、ログイン後に管理対象サーバーをOrganizationへ連携する手順を順番に確認できます。Web DashboardでPalworld専用サーバーの読み取り専用REST接続を検証し、メンバーへ提供するコマンドを有効化して、最初のサーバー状態を取得できます。"
  },
  "/bot/commands": {
    title: "コマンド一覧 | YORO Bot",
    description: "YORO Botの/yoro status、player、guide、dashboard、helpと、管理者向けsetup、languageコマンドをまとめて確認できます。公開・非公開の応答方式、必要な権限、Dashboardでの有効化条件、prefix commandの別名まで、実際の提供範囲に沿って案内します。"
  },
  "/bot/game-files": {
    title: "Palworldゲームファイル | YORO Bot",
    description: "Palworld専用サーバーに必要な項目だけを選び、PalWorldSettings.iniをブラウザ内で作成してWindows・Linuxの配置先を確認できます。入力値はYOROサーバーやアカウントに保存されず、REST APIとRCONを直接公開しないファイアウォール・VPNの安全対策も案内します。"
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
    description: "パルワールドのパル図鑑、アイテム、アクティブ・パートナー・パッシブスキル、テクノロジー解放情報をまとめて確認できます。親パル2体の配合結果や目的の子パルを生む親の組み合わせを検索し、フィールドボス・野生スポーン・移動地点を載せたワールドマップも探索できます。"
  },
  "/palworld/pals": {
    title: "パル図鑑 | YORO.gg",
    description: "パルワールドのパル図鑑で、各パルの図鑑番号、属性、レアリティ、HP・攻撃・防御ステータス、作業適性を確認できます。パートナースキルやドロップアイテム、そのパルが生まれる親の配合組み合わせ、親として使った場合に生まれる子パルまで詳細ページでまとめて閲覧できます。"
  },
  "/palworld/breeding": {
    title: "配合組み合わせ | YORO.gg",
    description: "パルワールド配合計算機で親パル2体を選び、生まれる子パルを確認できます。目的の子パルから可能な親の組み合わせを逆検索し、通常配合と特定の組み合わせだけで成立する特殊配合を区別して閲覧できます。各組み合わせの親・子パル図鑑にもそのまま移動できます。"
  },
  "/palworld/items": {
    title: "アイテム | YORO.gg",
    description: "パルワールドのアイテムを名前やカテゴリーから探し、売却価格、重量、最大スタック数、テクノロジー解放レベルを確認できます。各アイテムの製作素材・製作施設・入手方法を調べ、ドロップするパルの図鑑詳細へ移動して、製作と収集に必要な情報をまとめて閲覧できます。"
  },
  "/palworld/technology": {
    title: "テクノロジー解放 | YORO.gg",
    description: "パルワールドのテクノロジー解放一覧をレベル別に見ながら、各段階で製作可能になるアイテムや建築物を確認できます。テクノロジー名やアイテムを検索して必要な解放レベルをすぐに探し、製作素材などの詳細を掲載するアイテムデータベースとあわせて拠点づくりや成長計画に活用できます。"
  },
  "/palworld/skills": {
    title: "パルワールドスキル | YORO.gg",
    description: "パルワールドのアクティブスキル、パートナースキル、パッシブスキルを名前や種類から検索できます。属性、威力、クールタイム、パッシブランクと効果説明を確認し、各スキルを持つパルの一覧から図鑑詳細へ移動して、ステータス・作業適性・配合組み合わせもあわせて閲覧できます。"
  },
  "/palworld/map": {
    title: "パルワールドワールドマップ | YORO.gg",
    description: "パルワールドのワールドマップで、フィールドボス、野生パルのスポーン、ファストトラベル地点、収集場所をレイヤー別に探索できます。必要な地点の種類だけを表示して地図を拡大・移動し、マーカーに表示されるパル名と位置情報を図鑑・配合データとあわせて冒険や捕獲計画に活用できます。"
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
    description: "Java EditionのマインクラフトWikiで、アイテム名や英語IDを検索し、クラフトレシピ、スタック数、耐久値、適用できるエンチャントを確認できます。3×3作業台の素材配置と、エンチャントの最大レベル・排他関係をカタログ別に調べ、必要な項目をすばやく見つけられます。"
  },
  "/minecraft/recipes": {
    title: "マインクラフト レシピ | YORO.gg",
    description: "Java Editionのマインクラフトレシピを、完成アイテム名や英語IDから検索できます。クラフト、精錬、醸造、鍛冶、石切の種類別に絞り込み、3×3作業台グリッドの素材配置、自由配置の有無、利用できる素材バリエーションを確認して、目的のアイテムの作り方を探せます。"
  },
  "/minecraft/items": {
    title: "マインクラフト アイテム | YORO.gg",
    description: "Java Editionのマインクラフトアイテムカタログを、名前や英語IDから検索できます。ブロック・道具・素材など各項目の画像、最大スタック数、耐久値、適用可能なエンチャント数を確認し、レシピデータとあわせて必要なアイテムの識別子と基本性能をすばやく比較できます。"
  },
  "/minecraft/enchants": {
    title: "マインクラフト エンチャント | YORO.gg",
    description: "Java Editionのマインクラフトエンチャントを名前から検索し、各効果の最大レベル、呪い・宝物限定の区分、村人との取引可否を確認できます。同時に付与できないエンチャントの排他関係と、エンチャントテーブル・取引による入手経路を調べ、装備に合う組み合わせを整理できます。"
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
    description: "YORO.ggのミニゲームで、画面が緑になった瞬間にクリックする反応速度テストへ挑戦できます。5回の測定平均からLoLティアを判定し、自己ベストはこのブラウザに保存できます。Twitchログイン後は公開または匿名で記録を登録し、リーダーボードや共有ページでも比較できます。"
  },
  "/streamers": {
    title: "配信者おすすめ | YORO.gg",
    description: "視聴者が投稿した配信者のおすすめ記事を、すべて・韓国・日本の範囲とゲーム別にまとめて閲覧できます。チャンネルリンク、主なゲーム、おすすめ理由を記載した記事はログインなしで読めます。Twitchでログインすると新しい配信者を推薦し、既存の記事へコメントやいいねを追加できます。"
  },
  "/streamers/new": {
    title: "おすすめを書く | YORO.gg",
    description: "チャンネルURLと主なゲームを添えて配信者をおすすめできます。"
  },
  "/games/reaction": {
    title: "反応速度テスト | YORO.gg",
    description: "画面が緑色に変わった瞬間にマウス・タッチ・Spaceで反応するテストを5回行い、平均記録に対応するLoLティアを確認できます。信号前の入力はそのラウンドが無効になり、自己ベストはブラウザへ保存されます。ログイン後は公開または匿名で記録を登録し、ランキングや共有リンクで比較できます。"
  }
};

/* 영어 메타 — 실제 영어 본문이 있는 경로만.
 *
 * 문구는 각 화면이 실제 제공하는 데이터와 대시보드 i18n의 영문 용어를 기준으로
 * 맞췄습니다. 여기에 없는 경로의 /en은 servedSeoLocale이 ko로 접으므로
 * ko 메타 + /ko canonical로 남습니다. */
const ENGLISH_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  /* 루트 홈은 영어 카피가 실제로 있습니다(home-i18n 의 en). 이게 없으면 /en/ 은
     화면만 영어이고 서버는 lang=ko · canonical=/ko/ 로 말해, 크롤러가 영어 페이지를
     한국어의 중복으로 보고 색인에서 뺍니다. */
  "/": {
    title: "YORO.gg — Game data, one search",
    description: "LoL match history, ARAM augments, the Palworld Paldeck and breeding calculator — one search box. Watch live streamers and join their games as a viewer."
  },
  "/lol": {
    title: "YORO.gg — LoL stats, one search",
    description: "LoL match history, the ARAM augment dex and patch notes in one place. Watch live streamers and join their games as a viewer."
  },
  "/patch-notes": {
    title: "LoL Patch Notes | YORO.gg",
    description: "Browse League of Legends patch notes by season, search by patch number or title, and open the full change list on the original Riot Games page."
  },
  /* /follow 는 noindex 이지만(개인화 화면) 언어는 맞아야 합니다 — 없으면 /en/follow 가
     한국어 메타와 lang=ko 로 렌더됩니다. */
  "/follow": {
    title: "YORO.gg — Followed LoL streamers",
    description: "Live status and match history for the LoL streamers you follow on Twitch, all in one place."
  },
  "/palworld": {
    title: "Palworld Database | YORO.gg",
    description: "Browse the Paldeck, items, skills, technology unlocks, breeding pairs, field bosses, wild spawns, and travel points in one Palworld database."
  },
  "/palworld/pals": {
    title: "Paldeck | Palworld | YORO.gg",
    description: "Browse Paldeck numbers, elements, stats, work suitability, partner skills, drops, and parent or child breeding combinations for each Pal."
  },
  "/palworld/breeding": {
    title: "Breeding Pairs | Palworld | YORO.gg",
    description: "Select two parent Pals to find their child, or reverse-search every available parent pair for a desired child, including special breeding pairs."
  },
  "/palworld/items": {
    title: "Items | Palworld | YORO.gg",
    description: "Search Palworld items by name or category and check sell price, weight, stack size, technology level, crafting materials, facilities, and drop Pals."
  },
  "/palworld/technology": {
    title: "Technology | Palworld | YORO.gg",
    description: "Browse Palworld technology unlocks by level, search for an item or building, and connect each unlock to the item details needed for crafting plans."
  },
  "/palworld/skills": {
    title: "Skills | Palworld | YORO.gg",
    description: "Search active, partner, and passive skills, compare element, power, cooldown, tier, and effects, and find every Pal associated with each skill."
  },
  "/palworld/map": {
    title: "World Map | Palworld | YORO.gg",
    description: "Explore Palworld field bosses, wild Pal spawns, fast-travel points, and collection locations by map layer, with marker names for planning routes."
  },
  "/lol/aram": {
    title: "Augment ARAM | YORO.gg",
    description: "Search Augment ARAM effects by name or description, filter by Silver, Gold, Prismatic, or Legend rarity, and review augments used in recent matches."
  },
  "/bot": {
    title: "YORO Bot | Discord Game Server Assistant",
    description: "Check Palworld server status, players, game version, and latency in Discord while managing Organizations, read-only REST access, and commands in the Dashboard."
  },
  "/bot/getting-started": {
    title: "Getting Started | YORO Bot",
    description: "Follow the setup from inviting YORO Bot and linking a Discord server to an Organization through verifying read-only Palworld REST access and enabling commands."
  },
  "/bot/commands": {
    title: "Commands | YORO Bot",
    description: "Review YORO Bot status, player, guide, dashboard, help, setup, and language commands with response visibility, permissions, aliases, and activation rules."
  },
  "/bot/game-files": {
    title: "Palworld Game Files | YORO Bot",
    description: "Create PalWorldSettings.ini in your browser, check Windows and Linux install paths, and review firewall, VPN, REST API, and RCON security guidance."
  },
  "/minecraft": {
    title: "Minecraft Wiki | YORO.gg",
    description: "Search the Java Edition Minecraft Wiki for item IDs, crafting recipes, stack sizes, durability, enchantments, material grids, and incompatibilities."
  },
  "/minecraft/recipes": {
    title: "Minecraft Recipes | YORO.gg",
    description: "Search Java Edition Minecraft recipes by result or ID, filter crafting and processing types, and inspect shaped grids, shapeless recipes, and material variants."
  },
  "/minecraft/items": {
    title: "Minecraft Items | YORO.gg",
    description: "Search the Java Edition Minecraft item catalog by name or ID and compare item images, maximum stack size, durability, and applicable enchantment counts."
  },
  "/minecraft/enchants": {
    title: "Minecraft Enchantments | YORO.gg",
    description: "Search Java Edition Minecraft enchantments and check maximum levels, curses, treasure status, trade availability, acquisition methods, and incompatible effects."
  },
  "/minecraft/patch-notes": {
    title: "Minecraft Patch Notes | YORO.gg",
    description: "Browse Java Edition Minecraft releases and snapshots in chronological order, filter by release type, and open each version's complete notes on the official source."
  },
  "/games": {
    title: "Mini-games | YORO.gg",
    description: "Try a five-round reaction time test, receive a LoL-style tier from your average, save your personal best, and compare registered public or anonymous scores."
  },
  "/games/reaction": {
    title: "Reaction Time Test | YORO.gg",
    description: "React to the green signal with a mouse, touch, or Space over five rounds, see your average and LoL-style tier, then save or register your best score."
  },
  "/streamers": {
    title: "Streamer Recommendations | YORO.gg",
    description: "Browse viewer-written streamer recommendations by region and game, open channel links and reasons to watch, or sign in with Twitch to post, comment, and like."
  }
};

/** 영어 메타를 내보내는 경로인지. 팰월드 엔티티 상세도 포함합니다. */
function hasEnglishSeoContent(normalizedPath: string): boolean {
  if (ENGLISH_CONTENT[normalizedPath]) return true;
  return palworldEntityRouteForPath(normalizedPath) !== undefined
    || palworldBreedingRouteForPath(normalizedPath) !== undefined;
}

function contentForPath(
  normalizedPath: string,
  locale: PublicUrlLocale,
  options: { minecraftPatchNotesReady?: boolean } = {}
): PublicSeoContent {
  if (normalizedPath === "/minecraft/patch-notes" && options.minecraftPatchNotesReady) {
    if (locale === "ja") {
      return {
        title: "マインクラフト パッチノート | YORO.gg",
        description: "Mojang公式ランチャーの配布メタデータに基づき、Java Editionの正式リリースとスナップショットを新しい順に確認できます。リリース種別で一覧を絞り込み、各バージョンの公開日とYORO.ggが作成したハイライトを読み、変更内容の全文はリンク先の公式パッチノートで確認できます。"
      };
    }
    if (locale === "en") {
      return {
        title: "Minecraft Patch Notes | YORO.gg",
        description: "Browse Java Edition releases and snapshots from Mojang metadata, filter by type, read YORO.gg highlights, and open each version's complete official notes."
      };
    }
    return {
      title: "마인크래프트 패치 노트 | YORO.gg",
      description: "Mojang 공식 런처 메타데이터를 바탕으로 Java Edition 정식 릴리스와 스냅샷 이력을 최신순으로 확인하세요. 유형별로 목록을 필터링하고 각 버전의 공개일과 YORO.gg가 작성한 하이라이트를 읽은 뒤, 전체 변경 내용은 연결된 공식 패치 노트에서 확인할 수 있습니다."
    };
  }
  const table = locale === "ja" ? JAPANESE_CONTENT : KOREAN_CONTENT;
  /* en 은 실제 영어 본문이 있는 경로만 채웁니다. 나머지는 servedSeoLocale 이 ko 로
     접으므로 아래 ko·ja 흐름을 그대로 탑니다. */
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
    fallback: fallbackForPath(content, normalizedPath, locale),
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
    frequentTeammates?: readonly { gameName: string; tagLine: string }[];
    heading: string;
    imageAlt: string;
    imageUrl: string;
    title: string;
  }
): PublicSeoMetadata {
  const { locale } = base;
  const profilePathPrefix = input.canonicalPath.slice(0, input.canonicalPath.lastIndexOf("/"));
  const teammateLinks = (input.frequentTeammates ?? []).slice(0, 5).map((teammate) => ({
    href: `/${locale}${profilePathPrefix}/${encodeURIComponent(`${teammate.gameName}-${teammate.tagLine}`)}`,
    label: `${teammate.gameName}#${teammate.tagLine}`
  }));
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
        { href: `/${locale}/lol`, label: t(locale, "LoL 전적 검색", "LoL戦績検索", "LoL stats") },
        { href: `/${locale}/lol/aram`, label: t(locale, "증강 칼바람", "オーグメントARAM", "ARAM augments") },
        { href: `/${locale}/`, label: t(locale, "홈", "ホーム", "Home") }
      ],
      ...(teammateLinks.length > 0
        ? {
            sections: [{
              heading: t(locale, "함께 플레이한 소환사", "一緒にプレイしたサモナー", "Frequently played with"),
              links: teammateLinks
            }]
          }
        : {})
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
        inLanguage: SEO_LANGUAGE_TAGS[locale],
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

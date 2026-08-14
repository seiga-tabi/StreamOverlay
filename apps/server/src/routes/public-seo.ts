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
  publicUrlLocaleFromPathname,
  stripPublicUrlLocalePrefix,
  type PublicUrlLocale
} from "../routing/public-dashboard-routes.js";

export const PUBLIC_SEO_ORIGIN = "https://yoro.gg";
export const PUBLIC_SEO_LOCALES: readonly PublicUrlLocale[] = ["ko", "ja"];

const DEFAULT_SOCIAL_IMAGE = `${PUBLIC_SEO_ORIGIN}/images/yorogg-og.png`;

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
export type PublicSeoFallback = {
  facts: readonly PublicSeoFact[];
  heading: string;
  links: readonly { href: string; label: string }[];
  summary: string;
};

export type PublicSeoMetadata = {
  /** hreflang 대상. 비지역화 경로는 undefined입니다. */
  alternateUrls?: Readonly<Record<PublicUrlLocale, string>>;
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

/** palworld-data service의 detail 응답에서 SEO에 쓰는 필드만 구조적으로 받습니다. */
export type PalworldSeoEntity = {
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

function alternateUrlsForPath(normalizedPath: string): Readonly<Record<PublicUrlLocale, string>> | undefined {
  if (!isLocalizablePublicDashboardRoute(normalizedPath)) return undefined;
  return {
    ko: localizedPublicSeoUrl(normalizedPath, "ko"),
    ja: localizedPublicSeoUrl(normalizedPath, "ja")
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
  const localized = locale === "ja" ? entity.nameJa : entity.nameKo;
  return localized?.trim() || entity.nameEn?.trim() || entity.id;
}

function palworldEntityDescription(
  entity: PalworldSeoEntity,
  kind: PalworldEntityKind,
  locale: PublicUrlLocale
): string {
  const name = palworldEntityName(entity, locale);
  const detail = (locale === "ja" ? entity.descriptionJa : entity.descriptionKo)?.trim();
  if (detail) return detail.slice(0, 160);
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
  if (locale === "ja") {
    if (kind === "pal") return `${label} ステータス・配合 | パルワールド | YORO.gg`;
    if (kind === "item") return `${label} 製作素材・入手方法 | パルワールド | YORO.gg`;
    return `${label} スキル効果 | パルワールド | YORO.gg`;
  }
  if (kind === "pal") return `${label} 능력치·교배 | 팰월드 | YORO.gg`;
  if (kind === "item") return `${label} 제작 재료·획득처 | 팰월드 | YORO.gg`;
  return `${label} 스킬 효과 | 팰월드 | YORO.gg`;
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
    facts.push({ label: ja ? "図鑑番号" : "도감 번호", value: `No.${entity.number}` });
  }
  if (entity.elements?.length) {
    facts.push({ label: ja ? "属性" : "속성", value: entity.elements.join(", ") });
  }
  if (typeof entity.rarity === "number") {
    facts.push({ label: ja ? "レア度" : "희귀도", value: String(entity.rarity) });
  }
  if (entity.type) {
    facts.push({ label: ja ? "種別" : "종류", value: entity.type });
  }
  if (entity.nameEn) {
    facts.push({ label: ja ? "英語名" : "영문 이름", value: entity.nameEn });
  }
  const listPath = PALWORLD_ENTITY_LIST_PATH[kind];
  const links = [
    {
      href: `/${locale}${listPath}`,
      label: ja
        ? (kind === "pal" ? "パル図鑑を見る" : kind === "item" ? "アイテム一覧を見る" : "スキル一覧を見る")
        : (kind === "pal" ? "팰 도감 보기" : kind === "item" ? "아이템 목록 보기" : "스킬 목록 보기")
    },
    ...(kind === "pal"
      ? [{
          href: `/${locale}/palworld/breeding`,
          label: ja ? "配合の組み合わせを見る" : "교배 조합 보기"
        }]
      : []),
    { href: `/${locale}/palworld`, label: ja ? "パルワールドデータベース" : "팰월드 데이터베이스" }
  ];
  return {
    facts,
    heading: name,
    links,
    summary: palworldEntityDescription(entity, kind, locale)
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
    alternateUrls: {
      ko: localizedPublicSeoUrl(normalizedPath, "ko"),
      ja: localizedPublicSeoUrl(normalizedPath, "ja")
    },
    canonicalUrl,
    description,
    fallback: palworldEntityFallback(entity, kind, locale),
    imageAlt: name,
    imageUrl: DEFAULT_SOCIAL_IMAGE,
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

const BREADCRUMB_SEGMENT_LABELS: Readonly<Record<string, Readonly<Record<PublicUrlLocale, string>>>> = {
  "/lol": { ko: "LoL 전적 검색", ja: "LoL戦績検索" },
  "/lol/aram": { ko: "증강 칼바람", ja: "オーグメントARAM" },
  "/patch-notes": { ko: "패치 노트", ja: "パッチノート" },
  /* "/lol/summoners"(목록)는 실제 라우트가 없어 404입니다 — 여기 두면
     genericFallback의 sibling 링크와 breadcrumb JSON-LD가 404 URL을
     크롤러에게 제공합니다. 라벨이 없으면 두 곳 모두에서 자동으로 빠지고,
     소환사 상세 breadcrumb은 "홈 > LoL 전적 검색 > 소환사명"으로 이어집니다. */
  "/palworld": { ko: "팰월드", ja: "パルワールド" },
  "/palworld/pals": { ko: "팰 도감", ja: "パル図鑑" },
  "/palworld/items": { ko: "아이템", ja: "アイテム" },
  "/palworld/skills": { ko: "스킬", ja: "スキル" },
  "/palworld/breeding": { ko: "교배 조합", ja: "配合組み合わせ" },
  "/palworld/technology": { ko: "기술 해금", ja: "テクノロジー解放" },
  "/palworld/map": { ko: "월드 지도", ja: "ワールドマップ" },
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
  "/participation": { ko: "시청자 참여", ja: "視聴者参加" }
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
    const label = BREADCRUMB_SEGMENT_LABELS[cursor]?.[locale]
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
      { href: `/${locale}/palworld`, label: ja ? "パルワールドデータベース" : "팰월드 데이터베이스" },
      { href: `/${locale}/palworld/pals`, label: ja ? "パル図鑑" : "팰 도감" },
      { href: `/${locale}/palworld/breeding`, label: ja ? "配合組み合わせ" : "교배 조합" },
      { href: `/${locale}/bot`, label: "YORO Bot" }
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
    .flatMap(([routePath, labels]) => {
      const label = labels[locale];
      return label ? [{ href: `/${locale}${routePath}`, label }] : [];
    });
  return {
    facts: [],
    heading,
    summary: content.description,
    links: siblings.length > 0
      ? siblings
      : [{ href: `/${locale}/`, label: ja ? "ホーム" : "홈" }]
  };
}

const KOREAN_DEFAULT: PublicSeoContent = {
  title: "YORO.gg",
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
    title: "펠월드 데이터베이스 | YORO.gg",
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
  }
};

const JAPANESE_CONTENT: Readonly<Record<string, PublicSeoContent>> = {
  "/": {
    title: "YORO.gg",
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
  }
};

function contentForPath(normalizedPath: string, locale: PublicUrlLocale): PublicSeoContent {
  const table = locale === "ja" ? JAPANESE_CONTENT : KOREAN_CONTENT;
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

export function publicSeoMetadataForPath(pathname: string): PublicSeoMetadata {
  const locale = publicUrlLocaleFromPathname(pathname) ?? "ko";
  const normalizedPath = normalizePublicSeoPath(pathname);
  const content = contentForPath(normalizedPath, locale);
  const canonicalUrl = localizedPublicSeoUrl(normalizedPath, locale);
  const structuredData: unknown[] = [websiteStructuredData(locale)];
  const robotsNoindex = PUBLIC_SEO_NOINDEX_PATHS.has(normalizedPath);
  if (normalizedPath !== "/") structuredData.push(breadcrumbStructuredData(normalizedPath, locale));
  if (normalizedPath === "/") {
    structuredData.push({ "@context": "https://schema.org", ...(organizationStructuredData() as object) });
  }
  return {
    alternateUrls: alternateUrlsForPath(normalizedPath),
    canonicalUrl,
    description: content.description,
    fallback: normalizedPath === "/"
      ? homeFallback(locale)
      : genericFallback(content, normalizedPath, locale),
    imageAlt: locale === "ja" ? "YORO.gg サービスプレビュー" : "YORO.gg 서비스 미리보기",
    imageUrl: DEFAULT_SOCIAL_IMAGE,
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
    alternateUrls: {
      ko: localizedPublicSeoUrl(input.canonicalPath, "ko"),
      ja: localizedPublicSeoUrl(input.canonicalPath, "ja")
    },
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
  return `<div class="seo-fallback" data-seo-fallback="true">`
    + `<h1>${escapeSeoHtml(fallback.heading)}</h1>`
    + `<p>${escapeSeoHtml(fallback.summary)}</p>`
    + facts
    + links
    + `</div>`;
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
  const openGraphLocale = metadata.locale === "ja" ? "ja_JP" : "ko_KR";
  const alternateLocale = metadata.locale === "ja" ? "ko_KR" : "ja_JP";
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
    // ko, ja, x-default가 서로를 상호 참조해야 Google이 언어 대안으로 인정합니다.
    const hreflangTags = [
      ...PUBLIC_SEO_LOCALES.flatMap((locale) => {
        const href = alternateUrls[locale];
        return href
          ? [`<link rel="alternate" hreflang="${locale}" href="${escapeSeoHtml(href)}" />`]
          : [];
      }),
      `<link rel="alternate" hreflang="x-default" href="${escapeSeoHtml(alternateUrls.ko)}" />`
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

import type { PalworldCondensationStars } from "@streamops/shared";
import {
  localizedPublicUrl,
  localizedPublicUrlForCurrentLocale,
  notifyPublicRouteChange,
  publicLocaleFromPathname,
  stripPublicLocalePrefix,
} from "../../public-lol/utils/public-locale-path";

export const PALWORLD_ROUTE_EVENT = "palworldroutechange";
const PALWORLD_PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;
const PALWORLD_CONDENSATION_STAR_VALUES = new Set(["0", "1", "2", "3", "4"]);
const PALWORLD_SPAWN_PERIOD_VALUES = new Set(["all", "day", "night"]);

export type PalworldPage = "home" | "pals" | "breeding" | "items" | "technology" | "skills" | "map" | "search";
export type PalworldSpawnPeriod = "all" | "day" | "night";
export type PalworldDetailSelection =
  | { type: "pal"; id: string }
  | { type: "item"; id: string }
  | { type: "skill"; id: string };

const PAGE_PATHS: Record<PalworldPage, string> = {
  home: "/palworld",
  pals: "/palworld/pals",
  breeding: "/palworld/breeding",
  items: "/palworld/items",
  technology: "/palworld/technology",
  skills: "/palworld/skills",
  map: "/palworld/map",
  search: "/palworld/search",
};

function normalizePath(pathname: string): string {
  pathname = stripPublicLocalePrefix(pathname);
  if (!pathname) return "/palworld";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPalworldPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/palworld" || path.startsWith("/palworld/");
}

/** 상세 URL segment는 목록 page와 detail 종류를 함께 나타냅니다. */
const ENTITY_PAGE_BY_KIND: Record<PalworldDetailSelection["type"], PalworldPage> = {
  pal: "pals",
  item: "items",
  skill: "skills",
};

const ENTITY_KIND_BY_SEGMENT: Record<string, PalworldDetailSelection["type"]> = {
  pals: "pal",
  items: "item",
  skills: "skill",
};

/**
 * `/palworld/pals/lamball` 형태의 상세 URL을 해석합니다.
 * 상세를 query가 아닌 경로로 표현해야 검색 색인, 공유, 뒤로가기가 모두 동작합니다.
 */
export function palworldDetailFromPath(pathname: string): PalworldDetailSelection | null {
  const match = /^\/palworld\/(pals|items|skills)\/([^/]+)$/u.exec(normalizePath(pathname));
  if (!match?.[1] || !match[2]) return null;
  const type = ENTITY_KIND_BY_SEGMENT[match[1]];
  if (!type) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  return PALWORLD_PUBLIC_ID_PATTERN.test(id) ? { type, id } : null;
}

export function palworldDetailPath(type: PalworldDetailSelection["type"], id: string): string {
  return `${PAGE_PATHS[ENTITY_PAGE_BY_KIND[type]]}/${encodeURIComponent(id)}`;
}

/**
 * 카드의 상세 열기 동작에 실제 href를 주기 위한 locale 경로입니다.
 * anchor로 노출해야 crawler가 목록에서 상세로 내려가고 새 탭 열기도 동작합니다.
 */
export function palworldDetailHref(type: PalworldDetailSelection["type"], id: string): string {
  return localizedPublicUrlForCurrentLocale(palworldDetailPath(type, id));
}

/**
 * 해당 종류의 목록 page에 있는지 확인합니다.
 *
 * 목록 page의 상세는 색인 가능한 고유 경로로 엽니다. 교배·지도·검색 같은 도구 page의
 * 상세는 현재 작업 화면을 유지해야 하므로 경로를 바꾸지 않고 query modal로 엽니다.
 * 도구 page의 상세 URL은 canonical이 도구 page를 가리키므로 중복 색인되지 않습니다.
 */
export function isPalworldEntityListPath(
  pathname: string,
  type: PalworldDetailSelection["type"]
): boolean {
  return normalizePath(pathname) === PAGE_PATHS[ENTITY_PAGE_BY_KIND[type]];
}

/**
 * 목록에서 상세를 열 때 현재 필터를 유지한 상세 경로를 만듭니다.
 * 상세 선택과 Pal 전용 표시 상태는 새 상세 기준으로 다시 정합니다.
 */
export function palworldDetailPathWithListQuery(
  type: PalworldDetailSelection["type"],
  id: string,
  search = typeof window === "undefined" ? "" : window.location.search
): string {
  const params = new URLSearchParams(search);
  for (const key of ["pal", "item", "skill", "stars", "spawnPeriod"]) params.delete(key);
  const query = params.toString();
  return `${palworldDetailPath(type, id)}${query ? `?${query}` : ""}`;
}

/** 수정 key가 눌린 click은 브라우저 기본 동작(새 탭 등)을 그대로 둡니다. */
export function shouldOpenDetailInPlace(event: {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

export function isKnownPalworldPagePath(pathname: string): boolean {
  return Object.values(PAGE_PATHS).includes(normalizePath(pathname))
    || palworldDetailFromPath(pathname) !== null;
}

export function palworldPageFromPath(pathname: string): PalworldPage {
  const path = normalizePath(pathname);
  const entry = (Object.entries(PAGE_PATHS) as Array<[PalworldPage, string]>).find(([, value]) => value === path);
  if (entry) return entry[0];
  // 상세 URL은 목록 page 위에 modal로 열립니다.
  const detail = palworldDetailFromPath(pathname);
  return detail ? ENTITY_PAGE_BY_KIND[detail.type] : "home";
}

export function palworldPathForPage(page: PalworldPage): string {
  return PAGE_PATHS[page];
}

export function palworldUrl(page: PalworldPage, params?: URLSearchParams): string {
  const query = params?.toString();
  return `${palworldPathForPage(page)}${query ? `?${query}` : ""}`;
}

export function palworldFocusPalFromParams(params: URLSearchParams): string | undefined {
  const values = params.getAll("focusPal");
  const value = values.length === 1 ? values[0] : undefined;
  return value !== undefined && PALWORLD_PUBLIC_ID_PATTERN.test(value) ? value : undefined;
}

export function palworldCondensationStarsFromParams(
  params: URLSearchParams
): PalworldCondensationStars {
  const values = params.getAll("stars");
  const value = values.length === 1 ? values[0] : undefined;
  return value !== undefined && PALWORLD_CONDENSATION_STAR_VALUES.has(value)
    ? Number(value) as PalworldCondensationStars
    : 0;
}

export function palworldSpawnPeriodFromParams(
  params: URLSearchParams
): PalworldSpawnPeriod {
  const values = params.getAll("spawnPeriod");
  const value = values.length === 1 ? values[0] : undefined;
  return value !== undefined && PALWORLD_SPAWN_PERIOD_VALUES.has(value)
    ? value as PalworldSpawnPeriod
    : "all";
}

/**
 * 조작된 URL에 상세 query가 여러 개 있으면 Pal → Item → Skill 순으로 하나만 남깁니다.
 * 우선순위를 코드에 고정하고 canonical query를 함께 반환해 Modal 중첩을 방지합니다.
 */
export function palworldDetailSelectionFromParams(params: URLSearchParams): {
  canonicalParams: URLSearchParams;
  changed: boolean;
  selection: PalworldDetailSelection | null;
} {
  const canonicalParams = new URLSearchParams(params);
  const candidates = ([
    ["pal", "pal"],
    ["item", "item"],
    ["skill", "skill"],
  ] as const).flatMap(([key, type]) => {
    const values = params.getAll(key);
    const value = values.length === 1 ? values[0]?.trim() : undefined;
    return value && PALWORLD_PUBLIC_ID_PATTERN.test(value) ? [{ type, id: value }] : [];
  });
  for (const key of ["pal", "item", "skill"]) canonicalParams.delete(key);
  const selection = (candidates[0] as PalworldDetailSelection | undefined) ?? null;
  if (selection) canonicalParams.set(selection.type, selection.id);
  const stars = palworldCondensationStarsFromParams(params);
  const spawnPeriod = palworldSpawnPeriodFromParams(params);
  canonicalParams.delete("stars");
  canonicalParams.delete("spawnPeriod");
  if (selection?.type === "pal") {
    if (stars > 0) canonicalParams.set("stars", String(stars));
    if (spawnPeriod !== "all") canonicalParams.set("spawnPeriod", spawnPeriod);
  }
  return {
    canonicalParams,
    changed: canonicalParams.toString() !== params.toString(),
    selection,
  };
}

/**
 * 상세 선택을 경로에서 먼저 읽고, 없으면 legacy query에서 읽습니다.
 * legacy query URL은 서버가 308로 경로 URL에 흡수하지만 클라이언트 내부 이동과
 * 이전에 공유된 링크를 위해 양쪽을 모두 이해해야 합니다.
 */
export function palworldDetailSelectionFromLocation(
  pathname: string,
  params: URLSearchParams
): {
  canonicalParams: URLSearchParams;
  changed: boolean;
  selection: PalworldDetailSelection | null;
} {
  const pathSelection = palworldDetailFromPath(pathname);
  if (!pathSelection) return palworldDetailSelectionFromParams(params);
  const canonicalParams = new URLSearchParams(params);
  for (const key of ["pal", "item", "skill"]) canonicalParams.delete(key);
  const stars = palworldCondensationStarsFromParams(params);
  const spawnPeriod = palworldSpawnPeriodFromParams(params);
  canonicalParams.delete("stars");
  canonicalParams.delete("spawnPeriod");
  if (pathSelection.type === "pal") {
    if (stars > 0) canonicalParams.set("stars", String(stars));
    if (spawnPeriod !== "all") canonicalParams.set("spawnPeriod", spawnPeriod);
  }
  return {
    canonicalParams,
    changed: canonicalParams.toString() !== params.toString(),
    selection: pathSelection,
  };
}

export function palworldTwitchReturnTo(pathname: string, search = ""): string {
  const locale = publicLocaleFromPathname(pathname);
  const path = normalizePath(pathname);
  if (!Object.values(PAGE_PATHS).includes(path) && palworldDetailFromPath(pathname) === null) {
    return locale ? localizedPublicUrl(PAGE_PATHS.home, locale) : PAGE_PATHS.home;
  }
  const params = new URLSearchParams(search);
  params.delete("viewer_twitch");
  const query = params.toString();
  const returnTo = `${path}${query ? `?${query}` : ""}`;
  return locale ? localizedPublicUrl(returnTo, locale) : returnTo;
}

export function setPalworldUrl(url: string, replace = false): void {
  url = localizedPublicUrlForCurrentLocale(url);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) return;
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
  notifyPublicRouteChange();
}

export function withQueryParam(url: string, key: string, value?: string): string {
  const parsed = new URL(url, window.location.origin);
  if (value?.trim()) parsed.searchParams.set(key, value.trim());
  else parsed.searchParams.delete(key);
  return `${parsed.pathname}${parsed.search}`;
}

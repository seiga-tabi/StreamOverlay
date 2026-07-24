export const PALWORLD_ROUTE_EVENT = "palworldroutechange";
const PALWORLD_PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/u;

export type PalworldPage = "home" | "streamers" | "pals" | "breeding" | "items" | "skills" | "map" | "search";
export type PalworldDetailSelection =
  | { type: "pal"; id: string }
  | { type: "item"; id: string }
  | { type: "skill"; id: string };

const PAGE_PATHS: Record<PalworldPage, string> = {
  home: "/palworld",
  streamers: "/palworld/streamers",
  pals: "/palworld/pals",
  breeding: "/palworld/breeding",
  items: "/palworld/items",
  skills: "/palworld/skills",
  map: "/palworld/map",
  search: "/palworld/search",
};

function normalizePath(pathname: string): string {
  if (!pathname) return "/palworld";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPalworldPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path === "/palworld" || path.startsWith("/palworld/");
}

export function isKnownPalworldPagePath(pathname: string): boolean {
  return Object.values(PAGE_PATHS).includes(normalizePath(pathname));
}

export function palworldPageFromPath(pathname: string): PalworldPage {
  const path = normalizePath(pathname);
  const entry = (Object.entries(PAGE_PATHS) as Array<[PalworldPage, string]>).find(([, value]) => value === path);
  return entry?.[0] ?? "home";
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
  return {
    canonicalParams,
    changed: canonicalParams.toString() !== params.toString(),
    selection,
  };
}

export function palworldTwitchReturnTo(pathname: string, search = ""): string {
  const path = normalizePath(pathname);
  if (!Object.values(PAGE_PATHS).includes(path)) return PAGE_PATHS.home;
  const params = new URLSearchParams(search);
  params.delete("viewer_twitch");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

export function setPalworldUrl(url: string, replace = false): void {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === url) return;
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
  window.dispatchEvent(new CustomEvent(PALWORLD_ROUTE_EVENT));
}

export function withQueryParam(url: string, key: string, value?: string): string {
  const parsed = new URL(url, window.location.origin);
  if (value?.trim()) parsed.searchParams.set(key, value.trim());
  else parsed.searchParams.delete(key);
  return `${parsed.pathname}${parsed.search}`;
}

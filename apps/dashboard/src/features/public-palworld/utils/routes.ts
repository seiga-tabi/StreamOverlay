export const PALWORLD_ROUTE_EVENT = "palworldroutechange";

export type PalworldPage = "home" | "pals" | "breeding" | "items" | "search";

const PAGE_PATHS: Record<PalworldPage, string> = {
  home: "/palworld",
  pals: "/palworld/pals",
  breeding: "/palworld/breeding",
  items: "/palworld/items",
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

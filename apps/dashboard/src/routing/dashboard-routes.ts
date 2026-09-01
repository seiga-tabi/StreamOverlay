export const DASHBOARD_PAGES = [
  "streamerRiotRequests",
  "streamerProfiles",
  "events",
  "supportInbox",
  "settings",
] as const;

export type Page = (typeof DASHBOARD_PAGES)[number];

export const ADMIN_ALLOWED_PAGES: Page[] = [
  "streamerRiotRequests",
  "streamerProfiles",
  "events",
  "supportInbox",
  "settings",
];

const ADMIN_PAGE_PATHS: Partial<Record<Page, string>> = {
  streamerRiotRequests: "/admin/riot-id-requests",
  streamerProfiles: "/admin/streamer-profiles",
  events: "/admin/events",
  supportInbox: "/admin/support",
  settings: "/admin/settings",
};

function normalizedPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function pageAllowed(page: Page): boolean {
  return ADMIN_ALLOWED_PAGES.includes(page);
}

/* 서브 관리자(부분 권한) 세션에서 각 화면을 여는 데 필요한 서버 권한 키입니다.
   값은 서버에 실제로 정의된 키만 씁니다 — apps/server/src/security/auth.ts 의
   ADMIN_PERMISSIONS 와 ADMIN_PERMISSION_API_RULES 에 등록된 권한만 사용합니다.
   빈 배열인 화면의 API 는 어떤 부분 권한으로도 열리지 않고 403 으로
   fail-closed 되므로 full_admin(permissions === undefined)만 사용할 수 있습니다.

   실제 인가는 서버가 강제합니다. 여기는 잠긴 메뉴를 미리 알려주는 표시 전용이며,
   새 AdminPermission 을 서버에 추가할 때 이 표도 함께 갱신해야 합니다. */
export const ADMIN_PAGE_PERMISSIONS: Record<Page, readonly string[]> = {
  streamerRiotRequests: ["streamer_approval"],
  streamerProfiles: ["streamer_profiles:write"],
  events: [],
  supportInbox: [],
  settings: [],
};

export function pagePermitted(page: Page, permissions?: readonly string[]): boolean {
  if (!pageAllowed(page)) return false;
  if (!permissions) return true;
  const required = ADMIN_PAGE_PERMISSIONS[page];
  return required.length > 0 && required.some((permission) => permissions.includes(permission));
}

/* 상단바 2행에 항목 자체를 그릴지 여부. 현재는 pagePermitted 와 판정이 완전히
   같습니다(권한이 필요한 페이지는 권한 보유 여부로, 필요 없는 전체 관리자 전용
   페이지는 서브관리자에게 항상 숨김) — 그래서 pagePermitted 를 그대로 위임해
   두 판정이 조용히 어긋나는 일을 막습니다. 이름을 분리해 둔 이유는 "클릭 가능"과
   "메뉴에 보임"이 향후 달라질 수 있어서입니다(예: 보이지만 클릭하면 안내만 뜨는
   패턴을 나중에 원하면 이 함수만 바꾸면 됩니다). */
export function pageVisible(page: Page, permissions?: readonly string[]): boolean {
  return pagePermitted(page, permissions);
}

export function firstPermittedPage(permissions?: readonly string[]): Page | undefined {
  return ADMIN_ALLOWED_PAGES.find((page) => pagePermitted(page, permissions));
}

export function defaultDashboardPage(): Page {
  return "streamerRiotRequests";
}

export function dashboardPathForPage(page: Page): string {
  return ADMIN_PAGE_PATHS[page]
    ?? ADMIN_PAGE_PATHS[defaultDashboardPage()]
    ?? "/admin/riot-id-requests";
}

export function dashboardPageFromPath(pathname: string): Page {
  const normalized = normalizedPath(pathname);
  const entries = Object.entries(ADMIN_PAGE_PATHS) as Array<[Page, string]>;
  return entries.find(([, path]) => path === normalized)?.[0] ?? defaultDashboardPage();
}

export function setDashboardPath(
  page: Page,
  replace = false
): void {
  const nextPath = dashboardPathForPage(page);
  if (window.location.pathname === nextPath && !window.location.search && !window.location.hash) return;
  if (replace) {
    window.history.replaceState({}, "", nextPath);
    return;
  }
  window.history.pushState({}, "", nextPath);
}

const PUBLIC_DASHBOARD_EXACT_PATHS = new Set([
  "/lol",
  "/lol/",
  "/follow",
  "/follow/",
  "/participation",
  "/participation/",
  "/community",
  "/community/",
  "/privacy",
  "/terms",
  "/contact",
  "/setup/discord",
  "/bot",
  "/bot/",
  "/setup/discord/",
  "/palworld",
  "/palworld/",
  "/palworld/pals",
  "/palworld/pals/",
  "/palworld/breeding",
  "/palworld/breeding/",
  "/palworld/items",
  "/palworld/items/",
  "/palworld/technology",
  "/palworld/technology/",
  "/palworld/skills",
  "/palworld/skills/",
  "/palworld/map",
  "/palworld/map/",
  "/palworld/search",
  "/palworld/search/",
  "/lol/tournaments"
]);

const PUBLIC_DASHBOARD_PATH_PREFIXES = [
  "/lol/summoners/",
  "/lol/tournaments/",
  "/community/server",
  "/community/party",
  "/community/posts/"
];

export function isPublicDashboardAppRoute(pathname: string): boolean {
  if (PUBLIC_DASHBOARD_EXACT_PATHS.has(pathname)) return true;
  return PUBLIC_DASHBOARD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

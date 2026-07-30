export const BOT_MANAGEMENT_ROLES = ["owner", "manager", "viewer"] as const;
export type BotManagementRole = (typeof BOT_MANAGEMENT_ROLES)[number];

export const PALWORLD_SERVER_REGIONS = [
  "asia",
  "north_america",
  "south_america",
  "europe",
  "oceania"
] as const;
export type PalworldServerRegion = (typeof PALWORLD_SERVER_REGIONS)[number];

export type BotManagementOrganization = Readonly<{
  id: string;
  displayName: string;
  role: BotManagementRole;
  discordGuild?: Readonly<{
    id: string;
    displayName: string;
    iconUrl?: string;
  }>;
}>;

export type BotManagementGameServer = Readonly<{
  id: string;
  displayName: string;
  gameType: "palworld";
  region: PalworldServerRegion;
  connectionType: "agent" | "rest";
  connectionStatus: "not_configured" | "pending" | "ready" | "unavailable" | "revoked";
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type CreatePalworldGameServerInput = Readonly<{
  displayName: string;
  region: PalworldServerRegion;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

export function isBotManagementRole(value: unknown): value is BotManagementRole {
  return typeof value === "string"
    && (BOT_MANAGEMENT_ROLES as readonly string[]).includes(value);
}

export function isPalworldServerRegion(value: unknown): value is PalworldServerRegion {
  return typeof value === "string"
    && (PALWORLD_SERVER_REGIONS as readonly string[]).includes(value);
}

export function parseCreatePalworldGameServerInput(
  value: unknown
): CreatePalworldGameServerInput | undefined {
  if (
    !isRecord(value)
    || !hasExactKeys(value, ["displayName", "region"])
    || typeof value.displayName !== "string"
    || !isPalworldServerRegion(value.region)
  ) return undefined;
  const displayName = value.displayName.trim();
  if (
    displayName.length < 1
    || displayName.length > 120
    || /[\u0000-\u001f\u007f]/u.test(displayName)
  ) return undefined;
  return Object.freeze({ displayName, region: value.region });
}

export function isManagementOrganizationId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

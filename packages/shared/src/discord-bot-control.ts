import { isDiscordSnowflake } from "./discord-internal.js";

export const DISCORD_BOT_CONTROL_MODULE_ID = "palworld.status" as const;
export const DISCORD_BOT_CONTROL_MODULE_VERSION = 1 as const;
export const DISCORD_BOT_CONTROL_SCHEMA_VERSION = 1 as const;

export const DISCORD_BOT_CONTROL_COMMANDS = [
  "help",
  "status",
  "guide"
] as const;

export type DiscordBotControlCommand =
  (typeof DISCORD_BOT_CONTROL_COMMANDS)[number];

export type DiscordBotCommandCapabilities = Readonly<
  Record<DiscordBotControlCommand, boolean>
>;

export type DiscordBotControlLocale = "auto" | "ko" | "ja";

export type DiscordBotStatusFields = Readonly<{
  players: boolean;
  version: boolean;
  latency: boolean;
  observedAt: boolean;
}>;

export type DiscordBotControlSettings = Readonly<{
  publicCommandsEnabled: boolean;
  palworldStatusEnabled: boolean;
  statusCommandEnabled: boolean;
  guideCommandEnabled: boolean;
  preferredLocale: DiscordBotControlLocale;
  statusFields: DiscordBotStatusFields;
  revision: number;
}>;

export type DiscordBotControlOverview = Readonly<{
  organizationId: string;
  role: "owner" | "manager" | "viewer";
  globalPrefixCommandsEnabled: boolean;
  installation?: Readonly<{
    guildId: string;
    guildDisplayName: string;
    applicationId: string;
    status: "active";
  }>;
  modules: readonly Readonly<{
    id: typeof DISCORD_BOT_CONTROL_MODULE_ID;
    version: typeof DISCORD_BOT_CONTROL_MODULE_VERSION;
    enabled: boolean;
  }>[];
  settings: DiscordBotControlSettings;
}>;

export type UpdateDiscordBotControlInput = Readonly<{
  publicCommandsEnabled: boolean;
  palworldStatusEnabled: boolean;
  statusCommandEnabled: boolean;
  guideCommandEnabled: boolean;
  preferredLocale: DiscordBotControlLocale;
  statusFields: DiscordBotStatusFields;
  expectedRevision: number;
}>;

export type DiscordBotCommandPolicyRequest = Readonly<{
  applicationId: string;
  guildId: string;
  command: DiscordBotControlCommand;
}>;

export const DISCORD_BOT_COMMAND_POLICY_REASONS = [
  "installation_inactive",
  "module_disabled",
  "command_disabled"
] as const;

export type DiscordBotCommandPolicyResponse = Readonly<{
  allowed: boolean;
  commands: DiscordBotCommandCapabilities;
  preferredLocale: DiscordBotControlLocale;
  statusFields: DiscordBotStatusFields;
  revision: number;
  reason?: (typeof DISCORD_BOT_COMMAND_POLICY_REASONS)[number];
}>;

export const DEFAULT_DISCORD_BOT_STATUS_FIELDS: DiscordBotStatusFields =
  Object.freeze({
    players: true,
    version: true,
    latency: true,
    observedAt: true
  });

export const DEFAULT_DISCORD_BOT_CONTROL_SETTINGS: DiscordBotControlSettings =
  Object.freeze({
    publicCommandsEnabled: true,
    palworldStatusEnabled: true,
    statusCommandEnabled: true,
    guideCommandEnabled: true,
    preferredLocale: "auto",
    statusFields: DEFAULT_DISCORD_BOT_STATUS_FIELDS,
    revision: 0
  });

function exactRecord(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().join(",") === [...keys].sort().join(",")
    ? record
    : undefined;
}

function parseStatusFields(value: unknown): DiscordBotStatusFields | undefined {
  const record = exactRecord(
    value,
    ["players", "version", "latency", "observedAt"]
  );
  if (
    !record
    || typeof record.players !== "boolean"
    || typeof record.version !== "boolean"
    || typeof record.latency !== "boolean"
    || typeof record.observedAt !== "boolean"
  ) return undefined;
  return Object.freeze({
    players: record.players,
    version: record.version,
    latency: record.latency,
    observedAt: record.observedAt
  });
}

function parseCommandCapabilities(
  value: unknown
): DiscordBotCommandCapabilities | undefined {
  const record = exactRecord(value, DISCORD_BOT_CONTROL_COMMANDS);
  if (
    !record
    || typeof record.help !== "boolean"
    || typeof record.status !== "boolean"
    || typeof record.guide !== "boolean"
  ) return undefined;
  return Object.freeze({
    help: record.help,
    status: record.status,
    guide: record.guide
  });
}

export function parseUpdateDiscordBotControlInput(
  value: unknown
): UpdateDiscordBotControlInput | undefined {
  const record = exactRecord(value, [
    "publicCommandsEnabled",
    "palworldStatusEnabled",
    "statusCommandEnabled",
    "guideCommandEnabled",
    "preferredLocale",
    "statusFields",
    "expectedRevision"
  ]);
  const statusFields = record ? parseStatusFields(record.statusFields) : undefined;
  if (
    !record
    || typeof record.publicCommandsEnabled !== "boolean"
    || typeof record.palworldStatusEnabled !== "boolean"
    || typeof record.statusCommandEnabled !== "boolean"
    || typeof record.guideCommandEnabled !== "boolean"
    || !["auto", "ko", "ja"].includes(String(record.preferredLocale))
    || !Number.isSafeInteger(record.expectedRevision)
    || (record.expectedRevision as number) < 0
    || !statusFields
  ) return undefined;
  return Object.freeze({
    publicCommandsEnabled: record.publicCommandsEnabled,
    palworldStatusEnabled: record.palworldStatusEnabled,
    statusCommandEnabled: record.statusCommandEnabled,
    guideCommandEnabled: record.guideCommandEnabled,
    preferredLocale: record.preferredLocale as DiscordBotControlLocale,
    statusFields,
    expectedRevision: record.expectedRevision as number
  });
}

export function parseDiscordBotCommandPolicyRequest(
  value: unknown
): DiscordBotCommandPolicyRequest | undefined {
  const record = exactRecord(value, ["applicationId", "guildId", "command"]);
  if (
    !record
    || !isDiscordSnowflake(record.applicationId)
    || !isDiscordSnowflake(record.guildId)
    || !DISCORD_BOT_CONTROL_COMMANDS.includes(
      record.command as DiscordBotControlCommand
    )
  ) return undefined;
  return Object.freeze({
    applicationId: record.applicationId,
    guildId: record.guildId,
    command: record.command as DiscordBotControlCommand
  });
}

export function parseDiscordBotCommandPolicyResponse(
  value: unknown
): DiscordBotCommandPolicyResponse | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const allowedKeys = [
    "allowed",
    "commands",
    "preferredLocale",
    "statusFields",
    "revision",
    "reason"
  ];
  const statusFields = parseStatusFields(record.statusFields);
  const commands = parseCommandCapabilities(record.commands);
  if (
    Object.keys(record).some((key) => !allowedKeys.includes(key))
    || typeof record.allowed !== "boolean"
    || !commands
    || !["auto", "ko", "ja"].includes(String(record.preferredLocale))
    || !Number.isSafeInteger(record.revision)
    || (record.revision as number) < 0
    || !statusFields
    || (
      record.reason !== undefined
      && !DISCORD_BOT_COMMAND_POLICY_REASONS.includes(
        record.reason as (typeof DISCORD_BOT_COMMAND_POLICY_REASONS)[number]
      )
    )
    || (record.allowed && record.reason !== undefined)
    || (!record.allowed && record.reason === undefined)
  ) return undefined;
  return Object.freeze({
    allowed: record.allowed,
    commands,
    preferredLocale: record.preferredLocale as DiscordBotControlLocale,
    statusFields,
    revision: record.revision as number,
    ...(record.reason === undefined
      ? {}
      : {
          reason: record.reason as
            (typeof DISCORD_BOT_COMMAND_POLICY_REASONS)[number]
        })
  });
}

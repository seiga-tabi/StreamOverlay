import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseYoroRuntimeConfig,
  type YoroRuntimeConfig
} from "@streamops/shared";

const MAX_RUNTIME_CONFIG_BYTES = 64 * 1024;
const MAX_SECRET_BYTES = 4 * 1024;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const YORO_SECRET_FILES = Object.freeze({
  databaseUrl: "/run/secrets/database_url",
  twitchClientSecret: "/run/secrets/twitch_client_secret",
  twitchTokenEncryptionKey: "/run/secrets/twitch_token_encryption_key",
  riotApiKey: "/run/secrets/riot_api_key",
  riotRsoClientSecret: "/run/secrets/riot_rso_client_secret",
  discordClientSecret: "/run/secrets/discord_client_secret",
  discordOAuthEncryptionKey: "/run/secrets/discord_oauth_encryption_key",
  discordBotToken: "/run/secrets/discord_bot_token",
  discordInternalAuthKey: "/run/discord-internal-auth/server_key",
  dashboardAuthToken: "/run/secrets/dashboard_auth_token",
  supportMailboxWebhookSecret: "/run/secrets/support_mailbox_webhook_secret",
  supportMailboxEncryptionKey: "/run/secrets/support_mailbox_encryption_key"
});

export const YORO_LEGAL_CONFIG_FILE = "/etc/yoro/legal.json";

export type YoroLegalConfig = Readonly<{
  operatorName: string;
  contactAddress: string;
  privacyOfficerName: string;
  contactEmail: string;
  contactPhone: string;
  effectiveDate: string;
  minimumAge: number;
  governingLawKo: string;
  governingLawJa: string;
  disputeVenueKo: string;
  disputeVenueJa: string;
  processorsKo: string;
  processorsJa: string;
  crossBorderTransferKo: string;
  crossBorderTransferJa: string;
}>;

const PLACEHOLDER_PATTERNS = [
  "changeme",
  "change-me",
  "change_me",
  "replace-me",
  "your-secret",
  "example-secret",
  "placeholder"
];

function safeRegularFile(filePath: string, maximumBytes: number, privateFile: boolean): fs.Stats {
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error("file_not_regular");
  if (stats.size <= 0 || stats.size > maximumBytes) throw new Error("file_size_invalid");
  if ((stats.mode & 0o022) !== 0) throw new Error("file_writable_by_others");
  if (privateFile && (stats.mode & 0o077) !== 0) throw new Error("secret_permissions_invalid");
  return stats;
}

function removeTrailingNewline(value: string): string {
  return value.replace(/(?:\r\n|\n|\r)$/u, "");
}

export function loadYoroRuntimeConfig(filePath: string): YoroRuntimeConfig {
  const resolved = path.resolve(filePath);
  try {
    safeRegularFile(resolved, MAX_RUNTIME_CONFIG_BYTES, false);
    const raw = fs.readFileSync(resolved, "utf8");
    return parseYoroRuntimeConfig(JSON.parse(raw) as unknown);
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    throw new Error(`runtime_config_load_failed:${code}`);
  }
}

export function loadYoroLegalConfig(
  filePath = YORO_LEGAL_CONFIG_FILE
): YoroLegalConfig {
  try {
    safeRegularFile(filePath, MAX_RUNTIME_CONFIG_BYTES, false);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    const keys: Array<keyof YoroLegalConfig> = [
      "operatorName",
      "contactAddress",
      "privacyOfficerName",
      "contactEmail",
      "contactPhone",
      "effectiveDate",
      "minimumAge",
      "governingLawKo",
      "governingLawJa",
      "disputeVenueKo",
      "disputeVenueJa",
      "processorsKo",
      "processorsJa",
      "crossBorderTransferKo",
      "crossBorderTransferJa"
    ];
    if (
      !parsed
      || typeof parsed !== "object"
      || Array.isArray(parsed)
      || Object.keys(parsed).some((key) => !keys.includes(key as keyof YoroLegalConfig))
      || keys.some((key) => parsed[key] === undefined)
    ) throw new Error("legal_schema_invalid");
    for (const key of keys) {
      const value = parsed[key];
      if (key === "minimumAge") {
        if (!Number.isSafeInteger(value) || typeof value !== "number") {
          throw new Error("legal_schema_invalid");
        }
      } else if (typeof value !== "string" || /[\u0000-\u001f\u007f]/u.test(value)) {
        throw new Error("legal_schema_invalid");
      }
    }
    return Object.freeze(parsed as YoroLegalConfig);
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    throw new Error(`legal_config_load_failed:${code}`);
  }
}

export function loadFixedSecret(
  filePath: string,
  options: Readonly<{ required?: boolean }> = {}
): string {
  try {
    if (!fs.existsSync(filePath)) {
      if (options.required) throw new Error("secret_missing");
      return "";
    }
    safeRegularFile(filePath, MAX_SECRET_BYTES, true);
    const value = removeTrailingNewline(fs.readFileSync(filePath, "utf8"));
    if (
      !value
      || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
      || PLACEHOLDER_PATTERNS.some((pattern) => value.toLowerCase().includes(pattern))
    ) {
      throw new Error("secret_invalid");
    }
    return value;
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    throw new Error(`secret_file_load_failed:${path.basename(filePath)}:${code}`);
  }
}

export function loadConfiguredRuntime(
  environment: NodeJS.ProcessEnv = process.env
): YoroRuntimeConfig | undefined {
  const filePath = environment.YORO_CONFIG_FILE?.trim();
  if (!filePath) return undefined;
  return loadYoroRuntimeConfig(
    path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_ROOT, filePath)
  );
}

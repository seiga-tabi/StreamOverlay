import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseYoroRuntimeConfig,
  type YoroRuntimeConfig
} from "@streamops/shared";

const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_SECRET_BYTES = 4 * 1024;
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PLACEHOLDER_PATTERNS = [
  "changeme",
  "change-me",
  "change_me",
  "replace-me",
  "your-secret",
  "example-secret",
  "placeholder"
];

function regularFile(filePath: string, maximum: number, secret: boolean): void {
  const stats = fs.lstatSync(filePath);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0 || stats.size > maximum) {
    throw new Error("file_invalid");
  }
  if ((stats.mode & 0o022) !== 0 || (secret && (stats.mode & 0o077) !== 0)) {
    throw new Error("file_permissions_invalid");
  }
}

export function loadBotRuntimeConfig(
  environment: NodeJS.ProcessEnv
): YoroRuntimeConfig | undefined {
  const configuredPath = environment.YORO_CONFIG_FILE?.trim();
  if (!configuredPath) return undefined;
  try {
    const resolved = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(PROJECT_ROOT, configuredPath);
    regularFile(resolved, MAX_CONFIG_BYTES, false);
    return parseYoroRuntimeConfig(JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown);
  } catch {
    throw new Error("runtime_config_load_failed");
  }
}

export function loadBotSecret(fileName: string, required: boolean): string {
  const filePath = `/run/secrets/${fileName}`;
  try {
    if (!fs.existsSync(filePath)) {
      if (required) throw new Error("missing");
      return "";
    }
    regularFile(filePath, MAX_SECRET_BYTES, true);
    const value = fs.readFileSync(filePath, "utf8").replace(/(?:\r\n|\n|\r)$/u, "");
    if (
      !value
      || /[\u0000-\u001f\u007f]/u.test(value)
      || PLACEHOLDER_PATTERNS.some((pattern) => value.toLowerCase().includes(pattern))
    ) throw new Error("invalid");
    return value;
  } catch {
    throw new Error(`secret_file_load_failed:${fileName}`);
  }
}

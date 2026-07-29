import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseYoroRuntimeConfig,
  type YoroRuntimeConfig
} from "@streamops/shared";
import { safeSecret } from "./safe-files.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function loadAgentRuntimeConfig(
  environment: NodeJS.ProcessEnv
): YoroRuntimeConfig | undefined {
  const filePath = environment.YORO_CONFIG_FILE?.trim();
  if (!filePath) return undefined;
  try {
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_ROOT, filePath);
    const stats = fs.lstatSync(resolved);
    if (
      !stats.isFile()
      || stats.isSymbolicLink()
      || stats.size <= 0
      || stats.size > 64 * 1024
      || (stats.mode & 0o022) !== 0
    ) throw new Error("invalid");
    return parseYoroRuntimeConfig(JSON.parse(fs.readFileSync(resolved, "utf8")) as unknown);
  } catch {
    throw new Error("runtime_config_load_failed");
  }
}

export function fixedAgentSecret(
  name: "yoro_agent_bootstrap_token" | "palworld_admin_password",
  _production: boolean,
  required: boolean
): string | undefined {
  return safeSecret({
    name,
    file: `/run/secrets/${name}`,
    production: true,
    required
  });
}

import fs from "node:fs";
import path from "node:path";
import { loadBotRuntimeConfig, loadBotSecret } from "./runtime-files.js";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function boolEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function intEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function secret(name: string, production: boolean): string {
  const direct = process.env[name];
  const filePath = process.env[`${name}_FILE`];
  if (direct && filePath) throw new Error(`${name}와 ${name}_FILE을 동시에 설정할 수 없습니다.`);
  if (!filePath) {
    if (production && direct) throw new Error(`production에서는 ${name}_FILE을 사용해야 합니다.`);
    return direct ?? "";
  }
  try {
    const resolved = path.resolve(filePath);
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("invalid");
    if (production && (stat.mode & 0o077) !== 0) throw new Error("permission");
    return fs.readFileSync(resolved, "utf8").trim();
  } catch {
    throw new Error(`${name}_FILE을 안전하게 읽을 수 없습니다.`);
  }
}

function safeBaseUrl(value: string, production: boolean, label: string): string {
  try {
    const url = new URL(value);
    if (
      url.username
      || url.password
      || url.search
      || url.hash
      || url.pathname !== "/"
      || !["http:", "https:"].includes(url.protocol)
      || (production && label === "public" && url.protocol !== "https:")
    ) throw new Error("invalid");
    return url.origin;
  } catch {
    throw new Error(`${label === "public" ? "공개" : "내부"} base URL이 올바르지 않습니다.`);
  }
}

function imageReleaseMetadata(): { version: string; gitSha: string; builtAt: string } | undefined {
  const metadataPath = process.env.IMAGE_RELEASE_METADATA_PATH?.trim();
  if (!metadataPath) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    if (
      typeof parsed.version !== "string"
      || typeof parsed.gitSha !== "string"
      || typeof parsed.builtAt !== "string"
    ) return undefined;
    return {
      version: parsed.version,
      gitSha: parsed.gitSha,
      builtAt: parsed.builtAt
    };
  } catch {
    return undefined;
  }
}

const runtimeConfig = loadBotRuntimeConfig(process.env);
const imageBuild = imageReleaseMetadata();
const nodeEnv = runtimeConfig?.environment ?? env("NODE_ENV", "development");
const production = nodeEnv === "production";
const enabled = runtimeConfig?.features.discordBot ?? boolEnv("DISCORD_BOT_ENABLED", false);
const participationAnnounceEnabled = runtimeConfig?.features.discordParticipationAnnounce
  ?? boolEnv("DISCORD_PARTICIPATION_ANNOUNCE_ENABLED", false);
const token = enabled
  ? runtimeConfig
    ? loadBotSecret("discord_bot_token", true)
    : secret("DISCORD_BOT_TOKEN", production)
  : "";
const internalAuthKey = enabled
  ? runtimeConfig
    ? loadBotSecret("discord_internal_auth_key", true)
    : secret("DISCORD_BOT_INTERNAL_AUTH_KEY", production)
  : "";

export const botConfig = Object.freeze({
  nodeEnv,
  production,
  configurationSource: runtimeConfig ? "runtime_file" : "legacy_environment",
  enabled,
  participationAnnounceEnabled,
  token,
  internalAuthKey,
  applicationId: runtimeConfig?.discord?.applicationId ?? env("DISCORD_APPLICATION_ID").trim(),
  prefixCommandsEnabled: runtimeConfig?.discord?.prefixCommandsEnabled
    ?? boolEnv("DISCORD_BOT_PREFIX_COMMANDS_ENABLED", false),
  testGuildId: runtimeConfig ? "" : env("DISCORD_TEST_GUILD_ID").trim(),
  internalBaseUrl: safeBaseUrl(
    runtimeConfig ? "http://server:3000" : env("DISCORD_BOT_INTERNAL_BASE_URL", "http://server:3000"),
    production,
    "internal"
  ),
  publicBaseUrl: safeBaseUrl(
    runtimeConfig?.public.baseUrl ?? env("DISCORD_BOT_PUBLIC_BASE_URL", "http://localhost:3000"),
    production && enabled,
    "public"
  ),
  healthPort: runtimeConfig ? 3_100 : intEnv("DISCORD_BOT_HEALTH_PORT", 3_100),
  requestTimeoutMs: runtimeConfig ? 5_000 : intEnv("DISCORD_BOT_INTERNAL_TIMEOUT_MS", 5_000),
  release: {
    version: env("APP_VERSION", imageBuild?.version ?? "0.1.0-dev"),
    gitSha: env("GIT_SHA", imageBuild?.gitSha ?? "unknown"),
    builtAt: env("BUILD_TIME", imageBuild?.builtAt ?? "unknown")
  }
});

export function validateBotConfig(): string[] {
  const errors: string[] = [];
  if (botConfig.participationAnnounceEnabled && !botConfig.enabled) {
    errors.push("참여 모집 Discord 알림을 사용하려면 Discord Bot을 활성화해야 합니다.");
  }
  if (!botConfig.enabled) return errors;
  if (!/^[0-9]{1,32}$/u.test(botConfig.applicationId)) {
    errors.push("DISCORD_APPLICATION_ID가 올바르지 않습니다.");
  }
  if (botConfig.testGuildId && !/^[0-9]{1,32}$/u.test(botConfig.testGuildId)) {
    errors.push("DISCORD_TEST_GUILD_ID가 올바르지 않습니다.");
  }
  if (botConfig.production && botConfig.testGuildId) {
    errors.push("production에서는 test Guild command를 사용할 수 없습니다.");
  }
  if (botConfig.token.length < 30 || /\s/u.test(botConfig.token)) {
    errors.push("Discord Bot token이 설정되지 않았거나 올바르지 않습니다.");
  }
  if (botConfig.internalAuthKey.length < 32 || /\s/u.test(botConfig.internalAuthKey)) {
    errors.push("Discord Bot 내부 인증 key는 32자 이상의 별도 secret이어야 합니다.");
  }
  if (botConfig.token && botConfig.token === botConfig.internalAuthKey) {
    errors.push("Discord Bot token과 내부 인증 key를 재사용할 수 없습니다.");
  }
  if (botConfig.healthPort < 1024 || botConfig.healthPort > 65_535) {
    errors.push("DISCORD_BOT_HEALTH_PORT는 1024에서 65535 사이여야 합니다.");
  }
  if (botConfig.requestTimeoutMs < 500 || botConfig.requestTimeoutMs > 30_000) {
    errors.push("DISCORD_BOT_INTERNAL_TIMEOUT_MS는 500에서 30000 사이여야 합니다.");
  }
  return errors;
}

export function assertBotConfig(): void {
  const errors = validateBotConfig();
  if (errors.length) throw new Error(errors.join("\n"));
}

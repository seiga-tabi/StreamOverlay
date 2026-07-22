import fs from "node:fs";
import path from "node:path";
import { appConfig } from "../config.js";
import {
  PALWORLD_SERVER_STATUS_CONFIG_FILE,
  PalworldServerStatusConfigError,
  loadPalworldServerStatusFileConfig
} from "../services/palworld-server-status-config.js";
import { validateBotAction } from "@streamops/shared";

type ActionGroup = {
  scope: string;
  actions: unknown[];
  viewerTriggered: boolean;
};

type ConfigSpec = {
  fileName: string;
  viewerTriggered: boolean;
  collectGroups: (fileName: string, parsed: unknown) => ActionGroup[];
};

const failures: string[] = [];
const TEMPLATE_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

const VIEWER_TEMPLATE_SAFE_PATHS: Record<string, ReadonlySet<string>> = {
  "twitch.chat": new Set(["message"]),
  "overlay.banner": new Set(["title", "message"]),
  "overlay.subtitle": new Set(["original", "translated"]),
  "overlay.subtitleBoost": new Set(["title", "message"]),
  "overlay.question": new Set(["userName", "question", "translatedQuestion"]),
  "overlay.mission": new Set(["title"]),
  "overlay.participationStatus": new Set(["message"]),
  "overlay.emergency": new Set(["title", "message"]),
  "queue.question": new Set(["question", "userName", "translatedQuestion"]),
  "log.highlight": new Set(["reason", "userName"]),
  noop: new Set(["note"])
};

function configDirFromArgs(): string {
  const prefix = "--config-dir=";
  const arg = process.argv.find((value) => value.startsWith(prefix));
  const requested = arg ? arg.slice(prefix.length) : process.env.STREAMOPS_CONFIG_DIR;
  return path.resolve(requested || appConfig.paths.config);
}

function fail(scope: string, message: string): void {
  failures.push(`[${scope}] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasTemplate(value: string): boolean {
  TEMPLATE_PATTERN.lastIndex = 0;
  return TEMPLATE_PATTERN.test(value);
}

function collectStringFields(value: unknown, prefix = ""): Array<{ path: string; value: string }> {
  if (typeof value === "string") return [{ path: prefix, value }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectStringFields(item, `${prefix}[${index}]`));
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    return collectStringFields(nested, nextPath);
  });
}

function validateIntegerField(scope: string, record: Record<string, unknown>, fieldName: string): void {
  if (record[fieldName] === undefined) return;
  if (!Number.isInteger(record[fieldName]) || typeof record[fieldName] !== "number" || record[fieldName] < 0) {
    fail(scope, `${fieldName}은 0 이상의 정수여야 합니다.`);
  }
}

function validateDefaultOverlayBanner(scope: string, value: unknown): void {
  if (value === undefined) return;
  if (typeof value === "boolean") return;
  if (!isRecord(value)) {
    fail(scope, "defaultOverlayBanner는 boolean 또는 객체여야 합니다.");
    return;
  }

  const allowedKeys = new Set([
    "enabled",
    "title",
    "subtitle",
    "message",
    "variant",
    "durationMs",
    "mediaUrl",
    "mediaAlt",
    "soundUrl",
    "soundVolume",
    "speechEnabled",
    "speechText",
    "speechLanguage",
    "speechRate",
    "speechPitch",
    "speechVolume"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) fail(scope, `defaultOverlayBanner에 허용되지 않는 필드입니다: ${key}`);
  }
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") fail(scope, "defaultOverlayBanner.enabled는 boolean이어야 합니다.");
  if (value.title !== undefined && typeof value.title !== "string") fail(scope, "defaultOverlayBanner.title은 문자열이어야 합니다.");
  if (value.subtitle !== undefined && typeof value.subtitle !== "string") fail(scope, "defaultOverlayBanner.subtitle은 문자열이어야 합니다.");
  if (value.message !== undefined && typeof value.message !== "string") fail(scope, "defaultOverlayBanner.message는 문자열이어야 합니다.");
  if (value.mediaAlt !== undefined && typeof value.mediaAlt !== "string") fail(scope, "defaultOverlayBanner.mediaAlt는 문자열이어야 합니다.");
  if (value.speechText !== undefined && typeof value.speechText !== "string") fail(scope, "defaultOverlayBanner.speechText는 문자열이어야 합니다.");
  if (value.speechLanguage !== undefined && !["ja-JP", "ko-KR"].includes(String(value.speechLanguage))) {
    fail(scope, "defaultOverlayBanner.speechLanguage 값이 허용 목록에 없습니다.");
  }
  if (value.speechEnabled !== undefined && typeof value.speechEnabled !== "boolean") fail(scope, "defaultOverlayBanner.speechEnabled는 boolean이어야 합니다.");
  if (value.variant !== undefined && !["info", "success", "warning", "danger"].includes(String(value.variant))) {
    fail(scope, "defaultOverlayBanner.variant 값이 허용 목록에 없습니다.");
  }
  validateIntegerField(scope, value, "durationMs");
  validateOverlayAssetUrl(scope, value, "mediaUrl");
  validateOverlayAssetUrl(scope, value, "soundUrl");
  if (value.soundVolume !== undefined && (typeof value.soundVolume !== "number" || value.soundVolume < 0 || value.soundVolume > 1)) {
    fail(scope, "defaultOverlayBanner.soundVolume은 0 이상 1 이하 숫자여야 합니다.");
  }
  for (const field of ["speechRate", "speechPitch"] as const) {
    if (value[field] !== undefined && (typeof value[field] !== "number" || value[field] < 0.5 || value[field] > 1.5)) {
      fail(scope, `defaultOverlayBanner.${field}은 0.5 이상 1.5 이하 숫자여야 합니다.`);
    }
  }
  if (value.speechVolume !== undefined && (typeof value.speechVolume !== "number" || value.speechVolume < 0 || value.speechVolume > 1)) {
    fail(scope, "defaultOverlayBanner.speechVolume은 0 이상 1 이하 숫자여야 합니다.");
  }
  for (const field of ["subtitle", "mediaUrl", "mediaAlt", "soundUrl", "speechText"] as const) {
    if (typeof value[field] === "string" && hasTemplate(value[field])) {
      fail(scope, `defaultOverlayBanner.${field}에는 viewer 템플릿을 사용할 수 없습니다.`);
    }
  }
}

function validateOverlayAssetUrl(scope: string, record: Record<string, unknown>, fieldName: string): void {
  const value = record[fieldName];
  if (value === undefined || value === "") return;
  if (typeof value !== "string") {
    fail(scope, `${fieldName}은 문자열이어야 합니다.`);
    return;
  }
  if (value.startsWith("/alerts/") || value.startsWith("/tts/")) {
    try {
      const decoded = decodeURIComponent(value);
      if (!decoded.includes("..") && !decoded.includes("\\") && !decoded.includes("\0")) return;
    } catch {
      fail(scope, `${fieldName}은 안전한 로컬 asset 경로여야 합니다.`);
      return;
    }
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return;
  } catch {
    // 아래 공통 오류로 처리합니다.
  }
  fail(scope, `${fieldName}은 https URL, /alerts/... 또는 /tts/... 경로여야 합니다.`);
}

function validateAlertOverlayPreset(scope: string, value: unknown): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    fail(scope, "alert overlay preset은 객체여야 합니다.");
    return;
  }

  const allowedKeys = new Set([
    "enabled",
    "title",
    "subtitle",
    "message",
    "variant",
    "durationMs",
    "mediaUrl",
    "mediaAlt",
    "soundUrl",
    "soundVolume",
    "speechEnabled",
    "speechText",
    "speechLanguage",
    "speechRate",
    "speechPitch",
    "speechVolume"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) fail(scope, `허용되지 않는 필드입니다: ${key}`);
  }
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") fail(scope, "enabled는 boolean이어야 합니다.");
  for (const field of ["title", "subtitle", "message", "mediaAlt"] as const) {
    if (value[field] !== undefined && typeof value[field] !== "string") fail(scope, `${field}은 문자열이어야 합니다.`);
  }
  if (value.variant !== undefined && !["info", "success", "warning", "danger"].includes(String(value.variant))) {
    fail(scope, "variant 값이 허용 목록에 없습니다.");
  }
  validateIntegerField(scope, value, "durationMs");
  validateOverlayAssetUrl(scope, value, "mediaUrl");
  validateOverlayAssetUrl(scope, value, "soundUrl");
  if (value.soundVolume !== undefined && (typeof value.soundVolume !== "number" || value.soundVolume < 0 || value.soundVolume > 1)) {
    fail(scope, "soundVolume은 0 이상 1 이하 숫자여야 합니다.");
  }
  if (value.speechEnabled !== undefined && typeof value.speechEnabled !== "boolean") fail(scope, "speechEnabled는 boolean이어야 합니다.");
  if (value.speechText !== undefined && typeof value.speechText !== "string") fail(scope, "speechText는 문자열이어야 합니다.");
  if (value.speechLanguage !== undefined && !["ja-JP", "ko-KR"].includes(String(value.speechLanguage))) {
    fail(scope, "speechLanguage 값이 허용 목록에 없습니다.");
  }
  for (const field of ["speechRate", "speechPitch"] as const) {
    if (value[field] !== undefined && (typeof value[field] !== "number" || value[field] < 0.5 || value[field] > 1.5)) {
      fail(scope, `${field}은 0.5 이상 1.5 이하 숫자여야 합니다.`);
    }
  }
  if (value.speechVolume !== undefined && (typeof value.speechVolume !== "number" || value.speechVolume < 0 || value.speechVolume > 1)) {
    fail(scope, "speechVolume은 0 이상 1 이하 숫자여야 합니다.");
  }
}

function validateAlertOverlayConfig(configDir: string): void {
  const fileName = "alert-overlays.json";
  const filePath = path.join(configDir, fileName);
  if (!fs.existsSync(filePath)) {
    fail(fileName, `config 파일이 없습니다: ${filePath}`);
    return;
  }
  const parsed = readJson(filePath, fileName);
  if (!isRecord(parsed)) {
    fail(fileName, "최상위 JSON은 객체여야 합니다.");
    return;
  }
  const allowedKeys = new Set(["defaults", "follow", "cheer", "subscription", "subscriptionMessage", "raid"]);
  for (const key of Object.keys(parsed)) {
    if (!allowedKeys.has(key)) fail(fileName, `허용되지 않는 alert preset입니다: ${key}`);
    validateAlertOverlayPreset(`${fileName}:${key}`, parsed[key]);
  }
}

function validateLolParticipationConfig(configDir: string): void {
  const fileName = "lol-participation.json";
  const filePath = path.join(configDir, fileName);
  if (!fs.existsSync(filePath)) {
    fail(fileName, `config 파일이 없습니다: ${filePath}`);
    return;
  }
  const parsed = readJson(filePath, fileName);
  if (!isRecord(parsed)) {
    fail(fileName, "최상위 JSON은 객체여야 합니다.");
    return;
  }

  if (parsed.enabled !== undefined && typeof parsed.enabled !== "boolean") fail(fileName, "enabled는 boolean이어야 합니다.");
  if (parsed.showRiotIdPublicly !== undefined && typeof parsed.showRiotIdPublicly !== "boolean") {
    fail(fileName, "showRiotIdPublicly는 boolean이어야 합니다.");
  }
  for (const field of ["profileCacheTtlHours", "matchAnalysisCount", "mainRoleMinConfidence"] as const) {
    validateIntegerField(fileName, parsed, field);
  }
  if (parsed.enabledQueues !== undefined && (!Array.isArray(parsed.enabledQueues) || !parsed.enabledQueues.every((value) => Number.isInteger(value)))) {
    fail(fileName, "enabledQueues는 정수 배열이어야 합니다.");
  }
  if (parsed.championSkinOverrides !== undefined) {
    if (!isRecord(parsed.championSkinOverrides)) {
      fail(fileName, "championSkinOverrides는 객체여야 합니다.");
    } else {
      for (const [key, value] of Object.entries(parsed.championSkinOverrides)) {
        if (!/^[A-Za-z0-9_. -]{1,40}$/.test(key)) fail(fileName, `championSkinOverrides key가 올바르지 않습니다: ${key}`);
        if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1000) {
          fail(fileName, `championSkinOverrides.${key}는 0 이상 1000 이하 정수여야 합니다.`);
        }
      }
    }
  }
  if (parsed.gameMonitor !== undefined) {
    if (!isRecord(parsed.gameMonitor)) {
      fail(fileName, "gameMonitor는 객체여야 합니다.");
    } else {
      if (parsed.gameMonitor.enabled !== undefined && typeof parsed.gameMonitor.enabled !== "boolean") fail(`${fileName}:gameMonitor`, "enabled는 boolean이어야 합니다.");
      if (parsed.gameMonitor.streamerRiotId !== undefined && typeof parsed.gameMonitor.streamerRiotId !== "string") {
        fail(`${fileName}:gameMonitor`, "streamerRiotId는 문자열이어야 합니다.");
      }
      for (const field of ["pollIntervalMs", "gameEndDebounceMs"] as const) {
        validateIntegerField(`${fileName}:gameMonitor`, parsed.gameMonitor, field);
      }
      if (parsed.gameMonitor.autoSelectNextAfterGame !== undefined && typeof parsed.gameMonitor.autoSelectNextAfterGame !== "boolean") {
        fail(`${fileName}:gameMonitor`, "autoSelectNextAfterGame은 boolean이어야 합니다.");
      }
      if (parsed.gameMonitor.announceInChat !== undefined && typeof parsed.gameMonitor.announceInChat !== "boolean") {
        fail(`${fileName}:gameMonitor`, "announceInChat은 boolean이어야 합니다.");
      }
    }
  }
  if (parsed.rateLimit !== undefined) {
    if (!isRecord(parsed.rateLimit)) {
      fail(fileName, "rateLimit은 객체여야 합니다.");
    } else {
      validateIntegerField(`${fileName}:rateLimit`, parsed.rateLimit, "backoffMs");
      validateIntegerField(`${fileName}:rateLimit`, parsed.rateLimit, "maxBackoffMs");
    }
  }
}

function validatePalworldServerStatusConfig(configDir: string): void {
  try {
    loadPalworldServerStatusFileConfig(configDir);
  } catch (error) {
    const code = error instanceof PalworldServerStatusConfigError ? error.code : "config_invalid_file";
    fail(PALWORLD_SERVER_STATUS_CONFIG_FILE, `Palworld 서버 상태 설정 검증에 실패했습니다: ${code}`);
  }
}

function collectArrayConfig(fileName: string, parsed: unknown, viewerTriggered: boolean): ActionGroup[] {
  if (!isRecord(parsed)) {
    fail(fileName, "최상위 JSON은 객체여야 합니다.");
    return [];
  }

  const groups: ActionGroup[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) {
      fail(`${fileName}:${key}`, "값은 action 배열이어야 합니다.");
      continue;
    }
    groups.push({ scope: `${fileName}:${key}`, actions: value, viewerTriggered });
  }
  return groups;
}

function collectRewardGroups(fileName: string, parsed: unknown): ActionGroup[] {
  if (!isRecord(parsed)) {
    fail(fileName, "최상위 JSON은 객체여야 합니다.");
    return [];
  }

  const groups: ActionGroup[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    const scope = `${fileName}:${key}`;
    if (!isRecord(value)) {
      fail(scope, "reward 설정은 객체여야 합니다.");
      continue;
    }
    if (value.name !== undefined && typeof value.name !== "string") fail(scope, "name은 문자열이어야 합니다.");
    validateIntegerField(scope, value, "cooldownMs");
    validateIntegerField(scope, value, "maxPerStream");
    validateDefaultOverlayBanner(scope, value.defaultOverlayBanner);
    if (!Array.isArray(value.actions)) {
      fail(scope, "actions는 배열이어야 합니다.");
      continue;
    }
    groups.push({ scope, actions: value.actions, viewerTriggered: true });
  }
  return groups;
}

function validateViewerTemplateUse(scope: string, actionIndex: number, action: unknown): void {
  if (!isRecord(action)) return;
  const actionType = typeof action.type === "string" ? action.type : "";
  const allowedPaths = VIEWER_TEMPLATE_SAFE_PATHS[actionType] ?? new Set<string>();

  for (const field of collectStringFields(action)) {
    if (!hasTemplate(field.value)) continue;
    const fieldScope = `${scope} action #${actionIndex}`;
    if (field.path === "type") {
      fail(fieldScope, "action.type에는 템플릿을 사용할 수 없습니다.");
      continue;
    }
    if (actionType.startsWith("obs.")) {
      fail(fieldScope, `viewer 템플릿은 obs.* action 필드에 사용할 수 없습니다: ${field.path}`);
      continue;
    }
    if (!allowedPaths.has(field.path)) {
      fail(fieldScope, `viewer 템플릿을 허용하지 않는 필드입니다: ${actionType}.${field.path}`);
    }
  }
}

function validateActionList(group: ActionGroup): void {
  group.actions.forEach((action, index) => {
    const result = validateBotAction(action);
    if (!result.ok) fail(`${group.scope} action #${index}`, result.error);
    if (group.viewerTriggered) validateViewerTemplateUse(group.scope, index, action);
  });
}

function readJson(filePath: string, fileName: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(fileName, `JSON을 읽을 수 없습니다: ${message}`);
    return undefined;
  }
}

const specs: ConfigSpec[] = [
  {
    fileName: "reward-actions.json",
    viewerTriggered: true,
    collectGroups: collectRewardGroups
  },
  {
    fileName: "chat-commands.json",
    viewerTriggered: true,
    collectGroups: (fileName, parsed) => collectArrayConfig(fileName, parsed, true)
  },
  {
    fileName: "stream-events.json",
    viewerTriggered: false,
    collectGroups: (fileName, parsed) => collectArrayConfig(fileName, parsed, false)
  }
];

const configDir = configDirFromArgs();

for (const spec of specs) {
  const filePath = path.join(configDir, spec.fileName);
  if (!fs.existsSync(filePath)) {
    fail(spec.fileName, `config 파일이 없습니다: ${filePath}`);
    continue;
  }

  const parsed = readJson(filePath, spec.fileName);
  for (const group of spec.collectGroups(spec.fileName, parsed)) {
    validateActionList(group);
  }
}

validateLolParticipationConfig(configDir);
validateAlertOverlayConfig(configDir);
validatePalworldServerStatusConfig(configDir);

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  console.error(`Config validation failed: ${failures.length}개 오류`);
  process.exit(1);
}

console.log(`Config validation passed: ${configDir}`);

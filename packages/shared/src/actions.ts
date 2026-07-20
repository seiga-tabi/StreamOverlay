import type { LolChampionSummary, LolMainRole, LolProfileStatus, LolRankedStats, ParticipationStreamerProfile } from "./participation.js";
import {
  MAX_CHAMPION_MASTERY_LEVEL,
  MAX_RANK_HISTORY_POINTS,
  MAX_RECENT_MATCH_CHAMPIONS,
  OVERLAY_BANNER_EVENT_KINDS,
  OVERLAY_SPEECH_LANGUAGES,
  validateOverlayMessage,
  type OverlayBannerEventKind,
  type OverlaySpeechLanguage,
  type ParticipationPhase,
  type ParticipationQueueEntry,
  type ParticipationSnapshotStatus
} from "./overlay.js";

export const ALLOWED_ACTION_TYPES = [
  "obs.setScene",
  "obs.showSource",
  "obs.hideSource",
  "obs.toggleSource",
  "obs.saveReplayBuffer",
  "obs.setInputMute",
  "obs.setText",
  "obs.playMedia",
  "twitch.chat",
  "overlay.banner",
  "overlay.subtitle",
  "overlay.subtitleBoost",
  "overlay.question",
  "overlay.mission",
  "overlay.participationQueue",
  "overlay.participationStatus",
  "overlay.participationSnapshot",
  "overlay.participationSelected",
  "overlay.participationTeams",
  "overlay.soloRankProfile",
  "overlay.emergency",
  "queue.question",
  "log.highlight",
  "participation.open",
  "participation.close",
  "noop"
] as const;

export const FORBIDDEN_ACTION_TYPES = [
  "obs.call",
  "obs.raw",
  "obs.request",
  "obs.setStreamKey",
  "obs.startStream",
  "obs.stopStream",
  "shell.exec",
  "shell.command",
  "process.exec",
  "child_process.exec",
  "file.delete",
  "file.write",
  "file.write_anywhere",
  "browser.open_url_any",
  "browser.openUrl",
  "url.open"
] as const;

export const FORBIDDEN_ACTION_PREFIXES = [
  "shell.",
  "file.",
  "browser.",
  "process.",
  "child_process.",
  "fs.",
  "url."
] as const;

export type AllowedActionType = (typeof ALLOWED_ACTION_TYPES)[number];

export type ObsSetSceneAction = {
  type: "obs.setScene";
  sceneName: string;
};

export type ObsShowSourceAction = {
  type: "obs.showSource";
  sceneName: string;
  sourceName: string;
  durationMs?: number;
};

export type ObsHideSourceAction = {
  type: "obs.hideSource";
  sceneName: string;
  sourceName: string;
};

export type ObsToggleSourceAction = {
  type: "obs.toggleSource";
  sceneName: string;
  sourceName: string;
  durationMs?: number;
};

export type ObsSaveReplayBufferAction = {
  type: "obs.saveReplayBuffer";
};

export type ObsSetInputMuteAction = {
  type: "obs.setInputMute";
  inputName: string;
  muted: boolean;
};

export type ObsSetTextAction = {
  type: "obs.setText";
  inputName: string;
  text: string;
};

export type ObsPlayMediaAction = {
  type: "obs.playMedia";
  inputName: string;
};

export type TwitchChatAction = {
  type: "twitch.chat";
  message: string;
};

export type OverlayBannerAction = {
  type: "overlay.banner";
  title?: string;
  subtitle?: string;
  message: string;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
  eventKind?: OverlayBannerEventKind;
  mediaUrl?: string;
  mediaAlt?: string;
  soundUrl?: string;
  soundVolume?: number;
  speechEnabled?: boolean;
  speechText?: string;
  speechAudioUrl?: string;
  speechLanguage?: OverlaySpeechLanguage;
  speechRate?: number;
  speechPitch?: number;
  speechVolume?: number;
};

export type OverlaySubtitleAction = {
  type: "overlay.subtitle";
  sourceLanguage: "ko" | "ja";
  targetLanguage: "ko" | "ja";
  original?: string;
  translated: string;
  isFinal?: boolean;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlaySubtitleBoostAction = {
  type: "overlay.subtitleBoost";
  title?: string;
  message?: string;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayQuestionAction = {
  type: "overlay.question";
  userName: string;
  question: string;
  translatedQuestion?: string;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayMissionAction = {
  type: "overlay.mission";
  title?: string;
  missions: Array<{ id: string; text: string; done: boolean }>;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayParticipationQueueAction = {
  type: "overlay.participationQueue";
  streamerId?: string;
  sessionId?: string;
  revision?: number;
  isOpen?: boolean;
  queue: Array<{
    position: number;
    twitchUserName: string;
    preferredRole?: string;
    status: string;
    requestedRole?: string;
    profileStatus?: LolProfileStatus;
    mainRole?: LolMainRole;
    mainRoleConfidence?: number;
    topChampions?: LolChampionSummary[];
    rankedStats?: LolRankedStats;
  }>;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayParticipationStatusAction = {
  type: "overlay.participationStatus";
  streamerId?: string;
  sessionId?: string;
  revision?: number;
  isOpen: boolean;
  mode?: "normal5" | "custom5v5" | "aram" | "onevone";
  phase?: ParticipationPhase;
  message?: string;
  nextCandidate?: {
    position: number;
    twitchUserName: string;
    preferredRole?: string;
    status: string;
    requestedRole?: string;
    profileStatus?: LolProfileStatus;
    mainRole?: LolMainRole;
    mainRoleConfidence?: number;
    topChampions?: LolChampionSummary[];
    rankedStats?: LolRankedStats;
  };
  streamerProfile?: ParticipationStreamerProfile;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayParticipationSnapshotAction = {
  type: "overlay.participationSnapshot";
  streamerId: string;
  sessionId: string;
  revision: number;
  status: ParticipationSnapshotStatus;
  queue: ParticipationQueueEntry[];
  emittedAt: string;
  traceId?: string;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayParticipationSelectedAction = {
  type: "overlay.participationSelected";
  twitchUserName: string;
  preferredRole?: string;
  checkInSeconds: number;
  profileStatus?: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayParticipationTeamsAction = {
  type: "overlay.participationTeams";
  teams: {
    a: Array<{ twitchUserName: string; preferredRole?: string }>;
    b: Array<{ twitchUserName: string; preferredRole?: string }>;
  };
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlaySoloRankProfileAction = {
  type: "overlay.soloRankProfile";
  profile: ParticipationStreamerProfile;
  region?: string;
  queueLabel?: string;
  ladderRank?: number;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type OverlayEmergencyAction = {
  type: "overlay.emergency";
  active?: boolean;
  title: string;
  message: string;
  durationMs?: number;
  variant?: "info" | "success" | "warning" | "danger";
  source?: string;
};

export type QueueQuestionAction = {
  type: "queue.question";
  question: string;
  userName?: string;
  translatedQuestion?: string;
};

export type LogHighlightAction = {
  type: "log.highlight";
  reason: string;
  userName?: string;
};

export type ParticipationOpenAction = {
  type: "participation.open";
  mode?: "normal5" | "custom5v5" | "aram" | "onevone";
  requiredPlayers?: number;
};

export type ParticipationCloseAction = {
  type: "participation.close";
};

export type NoopAction = {
  type: "noop";
  note?: string;
};

export type BotAction =
  | ObsSetSceneAction
  | ObsShowSourceAction
  | ObsHideSourceAction
  | ObsToggleSourceAction
  | ObsSaveReplayBufferAction
  | ObsSetInputMuteAction
  | ObsSetTextAction
  | ObsPlayMediaAction
  | TwitchChatAction
  | OverlayBannerAction
  | OverlaySubtitleAction
  | OverlaySubtitleBoostAction
  | OverlayQuestionAction
  | OverlayMissionAction
  | OverlayParticipationQueueAction
  | OverlayParticipationStatusAction
  | OverlayParticipationSnapshotAction
  | OverlayParticipationSelectedAction
  | OverlayParticipationTeamsAction
  | OverlaySoloRankProfileAction
  | OverlayEmergencyAction
  | QueueQuestionAction
  | LogHighlightAction
  | ParticipationOpenAction
  | ParticipationCloseAction
  | NoopAction;

export type ObsAction = Extract<
  BotAction,
  | { type: "obs.setScene" }
  | { type: "obs.showSource" }
  | { type: "obs.hideSource" }
  | { type: "obs.toggleSource" }
  | { type: "obs.saveReplayBuffer" }
  | { type: "obs.setInputMute" }
  | { type: "obs.setText" }
  | { type: "obs.playMedia" }
>;

export type BridgeCommand = ObsAction & {
  id: string;
  reason?: string;
  createdAt: string;
};

export type BridgeCommandAck = {
  id: string;
  ok: boolean;
  error?: string;
  executedAt: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export type ValidateBotActionOptions = {
  allowMetadata?: boolean;
};

const BRIDGE_METADATA_KEYS = ["id", "reason", "createdAt"] as const;
const BANNER_VARIANTS = ["info", "success", "warning", "danger"] as const;
const LANGUAGE_CODES = ["ko", "ja"] as const;
const PARTICIPATION_MODES = ["normal5", "custom5v5", "aram", "onevone"] as const;
const LOL_RANK_QUEUES = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR", "RANKED_TEAM_5x5", "UNRANKED"] as const;
const LOL_MAIN_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "FILL", "UNKNOWN"] as const;
const LOL_PROFILE_STATUSES = ["pending", "analyzing", "ready", "failed", "rate_limited"] as const;
const LOL_RANK_TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
  "UNRANKED"
] as const;
const LOL_RANK_DIVISIONS = ["I", "II", "III", "IV"] as const;

const MAX_NAME_LENGTH = 128;
const MAX_SHORT_TEXT_LENGTH = 256;
const MAX_CHAT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 1000;
const MAX_DURATION_MS = 60_000;
const MAX_COLLECTION_SIZE = 50;

export function isAllowedActionType(type: string): type is AllowedActionType {
  return (ALLOWED_ACTION_TYPES as readonly string[]).includes(type);
}

export function isForbiddenActionType(type: string): boolean {
  return (
    (FORBIDDEN_ACTION_TYPES as readonly string[]).includes(type) ||
    (FORBIDDEN_ACTION_PREFIXES as readonly string[]).some((prefix) => type.startsWith(prefix))
  );
}

export function isObsAction(action: BotAction): action is ObsAction {
  return action.type.startsWith("obs.");
}

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

function ok(): ValidationResult {
  return { ok: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringWithin(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function nonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function optionalString(value: unknown, maxLength: number, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  return stringWithin(value, maxLength) ? ok() : fail(`${fieldName}은 ${maxLength}자 이하 문자열이어야 합니다.`);
}

function optionalOverlayAssetUrl(value: unknown, maxLength: number, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  if (!stringWithin(value, maxLength)) return fail(`${fieldName}은 ${maxLength}자 이하 문자열이어야 합니다.`);
  if (value.length === 0) return ok();
  if (value.startsWith("/alerts/") || value.startsWith("/tts/")) {
    try {
      const decoded = decodeURIComponent(value);
      if (!decoded.includes("..") && !decoded.includes("\\") && !decoded.includes("\0")) return ok();
    } catch {
      return fail(`${fieldName}은 안전한 로컬 asset 경로여야 합니다.`);
    }
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? ok() : fail(`${fieldName}은 https URL, /alerts/... 또는 /tts/... 경로여야 합니다.`);
  } catch {
    return fail(`${fieldName}은 올바른 URL, /alerts/... 또는 /tts/... 경로여야 합니다.`);
  }
}

function optionalUnitNumber(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? ok()
    : fail(`${fieldName}은 0 이상 1 이하 숫자여야 합니다.`);
}

function optionalNumberInRange(value: unknown, min: number, max: number, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? ok()
    : fail(`${fieldName}은 ${min} 이상 ${max} 이하 숫자여야 합니다.`);
}

function optionalBoolean(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  return typeof value === "boolean" ? ok() : fail(`${fieldName}은 boolean이어야 합니다.`);
}

function optionalDuration(value: unknown): ValidationResult {
  if (value === undefined) return ok();
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= MAX_DURATION_MS
    ? ok()
    : fail(`durationMs는 1 이상 ${MAX_DURATION_MS} 이하의 정수여야 합니다.`);
}

function integerInRange(value: unknown, min: number, max: number, fieldName: string): ValidationResult {
  return Number.isInteger(value) && typeof value === "number" && value >= min && value <= max
    ? ok()
    : fail(`${fieldName}은 ${min} 이상 ${max} 이하의 정수여야 합니다.`);
}

function exactString<T extends readonly string[]>(value: unknown, values: T, fieldName: string): ValidationResult {
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? ok()
    : fail(`${fieldName} 값이 허용 목록에 없습니다.`);
}

function optionalExactString<T extends readonly string[]>(value: unknown, values: T, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  return exactString(value, values, fieldName);
}

function validateKeys(candidate: Record<string, unknown>, allowedKeys: readonly string[], options: ValidateBotActionOptions): ValidationResult {
  const allowed = new Set(["type", ...allowedKeys, ...(options.allowMetadata ? BRIDGE_METADATA_KEYS : [])]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) return fail(`허용되지 않는 action 필드입니다: ${key}`);
  }

  if (options.allowMetadata) {
    if (candidate.id !== undefined && !nonEmptyString(candidate.id, MAX_NAME_LENGTH)) {
      return fail("id는 비어 있지 않은 문자열이어야 합니다.");
    }
    if (candidate.createdAt !== undefined && !nonEmptyString(candidate.createdAt, 64)) {
      return fail("createdAt은 비어 있지 않은 문자열이어야 합니다.");
    }
    if (candidate.reason !== undefined && !stringWithin(candidate.reason, MAX_SHORT_TEXT_LENGTH)) {
      return fail(`reason은 ${MAX_SHORT_TEXT_LENGTH}자 이하 문자열이어야 합니다.`);
    }
  }

  return ok();
}

function validateObjectKeys(candidate: Record<string, unknown>, allowedKeys: readonly string[]): ValidationResult {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) return fail(`허용되지 않는 객체 필드입니다: ${key}`);
  }

  return ok();
}

function validateMissionList(value: unknown): ValidationResult {
  if (!Array.isArray(value)) return fail("missions는 배열이어야 합니다.");
  if (value.length > MAX_COLLECTION_SIZE) return fail(`missions는 최대 ${MAX_COLLECTION_SIZE}개까지 허용됩니다.`);

  for (const [index, mission] of value.entries()) {
    if (!isRecord(mission)) return fail(`missions[${index}]은 객체여야 합니다.`);
    const keyResult = validateObjectKeys(mission, ["id", "text", "done"]);
    if (!keyResult.ok) return keyResult;
    if (!nonEmptyString(mission.id, MAX_NAME_LENGTH)) return fail(`missions[${index}].id는 필수 문자열입니다.`);
    if (!nonEmptyString(mission.text, MAX_CHAT_LENGTH)) return fail(`missions[${index}].text는 필수 문자열입니다.`);
    if (typeof mission.done !== "boolean") return fail(`missions[${index}].done은 boolean이어야 합니다.`);
  }

  return ok();
}

function validateLolRankedStats(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  if (!isRecord(value)) return fail(`${fieldName}는 객체여야 합니다.`);
  const keyResult = validateObjectKeys(value, [
    "queueType",
    "tier",
    "rank",
    "leaguePoints",
    "wins",
    "losses",
    "winRate",
    "summonerLevel",
    "profileIconId",
    "tierIconUrl",
    "fetchedAt"
  ]);
  if (!keyResult.ok) return keyResult;
  const queueType = exactString(value.queueType, LOL_RANK_QUEUES, `${fieldName}.queueType`);
  if (!queueType.ok) return queueType;
  const tier = exactString(value.tier, LOL_RANK_TIERS, `${fieldName}.tier`);
  if (!tier.ok) return tier;
  const rank = optionalExactString(value.rank, LOL_RANK_DIVISIONS, `${fieldName}.rank`);
  if (!rank.ok) return rank;
  const leaguePoints = integerInRange(value.leaguePoints, 0, 5000, `${fieldName}.leaguePoints`);
  if (!leaguePoints.ok) return leaguePoints;
  const wins = integerInRange(value.wins, 0, 10000, `${fieldName}.wins`);
  if (!wins.ok) return wins;
  const losses = integerInRange(value.losses, 0, 10000, `${fieldName}.losses`);
  if (!losses.ok) return losses;
  const winRate = integerInRange(value.winRate, 0, 100, `${fieldName}.winRate`);
  if (!winRate.ok) return winRate;
  if (value.summonerLevel !== undefined) {
    const summonerLevel = integerInRange(value.summonerLevel, 1, 5000, `${fieldName}.summonerLevel`);
    if (!summonerLevel.ok) return summonerLevel;
  }
  if (value.profileIconId !== undefined) {
    const profileIconId = integerInRange(value.profileIconId, 0, 100000, `${fieldName}.profileIconId`);
    if (!profileIconId.ok) return profileIconId;
  }
  const tierIconUrl = optionalString(value.tierIconUrl, MAX_CHAT_LENGTH, `${fieldName}.tierIconUrl`);
  if (!tierIconUrl.ok) return tierIconUrl;
  return nonEmptyString(value.fetchedAt, 64) ? ok() : fail(`${fieldName}.fetchedAt은 필수 문자열입니다.`);
}

function validateLolPerformanceStats(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  if (!isRecord(value)) return fail(`${fieldName}는 객체여야 합니다.`);
  const keyResult = validateObjectKeys(value, ["sampleSize", "averageKills", "averageDeaths", "averageAssists", "kda"]);
  if (!keyResult.ok) return keyResult;
  const sampleSize = integerInRange(value.sampleSize, 0, 100, `${fieldName}.sampleSize`);
  if (!sampleSize.ok) return sampleSize;
  const kills = optionalNumberInRange(value.averageKills, 0, 100, `${fieldName}.averageKills`);
  if (!kills.ok) return kills;
  if (typeof value.averageKills !== "number") return fail(`${fieldName}.averageKills는 필수 숫자입니다.`);
  const deaths = optionalNumberInRange(value.averageDeaths, 0, 100, `${fieldName}.averageDeaths`);
  if (!deaths.ok) return deaths;
  if (typeof value.averageDeaths !== "number") return fail(`${fieldName}.averageDeaths는 필수 숫자입니다.`);
  const assists = optionalNumberInRange(value.averageAssists, 0, 100, `${fieldName}.averageAssists`);
  if (!assists.ok) return assists;
  if (typeof value.averageAssists !== "number") return fail(`${fieldName}.averageAssists는 필수 숫자입니다.`);
  const kda = optionalNumberInRange(value.kda, 0, 1000, `${fieldName}.kda`);
  if (!kda.ok) return kda;
  return typeof value.kda === "number" ? ok() : fail(`${fieldName}.kda는 필수 숫자입니다.`);
}

function validateLolRankHistory(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail(`${fieldName}은 배열이어야 합니다.`);
  if (value.length > MAX_RANK_HISTORY_POINTS) return fail(`${fieldName}은 최대 ${MAX_RANK_HISTORY_POINTS}개까지 허용됩니다.`);
  for (const [index, point] of value.entries()) {
    if (!isRecord(point)) return fail(`${fieldName}[${index}]은 객체여야 합니다.`);
    const keyResult = validateObjectKeys(point, ["date", "tier", "rank", "leaguePoints", "wins", "losses", "rankScore"]);
    if (!keyResult.ok) return keyResult;
    if (!nonEmptyString(point.date, 64)) return fail(`${fieldName}[${index}].date는 필수 문자열입니다.`);
    const tier = exactString(point.tier, LOL_RANK_TIERS, `${fieldName}[${index}].tier`);
    if (!tier.ok) return tier;
    const rank = optionalExactString(point.rank, LOL_RANK_DIVISIONS, `${fieldName}[${index}].rank`);
    if (!rank.ok) return rank;
    const leaguePoints = integerInRange(point.leaguePoints, 0, 5000, `${fieldName}[${index}].leaguePoints`);
    if (!leaguePoints.ok) return leaguePoints;
    const wins = integerInRange(point.wins, 0, 10000, `${fieldName}[${index}].wins`);
    if (!wins.ok) return wins;
    const losses = integerInRange(point.losses, 0, 10000, `${fieldName}[${index}].losses`);
    if (!losses.ok) return losses;
    const rankScore = integerInRange(point.rankScore, 0, 100000, `${fieldName}[${index}].rankScore`);
    if (!rankScore.ok) return rankScore;
  }
  return ok();
}

function validateTopChampions(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail(`${fieldName}은 배열이어야 합니다.`);
  if (value.length > 3) return fail(`${fieldName}은 최대 3개까지 허용됩니다.`);
  for (const [index, champion] of value.entries()) {
    if (!isRecord(champion)) return fail(`${fieldName}[${index}]은 객체여야 합니다.`);
    const keyResult = validateObjectKeys(champion, [
      "championId",
      "championKey",
      "nameKo",
      "nameJa",
      "iconUrl",
      "splashUrl",
      "loadingUrl",
      "imageVersion",
      "imageLocale",
      "skinNum",
      "skinNameKo",
      "skinNameJa",
      "masteryLevel",
      "masteryPoints",
      "games"
    ]);
    if (!keyResult.ok) return keyResult;
    const championId = integerInRange(champion.championId, 1, 10000, `${fieldName}[${index}].championId`);
    if (!championId.ok) return championId;
    const championKey = optionalString(champion.championKey, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].championKey`);
    if (!championKey.ok) return championKey;
    if (!nonEmptyString(champion.nameKo, MAX_SHORT_TEXT_LENGTH)) return fail(`${fieldName}[${index}].nameKo는 필수 문자열입니다.`);
    const nameJa = optionalString(champion.nameJa, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].nameJa`);
    if (!nameJa.ok) return nameJa;
    const iconUrl = optionalString(champion.iconUrl, MAX_CHAT_LENGTH, `${fieldName}[${index}].iconUrl`);
    if (!iconUrl.ok) return iconUrl;
    const splashUrl = optionalString(champion.splashUrl, MAX_CHAT_LENGTH, `${fieldName}[${index}].splashUrl`);
    if (!splashUrl.ok) return splashUrl;
    const loadingUrl = optionalString(champion.loadingUrl, MAX_CHAT_LENGTH, `${fieldName}[${index}].loadingUrl`);
    if (!loadingUrl.ok) return loadingUrl;
    const imageVersion = optionalString(champion.imageVersion, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].imageVersion`);
    if (!imageVersion.ok) return imageVersion;
    if (champion.imageLocale !== undefined && champion.imageLocale !== "neutral") {
      return fail(`${fieldName}[${index}].imageLocale은 neutral만 허용됩니다.`);
    }
    if (champion.skinNum !== undefined) {
      const skinNum = integerInRange(champion.skinNum, 0, 1000, `${fieldName}[${index}].skinNum`);
      if (!skinNum.ok) return skinNum;
    }
    const skinNameKo = optionalString(champion.skinNameKo, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].skinNameKo`);
    if (!skinNameKo.ok) return skinNameKo;
    const skinNameJa = optionalString(champion.skinNameJa, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].skinNameJa`);
    if (!skinNameJa.ok) return skinNameJa;
    if (champion.masteryLevel !== undefined) {
      const masteryLevel = integerInRange(champion.masteryLevel, 0, MAX_CHAMPION_MASTERY_LEVEL, `${fieldName}[${index}].masteryLevel`);
      if (!masteryLevel.ok) return masteryLevel;
    }
    if (champion.masteryPoints !== undefined) {
      const masteryPoints = integerInRange(champion.masteryPoints, 0, 100000000, `${fieldName}[${index}].masteryPoints`);
      if (!masteryPoints.ok) return masteryPoints;
    }
    if (champion.games !== undefined) {
      const games = integerInRange(champion.games, 0, 1000, `${fieldName}[${index}].games`);
      if (!games.ok) return games;
    }
  }
  return ok();
}

function validateRecentMatchChampions(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail(`${fieldName}은 배열이어야 합니다.`);
  if (value.length > MAX_RECENT_MATCH_CHAMPIONS) return fail(`${fieldName}은 최대 ${MAX_RECENT_MATCH_CHAMPIONS}개까지 허용됩니다.`);
  for (const [index, champion] of value.entries()) {
    if (!isRecord(champion)) return fail(`${fieldName}[${index}]은 객체여야 합니다.`);
    const keyResult = validateObjectKeys(champion, [
      "championId",
      "championKey",
      "nameKo",
      "nameJa",
      "iconUrl",
      "splashUrl",
      "loadingUrl",
      "imageVersion",
      "imageLocale",
      "won"
    ]);
    if (!keyResult.ok) return keyResult;
    const championId = integerInRange(champion.championId, 1, 10000, `${fieldName}[${index}].championId`);
    if (!championId.ok) return championId;
    const championKey = optionalString(champion.championKey, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].championKey`);
    if (!championKey.ok) return championKey;
    if (!nonEmptyString(champion.nameKo, MAX_SHORT_TEXT_LENGTH)) return fail(`${fieldName}[${index}].nameKo는 필수 문자열입니다.`);
    const nameJa = optionalString(champion.nameJa, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].nameJa`);
    if (!nameJa.ok) return nameJa;
    const iconUrl = optionalString(champion.iconUrl, MAX_CHAT_LENGTH, `${fieldName}[${index}].iconUrl`);
    if (!iconUrl.ok) return iconUrl;
    const splashUrl = optionalString(champion.splashUrl, MAX_CHAT_LENGTH, `${fieldName}[${index}].splashUrl`);
    if (!splashUrl.ok) return splashUrl;
    const loadingUrl = optionalString(champion.loadingUrl, MAX_CHAT_LENGTH, `${fieldName}[${index}].loadingUrl`);
    if (!loadingUrl.ok) return loadingUrl;
    const imageVersion = optionalString(champion.imageVersion, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].imageVersion`);
    if (!imageVersion.ok) return imageVersion;
    if (champion.imageLocale !== undefined && champion.imageLocale !== "neutral") {
      return fail(`${fieldName}[${index}].imageLocale은 neutral만 허용됩니다.`);
    }
    if (typeof champion.won !== "boolean") return fail(`${fieldName}[${index}].won은 boolean이어야 합니다.`);
  }
  return ok();
}

function validateParticipationQueue(value: unknown): ValidationResult {
  if (!Array.isArray(value)) return fail("queue는 배열이어야 합니다.");
  if (value.length > MAX_COLLECTION_SIZE) return fail(`queue는 최대 ${MAX_COLLECTION_SIZE}개까지 허용됩니다.`);

  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) return fail(`queue[${index}]은 객체여야 합니다.`);
    const keyResult = validateObjectKeys(item, [
      "position",
      "twitchUserName",
      "preferredRole",
      "status",
      "requestedRole",
      "profileStatus",
      "mainRole",
      "mainRoleConfidence",
      "topChampions",
      "rankedStats"
    ]);
    if (!keyResult.ok) return keyResult;
    const positionResult = integerInRange(item.position, 1, 1000, `queue[${index}].position`);
    if (!positionResult.ok) return positionResult;
    if (!nonEmptyString(item.twitchUserName, MAX_NAME_LENGTH)) return fail(`queue[${index}].twitchUserName은 필수 문자열입니다.`);
    const roleResult = optionalString(item.preferredRole, MAX_SHORT_TEXT_LENGTH, `queue[${index}].preferredRole`);
    if (!roleResult.ok) return roleResult;
    const requestedRole = optionalString(item.requestedRole, MAX_SHORT_TEXT_LENGTH, `queue[${index}].requestedRole`);
    if (!requestedRole.ok) return requestedRole;
    const profileStatus = optionalExactString(item.profileStatus, LOL_PROFILE_STATUSES, `queue[${index}].profileStatus`);
    if (!profileStatus.ok) return profileStatus;
    const mainRole = optionalExactString(item.mainRole, LOL_MAIN_ROLES, `queue[${index}].mainRole`);
    if (!mainRole.ok) return mainRole;
    if (item.mainRoleConfidence !== undefined) {
      const confidence = integerInRange(item.mainRoleConfidence, 0, 100, `queue[${index}].mainRoleConfidence`);
      if (!confidence.ok) return confidence;
    }
    const topChampions = validateTopChampions(item.topChampions, `queue[${index}].topChampions`);
    if (!topChampions.ok) return topChampions;
    if (!nonEmptyString(item.status, MAX_SHORT_TEXT_LENGTH)) return fail(`queue[${index}].status는 필수 문자열입니다.`);
    const statsResult = validateLolRankedStats(item.rankedStats, `queue[${index}].rankedStats`);
    if (!statsResult.ok) return statsResult;
  }

  return ok();
}

function validateParticipationStreamerProfile(value: unknown): ValidationResult {
  if (value === undefined) return ok();
  if (!isRecord(value)) return fail("streamerProfile은 객체여야 합니다.");
  const keyResult = validateObjectKeys(value, [
    "displayName",
    "riotTagLine",
    "profileStatus",
    "mainRole",
    "mainRoleConfidence",
    "ladderRank",
    "topChampions",
    "rankedStats",
    "performanceStats",
    "recentMatches",
    "rankHistory"
  ]);
  if (!keyResult.ok) return keyResult;
  const displayName = optionalString(value.displayName, MAX_SHORT_TEXT_LENGTH, "streamerProfile.displayName");
  if (!displayName.ok) return displayName;
  const riotTagLine = optionalString(value.riotTagLine, MAX_SHORT_TEXT_LENGTH, "streamerProfile.riotTagLine");
  if (!riotTagLine.ok) return riotTagLine;
  const profileStatus = optionalExactString(value.profileStatus, LOL_PROFILE_STATUSES, "streamerProfile.profileStatus");
  if (!profileStatus.ok) return profileStatus;
  const mainRole = optionalExactString(value.mainRole, LOL_MAIN_ROLES, "streamerProfile.mainRole");
  if (!mainRole.ok) return mainRole;
  if (value.mainRoleConfidence !== undefined) {
    const confidence = integerInRange(value.mainRoleConfidence, 0, 100, "streamerProfile.mainRoleConfidence");
    if (!confidence.ok) return confidence;
  }
  if (value.ladderRank !== undefined) {
    const ladderRank = integerInRange(value.ladderRank, 1, 10000000, "streamerProfile.ladderRank");
    if (!ladderRank.ok) return ladderRank;
  }
  const topChampions = validateTopChampions(value.topChampions, "streamerProfile.topChampions");
  if (!topChampions.ok) return topChampions;
  const rankedStats = validateLolRankedStats(value.rankedStats, "streamerProfile.rankedStats");
  if (!rankedStats.ok) return rankedStats;
  const performanceStats = validateLolPerformanceStats(value.performanceStats, "streamerProfile.performanceStats");
  if (!performanceStats.ok) return performanceStats;
  const recentMatches = validateRecentMatchChampions(value.recentMatches, "streamerProfile.recentMatches");
  if (!recentMatches.ok) return recentMatches;
  return validateLolRankHistory(value.rankHistory, "streamerProfile.rankHistory");
}

function validateOverlayCommonFields(candidate: Record<string, unknown>): ValidationResult {
  const durationResult = optionalDuration(candidate.durationMs);
  if (!durationResult.ok) return durationResult;
  const variantResult = optionalExactString(candidate.variant, BANNER_VARIANTS, "variant");
  if (!variantResult.ok) return variantResult;
  return optionalString(candidate.source, MAX_SHORT_TEXT_LENGTH, "source");
}

function validateParticipationTeams(value: unknown): ValidationResult {
  if (!isRecord(value)) return fail("teams는 객체여야 합니다.");
  const keyResult = validateObjectKeys(value, ["a", "b"]);
  if (!keyResult.ok) return keyResult;
  for (const teamName of ["a", "b"] as const) {
    const team = value[teamName];
    if (!Array.isArray(team)) return fail(`teams.${teamName}은 배열이어야 합니다.`);
    if (team.length > 5) return fail(`teams.${teamName}은 최대 5명까지 허용됩니다.`);
    for (const [index, player] of team.entries()) {
      if (!isRecord(player)) return fail(`teams.${teamName}[${index}]은 객체여야 합니다.`);
      const playerKeyResult = validateObjectKeys(player, ["twitchUserName", "preferredRole"]);
      if (!playerKeyResult.ok) return playerKeyResult;
      if (!nonEmptyString(player.twitchUserName, MAX_NAME_LENGTH)) {
        return fail(`teams.${teamName}[${index}].twitchUserName은 필수 문자열입니다.`);
      }
      const roleResult = optionalString(player.preferredRole, MAX_SHORT_TEXT_LENGTH, `teams.${teamName}[${index}].preferredRole`);
      if (!roleResult.ok) return roleResult;
    }
  }
  return ok();
}

export function validateBotAction(action: unknown, options: ValidateBotActionOptions = {}): ValidationResult {
  if (!isRecord(action)) return fail("action은 객체여야 합니다.");
  const candidate = action as { type?: unknown } & Record<string, unknown>;
  if (!nonEmptyString(candidate.type, MAX_NAME_LENGTH)) return fail("action.type은 필수 문자열입니다.");
  if (isForbiddenActionType(candidate.type)) return fail(`금지된 action type입니다: ${candidate.type}`);
  if (!isAllowedActionType(candidate.type)) return fail(`허용되지 않은 action type입니다: ${candidate.type}`);

  switch (candidate.type) {
    case "obs.setScene": {
      const keyResult = validateKeys(candidate, ["sceneName"], options);
      if (!keyResult.ok) return keyResult;
      return nonEmptyString(candidate.sceneName, MAX_NAME_LENGTH) ? ok() : fail("sceneName은 필수 문자열입니다.");
    }
    case "obs.showSource":
    case "obs.toggleSource": {
      const keyResult = validateKeys(candidate, ["sceneName", "sourceName", "durationMs"], options);
      if (!keyResult.ok) return keyResult;
      if (!nonEmptyString(candidate.sceneName, MAX_NAME_LENGTH) || !nonEmptyString(candidate.sourceName, MAX_NAME_LENGTH)) {
        return fail("sceneName과 sourceName은 필수 문자열입니다.");
      }
      return optionalDuration(candidate.durationMs);
    }
    case "obs.hideSource": {
      const keyResult = validateKeys(candidate, ["sceneName", "sourceName"], options);
      if (!keyResult.ok) return keyResult;
      return nonEmptyString(candidate.sceneName, MAX_NAME_LENGTH) && nonEmptyString(candidate.sourceName, MAX_NAME_LENGTH)
        ? ok()
        : fail("sceneName과 sourceName은 필수 문자열입니다.");
    }
    case "obs.saveReplayBuffer": {
      return validateKeys(candidate, [], options);
    }
    case "obs.setInputMute": {
      const keyResult = validateKeys(candidate, ["inputName", "muted"], options);
      if (!keyResult.ok) return keyResult;
      return nonEmptyString(candidate.inputName, MAX_NAME_LENGTH) && typeof candidate.muted === "boolean"
        ? ok()
        : fail("inputName과 muted는 필수입니다.");
    }
    case "obs.setText": {
      const keyResult = validateKeys(candidate, ["inputName", "text"], options);
      if (!keyResult.ok) return keyResult;
      return nonEmptyString(candidate.inputName, MAX_NAME_LENGTH) && stringWithin(candidate.text, MAX_LONG_TEXT_LENGTH)
        ? ok()
        : fail(`inputName은 필수 문자열이고 text는 ${MAX_LONG_TEXT_LENGTH}자 이하 문자열이어야 합니다.`);
    }
    case "obs.playMedia": {
      const keyResult = validateKeys(candidate, ["inputName"], options);
      if (!keyResult.ok) return keyResult;
      return nonEmptyString(candidate.inputName, MAX_NAME_LENGTH) ? ok() : fail("inputName은 필수 문자열입니다.");
    }
    case "twitch.chat": {
      const keyResult = validateKeys(candidate, ["message"], options);
      if (!keyResult.ok) return keyResult;
      return nonEmptyString(candidate.message, MAX_CHAT_LENGTH) ? ok() : fail("message는 필수 문자열입니다.");
    }
    case "overlay.banner": {
      const keyResult = validateKeys(candidate, [
        "title",
        "subtitle",
        "message",
        "durationMs",
        "variant",
        "source",
        "eventKind",
        "mediaUrl",
        "mediaAlt",
        "soundUrl",
        "soundVolume",
        "speechEnabled",
        "speechText",
        "speechAudioUrl",
        "speechLanguage",
        "speechRate",
        "speechPitch",
        "speechVolume"
      ], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const title = optionalString(candidate.title, MAX_SHORT_TEXT_LENGTH, "title");
      if (!title.ok) return title;
      const subtitle = optionalString(candidate.subtitle, MAX_SHORT_TEXT_LENGTH, "subtitle");
      if (!subtitle.ok) return subtitle;
      if (!nonEmptyString(candidate.message, MAX_CHAT_LENGTH)) return fail("message는 필수 문자열입니다.");
      const eventKind = optionalExactString(candidate.eventKind, OVERLAY_BANNER_EVENT_KINDS, "eventKind");
      if (!eventKind.ok) return eventKind;
      const mediaUrl = optionalOverlayAssetUrl(candidate.mediaUrl, MAX_CHAT_LENGTH, "mediaUrl");
      if (!mediaUrl.ok) return mediaUrl;
      const mediaAlt = optionalString(candidate.mediaAlt, MAX_SHORT_TEXT_LENGTH, "mediaAlt");
      if (!mediaAlt.ok) return mediaAlt;
      const soundUrl = optionalOverlayAssetUrl(candidate.soundUrl, MAX_CHAT_LENGTH, "soundUrl");
      if (!soundUrl.ok) return soundUrl;
      const soundVolume = optionalUnitNumber(candidate.soundVolume, "soundVolume");
      if (!soundVolume.ok) return soundVolume;
      const speechEnabled = optionalBoolean(candidate.speechEnabled, "speechEnabled");
      if (!speechEnabled.ok) return speechEnabled;
      const speechText = optionalString(candidate.speechText, MAX_CHAT_LENGTH, "speechText");
      if (!speechText.ok) return speechText;
      const speechAudioUrl = optionalOverlayAssetUrl(candidate.speechAudioUrl, MAX_CHAT_LENGTH, "speechAudioUrl");
      if (!speechAudioUrl.ok) return speechAudioUrl;
      const speechLanguage = optionalExactString(candidate.speechLanguage, OVERLAY_SPEECH_LANGUAGES, "speechLanguage");
      if (!speechLanguage.ok) return speechLanguage;
      const speechRate = optionalNumberInRange(candidate.speechRate, 0.5, 1.5, "speechRate");
      if (!speechRate.ok) return speechRate;
      const speechPitch = optionalNumberInRange(candidate.speechPitch, 0.5, 1.5, "speechPitch");
      if (!speechPitch.ok) return speechPitch;
      const speechVolume = optionalUnitNumber(candidate.speechVolume, "speechVolume");
      if (!speechVolume.ok) return speechVolume;
      return ok();
    }
    case "overlay.subtitle": {
      const keyResult = validateKeys(candidate, ["sourceLanguage", "targetLanguage", "original", "translated", "isFinal", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const sourceResult = exactString(candidate.sourceLanguage, LANGUAGE_CODES, "sourceLanguage");
      if (!sourceResult.ok) return sourceResult;
      const targetResult = exactString(candidate.targetLanguage, LANGUAGE_CODES, "targetLanguage");
      if (!targetResult.ok) return targetResult;
      const originalResult = optionalString(candidate.original, MAX_LONG_TEXT_LENGTH, "original");
      if (!originalResult.ok) return originalResult;
      if (!nonEmptyString(candidate.translated, MAX_LONG_TEXT_LENGTH)) return fail("translated는 필수 문자열입니다.");
      return optionalBoolean(candidate.isFinal, "isFinal");
    }
    case "overlay.subtitleBoost": {
      const keyResult = validateKeys(candidate, ["title", "message", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const title = optionalString(candidate.title, MAX_SHORT_TEXT_LENGTH, "title");
      if (!title.ok) return title;
      return optionalString(candidate.message, MAX_CHAT_LENGTH, "message");
    }
    case "overlay.question": {
      const keyResult = validateKeys(candidate, ["userName", "question", "translatedQuestion", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      if (!nonEmptyString(candidate.userName, MAX_NAME_LENGTH) || !nonEmptyString(candidate.question, MAX_LONG_TEXT_LENGTH)) {
        return fail("userName과 question은 필수 문자열입니다.");
      }
      return optionalString(candidate.translatedQuestion, MAX_LONG_TEXT_LENGTH, "translatedQuestion");
    }
    case "overlay.mission": {
      const keyResult = validateKeys(candidate, ["title", "missions", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const title = optionalString(candidate.title, MAX_SHORT_TEXT_LENGTH, "title");
      if (!title.ok) return title;
      return validateMissionList(candidate.missions);
    }
    case "overlay.participationQueue": {
      const keyResult = validateKeys(candidate, ["streamerId", "sessionId", "revision", "isOpen", "queue", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const streamerId = optionalString(candidate.streamerId, MAX_SHORT_TEXT_LENGTH, "streamerId");
      if (!streamerId.ok) return streamerId;
      const sessionId = optionalString(candidate.sessionId, MAX_SHORT_TEXT_LENGTH, "sessionId");
      if (!sessionId.ok) return sessionId;
      if (candidate.revision !== undefined) {
        const revision = integerInRange(candidate.revision, 1, Number.MAX_SAFE_INTEGER, "revision");
        if (!revision.ok) return revision;
      }
      if (candidate.isOpen !== undefined && typeof candidate.isOpen !== "boolean") return fail("isOpen은 boolean이어야 합니다.");
      return validateParticipationQueue(candidate.queue);
    }
    case "overlay.participationStatus": {
      const keyResult = validateKeys(candidate, ["streamerId", "sessionId", "revision", "isOpen", "mode", "phase", "message", "nextCandidate", "streamerProfile", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const streamerId = optionalString(candidate.streamerId, MAX_SHORT_TEXT_LENGTH, "streamerId");
      if (!streamerId.ok) return streamerId;
      const sessionId = optionalString(candidate.sessionId, MAX_SHORT_TEXT_LENGTH, "sessionId");
      if (!sessionId.ok) return sessionId;
      if (candidate.revision !== undefined) {
        const revision = integerInRange(candidate.revision, 1, Number.MAX_SAFE_INTEGER, "revision");
        if (!revision.ok) return revision;
      }
      if (typeof candidate.isOpen !== "boolean") return fail("isOpen은 boolean이어야 합니다.");
      const modeResult = optionalExactString(candidate.mode, PARTICIPATION_MODES, "mode");
      if (!modeResult.ok) return modeResult;
      const phaseResult = optionalExactString(candidate.phase, ["recruiting", "closed", "in_game", "game_ended"] as const, "phase");
      if (!phaseResult.ok) return phaseResult;
      const messageResult = optionalString(candidate.message, MAX_CHAT_LENGTH, "message");
      if (!messageResult.ok) return messageResult;
      if (candidate.nextCandidate !== undefined) {
        const nextCandidate = validateParticipationQueue([candidate.nextCandidate]);
        if (!nextCandidate.ok) return nextCandidate;
      }
      return validateParticipationStreamerProfile(candidate.streamerProfile);
    }
    case "overlay.participationSnapshot": {
      const keyResult = validateKeys(candidate, [
        "streamerId",
        "sessionId",
        "revision",
        "status",
        "queue",
        "emittedAt",
        "traceId",
        "durationMs",
        "variant",
        "source"
      ], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      return validateOverlayMessage({
        type: "participation.snapshot.update",
        streamerId: candidate.streamerId,
        sessionId: candidate.sessionId,
        revision: candidate.revision,
        status: candidate.status,
        queue: candidate.queue,
        emittedAt: candidate.emittedAt,
        traceId: candidate.traceId
      });
    }
    case "overlay.participationSelected": {
      const keyResult = validateKeys(candidate, [
        "twitchUserName",
        "preferredRole",
        "checkInSeconds",
        "profileStatus",
        "mainRole",
        "mainRoleConfidence",
        "topChampions",
        "rankedStats",
        "durationMs",
        "variant",
        "source"
      ], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      if (!nonEmptyString(candidate.twitchUserName, MAX_NAME_LENGTH)) return fail("twitchUserName은 필수 문자열입니다.");
      const roleResult = optionalString(candidate.preferredRole, MAX_SHORT_TEXT_LENGTH, "preferredRole");
      if (!roleResult.ok) return roleResult;
      const profileStatus = optionalExactString(candidate.profileStatus, LOL_PROFILE_STATUSES, "profileStatus");
      if (!profileStatus.ok) return profileStatus;
      const mainRole = optionalExactString(candidate.mainRole, LOL_MAIN_ROLES, "mainRole");
      if (!mainRole.ok) return mainRole;
      if (candidate.mainRoleConfidence !== undefined) {
        const confidence = integerInRange(candidate.mainRoleConfidence, 0, 100, "mainRoleConfidence");
        if (!confidence.ok) return confidence;
      }
      const topChampions = validateTopChampions(candidate.topChampions, "topChampions");
      if (!topChampions.ok) return topChampions;
      const checkInSecondsResult = integerInRange(candidate.checkInSeconds, 1, 3600, "checkInSeconds");
      if (!checkInSecondsResult.ok) return checkInSecondsResult;
      return validateLolRankedStats(candidate.rankedStats, "rankedStats");
    }
    case "overlay.participationTeams": {
      const keyResult = validateKeys(candidate, ["teams", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      return validateParticipationTeams(candidate.teams);
    }
    case "overlay.soloRankProfile": {
      const keyResult = validateKeys(candidate, ["profile", "region", "queueLabel", "ladderRank", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      if (!isRecord(candidate.profile)) return fail("profile은 객체여야 합니다.");
      const profile = validateParticipationStreamerProfile(candidate.profile);
      if (!profile.ok) return profile;
      const region = optionalString(candidate.region, MAX_SHORT_TEXT_LENGTH, "region");
      if (!region.ok) return region;
      const queueLabel = optionalString(candidate.queueLabel, MAX_SHORT_TEXT_LENGTH, "queueLabel");
      if (!queueLabel.ok) return queueLabel;
      if (candidate.ladderRank !== undefined) return integerInRange(candidate.ladderRank, 1, 10000000, "ladderRank");
      return ok();
    }
    case "overlay.emergency": {
      const keyResult = validateKeys(candidate, ["active", "title", "message", "durationMs", "variant", "source"], options);
      if (!keyResult.ok) return keyResult;
      const common = validateOverlayCommonFields(candidate);
      if (!common.ok) return common;
      const activeResult = optionalBoolean(candidate.active, "active");
      if (!activeResult.ok) return activeResult;
      if (!nonEmptyString(candidate.title, MAX_SHORT_TEXT_LENGTH)) return fail("title은 필수 문자열입니다.");
      return nonEmptyString(candidate.message, MAX_CHAT_LENGTH) ? ok() : fail("message는 필수 문자열입니다.");
    }
    case "queue.question": {
      const keyResult = validateKeys(candidate, ["question", "userName", "translatedQuestion"], options);
      if (!keyResult.ok) return keyResult;
      if (!nonEmptyString(candidate.question, MAX_LONG_TEXT_LENGTH)) return fail("question은 필수 문자열입니다.");
      const userResult = optionalString(candidate.userName, MAX_NAME_LENGTH, "userName");
      if (!userResult.ok) return userResult;
      return optionalString(candidate.translatedQuestion, MAX_LONG_TEXT_LENGTH, "translatedQuestion");
    }
    case "log.highlight": {
      const keyResult = validateKeys(candidate, ["reason", "userName"], options);
      if (!keyResult.ok) return keyResult;
      if (!nonEmptyString(candidate.reason, MAX_CHAT_LENGTH)) return fail("reason은 필수 문자열입니다.");
      return optionalString(candidate.userName, MAX_NAME_LENGTH, "userName");
    }
    case "participation.open": {
      const keyResult = validateKeys(candidate, ["mode", "requiredPlayers"], options);
      if (!keyResult.ok) return keyResult;
      const modeResult = optionalExactString(candidate.mode, PARTICIPATION_MODES, "mode");
      if (!modeResult.ok) return modeResult;
      if (candidate.requiredPlayers === undefined) return ok();
      return integerInRange(candidate.requiredPlayers, 1, 10, "requiredPlayers");
    }
    case "participation.close": {
      return validateKeys(candidate, [], options);
    }
    case "noop": {
      const keyResult = validateKeys(candidate, ["note"], options);
      if (!keyResult.ok) return keyResult;
      return optionalString(candidate.note, MAX_CHAT_LENGTH, "note");
    }
    default:
      return fail("알 수 없는 action type입니다.");
  }
}

import type { LolChampionSummary, LolMainRole, LolProfileStatus, LolRankedStats, ParticipationStreamerProfile } from "./participation.js";

export const OVERLAY_CHANNELS = ["events", "chat", "subtitles", "questions", "mission", "participation", "solo-rank", "all"] as const;
export const OVERLAY_VARIANTS = ["info", "success", "warning", "danger"] as const;
export const OVERLAY_BANNER_EVENT_KINDS = ["follow", "cheer", "subscription", "subscription_message", "raid", "reward", "stream", "test", "custom"] as const;
export const OVERLAY_SPEECH_LANGUAGES = ["ja-JP", "ko-KR"] as const;
export const PARTICIPATION_PHASES = ["recruiting", "closed", "in_game", "game_ended"] as const;
export const MAX_CHAMPION_MASTERY_LEVEL = 1000;
export const MAX_RECENT_MATCH_CHAMPIONS = 10;
export const MAX_RANK_HISTORY_POINTS = 64;

export type OverlayChannel = (typeof OVERLAY_CHANNELS)[number];
export type OverlayVariant = (typeof OVERLAY_VARIANTS)[number];
export type OverlayBannerEventKind = (typeof OVERLAY_BANNER_EVENT_KINDS)[number];
export type OverlaySpeechLanguage = (typeof OVERLAY_SPEECH_LANGUAGES)[number];
export type ParticipationPhase = (typeof PARTICIPATION_PHASES)[number];

export type OverlayMessageBase = {
  durationMs?: number;
  variant?: OverlayVariant;
  source?: string;
};

export type OverlayBannerMessage = OverlayMessageBase & {
  type: "overlay.banner";
  title?: string;
  subtitle?: string;
  message: string;
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

export type SubtitleUpdateMessage = OverlayMessageBase & {
  type: "subtitle.update";
  sourceLanguage: "ko" | "ja";
  targetLanguage: "ko" | "ja";
  original?: string;
  translated: string;
  isFinal: boolean;
};

export type SubtitleBoostMessage = OverlayMessageBase & {
  type: "subtitle.boost";
  title?: string;
  message?: string;
};

export type QuestionShowMessage = OverlayMessageBase & {
  type: "question.show";
  userName: string;
  question: string;
  translatedQuestion?: string;
};

export type QuestionClearMessage = OverlayMessageBase & {
  type: "question.clear";
};

export type ChatMessageAddMessage = OverlayMessageBase & {
  type: "chat.message.add";
  id?: string;
  userName: string;
  profileImageUrl?: string;
  message: string;
  fragments?: ChatMessageFragment[];
  translatedMessage?: string;
  translationSourceLanguage?: "ko" | "ja";
  translationTargetLanguage?: "ko" | "ja";
  createdAt?: string;
  isBroadcaster?: boolean;
};

export type ChatMessageFragment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "emote";
      id: string;
      text: string;
      imageUrl: string;
    };

export type ChatClearMessage = OverlayMessageBase & {
  type: "chat.clear";
};

export type MissionUpdateMessage = OverlayMessageBase & {
  type: "mission.update";
  title?: string;
  missions: Array<{ id: string; text: string; done: boolean }>;
};

export type ParticipationQueueEntry = {
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

export type ParticipationQueueUpdateMessage = OverlayMessageBase & {
  type: "participation.queue.update";
  streamerId?: string;
  sessionId?: string;
  revision?: number;
  isOpen?: boolean;
  queue: ParticipationQueueEntry[];
};

export type ParticipationStatusUpdateMessage = OverlayMessageBase & {
  type: "participation.status.update";
  streamerId?: string;
  sessionId?: string;
  revision?: number;
  isOpen: boolean;
  mode?: "normal5" | "custom5v5" | "aram" | "onevone";
  phase?: ParticipationPhase;
  message?: string;
  nextCandidate?: ParticipationQueueEntry;
  streamerProfile?: ParticipationStreamerProfile;
};

export type ParticipationSnapshotStatus = Omit<ParticipationStatusUpdateMessage, "type" | keyof OverlayMessageBase>;

export type ParticipationSnapshotUpdateMessage = OverlayMessageBase & {
  type: "participation.snapshot.update";
  streamerId: string;
  sessionId: string;
  revision: number;
  status: ParticipationSnapshotStatus;
  queue: ParticipationQueueEntry[];
  emittedAt: string;
  traceId?: string;
};

export type SoloRankProfileUpdateMessage = OverlayMessageBase & {
  type: "solo-rank.profile.update";
  profile: ParticipationStreamerProfile;
  region?: string;
  queueLabel?: string;
  ladderRank?: number;
};

export type ParticipationSelectedShowMessage = OverlayMessageBase & {
  type: "participation.selected.show";
  twitchUserName: string;
  preferredRole?: string;
  checkInSeconds: number;
  profileStatus?: LolProfileStatus;
  mainRole?: LolMainRole;
  mainRoleConfidence?: number;
  topChampions?: LolChampionSummary[];
  rankedStats?: LolRankedStats;
};

export type ParticipationSelectedClearMessage = OverlayMessageBase & {
  type: "participation.selected.clear";
};

export type ParticipationTeamsUpdateMessage = OverlayMessageBase & {
  type: "participation.teams.update";
  teams: {
    a: Array<{ twitchUserName: string; preferredRole?: string }>;
    b: Array<{ twitchUserName: string; preferredRole?: string }>;
  };
};

export type EmergencyShowMessage = OverlayMessageBase & {
  type: "emergency.show";
  title: string;
  message: string;
};

export type EmergencyClearMessage = OverlayMessageBase & {
  type: "emergency.clear";
};

export type OverlayMessage =
  | OverlayBannerMessage
  | SubtitleUpdateMessage
  | SubtitleBoostMessage
  | QuestionShowMessage
  | QuestionClearMessage
  | ChatMessageAddMessage
  | ChatClearMessage
  | MissionUpdateMessage
  | ParticipationQueueUpdateMessage
  | ParticipationStatusUpdateMessage
  | ParticipationSnapshotUpdateMessage
  | SoloRankProfileUpdateMessage
  | ParticipationSelectedShowMessage
  | ParticipationSelectedClearMessage
  | ParticipationTeamsUpdateMessage
  | EmergencyShowMessage
  | EmergencyClearMessage;

export type OverlayValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export type OverlayMessageLogEntry = {
  id: string;
  type: OverlayMessage["type"];
  channel: OverlayChannel;
  source?: string;
  variant?: OverlayVariant;
  messagePreview?: string;
  createdAt: string;
};

export type OverlayStatus = {
  clientCount: number;
  clientsByChannel: Record<OverlayChannel, number>;
  recentMessages: OverlayMessageLogEntry[];
};

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
const MAX_SHORT_TEXT_LENGTH = 256;
const MAX_MESSAGE_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 1000;
const MAX_DURATION_MS = 60_000;
const MAX_COLLECTION_SIZE = 50;

function fail(error: string): OverlayValidationResult {
  return { ok: false, error };
}

function ok(): OverlayValidationResult {
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

function optionalString(value: unknown, maxLength: number, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  return stringWithin(value, maxLength) ? ok() : fail(`${fieldName}은 ${maxLength}자 이하 문자열이어야 합니다.`);
}

function optionalHttpsUrl(value: unknown, maxLength: number, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!stringWithin(value, maxLength)) return fail(`${fieldName}은 ${maxLength}자 이하 문자열이어야 합니다.`);
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? ok() : fail(`${fieldName}은 https URL이어야 합니다.`);
  } catch {
    return fail(`${fieldName}은 올바른 URL이어야 합니다.`);
  }
}

function optionalOverlayAssetUrl(value: unknown, maxLength: number, fieldName: string): OverlayValidationResult {
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

function optionalUnitNumber(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
    ? ok()
    : fail(`${fieldName}은 0 이상 1 이하 숫자여야 합니다.`);
}

function optionalBoolean(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  return typeof value === "boolean" ? ok() : fail(`${fieldName}은 boolean이어야 합니다.`);
}

function optionalNumberInRange(value: unknown, min: number, max: number, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? ok()
    : fail(`${fieldName}은 ${min} 이상 ${max} 이하 숫자여야 합니다.`);
}

function optionalDuration(value: unknown): OverlayValidationResult {
  if (value === undefined) return ok();
  return Number.isInteger(value) && typeof value === "number" && value >= 1 && value <= MAX_DURATION_MS
    ? ok()
    : fail(`durationMs는 1 이상 ${MAX_DURATION_MS} 이하의 정수여야 합니다.`);
}

function optionalVariant(value: unknown): OverlayValidationResult {
  if (value === undefined) return ok();
  return typeof value === "string" && (OVERLAY_VARIANTS as readonly string[]).includes(value)
    ? ok()
    : fail("variant 값이 허용 목록에 없습니다.");
}

function optionalExactString<T extends readonly string[]>(value: unknown, values: T, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  return typeof value === "string" && (values as readonly string[]).includes(value)
    ? ok()
    : fail(`${fieldName} 값이 허용 목록에 없습니다.`);
}

function validateKeys(candidate: Record<string, unknown>, allowedKeys: readonly string[]): OverlayValidationResult {
  const allowed = new Set(["type", "durationMs", "variant", "source", ...allowedKeys]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) return fail(`허용되지 않는 overlay message 필드입니다: ${key}`);
  }
  const durationResult = optionalDuration(candidate.durationMs);
  if (!durationResult.ok) return durationResult;
  const variantResult = optionalVariant(candidate.variant);
  if (!variantResult.ok) return variantResult;
  return optionalString(candidate.source, MAX_SHORT_TEXT_LENGTH, "source");
}

function validateMissionList(value: unknown): OverlayValidationResult {
  if (!Array.isArray(value)) return fail("missions는 배열이어야 합니다.");
  if (value.length > MAX_COLLECTION_SIZE) return fail(`missions는 최대 ${MAX_COLLECTION_SIZE}개까지 허용됩니다.`);
  for (const [index, mission] of value.entries()) {
    if (!isRecord(mission)) return fail(`missions[${index}]은 객체여야 합니다.`);
    const keys = validateExactObjectKeys(mission, ["id", "text", "done"]);
    if (!keys.ok) return keys;
    if (!nonEmptyString(mission.id, MAX_SHORT_TEXT_LENGTH)) return fail(`missions[${index}].id는 필수 문자열입니다.`);
    if (!nonEmptyString(mission.text, MAX_MESSAGE_LENGTH)) return fail(`missions[${index}].text는 필수 문자열입니다.`);
    if (typeof mission.done !== "boolean") return fail(`missions[${index}].done은 boolean이어야 합니다.`);
  }
  return ok();
}

function validateChatFragments(value: unknown): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail("fragments는 배열이어야 합니다.");
  if (value.length > MAX_COLLECTION_SIZE) return fail(`fragments는 최대 ${MAX_COLLECTION_SIZE}개까지 허용됩니다.`);
  for (const [index, fragment] of value.entries()) {
    if (!isRecord(fragment)) return fail(`fragments[${index}]은 객체여야 합니다.`);
    if (fragment.type === "text") {
      const keys = validateExactObjectKeys(fragment, ["type", "text"]);
      if (!keys.ok) return keys;
      if (!stringWithin(fragment.text, MAX_MESSAGE_LENGTH)) return fail(`fragments[${index}].text는 ${MAX_MESSAGE_LENGTH}자 이하 문자열이어야 합니다.`);
      continue;
    }
    if (fragment.type === "emote") {
      const keys = validateExactObjectKeys(fragment, ["type", "id", "text", "imageUrl"]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(fragment.id, MAX_SHORT_TEXT_LENGTH)) return fail(`fragments[${index}].id는 필수 문자열입니다.`);
      if (!nonEmptyString(fragment.text, MAX_SHORT_TEXT_LENGTH)) return fail(`fragments[${index}].text는 필수 문자열입니다.`);
      if (typeof fragment.imageUrl !== "string") return fail(`fragments[${index}].imageUrl은 필수 문자열입니다.`);
      const imageUrl = optionalHttpsUrl(fragment.imageUrl, MAX_MESSAGE_LENGTH, `fragments[${index}].imageUrl`);
      if (!imageUrl.ok) return imageUrl;
      continue;
    }
    return fail(`fragments[${index}].type 값이 허용 목록에 없습니다.`);
  }
  return ok();
}

function integerInRange(value: unknown, min: number, max: number, fieldName: string): OverlayValidationResult {
  return Number.isInteger(value) && typeof value === "number" && value >= min && value <= max
    ? ok()
    : fail(`${fieldName}은 ${min} 이상 ${max} 이하의 정수여야 합니다.`);
}

function validateLolRankedStats(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!isRecord(value)) return fail(`${fieldName}는 객체여야 합니다.`);
  const keys = validateExactObjectKeys(value, [
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
  if (!keys.ok) return keys;
  const queueType = optionalExactString(value.queueType, LOL_RANK_QUEUES, `${fieldName}.queueType`);
  if (!queueType.ok) return queueType;
  if (typeof value.queueType !== "string") return fail(`${fieldName}.queueType은 필수입니다.`);
  const tier = optionalExactString(value.tier, LOL_RANK_TIERS, `${fieldName}.tier`);
  if (!tier.ok) return tier;
  if (typeof value.tier !== "string") return fail(`${fieldName}.tier는 필수입니다.`);
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
  const tierIconUrl = optionalString(value.tierIconUrl, MAX_MESSAGE_LENGTH, `${fieldName}.tierIconUrl`);
  if (!tierIconUrl.ok) return tierIconUrl;
  return nonEmptyString(value.fetchedAt, 64) ? ok() : fail(`${fieldName}.fetchedAt은 필수 문자열입니다.`);
}

function validateLolPerformanceStats(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!isRecord(value)) return fail(`${fieldName}는 객체여야 합니다.`);
  const keys = validateExactObjectKeys(value, ["sampleSize", "averageKills", "averageDeaths", "averageAssists", "kda"]);
  if (!keys.ok) return keys;
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

function validateLolRankHistory(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail(`${fieldName}은 배열이어야 합니다.`);
  if (value.length > MAX_RANK_HISTORY_POINTS) return fail(`${fieldName}은 최대 ${MAX_RANK_HISTORY_POINTS}개까지 허용됩니다.`);
  for (const [index, point] of value.entries()) {
    if (!isRecord(point)) return fail(`${fieldName}[${index}]은 객체여야 합니다.`);
    const keys = validateExactObjectKeys(point, ["date", "tier", "rank", "leaguePoints", "wins", "losses", "rankScore"]);
    if (!keys.ok) return keys;
    if (!nonEmptyString(point.date, 64)) return fail(`${fieldName}[${index}].date는 필수 문자열입니다.`);
    const tier = optionalExactString(point.tier, LOL_RANK_TIERS, `${fieldName}[${index}].tier`);
    if (!tier.ok) return tier;
    if (typeof point.tier !== "string") return fail(`${fieldName}[${index}].tier는 필수입니다.`);
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

function validateTopChampions(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail(`${fieldName}은 배열이어야 합니다.`);
  if (value.length > 3) return fail(`${fieldName}은 최대 3개까지 허용됩니다.`);
  for (const [index, champion] of value.entries()) {
    if (!isRecord(champion)) return fail(`${fieldName}[${index}]은 객체여야 합니다.`);
    const keys = validateExactObjectKeys(champion, [
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
    if (!keys.ok) return keys;
    const championId = integerInRange(champion.championId, 1, 10000, `${fieldName}[${index}].championId`);
    if (!championId.ok) return championId;
    const championKey = optionalString(champion.championKey, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].championKey`);
    if (!championKey.ok) return championKey;
    if (!nonEmptyString(champion.nameKo, MAX_SHORT_TEXT_LENGTH)) return fail(`${fieldName}[${index}].nameKo는 필수 문자열입니다.`);
    const nameJa = optionalString(champion.nameJa, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].nameJa`);
    if (!nameJa.ok) return nameJa;
    const iconUrl = optionalString(champion.iconUrl, MAX_MESSAGE_LENGTH, `${fieldName}[${index}].iconUrl`);
    if (!iconUrl.ok) return iconUrl;
    const splashUrl = optionalString(champion.splashUrl, MAX_MESSAGE_LENGTH, `${fieldName}[${index}].splashUrl`);
    if (!splashUrl.ok) return splashUrl;
    const loadingUrl = optionalString(champion.loadingUrl, MAX_MESSAGE_LENGTH, `${fieldName}[${index}].loadingUrl`);
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

function validateRecentMatchChampions(value: unknown, fieldName: string): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!Array.isArray(value)) return fail(`${fieldName}은 배열이어야 합니다.`);
  if (value.length > MAX_RECENT_MATCH_CHAMPIONS) return fail(`${fieldName}은 최대 ${MAX_RECENT_MATCH_CHAMPIONS}개까지 허용됩니다.`);
  for (const [index, champion] of value.entries()) {
    if (!isRecord(champion)) return fail(`${fieldName}[${index}]은 객체여야 합니다.`);
    const keys = validateExactObjectKeys(champion, [
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
    if (!keys.ok) return keys;
    const championId = integerInRange(champion.championId, 1, 10000, `${fieldName}[${index}].championId`);
    if (!championId.ok) return championId;
    const championKey = optionalString(champion.championKey, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].championKey`);
    if (!championKey.ok) return championKey;
    if (!nonEmptyString(champion.nameKo, MAX_SHORT_TEXT_LENGTH)) return fail(`${fieldName}[${index}].nameKo는 필수 문자열입니다.`);
    const nameJa = optionalString(champion.nameJa, MAX_SHORT_TEXT_LENGTH, `${fieldName}[${index}].nameJa`);
    if (!nameJa.ok) return nameJa;
    const iconUrl = optionalString(champion.iconUrl, MAX_MESSAGE_LENGTH, `${fieldName}[${index}].iconUrl`);
    if (!iconUrl.ok) return iconUrl;
    const splashUrl = optionalString(champion.splashUrl, MAX_MESSAGE_LENGTH, `${fieldName}[${index}].splashUrl`);
    if (!splashUrl.ok) return splashUrl;
    const loadingUrl = optionalString(champion.loadingUrl, MAX_MESSAGE_LENGTH, `${fieldName}[${index}].loadingUrl`);
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

function validateParticipationQueue(value: unknown): OverlayValidationResult {
  if (!Array.isArray(value)) return fail("queue는 배열이어야 합니다.");
  if (value.length > MAX_COLLECTION_SIZE) return fail(`queue는 최대 ${MAX_COLLECTION_SIZE}개까지 허용됩니다.`);
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) return fail(`queue[${index}]은 객체여야 합니다.`);
    const keys = validateExactObjectKeys(entry, [
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
    if (!keys.ok) return keys;
    if (!Number.isInteger(entry.position) || typeof entry.position !== "number" || entry.position < 1 || entry.position > 1000) {
      return fail(`queue[${index}].position은 1 이상 1000 이하의 정수여야 합니다.`);
    }
    if (!nonEmptyString(entry.twitchUserName, MAX_SHORT_TEXT_LENGTH)) return fail(`queue[${index}].twitchUserName은 필수 문자열입니다.`);
    const role = optionalString(entry.preferredRole, MAX_SHORT_TEXT_LENGTH, `queue[${index}].preferredRole`);
    if (!role.ok) return role;
    const requestedRole = optionalString(entry.requestedRole, MAX_SHORT_TEXT_LENGTH, `queue[${index}].requestedRole`);
    if (!requestedRole.ok) return requestedRole;
    const profileStatus = optionalExactString(entry.profileStatus, LOL_PROFILE_STATUSES, `queue[${index}].profileStatus`);
    if (!profileStatus.ok) return profileStatus;
    const mainRole = optionalExactString(entry.mainRole, LOL_MAIN_ROLES, `queue[${index}].mainRole`);
    if (!mainRole.ok) return mainRole;
    if (entry.mainRoleConfidence !== undefined) {
      const confidence = integerInRange(entry.mainRoleConfidence, 0, 100, `queue[${index}].mainRoleConfidence`);
      if (!confidence.ok) return confidence;
    }
    const topChampions = validateTopChampions(entry.topChampions, `queue[${index}].topChampions`);
    if (!topChampions.ok) return topChampions;
    if (!nonEmptyString(entry.status, MAX_SHORT_TEXT_LENGTH)) return fail(`queue[${index}].status는 필수 문자열입니다.`);
    const stats = validateLolRankedStats(entry.rankedStats, `queue[${index}].rankedStats`);
    if (!stats.ok) return stats;
  }
  return ok();
}

function validateParticipationStreamerProfile(value: unknown): OverlayValidationResult {
  if (value === undefined) return ok();
  if (!isRecord(value)) return fail("streamerProfile은 객체여야 합니다.");
  const keys = validateExactObjectKeys(value, [
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
  if (!keys.ok) return keys;
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

function validateParticipationSnapshotStatus(value: unknown): OverlayValidationResult {
  if (!isRecord(value)) return fail("status는 객체여야 합니다.");
  const keys = validateExactObjectKeys(value, ["isOpen", "mode", "phase", "message", "nextCandidate", "streamerProfile"]);
  if (!keys.ok) return keys;
  if (typeof value.isOpen !== "boolean") return fail("status.isOpen은 boolean이어야 합니다.");
  const mode = optionalExactString(value.mode, PARTICIPATION_MODES, "status.mode");
  if (!mode.ok) return mode;
  const phase = optionalExactString(value.phase, PARTICIPATION_PHASES, "status.phase");
  if (!phase.ok) return phase;
  const messageResult = optionalString(value.message, MAX_MESSAGE_LENGTH, "status.message");
  if (!messageResult.ok) return messageResult;
  if (value.nextCandidate !== undefined) {
    const nextCandidateResult = validateParticipationQueue([value.nextCandidate]);
    if (!nextCandidateResult.ok) return nextCandidateResult;
  }
  return validateParticipationStreamerProfile(value.streamerProfile);
}

function validateTeams(value: unknown): OverlayValidationResult {
  if (!isRecord(value)) return fail("teams는 객체여야 합니다.");
  const keys = validateExactObjectKeys(value, ["a", "b"]);
  if (!keys.ok) return keys;
  for (const teamName of ["a", "b"] as const) {
    const team = value[teamName];
    if (!Array.isArray(team)) return fail(`teams.${teamName}은 배열이어야 합니다.`);
    if (team.length > 5) return fail(`teams.${teamName}은 최대 5명까지 표시합니다.`);
    for (const [index, player] of team.entries()) {
      if (!isRecord(player)) return fail(`teams.${teamName}[${index}]은 객체여야 합니다.`);
      const playerKeys = validateExactObjectKeys(player, ["twitchUserName", "preferredRole"]);
      if (!playerKeys.ok) return playerKeys;
      if (!nonEmptyString(player.twitchUserName, MAX_SHORT_TEXT_LENGTH)) {
        return fail(`teams.${teamName}[${index}].twitchUserName은 필수 문자열입니다.`);
      }
      const role = optionalString(player.preferredRole, MAX_SHORT_TEXT_LENGTH, `teams.${teamName}[${index}].preferredRole`);
      if (!role.ok) return role;
    }
  }
  return ok();
}

function validateExactObjectKeys(candidate: Record<string, unknown>, allowedKeys: readonly string[]): OverlayValidationResult {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) return fail(`허용되지 않는 객체 필드입니다: ${key}`);
  }
  return ok();
}

export function isOverlayChannel(value: string | null | undefined): value is OverlayChannel {
  return typeof value === "string" && (OVERLAY_CHANNELS as readonly string[]).includes(value);
}

export function normalizeOverlayChannel(value: string | null | undefined): OverlayChannel {
  return isOverlayChannel(value) ? value : "all";
}

export function overlayChannelForMessage(message: OverlayMessage): OverlayChannel {
  if (message.type === "subtitle.update" || message.type === "subtitle.boost") return "subtitles";
  if (message.type === "question.show" || message.type === "question.clear") return "questions";
  if (message.type === "chat.message.add" || message.type === "chat.clear") return "chat";
  if (message.type === "mission.update") return "mission";
  if (message.type.startsWith("participation.")) return "participation";
  if (message.type.startsWith("solo-rank.")) return "solo-rank";
  return "events";
}

export function overlayMessageMatchesChannel(message: OverlayMessage, channel: OverlayChannel): boolean {
  return channel === "all" || overlayChannelForMessage(message) === channel;
}

export function validateOverlayMessage(message: unknown): OverlayValidationResult {
  if (!isRecord(message)) return fail("overlay message는 객체여야 합니다.");
  if (!nonEmptyString(message.type, MAX_SHORT_TEXT_LENGTH)) return fail("overlay message type은 필수 문자열입니다.");

  switch (message.type) {
    case "overlay.banner": {
      const keys = validateKeys(message, [
        "title",
        "subtitle",
        "message",
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
      ]);
      if (!keys.ok) return keys;
      const title = optionalString(message.title, MAX_SHORT_TEXT_LENGTH, "title");
      if (!title.ok) return title;
      const subtitle = optionalString(message.subtitle, MAX_SHORT_TEXT_LENGTH, "subtitle");
      if (!subtitle.ok) return subtitle;
      if (!nonEmptyString(message.message, MAX_MESSAGE_LENGTH)) return fail("message는 필수 문자열입니다.");
      const eventKind = optionalExactString(message.eventKind, OVERLAY_BANNER_EVENT_KINDS, "eventKind");
      if (!eventKind.ok) return eventKind;
      const mediaUrl = optionalOverlayAssetUrl(message.mediaUrl, MAX_MESSAGE_LENGTH, "mediaUrl");
      if (!mediaUrl.ok) return mediaUrl;
      const mediaAlt = optionalString(message.mediaAlt, MAX_SHORT_TEXT_LENGTH, "mediaAlt");
      if (!mediaAlt.ok) return mediaAlt;
      const soundUrl = optionalOverlayAssetUrl(message.soundUrl, MAX_MESSAGE_LENGTH, "soundUrl");
      if (!soundUrl.ok) return soundUrl;
      const soundVolume = optionalUnitNumber(message.soundVolume, "soundVolume");
      if (!soundVolume.ok) return soundVolume;
      const speechEnabled = optionalBoolean(message.speechEnabled, "speechEnabled");
      if (!speechEnabled.ok) return speechEnabled;
      const speechText = optionalString(message.speechText, MAX_MESSAGE_LENGTH, "speechText");
      if (!speechText.ok) return speechText;
      const speechAudioUrl = optionalOverlayAssetUrl(message.speechAudioUrl, MAX_MESSAGE_LENGTH, "speechAudioUrl");
      if (!speechAudioUrl.ok) return speechAudioUrl;
      const speechLanguage = optionalExactString(message.speechLanguage, OVERLAY_SPEECH_LANGUAGES, "speechLanguage");
      if (!speechLanguage.ok) return speechLanguage;
      const speechRate = optionalNumberInRange(message.speechRate, 0.5, 1.5, "speechRate");
      if (!speechRate.ok) return speechRate;
      const speechPitch = optionalNumberInRange(message.speechPitch, 0.5, 1.5, "speechPitch");
      if (!speechPitch.ok) return speechPitch;
      return optionalUnitNumber(message.speechVolume, "speechVolume");
    }
    case "subtitle.update": {
      const keys = validateKeys(message, ["sourceLanguage", "targetLanguage", "original", "translated", "isFinal"]);
      if (!keys.ok) return keys;
      const source = optionalExactString(message.sourceLanguage, LANGUAGE_CODES, "sourceLanguage");
      if (!source.ok) return source;
      const target = optionalExactString(message.targetLanguage, LANGUAGE_CODES, "targetLanguage");
      if (!target.ok) return target;
      if (!nonEmptyString(message.sourceLanguage, 2) || !nonEmptyString(message.targetLanguage, 2)) return fail("subtitle 언어 코드는 필수입니다.");
      const original = optionalString(message.original, MAX_LONG_TEXT_LENGTH, "original");
      if (!original.ok) return original;
      if (!nonEmptyString(message.translated, MAX_LONG_TEXT_LENGTH)) return fail("translated는 필수 문자열입니다.");
      return typeof message.isFinal === "boolean" ? ok() : fail("isFinal은 boolean이어야 합니다.");
    }
    case "subtitle.boost": {
      const keys = validateKeys(message, ["title", "message"]);
      if (!keys.ok) return keys;
      const title = optionalString(message.title, MAX_SHORT_TEXT_LENGTH, "title");
      if (!title.ok) return title;
      return optionalString(message.message, MAX_MESSAGE_LENGTH, "message");
    }
    case "question.show": {
      const keys = validateKeys(message, ["userName", "question", "translatedQuestion"]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(message.userName, MAX_SHORT_TEXT_LENGTH)) return fail("userName은 필수 문자열입니다.");
      if (!nonEmptyString(message.question, MAX_LONG_TEXT_LENGTH)) return fail("question은 필수 문자열입니다.");
      return optionalString(message.translatedQuestion, MAX_LONG_TEXT_LENGTH, "translatedQuestion");
    }
    case "question.clear": {
      return validateKeys(message, []);
    }
    case "chat.message.add": {
      const keys = validateKeys(message, [
        "id",
        "userName",
        "profileImageUrl",
        "message",
        "fragments",
        "translatedMessage",
        "translationSourceLanguage",
        "translationTargetLanguage",
        "createdAt",
        "isBroadcaster"
      ]);
      if (!keys.ok) return keys;
      const id = optionalString(message.id, MAX_SHORT_TEXT_LENGTH, "id");
      if (!id.ok) return id;
      if (!nonEmptyString(message.userName, MAX_SHORT_TEXT_LENGTH)) return fail("userName은 필수 문자열입니다.");
      const profileImageUrl = optionalHttpsUrl(message.profileImageUrl, MAX_MESSAGE_LENGTH, "profileImageUrl");
      if (!profileImageUrl.ok) return profileImageUrl;
      if (!nonEmptyString(message.message, MAX_MESSAGE_LENGTH)) return fail("message는 필수 문자열입니다.");
      const fragments = validateChatFragments(message.fragments);
      if (!fragments.ok) return fragments;
      const translatedMessage = optionalString(message.translatedMessage, MAX_MESSAGE_LENGTH, "translatedMessage");
      if (!translatedMessage.ok) return translatedMessage;
      if (message.translatedMessage !== undefined && !nonEmptyString(message.translatedMessage, MAX_MESSAGE_LENGTH)) {
        return fail("translatedMessage는 비어 있지 않은 문자열이어야 합니다.");
      }
      const translationSource = optionalExactString(message.translationSourceLanguage, LANGUAGE_CODES, "translationSourceLanguage");
      if (!translationSource.ok) return translationSource;
      const translationTarget = optionalExactString(message.translationTargetLanguage, LANGUAGE_CODES, "translationTargetLanguage");
      if (!translationTarget.ok) return translationTarget;
      if (message.translatedMessage !== undefined && (!message.translationSourceLanguage || !message.translationTargetLanguage)) {
        return fail("translatedMessage가 있으면 translationSourceLanguage와 translationTargetLanguage가 필요합니다.");
      }
      const createdAt = optionalString(message.createdAt, MAX_SHORT_TEXT_LENGTH, "createdAt");
      if (!createdAt.ok) return createdAt;
      return message.isBroadcaster === undefined || typeof message.isBroadcaster === "boolean"
        ? ok()
        : fail("isBroadcaster는 boolean이어야 합니다.");
    }
    case "chat.clear": {
      return validateKeys(message, []);
    }
    case "mission.update": {
      const keys = validateKeys(message, ["title", "missions"]);
      if (!keys.ok) return keys;
      const title = optionalString(message.title, MAX_SHORT_TEXT_LENGTH, "title");
      if (!title.ok) return title;
      return validateMissionList(message.missions);
    }
    case "participation.queue.update": {
      const keys = validateKeys(message, ["streamerId", "sessionId", "revision", "isOpen", "queue"]);
      if (!keys.ok) return keys;
      const streamerId = optionalString(message.streamerId, MAX_SHORT_TEXT_LENGTH, "streamerId");
      if (!streamerId.ok) return streamerId;
      const sessionId = optionalString(message.sessionId, MAX_SHORT_TEXT_LENGTH, "sessionId");
      if (!sessionId.ok) return sessionId;
      if (message.revision !== undefined) {
        const revision = integerInRange(message.revision, 1, Number.MAX_SAFE_INTEGER, "revision");
        if (!revision.ok) return revision;
      }
      if (message.isOpen !== undefined && typeof message.isOpen !== "boolean") return fail("isOpen은 boolean이어야 합니다.");
      return validateParticipationQueue(message.queue);
    }
    case "participation.status.update": {
      const keys = validateKeys(message, ["streamerId", "sessionId", "revision", "isOpen", "mode", "phase", "message", "nextCandidate", "streamerProfile"]);
      if (!keys.ok) return keys;
      const streamerId = optionalString(message.streamerId, MAX_SHORT_TEXT_LENGTH, "streamerId");
      if (!streamerId.ok) return streamerId;
      const sessionId = optionalString(message.sessionId, MAX_SHORT_TEXT_LENGTH, "sessionId");
      if (!sessionId.ok) return sessionId;
      if (message.revision !== undefined) {
        const revision = integerInRange(message.revision, 1, Number.MAX_SAFE_INTEGER, "revision");
        if (!revision.ok) return revision;
      }
      if (typeof message.isOpen !== "boolean") return fail("isOpen은 boolean이어야 합니다.");
      const mode = optionalExactString(message.mode, PARTICIPATION_MODES, "mode");
      if (!mode.ok) return mode;
      const phase = optionalExactString(message.phase, PARTICIPATION_PHASES, "phase");
      if (!phase.ok) return phase;
      const messageResult = optionalString(message.message, MAX_MESSAGE_LENGTH, "message");
      if (!messageResult.ok) return messageResult;
      if (message.nextCandidate !== undefined) {
        const nextCandidateResult = validateParticipationQueue([message.nextCandidate]);
        if (!nextCandidateResult.ok) return nextCandidateResult;
      }
      return validateParticipationStreamerProfile(message.streamerProfile);
    }
    case "participation.snapshot.update": {
      const keys = validateKeys(message, ["streamerId", "sessionId", "revision", "status", "queue", "emittedAt", "traceId"]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(message.streamerId, MAX_SHORT_TEXT_LENGTH)) return fail("streamerId는 필수 문자열입니다.");
      if (!nonEmptyString(message.sessionId, MAX_SHORT_TEXT_LENGTH)) return fail("sessionId는 필수 문자열입니다.");
      const revision = integerInRange(message.revision, 1, Number.MAX_SAFE_INTEGER, "revision");
      if (!revision.ok) return revision;
      const status = validateParticipationSnapshotStatus(message.status);
      if (!status.ok) return status;
      const queue = validateParticipationQueue(message.queue);
      if (!queue.ok) return queue;
      if (!nonEmptyString(message.emittedAt, MAX_SHORT_TEXT_LENGTH)) return fail("emittedAt은 필수 문자열입니다.");
      return optionalString(message.traceId, MAX_SHORT_TEXT_LENGTH, "traceId");
    }
    case "solo-rank.profile.update": {
      const keys = validateKeys(message, ["profile", "region", "queueLabel", "ladderRank"]);
      if (!keys.ok) return keys;
      if (!isRecord(message.profile)) return fail("profile은 객체여야 합니다.");
      const profile = validateParticipationStreamerProfile(message.profile);
      if (!profile.ok) return profile;
      const region = optionalString(message.region, MAX_SHORT_TEXT_LENGTH, "region");
      if (!region.ok) return region;
      const queueLabel = optionalString(message.queueLabel, MAX_SHORT_TEXT_LENGTH, "queueLabel");
      if (!queueLabel.ok) return queueLabel;
      if (message.ladderRank !== undefined) return integerInRange(message.ladderRank, 1, 10000000, "ladderRank");
      return ok();
    }
    case "participation.selected.show": {
      const keys = validateKeys(message, [
        "twitchUserName",
        "preferredRole",
        "checkInSeconds",
        "profileStatus",
        "mainRole",
        "mainRoleConfidence",
        "topChampions",
        "rankedStats"
      ]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(message.twitchUserName, MAX_SHORT_TEXT_LENGTH)) return fail("twitchUserName은 필수 문자열입니다.");
      const role = optionalString(message.preferredRole, MAX_SHORT_TEXT_LENGTH, "preferredRole");
      if (!role.ok) return role;
      const profileStatus = optionalExactString(message.profileStatus, LOL_PROFILE_STATUSES, "profileStatus");
      if (!profileStatus.ok) return profileStatus;
      const mainRole = optionalExactString(message.mainRole, LOL_MAIN_ROLES, "mainRole");
      if (!mainRole.ok) return mainRole;
      if (message.mainRoleConfidence !== undefined) {
        const confidence = integerInRange(message.mainRoleConfidence, 0, 100, "mainRoleConfidence");
        if (!confidence.ok) return confidence;
      }
      const topChampions = validateTopChampions(message.topChampions, "topChampions");
      if (!topChampions.ok) return topChampions;
      const checkInSeconds = integerInRange(message.checkInSeconds, 1, 3600, "checkInSeconds");
      if (!checkInSeconds.ok) return checkInSeconds;
      return validateLolRankedStats(message.rankedStats, "rankedStats");
    }
    case "participation.selected.clear": {
      return validateKeys(message, []);
    }
    case "participation.teams.update": {
      const keys = validateKeys(message, ["teams"]);
      if (!keys.ok) return keys;
      return validateTeams(message.teams);
    }
    case "emergency.show": {
      const keys = validateKeys(message, ["title", "message"]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(message.title, MAX_SHORT_TEXT_LENGTH)) return fail("title은 필수 문자열입니다.");
      return nonEmptyString(message.message, MAX_MESSAGE_LENGTH) ? ok() : fail("message는 필수 문자열입니다.");
    }
    case "emergency.clear": {
      return validateKeys(message, []);
    }
    default:
      return fail(`허용되지 않은 overlay message type입니다: ${String(message.type)}`);
  }
}

export const ALLOWED_ACTION_TYPES = [
  "twitch.chat",
  "queue.question",
  "log.highlight",
  "participation.open",
  "participation.close",
  "noop"
] as const;

export const FORBIDDEN_ACTION_TYPES = [
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
  "obs.",
  "overlay.",
  "shell.",
  "file.",
  "browser.",
  "process.",
  "child_process.",
  "fs.",
  "url."
] as const;

export type AllowedActionType = (typeof ALLOWED_ACTION_TYPES)[number];

export type TwitchChatAction = {
  type: "twitch.chat";
  message: string;
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
  | TwitchChatAction
  | QueueQuestionAction
  | LogHighlightAction
  | ParticipationOpenAction
  | ParticipationCloseAction
  | NoopAction;

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const PARTICIPATION_MODES = ["normal5", "custom5v5", "aram", "onevone"] as const;
const MAX_NAME_LENGTH = 128;
const MAX_CHAT_LENGTH = 500;
const MAX_LONG_TEXT_LENGTH = 1000;

export function isAllowedActionType(type: string): type is AllowedActionType {
  return (ALLOWED_ACTION_TYPES as readonly string[]).includes(type);
}

export function isForbiddenActionType(type: string): boolean {
  return (
    (FORBIDDEN_ACTION_TYPES as readonly string[]).includes(type)
    || (FORBIDDEN_ACTION_PREFIXES as readonly string[]).some((prefix) => type.startsWith(prefix))
  );
}

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

function ok(): ValidationResult {
  return { ok: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringWithin(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function nonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function optionalString(value: unknown, maxLength: number, fieldName: string): ValidationResult {
  if (value === undefined) return ok();
  return stringWithin(value, maxLength)
    ? ok()
    : fail(`${fieldName}은 ${maxLength}자 이하 문자열이어야 합니다.`);
}

function validateKeys(candidate: Record<string, unknown>, allowedKeys: readonly string[]): ValidationResult {
  const allowed = new Set(["type", ...allowedKeys]);
  for (const key of Object.keys(candidate)) {
    if (!allowed.has(key)) return fail(`허용되지 않는 action 필드입니다: ${key}`);
  }
  return ok();
}

export function validateBotAction(action: unknown): ValidationResult {
  if (!isRecord(action)) return fail("action은 객체여야 합니다.");
  const candidate = action as { type?: unknown } & Record<string, unknown>;
  if (!nonEmptyString(candidate.type, MAX_NAME_LENGTH)) return fail("action.type은 필수 문자열입니다.");
  if (isForbiddenActionType(candidate.type)) return fail(`금지된 action type입니다: ${candidate.type}`);
  if (!isAllowedActionType(candidate.type)) return fail(`허용되지 않은 action type입니다: ${candidate.type}`);

  switch (candidate.type) {
    case "twitch.chat": {
      const keys = validateKeys(candidate, ["message"]);
      if (!keys.ok) return keys;
      return nonEmptyString(candidate.message, MAX_CHAT_LENGTH)
        ? ok()
        : fail("message는 필수 문자열입니다.");
    }
    case "queue.question": {
      const keys = validateKeys(candidate, ["question", "userName", "translatedQuestion"]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(candidate.question, MAX_LONG_TEXT_LENGTH)) {
        return fail("question은 필수 문자열입니다.");
      }
      const user = optionalString(candidate.userName, MAX_NAME_LENGTH, "userName");
      return user.ok
        ? optionalString(candidate.translatedQuestion, MAX_LONG_TEXT_LENGTH, "translatedQuestion")
        : user;
    }
    case "log.highlight": {
      const keys = validateKeys(candidate, ["reason", "userName"]);
      if (!keys.ok) return keys;
      if (!nonEmptyString(candidate.reason, MAX_CHAT_LENGTH)) return fail("reason은 필수 문자열입니다.");
      return optionalString(candidate.userName, MAX_NAME_LENGTH, "userName");
    }
    case "participation.open": {
      const keys = validateKeys(candidate, ["mode", "requiredPlayers"]);
      if (!keys.ok) return keys;
      if (
        candidate.mode !== undefined
        && (typeof candidate.mode !== "string" || !PARTICIPATION_MODES.includes(candidate.mode as typeof PARTICIPATION_MODES[number]))
      ) return fail("mode 값이 허용 목록에 없습니다.");
      if (candidate.requiredPlayers === undefined) return ok();
      return Number.isInteger(candidate.requiredPlayers)
        && typeof candidate.requiredPlayers === "number"
        && candidate.requiredPlayers >= 1
        && candidate.requiredPlayers <= 10
        ? ok()
        : fail("requiredPlayers는 1 이상 10 이하의 정수여야 합니다.");
    }
    case "participation.close":
      return validateKeys(candidate, []);
    case "noop": {
      const keys = validateKeys(candidate, ["note"]);
      return keys.ok ? optionalString(candidate.note, MAX_CHAT_LENGTH, "note") : keys;
    }
  }
}

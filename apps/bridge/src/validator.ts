import type { BridgeCommand, BotAction } from "@streamops/shared";
import { isObsAction, validateBotAction } from "@streamops/shared";

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function validateBridgeCommand(input: unknown): { ok: true; command: BridgeCommand } | { ok: false; error: string } {
  const result = validateBotAction(input, { allowMetadata: true });
  if (!result.ok) return result;

  const candidate = input as BridgeCommand;
  if (!isObsAction(candidate as BotAction)) return { ok: false, error: "bridge는 obs.* command만 허용합니다." };
  if (!nonEmptyString(candidate.id)) return { ok: false, error: "command.id는 필수 문자열입니다." };
  if (!nonEmptyString(candidate.createdAt) || !isIsoDateString(candidate.createdAt)) {
    return { ok: false, error: "command.createdAt은 유효한 ISO 날짜 문자열이어야 합니다." };
  }

  return { ok: true, command: candidate };
}

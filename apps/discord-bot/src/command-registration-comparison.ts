type DiscordCommandShape = {
  name: string;
  description?: string;
  description_localizations?: unknown;
  options?: unknown;
  default_member_permissions?: string | null;
  dm_permission?: boolean | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNestedValue(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return undefined;
  if (value === false && (key === "required" || key === "autocomplete")) {
    return undefined;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeNestedValue(entry))
      .filter((entry) => entry !== undefined);
    return normalized.length > 0 ? normalized : undefined;
  }
  if (!isRecord(value)) return value;

  const normalized = Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((result, [entryKey, entryValue]) => {
      const normalizedValue = normalizeNestedValue(entryValue, entryKey);
      if (normalizedValue !== undefined) result[entryKey] = normalizedValue;
      return result;
    }, {});
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/**
 * Discord REST가 채워 넣는 null·기본값 필드를 제거하고 실제 명령 의미만 비교합니다.
 */
export function comparableDiscordCommand(command: DiscordCommandShape) {
  return {
    name: command.name,
    description: command.description ?? null,
    description_localizations:
      normalizeNestedValue(command.description_localizations) ?? null,
    options: normalizeNestedValue(command.options) ?? [],
    default_member_permissions: command.default_member_permissions ?? null,
    dm_permission: command.dm_permission ?? true
  };
}

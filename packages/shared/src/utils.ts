export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = "id"): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|passwd|api[_-]?key|client[_-]?secret|stream[_-]?key|shared[_-]?secret|obs[_-]?password)/i;
const SENSITIVE_ASSIGNMENT_PATTERN = /\b((?:access[_-]?token|refresh[_-]?token|token|secret|password|passwd|api[_-]?key|client[_-]?secret|stream[_-]?key)=)[^&\s]+/gi;
const SENSITIVE_QUERY_PATTERN = /([?&](?:access_token|refresh_token|token|secret|password|api_key|client_secret|stream_key)=)[^&\s]+/gi;
const BEARER_PATTERN = /\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const OAUTH_PATTERN = /\b(oauth:)[A-Za-z0-9._~+/=-]+/gi;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(BEARER_PATTERN, `$1${REDACTED}`)
    .replace(OAUTH_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_QUERY_PATTERN, `$1${REDACTED}`)
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, `$1${REDACTED}`);
}

export function redactSensitiveValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactSensitiveString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message)
    };
  }
  if (typeof value !== "object") return value;

  if (seen.has(value)) return "[Circular]";
  if (depth >= 6) return "[Truncated]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item, seen, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactSensitiveValue(nested, seen, depth + 1);
  }
  return output;
}

export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) return redactSensitiveString(error.message || error.name);
  return redactSensitiveString(String(error));
}

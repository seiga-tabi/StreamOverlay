export const PALWORLD_SERVER_CONNECTION_STATES = [
  "not_configured",
  "checking",
  "online",
  "degraded",
  "auth_failed",
  "unreachable",
  "tls_failed",
  "invalid_response",
  "stale",
  "blocked_by_policy"
] as const;

export const PALWORLD_SERVER_ERROR_CODES = [
  "disabled",
  "config_missing",
  "config_invalid",
  "key_missing",
  "key_invalid",
  "policy_missing",
  "not_configured",
  "invalid_request",
  "invalid_url",
  "password_required",
  "origin_not_allowed",
  "address_blocked",
  "dns_failed",
  "connection_failed",
  "request_timeout",
  "tls_failed",
  "auth_failed",
  "redirect_blocked",
  "unexpected_status",
  "invalid_content_type",
  "response_too_large",
  "invalid_json",
  "invalid_schema",
  "rate_limited",
  "internal_error"
] as const;

export const PALWORLD_SERVER_AVAILABILITY_ERROR_CODES = [
  "disabled",
  "config_missing",
  "config_invalid",
  "key_missing",
  "key_invalid",
  "policy_missing"
] as const satisfies readonly (typeof PALWORLD_SERVER_ERROR_CODES)[number][];

export const PALWORLD_SERVER_DIAGNOSTIC_KEYS = [
  "url_policy",
  "dns_tcp",
  "tls",
  "basic_auth",
  "info",
  "metrics",
  "schema"
] as const;

export const PALWORLD_SERVER_DIAGNOSTIC_STATES = ["pending", "passed", "failed", "skipped"] as const;

export type PalworldServerConnectionState = (typeof PALWORLD_SERVER_CONNECTION_STATES)[number];
export type PalworldServerErrorCode = (typeof PALWORLD_SERVER_ERROR_CODES)[number];
export type PalworldServerAvailabilityErrorCode = (typeof PALWORLD_SERVER_AVAILABILITY_ERROR_CODES)[number];
export type PalworldServerDiagnosticKey = (typeof PALWORLD_SERVER_DIAGNOSTIC_KEYS)[number];
export type PalworldServerDiagnosticState = (typeof PALWORLD_SERVER_DIAGNOSTIC_STATES)[number];

export type PalworldServerConnectionInput = {
  baseUrl: string;
  adminPassword?: string;
};

export type PalworldServerConnectionSummary = {
  configured: boolean;
  baseUrl?: string;
  passwordConfigured: boolean;
  updatedAt?: string;
};

export type PalworldRestInfoResponse = {
  version: string;
  servername: string;
  description: string;
  worldguid: string;
};

export type PalworldRestMetricsResponse = {
  serverfps: number;
  currentplayernum: number;
  serverframetime: number;
  maxplayernum: number;
  uptime: number;
  basecampnum: number;
  days: number;
};

export type PalworldServerInfo = {
  serverName: string;
  version: string;
};

export type PalworldServerMetrics = {
  serverFps: number;
  currentPlayers: number;
  maxPlayers: number;
  frameTimeMs: number;
  uptimeSeconds: number;
  baseCampCount: number;
  gameDays: number;
};

export type PalworldServerDiagnostic = {
  key: PalworldServerDiagnosticKey;
  state: PalworldServerDiagnosticState;
  errorCode?: PalworldServerErrorCode;
};

export type PalworldServerStatus = {
  state: PalworldServerConnectionState;
  errorCode?: PalworldServerErrorCode;
  checkedAt?: string;
  lastSuccessAt?: string;
  latencyMs?: number;
  consecutiveFailures: number;
  info?: PalworldServerInfo;
  metrics?: PalworldServerMetrics;
  diagnostics: PalworldServerDiagnostic[];
};

export type PalworldServerTestResponse = {
  connection: PalworldServerConnectionSummary;
  status: PalworldServerStatus;
};

export type PalworldServerRegistrationPolicy = {
  publicHttpsSelfService: boolean;
  publicHttpsPort: 443;
  privateNetworkRequiresOperatorApproval: true;
};

export const PALWORLD_SERVER_SAFE_REGISTRATION_POLICY: Readonly<PalworldServerRegistrationPolicy> = Object.freeze({
  publicHttpsSelfService: false,
  publicHttpsPort: 443,
  privateNetworkRequiresOperatorApproval: true
});

export type PalworldServerDashboardResponse = PalworldServerTestResponse & {
  enabled: boolean;
  pollIntervalSeconds: number;
  registrationPolicy: PalworldServerRegistrationPolicy;
};

export type PalworldServerValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const MAX_URL_LENGTH = 2_048;
const MAX_PASSWORD_LENGTH = 256;
const MAX_SERVER_NAME_LENGTH = 256;
const MAX_VERSION_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 4_000;
const MAX_WORLD_GUID_LENGTH = 128;
const MAX_SERVER_FPS = 10_000;
const MAX_PLAYER_COUNT = 1_000_000;
const MAX_FRAME_TIME_MS = 60_000;
const MAX_UPTIME_SECONDS = 10_000_000_000;
const MAX_BASE_CAMP_COUNT = 100_000_000;
const MAX_GAME_DAYS = 100_000_000;
const MAX_LATENCY_MS = 300_000;
const MAX_CONSECUTIVE_FAILURES = 1_000_000;
const MIN_POLL_INTERVAL_SECONDS = 5;
const MAX_POLL_INTERVAL_SECONDS = 86_400;

function valid<T>(data: T): PalworldServerValidationResult<T> {
  return { ok: true, data };
}

function invalid<T>(path: string, message: string): PalworldServerValidationResult<T> {
  return { ok: false, error: `${path}: ${message}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordAt(
  value: unknown,
  path: string,
  allowedKeys: readonly string[]
): PalworldServerValidationResult<Record<string, unknown>> {
  if (!isRecord(value)) return invalid(path, "객체여야 합니다.");
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return invalid(`${path}.${key}`, "허용되지 않은 필드입니다.");
  }
  return valid(value);
}

function stringAt(
  value: unknown,
  path: string,
  maxLength: number,
  allowEmpty = false
): PalworldServerValidationResult<string> {
  if (typeof value !== "string") return invalid(path, "문자열이어야 합니다.");
  if (!allowEmpty && value.trim().length === 0) return invalid(path, "비어 있지 않은 문자열이어야 합니다.");
  if (value.length > maxLength) return invalid(path, `${maxLength}자 이하여야 합니다.`);
  return valid(value);
}

function optionalStringAt(
  value: unknown,
  path: string,
  maxLength: number
): PalworldServerValidationResult<string | undefined> {
  return value === undefined ? valid(undefined) : stringAt(value, path, maxLength);
}

function booleanAt(value: unknown, path: string): PalworldServerValidationResult<boolean> {
  return typeof value === "boolean" ? valid(value) : invalid(path, "boolean이어야 합니다.");
}

function finiteNumberAt(
  value: unknown,
  path: string,
  min: number,
  max: number
): PalworldServerValidationResult<number> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return invalid(path, `${min} 이상 ${max} 이하의 유한한 숫자여야 합니다.`);
  }
  return valid(value);
}

function integerAt(
  value: unknown,
  path: string,
  min: number,
  max: number
): PalworldServerValidationResult<number> {
  const number = finiteNumberAt(value, path, min, max);
  if (!number.ok) return number;
  return Number.isSafeInteger(number.data) ? valid(number.data) : invalid(path, "안전한 정수여야 합니다.");
}

function enumAt<T extends readonly string[]>(
  value: unknown,
  path: string,
  values: T
): PalworldServerValidationResult<T[number]> {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    return invalid(path, "허용 목록에 없는 값입니다.");
  }
  return valid(value as T[number]);
}

function isoDateAt(value: unknown, path: string): PalworldServerValidationResult<string> {
  const text = stringAt(value, path, 64);
  if (!text.ok) return text;
  const parsed = Date.parse(text.data);
  return Number.isFinite(parsed) ? text : invalid(path, "올바른 날짜 문자열이어야 합니다.");
}

function optionalIsoDateAt(value: unknown, path: string): PalworldServerValidationResult<string | undefined> {
  return value === undefined ? valid(undefined) : isoDateAt(value, path);
}

function baseUrlAt(value: unknown, path: string): PalworldServerValidationResult<string> {
  const text = stringAt(value, path, MAX_URL_LENGTH);
  if (!text.ok) return text;
  try {
    const parsed = new URL(text.data);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return invalid(path, "http 또는 https URL이어야 합니다.");
    }
    if (parsed.username.length > 0 || parsed.password.length > 0) {
      return invalid(path, "사용자 정보가 포함된 URL은 허용되지 않습니다.");
    }
    if (parsed.search.length > 0 || parsed.hash.length > 0) {
      return invalid(path, "query 또는 fragment가 포함된 URL은 허용되지 않습니다.");
    }
    if (parsed.pathname !== "/") {
      return invalid(path, "경로가 없는 base URL이어야 합니다.");
    }
    return text;
  } catch {
    return invalid(path, "올바른 URL이어야 합니다.");
  }
}

function validateConnectionInputAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldServerConnectionInput> {
  const record = recordAt(value, path, ["baseUrl", "adminPassword"]);
  if (!record.ok) return record;
  const baseUrl = baseUrlAt(record.data.baseUrl, `${path}.baseUrl`);
  if (!baseUrl.ok) return baseUrl;
  if (record.data.adminPassword !== undefined) {
    const password = stringAt(record.data.adminPassword, `${path}.adminPassword`, MAX_PASSWORD_LENGTH);
    if (!password.ok) return password;
  }
  return valid(record.data as PalworldServerConnectionInput);
}

function validateConnectionSummaryAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldServerConnectionSummary> {
  const record = recordAt(value, path, ["configured", "baseUrl", "passwordConfigured", "updatedAt"]);
  if (!record.ok) return record;
  const configured = booleanAt(record.data.configured, `${path}.configured`);
  if (!configured.ok) return configured;
  const passwordConfigured = booleanAt(record.data.passwordConfigured, `${path}.passwordConfigured`);
  if (!passwordConfigured.ok) return passwordConfigured;
  if (record.data.baseUrl !== undefined) {
    const baseUrl = baseUrlAt(record.data.baseUrl, `${path}.baseUrl`);
    if (!baseUrl.ok) return baseUrl;
  }
  const updatedAt = optionalIsoDateAt(record.data.updatedAt, `${path}.updatedAt`);
  if (!updatedAt.ok) return updatedAt;
  if (configured.data && record.data.baseUrl === undefined) {
    return invalid(`${path}.baseUrl`, "저장된 연결에는 baseUrl이 필요합니다.");
  }
  if (configured.data && !passwordConfigured.data) {
    return invalid(`${path}.passwordConfigured`, "저장된 연결에는 비밀번호 설정 상태가 필요합니다.");
  }
  if (configured.data && updatedAt.data === undefined) {
    return invalid(`${path}.updatedAt`, "저장된 연결에는 갱신 시각이 필요합니다.");
  }
  if (!configured.data && updatedAt.data !== undefined) {
    return invalid(`${path}.updatedAt`, "저장되지 않은 연결에는 갱신 시각을 포함할 수 없습니다.");
  }
  if (passwordConfigured.data && record.data.baseUrl === undefined) {
    return invalid(`${path}.baseUrl`, "비밀번호 설정 상태에는 baseUrl이 필요합니다.");
  }
  return valid(record.data as PalworldServerConnectionSummary);
}

function validateRestInfoAt(value: unknown, path: string): PalworldServerValidationResult<PalworldRestInfoResponse> {
  const record = recordAt(value, path, ["version", "servername", "description", "worldguid"]);
  if (!record.ok) return record;
  const version = stringAt(record.data.version, `${path}.version`, MAX_VERSION_LENGTH);
  if (!version.ok) return version;
  const serverName = stringAt(record.data.servername, `${path}.servername`, MAX_SERVER_NAME_LENGTH);
  if (!serverName.ok) return serverName;
  const description = stringAt(record.data.description, `${path}.description`, MAX_DESCRIPTION_LENGTH, true);
  if (!description.ok) return description;
  const worldGuid = stringAt(record.data.worldguid, `${path}.worldguid`, MAX_WORLD_GUID_LENGTH);
  return worldGuid.ok ? valid(record.data as PalworldRestInfoResponse) : worldGuid;
}

function validateRestMetricsAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldRestMetricsResponse> {
  const record = recordAt(value, path, [
    "serverfps",
    "currentplayernum",
    "serverframetime",
    "maxplayernum",
    "uptime",
    "basecampnum",
    "days"
  ]);
  if (!record.ok) return record;
  const serverFps = integerAt(record.data.serverfps, `${path}.serverfps`, 0, MAX_SERVER_FPS);
  if (!serverFps.ok) return serverFps;
  const currentPlayers = integerAt(record.data.currentplayernum, `${path}.currentplayernum`, 0, MAX_PLAYER_COUNT);
  if (!currentPlayers.ok) return currentPlayers;
  const frameTime = finiteNumberAt(record.data.serverframetime, `${path}.serverframetime`, 0, MAX_FRAME_TIME_MS);
  if (!frameTime.ok) return frameTime;
  const maxPlayers = integerAt(record.data.maxplayernum, `${path}.maxplayernum`, 0, MAX_PLAYER_COUNT);
  if (!maxPlayers.ok) return maxPlayers;
  const uptime = integerAt(record.data.uptime, `${path}.uptime`, 0, MAX_UPTIME_SECONDS);
  if (!uptime.ok) return uptime;
  const baseCampCount = integerAt(record.data.basecampnum, `${path}.basecampnum`, 0, MAX_BASE_CAMP_COUNT);
  if (!baseCampCount.ok) return baseCampCount;
  const days = integerAt(record.data.days, `${path}.days`, 0, MAX_GAME_DAYS);
  if (!days.ok) return days;
  if (currentPlayers.data > maxPlayers.data) {
    return invalid(`${path}.currentplayernum`, "maxplayernum보다 클 수 없습니다.");
  }
  return valid(record.data as PalworldRestMetricsResponse);
}

function validateInfoAt(value: unknown, path: string): PalworldServerValidationResult<PalworldServerInfo> {
  const record = recordAt(value, path, ["serverName", "version"]);
  if (!record.ok) return record;
  const serverName = stringAt(record.data.serverName, `${path}.serverName`, MAX_SERVER_NAME_LENGTH);
  if (!serverName.ok) return serverName;
  const version = stringAt(record.data.version, `${path}.version`, MAX_VERSION_LENGTH);
  return version.ok ? valid(record.data as PalworldServerInfo) : version;
}

function validateMetricsAt(value: unknown, path: string): PalworldServerValidationResult<PalworldServerMetrics> {
  const record = recordAt(value, path, [
    "serverFps",
    "currentPlayers",
    "maxPlayers",
    "frameTimeMs",
    "uptimeSeconds",
    "baseCampCount",
    "gameDays"
  ]);
  if (!record.ok) return record;
  const serverFps = finiteNumberAt(record.data.serverFps, `${path}.serverFps`, 0, MAX_SERVER_FPS);
  if (!serverFps.ok) return serverFps;
  const currentPlayers = integerAt(record.data.currentPlayers, `${path}.currentPlayers`, 0, MAX_PLAYER_COUNT);
  if (!currentPlayers.ok) return currentPlayers;
  const maxPlayers = integerAt(record.data.maxPlayers, `${path}.maxPlayers`, 0, MAX_PLAYER_COUNT);
  if (!maxPlayers.ok) return maxPlayers;
  const frameTime = finiteNumberAt(record.data.frameTimeMs, `${path}.frameTimeMs`, 0, MAX_FRAME_TIME_MS);
  if (!frameTime.ok) return frameTime;
  const uptime = integerAt(record.data.uptimeSeconds, `${path}.uptimeSeconds`, 0, MAX_UPTIME_SECONDS);
  if (!uptime.ok) return uptime;
  const baseCampCount = integerAt(record.data.baseCampCount, `${path}.baseCampCount`, 0, MAX_BASE_CAMP_COUNT);
  if (!baseCampCount.ok) return baseCampCount;
  const gameDays = integerAt(record.data.gameDays, `${path}.gameDays`, 0, MAX_GAME_DAYS);
  if (!gameDays.ok) return gameDays;
  if (currentPlayers.data > maxPlayers.data) {
    return invalid(`${path}.currentPlayers`, "maxPlayers보다 클 수 없습니다.");
  }
  return valid(record.data as PalworldServerMetrics);
}

function validateDiagnosticAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldServerDiagnostic> {
  const record = recordAt(value, path, ["key", "state", "errorCode"]);
  if (!record.ok) return record;
  const key = enumAt(record.data.key, `${path}.key`, PALWORLD_SERVER_DIAGNOSTIC_KEYS);
  if (!key.ok) return key;
  const state = enumAt(record.data.state, `${path}.state`, PALWORLD_SERVER_DIAGNOSTIC_STATES);
  if (!state.ok) return state;
  if (record.data.errorCode !== undefined) {
    const errorCode = enumAt(record.data.errorCode, `${path}.errorCode`, PALWORLD_SERVER_ERROR_CODES);
    if (!errorCode.ok) return errorCode;
  }
  if (state.data === "failed" && record.data.errorCode === undefined) {
    return invalid(`${path}.errorCode`, "실패한 진단 단계에는 오류 코드가 필요합니다.");
  }
  if (state.data !== "failed" && record.data.errorCode !== undefined) {
    return invalid(`${path}.errorCode`, "실패하지 않은 진단 단계에는 오류 코드를 포함할 수 없습니다.");
  }
  return valid(record.data as PalworldServerDiagnostic);
}

function validateDiagnosticsAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldServerDiagnostic[]> {
  if (!Array.isArray(value)) return invalid(path, "배열이어야 합니다.");
  if (value.length !== PALWORLD_SERVER_DIAGNOSTIC_KEYS.length) {
    return invalid(path, `${PALWORLD_SERVER_DIAGNOSTIC_KEYS.length}개 진단 단계가 모두 필요합니다.`);
  }
  const diagnostics: PalworldServerDiagnostic[] = [];
  const seen = new Set<PalworldServerDiagnosticKey>();
  for (const [index, entry] of value.entries()) {
    const diagnostic = validateDiagnosticAt(entry, `${path}[${index}]`);
    if (!diagnostic.ok) return diagnostic;
    if (seen.has(diagnostic.data.key)) {
      return invalid(`${path}[${index}].key`, "중복된 진단 단계입니다.");
    }
    seen.add(diagnostic.data.key);
    diagnostics.push(diagnostic.data);
  }
  for (const key of PALWORLD_SERVER_DIAGNOSTIC_KEYS) {
    if (!seen.has(key)) return invalid(path, `${key} 진단 단계가 누락되었습니다.`);
  }
  return valid(diagnostics);
}

function validateStatusAt(value: unknown, path: string): PalworldServerValidationResult<PalworldServerStatus> {
  const record = recordAt(value, path, [
    "state",
    "errorCode",
    "checkedAt",
    "lastSuccessAt",
    "latencyMs",
    "consecutiveFailures",
    "info",
    "metrics",
    "diagnostics"
  ]);
  if (!record.ok) return record;
  const state = enumAt(record.data.state, `${path}.state`, PALWORLD_SERVER_CONNECTION_STATES);
  if (!state.ok) return state;
  if (record.data.errorCode !== undefined) {
    const errorCode = enumAt(record.data.errorCode, `${path}.errorCode`, PALWORLD_SERVER_ERROR_CODES);
    if (!errorCode.ok) return errorCode;
  }
  const checkedAt = optionalIsoDateAt(record.data.checkedAt, `${path}.checkedAt`);
  if (!checkedAt.ok) return checkedAt;
  const lastSuccessAt = optionalIsoDateAt(record.data.lastSuccessAt, `${path}.lastSuccessAt`);
  if (!lastSuccessAt.ok) return lastSuccessAt;
  if (record.data.latencyMs !== undefined) {
    const latency = finiteNumberAt(record.data.latencyMs, `${path}.latencyMs`, 0, MAX_LATENCY_MS);
    if (!latency.ok) return latency;
  }
  const failures = integerAt(
    record.data.consecutiveFailures,
    `${path}.consecutiveFailures`,
    0,
    MAX_CONSECUTIVE_FAILURES
  );
  if (!failures.ok) return failures;
  if (record.data.info !== undefined) {
    const info = validateInfoAt(record.data.info, `${path}.info`);
    if (!info.ok) return info;
  }
  if (record.data.metrics !== undefined) {
    const metrics = validateMetricsAt(record.data.metrics, `${path}.metrics`);
    if (!metrics.ok) return metrics;
  }
  const diagnostics = validateDiagnosticsAt(record.data.diagnostics, `${path}.diagnostics`);
  if (!diagnostics.ok) return diagnostics;
  if (state.data === "online" && (record.data.info === undefined || record.data.metrics === undefined)) {
    return invalid(path, "online 상태에는 info와 metrics가 모두 필요합니다.");
  }
  if (state.data === "online" && failures.data !== 0) {
    return invalid(`${path}.consecutiveFailures`, "online 상태에서는 0이어야 합니다.");
  }
  if (state.data === "online" && record.data.errorCode !== undefined) {
    return invalid(`${path}.errorCode`, "online 상태에는 오류 코드를 포함할 수 없습니다.");
  }
  if (state.data === "not_configured" && (record.data.info !== undefined || record.data.metrics !== undefined)) {
    return invalid(path, "not_configured 상태에는 서버 정보를 포함할 수 없습니다.");
  }
  if (checkedAt.data !== undefined && lastSuccessAt.data !== undefined) {
    if (Date.parse(lastSuccessAt.data) > Date.parse(checkedAt.data)) {
      return invalid(`${path}.lastSuccessAt`, "checkedAt보다 이후일 수 없습니다.");
    }
  }
  return valid(record.data as PalworldServerStatus);
}

function validateTestResponseAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldServerTestResponse> {
  const record = recordAt(value, path, ["connection", "status"]);
  if (!record.ok) return record;
  const connection = validateConnectionSummaryAt(record.data.connection, `${path}.connection`);
  if (!connection.ok) return connection;
  const status = validateStatusAt(record.data.status, `${path}.status`);
  return status.ok ? valid(record.data as PalworldServerTestResponse) : status;
}

function validateRegistrationPolicyAt(
  value: unknown,
  path: string
): PalworldServerValidationResult<PalworldServerRegistrationPolicy> {
  const record = recordAt(value, path, [
    "publicHttpsSelfService",
    "publicHttpsPort",
    "privateNetworkRequiresOperatorApproval"
  ]);
  if (!record.ok) return record;
  const publicHttpsSelfService = booleanAt(
    record.data.publicHttpsSelfService,
    `${path}.publicHttpsSelfService`
  );
  if (!publicHttpsSelfService.ok) return publicHttpsSelfService;
  if (record.data.publicHttpsPort !== 443) {
    return invalid(`${path}.publicHttpsPort`, "공개 HTTPS 직접 등록 포트는 443이어야 합니다.");
  }
  if (record.data.privateNetworkRequiresOperatorApproval !== true) {
    return invalid(
      `${path}.privateNetworkRequiresOperatorApproval`,
      "사설망은 운영자 승인이 필요해야 합니다."
    );
  }
  return valid(record.data as PalworldServerRegistrationPolicy);
}

export function validatePalworldServerConnectionInput(
  value: unknown
): PalworldServerValidationResult<PalworldServerConnectionInput> {
  return validateConnectionInputAt(value, "connection");
}

export function validatePalworldServerConnectionSummary(
  value: unknown
): PalworldServerValidationResult<PalworldServerConnectionSummary> {
  return validateConnectionSummaryAt(value, "connection");
}

export function validatePalworldRestInfoResponse(
  value: unknown
): PalworldServerValidationResult<PalworldRestInfoResponse> {
  return validateRestInfoAt(value, "restInfo");
}

export function validatePalworldRestMetricsResponse(
  value: unknown
): PalworldServerValidationResult<PalworldRestMetricsResponse> {
  return validateRestMetricsAt(value, "restMetrics");
}

export function validatePalworldServerInfo(value: unknown): PalworldServerValidationResult<PalworldServerInfo> {
  return validateInfoAt(value, "info");
}

export function validatePalworldServerMetrics(value: unknown): PalworldServerValidationResult<PalworldServerMetrics> {
  return validateMetricsAt(value, "metrics");
}

export function validatePalworldServerDiagnostic(
  value: unknown
): PalworldServerValidationResult<PalworldServerDiagnostic> {
  return validateDiagnosticAt(value, "diagnostic");
}

export function validatePalworldServerStatus(value: unknown): PalworldServerValidationResult<PalworldServerStatus> {
  return validateStatusAt(value, "status");
}

export function validatePalworldServerTestResponse(
  value: unknown
): PalworldServerValidationResult<PalworldServerTestResponse> {
  return validateTestResponseAt(value, "response");
}

export function validatePalworldServerRegistrationPolicy(
  value: unknown
): PalworldServerValidationResult<PalworldServerRegistrationPolicy> {
  return validateRegistrationPolicyAt(value, "registrationPolicy");
}

export function validatePalworldServerDashboardResponse(
  value: unknown
): PalworldServerValidationResult<PalworldServerDashboardResponse> {
  const record = recordAt(value, "response", [
    "enabled",
    "pollIntervalSeconds",
    "registrationPolicy",
    "connection",
    "status"
  ]);
  if (!record.ok) return record;
  const enabled = booleanAt(record.data.enabled, "response.enabled");
  if (!enabled.ok) return enabled;
  const pollInterval = integerAt(
    record.data.pollIntervalSeconds,
    "response.pollIntervalSeconds",
    MIN_POLL_INTERVAL_SECONDS,
    MAX_POLL_INTERVAL_SECONDS
  );
  if (!pollInterval.ok) return pollInterval;
  const registrationPolicy = validateRegistrationPolicyAt(
    record.data.registrationPolicy,
    "response.registrationPolicy"
  );
  if (!registrationPolicy.ok) return registrationPolicy;
  const connection = validateConnectionSummaryAt(record.data.connection, "response.connection");
  if (!connection.ok) return connection;
  const status = validateStatusAt(record.data.status, "response.status");
  if (!status.ok) return status;
  const availabilityError = status.data.errorCode !== undefined
    && (PALWORLD_SERVER_AVAILABILITY_ERROR_CODES as readonly string[]).includes(status.data.errorCode);
  if (!enabled.data && !availabilityError) {
    return invalid("response.status.errorCode", "비활성 응답에는 운영 준비 상태 오류 코드가 필요합니다.");
  }
  if (!enabled.data && status.data.state !== "not_configured") {
    return invalid("response.status.state", "비활성 응답은 not_configured 상태여야 합니다.");
  }
  if (!enabled.data && connection.data.configured) {
    return invalid("response.connection.configured", "비활성 응답에는 연결 정보를 포함할 수 없습니다.");
  }
  if (!enabled.data && registrationPolicy.data.publicHttpsSelfService) {
    return invalid(
      "response.registrationPolicy.publicHttpsSelfService",
      "비활성 응답에서는 공개 HTTPS 직접 등록을 허용할 수 없습니다."
    );
  }
  if (enabled.data && availabilityError) {
    return invalid("response.status.errorCode", "활성 응답에는 운영 준비 상태 오류 코드를 포함할 수 없습니다.");
  }
  return valid(record.data as PalworldServerDashboardResponse);
}

export function assertPalworldRestInfoResponse(value: unknown): PalworldRestInfoResponse {
  const result = validatePalworldRestInfoResponse(value);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export function assertPalworldRestMetricsResponse(value: unknown): PalworldRestMetricsResponse {
  const result = validatePalworldRestMetricsResponse(value);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

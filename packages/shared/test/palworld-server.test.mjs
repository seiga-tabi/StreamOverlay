import test from "node:test";
import assert from "node:assert/strict";
import {
  PALWORLD_SERVER_AVAILABILITY_ERROR_CODES,
  PALWORLD_SERVER_DIAGNOSTIC_KEYS,
  PALWORLD_SERVER_ERROR_CODES,
  PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
  assertPalworldRestInfoResponse,
  assertPalworldRestMetricsResponse,
  validatePalworldRestInfoResponse,
  validatePalworldRestMetricsResponse,
  validatePalworldServerConnectionInput,
  validatePalworldServerConnectionSummary,
  validatePalworldServerDashboardResponse,
  validatePalworldServerMetrics,
  validatePalworldServerRegistrationPolicy,
  validatePalworldServerStatus,
  validatePalworldServerTestResponse
} from "../dist/index.js";

const diagnostics = PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({
  key,
  state: "passed"
}));

const info = {
  serverName: "테스트 Palworld 서버",
  version: "v1.0.0"
};

const metrics = {
  serverFps: 57,
  currentPlayers: 10,
  maxPlayers: 32,
  frameTimeMs: 16.7671,
  uptimeSeconds: 3_600,
  baseCampCount: 12,
  gameDays: 42
};

const onlineStatus = {
  state: "online",
  checkedAt: "2026-07-22T02:00:00.000Z",
  lastSuccessAt: "2026-07-22T02:00:00.000Z",
  latencyMs: 24.5,
  consecutiveFailures: 0,
  info,
  metrics,
  diagnostics
};

const connection = {
  configured: true,
  baseUrl: "https://palworld.internal.example:8212/",
  passwordConfigured: true,
  updatedAt: "2026-07-22T01:00:00.000Z"
};

const registrationPolicy = {
  publicHttpsSelfService: true,
  publicHttpsPort: 443,
  privateNetworkRequiresOperatorApproval: true
};

test("Palworld 서버 연결 입력은 안전한 base URL 형태와 비밀번호 길이를 검증한다", () => {
  assert.equal(validatePalworldServerConnectionInput({
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "테스트-관리자-비밀번호"
  }).ok, true);
  assert.equal(validatePalworldServerConnectionInput({
    baseUrl: "https://palworld.internal.example:8212"
  }).ok, true);

  for (const baseUrl of [
    "ftp://palworld.internal.example",
    "https://admin:secret@palworld.internal.example",
    "https://palworld.internal.example/v1/api",
    "https://palworld.internal.example/?target=internal",
    "올바르지 않은 URL"
  ]) {
    assert.equal(validatePalworldServerConnectionInput({ baseUrl }).ok, false, baseUrl);
  }

  assert.equal(validatePalworldServerConnectionInput({
    baseUrl: "https://palworld.internal.example",
    adminPassword: ""
  }).ok, false);
  assert.equal(validatePalworldServerConnectionInput({
    baseUrl: "https://palworld.internal.example",
    adminPassword: "a".repeat(257)
  }).ok, false);
  assert.equal(validatePalworldServerConnectionInput({
    baseUrl: "https://palworld.internal.example",
    method: "DELETE"
  }).ok, false);
});

test("연결 요약은 비밀번호 원문과 unknown field를 허용하지 않는다", () => {
  assert.equal(validatePalworldServerConnectionSummary(connection).ok, true);
  assert.equal(validatePalworldServerConnectionSummary({
    configured: false,
    passwordConfigured: false
  }).ok, true);
  assert.equal(validatePalworldServerConnectionSummary({
    ...connection,
    adminPassword: "노출되면-안-되는-비밀번호"
  }).ok, false);
  assert.equal(validatePalworldServerConnectionSummary({
    configured: true,
    passwordConfigured: true,
    updatedAt: connection.updatedAt
  }).ok, false);
  assert.equal(validatePalworldServerConnectionSummary({
    configured: true,
    baseUrl: connection.baseUrl,
    passwordConfigured: false,
    updatedAt: connection.updatedAt
  }).ok, false);
});

test("공식 /info 응답은 1.0.0 exact schema만 허용한다", () => {
  const rawInfo = {
    version: "v1.0.0",
    servername: "Palworld example Server",
    description: "",
    worldguid: "A7E97BAA767DB9029EF013BB71E993A0"
  };
  assert.equal(validatePalworldRestInfoResponse(rawInfo).ok, true);
  assert.equal(assertPalworldRestInfoResponse(rawInfo).servername, rawInfo.servername);
  assert.equal(validatePalworldRestInfoResponse({ ...rawInfo, extra: "unsafe" }).ok, false);
  assert.equal(validatePalworldRestInfoResponse({
    version: rawInfo.version,
    servername: rawInfo.servername,
    description: rawInfo.description
  }).ok, false);
  assert.throws(() => assertPalworldRestInfoResponse({ ...rawInfo, version: "" }), /version/);
});

test("공식 /metrics 응답은 exact schema와 유한한 숫자 범위를 검증한다", () => {
  const rawMetrics = {
    serverfps: 57,
    currentplayernum: 10,
    serverframetime: 16.7671,
    maxplayernum: 32,
    uptime: 3_600,
    basecampnum: 12,
    days: 42
  };
  assert.equal(validatePalworldRestMetricsResponse(rawMetrics).ok, true);
  assert.equal(assertPalworldRestMetricsResponse(rawMetrics).serverfps, 57);
  assert.equal(validatePalworldRestMetricsResponse({ ...rawMetrics, serverfps: Number.NaN }).ok, false);
  assert.equal(validatePalworldRestMetricsResponse({ ...rawMetrics, serverframetime: Number.POSITIVE_INFINITY }).ok, false);
  assert.equal(validatePalworldRestMetricsResponse({ ...rawMetrics, uptime: -1 }).ok, false);
  assert.equal(validatePalworldRestMetricsResponse({ ...rawMetrics, currentplayernum: 33 }).ok, false);
  assert.equal(validatePalworldRestMetricsResponse({ ...rawMetrics, serverfps: 57.5 }).ok, false);
  assert.equal(validatePalworldRestMetricsResponse({ ...rawMetrics, averagefps: 55 }).ok, false);
});

test("정규화된 metrics는 camelCase 필드와 숫자 무결성을 검증한다", () => {
  assert.equal(validatePalworldServerMetrics(metrics).ok, true);
  assert.equal(validatePalworldServerMetrics({ ...metrics, currentPlayers: 33 }).ok, false);
  assert.equal(validatePalworldServerMetrics({ ...metrics, frameTimeMs: Number.NaN }).ok, false);
  assert.equal(validatePalworldServerMetrics({ ...metrics, gameDays: 1.5 }).ok, false);
  assert.equal(validatePalworldServerMetrics({ ...metrics, serverfps: 57 }).ok, false);
});

test("상태 validator는 전체 진단 단계와 online 상태 불변식을 검증한다", () => {
  assert.equal(validatePalworldServerStatus(onlineStatus).ok, true);

  const duplicateDiagnostics = diagnostics.map((entry) => ({ ...entry }));
  duplicateDiagnostics[6] = { ...duplicateDiagnostics[5] };
  assert.equal(validatePalworldServerStatus({ ...onlineStatus, diagnostics: duplicateDiagnostics }).ok, false);
  assert.equal(validatePalworldServerStatus({ ...onlineStatus, diagnostics: diagnostics.slice(0, -1) }).ok, false);
  assert.equal(validatePalworldServerStatus({ ...onlineStatus, metrics: undefined }).ok, false);
  assert.equal(validatePalworldServerStatus({ ...onlineStatus, consecutiveFailures: 1 }).ok, false);
  assert.equal(validatePalworldServerStatus({ ...onlineStatus, latencyMs: Number.POSITIVE_INFINITY }).ok, false);
  assert.equal(validatePalworldServerStatus({ ...onlineStatus, unknown: true }).ok, false);
  assert.equal(validatePalworldServerStatus({
    ...onlineStatus,
    diagnostics: diagnostics.map((entry) => entry.key === "info" ? { ...entry, state: "failed" } : entry)
  }).ok, false);
  assert.equal(validatePalworldServerStatus({
    ...onlineStatus,
    diagnostics: diagnostics.map((entry) => entry.key === "info" ? { ...entry, errorCode: "invalid_json" } : entry)
  }).ok, false);
});

test("운영 준비 상태 오류 code를 연결 미설정 상태와 구분해 검증한다", () => {
  for (const errorCode of PALWORLD_SERVER_AVAILABILITY_ERROR_CODES) {
    assert.equal(PALWORLD_SERVER_ERROR_CODES.includes(errorCode), true, errorCode);
    const result = validatePalworldServerStatus({
      state: "not_configured",
      errorCode,
      consecutiveFailures: 0,
      diagnostics: PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state: "skipped" }))
    });
    assert.equal(result.ok, true, result.ok ? errorCode : result.error);
  }
  assert.equal(validatePalworldServerStatus({
    state: "not_configured",
    errorCode: "unknown_configuration_state",
    consecutiveFailures: 0,
    diagnostics: PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state: "skipped" }))
  }).ok, false);
});

test("degraded 상태는 info 성공과 metrics 실패를 부분 결과로 표현할 수 있다", () => {
  const degradedDiagnostics = diagnostics.map((entry) => entry.key === "metrics"
    ? { key: entry.key, state: "failed", errorCode: "request_timeout" }
    : { ...entry });
  const result = validatePalworldServerStatus({
    state: "degraded",
    errorCode: "request_timeout",
    checkedAt: "2026-07-22T02:01:00.000Z",
    lastSuccessAt: "2026-07-22T02:00:00.000Z",
    latencyMs: 5_000,
    consecutiveFailures: 1,
    info,
    diagnostics: degradedDiagnostics
  });
  assert.equal(result.ok, true, result.ok ? "" : result.error);
});

test("Test 및 Dashboard 응답은 nested object까지 엄격하게 검증한다", () => {
  const testResponse = { connection, status: onlineStatus };
  assert.equal(validatePalworldServerTestResponse(testResponse).ok, true);
  assert.equal(validatePalworldServerTestResponse({
    ...testResponse,
    connection: { ...connection, password: "노출 금지" }
  }).ok, false);

  const dashboardResponse = {
    enabled: true,
    pollIntervalSeconds: 30,
    registrationPolicy,
    ...testResponse
  };
  assert.equal(validatePalworldServerDashboardResponse(dashboardResponse).ok, true);
  assert.equal(validatePalworldServerDashboardResponse({ ...dashboardResponse, pollIntervalSeconds: 1 }).ok, false);
  assert.equal(validatePalworldServerDashboardResponse({ ...dashboardResponse, debug: true }).ok, false);
  assert.equal(validatePalworldServerDashboardResponse({
    ...dashboardResponse,
    registrationPolicy: { ...registrationPolicy, publicHttpsPort: 8212 }
  }).ok, false);
  assert.equal(validatePalworldServerDashboardResponse({
    ...dashboardResponse,
    registrationPolicy: { ...registrationPolicy, allowedCidrs: [] }
  }).ok, false);
  const { registrationPolicy: _registrationPolicy, ...withoutRegistrationPolicy } = dashboardResponse;
  assert.equal(validatePalworldServerDashboardResponse(withoutRegistrationPolicy).ok, false);
  assert.equal(validatePalworldServerDashboardResponse({
    ...dashboardResponse,
    enabled: true,
    status: { ...onlineStatus, state: "degraded", errorCode: "key_missing" }
  }).ok, false);
  assert.equal(validatePalworldServerDashboardResponse({
    enabled: false,
    pollIntervalSeconds: 5,
    registrationPolicy: PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
    connection: { configured: false, passwordConfigured: false },
    status: {
      state: "not_configured",
      errorCode: "key_missing",
      consecutiveFailures: 0,
      diagnostics: PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state: "skipped" }))
    }
  }).ok, true);
  assert.equal(validatePalworldServerDashboardResponse({
    ...dashboardResponse,
    enabled: false
  }).ok, false);
});

test("Dashboard 전용 등록 정책은 exact schema와 비활성 안전 기본값을 강제한다", () => {
  assert.deepEqual(PALWORLD_SERVER_SAFE_REGISTRATION_POLICY, {
    publicHttpsSelfService: false,
    publicHttpsPort: 443,
    privateNetworkRequiresOperatorApproval: true
  });
  assert.equal(validatePalworldServerRegistrationPolicy(registrationPolicy).ok, true);
  assert.equal(validatePalworldServerRegistrationPolicy({
    ...registrationPolicy,
    publicHttpsPort443: true
  }).ok, false);
  assert.equal(validatePalworldServerRegistrationPolicy({
    publicHttpsSelfService: true,
    publicHttpsPort: 443,
    privateNetworkRequiresOperatorApproval: true,
    ownerApprovalUi: true
  }).ok, false);
  assert.equal(validatePalworldServerRegistrationPolicy({
    ...registrationPolicy,
    privateNetworkRequiresOperatorApproval: false
  }).ok, false);

  assert.equal(validatePalworldServerDashboardResponse({
    enabled: false,
    pollIntervalSeconds: 5,
    registrationPolicy,
    connection: { configured: false, passwordConfigured: false },
    status: {
      state: "not_configured",
      errorCode: "disabled",
      consecutiveFailures: 0,
      diagnostics: PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state: "skipped" }))
    }
  }).ok, false);
});

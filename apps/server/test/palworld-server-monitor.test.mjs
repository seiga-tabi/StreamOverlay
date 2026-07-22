import test from "node:test";
import assert from "node:assert/strict";

const {
  PALWORLD_SERVER_DIAGNOSTIC_KEYS,
  PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
  validatePalworldServerDashboardResponse,
  validatePalworldServerTestResponse
} = await import("@streamops/shared");
const {
  PalworldServerMonitor,
  PalworldServerMonitorInputError,
  PalworldServerMonitorRateLimitError
} = await import("../dist/services/palworld-server-monitor.js");

function diagnostics(state = "passed") {
  return PALWORLD_SERVER_DIAGNOSTIC_KEYS.map((key) => ({ key, state }));
}

function onlineResult(now, overrides = {}) {
  return {
    baseUrl: "https://palworld.internal.example:8212",
    checkedAt: new Date(now()).toISOString(),
    latencyMs: 25,
    state: "online",
    info: {
      serverName: "테스트 Palworld 서버",
      version: "v1.0.0"
    },
    metrics: {
      serverFps: 57,
      currentPlayers: 3,
      maxPlayers: 32,
      frameTimeMs: 16.7,
      uptimeSeconds: 3_600,
      baseCampCount: 4,
      gameDays: 12
    },
    diagnostics: diagnostics(),
    ...overrides
  };
}

function degradedResult(now, errorCode = "request_timeout") {
  return onlineResult(now, {
    state: "degraded",
    errorCode,
    metrics: undefined,
    diagnostics: diagnostics().map((entry) => entry.key === "metrics"
      ? { key: entry.key, state: "failed", errorCode }
      : entry)
  });
}

function clientFailure(code, stage = "info", secret = "") {
  const error = new Error(`외부 오류 ${secret}`);
  error.code = code;
  error.stage = stage;
  error.diagnostics = diagnostics("skipped").map((entry) => entry.key === stage
    ? { key: entry.key, state: "failed", errorCode: code }
    : entry);
  return error;
}

function createStore(now) {
  const records = new Map();
  return {
    get(ownerId) {
      const record = records.get(ownerId);
      return record ? { ...record } : undefined;
    },
    listOwnerIds() {
      return [...records.keys()];
    },
    async set(input) {
      const previous = records.get(input.ownerId);
      const timestamp = new Date(now()).toISOString();
      const record = {
        ...input,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      records.set(input.ownerId, record);
      return { ...record };
    },
    async remove(ownerId) {
      return records.delete(ownerId);
    },
    records
  };
}

function createClient(now, handler = () => onlineResult(now)) {
  const calls = [];
  let probeHandler = handler;
  return {
    calls,
    setHandler(next) {
      probeHandler = next;
    },
    normalizeBaseUrl(input) {
      const parsed = new URL(input);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw clientFailure("invalid_url", "url_policy");
      }
      return parsed.origin;
    },
    async probe(input) {
      calls.push({ ...input });
      return probeHandler(input);
    }
  };
}

function fixture(options = {}) {
  let time = options.time ?? Date.parse("2026-07-22T00:00:00.000Z");
  const now = () => time;
  const store = options.store ?? createStore(now);
  const client = options.client ?? createClient(now);
  const events = [];
  const errors = [];
  const monitor = new PalworldServerMonitor({
    store,
    client,
    now,
    random: () => 0.5,
    logger: {
      event: (payload) => events.push(payload),
      error: (payload) => errors.push(payload)
    },
    ...options.monitorOptions
  });
  return {
    monitor,
    store,
    client,
    events,
    errors,
    now,
    advance(milliseconds) {
      time += milliseconds;
    }
  };
}

test("등록되지 않은 tenant는 비밀정보 없는 not_configured 응답을 받는다", () => {
  const context = fixture();
  const response = context.monitor.getDashboardResponse("streamer-a");
  assert.equal(response.connection.configured, false);
  assert.equal(response.connection.passwordConfigured, false);
  assert.equal(response.status.state, "not_configured");
  assert.equal(response.status.errorCode, "not_configured");
  assert.deepEqual(response.registrationPolicy, PALWORLD_SERVER_SAFE_REGISTRATION_POLICY);
  assert.equal(validatePalworldServerDashboardResponse(response).ok, true);
  assert.throws(
    () => context.monitor.getDashboardResponse(""),
    (error) => error instanceof PalworldServerMonitorInputError && error.code === "invalid_request"
  );
});

test("Dashboard 응답은 allowlist 값을 숨기고 공개 HTTPS 등록 정책 metadata만 반환한다", () => {
  const context = fixture({
    monitorOptions: {
      registrationPolicy: {
        publicHttpsSelfService: true,
        publicHttpsPort: 443,
        privateNetworkRequiresOperatorApproval: true
      }
    }
  });
  assert.deepEqual(context.monitor.getDashboardResponse("streamer-a").registrationPolicy, {
    publicHttpsSelfService: true,
    publicHttpsPort: 443,
    privateNetworkRequiresOperatorApproval: true
  });
});

test("연결 테스트는 저장하지 않으며 tenant당 분당 5회로 제한된다", async () => {
  const context = fixture();
  const input = {
    baseUrl: "https://palworld.internal.example:8212/",
    adminPassword: "candidate-password"
  };
  for (let index = 0; index < 5; index += 1) {
    const response = await context.monitor.testConnection("streamer-a", input);
    assert.equal(response.connection.configured, false);
    assert.equal(response.connection.baseUrl, "https://palworld.internal.example:8212");
    assert.equal(response.status.state, "online");
    assert.equal(validatePalworldServerTestResponse(response).ok, true);
  }
  assert.equal(context.store.get("streamer-a"), undefined);
  await assert.rejects(
    () => context.monitor.testConnection("streamer-a", input),
    (error) => error instanceof PalworldServerMonitorRateLimitError && error.retryAfterSeconds === 60
  );
  context.advance(60_001);
  await assert.doesNotReject(() => context.monitor.testConnection("streamer-a", input));
});

test("동일 tenant와 동일 후보의 동시 probe는 하나의 single-flight로 합쳐진다", async () => {
  let release;
  const context = fixture();
  context.client.setHandler(() => new Promise((resolve) => {
    release = resolve;
  }));
  const input = {
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "candidate-password"
  };
  const first = context.monitor.testConnection("streamer-a", input);
  const second = context.monitor.testConnection("streamer-a", input);
  await Promise.resolve();
  assert.equal(context.client.calls.length, 1);
  release(onlineResult(context.now));
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.status.state, "online");
  assert.equal(secondResult.status.state, "online");
});

test("동일 tenant의 다른 후보는 진행 중 probe 뒤에 대기열로 쌓지 않는다", async () => {
  let release;
  const context = fixture();
  context.client.setHandler(() => new Promise((resolve) => {
    release = resolve;
  }));
  const first = context.monitor.testConnection("streamer-a", {
    baseUrl: "https://pal-a.example.com",
    adminPassword: "password-a"
  });
  await Promise.resolve();
  await assert.rejects(
    () => context.monitor.testConnection("streamer-a", {
      baseUrl: "https://pal-b.example.com",
      adminPassword: "password-b"
    }),
    (error) => error instanceof PalworldServerMonitorRateLimitError && error.retryAfterSeconds === 1
  );
  assert.equal(context.client.calls.length, 1);
  release(onlineResult(context.now));
  await first;
});

test("진행 중 후보와 충돌한 저장 connection refresh는 후보 완료 후 안전하게 재개한다", async () => {
  const releases = new Map();
  const context = fixture();
  await context.store.set({
    ownerId: "streamer-a",
    baseUrl: "https://saved-pal.example.com",
    adminPassword: "saved-password"
  });
  context.client.setHandler((input) => new Promise((resolve) => {
    releases.set(input.baseUrl, resolve);
  }));

  const candidate = context.monitor.testConnection("streamer-a", {
    baseUrl: "https://candidate-pal.example.com",
    adminPassword: "candidate-password"
  });
  await Promise.resolve();
  const refresh = context.monitor.refresh("streamer-a");
  await Promise.resolve();
  assert.equal(context.client.calls.length, 1);

  releases.get("https://candidate-pal.example.com")?.(onlineResult(context.now));
  await candidate;
  await Promise.resolve();
  assert.equal(context.client.calls.length, 2);
  releases.get("https://saved-pal.example.com")?.(onlineResult(context.now));
  const refreshed = await refresh;
  assert.equal(refreshed.status.state, "online");
});

test("후보 probe는 전역 동시 실행 한도를 적용하고 완료 후 slot을 반환한다", async () => {
  const releases = new Map();
  const context = fixture({
    monitorOptions: { candidateProbeConcurrencyLimit: 2 }
  });
  context.client.setHandler((input) => new Promise((resolve) => {
    releases.set(input.baseUrl, resolve);
  }));

  const candidate = (name) => ({
    baseUrl: `https://${name}.example.com`,
    adminPassword: `password-${name}`
  });
  const first = context.monitor.testConnection("streamer-a", candidate("pal-a"));
  const second = context.monitor.testConnection("streamer-b", candidate("pal-b"));
  await Promise.resolve();
  assert.equal(context.client.calls.length, 2);
  await assert.rejects(
    () => context.monitor.testConnection("streamer-c", candidate("pal-c")),
    (error) => error instanceof PalworldServerMonitorRateLimitError && error.retryAfterSeconds === 1
  );
  assert.equal(context.client.calls.length, 2);

  releases.get("https://pal-a.example.com")?.(onlineResult(context.now));
  await first;
  const third = context.monitor.testConnection("streamer-c", candidate("pal-c"));
  await Promise.resolve();
  assert.equal(context.client.calls.length, 3);
  releases.get("https://pal-b.example.com")?.(onlineResult(context.now));
  releases.get("https://pal-c.example.com")?.(onlineResult(context.now));
  await Promise.all([second, third]);
});

test("저장은 online 재검사 성공 시에만 수행하고 degraded 후보는 보존하지 않는다", async () => {
  const context = fixture();
  context.client.setHandler(() => degradedResult(context.now));
  const input = {
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "new-password"
  };
  const rejected = await context.monitor.saveConnection("streamer-a", input);
  assert.equal(rejected.status.state, "degraded");
  assert.equal(rejected.connection.configured, false);
  assert.equal(rejected.connection.passwordConfigured, false);
  assert.equal(rejected.connection.baseUrl, undefined);
  assert.equal(context.store.get("streamer-a"), undefined);

  context.client.setHandler(() => onlineResult(context.now));
  const saved = await context.monitor.saveConnection("streamer-a", input);
  assert.equal(saved.connection.configured, true);
  assert.equal(saved.connection.passwordConfigured, true);
  assert.equal(saved.status.state, "online");
  assert.equal(context.store.get("streamer-a")?.adminPassword, "new-password");
  assert.equal(validatePalworldServerDashboardResponse(saved).ok, true);
});

test("같은 canonical URL은 빈 비밀번호로 저장값을 재사용하고 URL 변경에는 새 비밀번호가 필요하다", async () => {
  const context = fixture();
  await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://palworld.internal.example:8212/",
    adminPassword: "saved-password"
  });
  await context.monitor.testConnection("streamer-a", {
    baseUrl: "https://palworld.internal.example:8212"
  });
  assert.equal(context.client.calls.at(-1)?.adminPassword, "saved-password");

  await assert.rejects(
    () => context.monitor.testConnection("streamer-a", {
      baseUrl: "https://new-palworld.internal.example:8212"
    }),
    (error) => error instanceof PalworldServerMonitorInputError && error.code === "password_required"
  );
  assert.equal(context.store.get("streamer-a")?.baseUrl, "https://palworld.internal.example:8212");
});

test("첫 번째와 두 번째 네트워크 실패는 마지막 정상 데이터를 유지하고 세 번째에 unreachable이 된다", async () => {
  const context = fixture();
  await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "saved-password"
  });
  context.client.setHandler(() => {
    throw clientFailure("connection_failed", "dns_tcp");
  });

  for (let failure = 1; failure <= 3; failure += 1) {
    context.advance(10_000);
    const response = await context.monitor.refresh("streamer-a");
    assert.equal(response.status.consecutiveFailures, failure);
    assert.equal(response.status.info?.serverName, "테스트 Palworld 서버");
    assert.equal(response.status.metrics?.maxPlayers, 32);
    assert.equal(response.status.state, failure < 3 ? "degraded" : "unreachable");
  }
});

test("인증·TLS·응답·정책 오류는 안전한 domain 상태로 즉시 매핑된다", async () => {
  const cases = [
    ["auth_failed", "basic_auth", "auth_failed"],
    ["tls_failed", "tls", "tls_failed"],
    ["invalid_json", "schema", "invalid_response"],
    ["address_blocked", "url_policy", "blocked_by_policy"]
  ];
  for (const [code, stage, expectedState] of cases) {
    const context = fixture();
    await context.store.set({
      ownerId: "streamer-a",
      baseUrl: "https://palworld.internal.example:8212",
      adminPassword: "saved-password"
    });
    context.client.setHandler(() => {
      throw clientFailure(code, stage);
    });
    const response = await context.monitor.refresh("streamer-a");
    assert.equal(response.status.state, expectedState, code);
    assert.equal(response.status.errorCode, code);
  }
});

test("수동 refresh는 10초 cooldown을 적용한다", async () => {
  const context = fixture();
  await context.store.set({
    ownerId: "streamer-a",
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "saved-password"
  });
  await context.monitor.refresh("streamer-a");
  await assert.rejects(
    () => context.monitor.refresh("streamer-a"),
    (error) => error instanceof PalworldServerMonitorRateLimitError && error.retryAfterSeconds === 10
  );
  context.advance(10_000);
  await assert.doesNotReject(() => context.monitor.refresh("streamer-a"));
});

test("background delay는 실패 횟수에 따라 backoff하고 stop은 timer를 정리한다", async () => {
  const scheduled = [];
  const cleared = [];
  const context = fixture({
    monitorOptions: {
      pollIntervalMs: 30_000,
      maxBackoffMs: 300_000,
      setTimeoutFn(callback, delayMs) {
        const handle = { callback, delayMs, unref() {} };
        scheduled.push(handle);
        return handle;
      },
      clearTimeoutFn(handle) {
        cleared.push(handle);
      }
    }
  });
  context.monitor.start();
  await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "saved-password"
  });
  assert.equal(scheduled.at(-1)?.delayMs, 30_000);

  context.client.setHandler(() => {
    throw clientFailure("request_timeout", "dns_tcp");
  });
  context.advance(10_000);
  await context.monitor.refresh("streamer-a");
  assert.equal(scheduled.at(-1)?.delayMs, 60_000);
  context.advance(10_000);
  await context.monitor.refresh("streamer-a");
  assert.equal(scheduled.at(-1)?.delayMs, 120_000);
  context.advance(10_000);
  await context.monitor.refresh("streamer-a");
  assert.equal(scheduled.at(-1)?.delayMs, 240_000);
  context.advance(10_000);
  await context.monitor.refresh("streamer-a");
  assert.equal(scheduled.at(-1)?.delayMs, 300_000);

  const currentTimer = scheduled.at(-1);
  context.monitor.stop();
  assert.ok(cleared.includes(currentTimer));
});

test("오래된 cache는 stale로 표시하고 로그에는 URL·비밀번호·외부 오류 원문을 남기지 않는다", async () => {
  const context = fixture({ monitorOptions: { staleAfterMs: 90_000 } });
  await context.monitor.saveConnection("streamer-secret", {
    baseUrl: "https://private-palworld.example:8212",
    adminPassword: "do-not-log-this-password"
  });
  context.advance(90_001);
  assert.equal(context.monitor.getDashboardResponse("streamer-secret").status.state, "stale");

  context.advance(10_000);
  context.client.setHandler(() => {
    throw clientFailure("connection_failed", "dns_tcp", "do-not-log-this-password https://private-palworld.example:8212");
  });
  await context.monitor.refresh("streamer-secret");
  const logs = JSON.stringify([...context.events, ...context.errors]);
  assert.doesNotMatch(logs, /do-not-log-this-password/);
  assert.doesNotMatch(logs, /private-palworld\.example/);
  assert.match(logs, /connection_failed/);
});

test("등록 삭제는 tenant cache와 timer 상태를 함께 제거한다", async () => {
  const context = fixture();
  await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "saved-password"
  });
  const removed = await context.monitor.removeConnection("streamer-a");
  assert.equal(removed.connection.configured, false);
  assert.equal(removed.status.state, "not_configured");
  assert.equal(context.store.get("streamer-a"), undefined);
});

test("연결 삭제는 tenant 후보 probe rate-limit 기록을 초기화하지 않는다", async () => {
  const context = fixture();
  const input = {
    baseUrl: "https://palworld.example.com",
    adminPassword: "candidate-password"
  };
  for (let index = 0; index < 5; index += 1) {
    await context.monitor.testConnection("streamer-a", input);
  }
  await context.monitor.removeConnection("streamer-a");
  await assert.rejects(
    () => context.monitor.testConnection("streamer-a", input),
    (error) => error instanceof PalworldServerMonitorRateLimitError && error.retryAfterSeconds === 60
  );
});

test("저장 재검사 실패는 기존 connection 응답과 암호화 저장 record를 변경하지 않는다", async () => {
  const context = fixture();
  await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://old-palworld.internal.example:8212",
    adminPassword: "old-password"
  });
  context.client.setHandler(() => degradedResult(context.now));

  const rejected = await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://new-palworld.internal.example:8212",
    adminPassword: "new-password"
  });
  assert.equal(rejected.status.state, "degraded");
  assert.deepEqual(rejected.connection, {
    configured: true,
    baseUrl: "https://old-palworld.internal.example:8212",
    passwordConfigured: true,
    updatedAt: "2026-07-22T00:00:00.000Z"
  });
  assert.equal(context.store.get("streamer-a")?.baseUrl, "https://old-palworld.internal.example:8212");
  assert.equal(context.store.get("streamer-a")?.adminPassword, "old-password");
});

test("remove 중 완료된 refresh는 삭제된 tenant cache를 다시 채우지 않는다", async () => {
  let release;
  const context = fixture();
  await context.store.set({
    ownerId: "streamer-a",
    baseUrl: "https://palworld.internal.example:8212",
    adminPassword: "saved-password"
  });
  context.client.setHandler(() => new Promise((resolve) => {
    release = resolve;
  }));

  const refresh = context.monitor.refresh("streamer-a");
  await Promise.resolve();
  assert.equal(context.client.calls.length, 1);
  const removed = await context.monitor.removeConnection("streamer-a");
  assert.equal(removed.status.state, "not_configured");
  release(onlineResult(context.now));
  const completedRefresh = await refresh;
  assert.equal(completedRefresh.status.state, "not_configured");

  await context.store.set({
    ownerId: "streamer-a",
    baseUrl: "https://replacement-palworld.internal.example:8212",
    adminPassword: "replacement-password"
  });
  assert.equal(context.monitor.getDashboardResponse("streamer-a").status.state, "checking");
});

test("tenant A/B의 저장 설정과 상태 cache는 독립적이다", async () => {
  const context = fixture();
  context.client.setHandler((input) => onlineResult(context.now, {
    baseUrl: input.baseUrl,
    info: {
      serverName: input.baseUrl.includes("pal-a") ? "Pal A" : "Pal B",
      version: "v1.0.0"
    }
  }));
  await context.monitor.saveConnection("streamer-a", {
    baseUrl: "https://pal-a.internal.example:8212",
    adminPassword: "password-a"
  });
  await context.monitor.saveConnection("streamer-b", {
    baseUrl: "https://pal-b.internal.example:8212",
    adminPassword: "password-b"
  });

  assert.equal(context.store.get("streamer-a")?.adminPassword, "password-a");
  assert.equal(context.store.get("streamer-b")?.adminPassword, "password-b");
  assert.equal(context.monitor.getDashboardResponse("streamer-a").status.info?.serverName, "Pal A");
  assert.equal(context.monitor.getDashboardResponse("streamer-b").status.info?.serverName, "Pal B");
});

test("tenant A/B의 single-flight는 tenant 내부에서만 합쳐진다", async () => {
  const releases = new Map();
  const context = fixture();
  context.client.setHandler((input) => new Promise((resolve) => {
    releases.set(input.baseUrl, resolve);
  }));
  const inputA = {
    baseUrl: "https://pal-a.internal.example:8212",
    adminPassword: "password-a"
  };
  const inputB = {
    baseUrl: "https://pal-b.internal.example:8212",
    adminPassword: "password-b"
  };
  const probes = [
    context.monitor.testConnection("streamer-a", inputA),
    context.monitor.testConnection("streamer-a", inputA),
    context.monitor.testConnection("streamer-b", inputB),
    context.monitor.testConnection("streamer-b", inputB)
  ];
  await Promise.resolve();
  assert.equal(context.client.calls.length, 2);
  releases.get("https://pal-a.internal.example:8212")?.(onlineResult(context.now, {
    baseUrl: "https://pal-a.internal.example:8212"
  }));
  releases.get("https://pal-b.internal.example:8212")?.(onlineResult(context.now, {
    baseUrl: "https://pal-b.internal.example:8212"
  }));
  const results = await Promise.all(probes);
  assert.ok(results.every((result) => result.status.state === "online"));
});

test("tenant A/B의 manual cooldown과 후보 probe rate limit은 독립적이다", async () => {
  const context = fixture();
  await Promise.all([
    context.store.set({
      ownerId: "streamer-a",
      baseUrl: "https://pal-a.internal.example:8212",
      adminPassword: "password-a"
    }),
    context.store.set({
      ownerId: "streamer-b",
      baseUrl: "https://pal-b.internal.example:8212",
      adminPassword: "password-b"
    })
  ]);

  await context.monitor.refresh("streamer-a");
  await assert.rejects(
    () => context.monitor.refresh("streamer-a"),
    (error) => error instanceof PalworldServerMonitorRateLimitError
  );
  await assert.doesNotReject(() => context.monitor.refresh("streamer-b"));

  const candidateA = {
    baseUrl: "https://candidate-a.internal.example:8212",
    adminPassword: "candidate-password-a"
  };
  for (let index = 0; index < 5; index += 1) {
    await context.monitor.testConnection("streamer-a", candidateA);
  }
  await assert.rejects(
    () => context.monitor.testConnection("streamer-a", candidateA),
    (error) => error instanceof PalworldServerMonitorRateLimitError
  );
  await assert.doesNotReject(() => context.monitor.testConnection("streamer-b", {
    baseUrl: "https://candidate-b.internal.example:8212",
    adminPassword: "candidate-password-b"
  }));
});

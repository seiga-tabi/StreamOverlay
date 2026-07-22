import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { networkInterfaces } from "node:os";

const {
  PalworldPinnedTransportError,
  PalworldServerClient,
  PalworldServerClientError
} = await import("../dist/services/palworld-server-client.js");

// 저장소에 공개된 통합 테스트 전용 인증서입니다. 운영 secret 또는 신뢰 anchor로 사용하지 않습니다.
const TEST_TLS_KEY = readFileSync(new URL("./fixtures/palworld-test-tls-key.pem", import.meta.url));
const TEST_TLS_CERT = readFileSync(new URL("./fixtures/palworld-test-tls-cert.pem", import.meta.url));

const VALID_INFO = {
  version: "v1.0.0",
  servername: "세이가 Palworld",
  description: "테스트 서버",
  worldguid: "A7E97BAA767DB9029EF013BB71E993A0"
};

const VALID_METRICS = {
  serverfps: 57,
  currentplayernum: 10,
  serverframetime: 16.7671,
  maxplayernum: 32,
  uptime: 3600,
  basecampnum: 8,
  days: 24
};

function jsonResponse(body, statusCode = 200, contentType = "application/json; charset=utf-8") {
  return {
    statusCode,
    headers: { "content-type": contentType },
    body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body))
  };
}

function createHttpsClient(overrides = {}) {
  const calls = [];
  const resolveHostname = overrides.resolveHostname ?? (async () => [{ address: "8.8.8.8", family: 4 }]);
  const requestPinned = overrides.requestPinned ?? (async (request) => {
    calls.push(request);
    if (request.url.pathname === "/v1/api/info") return jsonResponse(VALID_INFO);
    if (request.url.pathname === "/v1/api/metrics") return jsonResponse(VALID_METRICS);
    throw new Error("허용되지 않은 테스트 경로입니다.");
  });
  let tickIndex = 0;
  const ticks = overrides.ticks ?? [100, 112.345];
  const client = new PalworldServerClient({
    allowedOrigins: overrides.allowedOrigins ?? ["https://pal.example:8212"],
    allowedCidrs: overrides.allowedCidrs ?? [],
    timeoutMs: overrides.timeoutMs,
    maxResponseBytes: overrides.maxResponseBytes,
    maxUrlLength: overrides.maxUrlLength
  }, {
    resolveHostname,
    requestPinned,
    now: overrides.now ?? (() => new Date("2026-07-22T03:04:05.000Z")),
    monotonicNow: overrides.monotonicNow ?? (() => ticks[Math.min(tickIndex++, ticks.length - 1)])
  });
  return { client, calls };
}

function assertClientError(error, code, stage) {
  assert.equal(error instanceof PalworldServerClientError, true);
  assert.equal(error.code, code);
  if (stage !== undefined) assert.equal(error.stage, stage);
  assert.equal(error.message.includes("8.8.8.8"), false);
  assert.equal(error.message.includes("secret-password"), false);
  return true;
}

function nonLoopbackPrivateIpv4() {
  for (const records of Object.values(networkInterfaces())) {
    for (const record of records ?? []) {
      const family = record.family === "IPv4" || record.family === 4 ? 4 : 6;
      if (family !== 4 || record.internal) continue;
      const octets = record.address.split(".").map(Number);
      if (octets.length !== 4) continue;
      if (octets[0] === 10
        || (octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31)
        || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 100 && (octets[1] ?? 0) >= 64 && (octets[1] ?? 0) <= 127)) {
        return record.address;
      }
    }
  }
  return undefined;
}

function listen(server, host) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(0, host);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("PalworldServerClient는 origin을 canonical URL로 정규화한다", () => {
  const { client } = createHttpsClient({ allowedOrigins: ["HTTPS://PAL.EXAMPLE:443"] });
  assert.equal(client.normalizeBaseUrl("https://pal.example/"), "https://pal.example");
  assert.equal(client.normalizeBaseUrl("HTTPS://PAL.EXAMPLE:443/"), "https://pal.example");
});

test("PalworldServerClient는 잘못된 URL 구성 요소와 허용되지 않은 origin을 거부한다", () => {
  const { client } = createHttpsClient({ maxUrlLength: 128 });
  const invalidUrls = [
    "",
    " https://pal.example:8212",
    "https://pal.example:8212 ",
    "ftp://pal.example:8212",
    "https://admin:password@pal.example:8212",
    "https://pal.example:8212/v1/api/info",
    "https://pal.example:8212?next=/v1/api/info",
    "https://pal.example:8212#fragment",
    `https://pal.example:8212/${"a".repeat(140)}`
  ];
  for (const url of invalidUrls) {
    assert.throws(() => client.normalizeBaseUrl(url), (error) => assertClientError(error, "invalid_url", "url_policy"));
  }
  assert.throws(
    () => client.normalizeBaseUrl("https://other.example:8212"),
    (error) => assertClientError(error, "origin_not_allowed", "url_policy")
  );
});

test("PalworldServerClient는 10진수·16진수 등 비정상 IPv4 표기를 거부한다", () => {
  const client = new PalworldServerClient({
    allowedOrigins: ["https://127.0.0.1:8212"]
  });
  for (const url of ["https://2130706433:8212", "https://0x7f000001:8212", "https://0177.0.0.1:8212"]) {
    assert.throws(() => client.normalizeBaseUrl(url), (error) => assertClientError(error, "invalid_url", "url_policy"));
  }
});

test("PalworldServerClient 설정은 exact origin과 올바른 CIDR만 허용한다", () => {
  assert.throws(
    () => new PalworldServerClient({ allowedOrigins: ["https://pal.example/path"] }),
    /origin allowlist/
  );
  assert.throws(
    () => new PalworldServerClient({ allowedOrigins: ["https://pal.example"], allowedCidrs: ["10.0.0.0/99"] }),
    /CIDR allowlist/
  );
  assert.throws(
    () => new PalworldServerClient({ allowedOrigins: ["https://pal.example"], timeoutMs: 31_000 }),
    /timeout/
  );
  assert.throws(
    () => new PalworldServerClient({ allowedOrigins: ["https://pal.example"], maxResponseBytes: 65_537 }),
    /최대 응답 크기/
  );
});

test("PalworldServerClient는 loopback·link-local·metadata·예약·multicast 주소를 항상 차단한다", async () => {
  const blockedAddresses = [
    { address: "0.0.0.0", family: 4 },
    { address: "127.0.0.1", family: 4 },
    { address: "169.254.169.254", family: 4 },
    { address: "100.100.100.200", family: 4 },
    { address: "192.0.2.1", family: 4 },
    { address: "198.18.0.1", family: 4 },
    { address: "224.0.0.1", family: 4 },
    { address: "240.0.0.1", family: 4 },
    { address: "::1", family: 6 },
    { address: "::ffff:127.0.0.1", family: 6 },
    { address: "fe80::1", family: 6 },
    { address: "2001:db8::1", family: 6 },
    { address: "ff02::1", family: 6 },
    { address: "64:ff9b::808:808", family: 6 }
  ];
  for (const blocked of blockedAddresses) {
    let requestCount = 0;
    const { client } = createHttpsClient({
      allowedCidrs: ["0.0.0.0/0", "::/0"],
      resolveHostname: async () => [blocked],
      requestPinned: async () => {
        requestCount += 1;
        return jsonResponse(VALID_INFO);
      }
    });
    await assert.rejects(
      () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
      (error) => assertClientError(error, "address_blocked", "dns_tcp")
    );
    assert.equal(requestCount, 0, `${blocked.address}에는 요청을 보내면 안 됩니다.`);
  }
});

test("PalworldServerClient는 사설망을 CIDR로 승인한 경우에만 허용하고 public HTTP는 차단한다", async () => {
  const privateAddress = [{ address: "10.20.30.40", family: 4 }];
  const { client: deniedPrivate } = createHttpsClient({ resolveHostname: async () => privateAddress });
  await assert.rejects(
    () => deniedPrivate.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
    (error) => assertClientError(error, "address_blocked", "dns_tcp")
  );

  const calls = [];
  const privateClient = new PalworldServerClient({
    allowedOrigins: ["http://pal.lan:8212"],
    allowedCidrs: ["10.20.0.0/16"]
  }, {
    resolveHostname: async () => privateAddress,
    requestPinned: async (request) => {
      calls.push(request);
      return request.url.pathname.endsWith("/info") ? jsonResponse(VALID_INFO) : jsonResponse(VALID_METRICS);
    }
  });
  const result = await privateClient.probe({ baseUrl: "http://pal.lan:8212", adminPassword: "secret-password" });
  assert.equal(result.state, "online");
  assert.deepEqual(calls.map((call) => call.pinnedAddress.address), ["10.20.30.40", "10.20.30.40"]);
  assert.equal(result.diagnostics.find((entry) => entry.key === "tls")?.state, "skipped");

  const publicHttpClient = new PalworldServerClient({ allowedOrigins: ["http://pal.example:8212"] }, {
    resolveHostname: async () => [{ address: "8.8.8.8", family: 4 }],
    requestPinned: async () => {
      throw new Error("public HTTP 요청을 보내면 안 됩니다.");
    }
  });
  await assert.rejects(
    () => publicHttpClient.probe({ baseUrl: "http://pal.example:8212", adminPassword: "secret-password" }),
    (error) => assertClientError(error, "address_blocked", "dns_tcp")
  );
});

test("PalworldServerClient는 IPv4-mapped IPv6 사설 주소에도 IPv4 CIDR 정책을 적용한다", async () => {
  const calls = [];
  const client = new PalworldServerClient({
    allowedOrigins: ["http://pal.lan:8212"],
    allowedCidrs: ["10.20.0.0/16"]
  }, {
    resolveHostname: async () => [{ address: "::ffff:10.20.30.40", family: 6 }],
    requestPinned: async (request) => {
      calls.push(request);
      return request.url.pathname.endsWith("/info") ? jsonResponse(VALID_INFO) : jsonResponse(VALID_METRICS);
    }
  });
  const result = await client.probe({ baseUrl: "http://pal.lan:8212", adminPassword: "secret-password" });
  assert.equal(result.state, "online");
  assert.equal(calls[0].pinnedAddress.address, "::ffff:10.20.30.40");
});

test("PalworldServerClient는 DNS가 반환한 모든 주소를 검사한다", async () => {
  let requestCount = 0;
  const { client } = createHttpsClient({
    resolveHostname: async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ],
    requestPinned: async () => {
      requestCount += 1;
      return jsonResponse(VALID_INFO);
    }
  });
  await assert.rejects(
    () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
    (error) => assertClientError(error, "address_blocked", "dns_tcp")
  );
  assert.equal(requestCount, 0);
});

test("PalworldServerClient는 DNS 실패와 잘못된 resolver 결과를 안전한 오류로 변환한다", async () => {
  const { client: failed } = createHttpsClient({
    resolveHostname: async () => {
      throw new Error("내부 resolver 원문");
    }
  });
  await assert.rejects(
    () => failed.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
    (error) => {
      assertClientError(error, "dns_failed", "dns_tcp");
      assert.equal(error.message.includes("내부 resolver 원문"), false);
      return true;
    }
  );

  const { client: invalid } = createHttpsClient({
    resolveHostname: async () => [{ address: "8.8.8.8", family: 6 }]
  });
  await assert.rejects(
    () => invalid.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
    (error) => assertClientError(error, "dns_failed", "dns_tcp")
  );
});

test("PalworldServerClient는 검증한 단일 IP에 두 GET 경로를 고정하고 응답을 정규화한다", async () => {
  const resolverCalls = [];
  const calls = [];
  const { client } = createHttpsClient({
    resolveHostname: async (hostname) => {
      resolverCalls.push(hostname);
      return [{ address: "8.8.8.8", family: 4 }];
    },
    requestPinned: async (request) => {
      calls.push(request);
      return request.url.pathname === "/v1/api/info"
        ? jsonResponse(VALID_INFO, 200, "application/vnd.palworld+json")
        : jsonResponse(VALID_METRICS);
    }
  });
  const result = await client.probe({
    baseUrl: "https://pal.example:8212",
    adminPassword: "secret-password"
  });

  assert.deepEqual(resolverCalls, ["pal.example"]);
  assert.deepEqual(calls.map((call) => call.url.href), [
    "https://pal.example:8212/v1/api/info",
    "https://pal.example:8212/v1/api/metrics"
  ]);
  assert.deepEqual(calls.map((call) => call.pinnedAddress), [
    { address: "8.8.8.8", family: 4 },
    { address: "8.8.8.8", family: 4 }
  ]);
  assert.equal(calls[0].authorization, `Basic ${Buffer.from("admin:secret-password").toString("base64")}`);
  assert.equal(result.baseUrl, "https://pal.example:8212");
  assert.equal(result.checkedAt, "2026-07-22T03:04:05.000Z");
  assert.equal(result.latencyMs, 12.35);
  assert.equal(result.state, "online");
  assert.deepEqual(result.info, { serverName: "세이가 Palworld", version: "v1.0.0" });
  assert.deepEqual(result.metrics, {
    serverFps: 57,
    currentPlayers: 10,
    maxPlayers: 32,
    frameTimeMs: 16.7671,
    uptimeSeconds: 3600,
    baseCampCount: 8,
    gameDays: 24
  });
  assert.equal(result.diagnostics.every((entry) => entry.state === "passed"), true);
});

test("PalworldServerClient는 비밀번호를 필수로 검사하고 외부 요청을 보내지 않는다", async () => {
  let resolveCount = 0;
  const { client } = createHttpsClient({
    resolveHostname: async () => {
      resolveCount += 1;
      return [{ address: "8.8.8.8", family: 4 }];
    }
  });
  for (const adminPassword of ["", "   ", "x".repeat(257)]) {
    await assert.rejects(
      () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword }),
      (error) => assertClientError(error, "password_required", "basic_auth")
    );
  }
  assert.equal(resolveCount, 0);
});

test("PalworldServerClient는 어느 endpoint의 401도 즉시 auth_failed로 처리한다", async () => {
  for (const unauthorizedPath of ["/v1/api/info", "/v1/api/metrics"]) {
    const calls = [];
    const { client } = createHttpsClient({
      requestPinned: async (request) => {
        calls.push(request.url.pathname);
        if (request.url.pathname === unauthorizedPath) return jsonResponse({}, 401);
        return jsonResponse(VALID_INFO);
      }
    });
    await assert.rejects(
      () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
      (error) => assertClientError(error, "auth_failed", "basic_auth")
    );
    assert.equal(calls.at(-1), unauthorizedPath);
  }
});

test("PalworldServerClient는 redirect·HTTP 상태·content-type·JSON·schema 오류를 구분한다", async () => {
  const scenarios = [
    { response: jsonResponse({}, 302), code: "redirect_blocked", stage: "info" },
    { response: jsonResponse({}, 500), code: "unexpected_status", stage: "info" },
    { response: jsonResponse(VALID_INFO, 200, "text/html"), code: "invalid_content_type", stage: "info" },
    { response: jsonResponse("{not-json"), code: "invalid_json", stage: "schema" },
    { response: jsonResponse({ ...VALID_INFO, extra: true }), code: "invalid_schema", stage: "schema" }
  ];
  for (const scenario of scenarios) {
    let requestCount = 0;
    const { client } = createHttpsClient({
      requestPinned: async () => {
        requestCount += 1;
        return scenario.response;
      }
    });
    await assert.rejects(
      () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
      (error) => assertClientError(error, scenario.code, scenario.stage)
    );
    assert.equal(requestCount, 1, "redirect를 따라가거나 metrics를 호출하면 안 됩니다.");
  }
});

test("PalworldServerClient는 body 크기를 transport와 무관하게 다시 제한한다", async () => {
  const { client } = createHttpsClient({
    maxResponseBytes: 1_024,
    requestPinned: async () => ({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: Buffer.alloc(1_025, 0x61)
    })
  });
  await assert.rejects(
    () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
    (error) => assertClientError(error, "response_too_large", "info")
  );
});

test("PalworldServerClient는 connection refused·TLS·timeout 오류를 안전한 코드와 진단으로 변환한다", async () => {
  for (const code of ["connection_failed", "tls_failed", "request_timeout"]) {
    const { client } = createHttpsClient({
      requestPinned: async () => {
        throw new PalworldPinnedTransportError(code);
      }
    });
    await assert.rejects(
      () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
      (error) => {
        assertClientError(error, code, code === "tls_failed" ? "tls" : "dns_tcp");
        const failedKeys = error.diagnostics.filter((entry) => entry.state === "failed").map((entry) => entry.key);
        assert.equal(failedKeys.includes("info"), true);
        return true;
      }
    );
  }
});

test("PalworldServerClient는 info 성공 후 metrics 실패 시 degraded와 info를 보존한다", async () => {
  const { client } = createHttpsClient({
    requestPinned: async (request) => {
      if (request.url.pathname === "/v1/api/info") return jsonResponse(VALID_INFO);
      throw new PalworldPinnedTransportError("request_timeout");
    }
  });
  const result = await client.probe({
    baseUrl: "https://pal.example:8212",
    adminPassword: "secret-password"
  });
  assert.equal(result.state, "degraded");
  assert.equal(result.errorCode, "request_timeout");
  assert.deepEqual(result.info, { serverName: "세이가 Palworld", version: "v1.0.0" });
  assert.equal(result.metrics, undefined);
  assert.deepEqual(result.diagnostics.find((entry) => entry.key === "metrics"), {
    key: "metrics",
    state: "failed",
    errorCode: "request_timeout"
  });
});

test("metrics 연결에서 발생한 TLS 인증서 오류도 tls_failed로 즉시 판정한다", async () => {
  const { client } = createHttpsClient({
    requestPinned: async (request) => {
      if (request.url.pathname === "/v1/api/info") return jsonResponse(VALID_INFO);
      throw new PalworldPinnedTransportError("tls_failed");
    }
  });
  await assert.rejects(
    () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
    (error) => assertClientError(error, "tls_failed", "tls")
  );
});

test("PalworldServerClient는 DNS 조회도 전체 deadline 안에서 중단한다", async () => {
  let resolverTimer;
  let requestCount = 0;
  const client = new PalworldServerClient({
    allowedOrigins: ["https://pal.example:8212"],
    timeoutMs: 150
  }, {
    resolveHostname: () => new Promise((resolve) => {
      resolverTimer = setTimeout(() => resolve([{ address: "8.8.8.8", family: 4 }]), 1_000);
    }),
    requestPinned: async () => {
      requestCount += 1;
      return jsonResponse(VALID_INFO);
    }
  });

  const startedAt = performance.now();
  try {
    await assert.rejects(
      () => client.probe({ baseUrl: "https://pal.example:8212", adminPassword: "secret-password" }),
      (error) => assertClientError(error, "request_timeout", "dns_tcp")
    );
    const elapsedMs = performance.now() - startedAt;
    assert.equal(elapsedMs >= 100, true);
    assert.equal(elapsedMs < 500, true);
    assert.equal(requestCount, 0);
  } finally {
    clearTimeout(resolverTimer);
  }
});

test("PalworldServerClient는 DNS와 두 endpoint가 하나의 합산 deadline을 공유한다", async () => {
  const operationTimers = [];
  const requestTimeouts = [];
  const delayed = (value, delayMs) => new Promise((resolve) => {
    const timer = setTimeout(() => resolve(value), delayMs);
    operationTimers.push(timer);
  });
  const client = new PalworldServerClient({
    allowedOrigins: ["https://pal.example:8212"],
    timeoutMs: 220
  }, {
    resolveHostname: () => delayed([{ address: "8.8.8.8", family: 4 }], 60),
    requestPinned: (request) => {
      requestTimeouts.push(request.timeoutMs);
      return request.url.pathname === "/v1/api/info"
        ? delayed(jsonResponse(VALID_INFO), 80)
        : delayed(jsonResponse(VALID_METRICS), 500);
    }
  });

  const startedAt = performance.now();
  try {
    const result = await client.probe({
      baseUrl: "https://pal.example:8212",
      adminPassword: "secret-password"
    });
    const elapsedMs = performance.now() - startedAt;
    assert.equal(result.state, "degraded");
    assert.equal(result.errorCode, "request_timeout");
    assert.deepEqual(result.info, { serverName: "세이가 Palworld", version: "v1.0.0" });
    assert.equal(result.metrics, undefined);
    assert.equal(elapsedMs >= 170, true);
    assert.equal(elapsedMs < 500, true);
    assert.equal(requestTimeouts.length, 2);
    assert.equal(requestTimeouts[0] < 220, true, "DNS 시간만큼 /info 제한이 줄어야 합니다.");
    assert.equal(requestTimeouts[1] < requestTimeouts[0], true, "/metrics는 /info 이후 남은 시간만 사용해야 합니다.");
  } finally {
    for (const timer of operationTimers) clearTimeout(timer);
  }
});

test("기본 Node HTTP transport는 hostname을 유지하며 검증된 사설 IP 하나에만 연결한다", async (context) => {
  const address = nonLoopbackPrivateIpv4();
  if (!address) {
    context.skip("실제 hostname 전송에 사용할 non-loopback 사설 IPv4 인터페이스가 없습니다.");
    return;
  }

  const received = [];
  const expectedAuthorization = `Basic ${Buffer.from("admin:integration-secret").toString("base64")}`;
  const server = createServer((request, response) => {
    received.push({
      method: request.method,
      url: request.url,
      host: request.headers.host,
      authorization: request.headers.authorization,
      remoteAddress: request.socket.remoteAddress
    });
    const body = request.url === "/v1/api/info"
      ? VALID_INFO
      : request.url === "/v1/api/metrics"
        ? VALID_METRICS
        : { error: "not_found" };
    response.writeHead(request.url === "/v1/api/info" || request.url === "/v1/api/metrics" ? 200 : 404, {
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify(body));
  });

  try {
    try {
      await listen(server, address);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        context.skip("실행 환경이 non-loopback local listen을 허용하지 않습니다.");
        return;
      }
      throw error;
    }
    const serverAddress = server.address();
    assert.equal(typeof serverAddress, "object");
    const port = serverAddress.port;
    const hostname = "palworld-pinned.integration.invalid";
    const client = new PalworldServerClient({
      allowedOrigins: [`http://${hostname}:${port}`],
      allowedCidrs: [`${address}/32`],
      timeoutMs: 5_000
    }, {
      resolveHostname: async (requestedHostname) => {
        assert.equal(requestedHostname, hostname);
        return [{ address, family: 4 }];
      }
    });

    const result = await client.probe({
      baseUrl: `http://${hostname}:${port}`,
      adminPassword: "integration-secret"
    });
    assert.equal(result.state, "online");
    assert.deepEqual(received.map((request) => request.method), ["GET", "GET"]);
    assert.deepEqual(received.map((request) => request.url), ["/v1/api/info", "/v1/api/metrics"]);
    assert.deepEqual(received.map((request) => request.host), [
      `${hostname}:${port}`,
      `${hostname}:${port}`
    ]);
    assert.equal(received.every((request) => request.authorization === expectedAuthorization), true);
    assert.equal(received.every((request) => request.remoteAddress === address), true);
  } finally {
    if (server.listening) await close(server);
  }
});

test("기본 Node HTTPS transport는 pinned hostname의 신뢰되지 않은 인증서를 tls_failed로 변환한다", async (context) => {
  const address = nonLoopbackPrivateIpv4();
  if (!address) {
    context.skip("실제 HTTPS 전송에 사용할 non-loopback 사설 IPv4 인터페이스가 없습니다.");
    return;
  }

  let requestCount = 0;
  const server = createHttpsServer({ key: TEST_TLS_KEY, cert: TEST_TLS_CERT }, (_request, response) => {
    requestCount += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(VALID_INFO));
  });

  try {
    try {
      await listen(server, address);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        context.skip("실행 환경이 non-loopback local TLS listen을 허용하지 않습니다.");
        return;
      }
      throw error;
    }
    const serverAddress = server.address();
    assert.equal(typeof serverAddress, "object");
    const hostname = "palworld-pinned.integration.invalid";
    const client = new PalworldServerClient({
      allowedOrigins: [`https://${hostname}:${serverAddress.port}`],
      allowedCidrs: [`${address}/32`],
      timeoutMs: 5_000
    }, {
      resolveHostname: async (requestedHostname) => {
        assert.equal(requestedHostname, hostname);
        return [{ address, family: 4 }];
      }
    });

    await assert.rejects(
      client.probe({
        baseUrl: `https://${hostname}:${serverAddress.port}`,
        adminPassword: "integration-secret"
      }),
      (error) => assertClientError(error, "tls_failed", "tls")
    );
    assert.equal(requestCount, 0, "TLS 검증 실패 전에 HTTP 요청 본문을 보내면 안 됩니다.");
  } finally {
    if (server.listening) await close(server);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let storedLocale: "ko" | "ja" | null = null;

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    location: { search: "", assign: () => undefined },
    navigator: { language: "ko-KR" },
    localStorage: {
      getItem: () => storedLocale,
      setItem: (_key: string, value: string) => {
        storedLocale = value === "ja" ? "ja" : "ko";
      }
    },
    setTimeout,
    clearTimeout
  }
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    language: "ko-KR",
    clipboard: { writeText: async () => undefined }
  }
});

test("Bot 관리 화면은 초기 상태와 한국어·일본어 접근성 문구를 함께 제공한다", async () => {
  const { BotManagementPage } = await import(
    "../src/features/bot-management/BotManagementPage"
  );
  storedLocale = "ko";
  const koMarkup = renderToStaticMarkup(<BotManagementPage />);
  storedLocale = "ja";
  const jaMarkup = renderToStaticMarkup(<BotManagementPage />);
  assert.match(koMarkup, /Organization 관리/u);
  assert.match(jaMarkup, /Organization 管理/u);
  assert.match(koMarkup, /aria-busy="true"/u);
  assert.match(koMarkup, /Organization 관리 정보를 불러오는 중입니다/u);
  assert.doesNotMatch(koMarkup, /installToken|csrfToken|accessToken|refreshToken/u);
  assert.doesNotMatch(koMarkup, /docker run|:latest/u);
});

test("관리 로그인 URL은 통합 YORO 로그인과 안전한 복귀 경로만 사용한다", async () => {
  const {
    botInstallUrl,
    managementConnectUrl,
    managementLoginUrl
  } = await import("../src/features/bot-management/api");
  const url = new URL(managementLoginUrl(), "https://yoro.gg");
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("return_to"), "/dashboard/organizations");
  assert.equal(url.hash, "");
  assert.equal(
    new URL(managementConnectUrl(), "https://yoro.gg").pathname,
    "/api/discord/management/connect/start"
  );
  assert.equal(
    new URL(botInstallUrl(), "https://yoro.gg").pathname,
    "/api/discord/bot/install"
  );
});

test("Organization이 없는 인증 session만 Discord Guild 연결이 필요하다", async () => {
  const { managementSessionNeedsGuildConnection } = await import(
    "../src/features/bot-management/api"
  );
  assert.equal(
    managementSessionNeedsGuildConnection({
      authenticated: true,
      csrfToken: "not-a-real-token",
      organizations: []
    }),
    true
  );
  assert.equal(
    managementSessionNeedsGuildConnection({
      authenticated: true,
      csrfToken: "not-a-real-token",
      organizations: [{
        id: "organization-1",
        displayName: "테스트 Organization",
        role: "owner"
      }]
    }),
    false
  );
  assert.equal(
    managementSessionNeedsGuildConnection({ authenticated: false }),
    false
  );
});

test("Palworld REST 저장 API는 Organization 경로·CSRF·credentials와 Shared 응답 검증을 유지한다", async () => {
  const {
    saveManagementPalworldRestConnection
  } = await import("../src/features/bot-management/api");
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify({
      enabled: true,
      pollIntervalSeconds: 30,
      registrationPolicy: {
        publicHttpsSelfService: true,
        publicHttpsPort: 443,
        privateNetworkRequiresOperatorApproval: true
      },
      connection: {
        configured: true,
        baseUrl: "https://pal.example.com",
        passwordConfigured: true,
        updatedAt: "2026-07-30T00:00:00.000Z"
      },
      status: {
        state: "online",
        checkedAt: "2026-07-30T00:00:00.000Z",
        lastSuccessAt: "2026-07-30T00:00:00.000Z",
        latencyMs: 20,
        consecutiveFailures: 0,
        info: { serverName: "검증 서버", version: "v0.6.6" },
        metrics: {
          serverFps: 60,
          currentPlayers: 1,
          maxPlayers: 32,
          frameTimeMs: 16.67,
          uptimeSeconds: 3600,
          baseCampCount: 2,
          gameDays: 20
        },
        diagnostics: [
          "url_policy",
          "dns_tcp",
          "tls",
          "basic_auth",
          "info",
          "metrics",
          "schema"
        ].map((key) => ({ key, state: "passed" }))
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;
  try {
    const response = await saveManagementPalworldRestConnection({
      organizationId: "11111111-1111-4111-8111-111111111111",
      gameServerId: "33333333-3333-4333-8333-333333333333",
      csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456",
      value: {
        baseUrl: "https://pal.example.com",
        adminPassword: "palworld-admin-password"
      }
    });
    assert.equal(response.status.state, "online");
    assert.match(requests[0]?.input ?? "", /\/palworld-rest\/save$/u);
    assert.equal(requests[0]?.init?.credentials, "include");
    assert.equal(
      (requests[0]?.init?.headers as Record<string, string>)["X-Discord-CSRF"],
      "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
    );
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      baseUrl: "https://pal.example.com",
      adminPassword: "palworld-admin-password"
    });
    assert.doesNotMatch(JSON.stringify(response), /palworld-admin-password/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Palworld REST 서버 상태는 등록과 실제 연결을 구분해 표시한다", async () => {
  const { botManagementConnectionStatusPresentation } = await import(
    "../src/features/bot-management/BotManagementPage"
  );
  assert.deepEqual(
    botManagementConnectionStatusPresentation("not_configured", "ko"),
    {
      label: "REST 미설정",
      description: "REST 주소와 AdminPassword가 아직 저장되지 않았습니다.",
      tone: "info"
    }
  );
  assert.equal(
    botManagementConnectionStatusPresentation("pending", "ja").label,
    "接続確認中"
  );
  assert.equal(
    botManagementConnectionStatusPresentation("ready", "ko").label,
    "REST 연결됨"
  );
  assert.equal(
    botManagementConnectionStatusPresentation("unavailable", "ja").tone,
    "danger"
  );
  assert.equal(
    botManagementConnectionStatusPresentation("revoked", "ko").label,
    "비활성화됨"
  );
});

test("Organization에는 활성 Palworld 서버 한 개만 표시한다", async () => {
  const { registeredManagementServers } = await import(
    "../src/features/bot-management/BotManagementPage"
  );
  const server = (id: string, isEnabled: boolean) => ({
    id,
    displayName: `서버 ${id}`,
    gameType: "palworld" as const,
    region: "asia" as const,
    connectionType: "rest" as const,
    connectionStatus: isEnabled ? "not_configured" as const : "revoked" as const,
    isEnabled,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z"
  });
  assert.deepEqual(
    registeredManagementServers([
      server("disabled", false),
      server("active-first", true),
      server("active-second", true)
    ]).map((item) => item.id),
    ["active-first"]
  );
});

test("Palworld 서버 삭제 API는 detail DELETE와 CSRF cookie 인증을 사용한다", async () => {
  const { deleteManagementGameServer } = await import(
    "../src/features/bot-management/api"
  );
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ input: String(input), init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await deleteManagementGameServer({
      organizationId: "11111111-1111-4111-8111-111111111111",
      gameServerId: "33333333-3333-4333-8333-333333333333",
      csrfToken: "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
    });
    assert.match(
      requests[0]?.input ?? "",
      /\/organizations\/11111111-1111-4111-8111-111111111111\/game-servers\/33333333-3333-4333-8333-333333333333$/u
    );
    assert.equal(requests[0]?.init?.method, "DELETE");
    assert.equal(requests[0]?.init?.credentials, "include");
    assert.equal(
      (requests[0]?.init?.headers as Record<string, string>)["X-Discord-CSRF"],
      "csrf_value_abcdefghijklmnopqrstuvwxyz123456"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

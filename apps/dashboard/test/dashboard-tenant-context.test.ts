import assert from "node:assert/strict";
import test from "node:test";

test("스트리머 API와 WebSocket 요청에 URL tenant 식별자를 함께 전달한다", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalWebSocket = globalThis.WebSocket;
  const requests: Array<{ url: string; headers: Headers }> = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { __STREAMOPS_CONFIG__: { apiBase: "http://dashboard.test", wsBase: "ws://dashboard.test" } }
  });
  globalThis.fetch = (async (input, init) => {
    requests.push({
      url: input instanceof Request ? input.url : String(input),
      headers: new Headers(init?.headers)
    });
    return new Response(JSON.stringify({
      required: true,
      authenticated: true,
      role: "streamer"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;

  try {
    const { apiGet, getDashboardAuthStatus } = await import("../src/api/client");
    const socketUrls: string[] = [];
    class TestWebSocket {
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string | URL) {
        socketUrls.push(String(url));
      }

      close(): void {}
    }
    Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: TestWebSocket });
    const { connectDashboardSocket } = await import("../src/api/socket");
    const tenant = {
      streamerSlug: "streamer_name",
      dashboardKey: "sdk_0123456789abcdefghijklmnopqrstuv"
    };

    await getDashboardAuthStatus("streamer", tenant);
    await apiGet("/api/lol-operations");
    const closeSocket = connectDashboardSocket(() => undefined, undefined, "streamer", tenant);

    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.headers.get("X-StreamOps-Dashboard-Surface"), "streamer");
    assert.equal(requests[0]?.headers.get("X-StreamOps-Streamer-Slug"), tenant.streamerSlug);
    assert.equal(requests[0]?.headers.get("X-StreamOps-Dashboard-Key"), tenant.dashboardKey);
    assert.equal(requests[1]?.headers.get("X-StreamOps-Streamer-Slug"), tenant.streamerSlug);
    assert.equal(requests[1]?.headers.get("X-StreamOps-Dashboard-Key"), tenant.dashboardKey);
    assert.equal(
      socketUrls[0],
      `ws://dashboard.test/ws/dashboard?surface=streamer&streamerSlug=${tenant.streamerSlug}&dashboardKey=${tenant.dashboardKey}`
    );
    closeSocket();
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: originalWebSocket });
  }
});

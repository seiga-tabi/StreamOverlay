import test from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");
const { Store } = await import("../dist/services/store.js");

function createRequest(host, url) {
  return {
    method: "GET",
    url,
    headers: { host },
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {}
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) { this.statusCode = statusCode; this.headers = headers; },
    end(chunk = "") { this.body = String(chunk); }
  };
}

test("www 호스트는 경로·쿼리를 보존해 apex로 영구 이동한다", async () => {
  const handler = createHttpHandler({
    store: new Store(),
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    sessions: new DashboardSessionStore(),
    discordDatabaseReady: () => true
  });

  const res = createResponse();
  await handler(createRequest("www.yoro.gg", "/ko/lol?foo=1"), res);
  assert.equal(res.statusCode, 308);
  assert.equal(res.headers.Location, "https://yoro.gg/ko/lol?foo=1");

  // 다른 호스트(로컬·스테이징)는 리다이렉트하지 않습니다.
  const local = createResponse();
  await handler(createRequest("localhost:3000", "/robots.txt"), local);
  assert.notEqual(local.statusCode, 308);
});

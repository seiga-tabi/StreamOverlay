import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const { PatchNotesService } = await import("../dist/services/patch-notes-service.js");

const fixtureDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const koHtml = readFileSync(path.join(fixtureDirectory, "patch-notes-ko.html"), "utf8");
const jaHtml = readFileSync(path.join(fixtureDirectory, "patch-notes-ja.html"), "utf8");

const previousAuthConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  dashboardAuthToken: appConfig.security.dashboardAuthToken
};

before(() => {
  appConfig.security.localNoAuth = true;
  appConfig.security.dashboardAuthToken = "";
});

after(() => {
  appConfig.security.localNoAuth = previousAuthConfig.localNoAuth;
  appConfig.security.dashboardAuthToken = previousAuthConfig.dashboardAuthToken;
});

function createRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator]() {}
  };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk);
    }
  };
}

function handlerWith(patchNotes) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    ...(patchNotes ? { patchNotes } : {})
  });
}

function servingService(htmlByLocale) {
  return new PatchNotesService({
    fetchImpl: async (url) => new Response(
      url.includes("/ja-jp/") ? htmlByLocale.ja : htmlByLocale.ko,
      { status: 200, headers: { "content-type": "text/html" } }
    )
  });
}

async function get(handler, url, headers = {}) {
  const res = createResponse();
  await handler(createRequest("GET", url, headers), res);
  return res;
}

test("패치 노트는 로그인 없이 볼 수 있는 GET 전용 endpoint 다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/public/patch-notes"), "PUBLIC");
  /* 읽기 전용입니다. 쓰기 method 까지 열어 두지 않습니다. */
  assert.notEqual(requiredHttpPrincipal("POST", "/api/public/patch-notes"), "PUBLIC");
  assert.notEqual(requiredHttpPrincipal("DELETE", "/api/public/patch-notes"), "PUBLIC");
});

test("목록을 돌려주고 캐시 헤더를 붙인다", async () => {
  const handler = handlerWith(servingService({ ko: koHtml, ja: jaHtml }));
  const res = await get(handler, "/api/public/patch-notes");
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.schemaVersion, 1);
  assert.equal(body.locale, "ko");
  assert.equal(body.stale, false);
  assert.equal(body.notes.length, 3);
  assert.equal(body.notes[0].slug, "league-of-legends-patch-26-15-notes");
  assert.match(res.headers["Cache-Control"], /max-age=900/u);
  /* 본문은 담지 않습니다. 원문 링크로 보냅니다. */
  assert.equal(body.notes[0].body, undefined);
  assert.match(body.notes[0].url, /^https:\/\/www\.leagueoflegends\.com\//u);
});

test("locale 은 ko·ja 만 받고 나머지는 방문자 언어로 되돌린다", async () => {
  const handler = handlerWith(servingService({ ko: koHtml, ja: jaHtml }));
  assert.equal(JSON.parse((await get(handler, "/api/public/patch-notes?locale=ja")).body).locale, "ja");
  assert.equal(JSON.parse((await get(handler, "/api/public/patch-notes?locale=ko")).body).locale, "ko");
  /* 임의 값이 수집기로 흘러 들어가지 않습니다. */
  for (const bad of ["en", "../../etc", "ko-kr", ""]) {
    const res = await get(handler, `/api/public/patch-notes?locale=${encodeURIComponent(bad)}`);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).locale, "ko", bad);
  }
  const japanese = await get(handler, "/api/public/patch-notes", { "accept-language": "ja-JP,ja;q=0.9" });
  assert.equal(JSON.parse(japanese.body).locale, "ja");
});

test("일본어 요청에는 일본어 제목이 나간다", async () => {
  const handler = handlerWith(servingService({ ko: koHtml, ja: jaHtml }));
  const body = JSON.parse((await get(handler, "/api/public/patch-notes?locale=ja")).body);
  assert.equal(body.notes[0].title, "リーグ・オブ・レジェンド パッチノート 26.15");
  assert.match(body.notes[0].url, /\/ja-jp\//u);
});

test("아직 한 번도 못 받아왔으면 503 이고 캐시하지 않는다", async () => {
  const handler = handlerWith(new PatchNotesService({
    fetchImpl: async () => {
      throw new Error("network down");
    }
  }));
  const res = await get(handler, "/api/public/patch-notes");
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).error, "PATCH_NOTES_UNAVAILABLE");
  assert.equal(res.headers["Cache-Control"], "no-store");
});

test("수집기가 붙어 있지 않아도 500 이 아니라 503 으로 알린다", async () => {
  const res = await get(handlerWith(undefined), "/api/public/patch-notes");
  assert.equal(res.statusCode, 503);
  assert.equal(JSON.parse(res.body).error, "PATCH_NOTES_UNAVAILABLE");
});

test("저장본을 내보낼 때는 오래 캐시하지 않는다", async () => {
  let now = Date.UTC(2026, 7, 9);
  let fail = false;
  const handler = handlerWith(new PatchNotesService({
    fetchImpl: async () => {
      if (fail) throw new Error("network down");
      return new Response(koHtml, { status: 200, headers: { "content-type": "text/html" } });
    },
    now: () => now,
    refreshIntervalMs: 1_000
  }));
  assert.equal(JSON.parse((await get(handler, "/api/public/patch-notes?locale=ko")).body).stale, false);

  fail = true;
  now += 2_000;
  const res = await get(handler, "/api/public/patch-notes?locale=ko");
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).stale, true);
  assert.equal(res.headers["Cache-Control"], "public, max-age=60");
});

test("언어를 query 로 받으면 URL 이 응답을 결정하므로 공용 캐시에 둔다", async () => {
  const handler = handlerWith(servingService({ ko: koHtml, ja: jaHtml }));
  const korean = await get(handler, "/api/public/patch-notes?locale=ko");
  const japanese = await get(handler, "/api/public/patch-notes?locale=ja");
  assert.match(korean.headers["Cache-Control"], /^public,/u);
  assert.match(japanese.headers["Cache-Control"], /^public,/u);
  assert.equal(JSON.parse(korean.body).locale, "ko");
  assert.equal(JSON.parse(japanese.body).locale, "ja");
  /* 언어에 따라 본문이 달라지므로 중간 캐시에 알려 주어야 합니다. */
  assert.equal(korean.headers.Vary, "Accept-Language");
});

test("언어를 header 로 고른 응답은 공용 캐시에 두지 않는다", async () => {
  /* 같은 URL 이 사람마다 다른 본문을 내므로 public 으로 두면
     한국어 방문자에게 일본어 목록이 나갈 수 있습니다. */
  const handler = handlerWith(servingService({ ko: koHtml, ja: jaHtml }));
  const res = await get(handler, "/api/public/patch-notes", { "accept-language": "ja-JP,ja;q=0.9" });
  assert.equal(JSON.parse(res.body).locale, "ja");
  assert.match(res.headers["Cache-Control"], /^private,/u);
  assert.equal(res.headers.Vary, "Accept-Language");
});

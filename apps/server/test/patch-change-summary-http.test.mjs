import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* GET /api/public/patch-notes/changes 계약.
 *
 * 경로가 /summary 가 아닌 이유: summary 는 이미 패치별 개인 전적이 쓰고 있습니다.
 * 이쪽은 누구에게나 같은 공개 데이터 계산 결과라 캐시 정책도 반대입니다. */

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const { PatchChangeSummaryService } = await import("../dist/services/patch-change-summary.js");
const { PatchNotesSocialCardRenderer } = await import("../dist/services/patch-notes-social-card.js");

const previousAuthConfig = {
  localNoAuth: appConfig.security.localNoAuth,
  dashboardAuthToken: appConfig.security.dashboardAuthToken,
};

before(() => {
  appConfig.security.localNoAuth = true;
  appConfig.security.dashboardAuthToken = "";
});

after(() => {
  appConfig.security.localNoAuth = previousAuthConfig.localNoAuth;
  appConfig.security.dashboardAuthToken = previousAuthConfig.dashboardAuthToken;
});

function createRequest(method, url) {
  return { method, url, headers: {}, async *[Symbol.asyncIterator]() {} };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers ?? {};
    },
    end(chunk = "") {
      this.body = String(chunk);
    },
  };
}

async function get(handler, url) {
  const res = createResponse();
  await handler(createRequest("GET", url), res);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : undefined };
}

function note(patchVersion, dataDragonVersion) {
  return {
    slug: `patch-${patchVersion}`,
    title: `패치 ${patchVersion}`,
    publishedAt: "2026-08-18T00:00:00.000Z",
    url: `https://example.test/${patchVersion}`,
    patchVersion,
    ...(dataDragonVersion === undefined ? {} : { dataDragonVersion }),
  };
}

const NOTES = [note("26.16", "16.16.1"), note("26.15", "16.15.1")];

function handlerWith(options = {}) {
  const patchChangeSummary = options.omitService
    ? undefined
    : new PatchChangeSummaryService({
      notesFor: async () => options.notes ?? NOTES,
      championStats: async (version) => (version === "16.16.1"
        ? new Map([[78, { mp: 300, attackdamage: 56 }]])
        : new Map([[78, { mp: 280, attackdamage: 60 }]])),
      itemGold: async (version) => new Map([[3068, version === "16.16.1" ? 2800 : 2700]]),
      championNames: async (_version, locale) => new Map([[78, {
        name: { ko: "뽀삐", ja: "ポッピー", en: "Poppy" }[locale],
        iconUrl: "https://ddragon.leagueoflegends.com/cdn/16.16.1/img/champion/Poppy.png",
      }]]),
      itemNames: async (_version, locale) => new Map([[3068, {
        name: { ko: "태양불꽃 방패", ja: "サンファイア・イージス", en: "Sunfire Aegis" }[locale],
      }]]),
    });
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    ...(patchChangeSummary ? { patchChangeSummary } : {}),
  });
}

test("변경 요약은 로그인 없이 볼 수 있는 GET 전용 endpoint 다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/public/patch-notes/changes"), "PUBLIC");
  assert.notEqual(requiredHttpPrincipal("POST", "/api/public/patch-notes/changes"), "PUBLIC");
});

test("요약은 계약 형태로 나가고 언어는 이름에만 반영된다", async () => {
  const handler = handlerWith();
  const { status, headers, json } = await get(handler, "/api/public/patch-notes/changes?patch=26.16&locale=ko");
  assert.equal(status, 200);
  assert.equal(json.patchVersion, "26.16");
  assert.deepEqual(json.comparedVersions, ["16.15.1", "16.16.1"]);
  /* 마나는 오르고 공격력은 내렸으므로 adjust 입니다. */
  assert.equal(json.championChanges[0].direction, "adjust");
  assert.equal(json.championChanges[0].name, "뽀삐");
  assert.deepEqual(json.itemChanges, [{
    itemId: 3068, name: "태양불꽃 방패", kind: "price", from: 2700, to: 2800,
  }]);
  /* champion.json 에 스킬 수치가 없다는 사실을 응답이 스스로 밝힙니다. */
  assert.equal(json.skillChangesIncluded, false);
  /* locale 이 URL 에 있으므로 공용 캐시에 둘 수 있습니다. */
  assert.match(headers["Cache-Control"], /public, max-age=21600/u);

  const ja = await get(handler, "/api/public/patch-notes/changes?patch=26.16&locale=ja");
  assert.equal(ja.json.championChanges[0].name, "ポッピー");
  assert.equal(ja.json.itemChanges[0].name, "サンファイア・イージス");
  /* 스탯 키는 언어와 무관합니다 — 라벨은 화면이 붙입니다. */
  assert.deepEqual(
    ja.json.championChanges[0].changes.map((change) => change.stat).sort(),
    ["attackdamage", "mp"],
  );

  const en = await get(handler, "/api/public/patch-notes/changes?patch=26.16&locale=en");
  assert.equal(en.json.championChanges[0].name, "Poppy");
  assert.equal(en.json.itemChanges[0].name, "Sunfire Aegis");
});

test("locale 이 없거나 모르는 값이면 ko 로 떨어진다", async () => {
  const handler = handlerWith();
  assert.equal((await get(handler, "/api/public/patch-notes/changes?patch=26.16")).json.championChanges[0].name, "뽀삐");
  assert.equal(
    (await get(handler, "/api/public/patch-notes/changes?patch=26.16&locale=fr")).json.championChanges[0].name,
    "뽀삐",
  );
  assert.equal(
    (await get(handler, "/api/public/patch-notes/changes?patch=26.16&locale=../ko")).json.championChanges[0].name,
    "뽀삐",
  );
});

test("패치 번호 형식이 아니면 400 이다", async () => {
  const handler = handlerWith();
  for (const patch of ["", "26", "abc", "26.16.1", "../etc/passwd", "9999.9999"]) {
    const { status, json } = await get(handler, `/api/public/patch-notes/changes?patch=${encodeURIComponent(patch)}`);
    assert.equal(status, 400, patch);
    assert.equal(json.code, "INVALID_PATCH_VERSION", patch);
  }
});

test("비교 경계가 없으면 404 로 닫는다", async () => {
  /* 직전 노트가 없는 가장 오래된 패치입니다. 프런트는 404 를 받으면 패널을 숨깁니다. */
  const handler = handlerWith();
  const { status, headers, json } = await get(handler, "/api/public/patch-notes/changes?patch=26.15");
  assert.equal(status, 404);
  assert.equal(json.code, "PATCH_CHANGES_NOT_FOUND");
  /* 없다는 응답도 잠깐은 캐시합니다 — 없는 패치를 매번 계산하지 않습니다. */
  assert.match(headers["Cache-Control"], /public, max-age=600/u);

  /* 목록에 아예 없는 패치도 같은 처리입니다. */
  assert.equal((await get(handler, "/api/public/patch-notes/changes?patch=26.99")).status, 404);
});

test("서비스가 없으면 503 이고 캐시에 남기지 않는다", async () => {
  const { status, headers, json } = await get(
    handlerWith({ omitService: true }),
    "/api/public/patch-notes/changes?patch=26.16",
  );
  assert.equal(status, 503);
  assert.equal(json.code, "PATCH_CHANGES_UNAVAILABLE");
  assert.equal(headers["Cache-Control"], "no-store");
});

test("계산이 실패해도 500 이 아니라 404 로 닫는다", async () => {
  /* Data Dragon 이 죽었다고 패치 노트 화면이 오류로 보이면 안 됩니다. */
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    patchChangeSummary: new PatchChangeSummaryService({
      notesFor: async () => NOTES,
      championStats: async () => {
        throw new Error("Data Dragon champion lookup failed: 503");
      },
      itemGold: async () => new Map(),
      championNames: async () => new Map(),
      itemNames: async () => new Map(),
    }),
  });
  const { status, json } = await get(handler, "/api/public/patch-notes/changes?patch=26.16");
  assert.equal(status, 404);
  assert.equal(json.code, "PATCH_CHANGES_NOT_FOUND");
});

/* ── 키 아트 프록시 (핸드오프 요청 ③) ─────────────────────────────────
 *
 * 브라우저가 Riot CDN 에서 직접 받으면 canvas 가 오염돼 공유 카드를 만들 수
 * 없습니다(cmsassets.rgpub.io 는 CORS 헤더를 주지 않습니다). 대상 URL 은
 * 이용자 입력이 아니라 우리가 수집한 노트의 imageUrl 입니다. */

const KEY_ART_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function keyArtHandler(options = {}) {
  const noteImageUrl = options.imageUrl
    ?? "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/patch-26-16.jpg";
  /* 원격을 부르지 않습니다 — 허용 목록을 지난 URL 만 여기로 옵니다. */
  const fetches = [];
  const renderer = new PatchNotesSocialCardRenderer(async (url) => {
    fetches.push(String(url));
    return new Response(KEY_ART_PNG, { status: 200, headers: { "content-type": "image/png" } });
  });
  const handler = createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    patchNotes: {
      async getFeed() {
        return {
          schemaVersion: 1,
          locale: "ko",
          fetchedAt: "2026-08-18T00:00:00.000Z",
          stale: false,
          notes: [{ ...note("26.16", "16.16.1"), imageUrl: noteImageUrl }],
        };
      },
    },
    patchNotesSocialCard: renderer,
  });
  handler.fetches = fetches;
  return handler;
}

async function getBinary(handler, url, headers = {}) {
  const res = createResponse();
  await handler({ method: "GET", url, headers, async *[Symbol.asyncIterator]() {} }, res);
  return { status: res.statusCode, headers: res.headers, body: res.body };
}

test("키 아트는 패치 번호 형식을 강제하고 URL 을 이용자에게서 받지 않는다", async () => {
  const handler = keyArtHandler();
  for (const patch of ["", "abc", "https://evil.test/a.png", "26.16.1"]) {
    const { status, json } = await get(handler, `/api/public/patch-notes/keyart?patch=${encodeURIComponent(patch)}`);
    assert.equal(status, 400, patch);
    assert.equal(json.code, "INVALID_PATCH_VERSION", patch);
  }
});

test("허용 목록 밖 이미지 URL 은 키 아트로 내보내지 않는다", async () => {
  /* 수집 응답이 오염되더라도 우리 서버가 임의 origin 을 대신 받아 주지 않습니다. */
  const { status, json } = await get(
    keyArtHandler({ imageUrl: "https://evil.test/pixel.png" }),
    "/api/public/patch-notes/keyart?patch=26.16",
  );
  assert.equal(status, 404);
  assert.equal(json.code, "PATCH_KEYART_NOT_FOUND");
});

test("피드에 없는 패치의 키 아트는 404 다", async () => {
  const { status } = await get(keyArtHandler(), "/api/public/patch-notes/keyart?patch=26.99");
  assert.equal(status, 404);
});

test("키 아트는 같은 origin PNG 로 나가고 ETag 로 재전송을 막는다", async () => {
  const handler = keyArtHandler();
  const { status, headers } = await getBinary(handler, "/api/public/patch-notes/keyart?patch=26.16");
  assert.equal(status, 200);
  assert.equal(headers["Content-Type"], "image/png");
  assert.match(headers["Cache-Control"], /public, max-age=86400/u);
  /* 허용 목록을 지난 수집 URL 로만 나갑니다. */
  assert.equal(handler.fetches.length, 1);
  assert.match(handler.fetches[0], /^https:\/\/cmsassets\.rgpub\.io\//u);

  const notModified = await getBinary(
    handler,
    "/api/public/patch-notes/keyart?patch=26.16",
    { "if-none-match": headers.ETag },
  );
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body, "");
  /* 두 번째 요청은 캐시에서 나오므로 원격을 다시 부르지 않습니다. */
  assert.equal(handler.fetches.length, 1);
});

test("영어 키 아트 locale을 허용하고 허용 목록 밖 값은 ko로 닫는다", async () => {
  const english = await getBinary(
    keyArtHandler(),
    "/api/public/patch-notes/keyart?patch=26.16&locale=en",
  );
  assert.equal(english.status, 200);
  assert.match(english.headers.ETag, /patch-keyart-en-26\.16/u);

  const invalid = await getBinary(
    keyArtHandler(),
    "/api/public/patch-notes/keyart?patch=26.16&locale=..%2Fko",
  );
  assert.equal(invalid.status, 200);
  assert.match(invalid.headers.ETag, /patch-keyart-ko-26\.16/u);
});

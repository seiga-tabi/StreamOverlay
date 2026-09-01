import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const { GameSocialCardRenderer } = await import("../dist/services/game-social-card.js");
const { createHttpHandler } = await import("../dist/routes/http-api.js");

const BOXART_URL = "https://static-cdn.jtvnw.net/ttv-boxart/21779-285x380.jpg";

function boxartProvider(boxArtUrl = BOXART_URL) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    async getBoxart() {
      calls += 1;
      return [
        { key: "lol", boxArtUrl },
        { key: "palworld", boxArtUrl: null },
        { key: "valorant", boxArtUrl: null },
        { key: "minecraft", boxArtUrl: null },
      ];
    },
  };
}

test("게임 공유 카드는 검증된 Twitch JPEG를 합성하고 게임별 결과를 캐시한다", async () => {
  const source = await sharp({
    create: { width: 285, height: 380, channels: 3, background: { r: 95, g: 52, b: 145 } },
  }).jpeg().toBuffer();
  const provider = boxartProvider();
  let fetchCalls = 0;
  const renderer = new GameSocialCardRenderer(provider, async (url, init) => {
    fetchCalls += 1;
    assert.equal(String(url), BOXART_URL);
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(source, {
      status: 200,
      headers: { "content-type": "image/jpeg", "content-length": String(source.length) },
    });
  });

  const [first, concurrent] = await Promise.all([renderer.render("lol"), renderer.render("lol")]);
  const second = await renderer.render("lol");
  const metadata = await sharp(first).metadata();

  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.equal(provider.calls, 1);
  assert.equal(fetchCalls, 1);
  assert.deepEqual(first, concurrent);
  assert.deepEqual(first, second);
});

test("박스아트 fetch가 실패하면 고정 그라디언트와 워드마크로 fail-open 한다", async () => {
  const provider = boxartProvider(BOXART_URL.replace("21779", "27471"));
  const failed = new GameSocialCardRenderer(provider, async () => {
    throw new Error("Twitch CDN timeout");
  });
  const noArt = new GameSocialCardRenderer(boxartProvider(null), async () => {
    throw new Error("URL이 없으면 fetch하면 안 됩니다.");
  });

  const failedBody = await failed.render("lol");
  const noArtBody = await noArt.render("lol");
  const metadata = await sharp(failedBody).metadata();

  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
  assert.deepEqual(failedBody, noArtBody, "fetch 실패 결과는 박스아트 없는 고정 그라디언트와 같아야 합니다");
});

test("박스아트 fetch 실패 결과는 5분 뒤 만료되어 다시 합성을 시도한다", async () => {
  let now = 0;
  let fetchCalls = 0;
  const renderer = new GameSocialCardRenderer(
    boxartProvider(),
    async () => {
      fetchCalls += 1;
      throw new Error("Twitch CDN timeout");
    },
    undefined,
    () => now,
  );

  await renderer.render("lol");
  await renderer.render("lol");
  assert.equal(fetchCalls, 1, "5분 전에는 그라디언트 fallback 캐시를 재사용해야 합니다");

  now = 5 * 60 * 1000;
  await renderer.render("lol");
  assert.equal(fetchCalls, 2, "5분 경과 시 박스아트를 다시 가져와야 합니다");
});

test("MIME과 시그니처가 어긋난 원격 이미지는 합성하지 않는다", async () => {
  const invalid = Buffer.from("not-a-jpeg");
  const rejected = new GameSocialCardRenderer(boxartProvider(), async () => new Response(invalid, {
    status: 200,
    headers: { "content-type": "image/jpeg", "content-length": String(invalid.length) },
  }));
  const noArt = new GameSocialCardRenderer(boxartProvider(null));

  assert.deepEqual(await rejected.render("lol"), await noArt.render("lol"));
});

test("Twitch CDN 밖의 URL은 fetch 전에 거부하고, PNG 박스아트도 안전하게 허용한다", async () => {
  let rejectedFetchCalls = 0;
  const rejected = new GameSocialCardRenderer(boxartProvider("https://example.com/ttv-boxart/21779-285x380.jpg"), async () => {
    rejectedFetchCalls += 1;
    throw new Error("허용되지 않은 호스트는 fetch하면 안 됩니다.");
  });
  await rejected.render("lol");
  assert.equal(rejectedFetchCalls, 0);

  const png = await sharp({
    create: { width: 285, height: 380, channels: 4, background: { r: 18, g: 180, b: 90, alpha: 1 } },
  }).png().toBuffer();
  const accepted = new GameSocialCardRenderer(boxartProvider(), async () => new Response(png, {
    status: 200,
    headers: { "content-type": "image/png", "content-length": String(png.length) },
  }));
  const noArt = new GameSocialCardRenderer(boxartProvider(null));

  assert.notDeepEqual(await accepted.render("lol"), await noArt.render("lol"));
});

test("봇 공유 카드는 GameBoxartService와 fetch를 전혀 호출하지 않는다", async () => {
  const provider = boxartProvider();
  let fetchCalls = 0;
  const renderer = new GameSocialCardRenderer(provider, async () => {
    fetchCalls += 1;
    throw new Error("봇은 원격 이미지를 요청하면 안 됩니다.");
  });

  const body = await renderer.render("bot");
  const metadata = await sharp(body).metadata();

  assert.equal(provider.calls, 0);
  assert.equal(fetchCalls, 0);
  assert.equal(metadata.width, 1200);
  assert.equal(metadata.height, 630);
});

function createRequest(method, url, headers = {}) {
  return { method, url, headers: { host: "yoro.gg", ...headers }, async *[Symbol.asyncIterator]() {} };
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: Buffer.alloc(0),
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers ?? {};
    },
    end(chunk) {
      this.body = chunk === undefined ? Buffer.alloc(0) : Buffer.from(chunk);
    },
  };
}

async function request(handler, method, url, headers = {}) {
  const response = createResponse();
  await handler(createRequest(method, url, headers), response);
  return response;
}

test("게임 공유 이미지 라우트는 PNG·일일 캐시·본문 기반 ETag와 304를 제공한다", async () => {
  const body = await sharp({
    create: { width: 1200, height: 630, channels: 4, background: { r: 74, g: 47, b: 120, alpha: 1 } },
  }).png().toBuffer();
  let renderCalls = 0;
  const handler = createHttpHandler({
    store: { getParticipationQueue: () => [] },
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    gameSocialCard: {
      async render(key) {
        renderCalls += 1;
        assert.equal(key, "lol");
        return body;
      },
    },
  });

  const first = await request(handler, "GET", "/social/game/lol.png");
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["Content-Type"], "image/png");
  assert.match(first.headers["Cache-Control"], /max-age=86400/u);
  assert.match(first.headers.ETag, /^"game-social-lol-[a-f0-9]{16}"$/u);
  assert.deepEqual(first.body, body);

  const notModified = await request(handler, "GET", "/social/game/lol.png", { "if-none-match": first.headers.ETag });
  assert.equal(notModified.statusCode, 304);
  assert.equal(notModified.body.length, 0);

  const head = await request(handler, "HEAD", "/social/game/lol.png");
  assert.equal(head.statusCode, 200);
  assert.equal(head.body.length, 0);
  assert.equal(renderCalls, 3);
});

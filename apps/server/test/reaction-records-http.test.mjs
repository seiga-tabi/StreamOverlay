import test, { after, before } from "node:test";
import assert from "node:assert/strict";

/* 반응속도 기록 API 계약 — 목업 reaction-test.html v5 §④-2~④-5.
 *
 * 저장소는 Postgres 대신 인메모리 페이크를 주입합니다. 여기서 검증할 것은 SQL 이
 * 아니라 라우트 계약(인증·검증·rate limit·익명성)이기 때문입니다. SQL 자체는
 * migration 의 CHECK 제약과 repository 쿼리가 담당합니다. */

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { appConfig } = await import("../dist/config.js");

const ORIGIN = "http://localhost:3000";
const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

const previous = {
  corsOrigins: [...appConfig.security.corsOrigins],
  nodeEnv: appConfig.nodeEnv
};

before(() => {
  appConfig.security.corsOrigins = [ORIGIN];
  appConfig.nodeEnv = "development";
});

after(() => {
  appConfig.security.corsOrigins = previous.corsOrigins;
  appConfig.nodeEnv = previous.nodeEnv;
});

function createRequest(method, url, body, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body));
    }
  };
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
    }
  };
}

/** repository 인터페이스만 흉내 냅니다 — 순위·통계 규칙은 실제 구현과 같게. */
function createFakeRepository() {
  const rows = new Map();
  let sequence = 0;
  const ranked = () => [...rows.values()]
    .sort((a, b) => a.averageMs - b.averageMs || a.sequence - b.sequence)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  return {
    rows,
    async leaderboard(limit) {
      return ranked().slice(0, limit);
    },
    async findByUser(userId) {
      return ranked().find((row) => row.userId === userId);
    },
    async findByShareId(shareId) {
      return ranked().find((row) => row.shareId === shareId);
    },
    async stats() {
      const averages = ranked().map((row) => row.averageMs);
      return { total: averages.length, averages };
    },
    async upsert({ userId, averageMs, samples, identity }) {
      const existing = rows.get(userId);
      if (existing) {
        /* 더 빠를 때만 기록 갱신, identity 는 항상 갱신 */
        if (averageMs < existing.averageMs) {
          existing.averageMs = averageMs;
          existing.samples = samples;
        }
        existing.identity = identity;
      } else {
        sequence += 1;
        rows.set(userId, {
          userId, averageMs, samples, identity,
          anonymousNo: 4_821,
          shareId: `share${String(sequence).padStart(6, "0")}`,
          displayName: userId === USER_A ? "YORO QA" : "다른 소환사",
          updatedAt: new Date("2026-08-17T00:00:00.000Z").toISOString(),
          sequence
        });
      }
      return ranked().find((row) => row.userId === userId);
    },
    async deleteByUser(userId) {
      return rows.delete(userId);
    }
  };
}

/** 세션 쿠키 값을 그대로 userId 로 취급하는 최소 계정 서비스. */
function createFakeAccounts() {
  return {
    async authenticateForManagement(cookie) {
      if (!cookie) return undefined;
      return { userId: cookie, csrfToken: "csrf-token" };
    },
    async session(cookie) {
      if (!cookie) return undefined;
      return {
        authenticated: true,
        csrfToken: "csrf-token",
        identities: [{ provider: "twitch", displayName: cookie === USER_A ? "YORO QA" : "다른 소환사" }]
      };
    },
    async getTwitchAccessContext() {
      return undefined;
    }
  };
}

function setup() {
  const reactionRecords = createFakeRepository();
  const handler = createHttpHandler({
    reactionRecords,
    yoroAccounts: createFakeAccounts()
  });
  return { handler, reactionRecords };
}

async function call(handler, method, url, { body, cookie, origin = ORIGIN } = {}) {
  const headers = { host: "localhost:3000" };
  if (cookie) headers.cookie = `yoro_session=${cookie}`;
  if (origin) headers.origin = origin;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = createResponse();
  await handler(createRequest(method, url, body, headers), res);
  return { status: res.statusCode, headers: res.headers, json: res.body ? JSON.parse(res.body) : undefined };
}

const VALID = { averageMs: 200, samples: [190, 200, 210, 195, 205], identity: "public" };

test("비로그인은 등록·삭제가 401 이고 리더보드는 200 이다", async () => {
  const { handler } = setup();
  assert.equal((await call(handler, "POST", "/api/games/reaction/records", { body: VALID })).status, 401);
  assert.equal((await call(handler, "DELETE", "/api/games/reaction/records/me")).status, 401);

  const board = await call(handler, "GET", "/api/games/reaction/leaderboard");
  assert.equal(board.status, 200);
  assert.deepEqual(board.json.entries, []);
  assert.equal(board.json.me, undefined, "비로그인에는 me 가 없습니다");
});

test("신뢰할 수 없는 Origin 의 등록은 403 이다", async () => {
  const { handler } = setup();
  const denied = await call(handler, "POST", "/api/games/reaction/records", {
    body: VALID, cookie: USER_A, origin: "https://evil.example"
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.json.code, "origin_denied");
});

test("등록은 shareId 를 주고 더 느린 기록은 갱신하지 않는다", async () => {
  const { handler, reactionRecords } = setup();
  const first = await call(handler, "POST", "/api/games/reaction/records", { body: VALID, cookie: USER_A });
  assert.equal(first.status, 200);
  assert.match(first.json.shareId, /^[A-Za-z0-9_-]{8,}$/u);
  assert.equal(first.json.rank, 1);

  /* rate limit 을 넘겨 다음 요청을 보냅니다 — 같은 계정 1분 1회이므로
     테스트에서는 저장소를 직접 확인하는 편이 확실합니다. */
  const slower = { averageMs: 400, samples: [400, 400, 400, 400, 400], identity: "anonymous" };
  await reactionRecords.upsert({ userId: USER_A, ...slower, samples: slower.samples });
  const row = reactionRecords.rows.get(USER_A);
  assert.equal(row.averageMs, 200, "느린 기록은 average 를 후퇴시키지 않습니다");
  assert.equal(row.identity, "anonymous", "identity 는 항상 갱신됩니다(공개 방식 변경)");
});

test("등록은 계정당 1분 1회로 제한된다", async () => {
  const { handler } = setup();
  assert.equal((await call(handler, "POST", "/api/games/reaction/records", { body: VALID, cookie: USER_B })).status, 200);
  const second = await call(handler, "POST", "/api/games/reaction/records", { body: VALID, cookie: USER_B });
  assert.equal(second.status, 429);
  assert.equal(second.json.code, "rate_limited");
  assert.ok(Number(second.headers["Retry-After"]) > 0);
});

test("형식이 어긋난 기록은 400 이다", async () => {
  const { handler } = setup();
  const bad = await call(handler, "POST", "/api/games/reaction/records", {
    body: { averageMs: 130, samples: [190, 200, 210, 195, 205], identity: "public" },
    cookie: USER_A
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.code, "invalid_request");
});

test("리더보드는 익명 기록에 이름을 싣지 않고 me 를 함께 준다", async () => {
  const { handler, reactionRecords } = setup();
  await reactionRecords.upsert({ userId: USER_A, averageMs: 180, samples: [180, 180, 180, 180, 180], identity: "anonymous" });
  await reactionRecords.upsert({ userId: USER_B, averageMs: 220, samples: [220, 220, 220, 220, 220], identity: "public" });

  const board = await call(handler, "GET", "/api/games/reaction/leaderboard", { cookie: USER_A });
  assert.equal(board.status, 200);
  assert.equal(board.json.entries.length, 2);

  const [top, second] = board.json.entries;
  assert.equal(top.rank, 1);
  assert.equal(top.displayName, undefined, "익명 기록은 이름을 내보내지 않습니다");
  assert.equal(top.anonymousLabel, "#4821");
  assert.equal(top.tierKey, "master");
  assert.equal(second.displayName, "다른 소환사");

  assert.equal(board.json.me.shareId, "share000001");
  assert.equal(board.json.me.identity, "anonymous");
  assert.equal(board.json.me.rank, 1);
  assert.equal(board.json.total, 2);
  assert.ok(board.json.tierDistribution.some((item) => item.tierKey === "master" && item.count === 1));

  /* 로그인 응답은 사용자마다 다르므로 공유 캐시에 올리면 안 됩니다. */
  assert.match(String(board.headers["Cache-Control"]), /no-store/u);
});

test("공유 링크는 계정 식별자를 노출하지 않고 삭제 후 404 가 된다", async () => {
  const { handler, reactionRecords } = setup();
  await reactionRecords.upsert({ userId: USER_A, averageMs: 180, samples: [180, 180, 180, 180, 180], identity: "public" });
  await reactionRecords.upsert({ userId: USER_B, averageMs: 260, samples: [260, 260, 260, 260, 260], identity: "public" });

  const shared = await call(handler, "GET", "/api/games/reaction/records/share000001");
  assert.equal(shared.status, 200);
  assert.equal(shared.json.averageMs, 180);
  assert.equal(shared.json.tierKey, "master");
  assert.equal(shared.json.displayName, "YORO QA");
  assert.equal(shared.json.percentile, 50);
  assert.ok(shared.json.at);

  /* 계정 식별자(내부 id·Twitch id)가 어떤 필드로도 새어 나가면 안 됩니다(§④-5). */
  const serialized = JSON.stringify(shared.json);
  assert.ok(!serialized.includes(USER_A));
  assert.equal(shared.json.userId, undefined);
  assert.equal(shared.json.samples, undefined, "samples 는 저장만 하고 재노출하지 않습니다");

  const removed = await call(handler, "DELETE", "/api/games/reaction/records/me", { cookie: USER_A });
  assert.equal(removed.status, 204);
  assert.equal((await call(handler, "GET", "/api/games/reaction/records/share000001")).status, 404);
});

test("없는 공유 id 는 404 이고 저장소가 없으면 503 이다", async () => {
  const { handler } = setup();
  assert.equal((await call(handler, "GET", "/api/games/reaction/records/nosuchid12345")).status, 404);

  const withoutStore = createHttpHandler({ yoroAccounts: createFakeAccounts() });
  const board = await call(withoutStore, "GET", "/api/games/reaction/leaderboard");
  assert.equal(board.status, 503, "저장소가 없으면 프런트가 기능 전체를 숨깁니다(fail-closed)");
  assert.equal(board.json.code, "feature_unavailable");
});

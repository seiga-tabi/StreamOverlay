import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { DashboardSessionStore } = await import("../dist/security/auth.js");

/* 실제 Node.js IncomingMessage처럼 EventEmitter를 상속한 mock request입니다.
   'close' 이벤트를 흉내 내 서버가 클라이언트 연결 종료(검색 취소)를 감지하는지
   검증합니다 — 프로젝트의 다른 http-api 테스트가 쓰는 plain object mock으로는
   이 경로(req.on)를 재현할 수 없습니다. */
class MockRequest extends EventEmitter {
  constructor(method, url, headers = {}) {
    super();
    this.method = method;
    this.url = url;
    this.headers = headers;
    this.socket = { remoteAddress: "127.0.0.1" };
  }

  async *[Symbol.asyncIterator]() {}
}

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    writableEnded: false,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk);
      this.writableEnded = true;
    }
  };
}

function baseHandlerInput(riotOverrides = {}) {
  return {
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    sessions: new DashboardSessionStore(),
    dataDragon: {
      async getLatestVersion() { return "16.11.1"; }
    },
    riot: {
      isConfigured() { return true; },
      routingStatus() { return { configured: true, source: "runtime", accountRegion: "asia", lolPlatform: "jp1" }; },
      ...riotOverrides
    }
  };
}

test("H. 클라이언트가 검색 도중 연결을 끊으면(req close) Riot API 호출이 signal.aborted로 감지된다", async () => {
  let observedSignalAborted = "not-called";
  let resolveGetAccount;
  const getAccountStarted = new Promise((resolve) => { resolveGetAccount = resolve; });

  const handler = createHttpHandler(baseHandlerInput({
    async getAccountByRiotId(gameName, tagLine, routing, signal) {
      resolveGetAccount();
      /* 실제 RiotApiClient처럼 signal이 나중에 abort되는 것을 관찰합니다. */
      await new Promise((resolve) => {
        signal?.addEventListener("abort", () => {
          observedSignalAborted = true;
          resolve();
        }, { once: true });
        /* signal이 끝까지 안 오면 테스트가 걸리지 않도록 타임아웃 안전장치. */
        setTimeout(resolve, 500);
      });
      if (signal?.aborted) {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }
      return { puuid: "should-not-resolve", gameName, tagLine };
    }
  }));

  const req = new MockRequest("GET", "/api/lol/profile?riotId=Cancelled%23KR1");
  const res = createResponse();
  const handlerPromise = handler(req, res);

  /* 서버가 실제로 getAccountByRiotId 호출을 시작할 때까지 기다린 뒤,
     클라이언트가 연결을 끊은 것처럼 'close'를 흉내 냅니다 — 응답은 아직
     안 보냈으므로(writableEnded=false) 실제 취소로 처리되어야 합니다. */
  await getAccountStarted;
  req.emit("close");

  await handlerPromise;
  assert.equal(observedSignalAborted, true, "req의 close 이벤트가 하위 Riot API 호출의 signal까지 전파되어야 합니다");
  /* 취소된 요청에 대해 500 오류 응답으로 응답을 보내면 안 됩니다(연결이 이미 끊김) —
     정책 5절: abort를 서버 장애로 오인해 에러 응답/로그를 만들지 않습니다. */
  assert.equal(res.statusCode, 0, "취소된 요청에는 응답을 시도하지 않아야 합니다");
});

test("정상 완료된 요청은 res.end() 이후 'close'가 발생해도 재취소 처리되지 않는다", async () => {
  const handler = createHttpHandler(baseHandlerInput({
    async getAccountByRiotId(gameName, tagLine) {
      return { puuid: "puuid-normal", gameName, tagLine };
    },
    async getRankedStatsByPuuid() { return undefined; },
    async getChampionMasteryTopByPuuid() { return []; },
    async getRecentMatchIdsByPuuid() { return []; }
  }));

  const req = new MockRequest("GET", "/api/lol/profile?riotId=Normal%23KR1");
  const res = createResponse();
  await handler(req, res);

  assert.equal(res.statusCode, 200, res.body);
  /* 정상 완료 후 소켓이 정리되며 발생하는 'close'는 res.writableEnded가 true라서
     abort로 오인되지 않아야 합니다(이미 응답을 보냈으므로 부작용 없음). */
  assert.doesNotThrow(() => req.emit("close"));
});

test("(회귀) 같은 소환사를 동시에 검색하는 두 요청 중 하나(최초 호출자)가 취소돼도, 공유 dedup을 기다리던 다른 요청은 정상 완료된다", async () => {
  /* Critical 리뷰 발견: startPublicLolProfileBuild()의 in-flight dedup은 여러
     요청이 같은 promise를 공유하는데, 예전 구현은 "최초 호출자"의 signal이
     그 공유 promise 자체에 직접 걸려 있어 최초 호출자가 취소하면 뒤이어 같은
     프로필을 기다리던 다른(완전히 무관한) 사용자의 요청까지 취소 오류를
     받았다. 이 테스트는 그 회귀가 재발하지 않는지 확인한다. */
  let resolveAccountLookup;
  const accountLookupStarted = new Promise((resolve) => { resolveAccountLookup = resolve; });
  let accountLookupCalls = 0;

  const handler = createHttpHandler(baseHandlerInput({
    async getAccountByRiotId(gameName, tagLine) {
      accountLookupCalls += 1;
      resolveAccountLookup();
      /* 두 요청이 정확히 같은 in-flight 빌드를 공유하도록 응답을 지연시킵니다. */
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { puuid: "puuid-shared", gameName, tagLine };
    },
    async getRankedStatsByPuuid() { return undefined; },
    async getChampionMasteryTopByPuuid() { return []; },
    async getRecentMatchIdsByPuuid() { return []; }
  }));

  /* 요청 A: 곧 취소될 최초 호출자 — 같은 riotId로 먼저 들어와 dedup 빌드를
     시작시킵니다. */
  const reqA = new MockRequest("GET", "/api/lol/profile?riotId=Shared%23KR1");
  const resA = createResponse();
  const handlerA = handler(reqA, resA);

  /* 요청 B: 완전히 다른(무관한) 사용자의 요청 — A가 이미 만든 in-flight 빌드를
     그대로 공유해야 합니다. */
  const reqB = new MockRequest("GET", "/api/lol/profile?riotId=Shared%23KR1");
  const resB = createResponse();
  const handlerB = handler(reqB, resB);

  await accountLookupStarted;
  /* A만 연결을 끊습니다(검색 취소). B는 계속 응답을 기다리는 정상 요청입니다. */
  reqA.emit("close");

  await Promise.all([handlerA, handlerB]);

  assert.equal(accountLookupCalls, 1, "두 요청은 in-flight 빌드를 공유해 Riot API 호출이 한 번만 발생해야 합니다");
  assert.equal(resA.statusCode, 0, "A는 취소되어 응답을 시도하지 않아야 합니다");
  assert.equal(resB.statusCode, 200, "A의 취소가 B의 공유 dedup 응답까지 오염시키면 안 됩니다: " + resB.body);
});

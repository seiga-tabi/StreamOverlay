import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const palworldDataService = await loadPalworldDataService();

function createRequest(method, url) {
  return {
    method,
    url,
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
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

function createHandler() {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    palworldDataService
  });
}

async function request(handler, url, method = "GET") {
  const res = createResponse();
  await handler(createRequest(method, url), res);
  return { res, body: res.body ? JSON.parse(res.body) : undefined };
}

beforeEach(() => resetSecurityRateLimiters());

test("펠월드 GET API만 공개하고 유사 prefix나 쓰기 요청은 공개하지 않는다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/palworld/meta"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/palworld/items/pal-sphere"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/palworld/items"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("GET", "/api/palworldish/meta"), "DASHBOARD_ADMIN");
});

test("펠월드 공개 API는 인증 없이 meta와 cache header를 제공한다", async () => {
  const { res, body } = await request(createHandler(), "/api/palworld/meta");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Cache-Control"], /^public,/);
  assert.equal(res.headers["X-Palworld-Data-Version"], "1.0.1");
  assert.equal(res.headers["X-Palworld-Data-Revision"], body.metadata.sourceRevision);
  assert.equal(body.counts.pals, 287);
  assert.equal(body.domains.pals.status, "ready");
  assert.equal(body.domains.items.status, "sample");
  assert.equal(body.domains.breeding.status, "sample");
  assert.equal(body.gates.imageAssets.fallbackPals, 287);
});

test("통합 검색 API는 한국어와 일본어 Pal 및 아이템 결과를 반환한다", async () => {
  const handler = createHandler();
  const korean = await request(handler, "/api/palworld/search?q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4");
  const japanese = await request(handler, "/api/palworld/search?q=%E3%83%91%E3%83%AB%E3%82%B9%E3%83%95%E3%82%A3%E3%82%A2");
  const english = await request(handler, "/api/palworld/search?q=ANUBIS");
  const idAlias = await request(handler, "/api/palworld/search?q=relaxaurus_lux");
  const number = await request(handler, "/api/palworld/search?q=%23139");
  assert.equal(korean.body.pals[0].id, "anubis");
  assert.equal(japanese.body.items[0].id, "pal-sphere");
  assert.equal(english.body.pals[0].id, "anubis");
  assert.equal(idAlias.body.pals[0].id, "relaxaurus-lux");
  assert.equal(number.body.pals[0].id, "anubis");
  assert.equal(japanese.body.domains.pals.status, "ready");
  assert.equal(japanese.body.domains.pals.metadata.gameVersion, "1.0.1");
  assert.equal(japanese.body.domains.items.status, "sample");
  assert.equal(japanese.body.domains.items.metadata.gameVersion, "sample-baseline");

  const limited = await request(handler, "/api/palworld/search?q=a&limit=1");
  assert.equal(limited.body.pals.length <= 1, true);
  assert.equal(limited.body.items.length <= 1, true);
  assert.equal(limited.body.total > limited.body.pals.length + limited.body.items.length, true);
});

test("Pal과 아이템 목록 API는 filter와 pagination을 적용한다", async () => {
  const handler = createHandler();
  const pals = await request(handler, "/api/palworld/pals?element=ground&work=mining&sort=number&page=1&limit=5");
  const rarityVariants = await request(handler, "/api/palworld/pals?rarity=10&variant=variant&sort=number&page=1&limit=100");
  const items = await request(handler, "/api/palworld/items?category=sphere&acquisition=craft&sort=technologyLevel&order=desc&page=1&limit=5");
  assert.equal(pals.body.items.length, 5);
  assert.equal(pals.body.items.every((pal) => pal.elements.includes("ground")), true);
  assert.equal(pals.body.items.every((pal) => pal.workSuitabilities.some((work) => work.type === "mining")), true);
  assert.equal(rarityVariants.body.items.length, 4);
  assert.equal(rarityVariants.body.items.every((pal) => pal.rarity === 10 && pal.variantType === "variant"), true);
  assert.deepEqual(items.body.items.map((item) => item.id), ["mega-sphere", "pal-sphere"]);
  assert.equal(items.body.pagination.pageSize, 5);
  assert.equal(items.body.metadata.gameVersion, "sample-baseline");
  assert.equal(items.res.headers["X-Palworld-Data-Version"], "1.0.1");
});

test("상세 API는 canonical ID와 underscore alias를 같은 로컬 레코드로 조회한다", async () => {
  const handler = createHandler();
  const pal = await request(handler, "/api/palworld/pals/anubis");
  const item = await request(handler, "/api/palworld/items/pal_sphere");
  assert.equal(pal.res.statusCode, 200);
  assert.equal(pal.body.nameJa, "アヌビス");
  assert.equal(item.res.statusCode, 200);
  assert.equal(item.body.id, "pal-sphere");
});

test("첫 번째·중간·마지막 Pal 상세는 release 원본 수치와 fallback 상태를 반환한다", async () => {
  const handler = createHandler();
  const first = await request(handler, "/api/palworld/pals/lamball");
  const middle = await request(handler, "/api/palworld/pals/rayhound");
  const last = await request(handler, "/api/palworld/pals/panthalus");
  const nocturnal = await request(handler, "/api/palworld/pals/depresso");
  assert.deepEqual(
    [first.body.number, middle.body.number, last.body.number],
    [1, 98, 203]
  );
  assert.deepEqual(
    [first.body.nameKo, middle.body.nameJa, last.body.nameEn],
    ["도로롱", "イヌズマ", "Panthalus"]
  );
  assert.equal([first.body, middle.body, last.body].every((pal) => pal.imageUrl === undefined), true);
  assert.equal(typeof first.body.nocturnal, "boolean");
  assert.equal(nocturnal.body.nocturnal, true);
  assert.deepEqual(first.body.activeSkills, []);
  assert.deepEqual(first.body.drops, []);
  assert.deepEqual(first.body.breeding.specialParentPairs, []);
});

test("교배 API는 부모 위치 교환, 결과 없음과 부모 역검색을 지원한다", async () => {
  const handler = createHandler();
  const forward = await request(handler, "/api/palworld/breeding?parentA=bushi&parentB=penking");
  const empty = await request(handler, "/api/palworld/breeding?parentA=lamball&parentB=cattiva");
  const outsideSample = await request(handler, "/api/palworld/breeding?parentA=panthalus&parentB=lamball");
  const parents = await request(handler, "/api/palworld/breeding/parents?child=anubis&page=1&limit=10");
  const outsideSampleParents = await request(handler, "/api/palworld/breeding/parents?child=panthalus&page=1&limit=10");
  assert.equal(forward.body.result.child.id, "anubis");
  assert.equal(empty.body.result, null);
  assert.equal(outsideSample.res.statusCode, 200);
  assert.equal(outsideSample.body.result, null);
  assert.equal(parents.body.child.id, "anubis");
  assert.equal(parents.body.items[0].id, "penking-bushi-anubis");
  assert.equal(outsideSampleParents.res.statusCode, 200);
  assert.equal(outsideSampleParents.body.child.id, "panthalus");
  assert.deepEqual(outsideSampleParents.body.items, []);
  assert.equal(forward.body.metadata.gameVersion, "sample-baseline");
  assert.equal(forward.res.headers["X-Palworld-Data-Version"], "1.0.1");
});

test("잘못된 query와 존재하지 않는 ID는 안정적인 오류 code를 반환한다", async () => {
  const handler = createHandler();
  const invalid = await request(handler, "/api/palworld/search?q=&redirect=https%3A%2F%2Fexample.com");
  const traversal = await request(handler, "/api/palworld/items/%2E%2E%2Fsecret");
  const missing = await request(handler, "/api/palworld/pals/not-found");
  assert.equal(invalid.res.statusCode, 400);
  assert.equal(invalid.body.code, "PALWORLD_INVALID_QUERY");
  assert.equal(traversal.res.statusCode, 400);
  assert.equal(traversal.body.code, "PALWORLD_INVALID_QUERY");
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.body.code, "PALWORLD_NOT_FOUND");
});

test("펠월드 API rate limit은 상세 ID를 바꿔도 하나의 공개 bucket으로 제한한다", async () => {
  const handler = createHandler();
  let last;
  for (let index = 0; index < 61; index += 1) {
    last = await request(handler, `/api/palworld/pals/${index % 2 === 0 ? "anubis" : "lamball"}`);
  }
  assert.equal(last.res.statusCode, 429);
  assert.equal(last.body.error, "rate limit exceeded");
  assert.equal(last.res.headers["Retry-After"], "60");
});

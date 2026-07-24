import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const { loadPalworldDataService } = await import("../dist/services/palworld-data.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");
const { requiredHttpPrincipal } = await import("../dist/security/auth.js");
const {
  validatePalworldItemDetail,
  validatePalworldItemSummary,
  validatePalworldPaginatedResponse,
  validatePalworldPalListResponse,
  validatePalworldSkillDetail,
  validatePalworldSkillSummary
} = await import("@streamops/shared");
const palworldDataService = await loadPalworldDataService();

function createRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
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

function createHandler(service = palworldDataService) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    palworldDataService: service
  });
}

async function request(handler, url, method = "GET", headers = {}) {
  const res = createResponse();
  await handler(createRequest(method, url, headers), res);
  return { res, body: res.body ? JSON.parse(res.body) : undefined };
}

beforeEach(() => resetSecurityRateLimiters());

test("펠월드 GET API만 공개하고 유사 prefix나 쓰기 요청은 공개하지 않는다", () => {
  assert.equal(requiredHttpPrincipal("GET", "/api/palworld/meta"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/palworld/items/pal-sphere"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("GET", "/api/palworld/skills/active-absolute-frost-8b7feb098a"), "PUBLIC");
  assert.equal(requiredHttpPrincipal("POST", "/api/palworld/skills"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("POST", "/api/palworld/items"), "DASHBOARD_ADMIN");
  assert.equal(requiredHttpPrincipal("GET", "/api/palworldish/meta"), "DASHBOARD_ADMIN");
});

test("펠월드 공개 API는 인증 없이 meta와 cache header를 제공한다", async () => {
  const { res, body } = await request(createHandler(), "/api/palworld/meta");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Cache-Control"], /^public,/);
  assert.equal(res.headers["X-Palworld-Data-Version"], "1.0.1");
  assert.equal(res.headers["X-Palworld-Data-Revision"], body.metadata.sourceRevision);
  assert.equal(body.metadata.release, "1.0.1");
  assert.equal(body.metadata.steamBuildId, "24181105");
  assert.equal(body.counts.pals, 287);
  assert.equal(body.counts.items, 1_847);
  assert.equal(body.counts.skills, 566);
  assert.equal(body.domains.pals.status, "ready");
  assert.equal(body.domains.items.status, "incomplete");
  assert.equal(body.domains.items.metadata.gameVersion, "1.0.1");
  assert.equal(body.domains.items.metadata.sourceRevision, body.metadata.sourceRevision);
  assert.equal(body.domains.items.domainMetadata.gameVersion, "1.0.1.100619");
  assert.match(body.domains.items.domainMetadata.sourceChecksum, /^[a-f0-9]{64}$/u);
  assert.equal(body.counts.breedingPairs, 41_329);
  assert.equal(body.domains.breeding.status, "incomplete");
  assert.equal(body.domains.breeding.metadata.gameVersion, "1.0.1");
  assert.equal(body.domains.skills.status, "incomplete");
  assert.equal(body.domains.skills.metadata.gameVersion, "1.0.1");
  assert.equal(body.domains.skills.metadata.sourceRevision, body.metadata.sourceRevision);
  assert.equal(body.domains.skills.domainMetadata.gameVersion, "1.0.1.100619");
  assert.equal(body.domains.skills.domainMetadata.sourceRevision, body.domains.items.domainMetadata.sourceRevision);
  assert.deepEqual(body.coverage.palDetails, { available: 270, missing: 17, total: 287 });
  assert.deepEqual(body.coverage.itemImages, { available: 1_762, missing: 85, total: 1_847 });
  assert.deepEqual(body.coverage.skillDetails, { available: 564, missing: 2, total: 566 });
  assert.deepEqual(body.coverage.elementImages, { available: 9, missing: 0, total: 9 });
  assert.equal(body.gates.imageAssets.readyImages, 272);
  assert.equal(body.gates.imageAssets.fallbackPals, 15);
});

test("모든 Palworld 공개 endpoint의 header와 최상위 release identity가 일치한다", async () => {
  const handler = createHandler();
  const paths = [
    "/api/palworld/meta",
    "/api/palworld/search?q=anubis",
    "/api/palworld/pals?limit=1",
    "/api/palworld/pals/anubis",
    "/api/palworld/items?limit=1",
    "/api/palworld/items/pal-sphere",
    "/api/palworld/skills?limit=1",
    "/api/palworld/skills/active-absolute-frost-8b7feb098a",
    "/api/palworld/breeding?parentA=lamball&parentB=cattiva",
    "/api/palworld/breeding/parents?child=anubis&limit=1",
    "/api/palworld/map/markers?world=main",
    "/api/palworld/map/spawns?world=main&pal=anubis"
  ];
  for (const pathname of paths) {
    const response = await request(handler, pathname);
    assert.equal(response.res.statusCode, 200, pathname);
    assert.equal(
      response.res.headers["X-Palworld-Data-Version"],
      response.body.metadata.gameVersion,
      pathname
    );
    assert.equal(
      response.res.headers["X-Palworld-Data-Revision"],
      response.body.metadata.sourceRevision,
      pathname
    );
    assert.equal(response.body.metadata.release, "1.0.1", pathname);
    assert.equal(response.body.metadata.steamBuildId, "24181105", pathname);
  }
});

test("Palworld JSON ETag는 같은 active release의 조건부 요청을 304로 처리한다", async () => {
  const handler = createHandler();
  const first = await request(handler, "/api/palworld/meta");
  assert.equal(first.res.statusCode, 200);
  assert.match(first.res.headers.ETag, /^"palworld-[a-f0-9]{24}"$/u);
  const second = await request(
    handler,
    "/api/palworld/meta",
    "GET",
    { "if-none-match": first.res.headers.ETag }
  );
  assert.equal(second.res.statusCode, 304);
  assert.equal(second.res.body, "");
  assert.equal(second.body, undefined);

  const differentResource = await request(
    handler,
    "/api/palworld/pals?limit=1",
    "GET",
    { "if-none-match": first.res.headers.ETag }
  );
  assert.equal(differentResource.res.statusCode, 200);
  assert.notEqual(differentResource.res.headers.ETag, first.res.headers.ETag);
});

test("catalog 손상은 Pal을 유지하고 Item·Skill만 no-store 503으로 격리한다", async () => {
  const service = await loadPalworldDataService({
    catalogRoot: `${process.cwd()}/__missing-palworld-catalog-fixture__`
  });
  const handler = createHandler(service);
  const meta = await request(handler, "/api/palworld/meta");
  const pal = await request(handler, "/api/palworld/pals/anubis");
  const search = await request(handler, "/api/palworld/search?q=anubis");
  assert.equal(meta.res.statusCode, 200);
  assert.equal(meta.body.domains.items.status, "unavailable");
  assert.equal(meta.body.domains.skills.status, "unavailable");
  assert.equal(meta.body.counts.items, 0);
  assert.equal(meta.body.counts.skills, 0);
  assert.equal(pal.res.statusCode, 200);
  assert.equal(search.res.statusCode, 200);
  assert.equal(search.body.pals[0].id, "anubis");
  assert.deepEqual(search.body.items, []);
  for (const pathname of [
    "/api/palworld/items",
    "/api/palworld/items/pal-sphere",
    "/api/palworld/skills",
    "/api/palworld/skills/active-absolute-frost-8b7feb098a"
  ]) {
    const unavailable = await request(handler, pathname);
    assert.equal(unavailable.res.statusCode, 503, pathname);
    assert.equal(unavailable.res.headers["Cache-Control"], "no-store", pathname);
    assert.equal(unavailable.body.error, "PALWORLD_DATA_UNAVAILABLE", pathname);
    assert.equal(JSON.stringify(unavailable.body).includes("sample-baseline"), false, pathname);
  }
});

test("통합 검색 API는 한국어와 일본어 Pal 및 아이템 결과를 반환한다", async () => {
  const handler = createHandler();
  const korean = await request(handler, "/api/palworld/search?q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4");
  const japanese = await request(handler, "/api/palworld/search?q=%E3%83%91%E3%83%AB%E3%82%B9%E3%83%95%E3%82%A3%E3%82%A2");
  const english = await request(handler, "/api/palworld/search?q=ANUBIS");
  const idAlias = await request(handler, "/api/palworld/search?q=relaxaurus_lux");
  const number = await request(handler, "/api/palworld/search?q=%23139");
  const palInternalId = await request(handler, "/api/palworld/search?q=SheepBall");
  const itemInternalId = await request(handler, "/api/palworld/search?q=PalSphere");
  assert.equal(korean.body.pals[0].id, "anubis");
  assert.equal(japanese.body.items[0].id, "pal-sphere");
  assert.equal(english.body.pals[0].id, "anubis");
  assert.equal(idAlias.body.pals[0].id, "relaxaurus-lux");
  assert.equal(number.body.pals[0].id, "anubis");
  assert.equal(palInternalId.body.pals[0].id, "lamball");
  assert.equal(itemInternalId.body.items.some((item) => item.id === "pal-sphere"), true);
  assert.equal(japanese.body.domains.pals.status, "ready");
  assert.equal(japanese.body.domains.pals.metadata.gameVersion, "1.0.1");
  assert.equal(japanese.body.domains.items.status, "incomplete");
  assert.equal(japanese.body.domains.items.metadata.gameVersion, "1.0.1");
  assert.equal(japanese.body.domains.items.domainMetadata.gameVersion, "1.0.1.100619");

  const limited = await request(handler, "/api/palworld/search?q=a&limit=1");
  assert.equal(limited.body.pals.length <= 1, true);
  assert.equal(limited.body.items.length <= 1, true);
  assert.equal(limited.body.total > limited.body.pals.length + limited.body.items.length, true);
  assert.deepEqual(limited.body.domainResults, {
    pals: {
      total: limited.body.domainResults.pals.total,
      returned: limited.body.pals.length,
      hasMore: limited.body.pals.length < limited.body.domainResults.pals.total
    },
    items: {
      total: limited.body.domainResults.items.total,
      returned: limited.body.items.length,
      hasMore: limited.body.items.length < limited.body.domainResults.items.total
    }
  });
});

test("Pal과 아이템 목록 API는 filter와 pagination을 적용한다", async () => {
  const handler = createHandler();
  const pals = await request(handler, "/api/palworld/pals?element=ground&work=mining&sort=number&page=1&limit=5");
  const facetPage = await request(handler, "/api/palworld/pals?sort=number&page=1&limit=1");
  const rarityVariants = await request(handler, "/api/palworld/pals?rarity=10&variant=variant&sort=number&page=1&limit=100");
  const items = await request(handler, "/api/palworld/items?category=sphere&acquisition=craft&sort=technologyLevel&order=desc&page=1&limit=5");
  const zeroRarityItems = await request(handler, "/api/palworld/items?rarity=0&page=1&limit=5");
  const palInternalId = await request(handler, "/api/palworld/pals?q=SheepBall&sort=number&page=1&limit=10");
  const itemInternalId = await request(handler, "/api/palworld/items?q=PalSphere&sort=name&page=1&limit=10");
  assert.equal(pals.body.items.length, 5);
  assert.equal(pals.body.items.every((pal) => pal.elements.includes("ground")), true);
  assert.equal(pals.body.items.every((pal) => pal.workSuitabilities.some((work) => work.type === "mining")), true);
  assert.equal(validatePalworldPalListResponse(pals.body).ok, true);
  assert.equal(validatePalworldPalListResponse(facetPage.body).ok, true);
  assert.deepEqual(pals.body.facets, facetPage.body.facets);
  assert.equal(
    facetPage.body.facets.variants.reduce((sum, facet) => sum + facet.count, 0),
    palworldDataService.meta().counts.pals
  );
  assert.equal(facetPage.body.facets.rarities.every((facet) => facet.count > 0), true);
  assert.equal(facetPage.body.facets.elements.some((facet) => facet.count > facetPage.body.items.length), true);
  assert.equal(rarityVariants.body.items.length, 4);
  assert.equal(rarityVariants.body.items.every((pal) => pal.rarity === 10 && pal.variantType === "variant"), true);
  assert.equal(items.body.items.length, 5);
  assert.equal(items.body.items.every((item) => item.category === "sphere"), true);
  assert.equal(items.body.items.every((item) => item.imageWidth === 256 && item.imageHeight === 256), true);
  assert.equal(items.body.items.every((item) => !("sourceInternalId" in item)), true);
  assert.equal(items.body.items.every((item, index, entries) => index === 0 || entries[index - 1].technologyLevel >= item.technologyLevel), true);
  assert.equal(validatePalworldPaginatedResponse(items.body, validatePalworldItemSummary).ok, true);
  assert.equal(items.body.pagination.pageSize, 5);
  assert.equal(zeroRarityItems.res.statusCode, 200);
  assert.equal(zeroRarityItems.body.items.length, 5);
  assert.equal(zeroRarityItems.body.items.every((item) => item.rarity === 0), true);
  assert.deepEqual(palInternalId.body.items.map((pal) => pal.id), ["lamball"]);
  assert.equal(itemInternalId.body.items.some((item) => item.id === "pal-sphere"), true);
  assert.equal(items.body.metadata.gameVersion, "1.0.1");
  assert.equal(items.body.domainMetadata.gameVersion, "1.0.1.100619");
  assert.equal(items.res.headers["X-Palworld-Data-Version"], items.body.metadata.gameVersion);
  assert.equal(items.res.headers["X-Palworld-Data-Revision"], items.body.metadata.sourceRevision);
});

test("상세 API는 canonical ID와 underscore alias를 같은 로컬 레코드로 조회한다", async () => {
  const handler = createHandler();
  const pal = await request(handler, "/api/palworld/pals/anubis");
  const item = await request(handler, "/api/palworld/items/pal_sphere");
  assert.equal(pal.res.statusCode, 200);
  assert.equal(pal.body.nameJa, "アヌビス");
  assert.equal(item.res.statusCode, 200);
  assert.equal(item.body.id, "pal-sphere");
  assert.equal(item.body.sourceInternalId, "PalSphere");
  assert.match(item.body.imageUrl, /^\/images\/palworld\/1\.0\.1\/items\/[a-f0-9]{64}\.webp$/u);
  assert.equal(item.body.imageWidth, 256);
  assert.equal(item.body.imageHeight, 256);
  assert.equal(item.body.descriptionEn.length > 0, true);
  assert.equal(item.body.maxStack > 0, true);
  assert.equal(item.body.craftingMaterials.length > 0, true);
  assert.equal(validatePalworldItemDetail(item.body).ok, true);
});

test("스킬 목록 API는 설명 검색·type·element·정렬·pagination과 Shared schema를 적용한다", async () => {
  const handler = createHandler();
  const active = await request(
    handler,
    "/api/palworld/skills?q=absolute%20frost&type=active&element=ice&sort=power&order=desc&page=1&limit=5"
  );
  assert.equal(active.res.statusCode, 200);
  assert.equal(active.body.items[0].id, "active-absolute-frost-8b7feb098a");
  assert.equal(active.body.items[0].descriptionEn.includes("icicles"), true);
  assert.deepEqual(active.body.items[0].localization, {
    sourceLanguage: "en",
    ko: "source_language_fallback",
    ja: "source_language_fallback"
  });
  assert.equal(active.body.items[0].translation.description.ko, "machine_assisted");
  assert.equal(active.body.items[0].translation.description.ja, "machine_assisted");
  assert.match(active.res.headers["Cache-Control"], /^public,/u);
  assert.equal(
    validatePalworldPaginatedResponse(active.body, validatePalworldSkillSummary).ok,
    true
  );

  const description = await request(handler, "/api/palworld/skills?q=acidic%20clouds&page=1&limit=10");
  assert.equal(description.body.items.some((skill) => skill.id === "active-acid-rain-b29ac863a8"), true);

  const passive = await request(handler, "/api/palworld/skills?type=passive&sort=name&order=asc&page=1&limit=3");
  assert.equal(passive.body.pagination.total, 79);
  assert.equal(passive.body.items.length, 3);
  assert.equal(passive.body.items.every((skill) => skill.type === "passive"), true);
});

test("스킬 상세 API는 canonical ID와 underscore alias, 관련 Pal과 없는 ID를 처리한다", async () => {
  const handler = createHandler();
  const canonical = await request(handler, "/api/palworld/skills/active-absolute-frost-8b7feb098a");
  const alias = await request(handler, "/api/palworld/skills/active_absolute_frost_8b7feb098a");
  const missing = await request(handler, "/api/palworld/skills/not-found");
  assert.equal(canonical.res.statusCode, 200);
  assert.equal(alias.res.statusCode, 200);
  assert.equal(alias.body.id, canonical.body.id);
  assert.equal(canonical.body.relatedPalCount, 1);
  assert.equal(canonical.body.relatedPals[0].pal.id, "univolt-cryst");
  assert.equal(canonical.body.relatedPals[0].unlockLevel, 50);
  assert.equal(validatePalworldSkillDetail(canonical.body).ok, true);
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.body.code, "PALWORLD_NOT_FOUND");
});

test("스킬 API는 unknown query와 허용되지 않은 filter를 안정적인 400으로 거부한다", async () => {
  const handler = createHandler();
  for (const url of [
    "/api/palworld/skills?type=ultimate",
    "/api/palworld/skills?sort=rarity",
    "/api/palworld/skills?redirect=https%3A%2F%2Fexample.com",
    "/api/palworld/skills?limit=201"
  ]) {
    const response = await request(handler, url);
    assert.equal(response.res.statusCode, 400, url);
    assert.equal(response.body.code, "PALWORLD_INVALID_QUERY", url);
  }
});

test("첫 번째·중간·마지막 Pal 상세는 검증된 로컬 이미지를, 누락 Pal은 fallback 상태를 반환한다", async () => {
  const handler = createHandler();
  const first = await request(handler, "/api/palworld/pals/lamball");
  const middle = await request(handler, "/api/palworld/pals/rayhound");
  const last = await request(handler, "/api/palworld/pals/panthalus");
  const missingImage = await request(handler, "/api/palworld/pals/smokie");
  const nocturnal = await request(handler, "/api/palworld/pals/depresso");
  assert.deepEqual(
    [first.body.number, middle.body.number, last.body.number],
    [1, 98, 203]
  );
  assert.deepEqual(
    [first.body.nameKo, middle.body.nameJa, last.body.nameEn],
    ["도로롱", "イヌズマ", "Panthalus"]
  );
  assert.equal([first.body, middle.body, last.body].every((pal) => /^\/images\/palworld\/1\.0\.1\/pals\/[a-f0-9]{64}\.webp$/u.test(pal.imageUrl)), true);
  assert.equal(missingImage.body.imageUrl, undefined);
  assert.equal(typeof first.body.nocturnal, "boolean");
  assert.equal(nocturnal.body.nocturnal, true);
  assert.equal(first.body.descriptionEn.includes("food chain"), true);
  assert.equal(first.body.partnerSkill.nameEn, "Fluffy Shield");
  assert.equal(first.body.activeSkills.length, 7);
  assert.equal(first.body.activeSkills.every((skill) => skill.descriptionEn && skill.localization.sourceLanguage === "en"), true);
  assert.deepEqual(first.body.drops.map((drop) => drop.id), ["wool", "meat-sheep-ball"]);
  assert.deepEqual(first.body.dropDetails.map((drop) => [drop.item.id, drop.minQuantity, drop.maxQuantity, drop.dropRatePercent]), [
    ["wool", 1, 3, 100],
    ["meat-sheep-ball", 1, 1, 100]
  ]);
  assert.equal(first.body.breeding.breedingPower, 3050);
});

test("교배 API는 일반·성별 특수 교배, 부모 위치 교환과 역검색 pagination을 지원한다", async () => {
  const handler = createHandler();
  const forward = await request(handler, "/api/palworld/breeding?parentA=bushi&parentB=penking");
  const general = await request(handler, "/api/palworld/breeding?parentA=lamball&parentB=cattiva");
  const fullCatalog = await request(handler, "/api/palworld/breeding?parentA=panthalus&parentB=lamball");
  const requiresGender = await request(handler, "/api/palworld/breeding?parentA=katress&parentB=wixen");
  const gendered = await request(
    handler,
    "/api/palworld/breeding?parentA=katress&parentB=wixen&parentAGender=male&parentBGender=female"
  );
  const parents = await request(handler, "/api/palworld/breeding/parents?child=anubis&page=1&limit=10");
  const parentsPage2 = await request(handler, "/api/palworld/breeding/parents?child=anubis&page=2&limit=10");
  const mixedParents = await request(handler, "/api/palworld/breeding/parents?child=relaxaurus-lux&type=all&page=1&limit=1");
  const normalParents = await request(handler, "/api/palworld/breeding/parents?child=relaxaurus-lux&type=normal&page=1&limit=1");
  const specialParents = await request(handler, "/api/palworld/breeding/parents?child=relaxaurus-lux&type=special&page=1&limit=1");
  const selfParents = await request(handler, "/api/palworld/breeding/parents?child=panthalus&page=1&limit=10");
  assert.equal(forward.body.result.child.id, "xenovader");
  assert.equal(forward.body.state, "resolved");
  assert.equal(general.body.result.child.id, "daedream");
  assert.equal(fullCatalog.res.statusCode, 200);
  assert.equal(fullCatalog.body.result.child.id, "bakemi");
  assert.equal(requiresGender.body.state, "requires_gender");
  assert.deepEqual(
    requiresGender.body.alternatives.map((pair) => pair.child.id),
    ["katress-ignis", "wixen-noct"]
  );
  assert.equal(gendered.body.state, "resolved");
  assert.equal(gendered.body.result.child.id, "wixen-noct");
  assert.equal(parents.body.child.id, "anubis");
  assert.equal(parents.body.pagination.total, 234);
  assert.equal(parents.body.pagination.totalPages, 24);
  assert.equal(parentsPage2.body.pagination.page, 2);
  assert.notEqual(parentsPage2.body.items[0].id, parents.body.items[0].id);
  assert.equal(normalParents.body.pagination.total > 0, true);
  assert.equal(specialParents.body.pagination.total > 0, true);
  assert.equal(normalParents.body.items.every((pair) => !pair.isSpecial), true);
  assert.equal(specialParents.body.items.every((pair) => pair.isSpecial), true);
  assert.equal(
    normalParents.body.pagination.total + specialParents.body.pagination.total,
    mixedParents.body.pagination.total
  );
  assert.equal(normalParents.body.pagination.totalPages, normalParents.body.pagination.total);
  assert.equal(specialParents.body.pagination.totalPages, specialParents.body.pagination.total);
  assert.equal(selfParents.res.statusCode, 200);
  assert.equal(selfParents.body.child.id, "panthalus");
  assert.deepEqual(
    selfParents.body.items.map((pair) => [pair.parentA.id, pair.parentB.id, pair.child.id]),
    [["panthalus", "panthalus", "panthalus"]]
  );
  assert.equal(forward.body.metadata.gameVersion, "1.0.1");
  assert.equal(parents.body.metadata.gameVersion, "1.0.1");
  assert.equal(forward.res.headers["X-Palworld-Data-Version"], "1.0.1");
});

test("잘못된 query와 존재하지 않는 ID는 안정적인 오류 code를 반환한다", async () => {
  const handler = createHandler();
  const invalid = await request(handler, "/api/palworld/search?q=&redirect=https%3A%2F%2Fexample.com");
  const traversal = await request(handler, "/api/palworld/items/%2E%2E%2Fsecret");
  const missing = await request(handler, "/api/palworld/pals/not-found");
  const invalidBreedingType = await request(handler, "/api/palworld/breeding/parents?child=anubis&type=unknown");
  assert.equal(invalid.res.statusCode, 400);
  assert.equal(invalid.body.code, "PALWORLD_INVALID_QUERY");
  assert.equal(invalid.res.headers["Cache-Control"], "no-store");
  assert.equal(traversal.res.statusCode, 400);
  assert.equal(traversal.body.code, "PALWORLD_INVALID_QUERY");
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.body.code, "PALWORLD_NOT_FOUND");
  assert.equal(missing.res.headers["Cache-Control"], "no-store");
  assert.equal(invalidBreedingType.res.statusCode, 400);
  assert.equal(invalidBreedingType.body.code, "PALWORLD_INVALID_QUERY");
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
  assert.equal(last.res.headers["Cache-Control"], "no-store");
  assert.equal(last.res.headers["X-RateLimit-Limit"], "60");
  assert.match(last.res.headers["X-RateLimit-Reset"], /^[1-9][0-9]+$/u);
});

test("무한 목록 bucket은 상세·검색 bucket과 경쟁하지 않는다", async () => {
  const handler = createHandler();
  for (let index = 0; index < 60; index += 1) {
    const list = await request(handler, `/api/palworld/items?page=${(index % 10) + 1}&limit=1`);
    assert.equal(list.res.statusCode, 200);
  }
  const detail = await request(handler, "/api/palworld/items/pal-sphere");
  const search = await request(handler, "/api/palworld/search?q=anubis");
  assert.equal(detail.res.statusCode, 200);
  assert.equal(search.res.statusCode, 200);
});

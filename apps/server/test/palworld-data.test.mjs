import test from "node:test";
import assert from "node:assert/strict";

const {
  PalworldDataService,
  PalworldRecordNotFoundError
} = await import("../dist/services/palworld-data.js");
const {
  validatePalworldItemSummary,
  validatePalworldPaginatedResponse,
  validatePalworldPalSummary,
  validatePalworldSearchResult
} = await import("@streamops/shared");

const service = new PalworldDataService();

test("서비스는 주입된 스냅샷도 Shared schema로 검증한다", () => {
  assert.throws(() => new PalworldDataService({ pals: [], items: [], breedingPairs: [] }), TypeError);
});

test("고정 스냅샷 meta는 실제 Pal, 아이템과 교배 조합 수를 계산한다", () => {
  const meta = service.meta();
  assert.equal(meta.metadata.gameVersion, "sample-baseline");
  assert.equal(meta.counts.pals, 12);
  assert.equal(meta.counts.items, 10);
  assert.equal(meta.counts.breedingPairs, 3);
});

test("통합 검색은 한국어, 일본어, 영어, 도감 번호와 ID를 지원한다", () => {
  assert.equal(service.search("아누비스", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("アヌビス", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("ANUBIS", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("#100", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("pal_sphere", 10).items[0]?.id, "pal-sphere");
  assert.equal(service.search("パルスフィア", 10).items[0]?.id, "pal-sphere");

  const limited = service.search("a", 1);
  assert.equal(limited.pals.length <= 1, true);
  assert.equal(limited.items.length <= 1, true);
  assert.equal(limited.total > limited.pals.length + limited.items.length, true);
});

test("Pal 목록은 allowlist 필터, 정렬과 pagination을 적용한다", () => {
  const response = service.listPals({
    element: "ground",
    work: "mining",
    sort: "rarity",
    order: "desc",
    page: 1,
    limit: 5
  });
  assert.deepEqual(response.items.map((pal) => pal.id), ["anubis"]);
  assert.equal(response.pagination.total, 1);

  const clamped = service.listPals({ sort: "number", order: "asc", page: 10_000, limit: 5 });
  assert.equal(clamped.pagination.page, 3);
  assert.deepEqual(clamped.items.map((pal) => pal.id), ["relaxaurus-lux", "anubis"]);
});

test("아이템 목록은 종류, 획득 방식, 희귀도와 정렬을 적용한다", () => {
  const response = service.listItems({
    category: "sphere",
    acquisition: "craft",
    sort: "technologyLevel",
    order: "desc",
    page: 1,
    limit: 10
  });
  assert.deepEqual(response.items.map((item) => item.id), ["mega-sphere", "pal-sphere"]);
  assert.equal(service.getItem("pal_sphere").id, "pal-sphere");
});

test("교배 조회는 부모 순서 교환, 동일 부모와 목표 Pal 역검색을 지원한다", () => {
  assert.equal(service.breeding({ parentA: "penking", parentB: "bushi" }).result?.child.id, "anubis");
  assert.equal(service.breeding({ parentA: "bushi", parentB: "penking" }).result?.child.id, "anubis");
  assert.equal(service.breeding({ parentA: "lamball", parentB: "lamball" }).result?.child.id, "lamball");
  assert.equal(service.breeding({ parentA: "cattiva", parentB: "lamball" }).result, null);

  const parents = service.breedingParents({ child: "anubis", page: 1, limit: 1 });
  assert.equal(parents.child.id, "anubis");
  assert.equal(parents.items[0]?.parentA.id, "penking");
  assert.equal(parents.pagination.total, 1);
});

test("존재하지 않는 Pal과 아이템은 안정적인 not found 오류를 발생시킨다", () => {
  assert.throws(() => service.getPal("missing-pal"), PalworldRecordNotFoundError);
  assert.throws(() => service.getItem("missing-item"), PalworldRecordNotFoundError);
});

test("검색과 목록 응답은 Shared schema 계약을 충족한다", () => {
  const pals = service.listPals({ sort: "number", order: "asc", page: 10_000, limit: 5 });
  const items = service.listItems({ sort: "name", order: "asc", page: 1, limit: 5 });
  assert.equal(validatePalworldSearchResult(service.search("Pal", 20)).ok, true);
  assert.equal(validatePalworldPaginatedResponse(pals, validatePalworldPalSummary).ok, true);
  assert.equal(validatePalworldPaginatedResponse(items, validatePalworldItemSummary).ok, true);
});

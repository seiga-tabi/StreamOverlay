import test from "node:test";
import assert from "node:assert/strict";

const {
  loadPalworldDataService,
  PalworldDataService,
  PalworldRecordNotFoundError
} = await import("../dist/services/palworld-data.js");
const {
  validatePalworldItemSummary,
  validatePalworldPaginatedResponse,
  validatePalworldPalSummary,
  validatePalworldSearchResult
} = await import("@streamops/shared");

const service = await loadPalworldDataService();

test("서비스는 주입된 스냅샷도 Shared schema로 검증한다", () => {
  assert.throws(() => new PalworldDataService(), TypeError);
  assert.throws(() => new PalworldDataService({ pals: [], items: [], breedingPairs: [] }), TypeError);
});

test("runtime meta는 Pal 287종과 sample 아이템·교배 provenance 및 분리된 gate를 반환한다", () => {
  const meta = service.meta();
  assert.equal(meta.metadata.gameVersion, "1.0.1");
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.counts.items, 10);
  assert.equal(meta.counts.breedingPairs, 3);
  assert.deepEqual(
    {
      pals: [meta.domains.pals.status, meta.domains.pals.recordCount, meta.domains.pals.metadata.gameVersion],
      items: [meta.domains.items.status, meta.domains.items.recordCount, meta.domains.items.metadata.gameVersion],
      breeding: [meta.domains.breeding.status, meta.domains.breeding.recordCount, meta.domains.breeding.metadata.gameVersion]
    },
    {
      pals: ["ready", 287, "1.0.1"],
      items: ["sample", 10, "sample-baseline"],
      breeding: ["sample", 3, "sample-baseline"]
    }
  );
  assert.deepEqual(meta.gates.dataIntegrity, { passed: true, status: "ready" });
  assert.deepEqual(meta.gates.imageAssets, {
    status: "partial",
    policyStatus: "operator_acknowledged",
    technicalPassed: true,
    publicActivationAllowed: true,
    rightsVerified: false,
    usageBasis: "operator_reference_use",
    readyImages: 272,
    fallbackPals: 15,
    publicNoticeRequired: true
  });
});

test("통합 검색은 한국어, 일본어, 영어, 도감 번호와 ID를 지원한다", () => {
  assert.equal(service.search("아누비스", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("アヌビス", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("ANUBIS", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("#139", 10).pals[0]?.id, "anubis");
  assert.equal(service.search("pal_sphere", 10).items[0]?.id, "pal-sphere");
  assert.equal(service.search("パルスフィア", 10).items[0]?.id, "pal-sphere");

  const mixed = service.search("Pal", 20);
  assert.equal(mixed.metadata.gameVersion, "1.0.1");
  assert.equal(mixed.domains.pals.status, "ready");
  assert.equal(mixed.domains.pals.metadata.gameVersion, "1.0.1");
  assert.equal(mixed.domains.items.status, "sample");
  assert.equal(mixed.domains.items.metadata.gameVersion, "sample-baseline");

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
  assert.equal(response.items.every((pal) => pal.elements.includes("ground")), true);
  assert.equal(response.items.every((pal) => pal.workSuitabilities.some((work) => work.type === "mining")), true);
  assert.equal(response.pagination.total > 1, true);

  const clamped = service.listPals({ sort: "number", order: "asc", page: 10_000, limit: 5 });
  assert.equal(clamped.pagination.page, 58);
  assert.equal(clamped.items.at(-1)?.id, "panthalus");
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
  assert.equal(service.breeding({ parentA: "lamball", parentB: "lamball" }).parentA.nameKo, "도로롱");
  assert.equal(service.breeding({ parentA: "cattiva", parentB: "lamball" }).result, null);
  assert.equal(service.breeding({ parentA: "panthalus", parentB: "lamball" }).result, null);

  const parents = service.breedingParents({ child: "anubis", page: 1, limit: 1 });
  assert.equal(parents.child.id, "anubis");
  assert.equal(parents.items[0]?.parentA.id, "penking");
  assert.equal(parents.pagination.total, 1);
  assert.deepEqual(service.breedingParents({ child: "panthalus", page: 1, limit: 10 }).items, []);
  assert.equal(service.breeding({ parentA: "penking", parentB: "bushi" }).metadata.gameVersion, "sample-baseline");
});

test("adapter는 source internal ID를 API 상세와 분리된 provenance로 유지한다", () => {
  assert.equal(service.sourceInternalIdForPal("lamball"), "SheepBall");
  assert.equal(service.sourceInternalIdForPal("relaxaurus_lux"), "LazyDragon_Electric");
  assert.equal("sourceInternalId" in service.getPal("lamball"), false);
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

import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  loadPalworldDataService,
  PalworldDataService,
  PalworldRecordNotFoundError
} = await import("../dist/services/palworld-data.js");
const {
  validatePalworldItemSummary,
  validatePalworldPaginatedResponse,
  validatePalworldPalSummary,
  validatePalworldSearchResult,
  validatePalworldSkillDetail,
  validatePalworldSkillSummary
} = await import("@streamops/shared");

const service = await loadPalworldDataService();
const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);

test("서비스는 주입된 스냅샷도 Shared schema로 검증한다", () => {
  assert.throws(() => new PalworldDataService(), TypeError);
  assert.throws(() => new PalworldDataService({ pals: [], items: [], breedingPairs: [] }), TypeError);
});

test("runtime meta는 고정 catalog의 Pal·아이템·스킬 coverage와 분리된 gate를 반환한다", () => {
  const meta = service.meta();
  assert.equal(meta.metadata.gameVersion, "1.0.1");
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.counts.items, 1847);
  assert.equal(meta.counts.breedingPairs, 3);
  assert.equal(meta.counts.skills, 566);
  assert.match(meta.metadata.sourceChecksum, /^[a-f0-9]{64}$/u);
  assert.deepEqual(
    {
      pals: [meta.domains.pals.status, meta.domains.pals.recordCount, meta.domains.pals.metadata.gameVersion],
      items: [meta.domains.items.status, meta.domains.items.recordCount, meta.domains.items.metadata.gameVersion],
      breeding: [meta.domains.breeding.status, meta.domains.breeding.recordCount, meta.domains.breeding.metadata.gameVersion],
      skills: [meta.domains.skills.status, meta.domains.skills.recordCount, meta.domains.skills.metadata.gameVersion]
    },
    {
      pals: ["ready", 287, "1.0.1"],
      items: ["incomplete", 1847, "1.0.1.100619"],
      breeding: ["sample", 3, "sample-baseline"],
      skills: ["incomplete", 566, "1.0.1.100619"]
    }
  );
  assert.deepEqual(meta.coverage?.palDetails, { available: 270, missing: 17, total: 287 });
  assert.deepEqual(meta.coverage?.itemImages, { available: 1762, missing: 85, total: 1847 });
  assert.deepEqual(meta.coverage?.skillDetails, { available: 564, missing: 2, total: 566 });
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
  assert.equal(service.search("SheepBall", 10).pals[0]?.id, "lamball");
  assert.equal(service.search("PalSphere", 10).items[0]?.id, "pal-sphere");

  const mixed = service.search("Pal", 20);
  assert.equal(mixed.metadata.gameVersion, "1.0.1");
  assert.equal(mixed.domains.pals.status, "ready");
  assert.equal(mixed.domains.pals.metadata.gameVersion, "1.0.1");
  assert.equal(mixed.domains.items.status, "incomplete");
  assert.equal(mixed.domains.items.metadata.gameVersion, "1.0.1.100619");

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

  const sourceInternalId = service.listPals({
    q: "SheepBall",
    sort: "number",
    order: "asc",
    page: 1,
    limit: 10
  });
  assert.deepEqual(sourceInternalId.items.map((pal) => pal.id), ["lamball"]);
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
  assert.deepEqual(response.items.map((item) => item.id), [
    "pal-sphere-ancient-2",
    "pal-sphere-ancient-1",
    "pal-sphere-exotic",
    "pal-sphere-ultimate",
    "pal-sphere-legend",
    "pal-sphere-master",
    "pal-sphere-tera",
    "pal-sphere-giga",
    "pal-sphere-mega",
    "pal-sphere"
  ]);
  assert.equal(response.items.every((item) => item.category === "sphere"), true);
  assert.equal(service.getItem("pal_sphere").id, "pal-sphere");

  const sourceInternalId = service.listItems({
    q: "PalSphere",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 10
  });
  assert.equal(sourceInternalId.items.some((item) => item.id === "pal-sphere"), true);
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
  assert.equal(parents.metadata.gameVersion, "sample-baseline");
});

test("손상된 catalog artifact는 암묵적으로 ready가 되지 않고 incomplete·sample fallback을 노출한다", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "palworld-malformed-catalog-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  for (const fileName of [
    "catalog.json",
    "catalog-manifest.json",
    "item-images-manifest.json",
    "element-images-manifest.json"
  ]) {
    await copyFile(new URL(fileName, releaseRoot), path.join(root, fileName));
  }
  const malformed = JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8"));
  malformed.unexpected = true;
  await writeFile(path.join(root, "catalog.json"), `${JSON.stringify(malformed)}\n`);

  const fallback = await loadPalworldDataService({ catalogRoot: root });
  const meta = fallback.meta();
  assert.equal(meta.domains.pals.status, "incomplete");
  assert.equal(meta.domains.pals.recordCount, 287);
  assert.equal(meta.domains.items.status, "sample");
  assert.equal(meta.domains.items.metadata.gameVersion, "sample-baseline");
  assert.equal(meta.domains.breeding.status, "sample");
  assert.equal(meta.domains.breeding.metadata.gameVersion, "sample-baseline");
  assert.equal(meta.domains.skills, undefined);
  assert.equal(meta.coverage, undefined);
  assert.equal(fallback.getPal("lamball").descriptionEn.length > 0, true);
  assert.deepEqual(fallback.getPal("lamball").drops, []);
});

test("adapter는 source internal ID를 API 상세와 분리된 provenance로 유지한다", () => {
  assert.equal(service.sourceInternalIdForPal("lamball"), "SheepBall");
  assert.equal(service.sourceInternalIdForPal("relaxaurus_lux"), "LazyDragon_Electric");
  assert.equal("sourceInternalId" in service.getPal("lamball"), false);
});

test("존재하지 않는 Pal·아이템·스킬은 안정적인 not found 오류를 발생시킨다", () => {
  assert.throws(() => service.getPal("missing-pal"), PalworldRecordNotFoundError);
  assert.throws(() => service.getItem("missing-item"), PalworldRecordNotFoundError);
  assert.throws(() => service.getSkill("missing-skill"), PalworldRecordNotFoundError);
});

test("검색과 목록 응답은 Shared schema 계약을 충족한다", () => {
  const pals = service.listPals({ sort: "number", order: "asc", page: 10_000, limit: 5 });
  const items = service.listItems({ sort: "name", order: "asc", page: 1, limit: 5 });
  const skills = service.listSkills({ sort: "name", order: "asc", page: 1, limit: 5 });
  assert.equal(validatePalworldSearchResult(service.search("Pal", 20)).ok, true);
  assert.equal(validatePalworldPaginatedResponse(pals, validatePalworldPalSummary).ok, true);
  assert.equal(validatePalworldPaginatedResponse(items, validatePalworldItemSummary).ok, true);
  assert.equal(validatePalworldPaginatedResponse(skills, validatePalworldSkillSummary).ok, true);
  assert.equal(validatePalworldSkillDetail(service.getSkill(skills.items[0].id)).ok, true);
});

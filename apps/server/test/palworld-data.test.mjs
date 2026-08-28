import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  classifyLegacyPalworldPassiveEffects,
  loadPalworldDataService,
  PalworldDomainUnavailableError,
  PalworldDataService,
  PalworldRecordNotFoundError
} = await import("../dist/services/palworld-data.js");
const { PALWORLD_SNAPSHOT } = await import("../dist/data/palworld-snapshot.js");
const {
  loadPalworldBreedingRuntimeSource
} = await import("../dist/data/palworld-breeding-artifact.js");
const {
  PALWORLD_ITEM_FILTER_CATEGORIES,
  validatePalworldItemSummary,
  validatePalworldPaginatedResponse,
  validatePalworldPalDetail,
  validatePalworldPalListResponse,
  validatePalworldSearchResult,
  validatePalworldSkillDetail,
  validatePalworldSkillListResponse
} = await import("@streamops/shared");

const service = await loadPalworldDataService();
const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const breedingManifest = JSON.parse(
  await readFile(new URL("breeding-manifest.json", releaseRoot), "utf8")
);
const breedingArtifact = JSON.parse(
  await readFile(new URL("breeding.json", releaseRoot), "utf8")
);

test("서비스는 주입된 스냅샷도 Shared schema로 검증한다", () => {
  assert.throws(() => new PalworldDataService(), TypeError);
  assert.throws(() => new PalworldDataService({ pals: [], items: [], breedingPairs: [] }), TypeError);
});

test("명시적인 operator/shadow 경로만 snapshot 교배 index를 사용한다", () => {
  const withoutIndex = new PalworldDataService(PALWORLD_SNAPSHOT);
  assert.equal(
    withoutIndex.breeding({ parentA: "penking", parentB: "bushi" }).state,
    "data_unavailable"
  );
  const unavailablePartners = withoutIndex.breedingPartners({
    parent: "lamball",
    page: 1,
    limit: 10
  });
  assert.equal(unavailablePartners.parent.id, "lamball");
  assert.equal(unavailablePartners.state, "data_unavailable");
  assert.deepEqual(unavailablePartners.items, []);
  assert.equal(unavailablePartners.pagination.total, 0);

  const withIndex = new PalworldDataService(PALWORLD_SNAPSHOT, {
    useSnapshotBreedingPairs: true
  });
  assert.equal(withIndex.meta().counts.breedingPairs, 3);
  assert.equal(
    withIndex.breeding({ parentA: "penking", parentB: "bushi" }).result?.child.id,
    "anubis"
  );
  assert.deepEqual(
    withIndex.breedingParents({ child: "anubis", page: 1, limit: 10 }).items
      .map((pair) => [pair.parentA.id, pair.parentB.id]),
    [["penking", "bushi"]]
  );
  assert.deepEqual(
    withIndex.breedingParents({ child: "anubis", parent: "penking", page: 1, limit: 10 }).items
      .map((pair) => [pair.parentA.id, pair.parentB.id]),
    [["penking", "bushi"]]
  );
  const narrowedNone = withIndex.breedingParents({ child: "anubis", parent: "lamball", page: 1, limit: 10 });
  assert.equal(narrowedNone.pagination.total, 0);
  assert.equal(narrowedNone.state, "not_found");
  assert.throws(() => withIndex.breedingParents({ child: "anubis", parent: "missing-pal", page: 1, limit: 10 }));
  const special = withIndex.breedingParents({ child: "anubis", type: "special", page: 1, limit: 10 });
  const filteredNormal = withIndex.breedingParents({ child: "anubis", type: "normal", page: 1, limit: 10 });
  const normal = withIndex.breedingParents({ child: "lamball", type: "normal", page: 1, limit: 1 });
  assert.equal(special.pagination.total, 1);
  assert.equal(special.items.every((pair) => pair.isSpecial), true);
  assert.equal(filteredNormal.pagination.total, 0);
  assert.equal(filteredNormal.state, "not_found");
  assert.equal(normal.pagination.total, 1);
  assert.equal(normal.pagination.totalPages, 1);
  assert.equal(normal.items.every((pair) => !pair.isSpecial), true);
  assert.deepEqual(
    withIndex.breedingPartners({ parent: "bushi", page: 1, limit: 10 }).items
      .map((pair) => [pair.parentA.id, pair.parentB.id, pair.child.id]),
    [["penking", "bushi", "anubis"]]
  );
});

test("runtime meta는 고정 catalog의 Pal·아이템·스킬 coverage와 분리된 gate를 반환한다", () => {
  const meta = service.meta();
  assert.equal(meta.metadata.gameVersion, "1.0.1");
  assert.equal(meta.counts.pals, 287);
  assert.equal(meta.counts.items, 1847);
  assert.equal(meta.counts.breedingPairs, 41_329);
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
      items: ["incomplete", 1847, "1.0.1"],
      breeding: ["incomplete", 41_329, "1.0.1"],
      skills: ["incomplete", 566, "1.0.1"]
    }
  );
  assert.equal(meta.domains.items.domainMetadata.gameVersion, "1.0.1.100619");
  assert.equal(meta.domains.skills.domainMetadata.gameVersion, "1.0.1.100619");
  assert.equal(
    meta.domains.breeding.domainMetadata.sourceRevision,
    `${breedingArtifact.metadata.sourceRevision}+breeding@${breedingManifest.sourceChecksumsSha256}`
  );
  assert.deepEqual(meta.coverage?.palDetails, { available: 270, missing: 17, total: 287 });
  assert.deepEqual(meta.coverage?.itemImages, { available: 1762, missing: 85, total: 1847 });
  assert.deepEqual(meta.coverage?.skillDetails, { available: 566, missing: 0, total: 566 });
  assert.deepEqual(meta.gates.dataIntegrity, { passed: true, status: "ready" });
  assert.deepEqual(meta.gates.imageAssets, {
    status: "operator_acknowledged",
    policyStatus: "operator_acknowledged",
    technicalPassed: true,
    publicActivationAllowed: true,
    rightsVerified: false,
    usageBasis: "operator_reference_use",
    readyImages: 287,
    fallbackPals: 0,
    publicNoticeRequired: true
  });
});

test("교배 sitemap 범위 조회는 전체 41,329건을 결정적으로 나눈다", () => {
  const first = service.listBreedingPairs({ offset: 0, limit: 2 });
  const firstAgain = service.listBreedingPairs({ offset: 0, limit: 2 });
  const tail = service.listBreedingPairs({ offset: 41_328, limit: 2 });
  assert.equal(first.total, 41_329);
  assert.equal(first.items.length, 2);
  assert.deepEqual(first.items, firstAgain.items);
  assert.equal(tail.total, 41_329);
  assert.equal(tail.items.length, 1);
  assert.notEqual(first.items[0]?.id, tail.items[0]?.id);
  assert.throws(
    () => service.listBreedingPairs({ offset: -1, limit: 1 }),
    /조회 범위/u,
  );
});

test("활성 Pal 287종과 상세 스킬 이름은 공식 한국어·일본어 locale을 유지한다", () => {
  const palSummaries = service.listPals({
    sort: "number",
    order: "asc",
    page: 1,
    limit: service.meta().counts.pals
  }).items;
  assert.equal(palSummaries.length, 287);
  assert.equal(new Set(palSummaries.map((pal) => pal.id)).size, 287);

  for (const summary of palSummaries) {
    const pal = service.getPal(summary.id);
    assert.equal(pal.translation?.name?.ko, "source_provided", `${pal.id} 한국어 이름`);
    assert.equal(pal.translation?.name?.ja, "source_provided", `${pal.id} 일본어 이름`);
    assert.notEqual(pal.nameKo, pal.nameEn, `${pal.id} 한국어 이름이 영문 fallback이면 안 됩니다.`);
    assert.notEqual(pal.nameJa, pal.nameEn, `${pal.id} 일본어 이름이 영문 fallback이면 안 됩니다.`);

    for (const skill of [
      ...(pal.partnerSkill ? [pal.partnerSkill] : []),
      ...pal.activeSkills
    ]) {
      assert.equal(
        skill.translation?.name?.ko,
        "source_provided",
        `${pal.id}/${skill.id} 한국어 스킬 이름`
      );
      assert.equal(
        skill.translation?.name?.ja,
        "source_provided",
        `${pal.id}/${skill.id} 일본어 스킬 이름`
      );
      assert.notEqual(
        skill.translation?.description?.ko,
        "source_language_fallback",
        `${pal.id}/${skill.id} 한국어 스킬 설명`
      );
      assert.notEqual(
        skill.translation?.description?.ja,
        "source_language_fallback",
        `${pal.id}/${skill.id} 일본어 스킬 설명`
      );
    }
  }
});

test("runtime meta는 레코드 존재 여부가 아니라 실제 상세 필드별 coverage를 집계한다", () => {
  const meta = service.meta();
  const palSummaries = service.listPals({
    sort: "number",
    order: "asc",
    page: 1,
    limit: meta.counts.pals
  }).items;
  const itemSummaries = service.listItems({
    sort: "name",
    order: "asc",
    page: 1,
    limit: meta.counts.items
  }).items;
  const skillSummaries = service.listSkills({
    sort: "name",
    order: "asc",
    page: 1,
    limit: meta.counts.skills
  }).items;
  const pals = palSummaries.map((pal) => service.getPal(pal.id));
  const items = itemSummaries.map((item) => service.getItem(item.id));
  const skills = skillSummaries.map((skill) => service.getSkill(skill.id));
  const expectedAvailable = {
    palDescriptions: pals.filter((pal) =>
      pal.descriptionKo !== undefined || pal.descriptionJa !== undefined || pal.descriptionEn !== undefined
    ).length,
    palStats: pals.filter((pal) => pal.stats !== undefined).length,
    partnerSkills: pals.filter((pal) => pal.partnerSkill !== undefined).length,
    activeSkills: pals.filter((pal) => pal.activeSkills.length > 0).length,
    palDrops: pals.filter((pal) => (pal.dropDetails?.length ?? pal.drops.length) > 0).length,
    breedingFields: 0,
    itemDescriptions: items.filter((item) =>
      item.descriptionKo !== undefined || item.descriptionJa !== undefined || item.descriptionEn !== undefined
    ).length,
    craftingRecipes: items.filter((item) =>
      (item.recipes?.length ?? item.craftingMaterials.length) > 0
    ).length,
    craftingFacilities: items.filter((item) =>
      (item.craftingFacilities?.length ?? (item.craftingFacility === undefined ? 0 : 1)) > 0
    ).length,
    dropPals: items.filter((item) => item.dropPals.length > 0).length,
    technologyLevels: items.filter((item) => item.technologyLevel !== undefined).length,
    prices: items.filter((item) => item.sellPrice !== undefined).length,
    durability: items.filter((item) => item.durability !== undefined).length,
    acquisitionMethods: items.filter((item) => item.acquisitionMethods.length > 0).length,
    skillDescriptions: skills.filter((skill) =>
      skill.descriptionKo !== undefined || skill.descriptionJa !== undefined || skill.descriptionEn !== undefined
    ).length,
    relatedPals: skills.filter((skill) => skill.relatedPals.length > 0).length
  };

  for (const [field, available] of Object.entries(expectedAvailable)) {
    assert.deepEqual(meta.coverage[field], {
      available,
      missing: meta.coverage[field].total - available,
      total: meta.coverage[field].total
    });
  }
  assert.equal(meta.coverage.craftingFacilities.available, 1183);
  assert.equal(meta.coverage.itemDetails.available, meta.counts.items);
  assert.equal(meta.coverage.craftingRecipes.available < meta.coverage.itemDetails.available, true);
});

test("아이템 상세는 고정 ZIP의 제작식·제작 시설·획득 방법을 exact join으로 제공한다", () => {
  const palSphere = service.getItem("pal-sphere");
  assert.deepEqual(
    palSphere.recipes?.map((recipe) => ({
      sourceRowId: recipe.sourceRowId,
      resultCount: recipe.resultCount,
      workAmount: recipe.workAmount,
      materials: recipe.materials.map((material) => [
        material.item.id,
        material.quantity
      ])
    })),
    [{
      sourceRowId: "PalSphere",
      resultCount: 1,
      workAmount: 300,
      materials: [["pal-crystal-s", 1]]
    }]
  );
  assert.deepEqual(
    palSphere.craftingFacilities?.map((facility) => facility.nameKo),
    [
      "원시적인 작업대",
      "스피어 제작대",
      "스피어라인 공장",
      "스피어라인 공장 Ⅱ",
      "고도 문명 스피어 공장",
      "고대 문명 작업대"
    ]
  );
  assert.equal(
    palSphere.craftingFacilities?.every((facility) =>
      /^\/images\/palworld\/1\.0\.1\/technology\/assets\/item\/[0-9a-f]{64}\.webp$/u.test(
        facility.imageUrl ?? ""
      )
      && Number.isInteger(facility.imageWidth)
      && facility.imageWidth > 0
      && Number.isInteger(facility.imageHeight)
      && facility.imageHeight > 0
    ),
    true
  );
  assert.deepEqual(
    palSphere.acquisitionMethods.map((method) => method.type),
    ["craft", "merchant", "chest"]
  );

  const paldiumFragment = service.getItem("pal-crystal-s");
  assert.equal(paldiumFragment.recipes?.length, 13);
  assert.deepEqual(paldiumFragment.craftingMaterials, []);
  assert.equal(
    paldiumFragment.recipes?.every((recipe) =>
      recipe.materials.every((material) => material.item.id.length > 0)
    ),
    true
  );
});

test("Pal 상세는 active composite에 고정된 농축 규칙으로 단계별 능력치를 반환한다", () => {
  const detail = service.getPal("anubis");
  assert.equal(detail.condensation.availability, "available");
  assert.match(detail.condensation.sourceRuleSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(
    detail.condensation.stages.map((stage) => ({
      stars: stage.stars,
      hp: stage.stats.find((entry) => entry.stat === "hp")?.value,
      attack: stage.stats.find((entry) => entry.stat === "attack")?.value,
      defense: stage.stats.find((entry) => entry.stat === "defense")?.value
    })),
    [
      { stars: 0, hp: 120, attack: 130, defense: 100 },
      { stars: 1, hp: 126, attack: 136.5, defense: 105 },
      { stars: 2, hp: 132, attack: 143, defense: 110 },
      { stars: 3, hp: 138, attack: 149.5, defense: 115 },
      { stars: 4, hp: 144, attack: 156, defense: 120 }
    ]
  );
  assert.equal(
    detail.condensation.stages.every(
      (stage) => stage.workSuitabilities.length === 0
    ),
    true,
    "미검증 1.0 작업 적성 선택 규칙은 추정하지 않습니다."
  );
  assert.equal(validatePalworldPalDetail(detail).ok, true);
});

test("Pal snapshot에 직접 주입된 available 농축 단계는 별도 artifact gate 없이 공개하지 않는다", () => {
  const snapshot = structuredClone(PALWORLD_SNAPSHOT);
  const pal = snapshot.pals[0];
  assert.ok(pal);
  pal.condensation = {
    availability: "available",
    sourceRuleSha256: "a".repeat(64),
    stages: [0, 1, 2, 3, 4].map((stars) => ({
      stars,
      characterRank: stars + 1,
      partnerSkillRank: stars + 1,
      stats: [],
      workSuitabilities: []
    }))
  };

  const injectedService = new PalworldDataService(snapshot);
  assert.deepEqual(
    injectedService.getPal(pal.id).condensation,
    { availability: "missing_source" }
  );
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
  assert.equal(mixed.domains.items.metadata.gameVersion, "1.0.1");
  assert.equal(mixed.domains.items.domainMetadata.gameVersion, "1.0.1.100619");

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

test("Pal 목록 facet은 현재 페이지가 아닌 전체 active catalog에서 계산한다", () => {
  const total = service.meta().counts.pals;
  const allPals = service.listPals({
    sort: "number",
    order: "asc",
    page: 1,
    limit: total
  }).items;
  const firstPage = service.listPals({
    element: "ground",
    work: "mining",
    rarity: 10,
    variant: "normal",
    sort: "number",
    order: "asc",
    page: 1,
    limit: 1
  });
  const unfiltered = service.listPals({
    sort: "number",
    order: "asc",
    page: 1,
    limit: 1
  });

  assert.equal(firstPage.items.length <= 1, true);
  assert.deepEqual(firstPage.facets, unfiltered.facets);
  assert.equal(unfiltered.pagination.pageSize, 1);
  assert.equal(unfiltered.facets.variants.reduce((sum, facet) => sum + facet.count, 0), total);
  assert.equal(unfiltered.facets.rarities.reduce((sum, facet) => sum + facet.count, 0), total);

  for (const facet of unfiltered.facets.elements) {
    assert.equal(
      facet.count,
      allPals.filter((pal) => pal.elements.includes(facet.value)).length
    );
  }
  for (const facet of unfiltered.facets.workSuitabilities) {
    assert.equal(
      facet.count,
      allPals.filter((pal) =>
        pal.workSuitabilities.some((work) => work.type === facet.value)
      ).length
    );
  }
  for (const facet of unfiltered.facets.rarities) {
    assert.equal(facet.count, allPals.filter((pal) => pal.rarity === facet.value).length);
  }
  for (const facet of unfiltered.facets.variants) {
    assert.equal(facet.count, allPals.filter((pal) => pal.variantType === facet.value).length);
  }
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

  const blueprint = service.listItems({
    q: "Blueprint_Accessory_AquaResist_1_2",
    itemType: "blueprint",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 10
  }).items.find((item) => item.blueprintTarget !== undefined);
  assert.ok(blueprint?.blueprintTarget);
  assert.deepEqual(
    service.getItem(blueprint.id).blueprintTarget,
    blueprint.blueprintTarget
  );
});

test("기술 해금 목록은 검증된 기술 레벨이 있는 아이템만 레벨순으로 반환한다", () => {
  const response = service.listItems({
    technology: "unlockable",
    sort: "technologyLevel",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(response.pagination.total, 380);
  assert.equal(response.items.every((item) => item.technologyLevel !== undefined), true);
  assert.deepEqual(
    response.items.map((item) => item.technologyLevel),
    [...response.items]
      .map((item) => item.technologyLevel)
      .sort((left, right) => left - right)
  );

  assert.deepEqual(
    [
      ["grappling-gun", 12],
      ["grappling-gun2", 17],
      ["grappling-gun3", 31],
      ["grappling-gun4", 49],
      ["flame-thrower", 52],
      ["glider-tera", 52],
      ["shield-ultra", 55],
      ["grappling-gun5", 63],
    ].map(([id, level]) => [id, service.getItem(id).technologyLevel, level]),
    [
      ["grappling-gun", 12, 12],
      ["grappling-gun2", 17, 17],
      ["grappling-gun3", 31, 31],
      ["grappling-gun4", 49, 49],
      ["flame-thrower", 52, 52],
      ["glider-tera", 52, 52],
      ["shield-ultra", 55, 55],
      ["grappling-gun5", 63, 63],
    ]
  );

  const melpacaSaddle = service.getItem("skill-unlock-alpaca");
  assert.equal(melpacaSaddle.technologyPal?.id, "melpaca");
  assert.match(melpacaSaddle.technologyPal?.imageUrl ?? "", /\/pals\/[a-f0-9]{64}\.webp$/u);
  assert.equal(
    service.getItem("skill-unlock-thunderdog-ice").technologyPal?.id,
    "rayhound-cryst"
  );
  const allItemSummaries = service.listItems({
    sort: "name",
    order: "asc",
    page: 1,
    limit: service.meta().counts.items
  }).items;
  const palGear = allItemSummaries.filter((item) => item.id.startsWith("skill-unlock-"));
  assert.equal(palGear.length, 138);
  assert.equal(palGear.every((item) => item.technologyPal !== undefined), true);
});

test("기술 해금 전용 목록은 아이템과 검증된 건축물 217개를 함께 반환한다", () => {
  const response = service.listTechnologyUnlocks({
    locale: "ko",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(response.pagination.total, 597);
  assert.equal(response.items[0].technologyLevel, 1);
  assert.equal(
    response.items.every(
      (unlock, index, entries) =>
        index === 0 || entries[index - 1].technologyLevel <= unlock.technologyLevel
    ),
    true
  );

  const workbench = service.listTechnologyUnlocks({
    q: "원시적인 작업대",
    locale: "ko",
    order: "asc",
    page: 1,
    limit: 10
  });
  assert.equal(workbench.pagination.total, 1);
  assert.deepEqual(
    workbench.items.map((unlock) => [
      unlock.kind,
      unlock.kind === "building" ? unlock.sourceRowId : unlock.item.id,
      unlock.technologyLevel
    ]),
    [["building", "Workbench", 1]]
  );
  assert.match(
    workbench.items[0].imageUrl,
    /\/technology\/assets\/item\/[a-f0-9]{64}\.webp$/u
  );

  const japanese = service.listTechnologyUnlocks({
    q: "原始的な作業台",
    locale: "ja",
    order: "asc",
    page: 1,
    limit: 10
  });
  assert.equal(japanese.pagination.total, 1);
  assert.equal(japanese.items[0].kind, "building");
});

test("아이템 공개 분류는 sourceCategory 기준 12종으로 모든 runtime 아이템을 빠짐없이 분류한다", () => {
  const totals = PALWORLD_ITEM_FILTER_CATEGORIES.map((itemType) => ({
    itemType,
    total: service.listItems({
      itemType,
      sort: "name",
      order: "asc",
      page: 1,
      limit: 1
    }).pagination.total
  }));
  assert.equal(totals.length, 12);
  assert.deepEqual(Object.fromEntries(
    totals.map(({ itemType, total }) => [itemType, total])
  ), {
    material: 177,
    sphere: 10,
    ammo: 32,
    consumable: 205,
    weapon: 286,
    armor: 244,
    accessory: 81,
    glider: 5,
    food: 94,
    valuable: 217,
    blueprint: 490,
    sphere_module: 6
  });
  assert.equal(
    totals.reduce((sum, { total }) => sum + total, 0),
    service.meta().counts.items
  );

  const legendary = service.listItems({
    rarityTier: "legendary",
    sort: "rarity",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(legendary.items.every((item) => item.rarity === 4), true);
  assert.equal(legendary.pagination.total, 313);
  const sourceOnlyRarity = service.listItems({
    rarity: 5,
    sort: "rarity",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(sourceOnlyRarity.pagination.total, 2);
  assert.equal(sourceOnlyRarity.items.every((item) => item.rarity === 5), true);
});

test("교배 조회는 부모 순서 교환, 동일 부모와 목표 Pal 역검색을 지원한다", () => {
  assert.equal(service.breeding({ parentA: "penking", parentB: "bushi" }).result?.child.id, "sibelyx");
  assert.equal(service.breeding({ parentA: "bushi", parentB: "penking" }).result?.child.id, "sibelyx");
  assert.equal(service.breeding({ parentA: "lamball", parentB: "lamball" }).result?.child.id, "lamball");
  assert.equal(service.breeding({ parentA: "lamball", parentB: "lamball" }).parentA.nameKo, "도로롱");
  assert.equal(service.breeding({ parentA: "cattiva", parentB: "lamball" }).result?.child.id, "daedream");
  assert.equal(service.breeding({ parentA: "panthalus", parentB: "lamball" }).result?.child.id, "bakemi");

  const parents = service.breedingParents({ child: "anubis", page: 1, limit: 1 });
  assert.equal(parents.child.id, "anubis");
  assert.deepEqual(
    [parents.items[0]?.parentA.id, parents.items[0]?.parentB.id],
    ["aegidron", "fenglope-lux"]
  );
  assert.equal(parents.pagination.total, 234);
  assert.deepEqual(
    service.breedingParents({ child: "panthalus", page: 1, limit: 10 }).items
      .map((pair) => [pair.parentA.id, pair.parentB.id, pair.child.id]),
    [["panthalus", "panthalus", "panthalus"]]
  );
  assert.equal(service.breeding({ parentA: "penking", parentB: "bushi" }).metadata.gameVersion, "1.0.1");
  assert.equal(parents.metadata.gameVersion, "1.0.1");

  const partners = service.breedingPartners({ parent: "lamball", page: 1, limit: 10 });
  assert.equal(partners.parent.id, "lamball");
  assert.equal(partners.pagination.total > 0, true);
  assert.equal(
    partners.items.every((pair) =>
      pair.parentA.id === "lamball" || pair.parentB.id === "lamball"
    ),
    true
  );
  assert.equal(partners.metadata.gameVersion, "1.0.1");
  const specialPartners = service.breedingPartners({
    parent: "katress",
    type: "special",
    page: 1,
    limit: 100
  });
  assert.equal(specialPartners.items.every((pair) => pair.isSpecial), true);
  assert.equal(
    specialPartners.items.filter((pair) =>
      pair.parentA.id === "katress" && pair.parentB.id === "wixen"
    ).length,
    2
  );

  const gendered = service.breeding({ parentA: "katress", parentB: "wixen" });
  assert.equal(gendered.state, "requires_gender");
  assert.deepEqual(gendered.alternatives.map((pair) => pair.child.id), ["katress-ignis", "wixen-noct"]);
  assert.equal(service.breeding({
    parentA: "katress",
    parentB: "wixen",
    parentAGender: "male",
    parentBGender: "female"
  }).result?.child.id, "wixen-noct");
});

test("Pal 상세 특수 부모는 active breeding artifact의 non-self 규칙과 일치한다", async () => {
  const breedingSource = await loadPalworldBreedingRuntimeSource(
    releaseRoot.pathname,
    { requireImportReport: false }
  );
  const artifactPairs = breedingSource.artifact.specialRules
    .filter((rule) =>
      !(
        rule.parentAId === rule.parentBId
        && rule.parentAId === rule.childId
      )
    )
    .map((rule) => [
      rule.childId,
      rule.parentAId,
      rule.parentBId,
      rule.parentAGender ?? "",
      rule.parentBGender ?? ""
    ].join("\0"))
    .sort();
  const detailPairs = [...new Set(
    breedingSource.artifact.specialRules.map((rule) => rule.childId)
  )]
    .flatMap((childId) =>
      service.getPal(childId).breeding.specialParentPairs.map((pair) => [
        childId,
        pair.parentAId,
        pair.parentBId,
        pair.parentAGender ?? "",
        pair.parentBGender ?? ""
      ].join("\0"))
    )
    .sort();
  assert.deepEqual(detailPairs, artifactPairs);
  assert.equal(
    service.getPal("broncherry-aqua").breeding.specialParentPairs.some(
      (pair) =>
        pair.parentAId === "broncherry"
        && pair.parentBId === "fuack"
        && pair.parentA?.nameKo === "라브라돈"
        && pair.parentB?.nameKo === "청부리"
    ),
    true
  );
  assert.equal(
    service.getPal("fuack-ignis").breeding.specialParentPairs.some(
      (pair) =>
        pair.parentAId === "fuack"
        && pair.parentBId === "flambelle"
    ),
    true
  );
});

test("손상된 catalog와 누락된 교배 artifact는 sample 결과로 조용히 fallback하지 않는다", async (context) => {
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
  assert.equal(meta.domains.items.status, "unavailable");
  assert.equal(meta.domains.items.recordCount, 0);
  assert.equal(meta.domains.items.metadata.gameVersion, "1.0.1");
  assert.equal(meta.domains.breeding.status, "incomplete");
  assert.equal(meta.domains.breeding.recordCount, 0);
  assert.equal(meta.domains.breeding.metadata.gameVersion, "1.0.1");
  assert.equal(meta.domains.skills.status, "unavailable");
  assert.equal(meta.domains.skills.recordCount, 0);
  assert.equal(meta.coverage, undefined);
  assert.equal(fallback.getPal("lamball").descriptionEn.length > 0, true);
  assert.deepEqual(fallback.getPal("lamball").drops, []);
  assert.throws(() => fallback.listItems({ sort: "name", order: "asc", page: 1, limit: 10 }), PalworldDomainUnavailableError);
  assert.throws(() => fallback.listSkills({ sort: "name", order: "asc", page: 1, limit: 10 }), PalworldDomainUnavailableError);
  assert.equal(fallback.breeding({ parentA: "lamball", parentB: "cattiva" }).state, "data_unavailable");
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
  assert.equal(validatePalworldPalListResponse(pals).ok, true);
  assert.equal(validatePalworldPaginatedResponse(items, validatePalworldItemSummary).ok, true);
  assert.equal(validatePalworldSkillListResponse(skills).ok, true);
  assert.equal(validatePalworldSkillDetail(service.getSkill(skills.items[0].id)).ok, true);
  assert.equal(skills.items.every((skill) =>
    skill.relatedPalPreviews.length === Math.min(3, skill.relatedPalCount)
  ), true);
  const previewedSkill = skills.items.find((skill) => skill.relatedPalCount > 0);
  assert.ok(previewedSkill);
  assert.deepEqual(
    previewedSkill.relatedPalPreviews,
    service.getSkill(previewedSkill.id).relatedPals.slice(0, 3).map(({ pal }) => pal)
  );
});

test("스킬 facet과 필터는 액티브·파트너 속성과 패시브 exact mapping을 분리한다", () => {
  const all = service.listSkills({
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(validatePalworldSkillListResponse(all).ok, true);
  assert.equal(
    all.facets.types.reduce((total, facet) => total + facet.count, 0),
    all.pagination.total
  );

  const activeElement = all.facets.activeElements[0];
  assert.ok(activeElement);
  const active = service.listSkills({
    type: "active",
    element: activeElement.value,
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(active.pagination.total, activeElement.count);
  assert.equal(
    active.items.every((skill) => skill.type === "active" && skill.element === activeElement.value),
    true
  );

  const partnerElement = all.facets.partnerElements[0];
  assert.ok(partnerElement);
  const partner = service.listSkills({
    type: "partner",
    partnerElement: partnerElement.value,
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(partner.pagination.total, partnerElement.count);
  assert.equal(partner.items.every((skill) =>
    service.getSkill(skill.id).relatedPals.some((assignment) =>
      assignment.pal.elements.includes(partnerElement.value)
    )
  ), true);

  const passiveEffect = all.facets.passiveEffects.find((facet) => facet.value === "attack");
  assert.ok(passiveEffect);
  const passive = service.listSkills({
    type: "passive",
    passiveEffect: "attack",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(passive.pagination.total, passiveEffect.count);
  assert.equal(passive.items.every((skill) =>
    classifyLegacyPalworldPassiveEffects(skill.passiveAbility).includes("attack")
  ), true);

  const passiveTier = all.facets.passiveTiers[0];
  assert.ok(passiveTier);
  const tiered = service.listSkills({
    type: "passive",
    passiveTier: passiveTier.value,
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  });
  assert.equal(tiered.pagination.total, passiveTier.count);
  assert.equal(tiered.items.every((skill) => skill.passiveTier === passiveTier.value), true);

  assert.deepEqual(
    classifyLegacyPalworldPassiveEffects("Attack Up + Defense Down"),
    ["attack", "defense"]
  );
  assert.deepEqual(
    classifyLegacyPalworldPassiveEffects("Attack Up + Unknown"),
    ["other"]
  );
});

test("이름 정렬은 요청 locale을 우선하고 누락된 이름은 영문으로 fallback한다", () => {
  const japanesePals = service.listPals({
    locale: "ja",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  }).items;
  const koreanPals = service.listPals({
    locale: "ko",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  }).items;
  assert.notDeepEqual(
    japanesePals.map((pal) => pal.id),
    koreanPals.map((pal) => pal.id)
  );
  for (let index = 1; index < japanesePals.length; index += 1) {
    assert.equal(
      japanesePals[index - 1].nameJa.localeCompare(
        japanesePals[index].nameJa,
        ["ja", "ko", "en"],
        { numeric: true, sensitivity: "base" }
      ) <= 0,
      true
    );
  }

  const japaneseItems = service.listItems({
    locale: "ja",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  }).items;
  for (let index = 1; index < japaneseItems.length; index += 1) {
    const left = japaneseItems[index - 1].nameJa ?? japaneseItems[index - 1].nameEn;
    const right = japaneseItems[index].nameJa ?? japaneseItems[index].nameEn;
    assert.equal(
      left.localeCompare(right, ["ja", "ko", "en"], { numeric: true, sensitivity: "base" }) <= 0,
      true
    );
  }

  const japaneseSkills = service.listSkills({
    locale: "ja",
    sort: "name",
    order: "asc",
    page: 1,
    limit: 100
  }).items;
  for (let index = 1; index < japaneseSkills.length; index += 1) {
    const left = japaneseSkills[index - 1].nameJa ?? japaneseSkills[index - 1].nameEn;
    const right = japaneseSkills[index].nameJa ?? japaneseSkills[index].nameEn;
    assert.equal(
      left.localeCompare(right, ["ja", "ko", "en"], { numeric: true, sensitivity: "base" }) <= 0,
      true
    );
  }
});

test("locale을 생략한 아이템·스킬 정렬은 기존 영문 기준을 유지한다", () => {
  for (const items of [
    service.listItems({ sort: "name", order: "asc", page: 1, limit: 100 }).items,
    service.listSkills({ sort: "name", order: "asc", page: 1, limit: 100 }).items
  ]) {
    for (let index = 1; index < items.length; index += 1) {
      assert.equal(
        items[index - 1].nameEn.localeCompare(
          items[index].nameEn,
          ["en", "ko", "ja"],
          { numeric: true, sensitivity: "base" }
        ) <= 0,
        true
      );
    }
  }
});

test("목록 정렬의 동률 항목은 canonical ID로 결정되어 pagination 경계가 안정적이다", () => {
  const compareId = (left, right) => left.id.localeCompare(right.id, "en");
  const compareName = (left, right) => left.nameEn.localeCompare(
    right.nameEn,
    ["en", "ko", "ja"],
    { numeric: true, sensitivity: "base" }
  );
  const assertTieBreaker = (records, isTie, order = "asc") => {
    let ties = 0;
    for (let index = 1; index < records.length; index += 1) {
      const left = records[index - 1];
      const right = records[index];
      if (!isTie(left, right)) continue;
      ties += 1;
      assert.equal(
        order === "desc" ? compareId(left, right) > 0 : compareId(left, right) < 0,
        true,
        `${left.id}와 ${right.id}의 canonical ID 순서가 안정적이어야 합니다.`
      );
    }
    assert.equal(ties > 0, true, "고정 snapshot에 tie-breaker를 검증할 동률 레코드가 있어야 합니다.");
  };

  for (const order of ["asc", "desc"]) {
    const pals = service.listPals({
      sort: "rarity",
      order,
      page: 1,
      limit: service.meta().counts.pals
    }).items;
    assertTieBreaker(
      pals,
      (left, right) => left.rarity === right.rarity && left.number === right.number,
      order
    );

    const items = service.listItems({
      sort: "name",
      order,
      page: 1,
      limit: service.meta().counts.items
    }).items;
    assertTieBreaker(items, (left, right) => compareName(left, right) === 0, order);

    const skills = service.listSkills({
      sort: "name",
      order,
      page: 1,
      limit: service.meta().counts.skills
    }).items;
    assertTieBreaker(skills, (left, right) => compareName(left, right) === 0, order);
  }
});

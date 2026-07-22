import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPalworldDataSnapshot,
  validatePalworldBreedingParentsResponse,
  validatePalworldBreedingResultResponse,
  validatePalworldDataMetadata,
  validatePalworldDataSnapshot,
  validatePalworldMetaResponse,
  validatePalworldPaginatedResponse,
  validatePalworldPalDetail,
  validatePalworldPalSummary,
  validatePalworldSearchResult
} from "../dist/index.js";

const metadata = {
  gameVersion: "0.6.2",
  sourceName: "StreamOps Palworld 정규화 스냅샷",
  sourceUrl: "https://github.com/tylercamp/palcalc",
  sourceRevision: "test-revision",
  extractedAt: "2026-07-20T00:00:00.000Z",
  verifiedAt: "2026-07-21T00:00:00.000Z",
  license: "MIT (교배 데이터), 자체 보유 게임 데이터 (나머지 데이터)"
};

const searchDomains = {
  pals: { status: "ready", recordCount: 1, metadata },
  items: { status: "sample", recordCount: 1, metadata }
};

const palImageHash = "a".repeat(64);
const palImageUrl = `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.webp`;

const palReference = {
  id: "anubis",
  number: 100,
  nameKo: "아누비스",
  nameJa: "アヌビス",
  nameEn: "Anubis",
  imageUrl: palImageUrl,
  elements: ["ground"]
};

const itemReference = {
  id: "pal_sphere",
  nameKo: "팰 스피어",
  nameJa: "パルスフィア",
  nameEn: "Pal Sphere",
  imageUrl: "/palworld/items/pal-sphere.webp"
};

const pal = {
  ...palReference,
  rarity: 10,
  variantType: "normal",
  workSuitabilities: [
    { type: "handiwork", level: 4 },
    { type: "mining", level: 3 }
  ],
  stats: { hp: 120, attack: 130, defense: 100, moveSpeed: 800, stamina: 100 },
  nocturnal: false,
  partnerSkill: {
    id: "guardian_of_the_desert",
    type: "partner",
    nameKo: "사막의 수호신",
    nameJa: "砂漠の守護神",
    nameEn: "Guardian of the Desert",
    descriptionKo: "함께 싸우는 동안 플레이어에게 땅 속성을 부여합니다.",
    descriptionJa: "共に戦っている間、プレイヤーの攻撃に地属性を付与します。",
    element: "ground"
  },
  activeSkills: [],
  drops: [itemReference],
  breeding: { breedingPower: 570, specialParentPairs: [{ parentAId: "anubis", parentBId: "anubis" }] },
  metadata
};

const item = {
  ...itemReference,
  category: "sphere",
  rarity: 1,
  descriptionKo: "Pal을 포획하는 데 사용하는 기본 스피어입니다.",
  descriptionJa: "パルを捕獲するための基本的なスフィアです。",
  descriptionEn: "A basic sphere used to capture Pals.",
  sellPrice: 10,
  technologyLevel: 2,
  craftingMaterials: [{ item: itemReference, quantity: 1 }],
  craftingFacility: {
    id: "primitive_workbench",
    nameKo: "원시 작업대",
    nameJa: "原始的な作業台",
    nameEn: "Primitive Workbench"
  },
  dropPals: [palReference],
  acquisitionMethods: [
    {
      type: "craft",
      labelKo: "원시 작업대에서 제작",
      labelJa: "原始的な作業台で作成",
      labelEn: "Craft at a Primitive Workbench"
    }
  ],
  relatedItems: [],
  metadata
};

const breedingPair = {
  id: "anubis-anubis-anubis",
  parentA: palReference,
  parentB: palReference,
  child: palReference,
  isSpecial: false
};

const snapshot = {
  metadata,
  pals: [pal],
  items: [item],
  breedingPairs: [breedingPair]
};

test("Palworld 메타데이터는 출처와 버전 검증 정보를 요구한다", () => {
  assert.equal(validatePalworldDataMetadata(metadata).ok, true);
  assert.equal(validatePalworldDataMetadata({ ...metadata, sourceUrl: "http://example.com/data" }).ok, false);
  assert.equal(validatePalworldDataMetadata({ ...metadata, verifiedAt: "잘못된 날짜" }).ok, false);
});

test("Palworld meta는 도메인별 coverage와 provenance를 검증한다", () => {
  const sampleMetadata = { ...metadata, gameVersion: "sample-baseline", sourceRevision: "sample-revision" };
  const response = {
    metadata,
    counts: { pals: 287, items: 10, breedingPairs: 3 },
    domains: {
      pals: { status: "ready", recordCount: 287, metadata },
      items: { status: "sample", recordCount: 10, metadata: sampleMetadata },
      breeding: { status: "sample", recordCount: 3, metadata: sampleMetadata }
    },
    gates: {
      dataIntegrity: { passed: true, status: "ready" },
      imageAssets: {
        status: "blocked_by_license",
        policyStatus: "missing",
        technicalPassed: false,
        publicActivationAllowed: false,
        rightsVerified: false,
        usageBasis: "none",
        readyImages: 0,
        fallbackPals: 287,
        publicNoticeRequired: true
      }
    }
  };
  assert.equal(validatePalworldMetaResponse(response).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: { ...response.domains, pals: { ...response.domains.pals, recordCount: 286 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    domains: { ...response.domains, items: { ...response.domains.items, status: "complete" } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: { ...response.gates, imageAssets: { ...response.gates.imageAssets, fallbackPals: 286 } }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "operator_acknowledged",
        policyStatus: "operator_acknowledged",
        technicalPassed: true,
        publicActivationAllowed: true,
        usageBasis: "operator_reference_use",
        readyImages: 287,
        fallbackPals: 0
      }
    }
  }).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        policyStatus: "operator_acknowledged",
        usageBasis: "operator_reference_use"
      }
    }
  }).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "partial",
        policyStatus: "rights_verified",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: true,
        usageBasis: "rights_verified",
        readyImages: 286,
        fallbackPals: 1
      }
    }
  }).ok, true);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "operator_acknowledged",
        policyStatus: "operator_acknowledged",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: true,
        usageBasis: "operator_reference_use",
        readyImages: 287,
        fallbackPals: 0
      }
    }
  }).ok, false);
  assert.equal(validatePalworldMetaResponse({
    ...response,
    gates: {
      ...response.gates,
      imageAssets: {
        ...response.gates.imageAssets,
        status: "ready",
        policyStatus: "rights_verified",
        technicalPassed: true,
        publicActivationAllowed: true,
        rightsVerified: false,
        usageBasis: "rights_verified",
        readyImages: 287,
        fallbackPals: 0
      }
    }
  }).ok, false);
});

test("Pal summary는 한국어·일본어·영어 이름과 안전한 로컬 이미지를 검증한다", () => {
  const summary = {
    ...palReference,
    rarity: 10,
    variantType: "normal",
    workSuitabilities: [{ type: "handiwork", level: 4 }]
  };
  assert.equal(validatePalworldPalSummary(summary).ok, true);
  for (const imageUrl of [
    "https://unapproved.example/anubis.webp",
    `/palworld/pals/${palImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/items/${palImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.png`,
    `/images/palworld/${metadata.gameVersion}/pals/not-a-content-hash.webp`,
    `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.webp?cache=1`,
    `/images/palworld/${metadata.gameVersion}/pals/${palImageHash}.webp#fragment`,
    `/images/palworld/${metadata.gameVersion}/pals/../${palImageHash}.webp`,
    `/images/palworld/${metadata.gameVersion}/pals/%2e%2e/${palImageHash}.webp`
  ]) {
    assert.equal(validatePalworldPalSummary({ ...summary, imageUrl }).ok, false, imageUrl);
  }
  assert.equal(validatePalworldPalSummary({ ...summary, workSuitabilities: [{ type: "shell", level: 5 }] }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, workSuitabilities: [{ type: "handiwork", level: 8 }] }).ok, true);
  assert.equal(validatePalworldPalSummary({ ...summary, workSuitabilities: [{ type: "handiwork", level: 9 }] }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, id: "Anubis" }).ok, false);
  assert.equal(validatePalworldPalSummary({ ...summary, id: `a${"b".repeat(80)}` }).ok, false);
});

test("Pal 상세는 nocturnal boolean을 필수로 검증한다", () => {
  assert.equal(validatePalworldPalDetail(pal).ok, true);
  const { nocturnal: _nocturnal, ...withoutNocturnal } = pal;
  assert.equal(validatePalworldPalDetail(withoutNocturnal).ok, false);
  assert.equal(validatePalworldPalDetail({ ...pal, nocturnal: "false" }).ok, false);
});

test("Palworld 스냅샷은 정규화된 상세 데이터와 참조 무결성을 검증한다", () => {
  const result = validatePalworldDataSnapshot(snapshot);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  assert.equal(assertPalworldDataSnapshot(snapshot).pals[0]?.nameJa, "アヌビス");

  const missingItem = {
    ...snapshot,
    pals: [{ ...pal, drops: [{ ...itemReference, id: "missing_item" }] }]
  };
  const invalidReference = validatePalworldDataSnapshot(missingItem);
  assert.equal(invalidReference.ok, false);
  assert.match(invalidReference.ok ? "" : invalidReference.error, /존재하지 않는 아이템 참조/);

  assert.throws(
    () => assertPalworldDataSnapshot({ ...snapshot, pals: [pal, pal] }),
    /중복 ID/
  );

  const aliasA = {
    ...pal,
    id: "test-pal",
    number: 101,
    breeding: { ...pal.breeding, specialParentPairs: [{ parentAId: "test-pal", parentBId: "test-pal" }] }
  };
  const aliasB = {
    ...pal,
    id: "test_pal",
    number: 102,
    breeding: { ...pal.breeding, specialParentPairs: [{ parentAId: "test_pal", parentBId: "test_pal" }] }
  };
  const aliasCollision = validatePalworldDataSnapshot({ ...snapshot, pals: [pal, aliasA, aliasB] });
  assert.equal(aliasCollision.ok, false);
  assert.match(aliasCollision.ok ? "" : aliasCollision.error, /ID alias 충돌/);
});

test("Pal 이미지 경로 버전은 snapshot gameVersion과 일치해야 한다", () => {
  const mismatchedMetadata = { ...metadata, gameVersion: "0.6.3" };
  const result = validatePalworldDataSnapshot({
    ...snapshot,
    metadata: mismatchedMetadata,
    pals: [{ ...pal, metadata: mismatchedMetadata }],
    items: [{ ...item, metadata: mismatchedMetadata }]
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /imageUrl.*metadata\.gameVersion/);
});

test("스냅샷 내 Pal과 아이템 참조는 canonical 레코드 필드와 일치해야 한다", () => {
  const mismatchedItemReference = validatePalworldDataSnapshot({
    ...snapshot,
    pals: [{ ...pal, drops: [{ ...itemReference, nameJa: "一致しない名前" }] }]
  });
  assert.equal(mismatchedItemReference.ok, false);
  assert.match(mismatchedItemReference.ok ? "" : mismatchedItemReference.error, /canonical 아이템 레코드/);

  const mismatchedPalReference = validatePalworldDataSnapshot({
    ...snapshot,
    items: [{ ...item, dropPals: [{ ...palReference, number: 999 }] }]
  });
  assert.equal(mismatchedPalReference.ok, false);
  assert.match(mismatchedPalReference.ok ? "" : mismatchedPalReference.error, /canonical Pal 레코드/);

  const mismatchedBreedingReference = validatePalworldDataSnapshot({
    ...snapshot,
    breedingPairs: [{ ...breedingPair, child: { ...palReference, elements: ["fire"] } }]
  });
  assert.equal(mismatchedBreedingReference.ok, false);
  assert.match(mismatchedBreedingReference.ok ? "" : mismatchedBreedingReference.error, /canonical Pal 레코드/);
});

test("Pal 상세의 activeSkills에는 active 타입만 허용한다", () => {
  const invalidActiveSkill = {
    ...pal.partnerSkill,
    id: "not_active",
    type: "passive"
  };
  const result = validatePalworldDataSnapshot({
    ...snapshot,
    pals: [{ ...pal, activeSkills: [invalidActiveSkill] }]
  });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /active여야 합니다/);
});

test("통합 검색 응답 total은 반환된 Pal과 아이템 결과 수 이상이어야 한다", () => {
  const palSummary = {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    imageUrl: pal.imageUrl,
    elements: pal.elements,
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities
  };
  const itemSummary = {
    id: item.id,
    nameKo: item.nameKo,
    nameJa: item.nameJa,
    nameEn: item.nameEn,
    imageUrl: item.imageUrl,
    category: item.category,
    rarity: item.rarity,
    descriptionKo: item.descriptionKo,
    descriptionJa: item.descriptionJa,
    descriptionEn: item.descriptionEn,
    sellPrice: item.sellPrice,
    technologyLevel: item.technologyLevel
  };
  assert.equal(validatePalworldSearchResult({
    query: "  アヌビス  ",
    total: 2,
    pals: [palSummary],
    items: [itemSummary],
    metadata,
    domains: searchDomains
  }).ok, true);
  assert.equal(validatePalworldSearchResult({
    query: "아누비스",
    total: 3,
    pals: [palSummary],
    items: [itemSummary],
    metadata,
    domains: searchDomains
  }).ok, true);
  assert.equal(validatePalworldSearchResult({
    query: "아누비스",
    total: 1,
    pals: [palSummary],
    items: [itemSummary],
    metadata,
    domains: searchDomains
  }).ok, false);

  assert.equal(validatePalworldSearchResult({
    query: "아누비스",
    total: 2,
    pals: [palSummary],
    items: [itemSummary],
    metadata
  }).ok, false);
});

test("페이지 응답은 item schema와 페이지 크기를 함께 검증한다", () => {
  const palSummary = {
    id: pal.id,
    number: pal.number,
    nameKo: pal.nameKo,
    nameJa: pal.nameJa,
    nameEn: pal.nameEn,
    imageUrl: pal.imageUrl,
    elements: pal.elements,
    rarity: pal.rarity,
    variantType: pal.variantType,
    workSuitabilities: pal.workSuitabilities
  };
  const result = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(result.ok, true, result.ok ? "" : result.error);

  const inconsistentPages = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(inconsistentPages.ok, false);
  assert.match(inconsistentPages.ok ? "" : inconsistentPages.error, /totalPages/);

  const inconsistentFlags = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 21,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(inconsistentFlags.ok, false);
  assert.match(inconsistentFlags.ok ? "" : inconsistentFlags.error, /hasNextPage/);

  const inconsistentItemCount = validatePalworldPaginatedResponse({
    items: [palSummary],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(inconsistentItemCount.ok, false);
  assert.match(inconsistentItemCount.ok ? "" : inconsistentItemCount.error, /결과 수/);

  const impossibleEmptyPage = validatePalworldPaginatedResponse({
    items: [],
    pagination: {
      page: 2,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: true
    },
    metadata
  }, validatePalworldPalSummary);
  assert.equal(impossibleEmptyPage.ok, false);
});

test("교배 결과와 목표 Pal 부모 목록 응답 validator를 제공한다", () => {
  const resultResponse = {
    parentA: palReference,
    parentB: palReference,
    result: breedingPair,
    metadata
  };
  assert.equal(validatePalworldBreedingResultResponse(resultResponse).ok, true);
  assert.equal(validatePalworldBreedingResultResponse({
    ...resultResponse,
    result: { ...breedingPair, parentA: { ...palReference, nameKo: "불일치" } }
  }).ok, false);

  const parentsResponse = {
    child: palReference,
    items: [breedingPair],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false
    },
    metadata
  };
  assert.equal(validatePalworldBreedingParentsResponse(parentsResponse).ok, true);
  assert.equal(validatePalworldBreedingParentsResponse({
    ...parentsResponse,
    child: { ...palReference, id: "lamball" }
  }).ok, false);
});

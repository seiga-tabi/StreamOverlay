import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

const { createHttpHandler } = await import("../dist/routes/http-api.js");
const {
  loadPalworldPakShadowRuntime,
  PalworldPakShadowRuntimeError
} = await import("../dist/data/palworld-pak-shadow-runtime.js");
const { resetSecurityRateLimiters } = await import("../dist/security/rate-limit.js");

const ARCHIVE_SHA256 = "a".repeat(64);
const ARTIFACT_SHA256 = "b".repeat(64);
const RELEASE = "2.0.0";
const SOURCE_REVISION = "pak-shadow-test";
const SOURCE_TIMESTAMP = "2026-07-23T00:00:00.000Z";

function metadata() {
  return {
    gameVersion: RELEASE,
    release: RELEASE,
    steamBuildId: "12345678",
    sourceName: "operator_provided_pak_export",
    sourceUrl: "https://github.com/seiga-tabi/StreamOverlay",
    sourceRevision: SOURCE_REVISION,
    sourceChecksum: ARCHIVE_SHA256,
    extractedAt: SOURCE_TIMESTAMP,
    verifiedAt: SOURCE_TIMESTAMP,
    license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
    rightsVerified: false
  };
}

function nameTranslation() {
  return {
    name: {
      ko: "source_provided",
      ja: "source_provided"
    }
  };
}

function fullTranslation() {
  return {
    ...nameTranslation(),
    description: {
      ko: "source_provided",
      ja: "source_provided"
    }
  };
}

function palReference(id) {
  if (id === "alpha") {
    return {
      id,
      number: 1,
      nameKo: "알파",
      nameJa: "アルファ",
      nameEn: "Alpha",
      elements: ["water"],
      translation: nameTranslation()
    };
  }
  return {
    id,
    number: 2,
    nameKo: "베타",
    nameJa: "ベータ",
    nameEn: "Beta",
    elements: ["fire"],
    translation: nameTranslation()
  };
}

function itemReference(id) {
  if (id === "fiber") {
    return {
      id,
      nameKo: "섬유",
      nameJa: "繊維",
      nameEn: "Fiber",
      translation: nameTranslation()
    };
  }
  return {
    id,
    nameKo: "테스트 스피어",
    nameJa: "テストスフィア",
    nameEn: "Test Sphere",
    translation: nameTranslation()
  };
}

function activeSkill() {
  return {
    id: "active-aqua-jet",
    sourceInternalId: "AquaJet",
    type: "active",
    nameKo: "워터 제트",
    nameJa: "ウォータージェット",
    nameEn: "Aqua Jet",
    descriptionKo: "물을 탄환처럼 발사한다.",
    descriptionJa: "水を弾丸のように発射する。",
    descriptionEn: "Fires water like a projectile.",
    element: "water",
    power: 30,
    cooldownSeconds: 2,
    unlockLevel: 1,
    translation: fullTranslation()
  };
}

function snapshot() {
  const sourceMetadata = metadata();
  const skill = activeSkill();
  const alpha = {
    ...palReference("alpha"),
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [{ type: "watering", level: 1 }],
    descriptionKo: "공식 한국어 알파 설명",
    descriptionJa: "公式日本語のアルファ説明",
    descriptionEn: "Legacy English Alpha description",
    translation: fullTranslation(),
    stats: {
      hp: 100,
      attack: 80,
      defense: 70,
      moveSpeed: 100,
      stamina: 100
    },
    nocturnal: false,
    activeSkills: [skill],
    drops: [itemReference("fiber")],
    dropDetails: [{
      item: itemReference("fiber"),
      minQuantity: 1,
      maxQuantity: 2,
      dropRatePercent: 50
    }],
    breeding: {
      breedingPower: 1000,
      specialParentPairs: []
    },
    metadata: { ...sourceMetadata }
  };
  const beta = {
    ...palReference("beta"),
    rarity: 1,
    variantType: "normal",
    workSuitabilities: [{ type: "kindling", level: 1 }],
    descriptionKo: "공식 한국어 베타 설명",
    descriptionJa: "公式日本語のベータ説明",
    descriptionEn: "Legacy English Beta description",
    translation: fullTranslation(),
    stats: {
      hp: 90,
      attack: 90,
      defense: 60,
      moveSpeed: 110,
      stamina: 100
    },
    nocturnal: true,
    activeSkills: [],
    drops: [],
    breeding: {
      breedingPower: 1200,
      specialParentPairs: []
    },
    metadata: { ...sourceMetadata }
  };
  const fiber = {
    ...itemReference("fiber"),
    category: "material",
    rarity: 1,
    descriptionKo: "공식 한국어 섬유 설명",
    descriptionJa: "公式日本語の繊維説明",
    descriptionEn: "Legacy English Fiber description",
    translation: fullTranslation(),
    sellPrice: 1,
    craftingMaterials: [],
    dropPals: [palReference("alpha")],
    acquisitionMethods: [],
    relatedItems: [],
    metadata: { ...sourceMetadata }
  };
  const sphere = {
    ...itemReference("sphere"),
    category: "sphere",
    rarity: 1,
    descriptionKo: "공식 한국어 스피어 설명",
    descriptionJa: "公式日本語のスフィア説明",
    descriptionEn: "Legacy English Sphere description",
    translation: fullTranslation(),
    sellPrice: 10,
    technologyLevel: 1,
    craftingMaterials: [{
      item: itemReference("fiber"),
      quantity: 2
    }],
    recipes: [{
      sourceRowId: "Recipe_TestSphere",
      resultCount: 1,
      workAmount: 10,
      materials: [{
        item: itemReference("fiber"),
        quantity: 2
      }]
    }],
    dropPals: [],
    acquisitionMethods: [],
    relatedItems: [itemReference("fiber")],
    metadata: { ...sourceMetadata }
  };
  return {
    metadata: sourceMetadata,
    pals: [alpha, beta],
    items: [fiber, sphere],
    skills: [{
      ...skill,
      relatedPalCount: 1,
      relatedPals: [{
        pal: palReference("alpha"),
        unlockLevel: 1
      }],
      metadata: { ...sourceMetadata }
    }],
    breedingPairs: [{
      id: "alpha-beta-alpha",
      parentA: palReference("alpha"),
      parentB: palReference("beta"),
      child: palReference("alpha"),
      isSpecial: false
    }]
  };
}

function count(available, total) {
  return { available, missing: total - available, total };
}

function translationCoverage() {
  return {
    palNames: count(2, 2),
    palDescriptions: count(2, 2),
    itemNames: count(2, 2),
    itemDescriptions: count(2, 2),
    skillNames: count(1, 1),
    skillDescriptions: count(1, 1),
    skillPassiveAbilities: count(0, 1),
    sourceProvided: 10,
    humanReviewed: 0,
    machineAssisted: 0,
    sourceLanguageFallback: 1,
    missingSource: 1,
    placeholderExcluded: 0,
    unresolvedRichText: 0,
    staleSourceHash: 0
  };
}

function coverage() {
  return {
    palDetails: count(2, 2),
    itemDetails: count(2, 2),
    skillDetails: count(1, 1),
    palDescriptions: count(2, 2),
    palStats: count(2, 2),
    partnerSkills: count(0, 2),
    activeSkills: count(1, 2),
    palDrops: count(1, 2),
    breedingFields: count(2, 2),
    itemDescriptions: count(2, 2),
    craftingRecipes: count(1, 2),
    craftingFacilities: count(0, 2),
    dropPals: count(1, 2),
    technologyLevels: count(1, 2),
    prices: count(2, 2),
    durability: count(0, 2),
    acquisitionMethods: count(0, 2),
    skillDescriptions: count(1, 1),
    relatedPals: count(1, 1),
    palImages: count(0, 2),
    itemImages: count(0, 2),
    elementImages: count(0, 9),
    localization: {
      ko: count(5, 5),
      ja: count(5, 5),
      en: count(5, 5)
    },
    translations: {
      ko: translationCoverage(),
      ja: translationCoverage()
    }
  };
}

function manifest() {
  const activation = {
    pals: "ready",
    items: "ready",
    skills: "ready",
    breeding: "ready",
    localizationKo: "ready",
    localizationJa: "ready",
    localizationEn: "blocked",
    palImages: "blocked",
    itemImages: "blocked",
    elementImages: "blocked",
    workImages: "blocked",
    skillImages: "blocked",
    map: "blocked"
  };
  const artifacts = [
    ["snapshot", "snapshot.json"],
    ["paldex", "paldex.json"],
    ["items", "items.json"],
    ["skills", "skills.json"],
    ["breeding", "breeding.json"],
    ["locale-ko", "locales/ko.json"],
    ["locale-ja", "locales/ja.json"],
    ["source-lock", "source-lock.json"],
    ["import-report", "import-report.json"]
  ].map(([kind, file]) => ({
    kind,
    file,
    sha256: ARTIFACT_SHA256,
    bytes: 1
  }));
  return {
    schemaVersion: 1,
    release: RELEASE,
    gameVersion: RELEASE,
    steamBuildId: "12345678",
    source: {
      type: "operator_pak_export",
      archiveSha256: ARCHIVE_SHA256,
      importRevision: SOURCE_REVISION,
      license: "RIGHTS_NOT_INDEPENDENTLY_VERIFIED",
      usageBasis: "operator_reference_use",
      rightsVerified: false
    },
    activation,
    counts: {
      pals: 2,
      items: 2,
      skills: 1,
      breedingResults: 1,
      specialBreedingRules: 0
    },
    coverage: {
      pals: count(2, 2),
      items: count(2, 2),
      skills: count(1, 1),
      breeding: count(1, 1),
      localizationKo: count(5, 5),
      localizationJa: count(5, 5),
      localizationEn: count(0, 5),
      palImages: count(0, 2),
      itemImages: count(0, 2),
      elementImages: count(0, 9),
      workImages: count(0, 12),
      skillImages: count(0, 1),
      map: count(0, 1)
    },
    artifacts
  };
}

function adapted() {
  const sourceMetadata = metadata();
  return {
    snapshot: snapshot(),
    domains: {
      pals: { status: "ready", recordCount: 2, metadata: { ...sourceMetadata } },
      items: { status: "ready", recordCount: 2, metadata: { ...sourceMetadata } },
      skills: { status: "ready", recordCount: 1, metadata: { ...sourceMetadata } },
      breeding: { status: "ready", recordCount: 1, metadata: { ...sourceMetadata } }
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
        fallbackPals: 2,
        publicNoticeRequired: true
      }
    },
    coverage: coverage(),
    sourceInternalIds: {
      alpha: "AlphaSource",
      beta: "BetaSource"
    },
    breedingSource: {},
    report: {
      resolvedActiveAssignments: 1,
      excludedActiveAssignments: 0,
      unresolvedActiveAssignments: 0,
      resolvedSpecialBreedingRules: 0,
      excludedSpecialBreedingRows: 0,
      duplicateSpecialBreedingRows: 0,
      unresolvedSpecialBreedingRows: 0,
      technicalPalImages: 0,
      publicPalImages: 0,
      fallbackPals: 2
    }
  };
}

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

function createHandler(service) {
  return createHttpHandler({
    store: {},
    twitchAuth: {},
    actions: { async dispatchOne() {} },
    palworldDataService: service
  });
}

async function request(handler, url) {
  const res = createResponse();
  await handler(createRequest("GET", url), res);
  return {
    res,
    body: res.body ? JSON.parse(res.body) : undefined
  };
}

beforeEach(() => resetSecurityRateLimiters());

test("ready operator PAK snapshot을 active pointer와 분리된 공개 API service로 로드한다", async () => {
  const shadow = loadPalworldPakShadowRuntime({
    manifest: manifest(),
    adapted: adapted()
  });
  const handler = createHandler(shadow.service);
  const urls = [
    "/api/palworld/meta",
    "/api/palworld/pals?element=water&sort=number&page=1&limit=1",
    "/api/palworld/pals/alpha",
    "/api/palworld/items?category=sphere&sort=name&locale=ja&page=1&limit=1",
    "/api/palworld/items/sphere",
    "/api/palworld/skills?sort=name&locale=ko&page=1&limit=10",
    "/api/palworld/skills/active-aqua-jet",
    "/api/palworld/breeding?parentA=beta&parentB=alpha",
    "/api/palworld/breeding/parents?child=alpha&page=1&limit=10",
    "/api/palworld/search?q=%EC%95%8C%ED%8C%8C",
    "/api/palworld/search?q=%E3%83%86%E3%82%B9%E3%83%88%E3%82%B9%E3%83%95%E3%82%A3%E3%82%A2"
  ];
  const responses = [];
  for (const url of urls) responses.push(await request(handler, url));
  for (const [index, response] of responses.entries()) {
    assert.equal(response.res.statusCode, 200, urls[index]);
    assert.equal(
      response.res.headers["X-Palworld-Data-Version"],
      RELEASE,
      urls[index]
    );
    assert.equal(
      response.res.headers["X-Palworld-Data-Revision"],
      SOURCE_REVISION,
      urls[index]
    );
    assert.match(response.res.headers["Cache-Control"], /^public,/u, urls[index]);
  }

  assert.deepEqual(responses[0].body.counts, {
    pals: 2,
    items: 2,
    breedingPairs: 1,
    skills: 1
  });
  assert.equal(responses[2].body.nameKo, "알파");
  assert.equal(responses[2].body.nameJa, "アルファ");
  assert.equal(responses[2].body.translation.name.ko, "source_provided");
  assert.equal(responses[2].body.activeSkills[0].translation.name.ja, "source_provided");
  assert.deepEqual(responses[1].body.items.map((pal) => pal.id), ["alpha"]);
  assert.deepEqual(responses[1].body.pagination, {
    page: 1,
    pageSize: 1,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
  assert.deepEqual(responses[3].body.items.map((item) => item.id), ["sphere"]);
  assert.equal(responses[3].body.pagination.pageSize, 1);
  assert.equal(responses[4].body.nameJa, "テストスフィア");
  assert.equal(responses[4].body.craftingMaterials[0].item.nameKo, "섬유");
  assert.equal(responses[6].body.nameKo, "워터 제트");
  assert.equal(responses[6].body.translation.name.ja, "source_provided");
  assert.equal(responses[7].body.state, "resolved");
  assert.equal(responses[7].body.result.child.id, "alpha");
  assert.equal(responses[8].body.pagination.total, 1);
  assert.equal(responses[9].body.pals[0].id, "alpha");
  assert.equal(responses[10].body.items[0].id, "sphere");
});

test("shadow API는 없는 ID와 unknown query를 각각 404와 400으로 구분한다", async () => {
  const shadow = loadPalworldPakShadowRuntime({
    manifest: manifest(),
    adapted: adapted()
  });
  const handler = createHandler(shadow.service);
  const missing = await request(handler, "/api/palworld/skills/not-found");
  const invalid = await request(
    handler,
    "/api/palworld/items?redirect=https%3A%2F%2Fexample.com"
  );
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.body.code, "PALWORLD_NOT_FOUND");
  assert.equal(missing.res.headers["Cache-Control"], "no-store");
  assert.equal(invalid.res.statusCode, 400);
  assert.equal(invalid.body.code, "PALWORLD_INVALID_QUERY");
  assert.equal(invalid.res.headers["Cache-Control"], "no-store");
});

test("ready manifest라도 identity·count·unresolved gate 불일치는 fail-closed 처리한다", () => {
  const mismatched = adapted();
  mismatched.snapshot.metadata.sourceRevision = "stale";
  for (const record of [
    ...mismatched.snapshot.pals,
    ...mismatched.snapshot.items,
    ...mismatched.snapshot.skills
  ]) {
    record.metadata.sourceRevision = "stale";
  }
  assert.throws(
    () => loadPalworldPakShadowRuntime({
      manifest: manifest(),
      adapted: mismatched
    }),
    (error) =>
      error instanceof PalworldPakShadowRuntimeError
      && error.code === "PALWORLD_PAK_SHADOW_IDENTITY_MISMATCH"
  );

  const unresolved = adapted();
  unresolved.report.unresolvedSpecialBreedingRows = 1;
  assert.throws(
    () => loadPalworldPakShadowRuntime({
      manifest: manifest(),
      adapted: unresolved
    }),
    (error) =>
      error instanceof PalworldPakShadowRuntimeError
      && error.code === "PALWORLD_PAK_SHADOW_DATA_NOT_READY"
  );
});

test("KO/JA shadow runtime은 공개 asset을 모두 fallback으로 강제한다", () => {
  const publicImageGate = adapted();
  publicImageGate.gates.imageAssets.technicalPassed = true;
  publicImageGate.gates.imageAssets.publicActivationAllowed = true;
  publicImageGate.gates.imageAssets.readyImages = 1;
  publicImageGate.gates.imageAssets.fallbackPals = 1;
  assert.throws(
    () => loadPalworldPakShadowRuntime({
      manifest: manifest(),
      adapted: publicImageGate
    }),
    (error) =>
      error instanceof PalworldPakShadowRuntimeError
      && error.code === "PALWORLD_PAK_SHADOW_DATA_NOT_READY"
      && /fallback/u.test(error.message)
  );
});

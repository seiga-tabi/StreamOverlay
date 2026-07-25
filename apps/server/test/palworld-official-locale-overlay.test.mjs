import test, { before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  assertPalworldActiveSkillLocaleEvidenceArtifact,
  assertPalworldOfficialLocaleCompatibilityArtifact,
  assertPalworldOfficialLocaleCoverageArtifact,
  assertPalworldOfficialLocaleSourceFieldsArtifact,
  buildPalworldOfficialLocaleOverlay,
  serializePalworldOfficialLocaleOverlayArtifact,
} = await import("../dist/data/palworld-official-locale-overlay.js");

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeReleaseRoot = path.join(serverRoot, "data", "palworld", "1.0.1");
const candidateRoot = path.join(
  serverRoot,
  "data",
  "palworld",
  "candidates",
  "candidate-1248184a4b527d94-delta-2108e7bd60291174",
);
const options = {
  activeReleaseRoot,
  candidateRoot,
  reviewedAt: "2026-07-25T00:00:00.000Z",
  reviewer: "operator-locale-review",
  evidenceChecksum: "1".repeat(64),
  activeSkillMappingFile: path.join(
    serverRoot,
    "src",
    "data",
    "palworld-pak-mappings",
    "legacy-active-skill-locale-map.json",
  ),
};

let artifacts;

before(async () => {
  artifacts = await buildPalworldOfficialLocaleOverlay(options);
});

function textOf(locale, kind, id, field) {
  return artifacts.snapshots[locale].records
    .find((record) => record.kind === kind && record.id === id)
    ?.fields[field];
}

test("공식 KO/JA overlay는 blocked candidate를 활성화하지 않고 exact source만 생성한다", () => {
  assert.doesNotThrow(() =>
    assertPalworldOfficialLocaleSourceFieldsArtifact(artifacts.officialSourceFields));
  assert.equal(artifacts.officialSourceFields.counts.byLocale.ko, 5_219);
  assert.equal(artifacts.officialSourceFields.counts.byLocale.ja, 5_219);
  assert.deepEqual(
    artifacts.compatibility.inputs.candidate.activationBlockers,
    ["EXPORT_METADATA_NOT_PROVIDED", "PUBLIC_ID_MAPPING_RELEASE_UNVERIFIED"],
  );
  assert.equal(artifacts.compatibility.candidateRuntimeActivationGranted, false);
  assert.equal(artifacts.compatibility.rightsVerified, false);
  assert.equal(artifacts.compatibility.fuzzyMatchingUsed, false);
  assert.deepEqual(artifacts.compatibility.counts.officialUnresolved, { ko: 2, ja: 2 });
  assert.deepEqual(artifacts.compatibility.counts.officialUnjoined, { ko: 237, ja: 237 });
});

test("legacy active skill 217개는 palId+unlockLevel exact evidence로 공식 locale에 연결된다", () => {
  assert.doesNotThrow(() =>
    assertPalworldActiveSkillLocaleEvidenceArtifact(
      artifacts.activeSkillEvidence,
    ));
  assert.deepEqual(artifacts.activeSkillEvidence.counts, {
    activeSkills: 217,
    assignmentEvidence: 1_869,
    singleTargetSkills: 214,
    multiTargetSkills: 3,
    reviewedExceptions: 1,
  });
  assert.deepEqual(
    {
      ko: textOf("ko", "skill", "active-air-cannon-ba65ad11ea", "name")?.text,
      ja: textOf("ja", "skill", "active-air-cannon-ba65ad11ea", "name")?.text,
    },
    { ko: "공기 대포", ja: "エアーキャノン" },
  );
  assert.deepEqual(
    {
      ko: textOf("ko", "skill", "active-air-cannon-ba65ad11ea", "description")?.text,
      ja: textOf("ja", "skill", "active-air-cannon-ba65ad11ea", "description")?.text,
    },
    {
      ko: "고속으로 날아가는 공기 덩어리를 발사한다.",
      ja: "高速で飛ぶ空気の塊を発射する。",
    },
  );
  for (const locale of ["ko", "ja"]) {
    assert.equal(
      artifacts.officialSourceFields.records.filter((record) =>
        record.locale === locale
        && record.kind === "skill"
        && record.id.startsWith("active-")).length,
      434,
    );
  }
});

test("multi-target 공식 payload 동일성과 Purifying Light reviewed exception을 보존한다", () => {
  const multiTarget = artifacts.activeSkillEvidence.entries.filter(
    (entry) => entry.candidateSkillIds.length > 1,
  );
  assert.deepEqual(
    multiTarget.map((entry) => entry.legacySkillId),
    [
      "active-double-fang-dark-de4c931ca9",
      "active-double-fang-electric-fc11498a3d",
      "active-double-fang-ground-652d0a9212",
    ],
  );
  const exception = artifacts.activeSkillEvidence.entries.find(
    (entry) => entry.legacySkillId === "active-purifying-light-82107388d3",
  );
  assert.equal(exception?.guard, "reviewed_exception");
  assert.deepEqual(exception?.legacyStats, {
    element: "neutral",
    power: 250,
    cooldownSeconds: 100,
  });
  assert.deepEqual(exception?.candidateStats, [{
    candidateSkillId: "active:Unique_LegendDeer_RadiantPurge_Otomo",
    element: "neutral",
    power: 1250,
    cooldownSeconds: 100,
  }]);
});

test("공식 source_provided 이름과 설명이 기존 검수값보다 우선한다", () => {
  assert.deepEqual(
    {
      ko: textOf("ko", "pal", "anubis", "name")?.text,
      ja: textOf("ja", "pal", "anubis", "name")?.text,
    },
    { ko: "아누비스", ja: "アヌビス" },
  );
  assert.deepEqual(
    {
      ko: textOf("ko", "item", "pal-sphere", "name")?.text,
      ja: textOf("ja", "item", "pal-sphere", "name")?.text,
    },
    { ko: "팰 스피어", ja: "パルスフィア" },
  );
  assert.deepEqual(
    {
      ko: textOf("ko", "skill", "partner-anubis", "name")?.text,
      ja: textOf("ja", "skill", "partner-anubis", "name")?.text,
    },
    { ko: "사막의 수호신", ja: "砂漠の守護神" },
  );
  for (const locale of ["ko", "ja"]) {
    for (const record of artifacts.snapshots[locale].records) {
      for (const field of Object.values(record.fields)) {
        assert.notEqual(field.status, "machine_assisted");
      }
    }
  }
});

test("장식 element 아이콘과 공식 속성명이 함께 있어도 설명에 이름을 한 번만 표시한다", () => {
  const awakeningKo = textOf(
    "ko",
    "item",
    "pal-awakening-neutral",
    "description",
  )?.text;
  const awakeningJa = textOf(
    "ja",
    "item",
    "pal-awakening-neutral",
    "description",
  )?.text;
  const partnerKo = textOf("ko", "skill", "partner-anubis", "description")?.text;
  const partnerJa = textOf("ja", "skill", "partner-anubis", "description")?.text;

  assert.match(awakeningKo, /무속성 팰/u);
  assert.match(awakeningJa, /無属性のパル/u);
  assert.match(partnerKo, /땅 속성으로/u);
  assert.match(partnerJa, /地属性に/u);
  for (const text of [awakeningKo, awakeningJa, partnerKo, partnerJa]) {
    assert.equal(text?.includes("무속성무속성"), false);
    assert.equal(text?.includes("땅 속성땅 속성"), false);
    assert.equal(text?.includes("無属性無属性"), false);
    assert.equal(text?.includes("地属性地属性"), false);
  }
});

test("공식 overlay 생성은 동일 입력에서 byte-for-byte 결정적이다", async () => {
  const repeated = await buildPalworldOfficialLocaleOverlay(options);
  for (const locale of ["ko", "ja"]) {
    assert.equal(
      serializePalworldOfficialLocaleOverlayArtifact(repeated.snapshots[locale]),
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.snapshots[locale]),
    );
    assert.equal(
      serializePalworldOfficialLocaleOverlayArtifact(repeated.coverage[locale]),
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.coverage[locale]),
    );
  }
  assert.equal(
    serializePalworldOfficialLocaleOverlayArtifact(repeated.officialSourceFields),
    serializePalworldOfficialLocaleOverlayArtifact(artifacts.officialSourceFields),
  );
  assert.equal(
    serializePalworldOfficialLocaleOverlayArtifact(repeated.activeSkillEvidence),
    serializePalworldOfficialLocaleOverlayArtifact(artifacts.activeSkillEvidence),
  );
  assert.equal(
    serializePalworldOfficialLocaleOverlayArtifact(repeated.compatibility),
    serializePalworldOfficialLocaleOverlayArtifact(artifacts.compatibility),
  );
});

test("KO/JA coverage 보고서는 snapshot과 corpus 기준의 실제 공개 집계를 보존한다", () => {
  for (const locale of ["ko", "ja"]) {
    const coverage = artifacts.coverage[locale];
    assert.doesNotThrow(() =>
      assertPalworldOfficialLocaleCoverageArtifact(coverage));
    assert.equal(coverage.translationRevision, artifacts.snapshots[locale].translationRevision);
    assert.equal(coverage.translationStatus, artifacts.snapshots[locale].translationStatus);
    assert.deepEqual(coverage.coverage.status, {
      source_provided: 5_219,
      human_reviewed: 0,
      machine_assisted: 0,
    });
    assert.equal(coverage.coverage.translated, 5_219);
    assert.equal(coverage.coverage.total, 5_458);
    assert.equal(coverage.coverage.missing, 239);
    assert.match(coverage.contentSha256, /^[a-f0-9]{64}$/u);
  }
});

test("compatibility validator는 출력 checksum과 unknown field 변조를 거부한다", () => {
  const texts = {
    officialSourceFields:
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.officialSourceFields),
    activeSkillEvidence:
      serializePalworldOfficialLocaleOverlayArtifact(artifacts.activeSkillEvidence),
    ko: serializePalworldOfficialLocaleOverlayArtifact(artifacts.snapshots.ko),
    ja: serializePalworldOfficialLocaleOverlayArtifact(artifacts.snapshots.ja),
    manifest: serializePalworldOfficialLocaleOverlayArtifact(artifacts.manifest),
  };
  assert.doesNotThrow(() =>
    assertPalworldOfficialLocaleCompatibilityArtifact(
      artifacts.compatibility,
      texts,
    ));
  assert.throws(
    () => assertPalworldOfficialLocaleCompatibilityArtifact(
      artifacts.compatibility,
      { ...texts, ko: `${texts.ko} ` },
    ),
    /checksum|일치/u,
  );
  const tamperedEvidence = structuredClone(artifacts.activeSkillEvidence);
  tamperedEvidence.entries[0].assignments[0].candidateSkillId =
    "active:tampered";
  assert.throws(
    () => assertPalworldActiveSkillLocaleEvidenceArtifact(tamperedEvidence),
    /candidateSkillId|target/u,
  );
  assert.throws(
    () => assertPalworldOfficialLocaleSourceFieldsArtifact({
      ...structuredClone(artifacts.officialSourceFields),
      unexpected: true,
    }),
    /허용되지 않은 필드/u,
  );
});

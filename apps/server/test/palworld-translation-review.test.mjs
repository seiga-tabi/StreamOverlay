import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  assertPalworldTranslationReviewSummary,
  assertPalworldTranslationSourceAnomalyBatch,
  buildPalworldTranslationReviewArtifacts,
  serializePalworldTranslationReviewArtifact,
} = await import("../dist/data/palworld-translation-review.js");

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeReleaseRoot = path.join(serverRoot, "data", "palworld", "1.0.1");
const candidateRoot = path.join(
  serverRoot,
  "data",
  "palworld",
  "candidates",
  "candidate-1248184a4b527d94-delta-2108e7bd60291174",
);
const preparedAt = "2026-07-25T00:00:00.000Z";
const expectedActivationBlockers = [
  "EXPORT_METADATA_NOT_PROVIDED",
  "PUBLIC_ID_MAPPING_RELEASE_UNVERIFIED",
];

let artifacts;
let serializedArtifacts;
let activeReviewBuildError;

before(async () => {
  const [summaryBytes, sourceAnomalyBatchBytes] = await Promise.all([
    readFile(path.join(activeReleaseRoot, "locales", "review-queues", "review-summary.json"), "utf8"),
    readFile(path.join(activeReleaseRoot, "locales", "review-queues", "source-anomaly-0001.json"), "utf8"),
  ]);
  artifacts = {
    summary: JSON.parse(summaryBytes),
    sourceAnomalyBatch: JSON.parse(sourceAnomalyBatchBytes),
  };
  serializedArtifacts = {
    summary: summaryBytes,
    sourceAnomalyBatch: sourceAnomalyBatchBytes,
  };

  try {
    await buildPalworldTranslationReviewArtifacts({
      activeReleaseRoot,
      candidateRoot,
      preparedAt,
      sourceGroupLimit: 25,
    });
  } catch (error) {
    activeReviewBuildError = error;
  }
});

function clone(value) {
  return structuredClone(value);
}

function assertSha256(value, message) {
  assert.match(value, /^[a-f0-9]{64}$/u, message);
}

function assertActivationRemainsBlocked(source) {
  assert.equal(source.candidate.activationEligible, false);
  assert.deepEqual(source.candidate.activationBlockers, expectedActivationBlockers);
}

test("격리된 과거 번역 검수 요약은 당시 집계와 candidate activation blocker를 보존한다", () => {
  const { summary } = artifacts;

  assert.match(
    String(activeReviewBuildError),
    /source anomaly locale 상태가 일치하지 않습니다|active (?:ko|ja):skill:partner-hangyu(?:-cryst)?:description source hash가 일치하지 않습니다/u,
  );
  assert.doesNotThrow(() => assertPalworldTranslationReviewSummary(summary));
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.release, "1.0.1");
  assert.equal(summary.preparedAt, preparedAt);
  assert.equal(summary.status, "pending_operator_review");
  assert.deepEqual(summary.counts.machineAssisted, { ko: 5161, ja: 5161 });
  assert.deepEqual(summary.counts.sourceAnomalies, {
    fields: 1120,
    missingSlots: 1649,
    uniqueSourceSha256: 177,
  });
  assert.deepEqual(summary.counts.officialExact.ko, {
    joined: 4490,
    resolved: 4488,
    unresolved: 2,
    unjoined: 671,
  });
  assert.deepEqual(summary.counts.officialExact.ja, {
    joined: 4490,
    resolved: 4488,
    unresolved: 2,
    unjoined: 671,
  });
  assertSha256(summary.source.active.catalogSha256, "active catalog checksum");
  assertSha256(summary.source.active.paldexSha256, "active Paldex checksum");
  assertSha256(summary.source.candidate.archiveSha256, "candidate archive checksum");
  assertActivationRemainsBlocked(summary.source);
});

test("격리된 첫 원문 이상 검수 batch는 fan-out 상위 25개 hash와 영향 904건을 포함한다", () => {
  const { sourceAnomalyBatch } = artifacts;

  assert.doesNotThrow(() => assertPalworldTranslationSourceAnomalyBatch(sourceAnomalyBatch));
  assert.equal(sourceAnomalyBatch.schemaVersion, 1);
  assert.equal(sourceAnomalyBatch.release, "1.0.1");
  assert.equal(sourceAnomalyBatch.batchId, "source-anomaly-0001");
  assert.equal(sourceAnomalyBatch.status, "pending_operator_review");
  assert.equal(sourceAnomalyBatch.preparedAt, preparedAt);
  assert.deepEqual(sourceAnomalyBatch.cursor, {
    strategy: "source_sha256_fanout_desc",
    groupOffset: 0,
    groupLimit: 25,
    totalGroups: 177,
  });
  assert.equal(sourceAnomalyBatch.counts.groups, 25);
  assert.equal(sourceAnomalyBatch.counts.affectedFields, 904);
  assert.equal(sourceAnomalyBatch.counts.officialKoResolved, 904);
  assert.equal(sourceAnomalyBatch.counts.officialJaResolved, 904);
  assert.equal(sourceAnomalyBatch.groups.length, 25);
  assert.equal(
    sourceAnomalyBatch.groups.reduce((count, group) => count + group.affected.length, 0),
    904,
  );
  assertActivationRemainsBlocked(sourceAnomalyBatch.source);
});

test("격리된 원문 이상 batch의 모든 항목은 KO/JA 공식 locale과 exact join되고 rich text가 해결되어 있다", () => {
  for (const group of artifacts.sourceAnomalyBatch.groups) {
    assertSha256(group.sourceSha256, `${group.sourceSha256} 원문 checksum`);
    assert.ok(group.codes.length > 0);
    assert.ok(group.missingSlotCountPerField > 0);

    for (const affected of group.affected) {
      assert.equal(affected.kind, "item");
      assert.equal(affected.field, "description");
      assert.equal(affected.decision, "pending_operator_review");
      assert.equal(
        affected.official.joinRule,
        "canonical_id_source_internal_id_message_key_exact",
      );
      assert.equal(affected.current.ko.status, "machine_assisted");
      assert.equal(affected.current.ja.status, "machine_assisted");
      assert.equal(affected.current.ko.sourceSha256, group.sourceSha256);
      assert.equal(affected.current.ja.sourceSha256, group.sourceSha256);
      assertSha256(affected.current.ko.textSha256, `${affected.id} KO 현재 text checksum`);
      assertSha256(affected.current.ja.textSha256, `${affected.id} JA 현재 text checksum`);

      for (const locale of ["ko", "ja"]) {
        const official = affected.official[locale];
        assert.equal(official.status, "source_provided");
        assert.equal(official.richTextStatus, "resolved");
        assertSha256(official.valueSha256, `${affected.id} ${locale} 공식 값 checksum`);
        assertSha256(
          official.sourceMemberSha256,
          `${affected.id} ${locale} 공식 source member checksum`,
        );
        assert.ok(official.text.length > 0);
        assert.ok(official.sourceMember.length > 0);
      }
    }
  }
});

test("격리된 검수 artifact는 canonical serializer와 byte-for-byte 동일하다", () => {
  assert.equal(
    serializePalworldTranslationReviewArtifact(artifacts.summary),
    serializedArtifacts.summary,
  );
  assert.equal(
    serializePalworldTranslationReviewArtifact(artifacts.sourceAnomalyBatch),
    serializedArtifacts.sourceAnomalyBatch,
  );
});

test("검수 artifact validator는 unknown field와 hash 변조를 거부한다", () => {
  const unknownSummary = {
    ...clone(artifacts.summary),
    unexpected: true,
  };
  assert.throws(
    () => assertPalworldTranslationReviewSummary(unknownSummary),
    /허용되지 않은 필드|unknown/u,
  );

  const tamperedSourceHash = clone(artifacts.sourceAnomalyBatch);
  tamperedSourceHash.groups[0].affected[0].current.ko.sourceSha256 = "0".repeat(64);
  assert.throws(
    () => assertPalworldTranslationSourceAnomalyBatch(tamperedSourceHash),
    /hash|checksum|SHA-256|일치/u,
  );

  const tamperedCandidateHash = clone(artifacts.sourceAnomalyBatch);
  tamperedCandidateHash.groups[0].affected[0].official.ko.valueSha256 = "f".repeat(64);
  assert.throws(
    () => assertPalworldTranslationSourceAnomalyBatch(tamperedCandidateHash),
    /hash|checksum|SHA-256|일치/u,
  );
});

test("검수 artifact validator는 중복과 비결정적 정렬을 거부한다", () => {
  const duplicateGroup = clone(artifacts.sourceAnomalyBatch);
  duplicateGroup.groups[1] = clone(duplicateGroup.groups[0]);
  duplicateGroup.counts.affectedFields = duplicateGroup.groups.reduce(
    (count, group) => count + group.affected.length,
    0,
  );
  duplicateGroup.counts.missingSlots = duplicateGroup.groups.reduce(
    (count, group) => count + (group.affected.length * group.missingSlotCountPerField),
    0,
  );
  duplicateGroup.counts.officialKoResolved = duplicateGroup.counts.affectedFields;
  duplicateGroup.counts.officialJaResolved = duplicateGroup.counts.affectedFields;
  assert.throws(
    () => assertPalworldTranslationSourceAnomalyBatch(duplicateGroup),
    /중복|duplicate/u,
  );

  const unsortedGroups = clone(artifacts.sourceAnomalyBatch);
  [unsortedGroups.groups[0], unsortedGroups.groups[1]] = [
    unsortedGroups.groups[1],
    unsortedGroups.groups[0],
  ];
  assert.throws(
    () => assertPalworldTranslationSourceAnomalyBatch(unsortedGroups),
    /정렬|순서|sorted/u,
  );

  const unsortedAffected = clone(artifacts.sourceAnomalyBatch);
  const groupWithMultipleItems = unsortedAffected.groups.find((group) => group.affected.length > 1);
  assert.ok(groupWithMultipleItems);
  [groupWithMultipleItems.affected[0], groupWithMultipleItems.affected[1]] = [
    groupWithMultipleItems.affected[1],
    groupWithMultipleItems.affected[0],
  ];
  assert.throws(
    () => assertPalworldTranslationSourceAnomalyBatch(unsortedAffected),
    /정렬|순서|sorted/u,
  );
});

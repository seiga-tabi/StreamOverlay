import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const {
  PALWORLD_PUBLIC_NOTICE_JA,
  PALWORLD_PUBLIC_NOTICE_KO,
  assertPalworldImageSourceMap,
  assertPalworldImageUsePolicy
} = await import("../dist/data/palworld-image-policy.js");
const { assertPalworldPaldexArtifact } = await import("../dist/data/palworld-paldex-artifact.js");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const artifact = assertPalworldPaldexArtifact(JSON.parse(await readFile(new URL("paldex.json", releaseRoot), "utf8")));
const operatorPolicy = JSON.parse(await readFile(new URL("image-use-policy.json", releaseRoot), "utf8"));

function mappingEntries() {
  return artifact.records.map((pal) => ({
    palId: pal.id,
    sourceInternalId: pal.sourceInternalId,
    sourceFileName: `${pal.id}.png`,
    sourceRevision: "operator-export-1.0.1-r1",
    sourceKind: "operator_controlled_server_export"
  }));
}

test("운영자 image-use-policy는 exact schema와 공개 공지를 검증한다", () => {
  const policy = assertPalworldImageUsePolicy(operatorPolicy);
  assert.equal(policy.status, "operator_acknowledged");
  assert.equal(policy.usageBasis, "operator_reference_use");
  assert.equal(policy.sourceType, "operator_provided_archive");
  assert.equal(policy.rightsVerified, false);
  assert.equal(policy.publicNoticeKo, PALWORLD_PUBLIC_NOTICE_KO);
  assert.equal(policy.publicNoticeJa, PALWORLD_PUBLIC_NOTICE_JA);
  assert.throws(() => assertPalworldImageUsePolicy({ ...operatorPolicy, unknown: true }), /허용되지 않은 필드/);
  assert.throws(() => assertPalworldImageUsePolicy({ ...operatorPolicy, release: "latest" }), /1\.0\.1/);
  assert.throws(() => assertPalworldImageUsePolicy({ ...operatorPolicy, publicNoticeKo: "승인된 공식 이미지" }), /정확히 일치/);
});

test("policy는 기술 허용과 권리 검증 상태를 서로 분리한다", () => {
  const blocked = {
    ...operatorPolicy,
    status: "blocked_by_license",
    usageBasis: "none",
    allowPublicDisplay: false,
    allowSelfHosting: false,
    allowResize: false,
    allowWebpConversion: false
  };
  assert.equal(assertPalworldImageUsePolicy(blocked).status, "blocked_by_license");
  assert.throws(() => assertPalworldImageUsePolicy({ ...blocked, allowResize: true }), /blocked 상태/);
  assert.throws(() => assertPalworldImageUsePolicy({ ...operatorPolicy, rightsVerified: true }), /권리 미검증/);
  assert.equal(assertPalworldImageUsePolicy({
    ...operatorPolicy,
    status: "ready",
    usageBasis: "rights_verified",
    rightsVerified: true
  }).status, "ready");
});

test("image source mapping은 287종 canonical exact join과 subset fallback을 지원한다", () => {
  const entries = mappingEntries();
  const complete = assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries }, artifact);
  assert.equal(complete.entries.length, 287);
  assert.equal(new Set(complete.entries.map((entry) => entry.palId)).size, 287);
  assert.equal(new Set(complete.entries.map((entry) => entry.sourceInternalId)).size, 287);

  const subset = assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries: entries.slice(0, 2) }, artifact);
  assert.equal(subset.entries.length, 2);
  assert.throws(
    () => assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries: [entries[1], entries[0]] }, artifact),
    /canonical 순서/
  );
  assert.throws(
    () => assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries: [{ ...entries[0], sourceInternalId: entries[1].sourceInternalId }] }, artifact),
    /exact join/
  );
  assert.throws(
    () => assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries: [{ ...entries[0], palId: "unknown-pal" }] }, artifact),
    /exact join/
  );
});

test("mapping은 경로 우회와 가변 revision을 거부하고 동일 파일 hash 검증은 override 단계로 넘긴다", () => {
  const entries = mappingEntries().slice(0, 2);
  for (const sourceFileName of ["../pal.png", "folder/pal.png", "folder\\pal.png", "%2e%2e.png", "pal.svg", ".pal.png"]) {
    assert.throws(
      () => assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries: [{ ...entries[0], sourceFileName }] }, artifact),
      /basename|우회/
    );
  }
  for (const sourceRevision of ["latest", "main", "master", "HEAD", "https://example.com/revision"]) {
    assert.throws(
      () => assertPalworldImageSourceMap({ schemaVersion: 1, release: "1.0.1", entries: [{ ...entries[0], sourceRevision }] }, artifact),
      /opaque revision/
    );
  }
  assert.doesNotThrow(() => assertPalworldImageSourceMap({
    schemaVersion: 1,
    release: "1.0.1",
    entries: [{ ...entries[0], sourceFileName: "shared.png" }, { ...entries[1], sourceFileName: "shared.png" }]
  }, artifact));
});

test("maintenance CLI 오류는 source 절대경로나 stack을 출력하지 않는다", () => {
  const secretPath = "/operator/private/palworld-assets";
  const result = spawnSync(process.execPath, [
    new URL("../dist/scripts/import-palworld-images.js", import.meta.url).pathname,
    "--release", "1.0.1",
    "--source-dir", secretPath,
    "--mapping", "/invalid/image-source-map.json",
    "--policy", "/invalid/image-use-policy.json"
  ], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /반입에 실패했습니다/);
  assert.equal(result.stderr.includes(secretPath), false);
  assert.equal(result.stderr.includes("Error:"), false);
  assert.equal(result.stderr.includes("at "), false);
});

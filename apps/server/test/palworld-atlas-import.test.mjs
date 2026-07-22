import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const importRoot = new URL("../data/palworld/_imports/atlas-24181105/", import.meta.url);
const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);

async function bytes(path) {
  return readFile(new URL(path, importRoot));
}

async function json(path, root = importRoot) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("Atlas 격리 반입본은 고정 archive와 upstream checksum을 보존한다", async () => {
  const provenance = await json("import-provenance.json");
  assert.equal(provenance.schemaVersion, 1);
  assert.equal(provenance.status, "quarantined");
  assert.equal(provenance.runtimeActivation, false);
  assert.equal(provenance.archive.sha256, "8869d768d80d24e8443e6a82a3be338a092b4a656d77d6938a5265c3e2a164bb");
  assert.equal(provenance.archive.integrityTest, "passed");
  assert.equal(provenance.archive.pathSafetyCheck, "passed");
  assert.equal(provenance.upstream.sourceRevision, "0385b3fd8bd757240d4a2c79615145122669abd5");
  assert.equal(provenance.upstream.steamBuildId, "24181105");

  for (const entry of provenance.includedFiles) {
    assert.match(entry.path, /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u);
    assert.equal(entry.path.includes(".."), false);
    const value = await bytes(entry.path);
    assert.equal(value.length, entry.bytes, entry.path);
    assert.equal(sha256(value), entry.sha256, entry.path);
  }
});

test("Atlas 최신 build의 Pal·아이템·교배 원본 수량과 manifest가 일치한다", async () => {
  const [pals, items, breeding, manifest] = await Promise.all([
    json("pals/index.json"),
    json("items/index.json"),
    json("breeding.json"),
    json("upstream-manifest.json")
  ]);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.steamBuildId, "24181105");
  assert.deepEqual(manifest.counts, {
    pals: 289,
    items: 1891,
    uniqueBreedingPairs: 257,
    wildSpawns: 68617,
    alphaSpawns: 90,
    palpagosSpawns: 64753,
    treeSpawns: 3954
  });
  assert.equal(pals.records.length, manifest.counts.pals);
  assert.equal(items.records.length, manifest.counts.items);
  assert.equal(breeding.uniquePairs.length, manifest.counts.uniqueBreedingPairs);
  assert.equal(breeding.sameSpeciesProducesSelf, true);
  assert.equal(manifest.checksums.pals, sha256(await bytes("pals/index.json")));
  assert.equal(manifest.checksums.items, sha256(await bytes("items/index.json")));
  assert.equal(manifest.checksums.breeding, sha256(await bytes("breeding.json")));
});

test("격리 report는 runtime 비호환 아이템 품질을 실제 원본에서 계산한다", async () => {
  const [{ records }, provenance] = await Promise.all([
    json("items/index.json"),
    json("import-provenance.json")
  ]);
  const quality = provenance.qualityReport.items;
  assert.equal(quality.sourceRecords, records.length);
  assert.equal(quality.englishOnlyRecords, records.length);
  assert.equal(quality.placeholderNameRecords, records.filter((item) => item.name === "en Text").length);
  assert.equal(quality.zeroRarityRecords, records.filter((item) => item.rarity === 0).length);
  assert.equal(quality.markupDescriptionRecords, records.filter((item) => /<[^>]+>/u.test(item.description)).length);
  assert.equal(quality.actualImageFiles, 0);
  assert.equal(records.every((item) => typeof item.icon === "string" && item.icon.length > 0), true);
  assert.equal(provenance.runtimeActivationBlockers.includes("ITEM_LOCALIZATION_KO_JA_MISSING"), true);
  assert.equal(provenance.runtimeActivationBlockers.includes("ITEM_RARITY_ZERO_SCHEMA_INCOMPATIBLE"), true);
});

test("특수 교배는 current public Pal exact mapping 범위를 숨기지 않는다", async () => {
  const [{ uniquePairs }, paldex, provenance] = await Promise.all([
    json("breeding.json"),
    json("paldex.json", releaseRoot),
    json("import-provenance.json")
  ]);
  const publicInternalIds = new Set(paldex.records.map((pal) => pal.sourceInternalId));
  const unresolvedInternalIds = new Set();
  let exactPairs = 0;
  let genderConditionalPairs = 0;

  for (const pair of uniquePairs) {
    const references = [pair.parentAId, pair.parentBId, pair.childId];
    if (references.every((id) => publicInternalIds.has(id))) exactPairs += 1;
    else references.filter((id) => !publicInternalIds.has(id)).forEach((id) => unresolvedInternalIds.add(id));
    if (pair.parentAGender !== undefined || pair.parentBGender !== undefined) genderConditionalPairs += 1;
  }

  const quality = provenance.qualityReport.breeding;
  assert.equal(exactPairs, quality.currentPublicPaldexExactPairs);
  assert.equal(uniquePairs.length - exactPairs, quality.currentPublicPaldexUnresolvedPairs);
  assert.equal(genderConditionalPairs, quality.genderConditionalPairs);
  assert.deepEqual([...unresolvedInternalIds].sort(), [...quality.unresolvedInternalIds].sort());
  assert.equal(quality.generalPairTableIncluded, false);
  assert.equal(provenance.runtimeActivationBlockers.includes("BREEDING_GENERAL_PAIR_TABLE_MISSING"), true);
});

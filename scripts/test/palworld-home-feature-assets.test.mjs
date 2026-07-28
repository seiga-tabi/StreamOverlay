import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const publicRoot = path.join(repositoryRoot, "apps/dashboard/public");
const manifestPath = path.join(
  repositoryRoot,
  "apps/dashboard/src/features/public-palworld/data/palworld-home-feature-assets.json",
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("Palworld 홈 기능 asset은 검증된 ZIP과 exact entity reference를 보존한다", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.release, "1.0.1");
  assert.equal(manifest.rightsVerified, false);
  assert.equal(manifest.usageBasis, "operator_reference_use");
  assert.deepEqual(
    manifest.entries.map((entry) => [entry.id, entry.canonicalEntityId, entry.sourceRowId]),
    [
      ["pals", "lifmunk", "Carbunclo"],
      ["breeding", "pal-egg-normal-01", "PalEgg_Normal_01"],
      ["map", "fast-travel", "DT_LocationUIData.PointFastTravel"],
    ],
  );
});

test("Palworld 홈 기능 asset은 로컬 content hash WebP와 manifest 크기가 일치한다", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const entry of manifest.entries) {
    assert.match(
      entry.imageUrl,
      /^\/images\/public-home\/palworld\/features\/1\.0\.1\/[0-9a-f]{64}\.webp$/u,
    );
    assert.equal(entry.format, "webp");
    assert.equal(entry.rightsVerified, false);
    assert.equal(entry.usageBasis, "operator_reference_use");
    const buffer = await readFile(path.join(publicRoot, entry.imageUrl.slice(1)));
    const metadata = await sharp(buffer).metadata();
    assert.equal(sha256(buffer), entry.outputSha256);
    assert.equal(metadata.width, entry.width);
    assert.equal(metadata.height, entry.height);
  }
});

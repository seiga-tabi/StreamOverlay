import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256,
  PALWORLD_MAP_REGIONAL_EGG_ICON_IDS,
  PALWORLD_MAP_STATUE_ICON_IDS,
  assertPalworldMapLayerIconManifest
} from "../dist/data/palworld-map-layer-icon-manifest.js";
import {
  assertPalworldMapCollectibleIconMapping,
  loadPalworldMapCollectibleIconMapping
} from "../dist/data/palworld-map-collectible-icon-import.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1"
);
const MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/collectible-icon-map.json"
);
const ASSET_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/dashboard/public/images/palworld/1.0.1/map-icons"
);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("collectible icon mapping은 12종 동상과 8개 지역 알을 exact evidence로 고정한다", async () => {
  const mappingBytes = await readFile(MAPPING_PATH);
  assert.equal(sha256(mappingBytes), PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256);
  const mapping = await loadPalworldMapCollectibleIconMapping(
    MAPPING_PATH,
    "1.0.1"
  );
  assert.deepEqual(
    mapping.entries.map((entry) => entry.id),
    [...PALWORLD_MAP_STATUE_ICON_IDS, ...PALWORLD_MAP_REGIONAL_EGG_ICON_IDS]
  );
  assert.equal(
    mapping.entries.filter((entry) =>
      entry.reviewStatus === "source_verified_exact"
    ).length,
    12
  );
  assert.equal(
    mapping.entries.filter((entry) =>
      entry.reviewStatus === "source_verified_representative"
    ).length,
    8
  );
  assert.equal(
    mapping.entries.some((entry) =>
      entry.imageMember === "Texture/T_itemicon_Relic_12.png"
    ),
    false
  );
  const eggEntries = mapping.entries.filter((entry) => entry.category === "egg");
  assert.deepEqual(
    new Set(eggEntries.map((entry) => entry.imageMember)),
    new Set(["Texture/T_itemicon_Material_PalEgg_Unknown.png"])
  );

  assert.throws(
    () => assertPalworldMapCollectibleIconMapping({
      ...mapping,
      entries: mapping.entries.map((entry, index) =>
        index === 0 ? { ...entry, unknown: true } : entry
      )
    }, "1.0.1"),
    /허용되지 않은 필드/u
  );
  assert.throws(
    () => assertPalworldMapCollectibleIconMapping({
      ...mapping,
      entries: mapping.entries.map((entry) =>
        entry.id === "egg-grass"
          ? { ...entry, sharedAssetReason: null }
          : entry
      )
    }, "1.0.1"),
    /mapping 정책/u
  );
});

test("collectible icon mapping loader는 checksum 변조를 fail-closed 처리한다", async (context) => {
  const root = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-collectible-map-")
  );
  context.after(() => rm(root, { recursive: true, force: true }));
  const tampered = path.join(root, "collectible-icon-map.json");
  const mapping = JSON.parse(await readFile(MAPPING_PATH, "utf8"));
  mapping.entries[0].imageSha256 = "0".repeat(64);
  await writeFile(tampered, `${JSON.stringify(mapping, null, 2)}\n`);
  await assert.rejects(
    loadPalworldMapCollectibleIconMapping(tampered, "1.0.1"),
    /mapping SHA-256/u
  );
});

test("게시된 collectible WebP는 manifest content hash·크기와 일치한다", async () => {
  const raw = JSON.parse(
    await readFile(
      path.join(RELEASE_ROOT, "map-layer-icons-manifest.json"),
      "utf8"
    )
  );
  const manifest = assertPalworldMapLayerIconManifest(raw, "1.0.1");
  assert.equal(manifest.schemaVersion, 2);
  const collectibleEntries = manifest.entries.filter((entry) =>
    entry.id.startsWith("statue-") || entry.id.startsWith("egg-")
  );
  assert.equal(collectibleEntries.length, 20);
  assert.equal(new Set(collectibleEntries.map((entry) => entry.outputSha256)).size, 13);
  for (const entry of collectibleEntries) {
    const bytes = await readFile(path.join(ASSET_ROOT, entry.outputFileName));
    const metadata = await sharp(bytes, {
      animated: false,
      failOn: "error"
    }).metadata();
    assert.equal(sha256(bytes), entry.outputSha256);
    assert.equal(bytes.length, entry.outputBytes);
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, entry.outputWidth);
    assert.equal(metadata.height, entry.outputHeight);
    assert.equal(entry.outputWidth, 256);
    assert.equal(entry.outputHeight, 256);
  }
});

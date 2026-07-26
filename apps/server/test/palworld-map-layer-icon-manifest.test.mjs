import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PALWORLD_MAP_LAYER_ICON_IDS,
  PALWORLD_MAP_LAYER_ICON_V1_IDS,
  PALWORLD_MAP_REGIONAL_EGG_ICON_IDS,
  assertPalworldMapLayerIconManifest,
  loadPalworldMapLayerIconManifest
} from "../dist/data/palworld-map-layer-icon-manifest.js";

const SOURCE_MAPPINGS = {
  boss: [
    "verified_game_ui",
    "Pal/Texture/UI/InGame/T_icon_compass_boss.png",
    "Pal/Texture/UI/InGame/T_icon_compass_boss.png",
    64,
    64
  ],
  dungeon: [
    "exact_datatable_reference",
    "DT_LocationUIData.PointDungeonPortal",
    "Pal/Texture/UI/InGame/T_icon_compass_dungeon.png",
    64,
    64
  ],
  "fast-travel": [
    "exact_datatable_reference",
    "DT_LocationUIData.PointFastTravel",
    "Pal/Texture/UI/InGame/T_icon_compass_FTtower.png",
    100,
    100
  ],
  npc: [
    "representative_game_asset",
    "Pal/Texture/PalIcon/NPC/T_BOSS_NPC_Male_Trader01.png",
    "Pal/Texture/PalIcon/NPC/T_BOSS_NPC_Male_Trader01.png",
    128,
    128
  ],
  treasure: [
    "exact_datatable_reference",
    "DT_LocationUIData.mapObjectIconMap.TreasureBox",
    "Pal/Texture/UI/InGame/T_icon_compass_Search_Treasure.png",
    80,
    80
  ]
};

function sha(index) {
  return index.toString(16).padStart(64, "0");
}

function validManifest() {
  return {
    schemaVersion: 1,
    release: "1.0.1",
    kind: "map-layer-icons",
    status: "operator_acknowledged",
    sourceType: "operator_pak_export",
    sourceArchiveSha256: "a".repeat(64),
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    entries: PALWORLD_MAP_LAYER_ICON_V1_IDS.map((id, index) => {
      const [
        mappingStatus,
        sourceReference,
        sourceMember,
        outputWidth,
        outputHeight
      ] = SOURCE_MAPPINGS[id];
      const outputSha256 = sha(index + 1);
      return {
        id,
        mappingStatus,
        sourceReference,
        sourceMember,
        sourceSha256: sha(index + 101),
        outputSha256,
        outputFileName: `${outputSha256}.webp`,
        outputWidth,
        outputHeight,
        outputBytes: 1000 + index,
        imageUrl:
          `/images/palworld/1.0.1/map-icons/${outputSha256}.webp`
      };
    })
  };
}

test("지도 필터 아이콘 manifest는 exact source mapping과 content-hash URL을 검증한다", () => {
  const manifest = validManifest();
  const validated = assertPalworldMapLayerIconManifest(manifest, "1.0.1");
  assert.deepEqual(
    validated.entries.map((entry) => entry.id),
    PALWORLD_MAP_LAYER_ICON_V1_IDS
  );
  assert.equal(validated.status, "operator_acknowledged");
  assert.equal(validated.rightsVerified, false);

  assert.throws(
    () => assertPalworldMapLayerIconManifest(
      { ...manifest, unknown: true },
      "1.0.1"
    ),
    /허용되지 않은 필드/u
  );
  assert.throws(
    () => assertPalworldMapLayerIconManifest(
      { ...manifest, rightsVerified: true },
      "1.0.1"
    ),
    /rightsVerified=false/u
  );
  assert.throws(
    () => assertPalworldMapLayerIconManifest(manifest, "2.0.0"),
    /active release/u
  );
});

test("지도 필터 아이콘 manifest는 source 바꿔치기·중복 hash·비버전 URL을 차단한다", () => {
  const manifest = validManifest();
  assert.throws(
    () => assertPalworldMapLayerIconManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 0
          ? { ...entry, sourceMember: "../boss.png" }
          : entry
      )
    }, "1.0.1"),
    /versioned semantic mapping/u
  );
  assert.throws(
    () => assertPalworldMapLayerIconManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 1
          ? {
              ...entry,
              outputSha256: manifest.entries[0].outputSha256,
              outputFileName: manifest.entries[0].outputFileName,
              imageUrl: manifest.entries[0].imageUrl
            }
          : entry
      )
    }, "1.0.1"),
    /중복/u
  );
  assert.throws(
    () => assertPalworldMapLayerIconManifest({
      ...manifest,
      entries: manifest.entries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              imageUrl: `/images/palworld/map-icons/${entry.outputFileName}`
            }
          : entry
      )
    }, "1.0.1"),
    /active release/u
  );
});

test("지도 필터 아이콘 loader는 canonical regular JSON만 읽는다", async (context) => {
  const root = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-map-layer-icons-")
  );
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "map-layer-icons-manifest.json"),
    `${JSON.stringify(validManifest(), null, 2)}\n`
  );
  const loaded = await loadPalworldMapLayerIconManifest(root, "1.0.1");
  assert.equal(loaded.entries.length, 5);
});

test("v2 지도 아이콘 manifest는 multi-source와 collectible 공유 정책을 검증한다", async () => {
  const releaseRoot = path.resolve(
    new URL("../data/palworld/1.0.1/", import.meta.url).pathname
  );
  const raw = JSON.parse(
    await readFile(
      path.join(releaseRoot, "map-layer-icons-manifest.json"),
      "utf8"
    )
  );
  const validated = assertPalworldMapLayerIconManifest(raw, "1.0.1");
  assert.equal(validated.schemaVersion, 2);
  assert.deepEqual(
    validated.entries.map((entry) => entry.id),
    PALWORLD_MAP_LAYER_ICON_IDS
  );
  assert.equal(validated.entries.length, 25);
  assert.equal(validated.sources.length, 3);
  assert.equal(validated.rightsVerified, false);
  const eggEntries = validated.entries.filter((entry) =>
    PALWORLD_MAP_REGIONAL_EGG_ICON_IDS.includes(entry.id)
  );
  assert.equal(eggEntries.length, 8);
  assert.equal(new Set(eggEntries.map((entry) => entry.outputSha256)).size, 1);
  assert.deepEqual(
    new Set(eggEntries.map((entry) => entry.sharedAssetReason)),
    new Set(["regional_random_egg_unknown_icon"])
  );

  assert.throws(
    () => assertPalworldMapLayerIconManifest({
      ...raw,
      mappingSha256: "0".repeat(64)
    }, "1.0.1"),
    /mapping checksum/u
  );
  assert.throws(
    () => assertPalworldMapLayerIconManifest({
      ...raw,
      entries: raw.entries.map((entry) =>
        entry.id === "egg-grass"
          ? { ...entry, sharedAssetReason: null }
          : entry
      )
    }, "1.0.1"),
    /semantic mapping/u
  );
  assert.throws(
    () => assertPalworldMapLayerIconManifest({
      ...raw,
      sources: raw.sources.map((source) =>
        source.id === "inventory-item-icons"
          ? { ...source, archiveSha256: "f".repeat(64) }
          : source
      )
    }, "1.0.1"),
    /archive SHA-256/u
  );
});

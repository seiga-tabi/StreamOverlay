import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { deflateRawSync } from "node:zlib";

const {
  assertPalworldCatalogArtifact,
  assertPalworldCatalogAssetManifest,
  loadPalworldCatalogRuntimeSource,
  validatePalworldCatalogAssetFiles
} = await import("../dist/data/palworld-catalog-artifact.js");
const { adaptPalworldCatalog } = await import("../dist/data/palworld-catalog-adapter.js");
const { PALWORLD_SNAPSHOT } = await import("../dist/data/palworld-snapshot.js");
const { loadPalworldPaldexRuntimeRelease } = await import("../dist/data/palworld-paldex-adapter.js");
const { parseAllowedSqlTables } = await import("../dist/data/palworld-catalog-import.js");
const { PalworldSourceArchive, crc32 } = await import("../dist/data/palworld-source-archive.js");

const releaseRoot = new URL("../data/palworld/1.0.1/", import.meta.url);
const itemImageRoot = new URL("../../dashboard/public/images/palworld/1.0.1/items/", import.meta.url);
const elementImageRoot = new URL("../../dashboard/public/images/palworld/1.0.1/elements/", import.meta.url);

function zip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const payload = Buffer.from(entry.data ?? "", "utf8");
    const compressed = entry.deflate ? deflateRawSync(payload) : payload;
    const checksum = entry.badCrc ? (crc32(payload) ^ 0xffffffff) >>> 0 : crc32(payload);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(payload.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(payload.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.symlink ? 0o120777 : 0o100644) * 65_536) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    localParts.push(local, name, compressed);
    centralParts.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, central, eocd]);
}

test("고정 catalog와 item·element WebP는 checksum 및 실제 asset gate를 통과한다", async () => {
  const loaded = await loadPalworldCatalogRuntimeSource(releaseRoot.pathname, {
    itemImageRoot: itemImageRoot.pathname,
    elementImageRoot: elementImageRoot.pathname
  });
  assert.equal(loaded.catalog.coverage.canonicalPals, 287);
  assert.equal(loaded.catalog.coverage.exactPalDetails, 270);
  assert.equal(loaded.catalog.coverage.runtimeItems, 1847);
  assert.equal(loaded.catalog.coverage.itemImages, 1762);
  assert.equal(loaded.catalog.coverage.itemImageFallbacks, 85);
  assert.equal(loaded.catalog.coverage.uniqueItemImages, 695);
  assert.equal(loaded.catalog.coverage.activeSkills, 217);
  assert.equal(loaded.catalog.coverage.partnerSkills, 270);
  assert.equal(loaded.catalog.coverage.passiveSkills, 79);
  assert.equal(loaded.catalog.coverage.activeSkillConflicts, 1);
  assert.equal(loaded.catalog.coverage.atlasBreedingPairs, 257);
  assert.equal(loaded.catalog.coverage.specialBreedingPairs, 79);
  assert.equal(loaded.catalog.coverage.unresolvedBreedingReferences, 75);
  assert.equal(loaded.catalog.coverage.genderedBreedingPairs, 2);
  assert.equal(loaded.catalog.specialBreedingPairs.length, 79);
  assert.equal(loaded.catalog.elements.length, 9);
  assert.equal(loaded.itemImagesManifest.entries.length, 1762);
  assert.equal(new Set(loaded.itemImagesManifest.entries.map((entry) => entry.outputSha256)).size, 695);
  const expectedElementSources = {
    dark: ["Dark", "05"],
    dragon: ["Dragon", "06"],
    electric: ["Electric", "03"],
    fire: ["Fire", "01"],
    grass: ["Grass", "04"],
    ground: ["Ground", "07"],
    ice: ["Ice", "08"],
    neutral: ["Neutral", "00"],
    water: ["Water", "02"]
  };
  for (const element of loaded.catalog.elements) {
    const [sourceName, sourceSuffix] = expectedElementSources[element.id];
    const image = loaded.elementImagesManifest.entries.find((entry) => entry.id === element.id);
    assert.equal(element.sourceName, sourceName);
    assert.equal(image.sourceFileName.endsWith(`/T_Icon_element_s_${sourceSuffix}.png`), true);
  }
  assert.deepEqual(
    loaded.catalog.skills
      .filter((skill) => skill.nameEn === "Double Fang")
      .map((skill) => [skill.id, skill.descriptionEn]),
    [
      ["active-double-fang-51aba4eadf", "Bites rapidly in succession to attack enemies."],
      ["active-double-fang-b35a322bb6", "Launches a rapid succession of bites at the enemy."]
    ]
  );
});

test("catalog validator는 unknown field와 참조가 손상된 artifact를 거부한다", async () => {
  const source = JSON.parse(await readFile(new URL("catalog.json", releaseRoot), "utf8"));
  assert.throws(() => assertPalworldCatalogArtifact({ ...source, unexpected: true }), /허용되지 않은 필드/u);
  const invalid = structuredClone(source);
  invalid.items[0].craftingMaterials = [{ itemId: "missing-item", quantity: 1 }];
  assert.throws(() => assertPalworldCatalogArtifact(invalid), /catalog item에 없는 참조/u);

  const orphanDrop = structuredClone(source);
  const detailWithDrop = orphanDrop.palDetails.find((detail) => detail.drops.some((drop) => drop.itemId));
  const mappedDrop = detailWithDrop.drops.find((drop) => drop.itemId);
  mappedDrop.itemId = "missing-item";
  mappedDrop.itemSourceInternalId = "MissingItem";
  assert.throws(() => assertPalworldCatalogArtifact(orphanDrop), /catalog item에 없는 참조/u);

  const mismatchedDropSource = structuredClone(source);
  const sourceDetail = mismatchedDropSource.palDetails.find((detail) => detail.drops.some((drop) => drop.itemId));
  sourceDetail.drops.find((drop) => drop.itemId).itemSourceInternalId = "WrongInternalId";
  assert.throws(() => assertPalworldCatalogArtifact(mismatchedDropSource), /canonical item 원본 internal ID/u);

  const orphanDropPal = structuredClone(source);
  orphanDropPal.items.find((item) => item.dropPalIds.length > 0).dropPalIds[0] = "missing-pal";
  assert.throws(() => assertPalworldCatalogArtifact(orphanDropPal), /catalog Pal 상세에 없는 참조/u);

  const wrongPartner = structuredClone(source);
  const partnerDetail = wrongPartner.palDetails.find((detail) => detail.partnerSkillId);
  partnerDetail.partnerSkillId = wrongPartner.skills.find((skill) => skill.type === "active").id;
  assert.throws(() => assertPalworldCatalogArtifact(wrongPartner), /canonical partner skill/u);

  const wrongCoverage = structuredClone(source);
  wrongCoverage.coverage.activeSkills = 0;
  assert.throws(() => assertPalworldCatalogArtifact(wrongCoverage), /active skill 수/u);

  const wrongBreedingCoverage = structuredClone(source);
  wrongBreedingCoverage.coverage.specialBreedingPairs = 78;
  assert.throws(() => assertPalworldCatalogArtifact(wrongBreedingCoverage), /특수 교배 조합 수/u);
});

test("catalog adapter는 Pal sourceInternalId가 canonical mapping과 다르면 거부한다", async () => {
  const [catalogSource, paldexRelease] = await Promise.all([
    loadPalworldCatalogRuntimeSource(releaseRoot.pathname, {
      itemImageRoot: itemImageRoot.pathname,
      elementImageRoot: elementImageRoot.pathname
    }),
    loadPalworldPaldexRuntimeRelease()
  ]);
  const firstDetail = catalogSource.catalog.palDetails[0];
  assert.throws(() => adaptPalworldCatalog({
    basePaldex: paldexRelease,
    catalog: catalogSource.catalog,
    catalogChecksum: catalogSource.manifest.catalogSha256,
    localizedSnapshot: PALWORLD_SNAPSHOT,
    sourceChecksum: "a".repeat(64),
    sourceInternalIds: {
      ...paldexRelease.sourceInternalIds,
      [firstDetail.palId]: "WrongInternalId"
    }
  }), /canonical mapping과 일치하지 않습니다/u);
});

test("asset manifest는 output hash와 다른 URL을 거부한다", async () => {
  const source = JSON.parse(await readFile(new URL("element-images-manifest.json", releaseRoot), "utf8"));
  source.entries[0].imageUrl = `/images/palworld/1.0.1/elements/${"f".repeat(64)}.webp`;
  assert.throws(() => assertPalworldCatalogAssetManifest(source, "elements"), /outputFileName과 동일한 content hash/u);
});

test("ZIP reader는 traversal·symlink·CRC 손상을 fail-closed 처리한다", async (context) => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "palworld-source-archive-test-")));
  context.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });
  const safePath = path.join(root, "safe.zip");
  await writeFile(safePath, zip([{ name: "safe/data.json", data: "{}", deflate: true }]));
  const archive = await PalworldSourceArchive.open(safePath, { maxTotalUncompressedBytes: 16 });
  assert.equal((await archive.readEntry("safe/data.json", 16)).toString("utf8"), "{}");
  await archive.close();

  for (const [name, archiveBytes, pattern] of [
    ["traversal.zip", zip([{ name: "../escape.json", data: "{}" }]), /안전하지 않은 ZIP entry/u],
    ["symlink.zip", zip([{ name: "safe/link", data: "target", symlink: true }]), /symlink ZIP entry/u]
  ]) {
    const filePath = path.join(root, name);
    await writeFile(filePath, archiveBytes);
    await assert.rejects(() => PalworldSourceArchive.open(filePath), pattern);
  }
  const crcPath = path.join(root, "crc.zip");
  await writeFile(crcPath, zip([{ name: "safe/data.json", data: "{}", badCrc: true }]));
  const crcArchive = await PalworldSourceArchive.open(crcPath);
  await assert.rejects(() => crcArchive.readEntry("safe/data.json", 16), /CRC32/u);
  await crcArchive.close();
});

test("asset validator는 manifest 밖 PNG와 symlink를 거부한다", async (context) => {
  const manifest = JSON.parse(await readFile(new URL("element-images-manifest.json", releaseRoot), "utf8"));
  const entry = manifest.entries[0];
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "palworld-catalog-assets-test-")));
  context.after(async () => {
    const { rm } = await import("node:fs/promises");
    await rm(root, { recursive: true, force: true });
  });
  const source = await readFile(new URL(entry.outputFileName, elementImageRoot));
  await writeFile(path.join(root, entry.outputFileName), source);
  const single = { ...manifest, entries: [entry] };
  await validatePalworldCatalogAssetFiles({ root, kind: "elements", manifest: single });
  await writeFile(path.join(root, "raw.png"), Buffer.from("not-an-image"));
  await assert.rejects(() => validatePalworldCatalogAssetFiles({ root, kind: "elements", manifest: single }), /manifest에 없는 파일/u);
  const symlinkRoot = path.join(root, "linked-root");
  await symlink(root, symlinkRoot);
  await assert.rejects(() => validatePalworldCatalogAssetFiles({ root: symlinkRoot, kind: "elements", manifest: single }), /symlink/u);
});

test("SQL parser는 allowlist table과 column 순서만 처리한다", () => {
  const statements = Object.entries({
    pals: ["ID", "DevName", "DexKey", "Image", "Name", "Wiki", "WikiImage", "Types", "Suitability", "Drops", "Aura", "Description", "Skills", "Stats", "Asset", "Genus", "Rarity", "Price", "Size", "Maps", "Breeding", "AIResponse", "Nocturnal", "Predator", "NooseTrap", "IsRaidBoss", "IgnoreStun", "IgnoreCombi", "FirstDefeatRewardItemID"],
    items: ["ID", "Name", "DevName", "Image", "Type", "Rank", "MaxStackCount", "Weight", "Gold", "Durability", "MagazineSize", "PhysicalAttackValue", "HPValue", "PhysicalDefenseValue", "ShieldValue", "MagicAttackValue", "MagicDefenseValue", "Description", "ItemActorClass", "PassiveSkills", "bLegalInGame"],
    crafting: ["ID", "SourceKey", "Name", "Output", "WorkAmount", "Material", "CraftExpRate"],
    passiveskills: ["ID", "Name", "DevName", "Ability", "Tier", "Description", "Image"],
    techtree: ["ID", "DevName", "Name", "UnlockBuildObjects", "UnlockItemRecipes", "Description", "Image", "RequireTechnology", "IsBossTechnology", "LevelCap", "Cost"]
  }).map(([table, columns]) => `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(", ")}) VALUES\n(${columns.map(() => "0").join(", ")});`).join("\n");
  const parsed = parseAllowedSqlTables(statements);
  assert.deepEqual(Object.fromEntries(Object.entries(parsed).map(([table, rows]) => [table, rows.length])), {
    pals: 1,
    items: 1,
    crafting: 1,
    passiveskills: 1,
    techtree: 1
  });
  assert.throws(() => parseAllowedSqlTables(statements.replace("`ID`, `DevName`", "`Unknown`, `DevName`")), /column allowlist/u);
});

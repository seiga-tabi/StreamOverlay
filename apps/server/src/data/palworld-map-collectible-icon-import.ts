import { createHash, randomBytes } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
  rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256,
  PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256,
  PALWORLD_MAP_CONTENT_ARCHIVE_SHA256,
  PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256,
  PALWORLD_MAP_LAYER_ICON_IDS,
  PALWORLD_MAP_LAYER_ICON_MANIFEST_FILE,
  PALWORLD_MAP_LAYER_ICON_V1_IDS,
  PALWORLD_MAP_REGIONAL_EGG_ICON_IDS,
  PALWORLD_MAP_REGIONAL_EGG_SHARED_ASSET_REASON,
  PALWORLD_MAP_STATUE_ICON_IDS,
  assertPalworldMapLayerIconManifest,
  loadPalworldMapLayerIconManifest,
  type PalworldMapLayerIconEntryV2,
  type PalworldMapLayerIconManifestV2,
  type PalworldMapLayerIconMappingStatus
} from "./palworld-map-layer-icon-manifest.js";
import { importPalworldPakPngAsset } from "./palworld-pak-assets.js";
import {
  withPalworldPakArchive,
  type PalworldPakArchiveReader
} from "./palworld-pak-preflight.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_MEMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/u;
const SAFE_CLASS_PATTERN = /^[A-Za-z0-9_]{1,160}$/u;
const MAX_MAPPING_BYTES = 256 * 1024;

type MappingEvidence = {
  member: string;
  sha256: string;
};

export type PalworldMapCollectibleIconMappingEntry = {
  id:
    | (typeof PALWORLD_MAP_STATUE_ICON_IDS)[number]
    | (typeof PALWORLD_MAP_REGIONAL_EGG_ICON_IDS)[number];
  category: "statue" | "egg";
  mappingStatus: PalworldMapLayerIconMappingStatus;
  sourceClasses: string[];
  evidence: MappingEvidence[];
  imageMember: string;
  imageSha256: string;
  sharedAssetReason: typeof PALWORLD_MAP_REGIONAL_EGG_SHARED_ASSET_REASON | null;
  reviewStatus: "source_verified_exact" | "source_verified_representative";
};

export type PalworldMapCollectibleIconMapping = {
  schemaVersion: 1;
  release: string;
  inventoryArchiveSha256: typeof PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256;
  blueprintArchiveSha256: typeof PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256;
  entries: PalworldMapCollectibleIconMappingEntry[];
};

export type PalworldMapCollectibleIconImportResult = {
  manifest: PalworldMapLayerIconManifestV2;
  manifestSha256: string;
  mappingSha256: string;
  published: boolean;
  uniqueImportedImages: number;
  statueImages: number;
  regionalEggTypes: number;
  sharedRegionalEggImages: number;
};

type ImportInput = {
  release: string;
  blueprintArchivePath: string;
  inventoryArchivePath: string;
  mappingPath: string;
  releaseRoot: string;
  assetRoot: string;
  publish: boolean;
};

function fail(message: string): never {
  throw new Error(`PALWORLD_MAP_COLLECTIBLE_ICON_IMPORT_FAILED: ${message}`);
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function exactRecord(
  value: unknown,
  pathName: string,
  keys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${pathName}: 객체여야 합니다.`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}: 허용되지 않은 필드입니다.`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}: 필수 필드가 없습니다.`);
  }
  return record;
}

function safeSha(value: unknown, pathName: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(`${pathName}: 소문자 64자리 SHA-256이어야 합니다.`);
  }
  return value;
}

function safeMember(value: unknown, pathName: string, extension: string): string {
  if (
    typeof value !== "string"
    || !SAFE_MEMBER_PATTERN.test(value)
    || value.includes("..")
    || value.includes("\\")
    || !value.endsWith(extension)
  ) {
    fail(`${pathName}: 안전한 ${extension} archive member여야 합니다.`);
  }
  return value;
}

export function assertPalworldMapCollectibleIconMapping(
  value: unknown,
  expectedRelease: string
): PalworldMapCollectibleIconMapping {
  const root = exactRecord(value, "collectibleIconMap", [
    "schemaVersion",
    "release",
    "inventoryArchiveSha256",
    "blueprintArchiveSha256",
    "entries"
  ]);
  if (root.schemaVersion !== 1 || root.release !== expectedRelease) {
    fail("collectibleIconMap: schemaVersion 또는 release가 일치하지 않습니다.");
  }
  if (
    safeSha(root.inventoryArchiveSha256, "collectibleIconMap.inventoryArchiveSha256")
      !== PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256
    || safeSha(root.blueprintArchiveSha256, "collectibleIconMap.blueprintArchiveSha256")
      !== PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256
  ) {
    fail("collectibleIconMap: 고정 archive SHA-256과 일치하지 않습니다.");
  }
  const expectedIds = [
    ...PALWORLD_MAP_STATUE_ICON_IDS,
    ...PALWORLD_MAP_REGIONAL_EGG_ICON_IDS
  ];
  if (!Array.isArray(root.entries) || root.entries.length !== expectedIds.length) {
    fail(`collectibleIconMap.entries: 검증된 collectible ${expectedIds.length}종이 필요합니다.`);
  }
  const imageMembers = new Set<string>();
  const sourceClasses = new Set<string>();
  const entries = root.entries.map((value, index) => {
    const pathName = `collectibleIconMap.entries[${index}]`;
    const entry = exactRecord(value, pathName, [
      "id",
      "category",
      "mappingStatus",
      "sourceClasses",
      "evidence",
      "imageMember",
      "imageSha256",
      "sharedAssetReason",
      "reviewStatus"
    ]);
    const expectedId = expectedIds[index]!;
    if (entry.id !== expectedId) {
      fail(`${pathName}.id: canonical collectible ID 순서와 일치해야 합니다.`);
    }
    const isEgg = (
      PALWORLD_MAP_REGIONAL_EGG_ICON_IDS as readonly string[]
    ).includes(expectedId);
    if (
      entry.category !== (isEgg ? "egg" : "statue")
      || entry.mappingStatus !== (
        isEgg ? "representative_game_asset" : "verified_game_ui"
      )
      || entry.reviewStatus !== (
        isEgg ? "source_verified_representative" : "source_verified_exact"
      )
      || entry.sharedAssetReason !== (
        isEgg ? PALWORLD_MAP_REGIONAL_EGG_SHARED_ASSET_REASON : null
      )
    ) {
      fail(`${pathName}: 검수 상태와 category별 mapping 정책이 일치하지 않습니다.`);
    }
    if (
      !Array.isArray(entry.sourceClasses)
      || entry.sourceClasses.length < 1
      || entry.sourceClasses.length > 8
    ) {
      fail(`${pathName}.sourceClasses: 1~8개 exact class가 필요합니다.`);
    }
    const classes = entry.sourceClasses.map((sourceClass, classIndex) => {
      if (
        typeof sourceClass !== "string"
        || !SAFE_CLASS_PATTERN.test(sourceClass)
        || sourceClasses.has(sourceClass)
      ) {
        fail(`${pathName}.sourceClasses[${classIndex}]: 중복 없는 exact class여야 합니다.`);
      }
      sourceClasses.add(sourceClass);
      return sourceClass;
    });
    if (
      !Array.isArray(entry.evidence)
      || entry.evidence.length !== classes.length
    ) {
      fail(`${pathName}.evidence: 각 source class에 exact Blueprint 증거가 필요합니다.`);
    }
    const evidence = entry.evidence.map((raw, evidenceIndex) => {
      const evidencePath = `${pathName}.evidence[${evidenceIndex}]`;
      const record = exactRecord(raw, evidencePath, ["member", "sha256"]);
      return {
        member: safeMember(record.member, `${evidencePath}.member`, ".json"),
        sha256: safeSha(record.sha256, `${evidencePath}.sha256`)
      };
    });
    const imageMember = safeMember(
      entry.imageMember,
      `${pathName}.imageMember`,
      ".png"
    );
    if (
      isEgg
        ? imageMember !== "Texture/T_itemicon_Material_PalEgg_Unknown.png"
        : imageMembers.has(imageMember)
    ) {
      fail(
        `${pathName}.imageMember: regional egg Unknown 공유 외에는 PNG를 공유할 수 없습니다.`
      );
    }
    imageMembers.add(imageMember);
    return {
      id: expectedId,
      category: isEgg ? "egg" as const : "statue" as const,
      mappingStatus: isEgg
        ? "representative_game_asset" as const
        : "verified_game_ui" as const,
      sourceClasses: classes,
      evidence,
      imageMember,
      imageSha256: safeSha(entry.imageSha256, `${pathName}.imageSha256`),
      sharedAssetReason: isEgg
        ? PALWORLD_MAP_REGIONAL_EGG_SHARED_ASSET_REASON
        : null,
      reviewStatus: isEgg
        ? "source_verified_representative" as const
        : "source_verified_exact" as const
    };
  });
  return {
    schemaVersion: 1,
    release: expectedRelease,
    inventoryArchiveSha256: PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256,
    blueprintArchiveSha256: PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256,
    entries
  };
}

export async function loadPalworldMapCollectibleIconMapping(
  mappingPath: string,
  expectedRelease: string
): Promise<PalworldMapCollectibleIconMapping> {
  const resolved = path.resolve(mappingPath);
  const before = await lstat(resolved);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 2
    || before.size > MAX_MAPPING_BYTES
    || await realpath(resolved) !== resolved
  ) {
    fail("collectible icon mapping은 symlink가 아닌 canonical JSON이어야 합니다.");
  }
  const handle = await open(resolved, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const bytes = await handle.readFile();
    if (sha256(bytes) !== PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256) {
      fail("collectible icon mapping SHA-256이 고정 checksum과 일치하지 않습니다.");
    }
    return assertPalworldMapCollectibleIconMapping(
      JSON.parse(bytes.toString("utf8")) as unknown,
      expectedRelease
    );
  } finally {
    await handle.close();
  }
}

function jsonContainsExactString(value: unknown, expected: string): boolean {
  if (value === expected) return true;
  if (Array.isArray(value)) {
    return value.some((entry) => jsonContainsExactString(entry, expected));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .some((entry) => jsonContainsExactString(entry, expected));
  }
  return false;
}

async function verifyBlueprintEvidence(
  reader: PalworldPakArchiveReader,
  mapping: PalworldMapCollectibleIconMapping
): Promise<void> {
  for (const entry of mapping.entries) {
    for (const [index, evidence] of entry.evidence.entries()) {
      const bytes = await reader.readBytes(evidence.member);
      if (sha256(bytes) !== evidence.sha256) {
        fail(`${entry.id}: Blueprint evidence checksum이 일치하지 않습니다.`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(bytes.toString("utf8")) as unknown;
      } catch {
        fail(`${entry.id}: Blueprint evidence JSON이 손상되었습니다.`);
      }
      if (!jsonContainsExactString(parsed, entry.sourceClasses[index]!)) {
        fail(`${entry.id}: Blueprint evidence에 exact source class가 없습니다.`);
      }
    }
  }
}

async function verifiedBaseEntries(
  releaseRoot: string,
  assetRoot: string,
  release: string
): Promise<PalworldMapLayerIconEntryV2[]> {
  const current = await loadPalworldMapLayerIconManifest(releaseRoot, release);
  if (
    current.schemaVersion === 1
    && current.sourceArchiveSha256 !== PALWORLD_MAP_CONTENT_ARCHIVE_SHA256
  ) {
    fail("기존 지도 아이콘 manifest가 고정 Content archive를 참조하지 않습니다.");
  }
  const byId = new Map(current.entries.map((entry) => [entry.id, entry]));
  return await Promise.all(PALWORLD_MAP_LAYER_ICON_V1_IDS.map(async (id) => {
    const entry = byId.get(id);
    if (!entry) fail(`${id}: 기존 검증된 지도 아이콘이 없습니다.`);
    const filePath = path.resolve(assetRoot, entry.outputFileName);
    if (path.dirname(filePath) !== path.resolve(assetRoot)) {
      fail(`${id}: 기존 지도 아이콘 경로가 asset root를 벗어납니다.`);
    }
    const before = await lstat(filePath);
    if (before.isSymbolicLink() || !before.isFile() || await realpath(filePath) !== filePath) {
      fail(`${id}: 기존 지도 아이콘이 canonical regular file이 아닙니다.`);
    }
    const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
      bytes = await handle.readFile();
    } finally {
      await handle.close();
    }
    const metadata = await sharp(bytes, { animated: false, failOn: "error" }).metadata();
    if (
      sha256(bytes) !== entry.outputSha256
      || metadata.format !== "webp"
      || metadata.width !== entry.outputWidth
      || metadata.height !== entry.outputHeight
      || bytes.length !== entry.outputBytes
    ) {
      fail(`${id}: 기존 지도 아이콘 bytes와 manifest가 일치하지 않습니다.`);
    }
    return {
      ...entry,
      id,
      sourceId: "content-map-assets" as const,
      sharedAssetReason: null
    };
  }));
}

async function writeContentHashAsset(
  assetRoot: string,
  fileName: string,
  bytes: Buffer
): Promise<void> {
  await mkdir(assetRoot, { recursive: true, mode: 0o755 });
  const resolvedRoot = path.resolve(assetRoot);
  const target = path.resolve(resolvedRoot, fileName);
  if (path.dirname(target) !== resolvedRoot) fail("asset output 경로가 root를 벗어납니다.");
  try {
    const before = await lstat(target);
    if (before.isSymbolicLink() || !before.isFile() || await realpath(target) !== target) {
      fail("기존 content-hash asset이 canonical regular file이 아닙니다.");
    }
    const handle = await open(target, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
      if (!(await handle.readFile()).equals(bytes)) {
        fail("기존 content-hash asset bytes가 다릅니다.");
      }
    } finally {
      await handle.close();
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const handle = await open(
    target,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o644
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(target, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();
}

async function writeManifestLast(
  releaseRoot: string,
  manifestBytes: Buffer
): Promise<void> {
  await mkdir(releaseRoot, { recursive: true, mode: 0o755 });
  const target = path.join(releaseRoot, PALWORLD_MAP_LAYER_ICON_MANIFEST_FILE);
  const temporary = path.join(
    releaseRoot,
    `.${PALWORLD_MAP_LAYER_ICON_MANIFEST_FILE}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`
  );
  const handle = await open(
    temporary,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
    0o644
  );
  try {
    await handle.writeFile(manifestBytes);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();
  try {
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function importPalworldMapCollectibleIcons(
  input: ImportInput
): Promise<PalworldMapCollectibleIconImportResult> {
  const mapping = await loadPalworldMapCollectibleIconMapping(
    input.mappingPath,
    input.release
  );
  const baseEntries = await verifiedBaseEntries(
    input.releaseRoot,
    input.assetRoot,
    input.release
  );
  const stagingRoot = await mkdtemp(
    path.join(await realpath(tmpdir()), "palworld-map-collectible-icons-")
  );
  let lockHandle: Awaited<ReturnType<typeof open>> | undefined;
  const lockPath = path.join(input.releaseRoot, ".map-collectible-icons-import.lock");
  try {
    if (input.publish) {
      await mkdir(input.releaseRoot, { recursive: true, mode: 0o755 });
      lockHandle = await open(
        lockPath,
        fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY,
        0o600
      );
      await lockHandle.writeFile(`${process.pid}\n`, "utf8");
      await lockHandle.sync();
    }
    const convertedByMember = new Map<
      string,
      Awaited<ReturnType<typeof importPalworldPakPngAsset>>
    >();
    const imageBytesByFile = new Map<string, Buffer>();
    await withPalworldPakArchive(
      input.blueprintArchivePath,
      { expectedSha256: PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256 },
      async (blueprintReader) => {
        await verifyBlueprintEvidence(blueprintReader, mapping);
        await withPalworldPakArchive(
          input.inventoryArchivePath,
          { expectedSha256: PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256 },
          async (inventoryReader) => {
            for (const entry of mapping.entries) {
              if (convertedByMember.has(entry.imageMember)) continue;
              const sourceBytes = await inventoryReader.readBytes(entry.imageMember);
              if (sha256(sourceBytes) !== entry.imageSha256) {
                fail(`${entry.id}: InventoryItemIcon PNG checksum이 일치하지 않습니다.`);
              }
              const converted = await importPalworldPakPngAsset({
                reader: inventoryReader,
                memberName: entry.imageMember,
                id: entry.id,
                kind: "item",
                outputRoot: stagingRoot,
                maximumOutputDimension: 256
              });
              if (
                converted.outputWidth !== 256
                || converted.outputHeight !== 256
                || converted.sourceWidth !== 256
                || converted.sourceHeight !== 256
              ) {
                fail(`${entry.id}: 검증된 256×256 게임 아이콘이어야 합니다.`);
              }
              const outputPath = path.resolve(stagingRoot, converted.outputFile);
              const outputBytes = await readFile(outputPath);
              if (sha256(outputBytes) !== converted.outputSha256) {
                fail(`${entry.id}: staging WebP checksum이 일치하지 않습니다.`);
              }
              convertedByMember.set(entry.imageMember, converted);
              imageBytesByFile.set(
                `${converted.outputSha256}.webp`,
                outputBytes
              );
            }
          }
        );
      }
    );

    const collectibleEntries: PalworldMapLayerIconEntryV2[] =
      mapping.entries.map((mappingEntry) => {
        const converted = convertedByMember.get(mappingEntry.imageMember);
        if (!converted) fail(`${mappingEntry.id}: 변환된 WebP가 없습니다.`);
        const outputFileName = `${converted.outputSha256}.webp`;
        return {
          id: mappingEntry.id,
          mappingStatus: mappingEntry.mappingStatus,
          sourceId: "inventory-item-icons",
          sourceReference: `collectible-icon-map.${mappingEntry.id}`,
          sourceMember: mappingEntry.imageMember,
          sourceSha256: converted.sourceSha256,
          outputSha256: converted.outputSha256,
          outputFileName,
          outputWidth: converted.outputWidth,
          outputHeight: converted.outputHeight,
          outputBytes: converted.outputBytes,
          imageUrl:
            `/images/palworld/${input.release}/map-icons/${outputFileName}`,
          sharedAssetReason: mappingEntry.sharedAssetReason
        };
      });
    const manifest = assertPalworldMapLayerIconManifest({
      schemaVersion: 2,
      release: input.release,
      kind: "map-layer-icons",
      status: "operator_acknowledged",
      sourceType: "operator_pak_export",
      sources: [
        {
          id: "content-map-assets",
          sourceType: "operator_pak_export",
          archiveSha256: PALWORLD_MAP_CONTENT_ARCHIVE_SHA256
        },
        {
          id: "inventory-item-icons",
          sourceType: "operator_inventory_item_icon_export",
          archiveSha256: PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256
        },
        {
          id: "blueprint-map-objects",
          sourceType: "operator_blueprint_export",
          archiveSha256: PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256
        }
      ],
      mappingSha256: PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256,
      usageBasis: "operator_reference_use",
      rightsVerified: false,
      entries: [...baseEntries, ...collectibleEntries]
    }, input.release);
    if (manifest.schemaVersion !== 2) fail("생성된 manifest schemaVersion이 2가 아닙니다.");
    if (
      JSON.stringify(manifest.entries.map((entry) => entry.id))
      !== JSON.stringify(PALWORLD_MAP_LAYER_ICON_IDS)
    ) {
      fail("생성된 manifest의 canonical entry 순서가 올바르지 않습니다.");
    }
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    if (input.publish) {
      for (const [fileName, bytes] of imageBytesByFile) {
        await writeContentHashAsset(input.assetRoot, fileName, bytes);
      }
      await writeManifestLast(input.releaseRoot, manifestBytes);
    }
    return {
      manifest,
      manifestSha256: sha256(manifestBytes),
      mappingSha256: PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256,
      published: input.publish,
      uniqueImportedImages: imageBytesByFile.size,
      statueImages: PALWORLD_MAP_STATUE_ICON_IDS.length,
      regionalEggTypes: PALWORLD_MAP_REGIONAL_EGG_ICON_IDS.length,
      sharedRegionalEggImages: 1
    };
  } finally {
    if (lockHandle) await lockHandle.close().catch(() => undefined);
    if (input.publish) await rm(lockPath, { force: true }).catch(() => undefined);
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

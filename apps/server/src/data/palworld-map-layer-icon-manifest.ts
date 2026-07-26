import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";

export const PALWORLD_MAP_LAYER_ICON_MANIFEST_FILE =
  "map-layer-icons-manifest.json";

export const PALWORLD_MAP_LAYER_ICON_V1_IDS = [
  "boss",
  "dungeon",
  "fast-travel",
  "npc",
  "treasure"
] as const;

export const PALWORLD_MAP_STATUE_ICON_IDS = [
  "statue-lifmunk",
  "statue-lamball",
  "statue-pengullet",
  "statue-munchill",
  "statue-rooby",
  "statue-herbil",
  "statue-tanzee",
  "statue-depresso",
  "statue-cattiva",
  "statue-lunaris",
  "statue-relaxaurus",
  "statue-yakumo"
] as const;

export const PALWORLD_MAP_REGIONAL_EGG_ICON_IDS = [
  "egg-grass",
  "egg-desert",
  "egg-glacier",
  "egg-volcanic",
  "egg-sakurajima",
  "egg-sky-island",
  "egg-tenraku",
  "egg-world-tree"
] as const;

export const PALWORLD_MAP_LAYER_ICON_IDS = [
  ...PALWORLD_MAP_LAYER_ICON_V1_IDS,
  ...PALWORLD_MAP_STATUE_ICON_IDS,
  ...PALWORLD_MAP_REGIONAL_EGG_ICON_IDS
] as const;

export type PalworldMapLayerIconId =
  (typeof PALWORLD_MAP_LAYER_ICON_IDS)[number];

export type PalworldMapLayerIconMappingStatus =
  | "exact_datatable_reference"
  | "verified_game_ui"
  | "representative_game_asset";

export type PalworldMapLayerIconEntryV1 = {
  id: (typeof PALWORLD_MAP_LAYER_ICON_V1_IDS)[number];
  mappingStatus: PalworldMapLayerIconMappingStatus;
  sourceReference: string;
  sourceMember: string;
  sourceSha256: string;
  outputSha256: string;
  outputFileName: string;
  outputWidth: number;
  outputHeight: number;
  outputBytes: number;
  imageUrl: string;
};

export type PalworldMapLayerIconEntryV2 = {
  id: PalworldMapLayerIconId;
  mappingStatus: PalworldMapLayerIconMappingStatus;
  sourceId:
    | "content-map-assets"
    | "inventory-item-icons";
  sourceReference: string;
  sourceMember: string;
  sourceSha256: string;
  outputSha256: string;
  outputFileName: string;
  outputWidth: number;
  outputHeight: number;
  outputBytes: number;
  imageUrl: string;
  sharedAssetReason: "regional_random_egg_unknown_icon" | null;
};

export type PalworldMapLayerIconManifestV1 = {
  schemaVersion: 1;
  release: string;
  kind: "map-layer-icons";
  status: "operator_acknowledged";
  sourceType: "operator_pak_export";
  sourceArchiveSha256: string;
  usageBasis: "operator_reference_use";
  rightsVerified: false;
  entries: PalworldMapLayerIconEntryV1[];
};

export type PalworldMapLayerIconManifestV2 = {
  schemaVersion: 2;
  release: string;
  kind: "map-layer-icons";
  status: "operator_acknowledged";
  sourceType: "operator_pak_export";
  sources: Array<{
    id:
      | "content-map-assets"
      | "inventory-item-icons"
      | "blueprint-map-objects";
    sourceType:
      | "operator_pak_export"
      | "operator_inventory_item_icon_export"
      | "operator_blueprint_export";
    archiveSha256: string;
  }>;
  mappingSha256: string;
  usageBasis: "operator_reference_use";
  rightsVerified: false;
  entries: PalworldMapLayerIconEntryV2[];
};

export type PalworldMapLayerIconManifest =
  | PalworldMapLayerIconManifestV1
  | PalworldMapLayerIconManifestV2;

const RELEASE_PATTERN =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CONTENT_HASH_WEBP_PATTERN = /^[a-f0-9]{64}\.webp$/u;
const MAX_MANIFEST_BYTES = 128 * 1024;
export const PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256 =
  "96c22dd91760b63477c2bf28f6af653d5561b5291e3a834aec3629b241d2337c";
export const PALWORLD_MAP_CONTENT_ARCHIVE_SHA256 =
  "1248184a4b527d947b5411940726d5b41fa0e212b355b7e4cc917821e0496384";
export const PALWORLD_MAP_INVENTORY_ICON_ARCHIVE_SHA256 =
  "6b06519e21dd00937e54d7ffcd9cba7948917bd4e76d34bffd65a53848fd7dc1";
export const PALWORLD_MAP_BLUEPRINT_ARCHIVE_SHA256 =
  "633316b83bec9d8d2a07fae7e76ba877cb794fcbe9ca2ea407f109b3e7ca066d";
export const PALWORLD_MAP_REGIONAL_EGG_SHARED_ASSET_REASON =
  "regional_random_egg_unknown_icon" as const;

const EXPECTED_MAPPINGS = {
  boss: {
    mappingStatus: "verified_game_ui",
    sourceReference: "Pal/Texture/UI/InGame/T_icon_compass_boss.png",
    sourceMember: "Pal/Texture/UI/InGame/T_icon_compass_boss.png",
    outputWidth: 64,
    outputHeight: 64
  },
  dungeon: {
    mappingStatus: "exact_datatable_reference",
    sourceReference: "DT_LocationUIData.PointDungeonPortal",
    sourceMember: "Pal/Texture/UI/InGame/T_icon_compass_dungeon.png",
    outputWidth: 64,
    outputHeight: 64
  },
  "fast-travel": {
    mappingStatus: "exact_datatable_reference",
    sourceReference: "DT_LocationUIData.PointFastTravel",
    sourceMember: "Pal/Texture/UI/InGame/T_icon_compass_FTtower.png",
    outputWidth: 100,
    outputHeight: 100
  },
  npc: {
    mappingStatus: "representative_game_asset",
    sourceReference: "Pal/Texture/PalIcon/NPC/T_BOSS_NPC_Male_Trader01.png",
    sourceMember: "Pal/Texture/PalIcon/NPC/T_BOSS_NPC_Male_Trader01.png",
    outputWidth: 128,
    outputHeight: 128
  },
  treasure: {
    mappingStatus: "exact_datatable_reference",
    sourceReference: "DT_LocationUIData.mapObjectIconMap.TreasureBox",
    sourceMember:
      "Pal/Texture/UI/InGame/T_icon_compass_Search_Treasure.png",
    outputWidth: 80,
    outputHeight: 80
  }
} as const satisfies Record<
  (typeof PALWORLD_MAP_LAYER_ICON_V1_IDS)[number],
  {
    mappingStatus: PalworldMapLayerIconMappingStatus;
    sourceReference: string;
    sourceMember: string;
    outputWidth: number;
    outputHeight: number;
  }
>;

type ExpectedV2Mapping = {
  mappingStatus: PalworldMapLayerIconMappingStatus;
  sourceId: PalworldMapLayerIconEntryV2["sourceId"];
  sourceReference: string;
  sourceMember: string;
  sourceSha256: string;
  outputWidth: number;
  outputHeight: number;
  sharedAssetReason: PalworldMapLayerIconEntryV2["sharedAssetReason"];
};

function collectibleMapping(
  id: (typeof PALWORLD_MAP_STATUE_ICON_IDS)[number],
  sourceMember: string,
  sourceSha256: string
): ExpectedV2Mapping {
  return {
    mappingStatus: "verified_game_ui",
    sourceId: "inventory-item-icons",
    sourceReference: `collectible-icon-map.${id}`,
    sourceMember,
    sourceSha256,
    outputWidth: 256,
    outputHeight: 256,
    sharedAssetReason: null
  };
}

const EXPECTED_V2_MAPPINGS: Readonly<
  Record<PalworldMapLayerIconId, ExpectedV2Mapping>
> = Object.freeze({
  ...Object.fromEntries(PALWORLD_MAP_LAYER_ICON_V1_IDS.map((id) => [
    id,
    {
      ...EXPECTED_MAPPINGS[id],
      sourceSha256: {
        boss: "205090e456062b2c02571da37080e5c3e2a175a154921151d3dd2d0eb9cf8a48",
        dungeon: "da94b71bae1203c4672b7c664dde9676ce118a294bd068caa8468a0fed6b8b96",
        "fast-travel": "d2a56d3c2e59d7ddb8b94b26268ea53be8a466ecc29e21d8e6014bc5ef93ab85",
        npc: "8a7d4adfa279a3a7e157e272decc7e9447687cec766ef645c0e929cda0af8ffe",
        treasure: "8a87fba89c8888dd70f95dc9a4ef3fe9e78bd94fcd0fbf2e063985cc181767a1"
      }[id],
      sourceId: "content-map-assets" as const,
      sharedAssetReason: null
    }
  ])),
  "statue-lifmunk": collectibleMapping(
    "statue-lifmunk",
    "Texture/T_itemicon_Relic.png",
    "757df8fa76ab711acfb4d607b47d815afc8a93306ecb04e773904509b1d50d32"
  ),
  "statue-lamball": collectibleMapping(
    "statue-lamball",
    "Texture/T_itemicon_Relic_01.png",
    "41087d47c1ad9a375935ef8010e8e89d8bab2a0099d8122c5d658f7f06f176df"
  ),
  "statue-pengullet": collectibleMapping(
    "statue-pengullet",
    "Texture/T_itemicon_Relic_02.png",
    "2414ea82ccf5fdab535c5366ea248a434416b2a9af96022aa85b9e396b0e8038"
  ),
  "statue-munchill": collectibleMapping(
    "statue-munchill",
    "Texture/T_itemicon_Relic_03.png",
    "bc723134999067fb753b3f7d95a2e6bb94df026c4ec74dd3939a60170718748a"
  ),
  "statue-rooby": collectibleMapping(
    "statue-rooby",
    "Texture/T_itemicon_Relic_04.png",
    "c9351b7f1b917fec667d265b25d31a9e7ec73c4fcc49f7cc91f5cc5d1bc7d5ff"
  ),
  "statue-herbil": collectibleMapping(
    "statue-herbil",
    "Texture/T_itemicon_Relic_05.png",
    "e9791262fa4a94bf08484efa044ead7d1cd2bd1b49f5e4da4d9b1003fded99dd"
  ),
  "statue-tanzee": collectibleMapping(
    "statue-tanzee",
    "Texture/T_itemicon_Relic_06.png",
    "7d448189ff539ff4954c63798ebe5b5c4804de28622abb4f42e577dd926459f7"
  ),
  "statue-depresso": collectibleMapping(
    "statue-depresso",
    "Texture/T_itemicon_Relic_07.png",
    "9437a09ad3b7ef11586a6a16fb81de632849c5ef362f92346efe42436003533a"
  ),
  "statue-cattiva": collectibleMapping(
    "statue-cattiva",
    "Texture/T_itemicon_Relic_08.png",
    "c548c3e33042644857bc2c8c64132b55bbb0a154b61c2b1e963794c3b8cd77e4"
  ),
  "statue-lunaris": collectibleMapping(
    "statue-lunaris",
    "Texture/T_itemicon_Relic_09.png",
    "fbeee4825111487a33ebc506faa7bcd02ecf82c4ef6b8f91aa734f377b470878"
  ),
  "statue-relaxaurus": collectibleMapping(
    "statue-relaxaurus",
    "Texture/T_itemicon_Relic_10.png",
    "f3468bafba7070fa942b28bbee4321d97ff5e21cd51f6f739076427c8f2f5b55"
  ),
  "statue-yakumo": collectibleMapping(
    "statue-yakumo",
    "Texture/T_itemicon_Relic_11.png",
    "c49cfcb565b465092cf0803df604d554df428ecb727818aeb4675f43d2714b12"
  ),
  ...Object.fromEntries(PALWORLD_MAP_REGIONAL_EGG_ICON_IDS.map((id) => [
    id,
    {
      mappingStatus: "representative_game_asset" as const,
      sourceId: "inventory-item-icons" as const,
      sourceReference: `collectible-icon-map.${id}`,
      sourceMember: "Texture/T_itemicon_Material_PalEgg_Unknown.png",
      sourceSha256: "f5bd5ca4b9fe95346b7d46443165e803a8e3135b08513fbe12dd4875baf89e43",
      outputWidth: 256,
      outputHeight: 256,
      sharedAssetReason: PALWORLD_MAP_REGIONAL_EGG_SHARED_ASSET_REASON
    }
  ]))
}) as Readonly<Record<PalworldMapLayerIconId, ExpectedV2Mapping>>;

function fail(pathName: string, message: string): never {
  throw new Error(`${pathName}: ${message}`);
}

function exactRecord(
  value: unknown,
  pathName: string,
  keys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function sha256At(value: unknown, pathName: string): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail(pathName, "소문자 64자리 SHA-256이어야 합니다.");
  }
  return value;
}

function integerAt(
  value: unknown,
  pathName: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number"
    || !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum}~${maximum} 범위의 정수여야 합니다.`);
  }
  return value;
}

function assertPalworldMapLayerIconManifestV1(
  value: unknown,
  expectedRelease?: string
): PalworldMapLayerIconManifestV1 {
  const root = exactRecord(value, "mapLayerIconsManifest", [
    "schemaVersion",
    "release",
    "kind",
    "status",
    "sourceType",
    "sourceArchiveSha256",
    "usageBasis",
    "rightsVerified",
    "entries"
  ]);
  if (root.schemaVersion !== 1) {
    fail("mapLayerIconsManifest.schemaVersion", "1이어야 합니다.");
  }
  if (
    typeof root.release !== "string"
    || !RELEASE_PATTERN.test(root.release)
    || (expectedRelease !== undefined && root.release !== expectedRelease)
  ) {
    fail("mapLayerIconsManifest.release", "active release와 일치해야 합니다.");
  }
  if (
    root.kind !== "map-layer-icons"
    || root.status !== "operator_acknowledged"
    || root.sourceType !== "operator_pak_export"
    || root.usageBasis !== "operator_reference_use"
    || root.rightsVerified !== false
  ) {
    fail(
      "mapLayerIconsManifest",
      "운영자 참조 사용 상태와 rightsVerified=false를 유지해야 합니다."
    );
  }
  const sourceArchiveSha256 = sha256At(
    root.sourceArchiveSha256,
    "mapLayerIconsManifest.sourceArchiveSha256"
  );
  if (
    !Array.isArray(root.entries)
    || root.entries.length !== PALWORLD_MAP_LAYER_ICON_V1_IDS.length
  ) {
    fail(
      "mapLayerIconsManifest.entries",
      `v1 지도 필터 아이콘 ${PALWORLD_MAP_LAYER_ICON_V1_IDS.length}종을 모두 포함해야 합니다.`
    );
  }

  const ids = new Set<(typeof PALWORLD_MAP_LAYER_ICON_V1_IDS)[number]>();
  const sourceMembers = new Set<string>();
  const outputSha256s = new Set<string>();
  const imageUrls = new Set<string>();
  const entries = root.entries.map((value, index) => {
    const pathName = `mapLayerIconsManifest.entries[${index}]`;
    const entry = exactRecord(value, pathName, [
      "id",
      "mappingStatus",
      "sourceReference",
      "sourceMember",
      "sourceSha256",
      "outputSha256",
      "outputFileName",
      "outputWidth",
      "outputHeight",
      "outputBytes",
      "imageUrl"
    ]);
    if (
      typeof entry.id !== "string"
      || !(PALWORLD_MAP_LAYER_ICON_V1_IDS as readonly string[]).includes(entry.id)
    ) {
      fail(`${pathName}.id`, "검증된 지도 필터 canonical ID여야 합니다.");
    }
    const id = entry.id as (typeof PALWORLD_MAP_LAYER_ICON_V1_IDS)[number];
    const expected = EXPECTED_MAPPINGS[id];
    if (
      entry.mappingStatus !== expected.mappingStatus
      || entry.sourceReference !== expected.sourceReference
      || entry.sourceMember !== expected.sourceMember
    ) {
      fail(
        pathName,
        "검증된 게임 UI source와 versioned semantic mapping에 일치해야 합니다."
      );
    }
    const sourceSha256 = sha256At(
      entry.sourceSha256,
      `${pathName}.sourceSha256`
    );
    const outputSha256 = sha256At(
      entry.outputSha256,
      `${pathName}.outputSha256`
    );
    if (
      typeof entry.outputFileName !== "string"
      || !CONTENT_HASH_WEBP_PATTERN.test(entry.outputFileName)
      || entry.outputFileName !== `${outputSha256}.webp`
    ) {
      fail(
        `${pathName}.outputFileName`,
        "실제 output SHA-256 기반 WebP 파일명이어야 합니다."
      );
    }
    const outputWidth = integerAt(
      entry.outputWidth,
      `${pathName}.outputWidth`,
      1,
      512
    );
    const outputHeight = integerAt(
      entry.outputHeight,
      `${pathName}.outputHeight`,
      1,
      512
    );
    if (
      outputWidth !== expected.outputWidth
      || outputHeight !== expected.outputHeight
    ) {
      fail(pathName, "검증된 원본 비율과 출력 크기를 유지해야 합니다.");
    }
    const outputBytes = integerAt(
      entry.outputBytes,
      `${pathName}.outputBytes`,
      20,
      512 * 1024
    );
    const expectedUrl =
      `/images/palworld/${root.release}/map-icons/${entry.outputFileName}`;
    if (entry.imageUrl !== expectedUrl) {
      fail(
        `${pathName}.imageUrl`,
        "active release의 map-icons content-hash URL이어야 합니다."
      );
    }
    if (
      ids.has(id)
      || sourceMembers.has(expected.sourceMember)
      || outputSha256s.has(outputSha256)
      || imageUrls.has(expectedUrl)
    ) {
      fail(
        pathName,
        "지도 필터 ID, source member, output hash 및 URL은 중복될 수 없습니다."
      );
    }
    ids.add(id);
    sourceMembers.add(expected.sourceMember);
    outputSha256s.add(outputSha256);
    imageUrls.add(expectedUrl);
    return {
      id,
      mappingStatus: expected.mappingStatus,
      sourceReference: expected.sourceReference,
      sourceMember: expected.sourceMember,
      sourceSha256,
      outputSha256,
      outputFileName: entry.outputFileName,
      outputWidth,
      outputHeight,
      outputBytes,
      imageUrl: expectedUrl
    };
  });
  if (
    JSON.stringify(entries.map((entry) => entry.id))
    !== JSON.stringify(PALWORLD_MAP_LAYER_ICON_V1_IDS)
  ) {
    fail(
      "mapLayerIconsManifest.entries",
      "canonical 지도 필터 ID 순으로 정렬해야 합니다."
    );
  }

  return Object.freeze({
    schemaVersion: 1,
    release: root.release,
    kind: "map-layer-icons",
    status: "operator_acknowledged",
    sourceType: "operator_pak_export",
    sourceArchiveSha256,
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    entries
  }) as PalworldMapLayerIconManifestV1;
}

function assertPalworldMapLayerIconManifestV2(
  value: unknown,
  expectedRelease?: string
): PalworldMapLayerIconManifestV2 {
  const root = exactRecord(value, "mapLayerIconsManifest", [
    "schemaVersion",
    "release",
    "kind",
    "status",
    "sourceType",
    "sources",
    "mappingSha256",
    "usageBasis",
    "rightsVerified",
    "entries"
  ]);
  if (root.schemaVersion !== 2) {
    fail("mapLayerIconsManifest.schemaVersion", "2여야 합니다.");
  }
  if (
    typeof root.release !== "string"
    || !RELEASE_PATTERN.test(root.release)
    || (expectedRelease !== undefined && root.release !== expectedRelease)
  ) {
    fail("mapLayerIconsManifest.release", "active release와 일치해야 합니다.");
  }
  if (
    root.kind !== "map-layer-icons"
    || root.status !== "operator_acknowledged"
    || root.sourceType !== "operator_pak_export"
    || root.usageBasis !== "operator_reference_use"
    || root.rightsVerified !== false
  ) {
    fail(
      "mapLayerIconsManifest",
      "운영자 참조 사용 상태와 rightsVerified=false를 유지해야 합니다."
    );
  }
  const expectedSources = [
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
  ] as const;
  if (
    !Array.isArray(root.sources)
    || root.sources.length !== expectedSources.length
  ) {
    fail(
      "mapLayerIconsManifest.sources",
      "고정된 지도·아이템 아이콘·Blueprint source 3종이 필요합니다."
    );
  }
  const sources = root.sources.map((value, index) => {
    const pathName = `mapLayerIconsManifest.sources[${index}]`;
    const source = exactRecord(value, pathName, [
      "id",
      "sourceType",
      "archiveSha256"
    ]);
    const expected = expectedSources[index]!;
    if (
      source.id !== expected.id
      || source.sourceType !== expected.sourceType
      || sha256At(source.archiveSha256, `${pathName}.archiveSha256`)
        !== expected.archiveSha256
    ) {
      fail(pathName, "고정된 source ID, 종류 및 archive SHA-256과 일치해야 합니다.");
    }
    return { ...expected };
  });
  if (
    sha256At(root.mappingSha256, "mapLayerIconsManifest.mappingSha256")
    !== PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256
  ) {
    fail(
      "mapLayerIconsManifest.mappingSha256",
      "검수된 collectible icon mapping checksum과 일치해야 합니다."
    );
  }
  if (
    !Array.isArray(root.entries)
    || root.entries.length !== PALWORLD_MAP_LAYER_ICON_IDS.length
  ) {
    fail(
      "mapLayerIconsManifest.entries",
      `검증된 지도 필터 아이콘 ${PALWORLD_MAP_LAYER_ICON_IDS.length}종을 모두 포함해야 합니다.`
    );
  }

  const ids = new Set<PalworldMapLayerIconId>();
  const uniqueSourceMembers = new Set<string>();
  const uniqueOutputSha256s = new Set<string>();
  const uniqueImageUrls = new Set<string>();
  const eggOutputKeys = new Set<string>();
  const entries = root.entries.map((value, index) => {
    const pathName = `mapLayerIconsManifest.entries[${index}]`;
    const entry = exactRecord(value, pathName, [
      "id",
      "mappingStatus",
      "sourceId",
      "sourceReference",
      "sourceMember",
      "sourceSha256",
      "outputSha256",
      "outputFileName",
      "outputWidth",
      "outputHeight",
      "outputBytes",
      "imageUrl",
      "sharedAssetReason"
    ]);
    if (
      typeof entry.id !== "string"
      || !(PALWORLD_MAP_LAYER_ICON_IDS as readonly string[]).includes(entry.id)
    ) {
      fail(`${pathName}.id`, "검증된 지도 필터 canonical ID여야 합니다.");
    }
    const id = entry.id as PalworldMapLayerIconId;
    const expected = EXPECTED_V2_MAPPINGS[id];
    if (
      entry.mappingStatus !== expected.mappingStatus
      || entry.sourceId !== expected.sourceId
      || entry.sourceReference !== expected.sourceReference
      || entry.sourceMember !== expected.sourceMember
      || entry.sharedAssetReason !== expected.sharedAssetReason
    ) {
      fail(
        pathName,
        "검증된 게임 source와 versioned semantic mapping에 일치해야 합니다."
      );
    }
    const sourceSha256 = sha256At(
      entry.sourceSha256,
      `${pathName}.sourceSha256`
    );
    if (sourceSha256 !== expected.sourceSha256) {
      fail(`${pathName}.sourceSha256`, "고정 PNG checksum과 일치해야 합니다.");
    }
    const outputSha256 = sha256At(
      entry.outputSha256,
      `${pathName}.outputSha256`
    );
    if (
      typeof entry.outputFileName !== "string"
      || !CONTENT_HASH_WEBP_PATTERN.test(entry.outputFileName)
      || entry.outputFileName !== `${outputSha256}.webp`
    ) {
      fail(
        `${pathName}.outputFileName`,
        "실제 output SHA-256 기반 WebP 파일명이어야 합니다."
      );
    }
    const outputWidth = integerAt(
      entry.outputWidth,
      `${pathName}.outputWidth`,
      1,
      512
    );
    const outputHeight = integerAt(
      entry.outputHeight,
      `${pathName}.outputHeight`,
      1,
      512
    );
    if (
      outputWidth !== expected.outputWidth
      || outputHeight !== expected.outputHeight
    ) {
      fail(pathName, "검증된 원본 비율과 출력 크기를 유지해야 합니다.");
    }
    const outputBytes = integerAt(
      entry.outputBytes,
      `${pathName}.outputBytes`,
      20,
      512 * 1024
    );
    const expectedUrl =
      `/images/palworld/${root.release}/map-icons/${entry.outputFileName}`;
    if (entry.imageUrl !== expectedUrl) {
      fail(
        `${pathName}.imageUrl`,
        "active release의 map-icons content-hash URL이어야 합니다."
      );
    }
    if (ids.has(id)) {
      fail(pathName, "지도 필터 ID는 중복될 수 없습니다.");
    }
    ids.add(id);
    const isRegionalEgg = (
      PALWORLD_MAP_REGIONAL_EGG_ICON_IDS as readonly string[]
    ).includes(id);
    const outputKey = [
      expected.sourceMember,
      sourceSha256,
      outputSha256,
      expectedUrl
    ].join(":");
    if (isRegionalEgg) {
      if (
        eggOutputKeys.size === 0
        && (
          uniqueSourceMembers.has(expected.sourceMember)
          || uniqueOutputSha256s.has(outputSha256)
          || uniqueImageUrls.has(expectedUrl)
        )
      ) {
        fail(pathName, "regional egg asset이 다른 지도 icon과 충돌합니다.");
      }
      eggOutputKeys.add(outputKey);
    } else if (
      uniqueSourceMembers.has(expected.sourceMember)
      || uniqueOutputSha256s.has(outputSha256)
      || uniqueImageUrls.has(expectedUrl)
    ) {
      fail(
        pathName,
        "regional egg 명시적 공유 외에는 source, output hash 및 URL 중복이 허용되지 않습니다."
      );
    }
    if (!isRegionalEgg) {
      uniqueSourceMembers.add(expected.sourceMember);
      uniqueOutputSha256s.add(outputSha256);
      uniqueImageUrls.add(expectedUrl);
    }
    return {
      id,
      mappingStatus: expected.mappingStatus,
      sourceId: expected.sourceId,
      sourceReference: expected.sourceReference,
      sourceMember: expected.sourceMember,
      sourceSha256,
      outputSha256,
      outputFileName: entry.outputFileName,
      outputWidth,
      outputHeight,
      outputBytes,
      imageUrl: expectedUrl,
      sharedAssetReason: expected.sharedAssetReason
    };
  });
  if (
    JSON.stringify(entries.map((entry) => entry.id))
    !== JSON.stringify(PALWORLD_MAP_LAYER_ICON_IDS)
  ) {
    fail(
      "mapLayerIconsManifest.entries",
      "canonical 지도 필터 ID 순으로 정렬해야 합니다."
    );
  }
  if (eggOutputKeys.size !== 1) {
    fail(
      "mapLayerIconsManifest.entries",
      "regional egg 8종은 검증된 Unknown egg asset 하나만 공유해야 합니다."
    );
  }

  return Object.freeze({
    schemaVersion: 2,
    release: root.release,
    kind: "map-layer-icons",
    status: "operator_acknowledged",
    sourceType: "operator_pak_export",
    sources,
    mappingSha256: PALWORLD_MAP_COLLECTIBLE_ICON_MAPPING_SHA256,
    usageBasis: "operator_reference_use",
    rightsVerified: false,
    entries
  }) as PalworldMapLayerIconManifestV2;
}

export function assertPalworldMapLayerIconManifest(
  value: unknown,
  expectedRelease?: string
): PalworldMapLayerIconManifest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("mapLayerIconsManifest", "객체여야 합니다.");
  }
  const schemaVersion = (value as Record<string, unknown>).schemaVersion;
  if (schemaVersion === 1) {
    return assertPalworldMapLayerIconManifestV1(value, expectedRelease);
  }
  if (schemaVersion === 2) {
    return assertPalworldMapLayerIconManifestV2(value, expectedRelease);
  }
  fail("mapLayerIconsManifest.schemaVersion", "1 또는 2여야 합니다.");
}

export async function loadPalworldMapLayerIconManifest(
  releaseRoot: string,
  expectedRelease: string
): Promise<PalworldMapLayerIconManifest> {
  const filePath = path.resolve(
    releaseRoot,
    PALWORLD_MAP_LAYER_ICON_MANIFEST_FILE
  );
  const before = await lstat(filePath);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size < 2
    || before.size > MAX_MANIFEST_BYTES
    || await realpath(filePath) !== filePath
  ) {
    fail(
      "mapLayerIconsManifest",
      "symlink가 아닌 안전한 크기의 canonical JSON이어야 합니다."
    );
  }
  const handle = await open(
    filePath,
    fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
    ) {
      fail("mapLayerIconsManifest", "검증 중 파일이 변경되었습니다.");
    }
    const manifest = assertPalworldMapLayerIconManifest(
      JSON.parse(await handle.readFile("utf8")) as unknown,
      expectedRelease
    );
    const after = await handle.stat();
    if (
      !after.isFile()
      || after.dev !== opened.dev
      || after.ino !== opened.ino
      || after.size !== opened.size
    ) {
      fail("mapLayerIconsManifest", "검증 중 파일이 변경되었습니다.");
    }
    return manifest;
  } finally {
    await handle.close();
  }
}

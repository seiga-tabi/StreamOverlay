import {
  assertPalworldDataSnapshot,
  type PalworldDataSnapshot,
  type PalworldPalDetail,
  type PalworldRuntimeGates
} from "@streamops/shared";
import {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  PALWORLD_PALDEX_EXPECTED_NORMAL_COUNT,
  PALWORLD_PALDEX_EXPECTED_VARIANT_COUNT,
  assertPalworldPaldexArtifact,
  type PalworldPaldexArtifact,
  type PalworldPaldexReleaseManifest
} from "./palworld-paldex-artifact.js";
import {
  loadPalworldPaldexRuntimeSource,
  type PalworldPaldexStagedRelease
} from "./palworld-paldex-loader.js";

export type PalworldDataIntegrityGate = {
  passed: true;
  status: "ready";
  counts: {
    pals: number;
    normal: number;
    variant: number;
    missingLocalizedNames: 0;
    missingRequiredStats: 0;
    missingBreedingPower: 0;
    unknownEnums: 0;
    idCollisions: 0;
    aliasCollisions: 0;
  };
  checksumsVerified: true;
};

export type PalworldImageAssetGate = PalworldRuntimeGates["imageAssets"];

export type PalworldPaldexAdapterResult = {
  snapshot: PalworldDataSnapshot;
  sourceInternalIds: Readonly<Record<string, string>>;
};

export type PalworldPaldexAdapterOptions = {
  activatedImageUrls?: Readonly<Record<string, string>>;
};

export type PalworldPaldexRuntimeRelease = PalworldPaldexAdapterResult & {
  dataIntegrityGate: PalworldDataIntegrityGate;
  imageAssetGate: PalworldImageAssetGate;
  manifest: PalworldPaldexReleaseManifest;
};

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value as object)) return value;
  seen.add(value as object);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function identifierAliases(id: string): string[] {
  const normalized = id.toLocaleLowerCase();
  return [...new Set([
    normalized,
    normalized.replaceAll("_", "-"),
    normalized.replaceAll("-", "_")
  ])];
}

function assertAliasIntegrity(artifact: PalworldPaldexArtifact): void {
  const aliases = new Map<string, string>();
  for (const record of artifact.records) {
    for (const alias of identifierAliases(record.id)) {
      const existing = aliases.get(alias);
      if (existing && existing !== record.id) {
        throw new TypeError(`Palworld ID alias가 충돌합니다: ${existing}, ${record.id}`);
      }
      aliases.set(alias, record.id);
    }
  }
}

export function adaptPalworldPaldexArtifact(
  artifact: PalworldPaldexArtifact,
  options: PalworldPaldexAdapterOptions = {}
): PalworldPaldexAdapterResult {
  const validatedArtifact = assertPalworldPaldexArtifact(artifact);
  assertAliasIntegrity(validatedArtifact);
  const metadata = { ...validatedArtifact.metadata };
  const sourceInternalIds: Record<string, string> = {};
  const pals: PalworldPalDetail[] = validatedArtifact.records.map((record) => {
    sourceInternalIds[record.id] = record.sourceInternalId;
    const activatedImageUrl = options.activatedImageUrls?.[record.id];
    if (activatedImageUrl !== undefined && activatedImageUrl !== record.imageUrl) {
      throw new TypeError(`Palworld 공개 이미지 mapping이 artifact와 일치하지 않습니다: ${record.id}`);
    }
    return {
      id: record.id,
      number: record.number,
      nameKo: record.nameKo,
      nameJa: record.nameJa,
      nameEn: record.nameEn,
      ...(activatedImageUrl === undefined ? {} : { imageUrl: activatedImageUrl }),
      elements: [...record.elements],
      rarity: record.rarity,
      variantType: record.variantType,
      workSuitabilities: record.workSuitabilities.map((work) => ({ ...work })),
      stats: { ...record.stats },
      nocturnal: record.nocturnal,
      activeSkills: [],
      drops: [],
      breeding: {
        breedingPower: record.breedingPower,
        specialParentPairs: []
      },
      metadata
    };
  });
  const snapshot = assertPalworldDataSnapshot({
    metadata,
    pals,
    items: [],
    breedingPairs: []
  });
  return deepFreeze({
    snapshot,
    sourceInternalIds
  });
}

function runtimeGates(release: Pick<
  PalworldPaldexStagedRelease,
  "dataIntegrityReady" | "manifest" | "runtimeImageAssetGate"
>): {
  dataIntegrityGate: PalworldDataIntegrityGate;
  imageAssetGate: PalworldImageAssetGate;
} {
  if (!release.dataIntegrityReady) {
    throw new TypeError("Palworld data integrity gate를 통과하지 못했습니다.");
  }
  const checks = release.manifest.dataIntegrityGate.checks;
  const normal = checks.normal;
  const variant = checks.variant;
  if (
    checks.pals !== PALWORLD_PALDEX_EXPECTED_COUNT
    || normal !== PALWORLD_PALDEX_EXPECTED_NORMAL_COUNT
    || variant !== PALWORLD_PALDEX_EXPECTED_VARIANT_COUNT
  ) {
    throw new TypeError("Palworld data integrity gate의 Pal 집계가 고정 release와 일치하지 않습니다.");
  }
  if (
    checks.missingNameKo !== 0
    || checks.missingNameJa !== 0
    || checks.missingNameEn !== 0
    || checks.missingRequiredStats !== 0
    || checks.missingBreedingPower !== 0
    || checks.unknownEnums !== 0
    || checks.idCollisions !== 0
    || checks.aliasCollisions !== 0
    || !checks.sourceChecksumVerified
    || !checks.mappingChecksumsVerified
    || !checks.artifactChecksumsVerified
  ) {
    throw new TypeError("Palworld data integrity gate의 필수 검증 항목이 준비되지 않았습니다.");
  }
  return {
    dataIntegrityGate: {
      passed: true,
      status: "ready",
      counts: {
        pals: checks.pals,
        normal,
        variant,
        missingLocalizedNames: 0,
        missingRequiredStats: 0,
        missingBreedingPower: 0,
        unknownEnums: 0,
        idCollisions: 0,
        aliasCollisions: 0
      },
      checksumsVerified: true
    },
    imageAssetGate: {
      ...release.runtimeImageAssetGate
    }
  };
}

export async function loadPalworldPaldexRuntimeRelease(options: {
  releaseRoot?: string;
  imageRoot?: string;
  mappingRoot?: string;
} = {}): Promise<PalworldPaldexRuntimeRelease> {
  const release = await loadPalworldPaldexRuntimeSource(options);
  const adapted = adaptPalworldPaldexArtifact(release.artifact, { activatedImageUrls: release.runtimeImageUrls });
  const gates = runtimeGates(release);
  return deepFreeze({
    ...adapted,
    ...gates,
    manifest: release.manifest
  });
}

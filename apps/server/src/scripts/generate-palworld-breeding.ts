import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { assertPalworldCatalogArtifact } from "../data/palworld-catalog-artifact.js";
import {
  PALWORLD_BREEDING_FILE,
  PALWORLD_BREEDING_MANIFEST_FILE,
  PALWORLD_BREEDING_RELEASE,
  PALWORLD_BREEDING_REPORT_FILE,
  assertPalworldBreedingArtifact,
  assertPalworldBreedingImportReport,
  assertPalworldBreedingManifest,
  breedingCounts,
  loadPalworldBreedingRuntimeSource,
  palworldBreedingSourceChecksumsSha256,
  type PalworldBreedingArtifact,
  type PalworldBreedingGender,
  type PalworldBreedingSpecialRule
} from "../data/palworld-breeding-artifact.js";
import {
  PALWORLD_PALDEX_MAPPING_ROOT,
  PALWORLD_PALDEX_RELEASE_ROOT,
  PALWORLD_PALDEX_SOURCE_CACHE_ROOT,
  assertPalworldPaldexSourceLock,
  deterministicJson,
  sha256Bytes,
  writeFileAtomic
} from "../data/palworld-paldex-import.js";
import {
  assertPalworldBreedingCatalogRuleConsistency,
  createPalworldBreedingSourceAliasResolver,
  loadPalworldBreedingSourceAliasSource,
  type PalworldBreedingSourceAliasArtifact
} from "../data/palworld-breeding-source-alias.js";
import {
  loadPalworldBreedingEligibilityCompatibility,
  verifyPalworldBreedingEligibilityCompatibility,
  type PalworldBreedingEligibilityCompatibilityArtifact
} from "../data/palworld-breeding-eligibility-compatibility.js";

const BREEDING_SOURCE_PATH = path.join(
  PALWORLD_PALDEX_RELEASE_ROOT,
  "../_imports/atlas-24181105/breeding.json"
);
const CATALOG_PATH = path.join(PALWORLD_PALDEX_RELEASE_ROOT, "catalog.json");
const CATALOG_MANIFEST_PATH = path.join(PALWORLD_PALDEX_RELEASE_ROOT, "catalog-manifest.json");
const EXPECTED_ATLAS_BREEDING_SHA256 = "dc39e4c8646eaa7f61573d832dcb854d31184713dfc815e0221dc83d947ae559";

type PublicIdMap = {
  version: number;
  release: string;
  entries: Array<{ sourceInternalId: string; publicId: string }>;
};

type AtlasPal = {
  id: string;
  tribe: string;
  breedingRank: number;
};

type PalCalcPal = {
  Id: { IsVariant: boolean };
  InternalName: string;
  BreedingPower: number;
  BreedingPowerPriority: number;
};

type PalCalcSource = {
  Version: string;
  Pals: PalCalcPal[];
  BreedingGenderProbability: Record<string, { MALE: number; FEMALE: number }>;
};

type AtlasBreedingSource = {
  sameSpeciesProducesSelf: boolean;
  uniquePairs: Array<{
    parentAId: string;
    parentBId: string;
    childId: string;
    parentAGender?: PalworldBreedingGender;
    parentBGender?: PalworldBreedingGender;
  }>;
};

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: 객체여야 합니다.`);
  return value as Record<string, unknown>;
}

function parsePublicIdMap(value: unknown): PublicIdMap {
  const root = requireObject(value, "public-id-map");
  if (root.version !== 1 || root.release !== PALWORLD_BREEDING_RELEASE || !Array.isArray(root.entries)) {
    throw new Error("public-id-map: 고정 release mapping 형식이 아닙니다.");
  }
  const entries = root.entries.map((raw, index) => {
    const entry = requireObject(raw, `public-id-map.entries[${index}]`);
    if (typeof entry.sourceInternalId !== "string" || typeof entry.publicId !== "string") {
      throw new Error(`public-id-map.entries[${index}]: ID가 올바르지 않습니다.`);
    }
    return { sourceInternalId: entry.sourceInternalId, publicId: entry.publicId };
  });
  if (
    entries.length !== 287
    || new Set(entries.map((entry) => entry.sourceInternalId)).size !== entries.length
    || new Set(entries.map((entry) => entry.publicId)).size !== entries.length
  ) {
    throw new Error("public-id-map: canonical Pal 287종 exact mapping이어야 합니다.");
  }
  return { version: 1, release: PALWORLD_BREEDING_RELEASE, entries };
}

function parseAtlasPals(value: unknown): AtlasPal[] {
  const root = requireObject(value, "atlas-pals");
  if (!Array.isArray(root.records)) throw new Error("atlas-pals.records: 배열이어야 합니다.");
  return root.records.map((raw, index) => {
    const record = requireObject(raw, `atlas-pals.records[${index}]`);
    if (
      typeof record.id !== "string"
      || typeof record.tribe !== "string"
      || !Number.isInteger(record.breedingRank)
    ) {
      throw new Error(`atlas-pals.records[${index}]: 교배 parameter가 올바르지 않습니다.`);
    }
    return { id: record.id, tribe: record.tribe, breedingRank: Number(record.breedingRank) };
  });
}

function parsePalCalc(value: unknown): PalCalcSource {
  const root = requireObject(value, "palcalc-db");
  if (typeof root.Version !== "string" || !Array.isArray(root.Pals)) {
    throw new Error("palcalc-db: Version과 Pals가 필요합니다.");
  }
  const genders = requireObject(root.BreedingGenderProbability, "palcalc-db.BreedingGenderProbability");
  const Pals = root.Pals.map((raw, index) => {
    const record = requireObject(raw, `palcalc-db.Pals[${index}]`);
    const id = requireObject(record.Id, `palcalc-db.Pals[${index}].Id`);
    if (
      typeof id.IsVariant !== "boolean"
      || typeof record.InternalName !== "string"
      || !Number.isInteger(record.BreedingPower)
      || !Number.isInteger(record.BreedingPowerPriority)
    ) {
      throw new Error(`palcalc-db.Pals[${index}]: 교배 parameter가 올바르지 않습니다.`);
    }
    return {
      Id: { IsVariant: id.IsVariant },
      InternalName: record.InternalName,
      BreedingPower: Number(record.BreedingPower),
      BreedingPowerPriority: Number(record.BreedingPowerPriority)
    };
  });
  const BreedingGenderProbability = Object.fromEntries(Object.entries(genders).map(([internalId, raw]) => {
    const entry = requireObject(raw, `palcalc-db.BreedingGenderProbability.${internalId}`);
    if (
      typeof entry.MALE !== "number"
      || !Number.isFinite(entry.MALE)
      || typeof entry.FEMALE !== "number"
      || !Number.isFinite(entry.FEMALE)
    ) {
      throw new Error(`palcalc-db.BreedingGenderProbability.${internalId}: 유한 확률이 필요합니다.`);
    }
    return [internalId, { MALE: entry.MALE, FEMALE: entry.FEMALE }];
  }));
  return { Version: root.Version, Pals, BreedingGenderProbability };
}

function parseBreedingSource(value: unknown): AtlasBreedingSource {
  const root = requireObject(value, "atlas-breeding");
  if (root.sameSpeciesProducesSelf !== true || !Array.isArray(root.uniquePairs)) {
    throw new Error("atlas-breeding: same-species 규칙과 uniquePairs가 필요합니다.");
  }
  const uniquePairs = root.uniquePairs.map((raw, index) => {
    const pair = requireObject(raw, `atlas-breeding.uniquePairs[${index}]`);
    for (const field of ["parentAId", "parentBId", "childId"] as const) {
      if (typeof pair[field] !== "string") throw new Error(`atlas-breeding.uniquePairs[${index}].${field}: ID가 필요합니다.`);
    }
    for (const field of ["parentAGender", "parentBGender"] as const) {
      if (pair[field] !== undefined && pair[field] !== "male" && pair[field] !== "female") {
        throw new Error(`atlas-breeding.uniquePairs[${index}].${field}: 성별 enum이 올바르지 않습니다.`);
      }
    }
    return {
      parentAId: pair.parentAId as string,
      parentBId: pair.parentBId as string,
      childId: pair.childId as string,
      ...(pair.parentAGender === undefined ? {} : { parentAGender: pair.parentAGender as PalworldBreedingGender }),
      ...(pair.parentBGender === undefined ? {} : { parentBGender: pair.parentBGender as PalworldBreedingGender })
    };
  });
  return { sameSpeciesProducesSelf: true, uniquePairs };
}

function normalizedRuleKey(rule: {
  parentAId: string;
  parentBId: string;
  childId: string;
  parentAGender?: PalworldBreedingGender;
  parentBGender?: PalworldBreedingGender;
}): string {
  if (rule.parentAId <= rule.parentBId) {
    return `${rule.parentAId}\0${rule.parentBId}\0${rule.childId}\0${rule.parentAGender ?? ""}\0${rule.parentBGender ?? ""}`;
  }
  return `${rule.parentBId}\0${rule.parentAId}\0${rule.childId}\0${rule.parentBGender ?? ""}\0${rule.parentAGender ?? ""}`;
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function buildRelease(
  sourceLockValue: unknown,
  atlasValue: unknown,
  palCalcValue: unknown,
  publicIdMapValue: unknown,
  atlasBreedingValue: unknown,
  catalogValue: unknown,
  breedingSourceAliases: PalworldBreedingSourceAliasArtifact,
  breedingEligibilityInput: {
    artifact: PalworldBreedingEligibilityCompatibilityArtifact;
    artifactBytes: Uint8Array;
    candidateBytes: Uint8Array;
    activePaldexBytes: Uint8Array;
    publicIdMapBytes: Uint8Array;
  },
  sourceChecksums: PalworldBreedingArtifact["metadata"]["sourceChecksums"]
): {
  artifactText: string;
  reportText: string;
  manifestText: string;
} {
  const sourceLock = assertPalworldPaldexSourceLock(sourceLockValue);
  const atlasPals = parseAtlasPals(atlasValue);
  const palCalc = parsePalCalc(palCalcValue);
  const publicIdMap = parsePublicIdMap(publicIdMapValue);
  const atlasBreeding = parseBreedingSource(atlasBreedingValue);
  const catalog = assertPalworldCatalogArtifact(catalogValue);
  const atlasSource = sourceLock.sources.find((source) => source.id === "atlas-pals")!;
  const palCalcSource = sourceLock.sources.find((source) => source.id === "palcalc-db")!;
  const atlasById = new Map(atlasPals.map((pal) => [pal.id, pal]));
  const palCalcById = new Map(palCalc.Pals.map((pal) => [pal.InternalName, pal]));
  const publicIdByInternalId = new Map(publicIdMap.entries.map((entry) => [entry.sourceInternalId, entry.publicId]));
  const breedingSourceAliasResolver =
    createPalworldBreedingSourceAliasResolver({
      artifact: breedingSourceAliases,
      sourceInternalIds: new Set(
        atlasBreeding.uniquePairs.flatMap((pair) => [
          pair.parentAId,
          pair.parentBId,
          pair.childId
        ])
      ),
      canonicalInternalIds: new Set(publicIdByInternalId.keys())
    });

  let parameters: PalworldBreedingArtifact["parameters"] =
    publicIdMap.entries.map(({ sourceInternalId, publicId }) => {
      const atlas = atlasById.get(sourceInternalId);
      const calc = palCalcById.get(sourceInternalId);
      const gender = palCalc.BreedingGenderProbability[sourceInternalId];
      if (!atlas || !calc || !gender) throw new Error(`${sourceInternalId}: 고정 source exact join에 실패했습니다.`);
      if (atlas.breedingRank !== calc.BreedingPower) {
        throw new Error(`${sourceInternalId}: Atlas와 PalCalc CombiRank가 다릅니다.`);
      }
      if (gender.MALE < 0 || gender.MALE > 1 || Math.abs(gender.MALE + gender.FEMALE - 1) > 0.000_001) {
        throw new Error(`${sourceInternalId}: 성별 확률이 올바르지 않습니다.`);
      }
      return {
        palId: publicId,
        sourceInternalId,
        tribe: atlas.tribe,
        combiRank: calc.BreedingPower,
        combiDuplicatePriority: calc.BreedingPowerPriority,
        maleProbability: gender.MALE,
        variantType: calc.Id.IsVariant ? "variant" as const : "normal" as const
      };
    }).sort((left, right) => codePointCompare(left.palId, right.palId));
  const eligibilityVerification =
    verifyPalworldBreedingEligibilityCompatibility({
      ...breedingEligibilityInput,
      activeParameters: parameters
    });
  const eligibilityOverride =
    eligibilityVerification.artifact.overrides[0];
  parameters = parameters.map((parameter) =>
    parameter.palId === eligibilityOverride.palId
      ? { ...parameter, ignoreCombi: true }
      : parameter
  );

  const unresolvedSourceInternalIds = new Set<string>();
  const specialRules: PalworldBreedingSpecialRule[] = [];
  const aliasCorrectedRuleKeys = new Set<string>();
  let unresolvedSourceRows = 0;
  for (const sourceRule of atlasBreeding.uniquePairs) {
    const parentASourceInternalId =
      breedingSourceAliasResolver.resolve(sourceRule.parentAId);
    const parentBSourceInternalId =
      breedingSourceAliasResolver.resolve(sourceRule.parentBId);
    const childSourceInternalId =
      breedingSourceAliasResolver.resolve(sourceRule.childId);
    const parentAId = publicIdByInternalId.get(parentASourceInternalId);
    const parentBId = publicIdByInternalId.get(parentBSourceInternalId);
    const childId = publicIdByInternalId.get(childSourceInternalId);
    if (!parentAId || !parentBId || !childId) {
      unresolvedSourceRows += 1;
      for (const sourceInternalId of [
        parentASourceInternalId,
        parentBSourceInternalId,
        childSourceInternalId
      ]) {
        if (!publicIdByInternalId.has(sourceInternalId)) unresolvedSourceInternalIds.add(sourceInternalId);
      }
      continue;
    }
    const rule = {
      parentAId,
      parentASourceInternalId,
      parentBId,
      parentBSourceInternalId,
      childId,
      childSourceInternalId,
      ...(sourceRule.parentAGender === undefined ? {} : { parentAGender: sourceRule.parentAGender }),
      ...(sourceRule.parentBGender === undefined ? {} : { parentBGender: sourceRule.parentBGender })
    };
    specialRules.push(rule);
    if (
      breedingSourceAliasResolver.has(sourceRule.parentAId)
      || breedingSourceAliasResolver.has(sourceRule.parentBId)
      || breedingSourceAliasResolver.has(sourceRule.childId)
    ) {
      aliasCorrectedRuleKeys.add(normalizedRuleKey(rule));
    }
  }
  specialRules.sort((left, right) =>
    codePointCompare(left.childId, right.childId)
    || codePointCompare(left.parentAId, right.parentAId)
    || codePointCompare(left.parentBId, right.parentBId)
    || codePointCompare(left.parentAGender ?? "", right.parentAGender ?? "")
    || codePointCompare(left.parentBGender ?? "", right.parentBGender ?? "")
  );

  const mappedNonSelfKeys = new Set(specialRules
    .filter((rule) => !(rule.parentAId === rule.parentBId && rule.parentAId === rule.childId))
    .map(normalizedRuleKey));
  const catalogKeys = new Set(catalog.specialBreedingPairs.map(normalizedRuleKey));
  const aliasCorrectedNonSelfKeys = new Set(
    [...aliasCorrectedRuleKeys].filter((key) => mappedNonSelfKeys.has(key))
  );
  assertPalworldBreedingCatalogRuleConsistency({
    sourceRuleKeys: mappedNonSelfKeys,
    catalogRuleKeys: catalogKeys,
    aliasCorrectedRuleKeys: aliasCorrectedNonSelfKeys
  });

  const artifact = assertPalworldBreedingArtifact({
    schemaVersion: 1,
    release: PALWORLD_BREEDING_RELEASE,
    metadata: {
      gameVersion: PALWORLD_BREEDING_RELEASE,
      steamBuildId: sourceLock.steamBuildId,
      sourceRevision:
        `atlas@${atlasSource.sourceRevision}`
        + `+palcalc@${palCalcSource.sourceRevision}`,
      sourceChecksums
    },
    parameters,
    specialRules
  });
  const counts = breedingCounts(artifact, unresolvedSourceRows);
  const total = artifact.parameters.length;
  const report = assertPalworldBreedingImportReport({
    schemaVersion: 1,
    release: PALWORLD_BREEDING_RELEASE,
    status: "incomplete",
    counts,
    fieldCoverage: {
      combiRank: { available: total, missing: 0, total },
      combiDuplicatePriority: { available: total, missing: 0, total },
      tribe: { available: total, missing: 0, total },
      maleProbability: { available: total, missing: 0, total },
      bpClass: { available: 0, missing: total, total },
      ignoreCombi: { available: 1, missing: total - 1, total },
      sourceRowId: { available: 0, missing: total, total }
    },
    unresolvedSourceInternalIds: [...unresolvedSourceInternalIds].sort(),
    limitations: [
      "BPCLASS_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE",
      "IGNORE_COMBI_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE",
      "SOURCE_ROW_ID_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE"
    ]
  }, artifact);
  const artifactText = deterministicJson(artifact);
  const reportText = deterministicJson(report);
  const manifest = assertPalworldBreedingManifest({
    schemaVersion: 1,
    release: PALWORLD_BREEDING_RELEASE,
    generatedAt: sourceLock.artifactTimestamp,
    breedingSha256: sha256Bytes(Buffer.from(artifactText, "utf8")),
    reportSha256: sha256Bytes(Buffer.from(reportText, "utf8")),
    sourceChecksumsSha256:
      palworldBreedingSourceChecksumsSha256(artifact.metadata.sourceChecksums),
    counts,
    runtimeActivation: true
  });
  return {
    artifactText,
    reportText,
    manifestText: deterministicJson(manifest)
  };
}

const sourceLockBytes = await readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "sources.lock.json"));
const sourceLock = assertPalworldPaldexSourceLock(JSON.parse(sourceLockBytes.toString("utf8")) as unknown);
const atlasSource = sourceLock.sources.find((source) => source.id === "atlas-pals")!;
const palCalcSource = sourceLock.sources.find((source) => source.id === "palcalc-db")!;
const breedingEligibilityCompatibility =
  await loadPalworldBreedingEligibilityCompatibility();
const candidateBreedingPath = path.join(
  PALWORLD_PALDEX_RELEASE_ROOT,
  "../candidates",
  breedingEligibilityCompatibility.artifact.candidate.directory,
  PALWORLD_BREEDING_FILE
);
const [
  atlasBytes,
  palCalcBytes,
  publicIdMapBytes,
  atlasBreedingBytes,
  catalogBytes,
  catalogManifestBytes,
  breedingSourceAliasSource,
  candidateBreedingBytes,
  activePaldexBytes
] = await Promise.all([
  readFile(path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, "atlas-pals.json")),
  readFile(path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, "palcalc-db.json")),
  readFile(path.join(PALWORLD_PALDEX_MAPPING_ROOT, "public-id-map.json")),
  readFile(BREEDING_SOURCE_PATH),
  readFile(CATALOG_PATH),
  readFile(CATALOG_MANIFEST_PATH),
  loadPalworldBreedingSourceAliasSource(),
  readFile(candidateBreedingPath),
  readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"))
]);
if (atlasBytes.length !== atlasSource.bytes || sha256Bytes(atlasBytes) !== atlasSource.sha256) {
  throw new Error("Atlas source checksum이 sources.lock.json과 일치하지 않습니다.");
}
if (palCalcBytes.length !== palCalcSource.bytes || sha256Bytes(palCalcBytes) !== palCalcSource.sha256) {
  throw new Error("PalCalc source checksum이 sources.lock.json과 일치하지 않습니다.");
}
if (sha256Bytes(atlasBreedingBytes) !== EXPECTED_ATLAS_BREEDING_SHA256) {
  throw new Error("Atlas breeding source checksum이 고정 checksum과 일치하지 않습니다.");
}
const catalogManifest = requireObject(JSON.parse(catalogManifestBytes.toString("utf8")) as unknown, "catalog-manifest");
if (
  catalogManifest.release !== PALWORLD_BREEDING_RELEASE
  || typeof catalogManifest.catalogSha256 !== "string"
  || catalogManifest.catalogSha256 !== sha256Bytes(catalogBytes)
) {
  throw new Error("catalog checksum이 catalog-manifest.json과 일치하지 않습니다.");
}

const inputs = [
  JSON.parse(sourceLockBytes.toString("utf8")) as unknown,
  JSON.parse(atlasBytes.toString("utf8")) as unknown,
  JSON.parse(palCalcBytes.toString("utf8")) as unknown,
  JSON.parse(publicIdMapBytes.toString("utf8")) as unknown,
  JSON.parse(atlasBreedingBytes.toString("utf8")) as unknown,
  JSON.parse(catalogBytes.toString("utf8")) as unknown,
  breedingSourceAliasSource.artifact,
  {
    artifact: breedingEligibilityCompatibility.artifact,
    artifactBytes: breedingEligibilityCompatibility.bytes,
    candidateBytes: candidateBreedingBytes,
    activePaldexBytes,
    publicIdMapBytes
  },
  {
    atlasPals: atlasSource.sha256,
    atlasBreeding: EXPECTED_ATLAS_BREEDING_SHA256,
    palCalc: palCalcSource.sha256,
    catalog: catalogManifest.catalogSha256,
    breedingSourceAliases: sha256Bytes(breedingSourceAliasSource.bytes),
    breedingEligibilityCompatibility:
      sha256Bytes(breedingEligibilityCompatibility.bytes),
    candidateBreeding: sha256Bytes(candidateBreedingBytes)
  } satisfies PalworldBreedingArtifact["metadata"]["sourceChecksums"]
] as const;
const first = buildRelease(...inputs);
const second = buildRelease(...inputs);
if (
  first.artifactText !== second.artifactText
  || first.reportText !== second.reportText
  || first.manifestText !== second.manifestText
) {
  throw new Error("동일 입력의 교배 artifact가 byte-for-byte 결정적이지 않습니다.");
}

const stagingRoot = await mkdtemp(path.join(path.dirname(PALWORLD_PALDEX_RELEASE_ROOT), ".breeding-staging-"));
try {
  await writeFileAtomic(path.join(stagingRoot, PALWORLD_BREEDING_FILE), first.artifactText);
  await writeFileAtomic(path.join(stagingRoot, PALWORLD_BREEDING_REPORT_FILE), first.reportText);
  await writeFileAtomic(path.join(stagingRoot, PALWORLD_BREEDING_MANIFEST_FILE), first.manifestText);
  const staged = await loadPalworldBreedingRuntimeSource(stagingRoot);
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, PALWORLD_BREEDING_FILE), first.artifactText);
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, PALWORLD_BREEDING_REPORT_FILE), first.reportText);
  await writeFileAtomic(path.join(PALWORLD_PALDEX_RELEASE_ROOT, PALWORLD_BREEDING_MANIFEST_FILE), first.manifestText);
  console.log(
    `[palworld-breeding] Pal ${staged.manifest.counts.parameters}종, `
    + `특수 규칙 ${staged.manifest.counts.includedSpecialRows}개, `
    + `미해결 source ${staged.manifest.counts.unresolvedSourceRows}개를 검증해 활성화했습니다.`
  );
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}

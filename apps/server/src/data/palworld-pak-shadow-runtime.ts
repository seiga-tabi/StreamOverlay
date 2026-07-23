import {
  PALWORLD_ELEMENTS,
  assertPalworldDataSnapshot,
  assertPalworldPakCandidateArtifact,
  type PalworldDataCoverage,
  type PalworldDataMetadata,
  type PalworldDataSnapshot,
  type PalworldDomainCoverageMap,
  type PalworldRuntimeGates,
  type PalworldTranslationDisplayStatus
} from "@streamops/shared";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import {
  assertPalworldPakBlockedCandidateManifest,
  assertPalworldPakRuntimeManifest,
  validatePalworldPakCandidateStagingRoot,
  type PalworldPakRuntimeDomain,
  type PalworldPakRuntimeManifest,
  type PalworldPakRuntimeArtifactKind
} from "./palworld-pak-runtime-manifest.js";
import type {
  PalworldPakSnapshotAdapterResult
} from "./palworld-pak-snapshot-adapter.js";
import { PalworldDataService } from "../services/palworld-data.js";

const REQUIRED_SHADOW_DOMAINS = [
  "pals",
  "items",
  "skills",
  "breeding",
  "localizationKo",
  "localizationJa",
  "localizationEn"
] as const satisfies readonly PalworldPakRuntimeDomain[];

const SOURCE_INTERNAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/u;
const SHADOW_ARTIFACT_MAX_BYTES = 256 * 1024 * 1024;

type PalworldPakShadowAdapterResult = Pick<
  PalworldPakSnapshotAdapterResult,
  "snapshot" | "domains" | "gates" | "coverage" | "sourceInternalIds" | "report"
>;

export class PalworldPakShadowRuntimeError extends Error {
  readonly code:
    | "PALWORLD_PAK_SHADOW_CANDIDATE_BLOCKED"
    | "PALWORLD_PAK_SHADOW_MANIFEST_INVALID"
    | "PALWORLD_PAK_SHADOW_DATA_NOT_READY"
    | "PALWORLD_PAK_SHADOW_IDENTITY_MISMATCH"
    | "PALWORLD_PAK_SHADOW_SNAPSHOT_INVALID";

  constructor(
    code: PalworldPakShadowRuntimeError["code"],
    message: string
  ) {
    super(message);
    this.name = "PalworldPakShadowRuntimeError";
    this.code = code;
  }
}

export type PalworldPakShadowRuntime = Readonly<{
  manifest: PalworldPakRuntimeManifest;
  service: PalworldDataService;
}>;

function fail(
  code: PalworldPakShadowRuntimeError["code"],
  message: string
): never {
  throw new PalworldPakShadowRuntimeError(code, message);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function coverageCount(available: number, total: number) {
  return { available, missing: total - available, total };
}

function translatedStatusAvailable(
  status: PalworldTranslationDisplayStatus | undefined
): boolean {
  return status === "source_provided"
    || status === "human_reviewed"
    || status === "machine_assisted";
}

function deriveTranslationCoverage(
  snapshot: PalworldDataSnapshot,
  locale: "ko" | "ja"
): PalworldDataCoverage["translations"] extends infer T
  ? T extends Record<"ko", infer U> ? U : never
  : never {
  const fields = [
    ...snapshot.pals.flatMap((pal) => [
      ["palNames", pal.translation?.name?.[locale]] as const,
      ["palDescriptions", pal.translation?.description?.[locale]] as const
    ]),
    ...snapshot.items.flatMap((item) => [
      ["itemNames", item.translation?.name?.[locale]] as const,
      ["itemDescriptions", item.translation?.description?.[locale]] as const
    ]),
    ...(snapshot.skills ?? []).flatMap((skill) => [
      ["skillNames", skill.translation?.name?.[locale]] as const,
      ["skillDescriptions", skill.translation?.description?.[locale]] as const,
      ["skillPassiveAbilities", skill.translation?.passiveAbility?.[locale]] as const
    ])
  ];
  const fieldCoverage = (
    field: (typeof fields)[number][0],
    total: number
  ) => coverageCount(
    fields.filter(([candidate, status]) =>
      candidate === field && translatedStatusAvailable(status)
    ).length,
    total
  );
  const statuses = fields
    .map(([, status]) => status)
    .filter((status): status is PalworldTranslationDisplayStatus =>
      status !== undefined
    );
  const availableTotal = statuses.filter(translatedStatusAvailable).length;
  const fieldTotal = snapshot.pals.length * 2
    + snapshot.items.length * 2
    + (snapshot.skills?.length ?? 0) * 3;
  return {
    palNames: fieldCoverage("palNames", snapshot.pals.length),
    palDescriptions: fieldCoverage("palDescriptions", snapshot.pals.length),
    itemNames: fieldCoverage("itemNames", snapshot.items.length),
    itemDescriptions: fieldCoverage("itemDescriptions", snapshot.items.length),
    skillNames: fieldCoverage("skillNames", snapshot.skills?.length ?? 0),
    skillDescriptions: fieldCoverage(
      "skillDescriptions",
      snapshot.skills?.length ?? 0
    ),
    skillPassiveAbilities: fieldCoverage(
      "skillPassiveAbilities",
      snapshot.skills?.length ?? 0
    ),
    sourceProvided: statuses.filter((status) => status === "source_provided").length,
    humanReviewed: statuses.filter((status) => status === "human_reviewed").length,
    machineAssisted: statuses.filter((status) => status === "machine_assisted").length,
    sourceLanguageFallback: fieldTotal - availableTotal,
    missingSource: statuses.filter((status) => status === "missing_source").length,
    placeholderExcluded: 0,
    unresolvedRichText: 0,
    staleSourceHash: 0
  };
}

function deriveSnapshotCoverage(
  snapshot: PalworldDataSnapshot
): PalworldDataCoverage {
  const skills = snapshot.skills ?? [];
  const localizedTotal = snapshot.pals.length + snapshot.items.length + skills.length;
  return {
    palDetails: coverageCount(snapshot.pals.length, snapshot.pals.length),
    itemDetails: coverageCount(snapshot.items.length, snapshot.items.length),
    skillDetails: coverageCount(skills.length, skills.length),
    palDescriptions: coverageCount(
      snapshot.pals.filter((pal) =>
        pal.descriptionKo !== undefined
        || pal.descriptionJa !== undefined
        || pal.descriptionEn !== undefined
      ).length,
      snapshot.pals.length
    ),
    palStats: coverageCount(snapshot.pals.length, snapshot.pals.length),
    partnerSkills: coverageCount(
      snapshot.pals.filter((pal) => pal.partnerSkill !== undefined).length,
      snapshot.pals.length
    ),
    activeSkills: coverageCount(
      snapshot.pals.filter((pal) => pal.activeSkills.length > 0).length,
      snapshot.pals.length
    ),
    palDrops: coverageCount(
      snapshot.pals.filter((pal) => pal.drops.length > 0).length,
      snapshot.pals.length
    ),
    breedingFields: coverageCount(snapshot.pals.length, snapshot.pals.length),
    itemDescriptions: coverageCount(
      snapshot.items.filter((item) =>
        item.descriptionKo !== undefined
        || item.descriptionJa !== undefined
        || item.descriptionEn !== undefined
      ).length,
      snapshot.items.length
    ),
    craftingRecipes: coverageCount(
      snapshot.items.filter((item) => (item.recipes?.length ?? 0) > 0).length,
      snapshot.items.length
    ),
    craftingFacilities: coverageCount(
      snapshot.items.filter((item) => item.craftingFacility !== undefined).length,
      snapshot.items.length
    ),
    dropPals: coverageCount(
      snapshot.items.filter((item) => item.dropPals.length > 0).length,
      snapshot.items.length
    ),
    technologyLevels: coverageCount(
      snapshot.items.filter((item) => item.technologyLevel !== undefined).length,
      snapshot.items.length
    ),
    prices: coverageCount(
      snapshot.items.filter((item) => item.sellPrice !== undefined).length,
      snapshot.items.length
    ),
    durability: coverageCount(
      snapshot.items.filter((item) => item.durability !== undefined).length,
      snapshot.items.length
    ),
    acquisitionMethods: coverageCount(
      snapshot.items.filter((item) => item.acquisitionMethods.length > 0).length,
      snapshot.items.length
    ),
    skillDescriptions: coverageCount(
      skills.filter((skill) =>
        skill.descriptionKo !== undefined
        || skill.descriptionJa !== undefined
        || skill.descriptionEn !== undefined
      ).length,
      skills.length
    ),
    relatedPals: coverageCount(
      skills.filter((skill) => skill.relatedPals.length > 0).length,
      skills.length
    ),
    palImages: coverageCount(
      snapshot.pals.filter((pal) => pal.imageUrl !== undefined).length,
      snapshot.pals.length
    ),
    itemImages: coverageCount(
      snapshot.items.filter((item) => item.imageUrl !== undefined).length,
      snapshot.items.length
    ),
    elementImages: coverageCount(
      (snapshot.elements ?? []).filter((element) => element.iconUrl !== undefined).length,
      PALWORLD_ELEMENTS.length
    ),
    localization: {
      ko: coverageCount(
        snapshot.pals.filter((pal) => pal.nameKo !== undefined).length
          + snapshot.items.filter((item) => item.nameKo !== undefined).length
          + skills.filter((skill) => skill.nameKo !== undefined).length,
        localizedTotal
      ),
      ja: coverageCount(
        snapshot.pals.filter((pal) => pal.nameJa !== undefined).length
          + snapshot.items.filter((item) => item.nameJa !== undefined).length
          + skills.filter((skill) => skill.nameJa !== undefined).length,
        localizedTotal
      ),
      en: coverageCount(localizedTotal, localizedTotal)
    },
    translations: {
      ko: deriveTranslationCoverage(snapshot, "ko"),
      ja: deriveTranslationCoverage(snapshot, "ja")
    }
  };
}

function cloneSnapshot(value: unknown): PalworldDataSnapshot {
  try {
    return assertPalworldDataSnapshot(structuredClone(value));
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "snapshot 검증에 실패했습니다.";
    fail(
      "PALWORLD_PAK_SHADOW_SNAPSHOT_INVALID",
      `operator PAK shadow snapshot이 Shared schema를 통과하지 못했습니다. ${message}`
    );
  }
}

function assertMetadataIdentity(
  metadata: PalworldDataMetadata,
  manifest: PalworldPakRuntimeManifest,
  pathName: string
): void {
  if (
    metadata.gameVersion !== manifest.gameVersion
    || metadata.sourceRevision !== manifest.source.importRevision
    || metadata.sourceChecksum !== manifest.source.archiveSha256
    || metadata.sourceName !== "operator_provided_pak_export"
    || metadata.license !== manifest.source.license
    || metadata.rightsVerified !== false
  ) {
    fail(
      "PALWORLD_PAK_SHADOW_IDENTITY_MISMATCH",
      `${pathName}의 release·source revision·checksum·권리 상태가 runtime manifest와 일치하지 않습니다.`
    );
  }
}

function assertDomainIdentity(
  domains: PalworldDomainCoverageMap,
  manifest: PalworldPakRuntimeManifest
): void {
  const expectedCounts = {
    pals: manifest.counts.pals,
    items: manifest.counts.items,
    skills: manifest.counts.skills,
    breeding: manifest.counts.breedingResults
  };
  for (const domain of ["pals", "items", "skills", "breeding"] as const) {
    const value = domains[domain];
    if (
      value === undefined
      || value.status !== "ready"
      || value.recordCount !== expectedCounts[domain]
    ) {
      fail(
        "PALWORLD_PAK_SHADOW_DATA_NOT_READY",
        `${domain} domain의 ready 상태 또는 record count가 runtime manifest와 일치하지 않습니다.`
      );
    }
    assertMetadataIdentity(value.metadata, manifest, `domains.${domain}.metadata`);
  }
}

function assertSourceInternalIds(
  value: Readonly<Record<string, string>>,
  snapshot: PalworldDataSnapshot
): Readonly<Record<string, string>> {
  const palIds = new Set(snapshot.pals.map((pal) => pal.id));
  const sourceIds = new Set<string>();
  const result: Record<string, string> = {};
  for (const [palId, sourceInternalId] of Object.entries(value)) {
    if (
      !palIds.has(palId)
      || !SOURCE_INTERNAL_ID_PATTERN.test(sourceInternalId)
      || sourceIds.has(sourceInternalId)
    ) {
      fail(
        "PALWORLD_PAK_SHADOW_SNAPSHOT_INVALID",
        "sourceInternalIds는 canonical Pal과 중복 없이 exact join되어야 합니다."
      );
    }
    sourceIds.add(sourceInternalId);
    result[palId] = sourceInternalId;
  }
  if (Object.keys(result).length !== snapshot.pals.length) {
    fail(
      "PALWORLD_PAK_SHADOW_SNAPSHOT_INVALID",
      "모든 공개 Pal에 검증된 sourceInternalId가 필요합니다."
    );
  }
  return Object.freeze(result);
}

function parseReadyManifest(value: unknown): PalworldPakRuntimeManifest {
  const candidate = record(value);
  if (candidate?.activationEligible === false) {
    try {
      const blocked = assertPalworldPakBlockedCandidateManifest(value);
      fail(
        "PALWORLD_PAK_SHADOW_CANDIDATE_BLOCKED",
        `blocked candidate는 shadow API에 로드할 수 없습니다: ${blocked.blockers.join(", ")}`
      );
    } catch (error) {
      if (error instanceof PalworldPakShadowRuntimeError) throw error;
      const message = error instanceof Error
        ? error.message
        : "blocked candidate manifest 검증에 실패했습니다.";
      fail(
        "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
        `blocked candidate manifest가 올바르지 않습니다. ${message}`
      );
    }
  }
  let manifest: PalworldPakRuntimeManifest;
  try {
    manifest = assertPalworldPakRuntimeManifest(value);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "runtime manifest 검증에 실패했습니다.";
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      `operator PAK runtime manifest가 올바르지 않습니다. ${message}`
    );
  }
  for (const domain of REQUIRED_SHADOW_DOMAINS) {
    if (manifest.activation[domain] !== "ready") {
      fail(
        "PALWORLD_PAK_SHADOW_DATA_NOT_READY",
        `${domain} activation gate가 ready 상태가 아닙니다.`
      );
    }
  }
  const pendingDomain = Object.entries(manifest.activation)
    .find(([, state]) => state === "candidate")?.[0];
  if (pendingDomain !== undefined) {
    fail(
      "PALWORLD_PAK_SHADOW_DATA_NOT_READY",
      `${pendingDomain} activation gate가 아직 candidate 상태입니다.`
    );
  }
  return manifest;
}

function cloneRuntimeOptions(adapted: PalworldPakShadowAdapterResult): {
  domains: PalworldDomainCoverageMap;
  gates: PalworldRuntimeGates;
  coverage: PalworldDataCoverage;
} {
  return {
    domains: structuredClone(adapted.domains),
    gates: structuredClone(adapted.gates),
    coverage: structuredClone(adapted.coverage)
  };
}

async function readVerifiedArtifact(input: {
  stagingRoot: string;
  artifact: PalworldPakRuntimeManifest["artifacts"][number];
}): Promise<Buffer> {
  const filePath = path.resolve(
    input.stagingRoot,
    ...input.artifact.file.split("/")
  );
  if (!filePath.startsWith(`${input.stagingRoot}${path.sep}`)) {
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      "runtime artifact 경로가 staging root 밖으로 벗어났습니다."
    );
  }
  const before = await lstat(filePath);
  if (
    before.isSymbolicLink()
    || !before.isFile()
    || before.size !== input.artifact.bytes
    || before.size < 1
    || before.size > SHADOW_ARTIFACT_MAX_BYTES
    || await realpath(filePath) !== filePath
  ) {
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      `${input.artifact.kind} artifact가 canonical regular file이 아니거나 크기가 일치하지 않습니다.`
    );
  }
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== before.dev
      || opened.ino !== before.ino
      || opened.size !== before.size
    ) {
      fail(
        "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
        `${input.artifact.kind} artifact가 검증 중 변경되었습니다.`
      );
    }
    const bytes = await handle.readFile();
    if (
      createHash("sha256").update(bytes).digest("hex")
      !== input.artifact.sha256
    ) {
      fail(
        "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
        `${input.artifact.kind} artifact checksum이 runtime manifest와 일치하지 않습니다.`
      );
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function parseJson(bytes: Buffer, pathName: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      `${pathName} artifact가 올바른 JSON이 아닙니다.`
    );
  }
}

function artifactOf(
  manifest: PalworldPakRuntimeManifest,
  kind: PalworldPakRuntimeArtifactKind
): PalworldPakRuntimeManifest["artifacts"][number] {
  const artifact = manifest.artifacts.find((entry) => entry.kind === kind);
  if (artifact === undefined) {
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      `${kind} artifact가 runtime manifest에 없습니다.`
    );
  }
  return artifact;
}

function sourceInternalIdsFromPaldex(
  value: unknown,
  manifest: PalworldPakRuntimeManifest
): Readonly<Record<string, string>> {
  let paldex: Readonly<Record<string, unknown>>;
  try {
    paldex = assertPalworldPakCandidateArtifact("paldex.json", value, {
      candidateId: `candidate-${manifest.source.archiveSha256.slice(0, 16)}`,
      release: manifest.release
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "paldex artifact 검증에 실패했습니다.";
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      `paldex artifact에서 sourceInternalId를 읽을 수 없습니다. ${message}`
    );
  }
  if (!Array.isArray(paldex.records)) {
    fail(
      "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
      "paldex.records가 배열이 아닙니다."
    );
  }
  const result: Record<string, string> = {};
  for (const [index, raw] of paldex.records.entries()) {
    const entry = record(raw);
    if (
      entry === undefined
      || typeof entry.id !== "string"
      || typeof entry.sourceInternalId !== "string"
      || Object.hasOwn(result, entry.id)
    ) {
      fail(
        "PALWORLD_PAK_SHADOW_MANIFEST_INVALID",
        `paldex.records[${index}]의 canonical ID와 sourceInternalId가 올바르지 않습니다.`
      );
    }
    result[entry.id] = entry.sourceInternalId;
  }
  return Object.freeze(result);
}

function runtimeOptionsFromSnapshot(
  snapshot: PalworldDataSnapshot,
  manifest: PalworldPakRuntimeManifest,
  sourceInternalIds: Readonly<Record<string, string>>
): PalworldPakShadowAdapterResult {
  const metadata = snapshot.metadata;
  const coverage = deriveSnapshotCoverage(snapshot);
  return {
    snapshot,
    domains: {
      pals: {
        status: "ready",
        recordCount: snapshot.pals.length,
        metadata: { ...metadata }
      },
      items: {
        status: "ready",
        recordCount: snapshot.items.length,
        metadata: { ...metadata }
      },
      skills: {
        status: "ready",
        recordCount: snapshot.skills?.length ?? 0,
        metadata: { ...metadata }
      },
      breeding: {
        status: "ready",
        recordCount: snapshot.breedingPairs.length,
        metadata: { ...metadata }
      }
    },
    gates: {
      dataIntegrity: { passed: true, status: "ready" },
      imageAssets: {
        status: "blocked_by_license",
        policyStatus: "missing",
        technicalPassed: false,
        publicActivationAllowed: false,
        rightsVerified: false,
        usageBasis: "none",
        readyImages: 0,
        fallbackPals: snapshot.pals.length,
        publicNoticeRequired: true
      }
    },
    coverage,
    sourceInternalIds,
    report: {
      resolvedActiveAssignments: snapshot.pals.reduce(
        (count, pal) => count + pal.activeSkills.length,
        0
      ),
      excludedActiveAssignments: 0,
      unresolvedActiveAssignments: 0,
      resolvedSpecialBreedingRules: manifest.counts.specialBreedingRules,
      excludedSpecialBreedingRows: 0,
      duplicateSpecialBreedingRows: 0,
      unresolvedSpecialBreedingRows: 0,
      technicalPalImages: manifest.coverage.palImages.available,
      technicalItemImages: manifest.coverage.itemImages.available,
      technicalElementImages: manifest.coverage.elementImages.available,
      technicalWorkImages: manifest.coverage.workImages.available,
      technicalSkillImages: manifest.coverage.skillImages.available,
      technicalMapImages: manifest.coverage.map.available,
      publicPalImages: 0,
      publicItemImages: 0,
      fallbackPals: snapshot.pals.length,
      fallbackItems: snapshot.items.length,
      fallbackElements: PALWORLD_ELEMENTS.length,
      fallbackWorkSuitabilities: 12,
      fallbackSkills: snapshot.skills?.length ?? 0,
      fallbackMap: 1
    }
  };
}

/**
 * 운영 active pointer와 완전히 분리된 operator PAK 공개 API 검증용 runtime입니다.
 *
 * 검증된 ready manifest와 adapter 결과를 메모리에서만 결합하며 active-manifest.json,
 * 기존 release artifact 및 정적 이미지를 읽거나 변경하지 않습니다.
 */
export function loadPalworldPakShadowRuntime(input: {
  manifest: unknown;
  adapted: PalworldPakShadowAdapterResult;
}): PalworldPakShadowRuntime {
  const manifest = parseReadyManifest(input.manifest);
  const snapshot = cloneSnapshot(input.adapted?.snapshot);
  const runtime = cloneRuntimeOptions(input.adapted);

  assertMetadataIdentity(snapshot.metadata, manifest, "snapshot.metadata");
  assertDomainIdentity(runtime.domains, manifest);
  if (!runtime.gates.dataIntegrity.passed || runtime.gates.dataIntegrity.status !== "ready") {
    fail(
      "PALWORLD_PAK_SHADOW_DATA_NOT_READY",
      "operator PAK data integrity gate가 ready 상태가 아닙니다."
    );
  }
  if (runtime.gates.imageAssets.rightsVerified !== manifest.source.rightsVerified) {
    fail(
      "PALWORLD_PAK_SHADOW_IDENTITY_MISMATCH",
      "image rights gate와 source manifest의 권리 상태가 일치하지 않습니다."
    );
  }
  if (
    snapshot.pals.length !== manifest.counts.pals
    || snapshot.items.length !== manifest.counts.items
    || (snapshot.skills?.length ?? 0) !== manifest.counts.skills
    || snapshot.breedingPairs.length !== manifest.counts.breedingResults
    || input.adapted.report.resolvedSpecialBreedingRules
      !== manifest.counts.specialBreedingRules
  ) {
    fail(
      "PALWORLD_PAK_SHADOW_IDENTITY_MISMATCH",
      "snapshot과 runtime manifest의 domain count가 일치하지 않습니다."
    );
  }
  if (
    input.adapted.report.unresolvedActiveAssignments !== 0
    || input.adapted.report.unresolvedSpecialBreedingRows !== 0
  ) {
    fail(
      "PALWORLD_PAK_SHADOW_DATA_NOT_READY",
      "공개 active skill 또는 특수 교배 참조가 unresolved 상태입니다."
    );
  }

  const sourceInternalIds = assertSourceInternalIds(
    input.adapted.sourceInternalIds,
    snapshot
  );
  let service: PalworldDataService;
  try {
    service = new PalworldDataService(snapshot, {
      domains: runtime.domains,
      gates: runtime.gates,
      coverage: runtime.coverage,
      sourceInternalIds,
      useSnapshotBreedingPairs: true
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "PalworldDataService 생성에 실패했습니다.";
    fail(
      "PALWORLD_PAK_SHADOW_SNAPSHOT_INVALID",
      `operator PAK shadow service 검증에 실패했습니다. ${message}`
    );
  }
  return Object.freeze({ manifest, service });
}

/**
 * 검증된 ready staging root의 snapshot artifact를 checksum과 Shared schema로 다시
 * 읽어 shadow 공개 API service를 구성합니다.
 */
export async function loadPalworldPakShadowRuntimeFromStagingRoot(input: {
  stagingRoot: string;
}): Promise<PalworldPakShadowRuntime> {
  const stagingRoot = path.resolve(input.stagingRoot);
  const validated = await validatePalworldPakCandidateStagingRoot({
    stagingRoot
  });
  const snapshotArtifact = artifactOf(validated.manifest, "snapshot");
  const paldexArtifact = artifactOf(validated.manifest, "paldex");
  const [snapshotBytes, paldexBytes] = await Promise.all([
    readVerifiedArtifact({ stagingRoot, artifact: snapshotArtifact }),
    readVerifiedArtifact({ stagingRoot, artifact: paldexArtifact })
  ]);
  const snapshot = cloneSnapshot(parseJson(snapshotBytes, "snapshot"));
  const sourceInternalIds = sourceInternalIdsFromPaldex(
    parseJson(paldexBytes, "paldex"),
    validated.manifest
  );
  return loadPalworldPakShadowRuntime({
    manifest: validated.manifest,
    adapted: runtimeOptionsFromSnapshot(
      snapshot,
      validated.manifest,
      sourceInternalIds
    )
  });
}

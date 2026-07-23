import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type {
  PalworldBreedingDataSnapshot as SharedPalworldBreedingDataSnapshot,
  PalworldBreedingGender as SharedPalworldBreedingGender,
  PalworldBreedingPalParameters as SharedPalworldBreedingPalParameters,
  PalworldBreedingSpecialRule as SharedPalworldBreedingSpecialRule
} from "@streamops/shared";

export const PALWORLD_BREEDING_SCHEMA_VERSION = 1;
export const PALWORLD_BREEDING_RELEASE = "1.0.1";
export const PALWORLD_BREEDING_FILE = "breeding.json";
export const PALWORLD_BREEDING_MANIFEST_FILE = "breeding-manifest.json";
export const PALWORLD_BREEDING_REPORT_FILE = "breeding-import-report.json";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const GENDERS = new Set(["male", "female"]);
const VARIANT_TYPES = new Set(["normal", "variant"]);
const LIMITATIONS = new Set([
  "BPCLASS_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE",
  "IGNORE_COMBI_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE",
  "SOURCE_ROW_ID_NOT_AVAILABLE_IN_LOCKED_COMPACT_SOURCE"
]);

export type PalworldBreedingGender = SharedPalworldBreedingGender;
export type PalworldBreedingPalParameter = SharedPalworldBreedingPalParameters;
export type PalworldBreedingSpecialRule = SharedPalworldBreedingSpecialRule;
export type PalworldBreedingArtifact = SharedPalworldBreedingDataSnapshot;

export type PalworldBreedingCounts = {
  parameters: number;
  sourceSpecialRows: number;
  includedSpecialRows: number;
  includedSelfRules: number;
  includedNonSelfRules: number;
  genderedRules: number;
  unresolvedSourceRows: number;
};

export type PalworldBreedingManifest = {
  schemaVersion: 1;
  release: string;
  generatedAt: string;
  breedingSha256: string;
  reportSha256: string;
  counts: PalworldBreedingCounts;
  runtimeActivation: boolean;
};

export type PalworldBreedingImportReport = {
  schemaVersion: 1;
  release: string;
  status: "incomplete";
  counts: PalworldBreedingCounts;
  fieldCoverage: {
    combiRank: { available: number; missing: number; total: number };
    combiDuplicatePriority: { available: number; missing: number; total: number };
    tribe: { available: number; missing: number; total: number };
    maleProbability: { available: number; missing: number; total: number };
    bpClass: { available: 0; missing: number; total: number };
    ignoreCombi: { available: 0; missing: number; total: number };
    sourceRowId: { available: 0; missing: number; total: number };
  };
  unresolvedSourceInternalIds: string[];
  limitations: string[];
};

export type PalworldBreedingRuntimeSource = {
  artifact: PalworldBreedingArtifact;
  manifest: PalworldBreedingManifest;
  report: PalworldBreedingImportReport;
};

export class PalworldBreedingArtifactError extends Error {
  readonly code = "PALWORLD_BREEDING_ARTIFACT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldBreedingArtifactError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldBreedingArtifactError(`${pathName}: ${message}`);
}

function recordAt(
  value: unknown,
  pathName: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = []
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(pathName, "객체여야 합니다.");
  const record = value as Record<string, unknown>;
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of requiredKeys) {
    if (!(key in record)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function stringAt(value: unknown, pathName: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > maxLength || value.includes("\0")) {
    fail(pathName, `비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function publicIdAt(value: unknown, pathName: string): string {
  const id = stringAt(value, pathName, 128);
  if (!PUBLIC_ID_PATTERN.test(id)) fail(pathName, "소문자 kebab-case public ID여야 합니다.");
  return id;
}

function internalIdAt(value: unknown, pathName: string): string {
  const id = stringAt(value, pathName, 128);
  if (!INTERNAL_ID_PATTERN.test(id)) fail(pathName, "영문·숫자·_로 구성된 source internal ID여야 합니다.");
  return id;
}

function integerAt(value: unknown, pathName: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    fail(pathName, `${min}~${max} 정수여야 합니다.`);
  }
  return value as number;
}

function finiteAt(value: unknown, pathName: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(pathName, `${min}~${max} 유한 숫자여야 합니다.`);
  }
  return value;
}

function shaAt(value: unknown, pathName: string): string {
  const sha = stringAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(sha)) fail(pathName, "소문자 SHA-256이어야 합니다.");
  return sha;
}

function arrayAt(value: unknown, pathName: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) fail(pathName, `최대 ${maxLength}개 배열이어야 합니다.`);
  return value;
}

function isoAt(value: unknown, pathName: string): string {
  const text = stringAt(value, pathName, 64);
  if (!Number.isFinite(Date.parse(text))) fail(pathName, "ISO 날짜여야 합니다.");
  return text;
}

function genderAt(value: unknown, pathName: string): PalworldBreedingGender {
  if (!GENDERS.has(String(value))) fail(pathName, "male 또는 female이어야 합니다.");
  return value as PalworldBreedingGender;
}

function conditionKey(rule: PalworldBreedingSpecialRule): string {
  if (rule.parentAId < rule.parentBId) {
    return `${rule.parentAId}\0${rule.parentBId}\0${rule.parentAGender ?? ""}\0${rule.parentBGender ?? ""}`;
  }
  return `${rule.parentBId}\0${rule.parentAId}\0${rule.parentBGender ?? ""}\0${rule.parentAGender ?? ""}`;
}

function pairKey(rule: PalworldBreedingSpecialRule): string {
  return rule.parentAId < rule.parentBId
    ? `${rule.parentAId}\0${rule.parentBId}`
    : `${rule.parentBId}\0${rule.parentAId}`;
}

function conditionsOverlap(left: PalworldBreedingSpecialRule, right: PalworldBreedingSpecialRule): boolean {
  const orient = (rule: PalworldBreedingSpecialRule) => rule.parentAId <= rule.parentBId
    ? [rule.parentAGender, rule.parentBGender] as const
    : [rule.parentBGender, rule.parentAGender] as const;
  const [leftA, leftB] = orient(left);
  const [rightA, rightB] = orient(right);
  return (leftA === undefined || rightA === undefined || leftA === rightA)
    && (leftB === undefined || rightB === undefined || leftB === rightB);
}

export function assertPalworldBreedingArtifact(value: unknown): PalworldBreedingArtifact {
  const root = recordAt(value, "breeding", ["schemaVersion", "release", "metadata", "parameters", "specialRules"]);
  if (root.schemaVersion !== PALWORLD_BREEDING_SCHEMA_VERSION) fail("breeding.schemaVersion", "1이어야 합니다.");
  const release = stringAt(root.release, "breeding.release", 64);
  const metadata = recordAt(root.metadata, "breeding.metadata", [
    "gameVersion",
    "steamBuildId",
    "sourceRevision",
    "sourceChecksums"
  ], ["sourceType"]);
  if (stringAt(metadata.gameVersion, "breeding.metadata.gameVersion", 64) !== release) {
    fail("breeding.metadata.gameVersion", "release와 일치해야 합니다.");
  }
  stringAt(metadata.steamBuildId, "breeding.metadata.steamBuildId", 64);
  stringAt(metadata.sourceRevision, "breeding.metadata.sourceRevision", 512);
  if (
    metadata.sourceType !== undefined
    && metadata.sourceType !== "legacy_catalog"
    && metadata.sourceType !== "operator_pak_export"
  ) {
    fail("breeding.metadata.sourceType", "허용된 교배 원본 종류가 아닙니다.");
  }
  const checksumFields = metadata.sourceType === "operator_pak_export"
    ? ["archive", "breedingArtifact"] as const
    : ["atlasPals", "atlasBreeding", "palCalc", "catalog"] as const;
  const checksums = recordAt(
    metadata.sourceChecksums,
    "breeding.metadata.sourceChecksums",
    checksumFields
  );
  for (const field of checksumFields) {
    shaAt(checksums[field], `breeding.metadata.sourceChecksums.${field}`);
  }

  const parameters: PalworldBreedingPalParameter[] = [];
  const palIds = new Set<string>();
  const internalIds = new Set<string>();
  let previousPalId = "";
  for (const [index, raw] of arrayAt(root.parameters, "breeding.parameters", 10_000).entries()) {
    const pathName = `breeding.parameters[${index}]`;
    const record = recordAt(raw, pathName, [
      "palId",
      "sourceInternalId",
      "tribe",
      "combiRank",
      "combiDuplicatePriority",
      "maleProbability",
      "variantType"
    ], ["sourceRowId", "bpClass", "ignoreCombi"]);
    const palId = publicIdAt(record.palId, `${pathName}.palId`);
    const sourceRowId = record.sourceRowId === undefined
      ? undefined
      : internalIdAt(record.sourceRowId, `${pathName}.sourceRowId`);
    const sourceInternalId = internalIdAt(record.sourceInternalId, `${pathName}.sourceInternalId`);
    const tribe = internalIdAt(record.tribe, `${pathName}.tribe`);
    const bpClass = record.bpClass === undefined
      ? undefined
      : internalIdAt(record.bpClass, `${pathName}.bpClass`);
    const combiRank = integerAt(record.combiRank, `${pathName}.combiRank`, 1, 1_000_000);
    const combiDuplicatePriority = integerAt(
      record.combiDuplicatePriority,
      `${pathName}.combiDuplicatePriority`,
      0,
      1_000_000_000
    );
    const ignoreCombi = record.ignoreCombi === undefined
      ? undefined
      : record.ignoreCombi;
    if (ignoreCombi !== undefined && typeof ignoreCombi !== "boolean") {
      fail(`${pathName}.ignoreCombi`, "boolean이어야 합니다.");
    }
    const maleProbability = finiteAt(record.maleProbability, `${pathName}.maleProbability`, 0, 1);
    if (!VARIANT_TYPES.has(String(record.variantType))) {
      fail(`${pathName}.variantType`, "normal 또는 variant여야 합니다.");
    }
    if (previousPalId >= palId) fail(`${pathName}.palId`, "중복 없이 public ID 순서로 정렬되어야 합니다.");
    if (palIds.has(palId) || internalIds.has(sourceInternalId)) fail(pathName, "Pal 또는 source internal ID가 중복됩니다.");
    previousPalId = palId;
    palIds.add(palId);
    internalIds.add(sourceInternalId);
    parameters.push({
      palId,
      ...(sourceRowId === undefined ? {} : { sourceRowId }),
      sourceInternalId,
      tribe,
      ...(bpClass === undefined ? {} : { bpClass }),
      combiRank,
      combiDuplicatePriority,
      ...(ignoreCombi === undefined ? {} : { ignoreCombi }),
      maleProbability,
      variantType: record.variantType as "normal" | "variant"
    });
  }
  if (parameters.length < 1) fail("breeding.parameters", "최소 한 개 Pal parameter가 필요합니다.");
  const parametersById = new Map(parameters.map((parameter) => [parameter.palId, parameter]));

  const specialRules: PalworldBreedingSpecialRule[] = [];
  const conditionKeys = new Set<string>();
  let previousRuleKey = "";
  for (const [index, raw] of arrayAt(root.specialRules, "breeding.specialRules", 10_000).entries()) {
    const pathName = `breeding.specialRules[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(pathName, "객체여야 합니다.");
    const rawRecord = raw as Record<string, unknown>;
    const requiredKeys = [
      "parentAId",
      "parentASourceInternalId",
      "parentBId",
      "parentBSourceInternalId",
      "childId",
      "childSourceInternalId"
    ];
    const allowedKeys = [...requiredKeys, "parentAGender", "parentBGender"];
    for (const key of Object.keys(rawRecord)) if (!allowedKeys.includes(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
    for (const key of requiredKeys) if (!(key in rawRecord)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
    const rule: PalworldBreedingSpecialRule = {
      parentAId: publicIdAt(rawRecord.parentAId, `${pathName}.parentAId`),
      parentASourceInternalId: internalIdAt(rawRecord.parentASourceInternalId, `${pathName}.parentASourceInternalId`),
      parentBId: publicIdAt(rawRecord.parentBId, `${pathName}.parentBId`),
      parentBSourceInternalId: internalIdAt(rawRecord.parentBSourceInternalId, `${pathName}.parentBSourceInternalId`),
      childId: publicIdAt(rawRecord.childId, `${pathName}.childId`),
      childSourceInternalId: internalIdAt(rawRecord.childSourceInternalId, `${pathName}.childSourceInternalId`),
      ...(rawRecord.parentAGender === undefined ? {} : {
        parentAGender: genderAt(rawRecord.parentAGender, `${pathName}.parentAGender`)
      }),
      ...(rawRecord.parentBGender === undefined ? {} : {
        parentBGender: genderAt(rawRecord.parentBGender, `${pathName}.parentBGender`)
      })
    };
    for (const [idField, sourceField] of [
      ["parentAId", "parentASourceInternalId"],
      ["parentBId", "parentBSourceInternalId"],
      ["childId", "childSourceInternalId"]
    ] as const) {
      const parameter = parametersById.get(rule[idField]);
      if (!parameter) fail(`${pathName}.${idField}`, "존재하지 않는 canonical Pal 참조입니다.");
      if (parameter.sourceInternalId !== rule[sourceField]) {
        fail(`${pathName}.${sourceField}`, "canonical Pal의 source internal ID와 일치해야 합니다.");
      }
    }
    const orderKey = `${rule.childId}\0${rule.parentAId}\0${rule.parentBId}\0${rule.parentAGender ?? ""}\0${rule.parentBGender ?? ""}`;
    if (previousRuleKey >= orderKey) fail(pathName, "중복 없이 결정적 순서로 정렬되어야 합니다.");
    previousRuleKey = orderKey;
    const normalizedCondition = conditionKey(rule);
    if (conditionKeys.has(normalizedCondition)) fail(pathName, "동일한 부모·성별 조건이 중복됩니다.");
    conditionKeys.add(normalizedCondition);
    specialRules.push(rule);
  }
  const rulesByPair = new Map<string, PalworldBreedingSpecialRule[]>();
  for (const rule of specialRules) {
    const key = pairKey(rule);
    rulesByPair.set(key, [...(rulesByPair.get(key) ?? []), rule]);
  }
  for (const [key, rules] of rulesByPair) {
    for (let left = 0; left < rules.length; left += 1) {
      for (let right = left + 1; right < rules.length; right += 1) {
        if (conditionsOverlap(rules[left]!, rules[right]!)) {
          fail("breeding.specialRules", `겹치는 성별 조건이 있습니다: ${key}`);
        }
      }
    }
  }
  const excludedChildren = new Set(
    specialRules
      .filter((rule) => !(rule.parentAId === rule.parentBId && rule.parentAId === rule.childId))
      .map((rule) => rule.childId)
  );
  if (parameters.every((parameter) => excludedChildren.has(parameter.palId))) {
    fail("breeding.specialRules", "일반 교배 결과 후보를 모두 제외할 수 없습니다.");
  }
  const eligibleKeys = new Set<string>();
  for (const parameter of parameters) {
    if (excludedChildren.has(parameter.palId)) continue;
    const key = `${parameter.combiRank}\0${parameter.combiDuplicatePriority}\0${parameter.variantType}`;
    if (eligibleKeys.has(key)) fail("breeding.parameters", "일반 교배 동률 규칙으로 결정할 수 없는 Pal parameter가 있습니다.");
    eligibleKeys.add(key);
  }
  return value as PalworldBreedingArtifact;
}

function countsAt(value: unknown, pathName: string): PalworldBreedingCounts {
  const record = recordAt(value, pathName, [
    "parameters",
    "sourceSpecialRows",
    "includedSpecialRows",
    "includedSelfRules",
    "includedNonSelfRules",
    "genderedRules",
    "unresolvedSourceRows"
  ]);
  const result = Object.fromEntries(Object.keys(record).map((key) => [
    key,
    integerAt(record[key], `${pathName}.${key}`, 0, 1_000_000)
  ])) as PalworldBreedingCounts;
  if (result.includedSpecialRows !== result.includedSelfRules + result.includedNonSelfRules) {
    fail(pathName, "includedSpecialRows는 self와 non-self 합계여야 합니다.");
  }
  if (result.sourceSpecialRows !== result.includedSpecialRows + result.unresolvedSourceRows) {
    fail(pathName, "sourceSpecialRows는 포함·미해결 합계여야 합니다.");
  }
  if (result.genderedRules > result.includedNonSelfRules) fail(`${pathName}.genderedRules`, "non-self 규칙 수보다 클 수 없습니다.");
  return result;
}

function sameCounts(left: PalworldBreedingCounts, right: PalworldBreedingCounts): boolean {
  return (Object.keys(left) as Array<keyof PalworldBreedingCounts>).every((key) => left[key] === right[key]);
}

export function breedingCounts(artifact: PalworldBreedingArtifact, unresolvedSourceRows: number): PalworldBreedingCounts {
  const includedSelfRules = artifact.specialRules.filter((rule) =>
    rule.parentAId === rule.parentBId && rule.parentAId === rule.childId
  ).length;
  return {
    parameters: artifact.parameters.length,
    sourceSpecialRows: artifact.specialRules.length + unresolvedSourceRows,
    includedSpecialRows: artifact.specialRules.length,
    includedSelfRules,
    includedNonSelfRules: artifact.specialRules.length - includedSelfRules,
    genderedRules: artifact.specialRules.filter((rule) =>
      rule.parentAGender !== undefined || rule.parentBGender !== undefined
    ).length,
    unresolvedSourceRows
  };
}

export function assertPalworldBreedingManifest(value: unknown): PalworldBreedingManifest {
  const root = recordAt(value, "breedingManifest", [
    "schemaVersion",
    "release",
    "generatedAt",
    "breedingSha256",
    "reportSha256",
    "counts",
    "runtimeActivation"
  ]);
  if (root.schemaVersion !== 1) fail("breedingManifest.schemaVersion", "1이어야 합니다.");
  stringAt(root.release, "breedingManifest.release", 64);
  isoAt(root.generatedAt, "breedingManifest.generatedAt");
  shaAt(root.breedingSha256, "breedingManifest.breedingSha256");
  shaAt(root.reportSha256, "breedingManifest.reportSha256");
  countsAt(root.counts, "breedingManifest.counts");
  if (root.runtimeActivation !== true) fail("breedingManifest.runtimeActivation", "검증된 artifact는 true여야 합니다.");
  return value as PalworldBreedingManifest;
}

function coverageAt(
  value: unknown,
  pathName: string,
  expected: { available: number; missing: number; total: number }
): void {
  const record = recordAt(value, pathName, ["available", "missing", "total"]);
  const actual = {
    available: integerAt(record.available, `${pathName}.available`, 0, 1_000_000),
    missing: integerAt(record.missing, `${pathName}.missing`, 0, 1_000_000),
    total: integerAt(record.total, `${pathName}.total`, 0, 1_000_000)
  };
  if (actual.available + actual.missing !== actual.total) fail(pathName, "available과 missing 합이 total이어야 합니다.");
  if (
    actual.available !== expected.available
    || actual.missing !== expected.missing
    || actual.total !== expected.total
  ) {
    fail(pathName, "artifact의 실제 field coverage와 일치하지 않습니다.");
  }
}

export function assertPalworldBreedingImportReport(
  value: unknown,
  artifact: PalworldBreedingArtifact
): PalworldBreedingImportReport {
  const root = recordAt(value, "breedingReport", [
    "schemaVersion",
    "release",
    "status",
    "counts",
    "fieldCoverage",
    "unresolvedSourceInternalIds",
    "limitations"
  ]);
  if (root.schemaVersion !== 1 || root.release !== artifact.release || root.status !== "incomplete") {
    fail("breedingReport", "고정 release의 incomplete report여야 합니다.");
  }
  const counts = countsAt(root.counts, "breedingReport.counts");
  const expectedCounts = breedingCounts(artifact, counts.unresolvedSourceRows);
  if (!sameCounts(counts, expectedCounts)) fail("breedingReport.counts", "artifact의 실제 수량과 일치하지 않습니다.");
  const coverage = recordAt(root.fieldCoverage, "breedingReport.fieldCoverage", [
    "combiRank",
    "combiDuplicatePriority",
    "tribe",
    "maleProbability",
    "bpClass",
    "ignoreCombi",
    "sourceRowId"
  ]);
  const total = artifact.parameters.length;
  for (const field of ["combiRank", "combiDuplicatePriority", "tribe", "maleProbability"] as const) {
    coverageAt(coverage[field], `breedingReport.fieldCoverage.${field}`, { available: total, missing: 0, total });
  }
  for (const field of ["bpClass", "ignoreCombi", "sourceRowId"] as const) {
    coverageAt(coverage[field], `breedingReport.fieldCoverage.${field}`, { available: 0, missing: total, total });
  }
  const unresolved = arrayAt(root.unresolvedSourceInternalIds, "breedingReport.unresolvedSourceInternalIds", 10_000)
    .map((entry, index) => internalIdAt(entry, `breedingReport.unresolvedSourceInternalIds[${index}]`));
  if (new Set(unresolved).size !== unresolved.length || [...unresolved].sort().join("\0") !== unresolved.join("\0")) {
    fail("breedingReport.unresolvedSourceInternalIds", "중복 없이 정렬되어야 합니다.");
  }
  const limitations = arrayAt(root.limitations, "breedingReport.limitations", LIMITATIONS.size)
    .map((entry, index) => stringAt(entry, `breedingReport.limitations[${index}]`, 128));
  if (
    limitations.length !== LIMITATIONS.size
    || limitations.some((entry) => !LIMITATIONS.has(entry))
    || new Set(limitations).size !== limitations.length
  ) {
    fail("breedingReport.limitations", "고정 field limitation을 모두 포함해야 합니다.");
  }
  return value as PalworldBreedingImportReport;
}

async function readRegularBytes(root: string, fileName: string): Promise<Buffer> {
  const filePath = path.join(root, fileName);
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) fail(fileName, "symlink가 아닌 regular file이어야 합니다.");
  return readFile(filePath);
}

function parseJson(bytes: Buffer, pathName: string): unknown {
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    fail(pathName, "JSON 파싱에 실패했습니다.");
  }
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function loadPalworldBreedingRuntimeSource(
  releaseRoot: string
): Promise<PalworldBreedingRuntimeSource> {
  const resolvedRoot = await realpath(path.resolve(releaseRoot));
  const [artifactBytes, manifestBytes, reportBytes] = await Promise.all([
    readRegularBytes(resolvedRoot, PALWORLD_BREEDING_FILE),
    readRegularBytes(resolvedRoot, PALWORLD_BREEDING_MANIFEST_FILE),
    readRegularBytes(resolvedRoot, PALWORLD_BREEDING_REPORT_FILE)
  ]);
  const manifest = assertPalworldBreedingManifest(parseJson(manifestBytes, PALWORLD_BREEDING_MANIFEST_FILE));
  if (manifest.breedingSha256 !== sha256(artifactBytes)) fail("breedingManifest.breedingSha256", "실제 artifact checksum과 다릅니다.");
  if (manifest.reportSha256 !== sha256(reportBytes)) fail("breedingManifest.reportSha256", "실제 report checksum과 다릅니다.");
  const artifact = assertPalworldBreedingArtifact(parseJson(artifactBytes, PALWORLD_BREEDING_FILE));
  const report = assertPalworldBreedingImportReport(parseJson(reportBytes, PALWORLD_BREEDING_REPORT_FILE), artifact);
  if (manifest.release !== artifact.release || manifest.release !== report.release) {
    fail("breedingManifest.release", "artifact와 report release가 일치해야 합니다.");
  }
  if (!sameCounts(manifest.counts, report.counts)) fail("breedingManifest.counts", "report counts와 일치해야 합니다.");
  return { artifact, manifest, report };
}

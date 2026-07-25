import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_CONDENSATION_STARS,
  validatePalworldPalCondensationProfile,
  validatePalworldPalDetail,
  type PalworldCondensedStatId,
  type PalworldPalCondensationProfile,
  type PalworldPalDetail
} from "@streamops/shared";

export const PALWORLD_CONDENSATION_RULES_FILE = "condensation-rules.json";

const MAX_ARTIFACT_BYTES = 64 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RELEASE_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const STEAM_BUILD_ID_PATTERN = /^[1-9]\d{0,19}$/u;
const REVIEWER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const RFC3339_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u;
const AFFECTED_STATS = [
  "hp",
  "attack",
  "defense",
  "meleeAttack",
  "shotAttack"
] as const satisfies readonly PalworldCondensedStatId[];
const BONUS_PERCENTAGES = [0, 5, 10, 15, 20] as const;
const LOADED_RULES = Symbol("PalworldLoadedCondensationRules");

export type PalworldCondensationRulesArtifact = {
  schemaVersion: 1;
  release: string;
  steamBuildId: string;
  sourceRevision: string;
  paldexSha256: string;
  status: "operator_reviewed_compatibility";
  evidence: {
    kind: "operator_provided_reference";
    evidenceSha256: string;
    reviewedAt: string;
    reviewer: string;
  };
  statRule: {
    affectedStats: [...typeof AFFECTED_STATS];
    stages: Array<{
      stars: (typeof PALWORLD_CONDENSATION_STARS)[number];
      bonusPercent: (typeof BONUS_PERCENTAGES)[number];
    }>;
  };
  workSuitabilityRule: {
    status: "unresolved_rule";
  };
};

export type PalworldCondensationRulesExpectation = {
  releaseRoot: string;
  expectedRelease: string;
  expectedSteamBuildId: string;
  expectedSourceRevision: string;
  expectedPaldexSha256: string;
  expectedArtifactSha256: string;
};

export type PalworldLoadedCondensationRules = {
  readonly artifact: Readonly<PalworldCondensationRulesArtifact>;
  readonly artifactSha256: string;
  readonly [LOADED_RULES]: true;
};

export class PalworldCondensationArtifactError extends Error {
  readonly code = "PALWORLD_CONDENSATION_ARTIFACT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldCondensationArtifactError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldCondensationArtifactError(`${pathName}: ${message}`);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested, seen);
  }
  return Object.freeze(value);
}

function recordAt(
  value: unknown,
  pathName: string,
  requiredKeys: readonly string[]
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(pathName, "객체여야 합니다.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(requiredKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  }
  for (const key of requiredKeys) {
    if (!Object.hasOwn(record, key)) fail(`${pathName}.${key}`, "필수 필드가 없습니다.");
  }
  return record;
}

function stringAt(value: unknown, pathName: string, maximum: number): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > maximum
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    fail(pathName, `앞뒤 공백과 제어문자가 없는 ${maximum}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function sha256At(value: unknown, pathName: string): string {
  const checksum = stringAt(value, pathName, 64);
  if (!SHA256_PATTERN.test(checksum)) {
    fail(pathName, "소문자 64자리 SHA-256 hex여야 합니다.");
  }
  return checksum;
}

function finiteAt(
  value: unknown,
  pathName: string,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    fail(pathName, `${minimum} 이상 ${maximum} 이하의 유한한 숫자여야 합니다.`);
  }
  return value;
}

function validateReviewedAt(value: unknown, pathName: string): string {
  const reviewedAt = stringAt(value, pathName, 64);
  if (
    !RFC3339_UTC_PATTERN.test(reviewedAt)
    || !Number.isFinite(Date.parse(reviewedAt))
  ) {
    fail(pathName, "UTC RFC3339 시각이어야 합니다.");
  }
  return reviewedAt;
}

export function assertPalworldCondensationRulesArtifact(
  value: unknown
): PalworldCondensationRulesArtifact {
  const artifact = recordAt(value, "condensationRules", [
    "schemaVersion",
    "release",
    "steamBuildId",
    "sourceRevision",
    "paldexSha256",
    "status",
    "evidence",
    "statRule",
    "workSuitabilityRule"
  ]);
  if (artifact.schemaVersion !== 1) {
    fail("condensationRules.schemaVersion", "1이어야 합니다.");
  }
  const release = stringAt(artifact.release, "condensationRules.release", 64);
  if (!RELEASE_PATTERN.test(release)) {
    fail("condensationRules.release", "semver 형식이어야 합니다.");
  }
  const steamBuildId = stringAt(
    artifact.steamBuildId,
    "condensationRules.steamBuildId",
    20
  );
  if (!STEAM_BUILD_ID_PATTERN.test(steamBuildId)) {
    fail("condensationRules.steamBuildId", "양의 정수 문자열이어야 합니다.");
  }
  stringAt(
    artifact.sourceRevision,
    "condensationRules.sourceRevision",
    512
  );
  sha256At(artifact.paldexSha256, "condensationRules.paldexSha256");
  if (artifact.status !== "operator_reviewed_compatibility") {
    fail(
      "condensationRules.status",
      "operator_reviewed_compatibility여야 합니다."
    );
  }

  const evidence = recordAt(artifact.evidence, "condensationRules.evidence", [
    "kind",
    "evidenceSha256",
    "reviewedAt",
    "reviewer"
  ]);
  if (evidence.kind !== "operator_provided_reference") {
    fail(
      "condensationRules.evidence.kind",
      "operator_provided_reference여야 합니다."
    );
  }
  sha256At(
    evidence.evidenceSha256,
    "condensationRules.evidence.evidenceSha256"
  );
  validateReviewedAt(
    evidence.reviewedAt,
    "condensationRules.evidence.reviewedAt"
  );
  const reviewer = stringAt(
    evidence.reviewer,
    "condensationRules.evidence.reviewer",
    128
  );
  if (!REVIEWER_PATTERN.test(reviewer)) {
    fail(
      "condensationRules.evidence.reviewer",
      "안전한 운영자 식별자여야 합니다."
    );
  }

  const statRule = recordAt(artifact.statRule, "condensationRules.statRule", [
    "affectedStats",
    "stages"
  ]);
  if (
    !Array.isArray(statRule.affectedStats)
    || statRule.affectedStats.length !== AFFECTED_STATS.length
  ) {
    fail(
      "condensationRules.statRule.affectedStats",
      "고정된 농축 능력치 목록이어야 합니다."
    );
  }
  for (const [index, expected] of AFFECTED_STATS.entries()) {
    if (statRule.affectedStats[index] !== expected) {
      fail(
        `condensationRules.statRule.affectedStats[${index}]`,
        `${expected}여야 합니다.`
      );
    }
  }
  if (
    !Array.isArray(statRule.stages)
    || statRule.stages.length !== PALWORLD_CONDENSATION_STARS.length
  ) {
    fail(
      "condensationRules.statRule.stages",
      "0★부터 4★까지 전체 단계가 필요합니다."
    );
  }
  for (const [index, stageValue] of statRule.stages.entries()) {
    const stage = recordAt(
      stageValue,
      `condensationRules.statRule.stages[${index}]`,
      ["stars", "bonusPercent"]
    );
    if (stage.stars !== PALWORLD_CONDENSATION_STARS[index]) {
      fail(
        `condensationRules.statRule.stages[${index}].stars`,
        `${PALWORLD_CONDENSATION_STARS[index]}이어야 합니다.`
      );
    }
    const bonusPercent = finiteAt(
      stage.bonusPercent,
      `condensationRules.statRule.stages[${index}].bonusPercent`,
      0,
      100
    );
    if (bonusPercent !== BONUS_PERCENTAGES[index]) {
      fail(
        `condensationRules.statRule.stages[${index}].bonusPercent`,
        `${BONUS_PERCENTAGES[index]}이어야 합니다.`
      );
    }
  }

  const workSuitabilityRule = recordAt(
    artifact.workSuitabilityRule,
    "condensationRules.workSuitabilityRule",
    ["status"]
  );
  if (workSuitabilityRule.status !== "unresolved_rule") {
    fail(
      "condensationRules.workSuitabilityRule.status",
      "검증 전에는 unresolved_rule이어야 합니다."
    );
  }
  return artifact as unknown as PalworldCondensationRulesArtifact;
}

async function readCanonicalRegularFile(
  releaseRoot: string,
  fileName: string,
  maximumBytes: number
): Promise<Buffer> {
  const resolvedRoot = path.resolve(releaseRoot);
  const rootInfo = await lstat(resolvedRoot);
  if (
    !rootInfo.isDirectory()
    || rootInfo.isSymbolicLink()
    || await realpath(resolvedRoot) !== resolvedRoot
  ) {
    fail("releaseRoot", "symlink가 아닌 canonical directory여야 합니다.");
  }
  const filePath = path.join(resolvedRoot, fileName);
  const fileInfo = await lstat(filePath);
  if (
    !fileInfo.isFile()
    || fileInfo.isSymbolicLink()
    || fileInfo.size < 1
    || fileInfo.size > maximumBytes
    || await realpath(filePath) !== filePath
  ) {
    fail(
      fileName,
      `symlink가 아닌 1~${maximumBytes} bytes canonical regular file이어야 합니다.`
    );
  }
  const handle = await open(
    filePath,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
  );
  try {
    const openedInfo = await handle.stat();
    if (
      !openedInfo.isFile()
      || openedInfo.dev !== fileInfo.dev
      || openedInfo.ino !== fileInfo.ino
      || openedInfo.size !== fileInfo.size
    ) {
      fail(fileName, "검증 중 파일 상태가 변경되었습니다.");
    }
    return await readFile(handle);
  } finally {
    await handle.close();
  }
}

export async function loadPalworldCondensationRules(
  expectation: PalworldCondensationRulesExpectation
): Promise<PalworldLoadedCondensationRules> {
  if (!RELEASE_PATTERN.test(expectation.expectedRelease)) {
    fail("expectedRelease", "semver 형식이어야 합니다.");
  }
  if (!STEAM_BUILD_ID_PATTERN.test(expectation.expectedSteamBuildId)) {
    fail("expectedSteamBuildId", "양의 정수 문자열이어야 합니다.");
  }
  stringAt(expectation.expectedSourceRevision, "expectedSourceRevision", 512);
  sha256At(expectation.expectedPaldexSha256, "expectedPaldexSha256");
  const expectedArtifactSha256 = sha256At(
    expectation.expectedArtifactSha256,
    "expectedArtifactSha256"
  );
  let artifactBytes: Buffer;
  try {
    artifactBytes = await readCanonicalRegularFile(
      expectation.releaseRoot,
      PALWORLD_CONDENSATION_RULES_FILE,
      MAX_ARTIFACT_BYTES
    );
  } catch (error) {
    if (error instanceof PalworldCondensationArtifactError) throw error;
    fail(PALWORLD_CONDENSATION_RULES_FILE, "artifact를 안전하게 읽을 수 없습니다.");
  }
  const artifactSha256 = createHash("sha256")
    .update(artifactBytes)
    .digest("hex");
  if (artifactSha256 !== expectedArtifactSha256) {
    fail(
      "expectedArtifactSha256",
      "실제 condensation rule artifact SHA-256과 일치하지 않습니다."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(artifactBytes.toString("utf8"));
  } catch {
    fail(PALWORLD_CONDENSATION_RULES_FILE, "유효한 JSON이어야 합니다.");
  }
  const artifact = assertPalworldCondensationRulesArtifact(parsed);
  if (artifact.release !== expectation.expectedRelease) {
    fail("condensationRules.release", "활성 release와 일치하지 않습니다.");
  }
  if (artifact.steamBuildId !== expectation.expectedSteamBuildId) {
    fail(
      "condensationRules.steamBuildId",
      "활성 Steam build ID와 일치하지 않습니다."
    );
  }
  if (artifact.sourceRevision !== expectation.expectedSourceRevision) {
    fail(
      "condensationRules.sourceRevision",
      "활성 source revision과 일치하지 않습니다."
    );
  }
  if (artifact.paldexSha256 !== expectation.expectedPaldexSha256) {
    fail(
      "condensationRules.paldexSha256",
      "활성 Paldex SHA-256과 일치하지 않습니다."
    );
  }
  return deepFreeze({
    artifact: deepFreeze(artifact),
    artifactSha256,
    [LOADED_RULES]: true as const
  });
}

function condensedValue(baseValue: number, bonusPercent: number): number {
  if (!Number.isFinite(baseValue) || baseValue < 0) {
    fail("pal.stats", "농축 계산 대상은 0 이상의 유한한 숫자여야 합니다.");
  }
  return Number((baseValue * (1 + bonusPercent / 100)).toFixed(6));
}

/**
 * 검증된 release 규칙만 이용해 공개 응답용 0★~4★ 능력치 profile을 만듭니다.
 * 작업 적성 규칙은 아직 검증되지 않았으므로 계산하거나 추정하지 않습니다.
 */
export function createPalworldPalCondensationProfile(
  pal: PalworldPalDetail,
  loadedRules: PalworldLoadedCondensationRules
): PalworldPalCondensationProfile {
  if (
    loadedRules === null
    || typeof loadedRules !== "object"
    || loadedRules[LOADED_RULES] !== true
  ) {
    fail("loadedRules", "검증된 loader 결과가 필요합니다.");
  }
  const stages = loadedRules.artifact.statRule.stages.map((rule) => {
    const stats = loadedRules.artifact.statRule.affectedStats.flatMap((stat) => {
      const baseValue = pal.stats[stat];
      if (baseValue === undefined) return [];
      return [{
        stat,
        baseValue,
        value: condensedValue(baseValue, rule.bonusPercent)
      }];
    });
    return {
      stars: rule.stars,
      characterRank: (rule.stars + 1) as 1 | 2 | 3 | 4 | 5,
      partnerSkillRank: (rule.stars + 1) as 1 | 2 | 3 | 4 | 5,
      stats,
      workSuitabilities: []
    };
  });
  const profile: PalworldPalCondensationProfile = {
    availability: "available",
    sourceRuleSha256: loadedRules.artifactSha256,
    stages
  };
  const validation = validatePalworldPalCondensationProfile(profile);
  if (!validation.ok) {
    fail("profile", validation.error);
  }
  const palValidation = validatePalworldPalDetail({
    ...pal,
    condensation: validation.data
  });
  if (!palValidation.ok) {
    fail("pal", palValidation.error);
  }
  return palValidation.data.condensation as PalworldPalCondensationProfile;
}

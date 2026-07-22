import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PalworldElement, PalworldWorkSuitabilityType } from "@streamops/shared";
import {
  PALWORLD_PALDEX_EXPECTED_COUNT,
  PALWORLD_PALDEX_RELEASE,
  PALWORLD_PALDEX_STEAM_BUILD_ID,
  assertPalworldPaldexArtifact,
  palworldPaldexRecordOrder,
  type PalworldImagesManifest,
  type PalworldPaldexArtifact,
  type PalworldPaldexRecord
} from "./palworld-paldex-artifact.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const PALWORLD_PALDEX_RELEASE_ROOT = path.join(REPOSITORY_ROOT, "apps/server/data/palworld", PALWORLD_PALDEX_RELEASE);
export const PALWORLD_PALDEX_MAPPING_ROOT = path.join(REPOSITORY_ROOT, "apps/server/src/data/palworld-mappings");
export const PALWORLD_PALDEX_IMAGE_ROOT = path.join(
  REPOSITORY_ROOT,
  "apps/dashboard/public/images/palworld",
  PALWORLD_PALDEX_RELEASE,
  "pals"
);
export const PALWORLD_PALDEX_SOURCE_CACHE_ROOT = path.join(tmpdir(), "streamoverlay-palworld-paldex", PALWORLD_PALDEX_RELEASE);

const ATLAS_RECORD_KEYS = [
  "id",
  "tribe",
  "name",
  "paldexNumber",
  "rarity",
  "elements",
  "hp",
  "attack",
  "defense",
  "runSpeed",
  "stamina",
  "food",
  "breedingRank",
  "nocturnal",
  "workSuitability"
] as const;

const PALCALC_RECORD_KEYS = [
  "Id",
  "Name",
  "LocalizedNames",
  "InternalName",
  "InternalIndex",
  "BreedingPower",
  "BreedingPowerPriority",
  "Price",
  "MinWildLevel",
  "MaxWildLevel",
  "GuaranteedPassivesInternalIds",
  "PartnerSkill",
  "Rarity",
  "Size",
  "Nocturnal",
  "CraftSpeed",
  "Hp",
  "Defense",
  "Attack",
  "WalkSpeed",
  "RunSpeed",
  "RideSprintSpeed",
  "TransportSpeed",
  "MaxFullStomach",
  "FoodAmount",
  "Stamina",
  "WorkSuitability"
] as const;

const PALCALC_LOCALES = [
  "de",
  "en",
  "es-MX",
  "es",
  "fr",
  "id",
  "it",
  "ko",
  "pl",
  "pt-BR",
  "ru",
  "th",
  "tr",
  "vi",
  "zh-Hans",
  "zh-Hant",
  "ja"
] as const;

const PALCALC_WORK_KEYS = [
  "Kindling",
  "Watering",
  "Planting",
  "GenerateElectricity",
  "Handiwork",
  "Gathering",
  "Lumbering",
  "Mining",
  "MedicineProduction",
  "Cooling",
  "Transporting",
  "Farming"
] as const;

const ATLAS_WORK_KEYS = [
  "EmitFlame",
  "Watering",
  "Seeding",
  "GenerateElectricity",
  "Handcraft",
  "Collection",
  "Deforest",
  "Mining",
  "ProductMedicine",
  "Cool",
  "Transport",
  "MonsterFarm"
] as const;

const LOCKED_EXCLUSIONS = new Map<string, { source: string; reasonCode: string }>([
  ["PlantSlime_Flower", { source: "atlas-and-palcalc", reasonCode: "DUPLICATE_PALDEX_APPEARANCE" }],
  ["WorldTreeDragon", { source: "atlas-only", reasonCode: "PUBLIC_PALDEX_STATUS_UNVERIFIED" }],
  ["YakushimaMonster001", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster001_Blue", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster001_Red", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster001_Purple", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster001_Pink", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster001_Rainbow", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster002", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster003", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaMonster003_Purple", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaBoss001", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }],
  ["YakushimaBoss001_Small", { source: "palcalc-only", reasonCode: "EVENT_COLLAB_RECORD" }]
]);

type AtlasPal = {
  id: string;
  tribe: string;
  name: string;
  paldexNumber: number;
  rarity: number;
  elements: string[];
  hp: number;
  attack: number;
  defense: number;
  runSpeed: number;
  stamina: number;
  food: number;
  breedingRank: number;
  nocturnal: boolean;
  workSuitability: Record<string, number>;
};

type PalCalcPal = {
  Id: { PalDexNo: number; IsVariant: boolean };
  Name: string;
  LocalizedNames: Record<string, string>;
  InternalName: string;
  BreedingPower: number;
  Rarity: number;
  Nocturnal: boolean;
  Hp: number;
  Defense: number;
  Attack: number;
  RunSpeed: number;
  Stamina: number;
  WorkSuitability: Record<string, number>;
};

export type PalworldPaldexSourceLock = {
  version: 1;
  release: string;
  steamBuildId: string;
  artifactTimestamp: string;
  verifiedAt: string;
  sources: Array<{
    id: "atlas-pals" | "palcalc-db";
    sourceName: string;
    sourceUrl: string;
    sourceRevision: string;
    sourceRelease?: string;
    inputPath: string;
    downloadUrl: string;
    sha256: string;
    bytes: number;
    recordCount: number;
    databaseVersion?: string;
    license: string;
    licenseUrl: string;
    licenseSha256: string;
  }>;
  imageRightsReview: {
    status: "blocked_by_license";
    candidateSourceName: string;
    candidateSourceRevision: string;
    candidateDirectoryUrl: string;
    license: string;
    reviewedAt: string;
    reasonCode: string;
    evidence: Array<{ url: string; sha256: string; finding: string }>;
  };
};

export type PalworldPaldexImportResult = {
  artifact: PalworldPaldexArtifact;
  imagesManifest: PalworldImagesManifest;
  report: Record<string, unknown>;
};

const LOCKED_SOURCES = {
  "atlas-pals": {
    sourceName: "Awy64/palworld-atlas-data",
    sourceUrl: "https://github.com/Awy64/palworld-atlas-data",
    inputPath: "published/v1/builds/24181105/pals/index.json",
    downloadUrl: "https://raw.githubusercontent.com/Awy64/palworld-atlas-data/0385b3fd8bd757240d4a2c79615145122669abd5/published/v1/builds/24181105/pals/index.json",
    revision: "0385b3fd8bd757240d4a2c79615145122669abd5",
    sha256: "57fb4bf837061c1160d5f72755152245fe793e1b0073328714efd63c65ba5b47",
    bytes: 81803,
    records: 289,
    license: "MIT",
    licenseUrl: "https://github.com/Awy64/palworld-atlas-data/blob/0385b3fd8bd757240d4a2c79615145122669abd5/LICENSE",
    licenseSha256: "46c6b7eae9ee308e80c8876a72cc277e8ef32891dea4e2c4eb440e43c2b4dbeb"
  },
  "palcalc-db": {
    sourceName: "tylercamp/palcalc",
    sourceUrl: "https://github.com/tylercamp/palcalc",
    inputPath: "PalCalc.Model/db.json",
    downloadUrl: "https://raw.githubusercontent.com/tylercamp/palcalc/211dd9fe520cbff9c5e3b9f8ec4f132669869714/PalCalc.Model/db.json",
    revision: "211dd9fe520cbff9c5e3b9f8ec4f132669869714",
    sha256: "803d891afdb18bd00e24332844a7276bbe5c0855170ef90ef142f2f4d7698ed1",
    bytes: 1588212,
    records: 299,
    license: "MIT",
    licenseUrl: "https://github.com/tylercamp/palcalc/blob/211dd9fe520cbff9c5e3b9f8ec4f132669869714/LICENSE.txt",
    licenseSha256: "60768557719376acb654991ff138d1b6ce5e9bf872582566b3f82b22e51ad5a4"
  }
} as const;

const LOCKED_IMAGE_RIGHTS_REVIEW = {
  candidateSourceName: "tylercamp/palcalc Pal icons",
  candidateSourceRevision: LOCKED_SOURCES["palcalc-db"].revision,
  candidateDirectoryUrl: "https://github.com/tylercamp/palcalc/tree/211dd9fe520cbff9c5e3b9f8ec4f132669869714/PalCalc.UI/Resources/Pals",
  license: "UNVERIFIED_FOR_POCKETPAIR_GAME_ASSETS",
  reasonCode: "REDISTRIBUTION_PERMISSION_NOT_VERIFIED",
  evidence: new Map([
    [
      "https://github.com/tylercamp/palcalc/blob/211dd9fe520cbff9c5e3b9f8ec4f132669869714/PalCalc.UI/View/AboutWindow.xaml",
      "b251a81e7f64f86f442904ba113326cf8dec9fe375bfae303ebbcef1ddd586fe"
    ],
    [
      "https://github.com/tylercamp/palcalc/blob/211dd9fe520cbff9c5e3b9f8ec4f132669869714/PalCalc.GenDB/README.md",
      "c2262c63e8a08f1e2dd9e0dd11a677eaca3a1b7eab10e389fec2f4121b7b76a3"
    ]
  ])
} as const;

function fail(pathName: string, message: string): never {
  throw new TypeError(`${pathName}: ${message}`);
}

function asRecord(value: unknown, pathName: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(pathName, "객체여야 합니다.");
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, keys: readonly string[], pathName: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(record)) if (!expected.has(key)) fail(`${pathName}.${key}`, "고정 source schema에 없는 필드입니다.");
  for (const key of keys) if (!(key in record)) fail(`${pathName}.${key}`, "필수 source 필드가 없습니다.");
}

function asString(value: unknown, pathName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(pathName, "비어 있지 않은 문자열이어야 합니다.");
  return value;
}

function asInteger(value: unknown, pathName: string, min = 0, max = 1_000_000): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(pathName, `${min} 이상 ${max} 이하 정수여야 합니다.`);
  return value as number;
}

function asBoolean(value: unknown, pathName: string): boolean {
  if (typeof value !== "boolean") fail(pathName, "boolean이어야 합니다.");
  return value;
}

function asHttpsUrl(value: unknown, pathName: string): string {
  const text = asString(value, pathName);
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:") fail(pathName, "https URL이어야 합니다.");
  } catch (error) {
    if (error instanceof TypeError && error.message.startsWith(`${pathName}:`)) throw error;
    fail(pathName, "올바른 https URL이어야 합니다.");
  }
  return text;
}

function asSha256(value: unknown, pathName: string): string {
  const text = asString(value, pathName);
  if (!/^[a-f0-9]{64}$/u.test(text)) fail(pathName, "64자리 소문자 SHA-256이어야 합니다.");
  return text;
}

function asIsoDate(value: unknown, pathName: string): string {
  const text = asString(value, pathName);
  if (Number.isNaN(Date.parse(text))) fail(pathName, "올바른 날짜 문자열이어야 합니다.");
  return text;
}

function assertEqual(actual: unknown, expected: unknown, pathName: string): void {
  if (actual !== expected) fail(pathName, `Atlas와 PalCalc 값이 다릅니다: ${String(actual)} != ${String(expected)}`);
}

export function assertPalworldPaldexSourceLock(value: unknown): PalworldPaldexSourceLock {
  const root = asRecord(value, "sources.lock");
  assertExactKeys(root, ["version", "release", "steamBuildId", "artifactTimestamp", "verifiedAt", "sources", "imageRightsReview"], "sources.lock");
  if (root.version !== 1 || root.release !== PALWORLD_PALDEX_RELEASE || root.steamBuildId !== PALWORLD_PALDEX_STEAM_BUILD_ID) {
    fail("sources.lock", "고정 release 식별자가 일치하지 않습니다.");
  }
  asIsoDate(root.artifactTimestamp, "sources.lock.artifactTimestamp");
  asIsoDate(root.verifiedAt, "sources.lock.verifiedAt");
  if (!Array.isArray(root.sources) || root.sources.length !== 2) fail("sources.lock.sources", "고정 source 두 개가 필요합니다.");
  const seenSources = new Set<string>();
  for (const [index, sourceValue] of root.sources.entries()) {
    const pathName = `sources.lock.sources[${index}]`;
    const source = asRecord(sourceValue, pathName);
    assertExactKeys(source, [
      "id",
      "sourceName",
      "sourceUrl",
      "sourceRevision",
      "sourceRelease",
      "inputPath",
      "downloadUrl",
      "sha256",
      "bytes",
      "recordCount",
      "databaseVersion",
      "license",
      "licenseUrl",
      "licenseSha256"
    ].filter((key) => key in source || !["sourceRelease", "databaseVersion"].includes(key)), pathName);
    const id = asString(source.id, `${pathName}.id`);
    if (id !== "atlas-pals" && id !== "palcalc-db") fail(`${pathName}.id`, "허용되지 않은 source입니다.");
    if (seenSources.has(id)) fail(`${pathName}.id`, "중복 source입니다.");
    seenSources.add(id);
    const locked = LOCKED_SOURCES[id];
    asString(source.sourceName, `${pathName}.sourceName`);
    asHttpsUrl(source.sourceUrl, `${pathName}.sourceUrl`);
    asHttpsUrl(source.downloadUrl, `${pathName}.downloadUrl`);
    asString(source.inputPath, `${pathName}.inputPath`);
    asString(source.license, `${pathName}.license`);
    asHttpsUrl(source.licenseUrl, `${pathName}.licenseUrl`);
    asSha256(source.licenseSha256, `${pathName}.licenseSha256`);
    if (
      source.sourceName !== locked.sourceName
      || source.sourceUrl !== locked.sourceUrl
      || source.inputPath !== locked.inputPath
      || source.downloadUrl !== locked.downloadUrl
      || source.sourceRevision !== locked.revision
      || source.sha256 !== locked.sha256
      || source.bytes !== locked.bytes
      || source.recordCount !== locked.records
      || source.license !== locked.license
      || source.licenseUrl !== locked.licenseUrl
      || source.licenseSha256 !== locked.licenseSha256
    ) {
      fail(pathName, "코드에 고정된 revision/checksum/count와 일치하지 않습니다.");
    }
    if (id === "palcalc-db" && (source.sourceRelease !== "v1.17.7" || source.databaseVersion !== "v26")) {
      fail(pathName, "PalCalc release/database version이 일치하지 않습니다.");
    }
    if (id === "atlas-pals" && (source.sourceRelease !== undefined || source.databaseVersion !== undefined)) {
      fail(pathName, "Atlas source에는 PalCalc 전용 필드를 넣을 수 없습니다.");
    }
  }
  const rights = asRecord(root.imageRightsReview, "sources.lock.imageRightsReview");
  assertExactKeys(rights, [
    "status",
    "candidateSourceName",
    "candidateSourceRevision",
    "candidateDirectoryUrl",
    "license",
    "reviewedAt",
    "reasonCode",
    "evidence"
  ], "sources.lock.imageRightsReview");
  if (rights.status !== "blocked_by_license") fail("sources.lock.imageRightsReview.status", "현재 권리 검토 상태는 blocked_by_license여야 합니다.");
  asString(rights.candidateSourceName, "sources.lock.imageRightsReview.candidateSourceName");
  asString(rights.candidateSourceRevision, "sources.lock.imageRightsReview.candidateSourceRevision");
  asHttpsUrl(rights.candidateDirectoryUrl, "sources.lock.imageRightsReview.candidateDirectoryUrl");
  asString(rights.license, "sources.lock.imageRightsReview.license");
  asIsoDate(rights.reviewedAt, "sources.lock.imageRightsReview.reviewedAt");
  asString(rights.reasonCode, "sources.lock.imageRightsReview.reasonCode");
  if (
    rights.candidateSourceName !== LOCKED_IMAGE_RIGHTS_REVIEW.candidateSourceName
    || rights.candidateSourceRevision !== LOCKED_IMAGE_RIGHTS_REVIEW.candidateSourceRevision
    || rights.candidateDirectoryUrl !== LOCKED_IMAGE_RIGHTS_REVIEW.candidateDirectoryUrl
    || rights.license !== LOCKED_IMAGE_RIGHTS_REVIEW.license
    || rights.reasonCode !== LOCKED_IMAGE_RIGHTS_REVIEW.reasonCode
  ) {
    fail("sources.lock.imageRightsReview", "고정된 이미지 권리 검토 대상과 일치하지 않습니다.");
  }
  if (!Array.isArray(rights.evidence) || rights.evidence.length !== LOCKED_IMAGE_RIGHTS_REVIEW.evidence.size) {
    fail("sources.lock.imageRightsReview.evidence", "고정 권리 판단 근거가 모두 필요합니다.");
  }
  const seenEvidence = new Set<string>();
  for (const [index, evidenceValue] of rights.evidence.entries()) {
    const pathName = `sources.lock.imageRightsReview.evidence[${index}]`;
    const evidence = asRecord(evidenceValue, pathName);
    assertExactKeys(evidence, ["url", "sha256", "finding"], pathName);
    const url = asHttpsUrl(evidence.url, `${pathName}.url`);
    const sha256 = asSha256(evidence.sha256, `${pathName}.sha256`);
    asString(evidence.finding, `${pathName}.finding`);
    if (seenEvidence.has(url) || LOCKED_IMAGE_RIGHTS_REVIEW.evidence.get(url) !== sha256) {
      fail(pathName, "고정된 권리 판단 URL/checksum과 일치하지 않습니다.");
    }
    seenEvidence.add(url);
  }
  return value as PalworldPaldexSourceLock;
}

function parseAtlas(value: unknown): AtlasPal[] {
  const root = asRecord(value, "atlas");
  assertExactKeys(root, ["records"], "atlas");
  if (!Array.isArray(root.records) || root.records.length !== 289) fail("atlas.records", "289개여야 합니다.");
  return root.records.map((entry, index) => {
    const pathName = `atlas.records[${index}]`;
    const record = asRecord(entry, pathName);
    assertExactKeys(record, ATLAS_RECORD_KEYS, pathName);
    const elements = record.elements;
    if (!Array.isArray(elements) || elements.length < 1 || elements.length > 2) fail(`${pathName}.elements`, "1~2개 배열이어야 합니다.");
    elements.forEach((element, elementIndex) => asString(element, `${pathName}.elements[${elementIndex}]`));
    const work = asRecord(record.workSuitability, `${pathName}.workSuitability`);
    for (const [key, level] of Object.entries(work)) {
      if (!(ATLAS_WORK_KEYS as readonly string[]).includes(key)) fail(`${pathName}.workSuitability.${key}`, "알 수 없는 작업 적성입니다.");
      asInteger(level, `${pathName}.workSuitability.${key}`, 1, 8);
    }
    return {
      id: asString(record.id, `${pathName}.id`),
      tribe: asString(record.tribe, `${pathName}.tribe`),
      name: asString(record.name, `${pathName}.name`),
      paldexNumber: asInteger(record.paldexNumber, `${pathName}.paldexNumber`, 1, 10_000),
      rarity: asInteger(record.rarity, `${pathName}.rarity`, 1, 20),
      elements: elements as string[],
      hp: asInteger(record.hp, `${pathName}.hp`),
      attack: asInteger(record.attack, `${pathName}.attack`),
      defense: asInteger(record.defense, `${pathName}.defense`),
      runSpeed: asInteger(record.runSpeed, `${pathName}.runSpeed`, -1),
      stamina: asInteger(record.stamina, `${pathName}.stamina`),
      food: asInteger(record.food, `${pathName}.food`),
      breedingRank: asInteger(record.breedingRank, `${pathName}.breedingRank`),
      nocturnal: asBoolean(record.nocturnal, `${pathName}.nocturnal`),
      workSuitability: work as Record<string, number>
    };
  });
}

function parsePalCalc(value: unknown): PalCalcPal[] {
  const root = asRecord(value, "palcalc");
  assertExactKeys(root, ["Version", "Pals", "Humans", "Elements", "BreedingGenderProbability", "PassiveSkills", "ActiveSkills"], "palcalc");
  if (root.Version !== "v26") fail("palcalc.Version", "v26이어야 합니다.");
  if (!Array.isArray(root.Pals) || root.Pals.length !== 299) fail("palcalc.Pals", "299개여야 합니다.");
  return root.Pals.map((entry, index) => {
    const pathName = `palcalc.Pals[${index}]`;
    const record = asRecord(entry, pathName);
    assertExactKeys(record, PALCALC_RECORD_KEYS, pathName);
    const id = asRecord(record.Id, `${pathName}.Id`);
    assertExactKeys(id, ["PalDexNo", "IsVariant"], `${pathName}.Id`);
    const localized = asRecord(record.LocalizedNames, `${pathName}.LocalizedNames`);
    assertExactKeys(localized, PALCALC_LOCALES, `${pathName}.LocalizedNames`);
    for (const locale of PALCALC_LOCALES) asString(localized[locale], `${pathName}.LocalizedNames.${locale}`);
    const work = asRecord(record.WorkSuitability, `${pathName}.WorkSuitability`);
    assertExactKeys(work, PALCALC_WORK_KEYS, `${pathName}.WorkSuitability`);
    for (const key of PALCALC_WORK_KEYS) asInteger(work[key], `${pathName}.WorkSuitability.${key}`, 0, 8);
    return {
      Id: {
        PalDexNo: asInteger(id.PalDexNo, `${pathName}.Id.PalDexNo`, 1, 20_000),
        IsVariant: asBoolean(id.IsVariant, `${pathName}.Id.IsVariant`)
      },
      Name: asString(record.Name, `${pathName}.Name`),
      LocalizedNames: localized as Record<string, string>,
      InternalName: asString(record.InternalName, `${pathName}.InternalName`),
      BreedingPower: asInteger(record.BreedingPower, `${pathName}.BreedingPower`),
      Rarity: asInteger(record.Rarity, `${pathName}.Rarity`, 1, 20),
      Nocturnal: asBoolean(record.Nocturnal, `${pathName}.Nocturnal`),
      Hp: asInteger(record.Hp, `${pathName}.Hp`),
      Defense: asInteger(record.Defense, `${pathName}.Defense`),
      Attack: asInteger(record.Attack, `${pathName}.Attack`),
      RunSpeed: asInteger(record.RunSpeed, `${pathName}.RunSpeed`, 0),
      Stamina: asInteger(record.Stamina, `${pathName}.Stamina`),
      WorkSuitability: work as Record<string, number>
    };
  });
}

function assertUniqueSourceIds(atlas: AtlasPal[], palCalc: PalCalcPal[]): void {
  if (new Set(atlas.map((pal) => pal.id)).size !== atlas.length) fail("atlas.records", "중복 internal ID가 있습니다.");
  if (new Set(palCalc.map((pal) => pal.InternalName)).size !== palCalc.length) fail("palcalc.Pals", "중복 internal ID가 있습니다.");
}

function assertExclusionMembership(atlas: AtlasPal[], palCalc: PalCalcPal[], exclusions: Set<string>): void {
  const atlasIds = new Set(atlas.map((pal) => pal.id));
  const palCalcIds = new Set(palCalc.map((pal) => pal.InternalName));
  for (const [internalId, expected] of LOCKED_EXCLUSIONS) {
    if (!exclusions.has(internalId)) fail("exclusions.entries", `필수 exclusion이 없습니다: ${internalId}`);
    const inAtlas = atlasIds.has(internalId);
    const inPalCalc = palCalcIds.has(internalId);
    const membershipMatches = expected.source === "atlas-and-palcalc"
      ? inAtlas && inPalCalc
      : expected.source === "atlas-only"
        ? inAtlas && !inPalCalc
        : !inAtlas && inPalCalc;
    if (!membershipMatches) fail("exclusions.entries", `${internalId}의 source 소속이 고정 원본과 일치하지 않습니다.`);
  }
}

function parseMap(value: unknown, pathName: string): Map<string, string> {
  const root = asRecord(value, pathName);
  assertExactKeys(root, ["version", "entries"], pathName);
  if (root.version !== 1) fail(`${pathName}.version`, "1이어야 합니다.");
  const entries = asRecord(root.entries, `${pathName}.entries`);
  return new Map(Object.entries(entries).map(([key, mapped]) => [key, asString(mapped, `${pathName}.entries.${key}`)]));
}

type WorkMapping = { atlas: string; palcalc: string; shared: PalworldWorkSuitabilityType };

function parseWorkMappings(value: unknown): WorkMapping[] {
  const root = asRecord(value, "workMappings");
  assertExactKeys(root, ["version", "entries"], "workMappings");
  if (root.version !== 1) fail("workMappings.version", "1이어야 합니다.");
  if (!Array.isArray(root.entries) || root.entries.length !== 12) fail("workMappings.entries", "12개여야 합니다.");
  return root.entries.map((entry, index) => {
    const pathName = `workMappings.entries[${index}]`;
    const record = asRecord(entry, pathName);
    assertExactKeys(record, ["atlas", "palcalc", "shared"], pathName);
    return {
      atlas: asString(record.atlas, `${pathName}.atlas`),
      palcalc: asString(record.palcalc, `${pathName}.palcalc`),
      shared: asString(record.shared, `${pathName}.shared`) as PalworldWorkSuitabilityType
    };
  });
}

function parsePublicIdMap(value: unknown): Map<string, string> {
  const root = asRecord(value, "publicIdMap");
  assertExactKeys(root, ["version", "release", "entries"], "publicIdMap");
  if (root.version !== 1 || root.release !== PALWORLD_PALDEX_RELEASE) fail("publicIdMap", "release mapping 버전이 올바르지 않습니다.");
  if (!Array.isArray(root.entries) || root.entries.length !== PALWORLD_PALDEX_EXPECTED_COUNT) fail("publicIdMap.entries", "287개여야 합니다.");
  const result = new Map<string, string>();
  for (const [index, entry] of root.entries.entries()) {
    const pathName = `publicIdMap.entries[${index}]`;
    const record = asRecord(entry, pathName);
    assertExactKeys(record, ["sourceInternalId", "publicId"], pathName);
    const internalId = asString(record.sourceInternalId, `${pathName}.sourceInternalId`);
    const publicId = asString(record.publicId, `${pathName}.publicId`);
    if (result.has(internalId)) fail(`${pathName}.sourceInternalId`, "중복 mapping입니다.");
    result.set(internalId, publicId);
  }
  return result;
}

function parseExclusions(value: unknown): Set<string> {
  const root = asRecord(value, "exclusions");
  assertExactKeys(root, ["version", "release", "entries"], "exclusions");
  if (root.version !== 1 || root.release !== PALWORLD_PALDEX_RELEASE) fail("exclusions", "release exclusions 버전이 올바르지 않습니다.");
  if (!Array.isArray(root.entries) || root.entries.length !== LOCKED_EXCLUSIONS.size) {
    fail("exclusions.entries", `고정 제외 레코드 ${LOCKED_EXCLUSIONS.size}개가 필요합니다.`);
  }
  const result = new Set<string>();
  for (const [index, entry] of root.entries.entries()) {
    const pathName = `exclusions.entries[${index}]`;
    const record = asRecord(entry, pathName);
    assertExactKeys(record, ["source", "sourceInternalId", "reasonCode", "reasonKo"], pathName);
    const source = asString(record.source, `${pathName}.source`);
    const internalId = asString(record.sourceInternalId, `${pathName}.sourceInternalId`);
    const reasonCode = asString(record.reasonCode, `${pathName}.reasonCode`);
    asString(record.reasonKo, `${pathName}.reasonKo`);
    if (result.has(internalId)) fail(`${pathName}.sourceInternalId`, "중복 exclusion입니다.");
    const expected = LOCKED_EXCLUSIONS.get(internalId);
    if (!expected || expected.source !== source || expected.reasonCode !== reasonCode) {
      fail(pathName, "고정된 제외 ID·source·reasonCode와 일치하지 않습니다.");
    }
    result.add(internalId);
  }
  for (const internalId of LOCKED_EXCLUSIONS.keys()) {
    if (!result.has(internalId)) fail("exclusions.entries", `필수 exclusion이 없습니다: ${internalId}`);
  }
  return result;
}

export function assertPalworldPaldexExclusions(value: unknown): Set<string> {
  return parseExclusions(value);
}

export function publicIdFromEnglishName(name: string): string {
  const publicId = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (!publicId) fail("publicId", `영문 이름에서 public ID를 만들 수 없습니다: ${name}`);
  return publicId;
}

export function buildPublicIdMapping(atlasValue: unknown, palCalcValue: unknown, exclusionsValue: unknown): Record<string, unknown> {
  const atlas = parseAtlas(atlasValue);
  const palCalc = parsePalCalc(palCalcValue);
  assertUniqueSourceIds(atlas, palCalc);
  const palCalcById = new Map(palCalc.map((pal) => [pal.InternalName, pal]));
  const exclusions = parseExclusions(exclusionsValue);
  assertExclusionMembership(atlas, palCalc, exclusions);
  const entries = atlas
    .filter((pal) => !exclusions.has(pal.id))
    .map((pal) => {
      const palCalc = palCalcById.get(pal.id);
      if (!palCalc) fail("publicIdMap", `PalCalc exact ID가 없습니다: ${pal.id}`);
      return { sourceInternalId: pal.id, publicId: publicIdFromEnglishName(palCalc.Name) };
    })
    .sort((left, right) => left.sourceInternalId < right.sourceInternalId ? -1 : left.sourceInternalId > right.sourceInternalId ? 1 : 0);
  if (entries.length !== PALWORLD_PALDEX_EXPECTED_COUNT) fail("publicIdMap.entries", "287개가 생성되어야 합니다.");
  const ids = new Set(entries.map((entry) => entry.publicId));
  if (ids.size !== entries.length) fail("publicIdMap.entries", "영문 이름 기반 public ID가 충돌합니다. 수동 mapping이 필요합니다.");
  return { version: 1, release: PALWORLD_PALDEX_RELEASE, entries };
}

export function importPalworldPaldex(input: {
  atlas: unknown;
  palCalc: unknown;
  sourceLock: PalworldPaldexSourceLock;
  publicIdMap: unknown;
  elementsMap: unknown;
  workMappings: unknown;
  exclusions: unknown;
}): PalworldPaldexImportResult {
  const atlas = parseAtlas(input.atlas);
  const palCalc = parsePalCalc(input.palCalc);
  assertUniqueSourceIds(atlas, palCalc);
  const palCalcById = new Map(palCalc.map((pal) => [pal.InternalName, pal]));
  const publicIds = parsePublicIdMap(input.publicIdMap);
  const elements = parseMap(input.elementsMap, "elementsMap");
  const workMappings = parseWorkMappings(input.workMappings);
  const exclusions = parseExclusions(input.exclusions);
  assertExclusionMembership(atlas, palCalc, exclusions);
  const records: PalworldPaldexRecord[] = [];
  let exactJoinCount = 0;

  for (const atlasPal of atlas) {
    const palCalcPal = palCalcById.get(atlasPal.id);
    if (palCalcPal) exactJoinCount += 1;
    if (exclusions.has(atlasPal.id)) continue;
    if (!palCalcPal) fail("join", `PalCalc exact ID가 없습니다: ${atlasPal.id}`);
    const publicId = publicIds.get(atlasPal.id);
    if (!publicId) fail("publicIdMap", `public ID mapping이 없습니다: ${atlasPal.id}`);

    assertEqual(atlasPal.name, palCalcPal.Name, `${atlasPal.id}.name`);
    assertEqual(atlasPal.paldexNumber, palCalcPal.Id.PalDexNo, `${atlasPal.id}.number`);
    assertEqual(atlasPal.rarity, palCalcPal.Rarity, `${atlasPal.id}.rarity`);
    assertEqual(atlasPal.hp, palCalcPal.Hp, `${atlasPal.id}.hp`);
    assertEqual(atlasPal.attack, palCalcPal.Attack, `${atlasPal.id}.attack`);
    assertEqual(atlasPal.defense, palCalcPal.Defense, `${atlasPal.id}.defense`);
    assertEqual(atlasPal.runSpeed, palCalcPal.RunSpeed, `${atlasPal.id}.runSpeed`);
    assertEqual(atlasPal.stamina, palCalcPal.Stamina, `${atlasPal.id}.stamina`);
    assertEqual(atlasPal.breedingRank, palCalcPal.BreedingPower, `${atlasPal.id}.breedingPower`);
    assertEqual(atlasPal.nocturnal, palCalcPal.Nocturnal, `${atlasPal.id}.nocturnal`);

    const normalizedElements = atlasPal.elements.map((element) => {
      const mapped = elements.get(element);
      if (!mapped) fail(`${atlasPal.id}.elements`, `알 수 없는 Atlas 속성입니다: ${element}`);
      return mapped as PalworldElement;
    });
    const normalizedWork = workMappings.flatMap((mapping) => {
      const atlasLevel = atlasPal.workSuitability[mapping.atlas] ?? 0;
      const palCalcLevel = palCalcPal.WorkSuitability[mapping.palcalc];
      assertEqual(atlasLevel, palCalcLevel, `${atlasPal.id}.workSuitability.${mapping.shared}`);
      return atlasLevel > 0 ? [{ type: mapping.shared, level: atlasLevel }] : [];
    });
    for (const atlasWork of Object.keys(atlasPal.workSuitability)) {
      if (!workMappings.some((mapping) => mapping.atlas === atlasWork)) fail(`${atlasPal.id}.workSuitability.${atlasWork}`, "mapping되지 않은 작업 적성입니다.");
    }

    records.push({
      id: publicId,
      sourceInternalId: atlasPal.id,
      number: atlasPal.paldexNumber,
      nameKo: palCalcPal.LocalizedNames.ko!,
      nameJa: palCalcPal.LocalizedNames.ja!,
      nameEn: palCalcPal.LocalizedNames.en!,
      variantType: palCalcPal.Id.IsVariant ? "variant" : "normal",
      elements: normalizedElements,
      rarity: atlasPal.rarity,
      stats: {
        hp: atlasPal.hp,
        attack: atlasPal.attack,
        defense: atlasPal.defense,
        moveSpeed: atlasPal.runSpeed,
        stamina: atlasPal.stamina
      },
      workSuitabilities: normalizedWork,
      breedingPower: atlasPal.breedingRank,
      nocturnal: atlasPal.nocturnal
    });
  }
  records.sort(palworldPaldexRecordOrder);
  if (publicIds.size !== records.length) fail("publicIdMap", "사용되지 않는 public ID mapping이 있습니다.");
  if (exactJoinCount !== 288) fail("join", "Atlas와 PalCalc의 exact internal ID join은 288개여야 합니다.");

  const atlasSource = input.sourceLock.sources.find((source) => source.id === "atlas-pals");
  const palCalcSource = input.sourceLock.sources.find((source) => source.id === "palcalc-db");
  if (!atlasSource || !palCalcSource) fail("sources.lock", "두 고정 source가 필요합니다.");
  const sourceRevision = `atlas@${atlasSource.sourceRevision}+palcalc@${palCalcSource.sourceRevision}`;
  const artifact = assertPalworldPaldexArtifact({
    schemaVersion: 1,
    release: PALWORLD_PALDEX_RELEASE,
    steamBuildId: PALWORLD_PALDEX_STEAM_BUILD_ID,
    metadata: {
      gameVersion: PALWORLD_PALDEX_RELEASE,
      sourceName: "Awy64/palworld-atlas-data + tylercamp/palcalc",
      sourceUrl: `${atlasSource.sourceUrl}/blob/${atlasSource.sourceRevision}/${atlasSource.inputPath}`,
      sourceRevision,
      extractedAt: input.sourceLock.artifactTimestamp,
      verifiedAt: input.sourceLock.verifiedAt,
      license: "Source repositories: MIT. Palworld 명칭·게임 데이터·자산 권리는 각 권리자에게 있습니다."
    },
    records
  });

  const imageEvidenceUrls = input.sourceLock.imageRightsReview.evidence.map((evidence) => evidence.url);
  const imagesManifest: PalworldImagesManifest = {
    schemaVersion: 1,
    release: PALWORLD_PALDEX_RELEASE,
    revision: `palcalc-icons@${input.sourceLock.imageRightsReview.candidateSourceRevision}`,
    status: "blocked_by_license",
    rightsReview: {
      status: "blocked_by_license",
      reviewedAt: input.sourceLock.imageRightsReview.reviewedAt,
      reasonCode: input.sourceLock.imageRightsReview.reasonCode,
      evidenceUrls: imageEvidenceUrls
    },
    entries: artifact.records.map((pal) => {
      const palCalcPal = palCalcById.get(pal.sourceInternalId)!;
      const originalFileName = `${palCalcPal.Name}.png`;
      const encodedFileName = encodeURIComponent(originalFileName);
      const candidateFileBaseUrl = input.sourceLock.imageRightsReview.candidateDirectoryUrl.replace("/tree/", "/blob/");
      return {
        palId: pal.id,
        sourceInternalId: pal.sourceInternalId,
        status: "blocked_by_license",
        sourceName: input.sourceLock.imageRightsReview.candidateSourceName,
        sourceUrl: `${candidateFileBaseUrl}/${encodedFileName}`,
        sourceRevision: input.sourceLock.imageRightsReview.candidateSourceRevision,
        license: input.sourceLock.imageRightsReview.license,
        retrievedAt: null,
        originalSha256: null,
        generatedSha256: null,
        originalFileName,
        outputFileName: null,
        outputMime: null,
        outputWidth: null,
        outputHeight: null,
        outputBytes: null,
        imageUrl: null
      };
    })
  };

  const palCalcOnly = palCalc.filter((pal) => !atlas.some((atlasPal) => atlasPal.id === pal.InternalName));
  const expectedPalCalcOnly = [...LOCKED_EXCLUSIONS.entries()]
    .filter(([, exclusion]) => exclusion.source === "palcalc-only")
    .map(([internalId]) => internalId)
    .sort();
  const actualPalCalcOnly = palCalcOnly.map((pal) => pal.InternalName).sort();
  if (JSON.stringify(actualPalCalcOnly) !== JSON.stringify(expectedPalCalcOnly)) {
    fail("join", "PalCalc-only 이벤트·콜라보 레코드가 고정 exclusions와 일치하지 않습니다.");
  }
  const report = {
    schemaVersion: 1,
    release: PALWORLD_PALDEX_RELEASE,
    generatedAt: input.sourceLock.artifactTimestamp,
    sourceCounts: { atlas: atlas.length, palCalc: palCalc.length },
    joins: { exactInternalId: exactJoinCount, unmatchedIncluded: 0 },
    exclusions: {
      declared: exclusions.size,
      atlasExcluded: atlas.filter((pal) => exclusions.has(pal.id)).map((pal) => pal.id).sort(),
      palCalcOnlyExcluded: palCalcOnly.map((pal) => pal.InternalName).sort()
    },
    output: {
      pals: artifact.records.length,
      normal: artifact.records.filter((pal) => pal.variantType === "normal").length,
      variant: artifact.records.filter((pal) => pal.variantType === "variant").length,
      missingNameKo: 0,
      missingNameJa: 0,
      missingNameEn: 0,
      unknownEnums: 0,
      missingRequiredStats: 0,
      missingBreedingPower: 0,
      idCollisions: 0,
      aliasCollisions: 0
    },
    images: {
      status: "blocked_by_license",
      mappedPals: imagesManifest.entries.length,
      readyImages: 0,
      uniqueImageFiles: 0,
      fallbackPals: imagesManifest.entries.length
    },
    dataIntegrityGate: {
      passed: true,
      status: "ready",
      failures: [],
      checks: {
        pals: artifact.records.length,
        normal: artifact.records.filter((pal) => pal.variantType === "normal").length,
        variant: artifact.records.filter((pal) => pal.variantType === "variant").length,
        missingNameKo: 0,
        missingNameJa: 0,
        missingNameEn: 0,
        missingRequiredStats: 0,
        missingBreedingPower: 0,
        unknownEnums: 0,
        idCollisions: 0,
        aliasCollisions: 0,
        sourceChecksumVerified: true,
        mappingChecksumsVerified: true,
        artifactChecksumsVerified: true
      }
    },
    imageAssetGate: {
      passed: false,
      status: "blocked_by_license",
      failures: ["PAL_IMAGE_REDISTRIBUTION_PERMISSION_NOT_VERIFIED", "PAL_IMAGE_FILES_NOT_INCLUDED"],
      readyImages: 0,
      fallbackPals: imagesManifest.entries.length
    },
    runtimeActivation: true
  };
  return { artifact, imagesManifest, report };
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Text(value: string): string {
  return sha256Bytes(Buffer.from(value, "utf8"));
}

export async function readPalworldSourceResponseBytes(
  response: Response,
  expectedBytes: number,
  sourceId: string
): Promise<Buffer> {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0) {
    throw new TypeError(`${sourceId}: 고정 source byte 제한이 올바르지 않습니다.`);
  }
  const contentLength = response.headers.get("content-length");
  const contentEncoding = response.headers.get("content-encoding");
  if (contentLength !== null && contentEncoding === null && Number(contentLength) !== expectedBytes) {
    throw new Error(`${sourceId}: Content-Length가 lock과 다릅니다.`);
  }
  if (!response.body) throw new Error(`${sourceId}: source 응답 body가 없습니다.`);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > expectedBytes) {
        await reader.cancel(`${sourceId}: source byte 제한 초과`).catch(() => undefined);
        throw new Error(`${sourceId}: source 응답이 고정 byte 제한을 초과했습니다.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (receivedBytes !== expectedBytes) {
    throw new Error(`${sourceId}: source 응답 크기가 lock과 다릅니다.`);
  }
  return Buffer.concat(chunks, receivedBytes);
}

export function deterministicJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o644 });
  await rename(temporaryPath, filePath);
}

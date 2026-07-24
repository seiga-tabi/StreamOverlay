import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { assertPalworldSourceProvenance } from "@streamops/shared";
import { fileURLToPath } from "node:url";
import { assertPalworldCatalogArtifact } from "./palworld-catalog-artifact.js";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  realpath,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PAK_IMAGE_TRANSFORM,
  PalworldPakAssetError,
  importPalworldPakPngAsset,
  validatePalworldPakPngBytes,
  type PalworldPakCandidateImageAsset
} from "./palworld-pak-assets.js";
import {
  officialLocaleLookup,
  readPalworldPakOfficialLocale,
  type PalworldPakLocaleField,
  type PalworldPakOfficialLocaleCandidate
} from "./palworld-pak-localization.js";
import {
  assertPalworldPakExportMetadata,
  inspectPalworldPakArchive,
  withPalworldPakArchive,
  type PalworldPakArchiveReader,
  type PalworldPakExportMetadata,
  type PalworldPakPreflightReport
} from "./palworld-pak-preflight.js";
import {
  normalizePalworldPakRichText,
  type PalworldPakRichTextLookupValue,
  type PalworldPakRichTextResult,
  type PalworldPakRichTextResolvers
} from "./palworld-pak-rich-text.js";
import {
  validatePalworldPakBlockedCandidateStagingRoot
} from "./palworld-pak-runtime-manifest.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const MAX_METADATA_BYTES = 64 * 1024;
const MAX_MAPPING_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 100_000;
const NONE_VALUES = new Set(["None", "EPalTribeID::None", "EPalGenderType::None"]);

const TABLES = {
  pals: "Pal/DataTable/Character/DT_PalMonsterParameter_Common.json",
  palBpClasses: "Pal/DataTable/Character/DT_PalBPClass_Common.json",
  palIcons: "Pal/DataTable/Character/DT_PalCharacterIconDataTable_Common.json",
  palDrops: "Pal/DataTable/Character/DT_PalDropItem_Common.json",
  items: "Pal/DataTable/Item/DT_ItemDataTable_Common.json",
  itemIcons: "Pal/DataTable/Item/DT_ItemIconDataTable_Common.json",
  recipes: "Pal/DataTable/Item/DT_ItemRecipeDataTable_Common.json",
  technology: "Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common.json",
  activeSkills: "Pal/DataTable/Waza/DT_WazaDataTable_Common.json",
  activeAssignments: "Pal/DataTable/Waza/DT_WazaMasterLevel_Common.json",
  activeEggAssignments: "Pal/DataTable/Waza/DT_WazaMasterTamago.json",
  passiveSkills: "Pal/DataTable/PassiveSkill/DT_PassiveSkill_Main_Common.json",
  partnerParameters: "Pal/DataTable/PassiveSkill/DT_PartnerSkillParameter.json",
  specialBreeding: "Pal/DataTable/Character/DT_PalCombiUnique.json",
  worldMap: "Pal/DataTable/WorldMapUIData/DT_WorldMapUIData.json"
} as const;

const WORK_FIELDS = [
  ["kindling", "WorkSuitability_EmitFlame"],
  ["watering", "WorkSuitability_Watering"],
  ["planting", "WorkSuitability_Seeding"],
  ["generating_electricity", "WorkSuitability_GenerateElectricity"],
  ["handiwork", "WorkSuitability_Handcraft"],
  ["gathering", "WorkSuitability_Collection"],
  ["lumbering", "WorkSuitability_Deforest"],
  ["mining", "WorkSuitability_Mining"],
  ["medicine_production", "WorkSuitability_ProductMedicine"],
  ["cooling", "WorkSuitability_Cool"],
  ["transporting", "WorkSuitability_Transport"],
  ["farming", "WorkSuitability_MonsterFarm"]
] as const;

const SOURCE_ONLY_WORK_FIELDS = [
  ["oil_extraction", "WorkSuitability_OilExtraction"]
] as const;

const WORK_ICON_SEMANTIC_IDS: ReadonlySet<string> = new Set([
  ...WORK_FIELDS.map(([type]) => type),
  ...SOURCE_ONLY_WORK_FIELDS.map(([type]) => type)
]);

const PAL_ELEMENT_MAP = {
  Normal: "neutral",
  Fire: "fire",
  Water: "water",
  Electricity: "electric",
  Leaf: "grass",
  Ice: "ice",
  Earth: "ground",
  Dark: "dark",
  Dragon: "dragon"
} as const;

type JsonRecord = Record<string, unknown>;

type CandidateSourceFile = {
  member: string;
  sha256: string;
  bytes: number;
};

type CandidateLocalizedValue = {
  messageKey: string;
  sourceField: PalworldPakLocaleField;
  ko: string | null;
  ja: string | null;
  en: string | null;
  koStatus: "source_provided" | "missing_source";
  jaStatus: "source_provided" | "missing_source";
  enStatus: "source_provided" | "missing_source";
  koRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  jaRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  enRichTextStatus?: "resolved" | "unresolved" | "placeholder";
  koRichText?: Pick<PalworldPakRichTextResult, "tokens" | "unresolved">;
  jaRichText?: Pick<PalworldPakRichTextResult, "tokens" | "unresolved">;
  enRichText?: Pick<PalworldPakRichTextResult, "tokens" | "unresolved">;
};

const PALWORLD_PAK_ALIAS_DOMAINS = [
  "active_assignment_pal_reference",
  "active_skill_description_message_key",
  "active_skill_name_message_key",
  "breeding_pal_reference",
  "drop_item_reference",
  "drop_pal_reference",
  "item_description_message_key",
  "item_icon_reference",
  "item_name_message_key",
  "pal_description_message_key",
  "pal_first_activated_message_key",
  "pal_name_message_key",
  "partner_skill_message_key",
  "partner_parameter_source",
  "public_id_source",
  "recipe_item_reference",
  "rich_text_character_reference",
  "rich_text_item_reference",
  "rich_text_ui_reference",
  "technology_recipe_reference"
] as const;

type CandidateAliasDomain = (typeof PALWORLD_PAK_ALIAS_DOMAINS)[number];

type CandidateAlias = {
  sourceId: string;
  targetId: string;
  domain: CandidateAliasDomain;
  reason: string;
};

type CandidateAliases = {
  entries: CandidateAlias[];
  byDomain: ReadonlyMap<CandidateAliasDomain, ReadonlyMap<string, string>>;
  usageCounts: Map<string, number>;
};

type CandidateMappings = {
  publicIdMap: unknown;
  aliases: unknown;
  palIconOverrides: unknown;
  elementIconMap: unknown;
  workIconMap: unknown;
  skillIconMap: unknown;
  publicActiveSkillAllowlist: unknown;
  exclusions: unknown;
  legacySkillCatalog: unknown;
};

export type PalworldPakCandidateImportInput = {
  archivePath: string;
  expectedArchiveSha256: string;
  outputDirectory: string;
  metadata?: unknown;
  mappings: CandidateMappings;
  includeAssets?: boolean;
};

export type PalworldPakCandidateImportResult = {
  outputDirectory: string;
  candidateId: string;
  activationEligible: false;
  blockers: string[];
  counts: {
    rawPalRows: number;
    canonicalPals: number;
    excludedPalRows: number;
    reviewedPublicIds: number;
    generatedPublicIds: number;
    rawItemRows: number;
    legalItems: number;
    excludedItemRows: number;
    activeSkills: number;
    sourcePassiveSkills: number;
    visiblePassiveSkills: number;
    excludedPassiveSkills: number;
    partnerSkills: number;
    legacySkills: number;
    mappedLegacySkills: number;
    unresolvedLegacySkills: number;
    activeAssignments: number;
    resolvedActiveAssignments: number;
    excludedActiveAssignments: number;
    publicResolvedActiveAssignments: number;
    publicExcludedActiveAssignments: number;
    sourceMissingActiveAssignments: number;
    unresolvedActiveAssignments: number;
    eggAssignments: number;
    palsWithActiveAssignments: number;
    palsWithoutActiveAssignments: number;
    sourceSpecialBreedingRows: number;
    resolvedSpecialBreedingRules: number;
    publicResolvedSpecialBreedingRows: number;
    publicExcludedSpecialBreedingRows: number;
    sourceMissingSpecialBreedingRows: number;
    duplicateSpecialBreedingRows: number;
    unresolvedSpecialBreedingRows: number;
    computedBreedingResults: number;
  };
  localeCoverage: {
    ko: Record<string, number>;
    ja: Record<string, number>;
    en: Record<string, number>;
    placeholdersExcluded: { ko: number; ja: number; en: number };
    unresolvedRichText: { ko: number; ja: number; en: number };
  };
  imageCoverage: {
    pals: { available: number; missing: number; total: number };
    items: { available: number; missing: number; total: number };
    elements: { available: number; missing: number; total: number };
    work: { available: number; missing: number; total: number };
    skills: { available: number; missing: number; total: number };
    map: { available: number; missing: number; total: number };
  };
};

export class PalworldPakImportError extends Error {
  readonly code = "PALWORLD_PAK_IMPORT_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakImportError";
  }
}

function fail(message: string): never {
  throw new PalworldPakImportError(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactRecord(value: unknown, label: string, keys: readonly string[]): JsonRecord {
  if (!isRecord(value)) fail(`${label}: 객체여야 합니다.`);
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${label}.${key}: 허용되지 않은 필드입니다.`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) fail(`${label}.${key}: 필수 필드가 없습니다.`);
  }
  return value;
}

function stringValue(value: unknown, label: string, maxLength = 256): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value.trim() !== value
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    fail(`${label}: 앞뒤 공백과 제어문자가 없는 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function internalId(value: unknown, label: string): string {
  const result = stringValue(value, label, 160);
  if (!INTERNAL_ID_PATTERN.test(result)) fail(`${label}: canonical source internal ID가 아닙니다.`);
  return result;
}

function enumSuffix(value: unknown, label: string): string {
  const raw = stringValue(value, label, 192);
  const suffix = raw.includes("::") ? raw.slice(raw.lastIndexOf("::") + 2) : raw;
  return internalId(suffix, label);
}

function canonicalElement(
  value: unknown,
  label: string
): (typeof PAL_ELEMENT_MAP)[keyof typeof PAL_ELEMENT_MAP] | null {
  const source = enumSuffix(value, label);
  if (source === "None") return null;
  if (!Object.hasOwn(PAL_ELEMENT_MAP, source)) {
    fail(`${label}: 알 수 없는 PAK element enum입니다.`);
  }
  return PAL_ELEMENT_MAP[source as keyof typeof PAL_ELEMENT_MAP];
}

function finiteNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label}: ${min}~${max} 범위의 유한 숫자여야 합니다.`);
  }
  return value;
}

function integer(value: unknown, label: string, min: number, max: number): number {
  const result = finiteNumber(value, label, min, max);
  if (!Number.isSafeInteger(result)) fail(`${label}: 안전한 정수여야 합니다.`);
  return result;
}

function optionalTextId(value: unknown, fallback: string, label: string): string {
  if (value === undefined || value === null || value === "None") return fallback;
  const result = stringValue(value, label, 192);
  if (!/^[A-Za-z0-9_]+$/u.test(result)) fail(`${label}: exact message key 형식이 아닙니다.`);
  return result;
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function deterministicJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stableUnknownArray<T>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => {
    const leftKey = JSON.stringify(left) ?? "";
    const rightKey = JSON.stringify(right) ?? "";
    return leftKey.localeCompare(rightKey, "en");
  });
}

function kebabFromInternal(value: string): string {
  const kebab = value
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/_/gu, "-")
    .replace(/[^A-Za-z0-9-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLocaleLowerCase("en-US");
  if (!PUBLIC_ID_PATTERN.test(kebab)) fail(`${value}: deterministic candidate ID를 만들 수 없습니다.`);
  return kebab;
}

function assetMember(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.AssetPathName !== "string") return undefined;
  const assetPath = value.AssetPathName;
  if (!assetPath.startsWith("/Game/") || assetPath.includes("\\") || assetPath.includes("..")) return undefined;
  const packagePath = assetPath.slice("/Game/".length).split(".", 1)[0];
  if (!packagePath || !/^[A-Za-z0-9_/-]+$/u.test(packagePath)) return undefined;
  return `${packagePath}.png`;
}

async function readSmallJsonFile(filePath: string, maxBytes: number, label: string): Promise<unknown> {
  const resolved = path.resolve(filePath);
  const info = await lstat(resolved);
  if (
    info.isSymbolicLink()
    || !info.isFile()
    || info.size < 1
    || info.size > maxBytes
    || await realpath(resolved) !== resolved
  ) {
    fail(`${label}: 안전한 canonical regular JSON 파일이어야 합니다.`);
  }
  const handle = await open(resolved, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile()
      || opened.dev !== info.dev
      || opened.ino !== info.ino
      || opened.size !== info.size
    ) {
      fail(`${label}: 검증 중 파일이 변경되었습니다.`);
    }
    try {
      return JSON.parse((await handle.readFile()).toString("utf8")) as unknown;
    } catch (error) {
      if (error instanceof PalworldPakImportError) throw error;
      fail(`${label}: JSON을 파싱할 수 없습니다.`);
    }
  } finally {
    await handle.close();
  }
}

export async function readPalworldPakExportMetadataFile(filePath: string): Promise<PalworldPakExportMetadata> {
  return assertPalworldPakExportMetadata(
    await readSmallJsonFile(filePath, MAX_METADATA_BYTES, "metadata")
  );
}

export async function readPalworldPakMappingFile(filePath: string): Promise<unknown> {
  return await readSmallJsonFile(filePath, MAX_MAPPING_BYTES, "mapping");
}

function parsePublicIdMap(value: unknown): {
  release: string;
  entries: Map<string, string>;
} {
  const root = exactRecord(value, "publicIdMap", ["version", "release", "entries"]);
  if (root.version !== 1 || !Array.isArray(root.entries) || root.entries.length > 10_000) {
    fail("publicIdMap: version 1의 제한된 entries 배열이어야 합니다.");
  }
  const release = stringValue(root.release, "publicIdMap.release", 64);
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(release)) {
    fail("publicIdMap.release: 고정 semantic version이어야 합니다.");
  }
  const result = new Map<string, string>();
  const publicIds = new Set<string>();
  for (const [index, raw] of root.entries.entries()) {
    const row = exactRecord(raw, `publicIdMap.entries[${index}]`, ["sourceInternalId", "publicId"]);
    const sourceInternalId = internalId(row.sourceInternalId, `publicIdMap.entries[${index}].sourceInternalId`);
    const publicId = stringValue(row.publicId, `publicIdMap.entries[${index}].publicId`, 128);
    if (!PUBLIC_ID_PATTERN.test(publicId)) fail(`publicIdMap.entries[${index}].publicId: kebab-case여야 합니다.`);
    if (result.has(sourceInternalId) || publicIds.has(publicId)) fail("publicIdMap: ID가 중복됩니다.");
    result.set(sourceInternalId, publicId);
    publicIds.add(publicId);
  }
  return { release, entries: result };
}

function assertCandidateMappingHeader(
  root: JsonRecord,
  label: string,
  expectedSha256: string,
  expectedCandidateId: string
): void {
  if (
    root.schemaVersion !== 1
    || root.sourceArchiveSha256 !== expectedSha256
    || root.candidateRelease !== expectedCandidateId
  ) {
    fail(`${label}: schemaVersion, candidateRelease 또는 source archive checksum이 일치하지 않습니다.`);
  }
}

function parseAliases(
  value: unknown,
  expectedSha256: string,
  expectedCandidateId: string
): CandidateAliases {
  const root = exactRecord(value, "aliases", [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "entries"
  ]);
  assertCandidateMappingHeader(root, "aliases", expectedSha256, expectedCandidateId);
  if (!Array.isArray(root.entries)) fail("aliases.entries: 배열이어야 합니다.");
  const entries: CandidateAlias[] = [];
  const byDomain = new Map<CandidateAliasDomain, Map<string, string>>();
  for (const [index, raw] of root.entries.entries()) {
    const row = exactRecord(raw, `aliases.entries[${index}]`, [
      "sourceId",
      "targetId",
      "domain",
      "reason",
      "reviewStatus"
    ]);
    const status = stringValue(row.reviewStatus, `aliases.entries[${index}].reviewStatus`, 32);
    const domainValue = stringValue(row.domain, `aliases.entries[${index}].domain`, 64);
    if (status !== "approved" && status !== "candidate") fail("aliases: reviewStatus가 올바르지 않습니다.");
    if (
      !(PALWORLD_PAK_ALIAS_DOMAINS as readonly string[]).includes(domainValue)
      && status === "approved"
    ) {
      fail(`aliases.entries[${index}].domain: approved alias domain allowlist에 없습니다.`);
    }
    if (status !== "approved") continue;
    const domain = domainValue as CandidateAliasDomain;
    const source = internalId(row.sourceId, `aliases.entries[${index}].sourceId`);
    const target = internalId(row.targetId, `aliases.entries[${index}].targetId`);
    const reason = stringValue(row.reason, `aliases.entries[${index}].reason`, 512);
    const domainAliases = byDomain.get(domain) ?? new Map<string, string>();
    if (domainAliases.has(source)) fail(`aliases: ${domain} source ID가 중복됩니다.`);
    if (source === target) fail(`aliases.entries[${index}]: source와 target이 같을 수 없습니다.`);
    domainAliases.set(source, target);
    byDomain.set(domain, domainAliases);
    entries.push({ sourceId: source, targetId: target, domain, reason });
  }
  entries.sort((left, right) =>
    left.domain.localeCompare(right.domain, "en")
    || left.sourceId.localeCompare(right.sourceId, "en")
    || left.targetId.localeCompare(right.targetId, "en")
  );
  return { entries, byDomain, usageCounts: new Map<string, number>() };
}

function applyAlias(
  aliases: CandidateAliases,
  domain: CandidateAliasDomain,
  sourceId: string
): string {
  const target = aliases.byDomain.get(domain)?.get(sourceId);
  if (target === undefined) return sourceId;
  const key = `${domain}\0${sourceId}`;
  aliases.usageCounts.set(key, (aliases.usageCounts.get(key) ?? 0) + 1);
  return target;
}

function parseIconOverrides(
  value: unknown,
  expectedSha256: string,
  expectedCandidateId: string
): Map<string, string> {
  const root = exactRecord(value, "palIconOverrides", [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "entries"
  ]);
  assertCandidateMappingHeader(
    root,
    "palIconOverrides",
    expectedSha256,
    expectedCandidateId
  );
  if (!Array.isArray(root.entries)) fail("palIconOverrides.entries: 배열이어야 합니다.");
  const result = new Map<string, string>();
  for (const [index, raw] of root.entries.entries()) {
    const row = exactRecord(raw, `palIconOverrides.entries[${index}]`, [
      "sourceInternalId",
      "sourceMember",
      "reason"
    ]);
    const sourceInternalId = internalId(
      row.sourceInternalId,
      `palIconOverrides.entries[${index}].sourceInternalId`
    );
    const member = stringValue(row.sourceMember, `palIconOverrides.entries[${index}].sourceMember`, 512);
    if (
      !member.startsWith("Pal/Texture/PalIcon/Normal/")
      || !member.endsWith(".png")
      || member.includes("..")
      || member.includes("\\")
    ) {
      fail(`palIconOverrides.entries[${index}].sourceMember: 허용된 Pal icon 경로가 아닙니다.`);
    }
    stringValue(row.reason, `palIconOverrides.entries[${index}].reason`, 512);
    if (result.has(sourceInternalId)) fail("palIconOverrides: canonical ID가 중복됩니다.");
    result.set(sourceInternalId, member);
  }
  return result;
}

function parseSimpleAssetMap(
  value: unknown,
  label: string,
  expectedSha256: string,
  expectedCandidateId: string
): Array<{ id: string; sourceMember: string }> {
  const root = exactRecord(value, label, [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "entries"
  ]);
  assertCandidateMappingHeader(root, label, expectedSha256, expectedCandidateId);
  if (!Array.isArray(root.entries)) fail(`${label}.entries: 배열이어야 합니다.`);
  const result: Array<{ id: string; sourceMember: string }> = [];
  const ids = new Set<string>();
  const members = new Set<string>();
  for (const [index, raw] of root.entries.entries()) {
    const row = exactRecord(raw, `${label}.entries[${index}]`, ["id", "sourceMember"]);
    const id = stringValue(row.id, `${label}.entries[${index}].id`, 128);
    const sourceMember = stringValue(row.sourceMember, `${label}.entries[${index}].sourceMember`, 512);
    if (ids.has(id) || members.has(sourceMember)) fail(`${label}: ID 또는 source member가 중복됩니다.`);
    ids.add(id);
    members.add(sourceMember);
    result.push({ id, sourceMember });
  }
  return result.sort((left, right) => left.id.localeCompare(right.id, "en"));
}

export function parseWorkAssetMap(
  value: unknown,
  expectedSha256: string,
  expectedCandidateId: string
): {
  status: string;
  availableSourceMembers: string[];
  entries: Array<{ id: string; sourceMember: string }>;
} {
  const root = exactRecord(value, "workIconMap", [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "status",
    "availableSourceMembers",
    "entries"
  ]);
  if (
    !Array.isArray(root.availableSourceMembers)
    || !Array.isArray(root.entries)
  ) {
    fail("workIconMap: availableSourceMembers와 entries는 배열이어야 합니다.");
  }
  assertCandidateMappingHeader(root, "workIconMap", expectedSha256, expectedCandidateId);
  const availableSourceMembers = root.availableSourceMembers.map((value, index) => {
    const member = stringValue(value, `workIconMap.availableSourceMembers[${index}]`, 512);
    if (
      !/^Pal\/Texture\/UI\/InGame\/SkillIcon\/T_icon_skill_pal_WorkRank_[A-Za-z0-9_]+\.png$/u.test(member)
    ) {
      fail(`workIconMap.availableSourceMembers[${index}]: 허용된 work icon 경로가 아닙니다.`);
    }
    return member;
  });
  if (new Set(availableSourceMembers).size !== availableSourceMembers.length) {
    fail("workIconMap.availableSourceMembers: 중복 경로가 있습니다.");
  }
  const entries = root.entries.map((raw, index) => {
    const row = exactRecord(raw, `workIconMap.entries[${index}]`, ["id", "sourceMember"]);
    const id = stringValue(row.id, `workIconMap.entries[${index}].id`, 128);
    if (!WORK_ICON_SEMANTIC_IDS.has(id)) {
      fail(`workIconMap.entries[${index}].id: 허용된 work semantic ID가 아닙니다.`);
    }
    return {
      id,
      sourceMember: stringValue(
        row.sourceMember,
        `workIconMap.entries[${index}].sourceMember`,
        512
      )
    };
  });
  const entryIds = new Set<string>();
  const entryMembers = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (entryIds.has(entry.id) || entryMembers.has(entry.sourceMember)) {
      fail(`workIconMap.entries[${index}]: ID 또는 source member가 중복됩니다.`);
    }
    if (!availableSourceMembers.includes(entry.sourceMember)) {
      fail(`workIconMap.entries[${index}].sourceMember: source 목록에 없는 경로입니다.`);
    }
    entryIds.add(entry.id);
    entryMembers.add(entry.sourceMember);
  }
  const status = stringValue(root.status, "workIconMap.status", 64);
  if (
    status !== "blocked_pending_semantic_mapping"
    && status !== "verified"
  ) {
    fail("workIconMap.status: 허용된 mapping 상태가 아닙니다.");
  }
  if (
    (status === "verified") !== (entries.length === availableSourceMembers.length)
  ) {
    fail("workIconMap: verified 상태와 전체 source mapping 수가 일치해야 합니다.");
  }
  return {
    status,
    availableSourceMembers,
    entries: entries.sort((left, right) => left.id.localeCompare(right.id, "en"))
  };
}

type PublicActiveSkillAllowlistEntry = {
  sourceRowId: string;
  sourceInternalId: string;
  nameMessageKey: string;
  reason: string;
};

export function parsePublicActiveSkillAllowlist(
  value: unknown,
  expectedSha256: string,
  expectedCandidateId: string
): Map<string, PublicActiveSkillAllowlistEntry> {
  const root = exactRecord(value, "publicActiveSkillAllowlist", [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "entries"
  ]);
  assertCandidateMappingHeader(
    root,
    "publicActiveSkillAllowlist",
    expectedSha256,
    expectedCandidateId
  );
  if (!Array.isArray(root.entries) || root.entries.length > 10_000) {
    fail("publicActiveSkillAllowlist.entries: 제한된 배열이어야 합니다.");
  }
  const result = new Map<string, PublicActiveSkillAllowlistEntry>();
  const sourceRowIds = new Set<string>();
  for (const [index, raw] of root.entries.entries()) {
    const row = exactRecord(raw, `publicActiveSkillAllowlist.entries[${index}]`, [
      "sourceRowId",
      "sourceInternalId",
      "nameMessageKey",
      "reason",
      "reviewStatus"
    ]);
    const sourceRowId = internalId(
      row.sourceRowId,
      `publicActiveSkillAllowlist.entries[${index}].sourceRowId`
    );
    const sourceInternalId = internalId(
      row.sourceInternalId,
      `publicActiveSkillAllowlist.entries[${index}].sourceInternalId`
    );
    const nameMessageKey = internalId(
      row.nameMessageKey,
      `publicActiveSkillAllowlist.entries[${index}].nameMessageKey`
    );
    const reason = stringValue(
      row.reason,
      `publicActiveSkillAllowlist.entries[${index}].reason`,
      256
    );
    if (row.reviewStatus !== "approved") {
      fail(`publicActiveSkillAllowlist.entries[${index}].reviewStatus: approved여야 합니다.`);
    }
    if (result.has(sourceInternalId) || sourceRowIds.has(sourceRowId)) {
      fail("publicActiveSkillAllowlist: source row 또는 internal ID가 중복됩니다.");
    }
    result.set(sourceInternalId, {
      sourceRowId,
      sourceInternalId,
      nameMessageKey,
      reason
    });
    sourceRowIds.add(sourceRowId);
  }
  return new Map(
    [...result.entries()].sort(([left], [right]) => left.localeCompare(right, "en"))
  );
}

function parseSkillAssetMap(
  value: unknown,
  expectedSha256: string,
  expectedCandidateId: string
): {
  status: "blocked_pending_semantic_mapping" | "verified";
  entries: Array<{ id: string; sourceMember: string }>;
} {
  const root = exactRecord(value, "skillIconMap", [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "status",
    "entries"
  ]);
  assertCandidateMappingHeader(
    root,
    "skillIconMap",
    expectedSha256,
    expectedCandidateId
  );
  const status = stringValue(root.status, "skillIconMap.status", 64);
  if (
    status !== "blocked_pending_semantic_mapping"
    && status !== "verified"
  ) {
    fail("skillIconMap.status: 허용된 mapping 상태가 아닙니다.");
  }
  if (!Array.isArray(root.entries) || root.entries.length > MAX_RECORDS) {
    fail("skillIconMap.entries: 제한된 배열이어야 합니다.");
  }
  const identities = new Set<string>();
  const entries = root.entries.map((raw, index) => {
    const row = exactRecord(raw, `skillIconMap.entries[${index}]`, [
      "id",
      "sourceMember"
    ]);
    const id = stringValue(row.id, `skillIconMap.entries[${index}].id`, 192);
    const sourceMember = stringValue(
      row.sourceMember,
      `skillIconMap.entries[${index}].sourceMember`,
      512
    );
    if (!/\/T_icon_skill_pal_[A-Za-z0-9_]+\.png$/u.test(sourceMember)) {
      fail(`skillIconMap.entries[${index}].sourceMember: skill icon 경로가 아닙니다.`);
    }
    if (identities.has(id)) fail("skillIconMap.entries: skill ID가 중복됩니다.");
    identities.add(id);
    return { id, sourceMember };
  }).sort((left, right) => left.id.localeCompare(right.id, "en"));
  if (status === "verified" && entries.length === 0) {
    fail("skillIconMap: verified 상태에는 mapping entry가 필요합니다.");
  }
  return {
    status: status as "blocked_pending_semantic_mapping" | "verified",
    entries
  };
}

function parseExclusions(
  value: unknown,
  expectedSha256: string,
  expectedCandidateId: string
): Array<{
  sourceRowId: string;
  domain: string;
  reason: string;
  reviewStatus: "approved";
}> {
  const root = exactRecord(value, "exclusions", [
    "schemaVersion",
    "candidateRelease",
    "sourceArchiveSha256",
    "entries"
  ]);
  assertCandidateMappingHeader(root, "exclusions", expectedSha256, expectedCandidateId);
  if (!Array.isArray(root.entries)) fail("exclusions.entries: 배열이어야 합니다.");
  const seen = new Set<string>();
  return root.entries.map((raw, index) => {
    const row = exactRecord(raw, `exclusions.entries[${index}]`, [
      "sourceRowId",
      "domain",
      "reason",
      "reviewStatus"
    ]);
    const sourceRowId = internalId(row.sourceRowId, `exclusions.entries[${index}].sourceRowId`);
    const domain = stringValue(row.domain, `exclusions.entries[${index}].domain`, 64);
    const reason = stringValue(row.reason, `exclusions.entries[${index}].reason`, 512);
    if (row.reviewStatus !== "approved") {
      fail(`exclusions.entries[${index}].reviewStatus: approved여야 합니다.`);
    }
    const key = `${domain}\0${sourceRowId}`;
    if (seen.has(key)) fail("exclusions: domain/sourceRowId가 중복됩니다.");
    seen.add(key);
    return { sourceRowId, domain, reason, reviewStatus: "approved" as const };
  }).sort((left, right) =>
    left.domain.localeCompare(right.domain, "en")
    || left.sourceRowId.localeCompare(right.sourceRowId, "en")
  );
}

function canonicalPalRows(rows: JsonRecord): {
  raw: Array<{ rowName: string; tribe: string; value: JsonRecord }>;
  canonical: Array<{ rowName: string; tribe: string; value: JsonRecord }>;
  exclusions: Array<{ sourceRowId: string; sourceInternalId: string; reason: string }>;
} {
  const raw = Object.entries(rows).flatMap(([rowName, value]) => {
    if (
      !isRecord(value)
      || value.IsPal !== true
      || typeof value.ZukanIndex !== "number"
      || value.ZukanIndex <= 0
    ) {
      return [];
    }
    return [{ rowName: internalId(rowName, `${rowName}.rowName`), tribe: enumSuffix(value.Tribe, `${rowName}.Tribe`), value }];
  });
  const grouped = new Map<string, typeof raw>();
  for (const row of raw) grouped.set(row.tribe, [...(grouped.get(row.tribe) ?? []), row]);
  const canonical: typeof raw = [];
  const exclusions: Array<{ sourceRowId: string; sourceInternalId: string; reason: string }> = [];
  for (const [tribe, candidates] of grouped) {
    const exact = candidates.find((candidate) => candidate.rowName === tribe);
    const bpClassMatches = candidates.filter((candidate) =>
      typeof candidate.value.BPClass === "string"
      && candidate.rowName === candidate.value.BPClass
    );
    const selected = exact ?? (bpClassMatches.length === 1 ? bpClassMatches[0] : undefined);
    if (!selected) fail(`${tribe}: canonical Pal row를 exact source ID로 결정할 수 없습니다.`);
    canonical.push(selected);
    for (const candidate of candidates) {
      if (candidate === selected) continue;
      exclusions.push({
        sourceRowId: candidate.rowName,
        sourceInternalId: tribe,
        reason: "duplicate_noncanonical_row_for_exact_tribe"
      });
    }
  }
  canonical.sort((left, right) =>
    Number(left.value.ZukanIndex) - Number(right.value.ZukanIndex)
    || String(left.value.ZukanIndexSuffix ?? "").localeCompare(
      String(right.value.ZukanIndexSuffix ?? ""),
      "en"
    )
    || left.tribe.localeCompare(right.tribe, "en")
  );
  exclusions.sort((left, right) => left.sourceRowId.localeCompare(right.sourceRowId, "en"));
  return { raw, canonical, exclusions };
}

export type PalworldPakSourcePalVisibility =
  | "public"
  | "nonpublic"
  | "missing"
  | "invalid";

export function palworldPakSourcePalVisibility(
  value: unknown
): PalworldPakSourcePalVisibility {
  if (value === undefined) return "missing";
  if (
    !isRecord(value)
    || value.IsPal !== true
    || typeof value.ZukanIndex !== "number"
    || !Number.isFinite(value.ZukanIndex)
  ) {
    return "invalid";
  }
  return value.ZukanIndex > 0 ? "public" : "nonpublic";
}

function localizedValue(
  messageKey: string,
  field: PalworldPakLocaleField,
  ko: PalworldPakOfficialLocaleCandidate,
  ja: PalworldPakOfficialLocaleCandidate,
  en: PalworldPakOfficialLocaleCandidate,
  richText: boolean,
  resolvers: Record<"ko" | "ja" | "en", PalworldPakRichTextResolvers>,
  unresolvedCounters: Record<"ko" | "ja" | "en", { value: number }>
): CandidateLocalizedValue {
  const koValue = officialLocaleLookup(ko, field).get(messageKey)?.text;
  const jaValue = officialLocaleLookup(ja, field).get(messageKey)?.text;
  const enValue = officialLocaleLookup(en, field).get(messageKey)?.text;
  const normalize = (
    text: string | undefined,
    locale: "ko" | "ja" | "en"
  ): {
    text: string | null;
    status?: "resolved" | "unresolved" | "placeholder";
    richText?: Pick<PalworldPakRichTextResult, "tokens" | "unresolved">;
  } => {
    if (text === undefined) return { text: null };
    if (!richText) return { text };
    const normalized = normalizePalworldPakRichText(text, resolvers[locale]);
    if (normalized.status !== "resolved") unresolvedCounters[locale].value += 1;
    return {
      text: normalized.text || null,
      status: normalized.status,
      richText: {
        tokens: normalized.tokens,
        unresolved: normalized.unresolved
      }
    };
  };
  const normalizedKo = normalize(koValue, "ko");
  const normalizedJa = normalize(jaValue, "ja");
  const normalizedEn = normalize(enValue, "en");
  return {
    messageKey,
    sourceField: field,
    ko: normalizedKo.text,
    ja: normalizedJa.text,
    en: normalizedEn.text,
    koStatus: normalizedKo.text === null ? "missing_source" : "source_provided",
    jaStatus: normalizedJa.text === null ? "missing_source" : "source_provided",
    enStatus: normalizedEn.text === null ? "missing_source" : "source_provided",
    ...(normalizedKo.status === undefined ? {} : { koRichTextStatus: normalizedKo.status }),
    ...(normalizedJa.status === undefined ? {} : { jaRichTextStatus: normalizedJa.status }),
    ...(normalizedEn.status === undefined ? {} : { enRichTextStatus: normalizedEn.status }),
    ...(normalizedKo.richText === undefined ? {} : { koRichText: normalizedKo.richText }),
    ...(normalizedJa.richText === undefined ? {} : { jaRichText: normalizedJa.richText }),
    ...(normalizedEn.richText === undefined ? {} : { enRichText: normalizedEn.richText })
  };
}

function gender(value: unknown, label: string): "male" | "female" | undefined {
  const suffix = enumSuffix(value, label);
  if (suffix === "None") return undefined;
  if (suffix === "Male") return "male";
  if (suffix === "Female") return "female";
  fail(`${label}: 지원하지 않는 Pal 성별 enum입니다.`);
}

function countComputedBreedingResults(
  parameters: Array<{
    id: string;
    combiRank: number;
    combiDuplicatePriority: number;
    ignoreCombi: boolean;
    variantType: "normal" | "variant";
  }>,
  specialRules: Array<{
    parentAId: string;
    parentBId: string;
    childId: string;
    parentAGender?: "male" | "female";
    parentBGender?: "male" | "female";
  }>
): number {
  const pairKey = (left: string, right: string): string =>
    left <= right ? `${left}\0${right}` : `${right}\0${left}`;
  const specialByPair = new Map<string, typeof specialRules>();
  for (const rule of specialRules) {
    const key = pairKey(rule.parentAId, rule.parentBId);
    specialByPair.set(key, [...(specialByPair.get(key) ?? []), rule]);
  }
  const specialOnlyChildren = new Set(
    specialRules
      .filter((rule) => !(rule.parentAId === rule.parentBId && rule.parentAId === rule.childId))
      .map((rule) => rule.childId)
  );
  const generalCandidates = parameters.filter((parameter) =>
    !parameter.ignoreCombi && !specialOnlyChildren.has(parameter.id)
  );
  let count = 0;
  for (let leftIndex = 0; leftIndex < parameters.length; leftIndex += 1) {
    const left = parameters[leftIndex]!;
    for (let rightIndex = leftIndex; rightIndex < parameters.length; rightIndex += 1) {
      const right = parameters[rightIndex]!;
      const special = specialByPair.get(pairKey(left.id, right.id)) ?? [];
      if (special.length > 0) {
        count += special.length;
        continue;
      }
      if (left.id === right.id) {
        count += 1;
        continue;
      }
      const targetRank = Math.floor((left.combiRank + right.combiRank + 1) / 2);
      const child = generalCandidates
        .map((candidate) => ({
          candidate,
          distance: Math.abs(candidate.combiRank - targetRank)
        }))
        .sort((first, second) =>
          first.distance - second.distance
          || second.candidate.combiDuplicatePriority - first.candidate.combiDuplicatePriority
          || Number(first.candidate.variantType === "variant") - Number(second.candidate.variantType === "variant")
          || first.candidate.id.localeCompare(second.candidate.id, "en")
        )[0]?.candidate;
      if (child) count += 1;
    }
  }
  return count;
}

function localeFieldCounts(
  records: Array<{ name: CandidateLocalizedValue; description?: CandidateLocalizedValue }>,
  locale: "ko" | "ja" | "en"
): Record<string, number> {
  const nameField = locale;
  const richTextStatusField = locale === "ko"
    ? "koRichTextStatus"
    : locale === "ja"
      ? "jaRichTextStatus"
      : "enRichTextStatus";
  return {
    names: records.filter((record) => record.name[nameField] !== null).length,
    descriptions: records.filter((record) =>
      record.description?.[nameField] != null
      && (
        richTextStatusField === undefined
        || record.description[richTextStatusField] === "resolved"
      )
    ).length
  };
}

async function writeArtifact(
  root: string,
  relativePath: string,
  value: unknown
): Promise<{ file: string; sha256: string; bytes: number }> {
  const bytes = deterministicJson(value);
  const absolute = path.resolve(root, ...relativePath.split("/"));
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) fail("artifact 경로가 staging root를 벗어납니다.");
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes, { flag: "wx", mode: 0o644 });
  return { file: relativePath, sha256: sha256(bytes), bytes: bytes.length };
}

export function assertPalworldPakCandidateOutputDirectory(
  outputDirectory: string
): string {
  const resolved = path.resolve(outputDirectory);
  const activeRuntimeRoot = fileURLToPath(
    new URL("../../data/palworld/runtime", import.meta.url)
  );
  if (
    resolved === path.parse(resolved).root
    || resolved === path.resolve(".")
    || CONTROL_CHARACTER_PATTERN.test(resolved)
    || resolved === activeRuntimeRoot
    || resolved.startsWith(`${activeRuntimeRoot}${path.sep}`)
  ) {
    fail("candidate output은 active runtime과 분리된 명시적인 staging 디렉터리여야 합니다.");
  }
  return resolved;
}

function referenceResolvers(input: {
  locale: PalworldPakOfficialLocaleCandidate;
  palNameKeys: ReadonlyMap<string, string>;
  itemNameKeys: ReadonlyMap<string, string>;
  activeSkillNameKeys: ReadonlyMap<string, string>;
  aliases: CandidateAliases;
}): PalworldPakRichTextResolvers {
  const fieldLookup = (field: PalworldPakLocaleField) => officialLocaleLookup(input.locale, field);
  const palNames = fieldLookup("pal_name");
  const itemNames = fieldLookup("item_name");
  const skillNames = fieldLookup("skill_name");
  const uiCommon = fieldLookup("ui_common");
  const mapObjects = fieldLookup("map_object_name");
  const partnerAppend = fieldLookup("partner_append");
  return {
    characterName: (id) => {
      const canonicalId = applyAlias(input.aliases, "rich_text_character_reference", id);
      const key = input.palNameKeys.get(canonicalId) ?? `PAL_NAME_${canonicalId}`;
      return palNames.get(key)?.text;
    },
    itemName: (id) => {
      const canonicalId = applyAlias(input.aliases, "rich_text_item_reference", id);
      const key = input.itemNameKeys.get(canonicalId) ?? `ITEM_NAME_${canonicalId}`;
      return itemNames.get(key)?.text;
    },
    activeSkillName: (id) => {
      const key = input.activeSkillNameKeys.get(id);
      return skillNames.get(
        applyAlias(input.aliases, "active_skill_name_message_key", key ?? `ACTION_SKILL_${id}`)
      )?.text;
    },
    uiCommon: (id) => uiCommon.get(
      applyAlias(input.aliases, "rich_text_ui_reference", id)
    )?.text,
    mapObjectName: (id) =>
      mapObjects.get(id)?.text
      ?? mapObjects.get(`MAPOBJECT_NAME_${id}`)?.text,
    image: (id) => {
      const element = /^ElemIcon_([A-Za-z0-9_]+)$/u.exec(id)?.[1];
      const sourceElement = element === "Electric"
        ? "Electricity"
        : element === "Grass"
          ? "Leaf"
          : element === "Ground"
            ? "Earth"
            : element === "Neutral"
              ? "Normal"
              : element;
      return element === undefined
        ? undefined
        : uiCommon.get(`COMMON_ELEMENT_NAME_${sourceElement}`)?.text;
    },
    referenceMessage: (id) => {
      const direct = partnerAppend.get(id)?.text;
      if (direct !== undefined) return direct;
      const base = id.startsWith("ReferenceMsgId_")
        ? id.slice("ReferenceMsgId_".length)
        : undefined;
      if (!base) return undefined;
      const byRank = ([1, 2, 3, 4, 5] as const).flatMap((rank) => {
        const text = partnerAppend.get(`${base}_Rank_${rank}`)?.text;
        return text === undefined ? [] : [{ rank, text }];
      });
      return byRank.length > 0 ? { byRank } : undefined;
    }
  };
}

function numericText(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Object.is(value, -0) ? "0" : String(value);
}

function partnerRankVariableResolver(
  parameterRow: unknown,
  passiveSkillRows: JsonRecord
): PalworldPakRichTextResolvers["rankVariable"] {
  if (!isRecord(parameterRow)) return undefined;
  const textReferencePassiveSkills = Array.isArray(parameterRow.TextReferencePassiveSkills)
    ? parameterRow.TextReferencePassiveSkills
    : [];
  const passiveSkills = Array.isArray(parameterRow.PassiveSkills)
    ? parameterRow.PassiveSkills
    : [];
  const activeSkill = isRecord(parameterRow.ActiveSkill) ? parameterRow.ActiveSkill : undefined;
  const numericRankValues = (values: unknown): PalworldPakRichTextLookupValue | undefined => {
    if (!Array.isArray(values)) return undefined;
    const byRank = values.flatMap((value, index) => {
      const text = numericText(value);
      return text === undefined || index >= 5
        ? []
        : [{ rank: (index + 1) as 1 | 2 | 3 | 4 | 5, text }];
    });
    return byRank.length === 5 ? { byRank } : undefined;
  };
  return (id) => {
    if (id === "ActiveSkillMainValueByRank") {
      return numericRankValues(activeSkill?.ActiveSkill_MainValueByRank);
    }
    if (id === "ActiveSkillOverWriteEffectTime") {
      return numericRankValues(activeSkill?.ActiveSkill_OverWriteEffectTimeByRank);
    }
    const match = /^(Reference)?Passive([1-9]\d*)_EffectValue([1-4])$/u.exec(id);
    if (!match) return undefined;
    const useTextReference = match[1] === "Reference";
    const passiveIndex = Number(match[2]) - 1;
    const effectIndex = Number(match[3]);
    const ranks = useTextReference ? textReferencePassiveSkills : passiveSkills;
    const byRank = ranks.flatMap((rawRank: unknown, rankIndex: number) => {
      if (!isRecord(rawRank)) return [];
      const rawSkill = useTextReference
        ? Array.isArray(rawRank.PassiveSkillIds)
          ? rawRank.PassiveSkillIds[passiveIndex]
          : undefined
        : Array.isArray(rawRank.SkillAndParametersArray)
          ? rawRank.SkillAndParametersArray[passiveIndex]
          : undefined;
      if (!isRecord(rawSkill)) return [];
      const key = useTextReference
        ? typeof rawSkill.Key === "string"
          ? rawSkill.Key
          : undefined
        : isRecord(rawSkill.SkillName) && typeof rawSkill.SkillName.Key === "string"
          ? rawSkill.SkillName.Key
          : undefined;
      if (key === undefined) return [];
      const passiveRow = passiveSkillRows[key];
      if (!isRecord(passiveRow)) return [];
      const text = numericText(passiveRow[`EffectValue${effectIndex}`]);
      if (text === undefined || rankIndex >= 5) return [];
      return [{
        rank: (rankIndex + 1) as 1 | 2 | 3 | 4 | 5,
        text
      }];
    });
    return byRank.length === 5 ? { byRank } : undefined;
  };
}

function passiveRankVariableResolver(
  passiveRow: JsonRecord
): PalworldPakRichTextResolvers["rankVariable"] {
  return (id) => {
    const match = /^EffectValue([1-4])$/u.exec(id);
    if (!match) return undefined;
    return numericText(passiveRow[`EffectValue${match[1]}`]);
  };
}

export async function importPalworldPakCandidate(
  input: PalworldPakCandidateImportInput
): Promise<PalworldPakCandidateImportResult> {
  if (!SHA256_PATTERN.test(input.expectedArchiveSha256)) {
    fail("expectedArchiveSha256은 소문자 64자리 SHA-256이어야 합니다.");
  }
  const outputDirectory = assertPalworldPakCandidateOutputDirectory(
    input.outputDirectory
  );
  try {
    await stat(outputDirectory);
    fail("candidate output 디렉터리가 이미 존재합니다. 덮어쓰지 않습니다.");
  } catch (error) {
    if (error instanceof PalworldPakImportError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const outputParent = path.dirname(outputDirectory);
  await mkdir(outputParent, { recursive: true });
  const outputParentInfo = await lstat(outputParent);
  if (
    outputParentInfo.isSymbolicLink()
    || !outputParentInfo.isDirectory()
    || await realpath(outputParent) !== outputParent
  ) {
    fail("candidate output parent는 symlink가 아닌 canonical directory여야 합니다.");
  }
  const staging = await mkdtemp(path.join(outputParent, ".palworld-pak-candidate-"));
  const preflight = await inspectPalworldPakArchive(input.archivePath);
  if (preflight.archive.sha256 !== input.expectedArchiveSha256) {
    await rm(staging, { recursive: true, force: true });
    fail("preflight archive SHA-256이 고정 입력과 일치하지 않습니다.");
  }
  const candidateId = `candidate-${input.expectedArchiveSha256.slice(0, 16)}`;
  const publicIdMap = parsePublicIdMap(input.mappings.publicIdMap);
  const publicIds = publicIdMap.entries;
  const aliases = parseAliases(
    input.mappings.aliases,
    input.expectedArchiveSha256,
    candidateId
  );
  const iconOverrides = parseIconOverrides(
    input.mappings.palIconOverrides,
    input.expectedArchiveSha256,
    candidateId
  );
  const elementIconMap = parseSimpleAssetMap(
    input.mappings.elementIconMap,
    "elementIconMap",
    input.expectedArchiveSha256,
    candidateId
  );
  const workIconMap = parseWorkAssetMap(
    input.mappings.workIconMap,
    input.expectedArchiveSha256,
    candidateId
  );
  const skillIconMap = parseSkillAssetMap(
    input.mappings.skillIconMap,
    input.expectedArchiveSha256,
    candidateId
  );
  const publicActiveSkillAllowlist = parsePublicActiveSkillAllowlist(
    input.mappings.publicActiveSkillAllowlist,
    input.expectedArchiveSha256,
    candidateId
  );
  const reviewedExclusions = parseExclusions(
    input.mappings.exclusions,
    input.expectedArchiveSha256,
    candidateId
  );
  const reviewedExclusionKeys = new Set(
    reviewedExclusions.map((entry) => `${entry.domain}\0${entry.sourceRowId}`)
  );
  const usedReviewedExclusionKeys = new Set<string>();
  const hasReviewedExclusion = (domain: string, sourceRowId: string): boolean => {
    const key = `${domain}\0${sourceRowId}`;
    if (!reviewedExclusionKeys.has(key)) return false;
    usedReviewedExclusionKeys.add(key);
    return true;
  };
  const mappingChecksums = {
    publicIdMap: sha256(deterministicJson(input.mappings.publicIdMap)),
    aliases: sha256(deterministicJson(input.mappings.aliases)),
    palIconOverrides: sha256(deterministicJson(input.mappings.palIconOverrides)),
    elementIconMap: sha256(deterministicJson(input.mappings.elementIconMap)),
    workIconMap: sha256(deterministicJson(input.mappings.workIconMap)),
    skillIconMap: sha256(deterministicJson(input.mappings.skillIconMap)),
    publicActiveSkillAllowlist: sha256(
      deterministicJson(input.mappings.publicActiveSkillAllowlist)
    ),
    exclusions: sha256(deterministicJson(input.mappings.exclusions)),
    legacySkillCatalog: sha256(deterministicJson(input.mappings.legacySkillCatalog))
  };
  const legacySkillCatalog = assertPalworldCatalogArtifact(
    input.mappings.legacySkillCatalog
  );
  const metadata = input.metadata === undefined
    ? undefined
    : assertPalworldPakExportMetadata(input.metadata);

  try {
    const result = await withPalworldPakArchive(
      input.archivePath,
      { expectedSha256: input.expectedArchiveSha256 },
      async (reader) => {
        const sourceFiles = new Map<string, CandidateSourceFile>();
        const tableCache = new Map<string, JsonRecord>();
        const readTable = async (member: string): Promise<JsonRecord> => {
          const cached = tableCache.get(member);
          if (cached) return cached;
          const bytes = await reader.readBytes(member);
          let parsed: unknown;
          try {
            parsed = JSON.parse(bytes.toString("utf8")) as unknown;
          } catch {
            fail(`${member}: JSON을 파싱할 수 없습니다.`);
          }
          if (!Array.isArray(parsed)) fail(`${member}: FModel DataTable 최상위 값은 배열이어야 합니다.`);
          const table = parsed.find((entry) => isRecord(entry) && isRecord(entry.Rows));
          if (!isRecord(table) || !isRecord(table.Rows)) fail(`${member}: DataTable Rows를 찾을 수 없습니다.`);
          if (Object.keys(table.Rows).length > MAX_RECORDS) fail(`${member}: row 수가 안전 제한을 초과합니다.`);
          sourceFiles.set(member, { member, sha256: sha256(bytes), bytes: bytes.length });
          tableCache.set(member, table.Rows);
          return table.Rows;
        };

        const [
          palRows,
          palBpClassRows,
          palIconRows,
          palDropRows,
          itemRows,
          itemIconRows,
          recipeRows,
          technologyRows,
          activeSkillRows,
          activeAssignmentRows,
          eggAssignmentRows,
          passiveSkillRows,
          partnerParameterRows,
          specialBreedingRows,
          worldMapRows,
          koLocale,
          jaLocale,
          enLocale
        ] = await Promise.all([
          readTable(TABLES.pals),
          readTable(TABLES.palBpClasses),
          readTable(TABLES.palIcons),
          readTable(TABLES.palDrops),
          readTable(TABLES.items),
          readTable(TABLES.itemIcons),
          readTable(TABLES.recipes),
          readTable(TABLES.technology),
          readTable(TABLES.activeSkills),
          readTable(TABLES.activeAssignments),
          readTable(TABLES.activeEggAssignments),
          readTable(TABLES.passiveSkills),
          readTable(TABLES.partnerParameters),
          readTable(TABLES.specialBreeding),
          readTable(TABLES.worldMap),
          readPalworldPakOfficialLocale(reader, "ko"),
          readPalworldPakOfficialLocale(reader, "ja"),
          readPalworldPakOfficialLocale(reader, "en")
        ]);

        for (const locale of [koLocale, jaLocale, enLocale]) {
          for (const record of locale.records) {
            sourceFiles.set(record.sourceMember, {
              member: record.sourceMember,
              sha256: record.sourceMemberSha256,
              bytes: reader.members.find((member) => member.name === record.sourceMember)?.uncompressedBytes ?? 0
            });
          }
        }

        const canonical = canonicalPalRows(palRows);
        if (canonical.raw.length !== preflight.data.rawPalRows || canonical.canonical.length !== preflight.data.canonicalPals) {
          fail("canonical Pal count가 preflight와 일치하지 않습니다.");
        }
        const candidatePublicIds = new Set<string>();
        const palIdByInternal = new Map<string, string>();
        let reviewedPublicIdCount = 0;
        let generatedPublicIdCount = 0;
        for (const pal of canonical.canonical) {
          const publicIdSource = applyAlias(aliases, "public_id_source", pal.tribe);
          const reviewedPublicId = publicIds.get(publicIdSource);
          const candidatePublicId = reviewedPublicId ?? `pak-${kebabFromInternal(pal.tribe)}`;
          if (reviewedPublicId === undefined) generatedPublicIdCount += 1;
          else reviewedPublicIdCount += 1;
          if (candidatePublicIds.has(candidatePublicId)) fail(`${candidatePublicId}: candidate Pal ID가 충돌합니다.`);
          candidatePublicIds.add(candidatePublicId);
          palIdByInternal.set(pal.tribe, candidatePublicId);
        }
        for (const sourceInternalId of iconOverrides.keys()) {
          if (!palIdByInternal.has(sourceInternalId)) {
            fail(`${sourceInternalId}: palIconOverrides가 알 수 없는 canonical Pal을 참조합니다.`);
          }
        }
        const palNameKeys = new Map<string, string>();
        for (const pal of canonical.canonical) {
          palNameKeys.set(
            pal.tribe,
            applyAlias(
              aliases,
              "pal_name_message_key",
              optionalTextId(
                pal.value.OverrideNameTextID,
                `PAL_NAME_${pal.tribe}`,
                `${pal.rowName}.OverrideNameTextID`
              )
            )
          );
        }
        for (const [sourceRowId, raw] of Object.entries(palRows)) {
          if (!isRecord(raw) || !INTERNAL_ID_PATTERN.test(sourceRowId)) continue;
          const tribe = typeof raw.Tribe === "string"
            ? enumSuffix(raw.Tribe, `${sourceRowId}.Tribe`)
            : sourceRowId;
          const key = applyAlias(
            aliases,
            "pal_name_message_key",
            optionalTextId(raw.OverrideNameTextID, `PAL_NAME_${tribe}`, `${sourceRowId}.OverrideNameTextID`)
          );
          if (!palNameKeys.has(sourceRowId)) palNameKeys.set(sourceRowId, key);
        }

        const allItemRows = Object.entries(itemRows)
          .map(([sourceInternalId, raw]): [string, JsonRecord] => {
            if (!isRecord(raw)) fail(`${TABLES.items}.${sourceInternalId}: row가 객체가 아닙니다.`);
            return [sourceInternalId, raw];
          })
          .sort(([left], [right]) => left.localeCompare(right, "en"));
        const excludedItemRows = allItemRows
          .filter(([, row]) => row.bLegalInGame !== true)
          .map(([sourceInternalId, row]) => ({
            sourceInternalId,
            sourceLegalFlag: typeof row.bLegalInGame === "boolean"
              ? row.bLegalInGame
              : null,
            reason: row.bLegalInGame === false
              ? "bLegalInGame_false" as const
              : "bLegalInGame_not_true" as const
          }));
        const legalItemRows = allItemRows
          .filter((entry): entry is [string, JsonRecord] => entry[1].bLegalInGame === true)
          .sort(([left], [right]) => left.localeCompare(right, "en"));
        if (legalItemRows.length !== preflight.data.legalItems) fail("legal item count가 preflight와 일치하지 않습니다.");
        const itemIdByInternal = new Map<string, string>();
        const itemCandidateIds = new Set<string>();
        for (const [sourceInternalId] of legalItemRows) {
          const canonicalInternalId = internalId(sourceInternalId, `items.${sourceInternalId}`);
          const candidateItemId = kebabFromInternal(canonicalInternalId);
          if (itemCandidateIds.has(candidateItemId)) fail(`${candidateItemId}: candidate item ID가 충돌합니다.`);
          itemCandidateIds.add(candidateItemId);
          itemIdByInternal.set(canonicalInternalId, candidateItemId);
        }
        const itemNameKeys = new Map<string, string>();
        for (const [sourceInternalId, raw] of Object.entries(itemRows)) {
          if (!isRecord(raw) || !INTERNAL_ID_PATTERN.test(sourceInternalId)) continue;
          itemNameKeys.set(
            sourceInternalId,
            applyAlias(
              aliases,
              "item_name_message_key",
              optionalTextId(
                raw.OverrideName,
                `ITEM_NAME_${sourceInternalId}`,
                `${sourceInternalId}.OverrideName`
              )
            )
          );
        }

        const sourceActiveRows = Object.entries(activeSkillRows)
          .filter((entry): entry is [string, JsonRecord] => isRecord(entry[1]) && entry[1].DisabledData !== true)
          .sort(([left], [right]) => left.localeCompare(right, "en"));
        const activeSkillIdByInternal = new Map<string, string>();
        const activeSkillNameKeys = new Map<string, string>();
        const activeSourceIds = new Set<string>();
        for (const [rowId, row] of Object.entries(activeSkillRows)) {
          if (!isRecord(row)) continue;
          const sourceInternalId = enumSuffix(row.WazaType, `${rowId}.WazaType`);
          const messageKey = applyAlias(
            aliases,
            "active_skill_name_message_key",
            `ACTION_SKILL_${sourceInternalId}`
          );
          activeSkillNameKeys.set(sourceInternalId, messageKey);
          if (row.DisabledData === true) continue;
          if (activeSourceIds.has(sourceInternalId)) fail(`${sourceInternalId}: active skill WazaType이 중복됩니다.`);
          activeSourceIds.add(sourceInternalId);
          activeSkillIdByInternal.set(sourceInternalId, `active:${sourceInternalId}`);
        }
        if (sourceActiveRows.length !== preflight.data.activeSkillRows) {
          fail("active skill source count가 preflight와 일치하지 않습니다.");
        }

        const allPassiveSkillRows = Object.entries(passiveSkillRows)
          .map(([sourceRowId, raw]): [string, JsonRecord] => {
            if (!isRecord(raw)) {
              fail(`${TABLES.passiveSkills}.${sourceRowId}: row가 객체가 아닙니다.`);
            }
            return [sourceRowId, raw];
          });
        const visiblePassiveRows = allPassiveSkillRows
          .filter((entry): entry is [string, JsonRecord] =>
            entry[1].Category === "EPalPassiveCategory::SortDisplayable"
          )
          .sort(([left], [right]) => left.localeCompare(right, "en"));
        const excludedPassiveSkillRows = allPassiveSkillRows
          .filter(([, row]) => row.Category !== "EPalPassiveCategory::SortDisplayable")
          .map(([sourceRowId, row]) => ({
            sourceRowId,
            sourceCategory: typeof row.Category === "string"
              ? row.Category
              : null,
            reason: "category_not_sort_displayable" as const
          }))
          .sort((left, right) => left.sourceRowId.localeCompare(right.sourceRowId, "en"));
        const resolvers = {
          ko: referenceResolvers({ locale: koLocale, palNameKeys, itemNameKeys, activeSkillNameKeys, aliases }),
          ja: referenceResolvers({ locale: jaLocale, palNameKeys, itemNameKeys, activeSkillNameKeys, aliases }),
          en: referenceResolvers({ locale: enLocale, palNameKeys, itemNameKeys, activeSkillNameKeys, aliases })
        };
        const unresolvedRichText = {
          ko: { value: 0 },
          ja: { value: 0 },
          en: { value: 0 }
        };

        const dropsByPal = new Map<string, unknown[]>();
        const dropPalIdsByItem = new Map<string, Set<string>>();
        const orphanDropItems = new Set<string>();
        for (const [sourceRowId, raw] of Object.entries(palDropRows)) {
          if (!isRecord(raw)) fail(`${TABLES.palDrops}.${sourceRowId}: row가 객체가 아닙니다.`);
          const palInternalId = applyAlias(
            aliases,
            "drop_pal_reference",
            internalId(raw.CharacterID, `${sourceRowId}.CharacterID`)
          );
          if (!palIdByInternal.has(palInternalId)) continue;
          const drops = [];
          for (let slot = 1; slot <= 10; slot += 1) {
            const itemValue = raw[`ItemId${slot}`];
            if (typeof itemValue !== "string" || NONE_VALUES.has(itemValue)) continue;
            const itemInternalId = applyAlias(
              aliases,
              "drop_item_reference",
              internalId(itemValue, `${sourceRowId}.ItemId${slot}`)
            );
            const itemId = itemIdByInternal.get(itemInternalId);
            if (!itemId) orphanDropItems.add(itemInternalId);
            const dropPalId = palIdByInternal.get(palInternalId);
            if (itemId !== undefined && dropPalId !== undefined) {
              const palIds = dropPalIdsByItem.get(itemInternalId) ?? new Set<string>();
              palIds.add(dropPalId);
              dropPalIdsByItem.set(itemInternalId, palIds);
            }
            drops.push({
              sourceRowId,
              itemSourceInternalId: itemInternalId,
              itemId: itemId ?? null,
              rate: finiteNumber(raw[`Rate${slot}`], `${sourceRowId}.Rate${slot}`, 0, 100),
              min: integer(raw[`min${slot}`], `${sourceRowId}.min${slot}`, 0, 1_000_000),
              max: integer(raw[`Max${slot}`], `${sourceRowId}.Max${slot}`, 0, 1_000_000)
            });
          }
          dropsByPal.set(palInternalId, [...(dropsByPal.get(palInternalId) ?? []), ...drops]);
        }
        for (const [palInternalId, drops] of dropsByPal) {
          dropsByPal.set(palInternalId, stableUnknownArray(drops));
        }

        const pals = canonical.canonical.map((pal) => {
          const sourceInternalId = pal.tribe;
          const id = palIdByInternal.get(sourceInternalId)!;
          const nameKey = palNameKeys.get(sourceInternalId)!;
          const descriptionKey = applyAlias(
            aliases,
            "pal_description_message_key",
            `PAL_LONG_DESC_${sourceInternalId}`
          );
          const firstActivatedInfoKey = applyAlias(
            aliases,
            "pal_first_activated_message_key",
            `PAL_FIRST_SPAWN_DESC_${sourceInternalId}`
          );
          const partnerSkillNameKey = applyAlias(
            aliases,
            "partner_skill_message_key",
            optionalTextId(
              pal.value.OverridePartnerSkillNameTextID,
              `PARTNERSKILL_${sourceInternalId}`,
              `${pal.rowName}.OverridePartnerSkillNameTextID`
            )
          );
          const partnerParameterCandidate = applyAlias(
            aliases,
            "partner_parameter_source",
            sourceInternalId
          );
          const partnerParameterSourceRowId = Object.hasOwn(partnerParameterRows, pal.rowName)
            ? pal.rowName
            : Object.hasOwn(partnerParameterRows, partnerParameterCandidate)
              ? partnerParameterCandidate
              : null;
          const partnerRankVariable = partnerRankVariableResolver(
            partnerParameterSourceRowId === null
              ? undefined
              : partnerParameterRows[partnerParameterSourceRowId],
            passiveSkillRows
          );
          const partnerResolvers = partnerRankVariable === undefined
              ? resolvers
              : {
                  ko: { ...resolvers.ko, rankVariable: partnerRankVariable },
                  ja: { ...resolvers.ja, rankVariable: partnerRankVariable },
                  en: { ...resolvers.en, rankVariable: partnerRankVariable }
                };
          const partnerDescription = localizedValue(
            firstActivatedInfoKey,
            "pal_first_activated",
            koLocale,
            jaLocale,
            enLocale,
            true,
            partnerResolvers,
            unresolvedRichText
          );
          const sourceElements = [pal.value.ElementType1, pal.value.ElementType2]
            .map((value, index) => enumSuffix(value, `${pal.rowName}.ElementType${index + 1}`));
          const elements = [pal.value.ElementType1, pal.value.ElementType2]
            .flatMap((value, index) => {
              const element = canonicalElement(value, `${pal.rowName}.ElementType${index + 1}`);
              return element === null ? [] : [element];
            });
          const works = WORK_FIELDS.flatMap(([type, sourceField]) => {
            const level = pal.value[sourceField];
            if (level === undefined) return [];
            const numericLevel = integer(level, `${pal.rowName}.${sourceField}`, 0, 10);
            return numericLevel === 0 ? [] : [{ type, level: numericLevel }];
          });
          const sourceOnlyWorks = SOURCE_ONLY_WORK_FIELDS.flatMap(([type, sourceField]) => {
            const level = pal.value[sourceField];
            if (level === undefined) return [];
            const numericLevel = integer(level, `${pal.rowName}.${sourceField}`, 0, 10);
            return numericLevel === 0 ? [] : [{ type, level: numericLevel, sourceField }];
          });
          const bpClassRow = palBpClassRows[sourceInternalId] ?? palBpClassRows[pal.rowName];
          const bpClassAsset = isRecord(bpClassRow) ? assetMember(bpClassRow.BPClass) : undefined;
          return {
            id,
            idStatus: publicIds.has(applyAlias(aliases, "public_id_source", sourceInternalId))
              ? "existing_exact"
              : "candidate_internal_id",
            canonicalJoinRule: pal.rowName === sourceInternalId
              ? "source_row_equals_tribe"
              : "source_row_equals_bpclass",
            sourceRowId: pal.rowName,
            sourceInternalId,
            tribe: sourceInternalId,
            bpClass: stringValue(pal.value.BPClass, `${pal.rowName}.BPClass`, 256),
            bpClassAsset: bpClassAsset ?? null,
            number: integer(pal.value.ZukanIndex, `${pal.rowName}.ZukanIndex`, 1, 100_000),
            suffix: typeof pal.value.ZukanIndexSuffix === "string" ? pal.value.ZukanIndexSuffix : "",
            variantType: String(pal.value.ZukanIndexSuffix ?? "").length === 0 ? "normal" : "variant",
            rarity: integer(pal.value.Rarity, `${pal.rowName}.Rarity`, 0, 100),
            elements,
            sourceElements,
            stats: {
              hp: finiteNumber(pal.value.Hp, `${pal.rowName}.Hp`, 0, 1_000_000),
              meleeAttack: finiteNumber(pal.value.MeleeAttack, `${pal.rowName}.MeleeAttack`, 0, 1_000_000),
              shotAttack: finiteNumber(pal.value.ShotAttack, `${pal.rowName}.ShotAttack`, 0, 1_000_000),
              defense: finiteNumber(pal.value.Defense, `${pal.rowName}.Defense`, 0, 1_000_000),
              walkSpeed: finiteNumber(pal.value.WalkSpeed, `${pal.rowName}.WalkSpeed`, 0, 100_000),
              runSpeed: finiteNumber(pal.value.RunSpeed, `${pal.rowName}.RunSpeed`, -1, 100_000),
              rideSprintSpeed: finiteNumber(
                pal.value.RideSprintSpeed,
                `${pal.rowName}.RideSprintSpeed`,
                -1,
                100_000
              ),
              stamina: finiteNumber(pal.value.Stamina, `${pal.rowName}.Stamina`, 0, 100_000),
              food: finiteNumber(pal.value.FoodAmount, `${pal.rowName}.FoodAmount`, 0, 100_000)
            },
            nocturnal: pal.value.Nocturnal === true,
            workSuitabilities: works,
            sourceOnlyWorkSuitabilities: sourceOnlyWorks,
            partnerSkill: {
              id: `partner:${id}`,
              name: localizedValue(
                partnerSkillNameKey,
                "skill_name",
                koLocale,
                jaLocale,
                enLocale,
                false,
                resolvers,
                unresolvedRichText
              ),
              parameterSourceRowId: partnerParameterSourceRowId,
              description: partnerDescription
            },
            activeSkillAssignmentIds: [] as string[],
            drops: dropsByPal.get(sourceInternalId) ?? [],
            breeding: {
              combiRank: integer(pal.value.CombiRank, `${pal.rowName}.CombiRank`, 0, 1_000_000),
              combiDuplicatePriority: integer(
                pal.value.CombiDuplicatePriority,
                `${pal.rowName}.CombiDuplicatePriority`,
                0,
                1_000_000_000
              ),
              ignoreCombi: pal.value.IgnoreCombi === true,
              maleProbability: finiteNumber(
                pal.value.MaleProbability,
                `${pal.rowName}.MaleProbability`,
                0,
                100
              )
            },
            name: localizedValue(
              nameKey,
              "pal_name",
              koLocale,
              jaLocale,
              enLocale,
              false,
              resolvers,
              unresolvedRichText
            ),
            description: localizedValue(
              descriptionKey,
              "pal_description",
              koLocale,
              jaLocale,
              enLocale,
              true,
              resolvers,
              unresolvedRichText
            ),
            firstActivatedInfo: partnerDescription
          };
        }).sort((left, right) => left.id.localeCompare(right.id, "en"));
        const palByInternal = new Map(pals.map((pal) => [pal.sourceInternalId, pal]));

        type CandidateActiveAssignment = {
          sourceRowId: string;
          palSourceInternalId: string;
          palId: string | null;
          activeSkillSourceInternalId: string;
          activeSkillId: string | null;
          level: number | null;
          sourceTable: string;
          status:
            | "resolved"
            | "noncanonical_pal_excluded"
            | "nonpublic_pal_excluded"
            | "source_pal_missing_excluded"
            | "pal_reference_unresolved"
            | "skill_reference_unresolved";
        };
        const parseAssignmentRows = (
          sourceTable: string,
          rows: JsonRecord,
          publishToCanonicalPals: boolean
        ): CandidateActiveAssignment[] => {
          const records: CandidateActiveAssignment[] = [];
          for (const [sourceRowId, raw] of Object.entries(rows)) {
            if (!isRecord(raw)) fail(`${sourceTable}.${sourceRowId}: row가 객체가 아닙니다.`);
            const rawPalSourceInternalId = stringValue(raw.PalId, `${sourceRowId}.PalId`, 160);
            const palSourceInternalId = applyAlias(
              aliases,
              "active_assignment_pal_reference",
              rawPalSourceInternalId
            );
            const activeSkillSourceInternalId = enumSuffix(raw.WazaID, `${sourceRowId}.WazaID`);
            const pal = publishToCanonicalPals ? palByInternal.get(palSourceInternalId) : undefined;
            const activeSkillId = activeSkillIdByInternal.get(activeSkillSourceInternalId) ?? null;
            const sourcePalRow = palRows[rawPalSourceInternalId];
            const sourcePalTribe = isRecord(sourcePalRow) && typeof sourcePalRow.Tribe === "string"
              ? enumSuffix(sourcePalRow.Tribe, `${sourceRowId}.sourcePal.Tribe`)
              : undefined;
            const status = pal === undefined
              ? sourcePalTribe !== undefined && palIdByInternal.has(sourcePalTribe)
                ? "noncanonical_pal_excluded" as const
                : palworldPakSourcePalVisibility(sourcePalRow) === "nonpublic"
                  ? "nonpublic_pal_excluded" as const
                  : palworldPakSourcePalVisibility(sourcePalRow) === "missing"
                    && hasReviewedExclusion(
                      "active_assignment_source_pal_missing",
                      rawPalSourceInternalId
                    )
                    ? "source_pal_missing_excluded" as const
                    : "pal_reference_unresolved" as const
              : activeSkillId === null
                ? "skill_reference_unresolved" as const
                : "resolved" as const;
            records.push({
              sourceRowId,
              palSourceInternalId,
              palId: pal?.id ?? null,
              activeSkillSourceInternalId,
              activeSkillId,
              level: raw.Level === undefined
                ? null
                : integer(raw.Level, `${sourceRowId}.Level`, 0, 1_000),
              sourceTable,
              status
            });
            if (pal && activeSkillId) pal.activeSkillAssignmentIds.push(activeSkillId);
          }
          return records.sort((left, right) =>
            left.sourceRowId.localeCompare(right.sourceRowId, "en")
            || left.palSourceInternalId.localeCompare(right.palSourceInternalId, "en")
            || left.activeSkillSourceInternalId.localeCompare(
              right.activeSkillSourceInternalId,
              "en"
            )
          );
        };
        const assignmentRecords = parseAssignmentRows(
          TABLES.activeAssignments,
          activeAssignmentRows,
          true
        );
        const staleActiveAssignmentSourceExclusions = reviewedExclusions
          .filter((entry) => entry.domain === "active_assignment_source_pal_missing")
          .filter((entry) =>
            !usedReviewedExclusionKeys.has(`${entry.domain}\0${entry.sourceRowId}`)
          );
        if (staleActiveAssignmentSourceExclusions.length > 0) {
          fail(
            "exclusions: active assignment source-missing 검수 항목이 현재 입력에 적용되지 않습니다: "
              + staleActiveAssignmentSourceExclusions
                .map((entry) => entry.sourceRowId)
                .join(", ")
          );
        }
        const eggAssignmentRecords = parseAssignmentRows(
          TABLES.activeEggAssignments,
          eggAssignmentRows,
          false
        );
        const resolvedActiveAssignmentSourceIds = new Set(
          assignmentRecords
            .filter((assignment) => assignment.status === "resolved")
            .map((assignment) => assignment.activeSkillSourceInternalId)
        );
        const nonAllowlistedCanonicalAssignments = [...resolvedActiveAssignmentSourceIds]
          .filter((sourceInternalId) => !publicActiveSkillAllowlist.has(sourceInternalId))
          .sort((left, right) => left.localeCompare(right, "en"));
        if (nonAllowlistedCanonicalAssignments.length > 0) {
          fail(
            "publicActiveSkillAllowlist: canonical Pal에 배정된 active skill이 allowlist에서 누락되었습니다: "
              + nonAllowlistedCanonicalAssignments.join(", ")
          );
        }
        const koSkillNames = officialLocaleLookup(koLocale, "skill_name");
        const jaSkillNames = officialLocaleLookup(jaLocale, "skill_name");
        const publicActiveRows = sourceActiveRows.filter(([sourceRowId, row]) => {
          const sourceInternalId = enumSuffix(row.WazaType, `${sourceRowId}.WazaType`);
          const policy = publicActiveSkillAllowlist.get(sourceInternalId);
          if (policy === undefined) return false;
          const nameMessageKey = activeSkillNameKeys.get(sourceInternalId);
          if (
            policy.sourceRowId !== sourceRowId
            || policy.sourceInternalId !== sourceInternalId
            || policy.nameMessageKey !== nameMessageKey
          ) {
            fail(
              `publicActiveSkillAllowlist.${sourceInternalId}: source row, internal ID 또는 name message key가 일치하지 않습니다.`
            );
          }
          if (!resolvedActiveAssignmentSourceIds.has(sourceInternalId)) {
            fail(
              `publicActiveSkillAllowlist.${sourceInternalId}: canonical Pal의 resolved assignment가 없습니다.`
            );
          }
          if (
            !koSkillNames.has(policy.nameMessageKey)
            || !jaSkillNames.has(policy.nameMessageKey)
          ) {
            fail(
              `publicActiveSkillAllowlist.${sourceInternalId}: placeholder가 아닌 공식 KO·JA 이름이 모두 필요합니다.`
            );
          }
          return true;
        });
        if (publicActiveRows.length !== publicActiveSkillAllowlist.size) {
          fail("publicActiveSkillAllowlist: source active skill과 exact join되지 않은 entry가 있습니다.");
        }
        const publicActiveSkillIds = new Set(
          publicActiveRows.map(([sourceRowId, row]) =>
            activeSkillIdByInternal.get(enumSuffix(row.WazaType, `${sourceRowId}.WazaType`))!
          )
        );
        for (const assignment of [...assignmentRecords, ...eggAssignmentRecords]) {
          if (
            assignment.activeSkillId !== null
            && !publicActiveSkillIds.has(assignment.activeSkillId)
          ) {
            assignment.activeSkillId = null;
          }
        }
        for (const pal of pals) {
          pal.activeSkillAssignmentIds = [...new Set(pal.activeSkillAssignmentIds)]
            .filter((skillId) => publicActiveSkillIds.has(skillId))
            .sort((left, right) => left.localeCompare(right, "en"));
        }
        const excludedActiveSkillRows = sourceActiveRows
          .filter(([sourceRowId, row]) =>
            !publicActiveSkillAllowlist.has(
              enumSuffix(row.WazaType, `${sourceRowId}.WazaType`)
            )
          )
          .map(([sourceRowId, row]) => ({
            sourceRowId,
            sourceInternalId: enumSuffix(row.WazaType, `${sourceRowId}.WazaType`),
            reason: "not_in_reviewed_public_allowlist" as const,
            canonicalAssignment: false
          }))
          .sort((left, right) =>
            left.sourceInternalId.localeCompare(right.sourceInternalId, "en")
          );

        const recipesByProduct = new Map<string, unknown[]>();
        const recipeProductBySourceRowId = new Map<string, string>();
        const orphanRecipeReferences = new Set<string>();
        const orphanRecipeProducts = new Set<string>();
        const excludedIllegalRecipeProducts: Array<{
          sourceRowId: string;
          productSourceInternalId: string;
          reason: "product_item_not_legal_in_game";
        }> = [];
        const excludedRecipeSourceRowIds = new Set<string>();
        for (const [sourceRowId, raw] of Object.entries(recipeRows)) {
          if (!isRecord(raw)) fail(`${TABLES.recipes}.${sourceRowId}: row가 객체가 아닙니다.`);
          const productInternalId = applyAlias(
            aliases,
            "recipe_item_reference",
            internalId(raw.Product_Id, `${sourceRowId}.Product_Id`)
          );
          if (!itemIdByInternal.has(productInternalId)) {
            const sourceProduct = itemRows[productInternalId];
            if (isRecord(sourceProduct) && sourceProduct.bLegalInGame !== true) {
              excludedIllegalRecipeProducts.push({
                sourceRowId,
                productSourceInternalId: productInternalId,
                reason: "product_item_not_legal_in_game"
              });
              excludedRecipeSourceRowIds.add(sourceRowId);
              continue;
            }
            orphanRecipeProducts.add(productInternalId);
            continue;
          }
          recipeProductBySourceRowId.set(sourceRowId, productInternalId);
          const materials = [];
          for (let slot = 1; slot <= 5; slot += 1) {
            const materialValue = raw[`Material${slot}_Id`];
            if (typeof materialValue !== "string" || materialValue === "None") continue;
            const materialInternalId = applyAlias(
              aliases,
              "recipe_item_reference",
              internalId(materialValue, `${sourceRowId}.Material${slot}_Id`)
            );
            const materialId = itemIdByInternal.get(materialInternalId);
            if (!materialId) orphanRecipeReferences.add(materialInternalId);
            materials.push({
              sourceInternalId: materialInternalId,
              itemId: materialId ?? null,
              count: integer(
                raw[`Material${slot}_Count`],
                `${sourceRowId}.Material${slot}_Count`,
                0,
                1_000_000
              )
            });
          }
          const recipe = {
            sourceRowId,
            resultCount: integer(raw.Product_Count, `${sourceRowId}.Product_Count`, 1, 100_000_000),
            workAmount: finiteNumber(raw.WorkAmount, `${sourceRowId}.WorkAmount`, 0, 1_000_000_000_000),
            materials
          };
          recipesByProduct.set(productInternalId, [...(recipesByProduct.get(productInternalId) ?? []), recipe]);
        }

        const technologyByItem = new Map<string, unknown[]>();
        const orphanTechnologyRecipeRows = new Set<string>();
        const excludedIllegalTechnologyRecipeRows: Array<{
          sourceRowId: string;
          recipeSourceRowId: string;
          reason: "recipe_product_item_not_legal_in_game";
        }> = [];
        const technologySourceRowAudit: Array<{
          sourceRowId: string;
          referencedRecipes: number;
          publishedLinks: number;
          excludedIllegalLinks: number;
          unresolvedLinks: number;
          status: "published" | "partially_published" | "excluded" | "unresolved" | "empty";
        }> = [];
        for (const [sourceRowId, raw] of Object.entries(technologyRows)) {
          if (!isRecord(raw)) fail(`${TABLES.technology}.${sourceRowId}: row가 객체가 아닙니다.`);
          if (!Array.isArray(raw.UnlockItemRecipes)) fail(`${sourceRowId}.UnlockItemRecipes: 배열이어야 합니다.`);
          let referencedRecipes = 0;
          let publishedLinks = 0;
          let excludedIllegalLinks = 0;
          let unresolvedLinks = 0;
          for (const rawRecipeId of raw.UnlockItemRecipes) {
            if (typeof rawRecipeId !== "string" || rawRecipeId === "None") continue;
            referencedRecipes += 1;
            const recipeSourceRowId = applyAlias(
              aliases,
              "technology_recipe_reference",
              internalId(rawRecipeId, `${sourceRowId}.UnlockItemRecipes`)
            );
            const itemInternalId = recipeProductBySourceRowId.get(recipeSourceRowId);
            if (itemInternalId === undefined) {
              if (excludedRecipeSourceRowIds.has(recipeSourceRowId)) {
                excludedIllegalTechnologyRecipeRows.push({
                  sourceRowId,
                  recipeSourceRowId,
                  reason: "recipe_product_item_not_legal_in_game"
                });
                excludedIllegalLinks += 1;
                continue;
              }
              orphanTechnologyRecipeRows.add(recipeSourceRowId);
              unresolvedLinks += 1;
              continue;
            }
            const entry = {
              sourceRowId,
              unlockLevel: integer(raw.LevelCap, `${sourceRowId}.LevelCap`, 0, 1_000),
              tier: integer(raw.Tier, `${sourceRowId}.Tier`, 0, 1_000),
              cost: integer(raw.Cost, `${sourceRowId}.Cost`, 0, 1_000_000)
            };
            technologyByItem.set(
              itemInternalId,
              [...(technologyByItem.get(itemInternalId) ?? []), entry]
            );
            publishedLinks += 1;
          }
          technologySourceRowAudit.push({
            sourceRowId,
            referencedRecipes,
            publishedLinks,
            excludedIllegalLinks,
            unresolvedLinks,
            status: referencedRecipes === 0
              ? "empty"
              : publishedLinks === referencedRecipes
                ? "published"
                : publishedLinks > 0
                  ? "partially_published"
                  : unresolvedLinks > 0
                    ? "unresolved"
                    : "excluded"
          });
        }
        technologySourceRowAudit.sort((left, right) =>
          left.sourceRowId.localeCompare(right.sourceRowId, "en")
        );

        const items = legalItemRows.map(([sourceInternalId, row]) => {
          const nameKey = itemNameKeys.get(sourceInternalId)!;
          const descriptionKey = optionalTextId(
            row.OverrideDescription,
            `ITEM_DESC_${sourceInternalId}`,
            `${sourceInternalId}.OverrideDescription`
          );
          const canonicalDescriptionKey = applyAlias(
            aliases,
            "item_description_message_key",
            descriptionKey
          );
          const iconName = typeof row.IconName === "string" && row.IconName !== "None"
            ? applyAlias(
                aliases,
                "item_icon_reference",
                internalId(row.IconName, `${sourceInternalId}.IconName`)
              )
            : null;
          const iconRow = iconName === null ? undefined : itemIconRows[iconName];
          return {
            id: itemIdByInternal.get(sourceInternalId)!,
            sourceInternalId,
            typeA: enumSuffix(row.TypeA, `${sourceInternalId}.TypeA`),
            typeB: enumSuffix(row.TypeB, `${sourceInternalId}.TypeB`),
            rarity: integer(row.Rarity, `${sourceInternalId}.Rarity`, 0, 100),
            rank: integer(row.Rank, `${sourceInternalId}.Rank`, 0, 100_000),
            maxStack: integer(row.MaxStackCount, `${sourceInternalId}.MaxStackCount`, 0, 100_000_000),
            weight: finiteNumber(row.Weight, `${sourceInternalId}.Weight`, 0, 1_000_000),
            price: finiteNumber(row.Price, `${sourceInternalId}.Price`, 0, 1_000_000_000_000),
            durability: finiteNumber(row.Durability, `${sourceInternalId}.Durability`, 0, 1_000_000_000),
            legalInGame: true,
            iconName,
            iconSourceMember: isRecord(iconRow) ? assetMember(iconRow.Icon) ?? null : null,
            recipes: stableUnknownArray(recipesByProduct.get(sourceInternalId) ?? []),
            technology: stableUnknownArray(technologyByItem.get(sourceInternalId) ?? []),
            dropPalIds: [...(dropPalIdsByItem.get(sourceInternalId) ?? [])]
              .sort((left, right) => left.localeCompare(right, "en")),
            name: localizedValue(
              nameKey,
              "item_name",
              koLocale,
              jaLocale,
              enLocale,
              false,
              resolvers,
              unresolvedRichText
            ),
            description: localizedValue(
              canonicalDescriptionKey,
              "item_description",
              koLocale,
              jaLocale,
              enLocale,
              true,
              resolvers,
              unresolvedRichText
            )
          };
        }).sort((left, right) => left.id.localeCompare(right.id, "en"));

        const activeSkills = publicActiveRows.map(([sourceRowId, row]) => {
          const sourceInternalId = enumSuffix(row.WazaType, `${sourceRowId}.WazaType`);
          const messageKey = applyAlias(
            aliases,
            "active_skill_name_message_key",
            `ACTION_SKILL_${sourceInternalId}`
          );
          return {
            id: activeSkillIdByInternal.get(sourceInternalId)!,
            sourceRowId,
            sourceInternalId,
            type: "active",
            sourceElement: enumSuffix(row.Element, `${sourceRowId}.Element`),
            element: canonicalElement(row.Element, `${sourceRowId}.Element`),
            power: finiteNumber(row.DisplayPower ?? row.Power, `${sourceRowId}.DisplayPower`, 0, 1_000_000),
            cooldownSeconds: finiteNumber(row.CoolTime, `${sourceRowId}.CoolTime`, 0, 100_000),
            relatedPalIds: [...new Set(
              assignmentRecords
                .filter((assignment) => assignment.activeSkillId === activeSkillIdByInternal.get(sourceInternalId))
                .flatMap((assignment) => assignment.palId === null ? [] : [assignment.palId])
            )].sort((left, right) => left.localeCompare(right, "en")),
            name: localizedValue(
              messageKey,
              "skill_name",
              koLocale,
              jaLocale,
              enLocale,
              false,
              resolvers,
              unresolvedRichText
            ),
            description: localizedValue(
              applyAlias(
                aliases,
                "active_skill_description_message_key",
                `ACTION_SKILL_${sourceInternalId}`
              ),
              "skill_description",
              koLocale,
              jaLocale,
              enLocale,
              true,
              resolvers,
              unresolvedRichText
            )
          };
        });
        const passiveSkills = visiblePassiveRows.map(([sourceInternalId, row]) => {
          const nameKey = optionalTextId(
            row.OverrideNameTextID,
            `PASSIVE_${sourceInternalId}`,
            `${sourceInternalId}.OverrideNameTextID`
          );
          const descriptionKey = optionalTextId(
            row.OverrideDescMsgID,
            nameKey,
            `${sourceInternalId}.OverrideDescMsgID`
          );
          const effects = [1, 2, 3, 4].flatMap((slot) => {
            const type = enumSuffix(row[`EffectType${slot}`], `${sourceInternalId}.EffectType${slot}`);
            if (type === "no" || type === "None") return [];
            return [{
              type,
              value: finiteNumber(
                row[`EffectValue${slot}`],
                `${sourceInternalId}.EffectValue${slot}`,
                -1_000_000,
                1_000_000
              ),
              target: enumSuffix(row[`TargetType${slot}`], `${sourceInternalId}.TargetType${slot}`)
            }];
          });
          const passiveResolvers = {
            ko: {
              ...resolvers.ko,
              rankVariable: passiveRankVariableResolver(row)
            },
            ja: {
              ...resolvers.ja,
              rankVariable: passiveRankVariableResolver(row)
            },
            en: {
              ...resolvers.en,
              rankVariable: passiveRankVariableResolver(row)
            }
          };
          return {
            id: `passive:${sourceInternalId}`,
            sourceRowId: sourceInternalId,
            sourceInternalId,
            type: "passive",
            rank: integer(row.Rank, `${sourceInternalId}.Rank`, -100, 100),
            effects,
            name: localizedValue(
              nameKey,
              "skill_name",
              koLocale,
              jaLocale,
              enLocale,
              false,
              resolvers,
              unresolvedRichText
            ),
            description: localizedValue(
              descriptionKey,
              "skill_description",
              koLocale,
              jaLocale,
              enLocale,
              true,
              passiveResolvers,
              unresolvedRichText
            )
          };
        });
        const partnerSkills = pals.map((pal) => ({
          id: pal.partnerSkill.id,
          sourceRowId: pal.partnerSkill.parameterSourceRowId,
          sourceInternalId: pal.sourceInternalId,
          type: "partner",
          relatedPalIds: [pal.id],
          name: pal.partnerSkill.name,
          description: pal.partnerSkill.description
        }));
        const skills = [...activeSkills, ...passiveSkills, ...partnerSkills]
          .sort((left, right) => left.id.localeCompare(right.id, "en"));
        const candidateSkillsById = new Map(skills.map((skill) => [skill.id, skill]));
        for (const [index, mapping] of skillIconMap.entries.entries()) {
          if (!candidateSkillsById.has(mapping.id)) {
            fail(`skillIconMap.entries[${index}].id: canonical skill이 아닙니다.`);
          }
          if (!reader.has(mapping.sourceMember)) {
            fail(`skillIconMap.entries[${index}].sourceMember: archive에 없습니다.`);
          }
        }
        const skillIdMigration = legacySkillCatalog.skills
          .map((legacySkill) => {
            const exactCandidate = candidateSkillsById.get(legacySkill.id);
            return exactCandidate?.type === legacySkill.type
              ? {
                  legacyId: legacySkill.id,
                  legacyType: legacySkill.type,
                  candidateId: exactCandidate.id,
                  status: "mapped_exact_id" as const
                }
              : {
                  legacyId: legacySkill.id,
                  legacyType: legacySkill.type,
                  candidateId: null,
                  status: "unresolved" as const,
                  reason: "legacy_source_internal_id_not_available" as const
                };
          })
          .sort((left, right) => left.legacyId.localeCompare(right.legacyId, "en"));
        const unresolvedSkillIdMigrations = skillIdMigration
          .filter((entry) => entry.status === "unresolved").length;

        const unresolvedSpecialRows: Array<{
          sourceRowId: string;
          parentA: string;
          parentB: string;
          child: string;
          reason: string;
        }> = [];
        const sourceMissingSpecialRows: Array<{
          sourceRowId: string;
          parentA: string;
          parentB: string;
          child: string;
          missingSourceInternalIds: string[];
          reason: "source_pal_row_missing";
        }> = [];
        const excludedSpecialRows: Array<{
          sourceRowId: string;
          parentA: string;
          parentB: string;
          child: string;
          excludedSourceInternalIds: string[];
          reason: "nonpublic_pal_relation";
        }> = [];
        const specialRules = [];
        const duplicateSpecialRows: Array<{
          sourceRowId: string;
          duplicateOfSourceRowId: string;
          childId: string;
          reason: "duplicate_identical_special_condition";
        }> = [];
        const conditionKeys = new Map<string, { childId: string; sourceRowId: string }>();
        for (const [sourceRowId, raw] of Object.entries(specialBreedingRows)
          .sort(([left], [right]) => left.localeCompare(right, "en"))) {
          if (!isRecord(raw)) fail(`${TABLES.specialBreeding}.${sourceRowId}: row가 객체가 아닙니다.`);
          const rawParentA = enumSuffix(raw.ParentTribeA, `${sourceRowId}.ParentTribeA`);
          const rawParentB = enumSuffix(raw.ParentTribeB, `${sourceRowId}.ParentTribeB`);
          const rawChild = internalId(raw.ChildCharacterID, `${sourceRowId}.ChildCharacterID`);
          const parentAInternal = applyAlias(
            aliases,
            "breeding_pal_reference",
            rawParentA
          );
          const parentBInternal = applyAlias(
            aliases,
            "breeding_pal_reference",
            rawParentB
          );
          const childInternal = applyAlias(
            aliases,
            "breeding_pal_reference",
            rawChild
          );
          const parentAId = palIdByInternal.get(parentAInternal);
          const parentBId = palIdByInternal.get(parentBInternal);
          const childId = palIdByInternal.get(childInternal);
          if (!parentAId || !parentBId || !childId) {
            const unresolvedReferences = [
              { sourceInternalId: parentAInternal, publicId: parentAId },
              { sourceInternalId: parentBInternal, publicId: parentBId },
              { sourceInternalId: childInternal, publicId: childId }
            ].filter((reference) => reference.publicId === undefined);
            const nonpublicSourceInternalIds = [...new Set(
              unresolvedReferences
                .filter((reference) =>
                  palworldPakSourcePalVisibility(
                    palRows[reference.sourceInternalId]
                  ) === "nonpublic"
                )
                .map((reference) => reference.sourceInternalId)
            )].sort((left, right) => left.localeCompare(right, "en"));
            if (unresolvedReferences.every((reference) =>
              palworldPakSourcePalVisibility(
                palRows[reference.sourceInternalId]
              ) === "nonpublic"
            )) {
              excludedSpecialRows.push({
                sourceRowId,
                parentA: rawParentA,
                parentB: rawParentB,
                child: rawChild,
                excludedSourceInternalIds: nonpublicSourceInternalIds,
                reason: "nonpublic_pal_relation"
              });
              continue;
            }
            const missingSourceInternalIds = [...new Set(
              unresolvedReferences
                .filter((reference) =>
                  palworldPakSourcePalVisibility(
                    palRows[reference.sourceInternalId]
                  ) === "missing"
                )
                .map((reference) => reference.sourceInternalId)
            )].sort((left, right) => left.localeCompare(right, "en"));
            if (missingSourceInternalIds.length > 0) {
              sourceMissingSpecialRows.push({
                sourceRowId,
                parentA: rawParentA,
                parentB: rawParentB,
                child: rawChild,
                missingSourceInternalIds,
                reason: "source_pal_row_missing"
              });
              continue;
            }
            unresolvedSpecialRows.push({
              sourceRowId,
              parentA: rawParentA,
              parentB: rawParentB,
              child: rawChild,
              reason: "canonical_pal_exact_join_missing"
            });
            continue;
          }
          const parentAGender = gender(raw.ParentGenderA, `${sourceRowId}.ParentGenderA`);
          const parentBGender = gender(raw.ParentGenderB, `${sourceRowId}.ParentGenderB`);
          const ordered = parentAId <= parentBId
            ? [parentAId, parentBId, parentAGender, parentBGender] as const
            : [parentBId, parentAId, parentBGender, parentAGender] as const;
          const conditionKey = `${ordered[0]}\0${ordered[1]}\0${ordered[2] ?? ""}\0${ordered[3] ?? ""}`;
          const previous = conditionKeys.get(conditionKey);
          if (previous !== undefined && previous.childId !== childId) {
            fail(`${sourceRowId}: 동일한 특수 교배 조건에 서로 다른 결과가 있습니다.`);
          }
          if (previous !== undefined) {
            duplicateSpecialRows.push({
              sourceRowId,
              duplicateOfSourceRowId: previous.sourceRowId,
              childId,
              reason: "duplicate_identical_special_condition"
            });
            continue;
          }
          conditionKeys.set(conditionKey, { childId, sourceRowId });
          specialRules.push({
            sourceRowId,
            parentAId,
            parentASourceInternalId: parentAInternal,
            parentBId,
            parentBSourceInternalId: parentBInternal,
            childId,
            childSourceInternalId: childInternal,
            ...(parentAGender === undefined ? {} : { parentAGender }),
            ...(parentBGender === undefined ? {} : { parentBGender }),
            special: true
          });
        }
        specialRules.sort((left, right) =>
          left.parentAId.localeCompare(right.parentAId, "en")
          || left.parentBId.localeCompare(right.parentBId, "en")
          || (left.parentAGender ?? "").localeCompare(right.parentAGender ?? "", "en")
          || (left.parentBGender ?? "").localeCompare(right.parentBGender ?? "", "en")
          || left.childId.localeCompare(right.childId, "en")
          || left.sourceRowId.localeCompare(right.sourceRowId, "en")
        );
        excludedSpecialRows.sort((left, right) =>
          left.sourceRowId.localeCompare(right.sourceRowId, "en")
        );
        sourceMissingSpecialRows.sort((left, right) =>
          left.sourceRowId.localeCompare(right.sourceRowId, "en")
        );
        const breedingParameters = pals.map((pal) => ({
          palId: pal.id,
          sourceRowId: pal.sourceRowId,
          sourceInternalId: pal.sourceInternalId,
          tribe: pal.tribe,
          bpClass: pal.bpClass,
          combiRank: pal.breeding.combiRank,
          combiDuplicatePriority: pal.breeding.combiDuplicatePriority,
          ignoreCombi: pal.breeding.ignoreCombi,
          maleProbability: pal.breeding.maleProbability,
          variantType: pal.variantType
        })).sort((left, right) => left.palId.localeCompare(right.palId, "en"));
        const computedBreedingResults = countComputedBreedingResults(
          breedingParameters.map((parameter) => ({
            id: parameter.palId,
            combiRank: parameter.combiRank,
            combiDuplicatePriority: parameter.combiDuplicatePriority,
            ignoreCombi: parameter.ignoreCombi,
            variantType: parameter.variantType as "normal" | "variant"
          })),
          specialRules
        );

        const imageAssets: PalworldPakCandidateImageAsset[] = [];
        const imageAssetFailures: Array<{
          id: string;
          kind: PalworldPakCandidateImageAsset["kind"];
          sourceMember: string;
          code: "PALWORLD_PAK_ASSET_INVALID";
        }> = [];
        const importImage = async (
          request: Parameters<typeof importPalworldPakPngAsset>[0]
        ): Promise<void> => {
          try {
            imageAssets.push(await importPalworldPakPngAsset(request));
          } catch (error) {
            if (!(error instanceof PalworldPakAssetError)) throw error;
            imageAssetFailures.push({
              id: request.id,
              kind: request.kind,
              sourceMember: request.memberName,
              code: error.code
            });
          }
        };
        const missingPalImages: string[] = [];
        const availableWorkIconMembers = reader.members
          .map((entry) => entry.name)
          .filter((name) =>
            /^Pal\/Texture\/UI\/InGame\/SkillIcon\/T_icon_skill_pal_WorkRank_[A-Za-z0-9_]+\.png$/u.test(name)
          )
          .sort((left, right) => left.localeCompare(right, "en"));
        if (
          JSON.stringify(availableWorkIconMembers)
          !== JSON.stringify(workIconMap.availableSourceMembers)
        ) {
          fail("workIconMap.availableSourceMembers: archive의 실제 source 목록과 일치하지 않습니다.");
        }
        const palIconMemberByInternal = new Map<string, string>();
        for (const pal of canonical.canonical) {
          const iconRow = palIconRows[pal.tribe] ?? palIconRows[pal.rowName];
          const fromTable = isRecord(iconRow) ? assetMember(iconRow.Icon) : undefined;
          const member = fromTable !== undefined && reader.has(fromTable)
            ? fromTable
            : iconOverrides.get(pal.tribe);
          if (member !== undefined && reader.has(member)) palIconMemberByInternal.set(pal.tribe, member);
          else missingPalImages.push(pal.tribe);
        }
        if (input.includeAssets !== false) {
          for (const pal of pals) {
            const member = palIconMemberByInternal.get(pal.sourceInternalId);
            if (!member) continue;
            await importImage({
              reader,
              memberName: member,
              id: pal.id,
              kind: "pal",
              outputRoot: staging,
              maximumOutputDimension: 512
            });
          }
          for (const item of items) {
            if (item.iconSourceMember === null || !reader.has(item.iconSourceMember)) continue;
            await importImage({
              reader,
              memberName: item.iconSourceMember,
              id: item.id,
              kind: "item",
              outputRoot: staging,
              maximumOutputDimension: 512
            });
          }
          for (const mapping of elementIconMap) {
            if (!reader.has(mapping.sourceMember)) continue;
            await importImage({
              reader,
              memberName: mapping.sourceMember,
              id: mapping.id,
              kind: "element",
              outputRoot: staging,
              maximumOutputDimension: 128
            });
          }
          for (const mapping of workIconMap.entries) {
            if (!reader.has(mapping.sourceMember)) {
              fail(`${mapping.sourceMember}: 검증된 work icon source가 archive에 없습니다.`);
            }
            await importImage({
              reader,
              memberName: mapping.sourceMember,
              id: mapping.id,
              kind: "work",
              outputRoot: staging,
              maximumOutputDimension: 128
            });
          }
          for (const mapping of skillIconMap.entries) {
            await importImage({
              reader,
              memberName: mapping.sourceMember,
              id: mapping.id,
              kind: "skill",
              outputRoot: staging,
              maximumOutputDimension: 128
            });
          }
          const mainMap = worldMapRows.MainMap;
          const textureData = isRecord(mainMap) && Array.isArray(mainMap.textureDataMap)
            ? mainMap.textureDataMap[0]
            : undefined;
          const mapMember = isRecord(textureData)
            && isRecord(textureData.Value)
            ? assetMember(textureData.Value.Texture)
            : undefined;
          if (mapMember && reader.has(mapMember)) {
            for (const size of [4096, 2048] as const) {
              await importImage({
                reader,
                memberName: mapMember,
                id: `world-map-${size}`,
                kind: "map",
                outputRoot: staging,
                maximumOutputDimension: size
              });
            }
          }
        }

        for (const asset of imageAssets) {
          sourceFiles.set(asset.sourceMember, {
            member: asset.sourceMember,
            sha256: asset.sourceSha256,
            bytes: reader.members.find((member) => member.name === asset.sourceMember)?.uncompressedBytes ?? 0
          });
        }
        const palImageAssets = imageAssets.filter((asset) => asset.kind === "pal");
        const itemImageAssets = imageAssets.filter((asset) => asset.kind === "item");
        const elementImageAssets = imageAssets.filter((asset) => asset.kind === "element");
        const workImageAssets = imageAssets.filter((asset) => asset.kind === "work");
        const skillImageAssets = imageAssets.filter((asset) => asset.kind === "skill");
        const mapImageAssets = imageAssets.filter((asset) => asset.kind === "map");
        const successfulPalImageIds = new Set(palImageAssets.map((asset) => asset.id));
        const successfulItemImageIds = new Set(itemImageAssets.map((asset) => asset.id));
        const availableSkillIconMembers = reader.members
          .map((entry) => entry.name)
          .filter((name) => /\/T_icon_skill_pal_[A-Za-z0-9_]+\.png$/u.test(name))
          .sort((left, right) => left.localeCompare(right, "en"));
        const mappedSkillIconMembers = new Set(
          skillIconMap.entries.map((entry) => entry.sourceMember)
        );
        const unreferencedSkillIconMembers = availableSkillIconMembers
          .filter((member) => !mappedSkillIconMembers.has(member));
        const availablePalIconMembers = reader.members
          .map((entry) => entry.name)
          .filter((name) => /^Pal\/Texture\/PalIcon\/Normal\/.+\.png$/u.test(name))
          .sort((left, right) => left.localeCompare(right, "en"));
        const referencedPalIconMembers = new Set(palIconMemberByInternal.values());
        const unreferencedPalIconMembers = availablePalIconMembers
          .filter((member) => !referencedPalIconMembers.has(member));
        const rawPalIconResolutionCounts = new Map<string, number>();
        const rawPalIconValidationFailures: string[] = [];
        for (const member of availablePalIconMembers) {
          try {
            const info = validatePalworldPakPngBytes(await reader.readBytes(member), 4_096);
            const key = `${info.width}x${info.height}`;
            rawPalIconResolutionCounts.set(
              key,
              (rawPalIconResolutionCounts.get(key) ?? 0) + 1
            );
          } catch (error) {
            if (!(error instanceof PalworldPakAssetError)) throw error;
            rawPalIconValidationFailures.push(member);
          }
        }

        const candidateMetadata = {
          candidateId,
          sourceType: "operator_pak_export" as const,
          release: metadata?.gameVersion ?? null,
          gameVersion: metadata?.gameVersion ?? null,
          steamBuildId: metadata?.steamBuildId ?? null,
          fmodelVersion: metadata?.fmodelVersion ?? null,
          exportedAt: metadata?.exportedAt ?? null,
          mappingsSha256: metadata?.mappingsSha256 ?? null
        };
        const sourceIncludedFiles = [...sourceFiles.values()]
          .filter((file) => file.bytes > 0)
          .sort((left, right) =>
            left.member < right.member ? -1 : left.member > right.member ? 1 : 0
          );
        const provenance = assertPalworldSourceProvenance({
          id: `operator_pak_export:${input.expectedArchiveSha256.slice(0, 16)}`,
          type: "operator_pak_export",
          archiveSha256: input.expectedArchiveSha256,
          gameVersion: metadata?.gameVersion ?? null,
          steamBuildId: metadata?.steamBuildId ?? null,
          fmodelVersion: metadata?.fmodelVersion ?? null,
          exportedAt: metadata?.exportedAt ?? null,
          mappingsSha256: metadata?.mappingsSha256 ?? null,
          includedFiles: sourceIncludedFiles,
          rightsVerified: false,
          usageBasis: "operator_reference_use"
        });
        const common = {
          schemaVersion: 1,
          candidateId,
          release: metadata?.gameVersion ?? null,
          metadata: candidateMetadata,
          provenance
        };
        const artifacts = [];
        artifacts.push(await writeArtifact(staging, "paldex.json", {
          ...common,
          records: pals,
          exclusions: canonical.exclusions
        }));
        artifacts.push(await writeArtifact(staging, "items.json", {
          ...common,
          records: items
        }));
        artifacts.push(await writeArtifact(staging, "skills.json", {
          ...common,
          records: skills,
          assignments: assignmentRecords,
          excludedEggAssignments: eggAssignmentRecords
        }));
        artifacts.push(await writeArtifact(staging, "breeding.json", {
          ...common,
          parameters: breedingParameters,
          specialRules,
          excludedSourceRows: excludedSpecialRows,
          sourceMissingSourceRows: sourceMissingSpecialRows,
          duplicateSourceRows: duplicateSpecialRows,
          unresolvedSourceRows: unresolvedSpecialRows,
          computedResultCount: computedBreedingResults
        }));
        artifacts.push(await writeArtifact(staging, "locales/ko.json", {
          ...common,
          ...koLocale
        }));
        artifacts.push(await writeArtifact(staging, "locales/ja.json", {
          ...common,
          ...jaLocale
        }));
        artifacts.push(await writeArtifact(staging, "locales/en.json", {
          ...common,
          ...enLocale
        }));
        artifacts.push(await writeArtifact(staging, "assets-manifest.json", {
          ...common,
          status: "candidate_incomplete",
          importMode: input.includeAssets === false ? "validation_only" : "converted",
          transform: PALWORLD_PAK_IMAGE_TRANSFORM,
          images: imageAssets,
          failures: imageAssetFailures,
          missing: {
            pals: pals
              .filter((pal) => !successfulPalImageIds.has(pal.id))
              .map((pal) => pal.sourceInternalId),
            items: items
              .filter((item) => !successfulItemImageIds.has(item.id))
              .map((item) => item.id),
            work: workIconMap.status,
            skillUnmappedCount: skills.length - skillImageAssets.length
          },
          unmappedSourceImages: {
            skillIcons: unreferencedSkillIconMembers,
            palIcons: unreferencedPalIconMembers
          }
        }));
        artifacts.push(await writeArtifact(staging, "map-manifest.json", {
          ...common,
          status: mapImageAssets.length === 2 ? "candidate" : "blocked",
          variants: mapImageAssets
        }));

        const allLocalizedRecords = [
          ...pals,
          ...items,
          ...skills.filter((skill) => skill.description !== null)
        ] as Array<{ name: CandidateLocalizedValue; description?: CandidateLocalizedValue }>;
        const localeCoverage = {
          ko: localeFieldCounts(allLocalizedRecords, "ko"),
          ja: localeFieldCounts(allLocalizedRecords, "ja"),
          en: localeFieldCounts(allLocalizedRecords, "en"),
          placeholdersExcluded: {
            ko: koLocale.coverage.placeholderRows,
            ja: jaLocale.coverage.placeholderRows,
            en: enLocale.coverage.placeholderRows
          },
          unresolvedRichText: {
            ko: unresolvedRichText.ko.value,
            ja: unresolvedRichText.ja.value,
            en: unresolvedRichText.en.value
          }
        };
        const localeValueAvailable = (
          value: CandidateLocalizedValue | null | undefined,
          locale: "ko" | "ja" | "en",
          requireResolvedRichText = false
        ): boolean => value?.[locale] !== null
          && value?.[locale] !== undefined
          && (
            !requireResolvedRichText
            || value[
              locale === "ko"
                ? "koRichTextStatus"
                : locale === "ja"
                  ? "jaRichTextStatus"
                  : "enRichTextStatus"
            ] === "resolved"
          );
        const domainLocaleCoverage = {
          pals: {
            records: pals.length,
            koNames: pals.filter((pal) => localeValueAvailable(pal.name, "ko")).length,
            jaNames: pals.filter((pal) => localeValueAvailable(pal.name, "ja")).length,
            enNames: pals.filter((pal) => localeValueAvailable(pal.name, "en")).length,
            koDescriptionsSource: pals.filter((pal) => pal.description.ko !== null).length,
            jaDescriptionsSource: pals.filter((pal) => pal.description.ja !== null).length,
            enDescriptionsSource: pals.filter((pal) => pal.description.en !== null).length,
            koDescriptionsDisplayable: pals.filter((pal) =>
              localeValueAvailable(pal.description, "ko", true)
            ).length,
            jaDescriptionsDisplayable: pals.filter((pal) =>
              localeValueAvailable(pal.description, "ja", true)
            ).length,
            enDescriptionsDisplayable: pals.filter((pal) =>
              localeValueAvailable(pal.description, "en", true)
            ).length,
            koPartnerNames: pals.filter((pal) =>
              localeValueAvailable(pal.partnerSkill.name, "ko")
            ).length,
            jaPartnerNames: pals.filter((pal) =>
              localeValueAvailable(pal.partnerSkill.name, "ja")
            ).length,
            enPartnerNames: pals.filter((pal) =>
              localeValueAvailable(pal.partnerSkill.name, "en")
            ).length,
            koPartnerDescriptionsDisplayable: pals.filter((pal) =>
              localeValueAvailable(pal.partnerSkill.description, "ko", true)
            ).length,
            jaPartnerDescriptionsDisplayable: pals.filter((pal) =>
              localeValueAvailable(pal.partnerSkill.description, "ja", true)
            ).length,
            enPartnerDescriptionsDisplayable: pals.filter((pal) =>
              localeValueAvailable(pal.partnerSkill.description, "en", true)
            ).length
          },
          items: {
            records: items.length,
            koNames: items.filter((item) => localeValueAvailable(item.name, "ko")).length,
            jaNames: items.filter((item) => localeValueAvailable(item.name, "ja")).length,
            enNames: items.filter((item) => localeValueAvailable(item.name, "en")).length,
            koDescriptionsSource: items.filter((item) => item.description.ko !== null).length,
            jaDescriptionsSource: items.filter((item) => item.description.ja !== null).length,
            enDescriptionsSource: items.filter((item) => item.description.en !== null).length,
            koDescriptionsDisplayable: items.filter((item) =>
              localeValueAvailable(item.description, "ko", true)
            ).length,
            jaDescriptionsDisplayable: items.filter((item) =>
              localeValueAvailable(item.description, "ja", true)
            ).length,
            enDescriptionsDisplayable: items.filter((item) =>
              localeValueAvailable(item.description, "en", true)
            ).length
          },
          skills: {
            records: skills.length,
            koNames: skills.filter((skill) => localeValueAvailable(skill.name, "ko")).length,
            jaNames: skills.filter((skill) => localeValueAvailable(skill.name, "ja")).length,
            enNames: skills.filter((skill) => localeValueAvailable(skill.name, "en")).length,
            koDescriptionsSource: skills.filter((skill) => skill.description?.ko != null).length,
            jaDescriptionsSource: skills.filter((skill) => skill.description?.ja != null).length,
            enDescriptionsSource: skills.filter((skill) => skill.description?.en != null).length,
            koDescriptionsDisplayable: skills.filter((skill) =>
              localeValueAvailable(skill.description, "ko", true)
            ).length,
            jaDescriptionsDisplayable: skills.filter((skill) =>
              localeValueAvailable(skill.description, "ja", true)
            ).length,
            enDescriptionsDisplayable: skills.filter((skill) =>
              localeValueAvailable(skill.description, "en", true)
            ).length
          }
        };
        const detailCoverage = {
          pals: {
            records: pals.length,
            stats: pals.filter((pal) => Object.values(pal.stats).every(Number.isFinite)).length,
            workSuitabilityRows: pals.length,
            partnerSkillNames: pals.filter((pal) =>
              pal.partnerSkill.name.ko !== null || pal.partnerSkill.name.ja !== null
            ).length,
            partnerSkillParameters: pals.filter((pal) =>
              pal.partnerSkill.parameterSourceRowId !== null
            ).length,
            activeSkillAssignments: pals.filter((pal) =>
              pal.activeSkillAssignmentIds.length > 0
            ).length,
            drops: pals.filter((pal) => pal.drops.length > 0).length,
            breedingFields: pals.filter((pal) =>
              Number.isFinite(pal.breeding.combiRank)
              && Number.isFinite(pal.breeding.combiDuplicatePriority)
              && Number.isFinite(pal.breeding.maleProbability)
            ).length
          },
          items: {
            records: items.length,
            recipes: items.filter((item) => item.recipes.length > 0).length,
            technology: items.filter((item) => item.technology.length > 0).length,
            dropPalReferences: items.filter((item) => item.dropPalIds.length > 0).length,
            price: items.filter((item) => Number.isFinite(item.price)).length,
            durability: items.filter((item) => item.durability > 0).length,
            craftingFacility: 0,
            acquisitionMethod: 0
          },
          skills: {
            records: skills.length,
            sourceInternalId: skills.filter((skill) => skill.sourceInternalId.length > 0).length,
            descriptionsKoDisplayable: skills.filter((skill) =>
              localeValueAvailable(skill.description, "ko", true)
            ).length,
            descriptionsJaDisplayable: skills.filter((skill) =>
              localeValueAvailable(skill.description, "ja", true)
            ).length,
            relatedPals: skills.filter((skill) =>
              "relatedPalIds" in skill && skill.relatedPalIds.length > 0
            ).length
          }
        };
        const richTextIssues: Array<{
          entityKind: "pal" | "item" | "skill";
          entityId: string;
          field: string;
          locale: "ko" | "ja" | "en";
          code: string;
          referenceId?: string;
        }> = [];
        const collectRichTextIssues = (
          entityKind: "pal" | "item" | "skill",
          entityId: string,
          field: string,
          value: CandidateLocalizedValue | null | undefined
        ): void => {
          for (const locale of ["ko", "ja", "en"] as const) {
            const result = value?.[
              locale === "ko"
                ? "koRichText"
                : locale === "ja"
                  ? "jaRichText"
                  : "enRichText"
            ];
            for (const issue of result?.unresolved ?? []) {
              richTextIssues.push({
                entityKind,
                entityId,
                field,
                locale,
                code: issue.code,
                ...(issue.id === undefined ? {} : { referenceId: issue.id })
              });
            }
          }
        };
        for (const pal of pals) {
          collectRichTextIssues("pal", pal.id, "description", pal.description);
          collectRichTextIssues("pal", pal.id, "partnerSkill.description", pal.partnerSkill.description);
        }
        for (const item of items) {
          collectRichTextIssues("item", item.id, "description", item.description);
        }
        for (const skill of skills) {
          collectRichTextIssues("skill", skill.id, "description", skill.description);
        }
        richTextIssues.sort((left, right) =>
          left.entityKind.localeCompare(right.entityKind, "en")
          || left.entityId.localeCompare(right.entityId, "en")
          || left.field.localeCompare(right.field, "en")
          || left.locale.localeCompare(right.locale, "en")
          || left.code.localeCompare(right.code, "en")
          || (left.referenceId ?? "").localeCompare(right.referenceId ?? "", "en")
        );
        const importedImageResolutionDistribution = [...imageAssets.reduce(
          (distribution, asset) => {
            const key = `${asset.kind}:${asset.sourceWidth}x${asset.sourceHeight}`;
            distribution.set(key, (distribution.get(key) ?? 0) + 1);
            return distribution;
          },
          new Map<string, number>()
        )].map(([key, count]) => ({ key, count }))
          .sort((left, right) => left.key.localeCompare(right.key, "en"));
        const sourceImageResolutionDistribution = {
          rawPalIcons: [...rawPalIconResolutionCounts]
            .map(([resolution, count]) => ({ resolution, count }))
            .sort((left, right) => left.resolution.localeCompare(right.resolution, "en")),
          imported: importedImageResolutionDistribution
        };
        const sourceReferenceGaps = {
          palIcons: {
            sourceTableReferenced: preflight.assets.palIcons.sourceTableReferenced,
            sourceTableExactMatches: preflight.assets.palIcons.sourceTableExactMatches,
            missing: preflight.assets.palIcons.sourceTableMissing,
            rawInputFiles: availablePalIconMembers.length,
            canonicalIncludedFiles: referencedPalIconMembers.size,
            unreferencedFiles: unreferencedPalIconMembers,
            validationFailures: rawPalIconValidationFailures
          },
          itemIcons: {
            sourceTableReferenced: preflight.assets.itemIcons.referenced,
            sourceTableExactMatches: preflight.assets.itemIcons.exactMatches,
            missingIconRows: preflight.assets.itemIcons.missingIconRows,
            missingRoots: preflight.assets.itemIcons.missingRoots,
            reason: preflight.assets.itemIcons.exactMatches === 0
              ? "referenced_source_png_roots_not_exported"
              : "partial_source_png_export"
          }
        };
        const imageCoverage = {
          pals: {
            available: palImageAssets.length,
            missing: pals.length - palImageAssets.length,
            total: pals.length
          },
          items: {
            available: itemImageAssets.length,
            missing: items.length - itemImageAssets.length,
            total: items.length
          },
          elements: {
            available: elementImageAssets.length,
            missing: elementIconMap.length - elementImageAssets.length,
            total: elementIconMap.length
          },
          work: {
            available: workImageAssets.length,
            missing: workIconMap.availableSourceMembers.length - workImageAssets.length,
            total: workIconMap.availableSourceMembers.length
          },
          skills: {
            available: skillImageAssets.length,
            missing: skills.length - skillImageAssets.length,
            total: skills.length
          },
          map: {
            available: mapImageAssets.length === 2 ? 1 : 0,
            missing: mapImageAssets.length === 2 ? 0 : 1,
            total: 1
          }
        };
        const adjustedPreflightBlockers = preflight.gates.blockers.filter((blocker) => {
          if (blocker === "EXPORT_METADATA_NOT_PROVIDED" && metadata !== undefined) return false;
          if (
            blocker === "PAL_ICON_EXPORT_INCOMPLETE"
            && missingPalImages.length === 0
            && preflight.assets.palIcons.sourceTableMissing.length === 0
          ) return false;
          return true;
        });
        const blockers = [...new Set([
          ...adjustedPreflightBlockers,
          ...(metadata === undefined ? ["EXPORT_METADATA_NOT_PROVIDED"] : []),
          ...(metadata !== undefined
            && preflight.mappings.status === "provided"
            && metadata.mappingsSha256 !== preflight.mappings.actualSha256
            ? ["MAPPINGS_CHECKSUM_MISMATCH"]
            : []),
          ...(metadata === undefined || publicIdMap.release !== metadata.gameVersion
            ? ["PUBLIC_ID_MAPPING_RELEASE_UNVERIFIED"]
            : []),
          ...(generatedPublicIdCount > 0
            ? ["PUBLIC_ID_MAPPING_INCOMPLETE"]
            : []),
          ...(unresolvedSkillIdMigrations > 0
            ? ["SKILL_ID_MIGRATION_INCOMPLETE"]
            : []),
          ...(sourceMissingSpecialRows.length > 0
            || unresolvedSpecialRows.length > 0
            ? ["SPECIAL_BREEDING_REFERENCE_UNRESOLVED"]
            : []),
          ...(orphanDropItems.size > 0 ? ["DROP_ITEM_REFERENCE_UNRESOLVED"] : []),
          ...(orphanRecipeReferences.size + orphanRecipeProducts.size > 0
            ? ["RECIPE_ITEM_REFERENCE_UNRESOLVED"]
            : []),
          ...(orphanTechnologyRecipeRows.size > 0
            ? ["TECHNOLOGY_RECIPE_REFERENCE_UNRESOLVED"]
            : []),
          ...(assignmentRecords.some((assignment) =>
            assignment.status === "skill_reference_unresolved"
            || assignment.status === "pal_reference_unresolved"
          ) ? ["ACTIVE_SKILL_ASSIGNMENT_REFERENCE_UNRESOLVED"] : []),
          ...(pals.some((pal) => pal.activeSkillAssignmentIds.length === 0)
            ? ["ACTIVE_SKILL_ASSIGNMENT_COVERAGE_INCOMPLETE"]
            : []),
          ...(pals.some((pal) => pal.partnerSkill.parameterSourceRowId === null)
            ? ["PARTNER_SKILL_PARAMETER_INCOMPLETE"]
            : []),
          ...(unresolvedRichText.ko.value
            + unresolvedRichText.ja.value
            + unresolvedRichText.en.value > 0
            ? ["RICH_TEXT_TOKEN_UNRESOLVED"]
            : []),
          ...(input.includeAssets === false ? ["ASSET_IMPORT_SKIPPED"] : []),
          ...(imageAssetFailures.length > 0 ? ["IMAGE_ASSET_VALIDATION_FAILED"] : []),
          ...(input.includeAssets !== false && palImageAssets.length !== pals.length
            ? ["PAL_IMAGE_IMPORT_INCOMPLETE"]
            : []),
          ...(workIconMap.status !== "verified"
            || workImageAssets.length !== workIconMap.availableSourceMembers.length
            ? ["WORK_ICON_SEMANTIC_MAPPING_NOT_VERIFIED"]
            : []),
          ...(skillIconMap.status !== "verified"
            || skillImageAssets.length !== skills.length
            ? ["SKILL_ICON_SEMANTIC_MAPPING_NOT_VERIFIED"]
            : [])
        ])].sort((left, right) => left.localeCompare(right, "en"));
        const counts = {
          rawPalRows: canonical.raw.length,
          canonicalPals: pals.length,
          excludedPalRows: canonical.exclusions.length,
          reviewedPublicIds: reviewedPublicIdCount,
          generatedPublicIds: generatedPublicIdCount,
          rawItemRows: allItemRows.length,
          legalItems: items.length,
          excludedItemRows: excludedItemRows.length,
          activeSkills: activeSkills.length,
          sourcePassiveSkills: allPassiveSkillRows.length,
          visiblePassiveSkills: passiveSkills.length,
          excludedPassiveSkills: excludedPassiveSkillRows.length,
          partnerSkills: partnerSkills.length,
          legacySkills: skillIdMigration.length,
          mappedLegacySkills: skillIdMigration.length - unresolvedSkillIdMigrations,
          unresolvedLegacySkills: unresolvedSkillIdMigrations,
          activeAssignments: assignmentRecords.length,
          resolvedActiveAssignments: assignmentRecords
            .filter((assignment) => assignment.status === "resolved").length,
          excludedActiveAssignments: assignmentRecords
            .filter((assignment) => assignment.status !== "resolved").length,
          publicResolvedActiveAssignments: assignmentRecords
            .filter((assignment) => assignment.status === "resolved").length,
          publicExcludedActiveAssignments: assignmentRecords
            .filter((assignment) =>
              assignment.status === "noncanonical_pal_excluded"
              || assignment.status === "nonpublic_pal_excluded"
            ).length,
          sourceMissingActiveAssignments: assignmentRecords
            .filter((assignment) =>
              assignment.status === "source_pal_missing_excluded"
            ).length,
          unresolvedActiveAssignments: assignmentRecords
            .filter((assignment) =>
              assignment.status === "pal_reference_unresolved"
              || assignment.status === "skill_reference_unresolved"
            ).length,
          eggAssignments: eggAssignmentRecords.length,
          palsWithActiveAssignments: pals
            .filter((pal) => pal.activeSkillAssignmentIds.length > 0).length,
          palsWithoutActiveAssignments: pals
            .filter((pal) => pal.activeSkillAssignmentIds.length === 0).length,
          sourceSpecialBreedingRows: Object.keys(specialBreedingRows).length,
          resolvedSpecialBreedingRules: specialRules.length,
          publicResolvedSpecialBreedingRows: specialRules.length,
          publicExcludedSpecialBreedingRows: excludedSpecialRows.length,
          sourceMissingSpecialBreedingRows: sourceMissingSpecialRows.length,
          duplicateSpecialBreedingRows: duplicateSpecialRows.length,
          unresolvedSpecialBreedingRows: unresolvedSpecialRows.length,
          computedBreedingResults
        };
        const importReport = {
          ...common,
          status: "blocked_candidate",
          activationEligible: false,
          blockers,
          counts,
          sourceCounts: preflight.data,
          localeCoverage,
          domainLocaleCoverage,
          detailCoverage,
          imageCoverage,
          sourceDomainCounts: {
            itemRows: allItemRows.length,
            legalItemRows: items.length,
            excludedItemRows: excludedItemRows.length,
            recipeRows: Object.keys(recipeRows).length,
            publishedRecipeRows: [...recipesByProduct.values()]
              .reduce((total, recipes) => total + recipes.length, 0),
            excludedIllegalRecipeRows: excludedIllegalRecipeProducts.length,
            technologyRows: Object.keys(technologyRows).length,
            auditedTechnologyRows: technologySourceRowAudit.length,
            publishedTechnologyLinks: [...technologyByItem.values()]
              .reduce((total, entries) => total + entries.length, 0),
            excludedIllegalTechnologyLinks: excludedIllegalTechnologyRecipeRows.length,
            dropRows: Object.keys(palDropRows).length,
            passiveSkillRows: allPassiveSkillRows.length,
            visiblePassiveSkillRows: passiveSkills.length,
            excludedPassiveSkillRows: excludedPassiveSkillRows.length,
            sourceActiveSkillRows: sourceActiveRows.length,
            publicActiveSkillRows: activeSkills.length,
            excludedActiveSkillRows: excludedActiveSkillRows.length,
            passiveDescriptionMissingSourceRows: passiveSkills
              .filter((skill) =>
                skill.description.koStatus === "missing_source"
                || skill.description.jaStatus === "missing_source"
              ).length,
            passiveStructuredEffectFallbackRows: passiveSkills
              .filter((skill) =>
                (
                  skill.description.koStatus === "missing_source"
                  || skill.description.jaStatus === "missing_source"
                )
                && skill.effects.length > 0
              ).length,
            activeAssignmentRows: Object.keys(activeAssignmentRows).length,
            eggAssignmentRows: Object.keys(eggAssignmentRows).length
          },
          richTextIssues,
          sourceImageResolutionDistribution,
          sourceReferenceGaps,
          publicIdMapping: {
            mappingRelease: publicIdMap.release,
            candidateGameVersion: metadata?.gameVersion ?? null,
            versionRelation: metadata?.gameVersion === publicIdMap.release
              ? "exact"
              : "unverified",
            reviewed: reviewedPublicIdCount,
            generated: generatedPublicIdCount,
            generatedEntries: pals
              .filter((pal) => pal.idStatus === "candidate_internal_id")
              .map((pal) => ({
                sourceInternalId: pal.sourceInternalId,
                candidateId: pal.id,
                status: "requires_review"
              }))
          },
          skillIdMigration: {
            sourceRelease: legacySkillCatalog.release,
            input: skillIdMigration.length,
            mapped: skillIdMigration.length - unresolvedSkillIdMigrations,
            unresolved: unresolvedSkillIdMigrations,
            joinPolicy: "exact_id_and_type_only",
            entries: skillIdMigration
          },
          technologyAudit: {
            inputRows: technologySourceRowAudit.length,
            publishedRows: technologySourceRowAudit
              .filter((entry) =>
                entry.status === "published" || entry.status === "partially_published"
              ).length,
            excludedRows: technologySourceRowAudit
              .filter((entry) => entry.status === "excluded").length,
            unresolvedRows: technologySourceRowAudit
              .filter((entry) => entry.status === "unresolved").length,
            emptyRows: technologySourceRowAudit
              .filter((entry) => entry.status === "empty").length,
            entries: technologySourceRowAudit
          },
          unresolved: {
            specialBreedingRows: unresolvedSpecialRows,
            sourceMissingSpecialBreedingRows: sourceMissingSpecialRows,
            orphanDropItemInternalIds: [...orphanDropItems].sort((left, right) => left.localeCompare(right, "en")),
            orphanRecipeProductInternalIds: [...orphanRecipeProducts]
              .sort((left, right) => left.localeCompare(right, "en")),
            orphanRecipeItemInternalIds: [...orphanRecipeReferences]
              .sort((left, right) => left.localeCompare(right, "en")),
            orphanTechnologyRecipeRowIds: [...orphanTechnologyRecipeRows]
              .sort((left, right) => left.localeCompare(right, "en")),
            activeSkillAssignments: assignmentRecords
              .filter((assignment) =>
                assignment.status === "pal_reference_unresolved"
                || assignment.status === "skill_reference_unresolved"
              )
          },
          excluded: {
            duplicatePalRows: canonical.exclusions,
            itemRows: excludedItemRows,
            passiveSkillRows: excludedPassiveSkillRows,
            activeSkillRows: excludedActiveSkillRows,
            nonpublicSpecialBreedingRows: excludedSpecialRows,
            duplicateSpecialBreedingRows: duplicateSpecialRows,
            illegalRecipeProducts: excludedIllegalRecipeProducts
              .sort((left, right) => left.sourceRowId.localeCompare(right.sourceRowId, "en")),
            illegalTechnologyRecipeRows: excludedIllegalTechnologyRecipeRows
              .sort((left, right) =>
                left.sourceRowId.localeCompare(right.sourceRowId, "en")
                || left.recipeSourceRowId.localeCompare(right.recipeSourceRowId, "en")
              ),
            noncanonicalActiveSkillAssignments: assignmentRecords
              .filter((assignment) => assignment.status === "noncanonical_pal_excluded"),
            nonpublicActiveSkillAssignments: assignmentRecords
              .filter((assignment) => assignment.status === "nonpublic_pal_excluded"),
            sourceMissingActiveSkillAssignments: assignmentRecords
              .filter((assignment) =>
                assignment.status === "source_pal_missing_excluded"
              ),
            eggAssignments: eggAssignmentRecords
          },
          aliasApplications: aliases.entries.map((entry) => ({
            ...entry,
            applications: aliases.usageCounts.get(`${entry.domain}\0${entry.sourceId}`) ?? 0
          })),
          staleAliases: aliases.entries
            .filter((entry) =>
              (aliases.usageCounts.get(`${entry.domain}\0${entry.sourceId}`) ?? 0) === 0
            )
            .map((entry) => ({
              sourceId: entry.sourceId,
              targetId: entry.targetId,
              domain: entry.domain,
              reason: "approved_alias_not_used_by_candidate_input"
            })),
          reviewedExclusions,
          palIconOverrides: [...iconOverrides].map(([sourceInternalId, sourceMember]) => ({
            sourceInternalId,
            sourceMember,
            applied: palIconMemberByInternal.get(sourceInternalId) === sourceMember
          })),
          sourceTablePalIconReferences: {
            referenced: preflight.assets.palIcons.sourceTableReferenced,
            exactMatches: preflight.assets.palIcons.sourceTableExactMatches,
            missing: preflight.assets.palIcons.sourceTableMissing
          },
          imageAssetFailures,
          limitations: [
            ...(enLocale.status === "missing"
              ? ["공식 EN locale이 없어 영어 이름·설명은 candidate에서 missing_source로 유지됩니다."]
              : []),
            ...(itemImageAssets.length !== items.length
              ? ["일반 아이템 PNG root가 불완전하여 item image domain은 blocked입니다."]
              : []),
            ...(metadata === undefined
              ? ["게임 버전·Steam Build ID·FModel version·Mappings checksum을 추정하지 않습니다."]
              : []),
            ...(workIconMap.status !== "verified"
              ? ["work icon 번호와 의미의 검증된 mapping이 없어 source PNG를 자동 연결하지 않습니다."]
              : [])
          ]
        };
        artifacts.push(await writeArtifact(staging, "import-report.json", importReport));
        artifacts.push(await writeArtifact(staging, "source-lock.json", {
          ...common,
          archive: {
            sha256: reader.archiveSha256,
            bytes: reader.archiveBytes,
            fileCount: reader.members.length
          },
          mappings: mappingChecksums,
          includedFiles: sourceIncludedFiles
        }));
        const runtimeCandidate = {
          schemaVersion: 1,
          candidateId,
          release: metadata?.gameVersion ?? null,
          gameVersion: metadata?.gameVersion ?? null,
          steamBuildId: metadata?.steamBuildId ?? null,
          source: provenance,
          activationEligible: false,
          activation: {
            pals: "candidate",
            items: "candidate",
            skills: "candidate",
            breeding: sourceMissingSpecialRows.length === 0
              && unresolvedSpecialRows.length === 0
              ? "candidate"
              : "blocked",
            localizationKo: koLocale.languageVerified ? "candidate" : "blocked",
            localizationJa: jaLocale.languageVerified ? "candidate" : "blocked",
            localizationEn: enLocale.languageVerified
              && unresolvedRichText.en.value === 0
              ? "candidate"
              : "blocked",
            palImages: input.includeAssets !== false && palImageAssets.length === pals.length
              ? "candidate"
              : "blocked",
            itemImages: input.includeAssets !== false
              && itemImageAssets.length === items.length
              && !imageAssetFailures.some((failure) => failure.kind === "item")
              ? "candidate"
              : "blocked",
            elementImages: input.includeAssets !== false
              && elementImageAssets.length === elementIconMap.length
              ? "candidate"
              : "blocked",
            workImages: input.includeAssets !== false
              && workIconMap.status === "verified"
              && workImageAssets.length === workIconMap.availableSourceMembers.length
              ? "candidate"
              : "blocked",
            skillImages: input.includeAssets !== false
              && skillIconMap.status === "verified"
              && skillImageAssets.length === skills.length
              ? "candidate"
              : "blocked",
            map: input.includeAssets !== false && mapImageAssets.length === 2
              ? "candidate"
              : "blocked"
          },
          blockers,
          counts,
          localeCoverage,
          imageCoverage,
          mappingChecksums,
          artifacts: artifacts
            .map((artifact) => ({ ...artifact }))
            .sort((left, right) => left.file.localeCompare(right.file, "en")),
          assets: imageAssets
            .map((asset) => ({
              id: asset.id,
              kind: asset.kind,
              file: asset.outputFile,
              sha256: asset.outputSha256,
              bytes: asset.outputBytes
            }))
            .sort((left, right) =>
              left.kind.localeCompare(right.kind, "en")
              || left.id.localeCompare(right.id, "en")
              || left.file.localeCompare(right.file, "en")
            )
        };
        await writeArtifact(staging, "runtime-manifest.candidate.json", runtimeCandidate);
        await validatePalworldPakBlockedCandidateStagingRoot({
          stagingRoot: staging,
          expectedCandidateId: candidateId
        });
        return {
          outputDirectory,
          candidateId,
          activationEligible: false as const,
          blockers,
          counts,
          localeCoverage,
          imageCoverage
        };
      }
    );
    const outputParentAfter = await lstat(outputParent);
    if (
      outputParentAfter.dev !== outputParentInfo.dev
      || outputParentAfter.ino !== outputParentInfo.ino
      || !outputParentAfter.isDirectory()
    ) {
      fail("candidate output parent가 import 중 변경되었습니다.");
    }
    await rename(staging, outputDirectory);
    return result;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export type PalworldPakCandidateCliMappings = {
  publicIdMapPath: string;
  aliasesPath: string;
  palIconOverridesPath: string;
  elementIconMapPath: string;
  workIconMapPath: string;
  skillIconMapPath: string;
  publicActiveSkillAllowlistPath: string;
  exclusionsPath: string;
  legacySkillCatalogPath: string;
};

export async function loadPalworldPakCandidateMappings(
  paths: PalworldPakCandidateCliMappings
): Promise<CandidateMappings> {
  return {
    publicIdMap: await readPalworldPakMappingFile(paths.publicIdMapPath),
    aliases: await readPalworldPakMappingFile(paths.aliasesPath),
    palIconOverrides: await readPalworldPakMappingFile(paths.palIconOverridesPath),
    elementIconMap: await readPalworldPakMappingFile(paths.elementIconMapPath),
    workIconMap: await readPalworldPakMappingFile(paths.workIconMapPath),
    skillIconMap: await readPalworldPakMappingFile(paths.skillIconMapPath),
    publicActiveSkillAllowlist: await readPalworldPakMappingFile(
      paths.publicActiveSkillAllowlistPath
    ),
    exclusions: await readPalworldPakMappingFile(paths.exclusionsPath),
    legacySkillCatalog: await readPalworldPakMappingFile(paths.legacySkillCatalogPath)
  };
}

export function candidatePreflightSummary(report: PalworldPakPreflightReport): {
  blockers: string[];
  inputPrerequisitesSatisfied: boolean;
} {
  return {
    blockers: [...report.gates.blockers],
    inputPrerequisitesSatisfied: report.gates.inputPrerequisitesSatisfied
  };
}

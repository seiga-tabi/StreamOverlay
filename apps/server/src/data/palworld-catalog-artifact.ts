import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { inspectPalworldWebp } from "./palworld-image-import.js";
import { PalworldPaldexValidationError } from "./palworld-paldex-artifact.js";

export const PALWORLD_CATALOG_RELEASE = "1.0.1";
export const PALWORLD_CATALOG_FILE = "catalog.json";
export const PALWORLD_CATALOG_MANIFEST_FILE = "catalog-manifest.json";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const INTERNAL_ID_PATTERN = /^[A-Za-z0-9_]+$/u;
const IMAGE_URL_PATTERN = /^\/images\/palworld\/1\.0\.1\/(items|elements)\/([a-f0-9]{64})\.webp$/u;
const ELEMENTS = new Set(["neutral", "fire", "water", "electric", "grass", "ice", "ground", "dark", "dragon"]);
const SKILL_TYPES = new Set(["active", "partner", "passive"]);
const GENDERS = new Set(["male", "female"]);
const ITEM_CATEGORIES = new Set([
  "material",
  "consumable",
  "weapon",
  "armor",
  "accessory",
  "sphere",
  "ammo",
  "food",
  "medicine",
  "key_item",
  "building",
  "other"
]);

export type PalworldCatalogElement = {
  id: string;
  sourceName: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
};

export type PalworldCatalogSkill = {
  id: string;
  type: "active" | "partner" | "passive";
  nameEn: string;
  descriptionEn?: string;
  element?: string;
  power?: number;
  cooldownSeconds?: number;
  passiveTier?: number;
  passiveAbility?: string;
};

export type PalworldCatalogSkillAssignment = {
  palId: string;
  skillId: string;
  kind: "active" | "partner";
  unlockLevel?: number;
};

export type PalworldCatalogPalDetail = {
  palId: string;
  sourceInternalId: string;
  descriptionEn?: string;
  partnerSkillId?: string;
  drops: Array<{
    itemId?: string;
    itemSourceInternalId?: string;
    nameEn: string;
    minimum: number;
    maximum: number;
    rate: number;
  }>;
};

export type PalworldCatalogSpecialBreedingPair = {
  parentAId: string;
  parentBId: string;
  childId: string;
  parentAGender?: "male" | "female";
  parentBGender?: "male" | "female";
};

export type PalworldCatalogItem = {
  id: string;
  sourceInternalId: string;
  nameEn: string;
  descriptionEn?: string;
  category: string;
  sourceCategory: string;
  rarity: number;
  rank: number;
  maxStack: number;
  weight: number;
  sellPrice?: number;
  durability?: number;
  technologyLevel?: number;
  craftingMaterials: Array<{ itemId: string; quantity: number }>;
  dropPalIds: string[];
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
};

export type PalworldCatalogArtifact = {
  schemaVersion: 1;
  release: string;
  metadata: {
    gameVersion: string;
    sourceName: string;
    sourceUrl: string;
    sourceRevision: string;
    extractedAt: string;
    verifiedAt: string;
    license: string;
  };
  provenance: {
    atlasArchiveSha256: string;
    atlasSteamBuildId: string;
    pyPalArchiveSha256: string;
    pyPalRevision: string;
    pyPalGameDataVersion: string;
    usageBasis: "operator_reference_use";
    rightsVerified: false;
  };
  coverage: {
    canonicalPals: number;
    exactPalDetails: number;
    palDetailsWithoutSource: number;
    atlasItems: number;
    runtimeItems: number;
    excludedPlaceholderItems: number;
    excludedIllegalItems: number;
    itemImages: number;
    itemImageFallbacks: number;
    uniqueItemImages: number;
    activeSkills: number;
    partnerSkills: number;
    passiveSkills: number;
    skillAssignments: number;
    unresolvedDropReferences: number;
    unresolvedCraftingReferences: number;
    unresolvedTechnologyReferences: number;
    activeSkillConflicts: number;
    atlasBreedingPairs: number;
    specialBreedingPairs: number;
    unresolvedBreedingReferences: number;
    genderedBreedingPairs: number;
    localizedKo: number;
    localizedJa: number;
  };
  palDetails: PalworldCatalogPalDetail[];
  items: PalworldCatalogItem[];
  skills: PalworldCatalogSkill[];
  skillAssignments: PalworldCatalogSkillAssignment[];
  specialBreedingPairs: PalworldCatalogSpecialBreedingPair[];
  elements: PalworldCatalogElement[];
};

export type PalworldCatalogAssetManifest = {
  schemaVersion: 1;
  release: string;
  kind: "items" | "elements";
  sourceArchiveSha256: string;
  usageBasis: "operator_reference_use";
  rightsVerified: false;
  entries: Array<{
    id: string;
    sourceFileName: string;
    sourceSha256: string;
    outputSha256: string;
    outputFileName: string;
    outputWidth: number;
    outputHeight: number;
    outputBytes: number;
    imageUrl: string;
  }>;
};

export type PalworldCatalogReleaseManifest = {
  schemaVersion: 1;
  release: string;
  generatedAt: string;
  catalogSha256: string;
  itemImagesManifestSha256: string;
  elementImagesManifestSha256: string;
  counts: PalworldCatalogArtifact["coverage"];
  runtimeActivation: boolean;
};

export class PalworldCatalogValidationError extends Error {
  readonly code = "PALWORLD_CATALOG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldCatalogValidationError";
  }
}

function fail(pathName: string, message: string): never {
  throw new PalworldCatalogValidationError(`${pathName}: ${message}`);
}

function recordAt(value: unknown, pathName: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(pathName, "객체여야 합니다.");
  const record = value as Record<string, unknown>;
  const allowed = new Set(keys);
  for (const key of Object.keys(record)) if (!allowed.has(key)) fail(`${pathName}.${key}`, "허용되지 않은 필드입니다.");
  return record;
}

function stringAt(value: unknown, pathName: string, maxLength: number, optional = false): string | undefined {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || value.trim().length < 1 || value.length > maxLength || value.includes("\0")) {
    fail(pathName, `비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
  return value;
}

function integerAt(value: unknown, pathName: string, min: number, max: number, optional = false): number | undefined {
  if (value === undefined && optional) return undefined;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) fail(pathName, `${min}~${max} 정수여야 합니다.`);
  return value as number;
}

function numberAt(value: unknown, pathName: string, min: number, max: number, optional = false): number | undefined {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(pathName, `${min}~${max} 유한 숫자여야 합니다.`);
  return value;
}

function arrayAt(value: unknown, pathName: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) fail(pathName, `최대 ${maxLength}개 배열이어야 합니다.`);
  return value;
}

function assertId(value: unknown, pathName: string): string {
  const id = stringAt(value, pathName, 128)!;
  if (!ID_PATTERN.test(id)) fail(pathName, "소문자 kebab-case ID여야 합니다.");
  return id;
}

function assertInternalId(value: unknown, pathName: string): string {
  const id = stringAt(value, pathName, 128)!;
  if (!INTERNAL_ID_PATTERN.test(id)) fail(pathName, "고정 원본 internal ID여야 합니다.");
  return id;
}

function assertImageUrl(value: unknown, pathName: string, kind: "items" | "elements"): string {
  const url = stringAt(value, pathName, 256)!;
  const match = IMAGE_URL_PATTERN.exec(url);
  if (!match || match[1] !== kind) fail(pathName, `고정 ${kind} content-hash WebP 경로여야 합니다.`);
  return url;
}

function isoAt(value: unknown, pathName: string): string {
  const text = stringAt(value, pathName, 64)!;
  if (Number.isNaN(Date.parse(text))) fail(pathName, "올바른 ISO 날짜여야 합니다.");
  return text;
}

function shaAt(value: unknown, pathName: string): string {
  const text = stringAt(value, pathName, 64)!;
  if (!SHA256_PATTERN.test(text)) fail(pathName, "64자리 SHA-256이어야 합니다.");
  return text;
}

function assertUniqueSorted(ids: string[], pathName: string): void {
  for (let index = 0; index < ids.length; index += 1) {
    if (index > 0 && ids[index - 1]! >= ids[index]!) fail(`${pathName}[${index}]`, "중복 없이 code-point 정렬되어야 합니다.");
  }
}

export function assertPalworldCatalogArtifact(value: unknown): PalworldCatalogArtifact {
  const root = recordAt(value, "catalog", ["schemaVersion", "release", "metadata", "provenance", "coverage", "palDetails", "items", "skills", "skillAssignments", "specialBreedingPairs", "elements"]);
  if (root.schemaVersion !== 1 || root.release !== PALWORLD_CATALOG_RELEASE) fail("catalog", "고정 release schema와 일치해야 합니다.");
  const metadata = recordAt(root.metadata, "catalog.metadata", ["gameVersion", "sourceName", "sourceUrl", "sourceRevision", "extractedAt", "verifiedAt", "license"]);
  for (const field of ["gameVersion", "sourceName", "sourceUrl", "sourceRevision", "license"] as const) stringAt(metadata[field], `catalog.metadata.${field}`, 2048);
  isoAt(metadata.extractedAt, "catalog.metadata.extractedAt");
  isoAt(metadata.verifiedAt, "catalog.metadata.verifiedAt");
  const provenance = recordAt(root.provenance, "catalog.provenance", ["atlasArchiveSha256", "atlasSteamBuildId", "pyPalArchiveSha256", "pyPalRevision", "pyPalGameDataVersion", "usageBasis", "rightsVerified"]);
  shaAt(provenance.atlasArchiveSha256, "catalog.provenance.atlasArchiveSha256");
  shaAt(provenance.pyPalArchiveSha256, "catalog.provenance.pyPalArchiveSha256");
  for (const field of ["atlasSteamBuildId", "pyPalRevision", "pyPalGameDataVersion"] as const) stringAt(provenance[field], `catalog.provenance.${field}`, 128);
  if (provenance.usageBasis !== "operator_reference_use" || provenance.rightsVerified !== false) fail("catalog.provenance", "비독립 권리 확인 상태를 유지해야 합니다.");

  const coverageKeys = ["canonicalPals", "exactPalDetails", "palDetailsWithoutSource", "atlasItems", "runtimeItems", "excludedPlaceholderItems", "excludedIllegalItems", "itemImages", "itemImageFallbacks", "uniqueItemImages", "activeSkills", "partnerSkills", "passiveSkills", "skillAssignments", "unresolvedDropReferences", "unresolvedCraftingReferences", "unresolvedTechnologyReferences", "activeSkillConflicts", "atlasBreedingPairs", "specialBreedingPairs", "unresolvedBreedingReferences", "genderedBreedingPairs", "localizedKo", "localizedJa"] as const;
  const coverage = recordAt(root.coverage, "catalog.coverage", coverageKeys);
  for (const field of coverageKeys) integerAt(coverage[field], `catalog.coverage.${field}`, 0, 100_000);

  const palDetails = arrayAt(root.palDetails, "catalog.palDetails", 1_000);
  const palIds: string[] = [];
  const palSourceInternalIds = new Set<string>();
  for (const [index, raw] of palDetails.entries()) {
    const pathName = `catalog.palDetails[${index}]`;
    const entry = recordAt(raw, pathName, ["palId", "sourceInternalId", "descriptionEn", "partnerSkillId", "drops"]);
    palIds.push(assertId(entry.palId, `${pathName}.palId`));
    const sourceInternalId = assertInternalId(entry.sourceInternalId, `${pathName}.sourceInternalId`);
    if (palSourceInternalIds.has(sourceInternalId)) fail(`${pathName}.sourceInternalId`, "중복 Pal 원본 internal ID입니다.");
    palSourceInternalIds.add(sourceInternalId);
    stringAt(entry.descriptionEn, `${pathName}.descriptionEn`, 8_192, true);
    if (entry.partnerSkillId !== undefined) assertId(entry.partnerSkillId, `${pathName}.partnerSkillId`);
    for (const [dropIndex, rawDrop] of arrayAt(entry.drops, `${pathName}.drops`, 128).entries()) {
      const dropPath = `${pathName}.drops[${dropIndex}]`;
      const drop = recordAt(rawDrop, dropPath, ["itemId", "itemSourceInternalId", "nameEn", "minimum", "maximum", "rate"]);
      if (drop.itemId !== undefined) assertId(drop.itemId, `${dropPath}.itemId`);
      if (drop.itemSourceInternalId !== undefined) assertInternalId(drop.itemSourceInternalId, `${dropPath}.itemSourceInternalId`);
      stringAt(drop.nameEn, `${dropPath}.nameEn`, 256);
      const minimum = integerAt(drop.minimum, `${dropPath}.minimum`, 0, 1_000_000)!;
      const maximum = integerAt(drop.maximum, `${dropPath}.maximum`, 0, 1_000_000)!;
      if (maximum < minimum) fail(dropPath, "maximum은 minimum 이상이어야 합니다.");
      numberAt(drop.rate, `${dropPath}.rate`, 0, 100);
    }
  }
  assertUniqueSorted(palIds, "catalog.palDetails");

  const items = arrayAt(root.items, "catalog.items", 5_000);
  const itemIds: string[] = [];
  const itemIdSet = new Set<string>();
  const itemSourceInternalIds = new Set<string>();
  for (const [index, raw] of items.entries()) {
    const pathName = `catalog.items[${index}]`;
    const item = recordAt(raw, pathName, ["id", "sourceInternalId", "nameEn", "descriptionEn", "category", "sourceCategory", "rarity", "rank", "maxStack", "weight", "sellPrice", "durability", "technologyLevel", "craftingMaterials", "dropPalIds", "imageUrl", "imageWidth", "imageHeight"]);
    const id = assertId(item.id, `${pathName}.id`);
    itemIds.push(id);
    itemIdSet.add(id);
    const sourceInternalId = assertInternalId(item.sourceInternalId, `${pathName}.sourceInternalId`);
    if (itemSourceInternalIds.has(sourceInternalId)) fail(`${pathName}.sourceInternalId`, "중복 item 원본 internal ID입니다.");
    itemSourceInternalIds.add(sourceInternalId);
    stringAt(item.nameEn, `${pathName}.nameEn`, 256);
    stringAt(item.descriptionEn, `${pathName}.descriptionEn`, 8_192, true);
    if (!ITEM_CATEGORIES.has(String(item.category))) fail(`${pathName}.category`, "허용된 category가 아닙니다.");
    stringAt(item.sourceCategory, `${pathName}.sourceCategory`, 128);
    integerAt(item.rarity, `${pathName}.rarity`, 0, 20);
    integerAt(item.rank, `${pathName}.rank`, 0, 1_000);
    integerAt(item.maxStack, `${pathName}.maxStack`, 0, 100_000_000);
    numberAt(item.weight, `${pathName}.weight`, 0, 1_000_000);
    integerAt(item.sellPrice, `${pathName}.sellPrice`, 0, 1_000_000_000, true);
    integerAt(item.durability, `${pathName}.durability`, 0, 1_000_000_000, true);
    integerAt(item.technologyLevel, `${pathName}.technologyLevel`, 0, 1_000, true);
    const materialIds: string[] = [];
    for (const [materialIndex, rawMaterial] of arrayAt(item.craftingMaterials, `${pathName}.craftingMaterials`, 128).entries()) {
      const material = recordAt(rawMaterial, `${pathName}.craftingMaterials[${materialIndex}]`, ["itemId", "quantity"]);
      materialIds.push(assertId(material.itemId, `${pathName}.craftingMaterials[${materialIndex}].itemId`));
      integerAt(material.quantity, `${pathName}.craftingMaterials[${materialIndex}].quantity`, 1, 1_000_000);
    }
    assertUniqueSorted(materialIds, `${pathName}.craftingMaterials`);
    const dropPalIds = arrayAt(item.dropPalIds, `${pathName}.dropPalIds`, 1_000).map((palId, palIndex) => assertId(palId, `${pathName}.dropPalIds[${palIndex}]`));
    assertUniqueSorted(dropPalIds, `${pathName}.dropPalIds`);
    if (item.imageUrl !== undefined) {
      assertImageUrl(item.imageUrl, `${pathName}.imageUrl`, "items");
      integerAt(item.imageWidth, `${pathName}.imageWidth`, 1, 512);
      integerAt(item.imageHeight, `${pathName}.imageHeight`, 1, 512);
    } else if (item.imageWidth !== undefined || item.imageHeight !== undefined) fail(pathName, "imageUrl 없이 크기를 지정할 수 없습니다.");
  }
  assertUniqueSorted(itemIds, "catalog.items");

  const skills = arrayAt(root.skills, "catalog.skills", 5_000);
  const skillIds: string[] = [];
  const skillIdSet = new Set<string>();
  const skillsById = new Map<string, PalworldCatalogSkill>();
  for (const [index, raw] of skills.entries()) {
    const pathName = `catalog.skills[${index}]`;
    const skill = recordAt(raw, pathName, ["id", "type", "nameEn", "descriptionEn", "element", "power", "cooldownSeconds", "passiveTier", "passiveAbility"]);
    const id = assertId(skill.id, `${pathName}.id`);
    skillIds.push(id);
    skillIdSet.add(id);
    skillsById.set(id, raw as PalworldCatalogSkill);
    if (!SKILL_TYPES.has(String(skill.type))) fail(`${pathName}.type`, "허용된 skill type이 아닙니다.");
    stringAt(skill.nameEn, `${pathName}.nameEn`, 256);
    stringAt(skill.descriptionEn, `${pathName}.descriptionEn`, 8_192, true);
    if (skill.element !== undefined && !ELEMENTS.has(String(skill.element))) fail(`${pathName}.element`, "허용된 element가 아닙니다.");
    integerAt(skill.power, `${pathName}.power`, 0, 100_000, true);
    numberAt(skill.cooldownSeconds, `${pathName}.cooldownSeconds`, 0, 100_000, true);
    integerAt(skill.passiveTier, `${pathName}.passiveTier`, -20, 20, true);
    stringAt(skill.passiveAbility, `${pathName}.passiveAbility`, 256, true);
  }
  assertUniqueSorted(skillIds, "catalog.skills");

  const assignments = arrayAt(root.skillAssignments, "catalog.skillAssignments", 20_000);
  const partnerAssignmentsByPal = new Map<string, string[]>();
  let previousAssignment = "";
  for (const [index, raw] of assignments.entries()) {
    const pathName = `catalog.skillAssignments[${index}]`;
    const assignment = recordAt(raw, pathName, ["palId", "skillId", "kind", "unlockLevel"]);
    const palId = assertId(assignment.palId, `${pathName}.palId`);
    const skillId = assertId(assignment.skillId, `${pathName}.skillId`);
    if (!palIds.includes(palId)) fail(`${pathName}.palId`, "catalog Pal 상세에 없는 참조입니다.");
    if (!skillIdSet.has(skillId)) fail(`${pathName}.skillId`, "catalog skill에 없는 참조입니다.");
    if (assignment.kind !== "active" && assignment.kind !== "partner") fail(`${pathName}.kind`, "active 또는 partner여야 합니다.");
    const skill = skillsById.get(skillId)!;
    if (skill.type !== assignment.kind) fail(`${pathName}.kind`, "참조한 canonical skill 종류와 일치해야 합니다.");
    if (assignment.kind === "active") {
      integerAt(assignment.unlockLevel, `${pathName}.unlockLevel`, 0, 1_000);
    } else {
      if (assignment.unlockLevel !== undefined) fail(`${pathName}.unlockLevel`, "partner skill에는 해금 레벨을 지정할 수 없습니다.");
      const partnerSkillIds = partnerAssignmentsByPal.get(palId) ?? [];
      partnerSkillIds.push(skillId);
      partnerAssignmentsByPal.set(palId, partnerSkillIds);
    }
    const key = `${palId}\0${String(assignment.kind)}\0${skillId}`;
    if (previousAssignment >= key) fail(pathName, "중복 없이 결정적 정렬되어야 합니다.");
    previousAssignment = key;
  }

  const specialBreedingPairs = arrayAt(root.specialBreedingPairs, "catalog.specialBreedingPairs", 1_000);
  let previousBreedingPair = "";
  let genderedBreedingPairs = 0;
  for (const [index, raw] of specialBreedingPairs.entries()) {
    const pathName = `catalog.specialBreedingPairs[${index}]`;
    const pair = recordAt(raw, pathName, ["parentAId", "parentBId", "childId", "parentAGender", "parentBGender"]);
    const parentAId = assertId(pair.parentAId, `${pathName}.parentAId`);
    const parentBId = assertId(pair.parentBId, `${pathName}.parentBId`);
    const childId = assertId(pair.childId, `${pathName}.childId`);
    for (const field of ["parentAGender", "parentBGender"] as const) {
      if (pair[field] !== undefined && !GENDERS.has(String(pair[field]))) fail(`${pathName}.${field}`, "male 또는 female이어야 합니다.");
    }
    if (pair.parentAGender !== undefined || pair.parentBGender !== undefined) genderedBreedingPairs += 1;
    if (parentAId === parentBId && parentAId === childId) fail(pathName, "일반적인 동일종 self 조합은 특수 교배 목록에 포함하지 않습니다.");
    const key = `${childId}\0${parentAId}\0${parentBId}\0${String(pair.parentAGender ?? "")}\0${String(pair.parentBGender ?? "")}`;
    if (previousBreedingPair >= key) fail(pathName, "중복 없이 결정적 정렬되어야 합니다.");
    previousBreedingPair = key;
  }

  const elements = arrayAt(root.elements, "catalog.elements", 9);
  if (elements.length !== ELEMENTS.size) fail("catalog.elements", "고정 element 9종을 모두 포함해야 합니다.");
  const elementIds: string[] = [];
  for (const [index, raw] of elements.entries()) {
    const pathName = `catalog.elements[${index}]`;
    const element = recordAt(raw, pathName, ["id", "sourceName", "imageUrl", "imageWidth", "imageHeight"]);
    const id = stringAt(element.id, `${pathName}.id`, 32)!;
    if (!ELEMENTS.has(id)) fail(`${pathName}.id`, "허용된 element가 아닙니다.");
    elementIds.push(id);
    stringAt(element.sourceName, `${pathName}.sourceName`, 32);
    assertImageUrl(element.imageUrl, `${pathName}.imageUrl`, "elements");
    integerAt(element.imageWidth, `${pathName}.imageWidth`, 1, 512);
    integerAt(element.imageHeight, `${pathName}.imageHeight`, 1, 512);
  }
  assertUniqueSorted(elementIds, "catalog.elements");

  const typedPalDetails = palDetails as PalworldCatalogPalDetail[];
  const typedItems = items as PalworldCatalogItem[];
  const palIdSet = new Set(palIds);
  const itemById = new Map(typedItems.map((item) => [item.id, item]));
  const mappedDropPairs = new Set<string>();
  let unresolvedDrops = 0;
  for (const [index, detail] of typedPalDetails.entries()) {
    const partnerAssignments = partnerAssignmentsByPal.get(detail.palId) ?? [];
    if (partnerAssignments.length > 1) fail(`catalog.palDetails[${index}].partnerSkillId`, "Pal 하나에 partner skill을 여러 개 배정할 수 없습니다.");
    if (detail.partnerSkillId === undefined) {
      if (partnerAssignments.length !== 0) fail(`catalog.palDetails[${index}].partnerSkillId`, "partner assignment와 일치하지 않습니다.");
    } else {
      const skill = skillsById.get(detail.partnerSkillId);
      if (!skill || skill.type !== "partner") fail(`catalog.palDetails[${index}].partnerSkillId`, "canonical partner skill 참조여야 합니다.");
      if (partnerAssignments.length !== 1 || partnerAssignments[0] !== detail.partnerSkillId) {
        fail(`catalog.palDetails[${index}].partnerSkillId`, "partner assignment와 일치하지 않습니다.");
      }
    }
    for (const [dropIndex, drop] of detail.drops.entries()) {
      const dropPath = `catalog.palDetails[${index}].drops[${dropIndex}]`;
      if ((drop.itemId === undefined) !== (drop.itemSourceInternalId === undefined)) {
        fail(dropPath, "itemId와 itemSourceInternalId는 함께 제공해야 합니다.");
      }
      if (drop.itemId === undefined) {
        unresolvedDrops += 1;
        continue;
      }
      const item = itemById.get(drop.itemId);
      if (!item) fail(`${dropPath}.itemId`, "catalog item에 없는 참조입니다.");
      if (drop.itemSourceInternalId !== item.sourceInternalId) {
        fail(`${dropPath}.itemSourceInternalId`, "canonical item 원본 internal ID와 일치해야 합니다.");
      }
      mappedDropPairs.add(`${detail.palId}\0${item.id}`);
    }
  }
  for (const [index, item] of typedItems.entries()) {
    for (const [materialIndex, material] of item.craftingMaterials.entries()) {
      if (!itemIdSet.has(material.itemId)) fail(`catalog.items[${index}].craftingMaterials[${materialIndex}].itemId`, "catalog item에 없는 참조입니다.");
    }
    for (const [palIndex, palId] of item.dropPalIds.entries()) {
      if (!palIdSet.has(palId)) fail(`catalog.items[${index}].dropPalIds[${palIndex}]`, "catalog Pal 상세에 없는 참조입니다.");
      if (!mappedDropPairs.has(`${palId}\0${item.id}`)) {
        fail(`catalog.items[${index}].dropPalIds[${palIndex}]`, "Pal drop의 역참조와 일치하지 않습니다.");
      }
    }
  }
  for (const pair of mappedDropPairs) {
    const separator = pair.indexOf("\0");
    const palId = pair.slice(0, separator);
    const itemId = pair.slice(separator + 1);
    if (!itemById.get(itemId)?.dropPalIds.includes(palId)) {
      fail("catalog.items", `Pal drop 역참조가 누락되었습니다: ${palId} -> ${itemId}`);
    }
  }
  if (Number(coverage.canonicalPals) !== palIds.length + Number(coverage.palDetailsWithoutSource)) fail("catalog.coverage.canonicalPals", "Pal 상세 coverage와 일치하지 않습니다.");
  if (Number(coverage.exactPalDetails) !== palIds.length) fail("catalog.coverage.exactPalDetails", "palDetails 수와 일치하지 않습니다.");
  if (Number(coverage.runtimeItems) !== itemIds.length) fail("catalog.coverage.runtimeItems", "items 수와 일치하지 않습니다.");
  if (Number(coverage.atlasItems) !== Number(coverage.runtimeItems) + Number(coverage.excludedPlaceholderItems) + Number(coverage.excludedIllegalItems)) fail("catalog.coverage.atlasItems", "runtime·제외 item 집계와 일치하지 않습니다.");
  const itemImages = typedItems.filter((item) => item.imageUrl).length;
  if (Number(coverage.itemImages) !== itemImages) fail("catalog.coverage.itemImages", "item image 수와 일치하지 않습니다.");
  if (Number(coverage.itemImageFallbacks) !== typedItems.length - itemImages) fail("catalog.coverage.itemImageFallbacks", "item fallback 수와 일치하지 않습니다.");
  if (Number(coverage.uniqueItemImages) > itemImages) fail("catalog.coverage.uniqueItemImages", "item image 수보다 클 수 없습니다.");
  const typedSkills = skills as PalworldCatalogSkill[];
  for (const type of ["active", "partner", "passive"] as const) {
    const field = type === "active" ? "activeSkills" : type === "partner" ? "partnerSkills" : "passiveSkills";
    if (Number(coverage[field]) !== typedSkills.filter((skill) => skill.type === type).length) fail(`catalog.coverage.${field}`, `${type} skill 수와 일치하지 않습니다.`);
  }
  const activeNames = new Map<string, number>();
  for (const skill of typedSkills) if (skill.type === "active") activeNames.set(skill.nameEn, (activeNames.get(skill.nameEn) ?? 0) + 1);
  if (Number(coverage.activeSkillConflicts) !== [...activeNames.values()].filter((count) => count > 1).length) fail("catalog.coverage.activeSkillConflicts", "active skill 이름 충돌 수와 일치하지 않습니다.");
  if (Number(coverage.skillAssignments) !== assignments.length) fail("catalog.coverage.skillAssignments", "assignment 수와 일치하지 않습니다.");
  if (Number(coverage.unresolvedDropReferences) !== unresolvedDrops) fail("catalog.coverage.unresolvedDropReferences", "미해결 Pal drop 수와 일치하지 않습니다.");
  if (Number(coverage.specialBreedingPairs) !== specialBreedingPairs.length) fail("catalog.coverage.specialBreedingPairs", "특수 교배 조합 수와 일치하지 않습니다.");
  if (Number(coverage.genderedBreedingPairs) !== genderedBreedingPairs) fail("catalog.coverage.genderedBreedingPairs", "성별 조건 교배 조합 수와 일치하지 않습니다.");
  if (Number(coverage.atlasBreedingPairs) < specialBreedingPairs.length + Number(coverage.unresolvedBreedingReferences)) {
    fail("catalog.coverage.atlasBreedingPairs", "특수·미해결 교배 집계보다 작을 수 없습니다.");
  }
  if (Number(coverage.localizedKo) !== 0 || Number(coverage.localizedJa) !== 0) fail("catalog.coverage", "고정 source에는 KO/JA 번역이 없습니다.");
  return value as PalworldCatalogArtifact;
}

export function assertPalworldCatalogAssetManifest(value: unknown, kind: "items" | "elements"): PalworldCatalogAssetManifest {
  const root = recordAt(value, `${kind}Manifest`, ["schemaVersion", "release", "kind", "sourceArchiveSha256", "usageBasis", "rightsVerified", "entries"]);
  if (root.schemaVersion !== 1 || root.release !== PALWORLD_CATALOG_RELEASE || root.kind !== kind) fail(`${kind}Manifest`, "고정 release schema와 일치해야 합니다.");
  shaAt(root.sourceArchiveSha256, `${kind}Manifest.sourceArchiveSha256`);
  if (root.usageBasis !== "operator_reference_use" || root.rightsVerified !== false) fail(`${kind}Manifest`, "비독립 권리 확인 상태를 유지해야 합니다.");
  const ids: string[] = [];
  for (const [index, raw] of arrayAt(root.entries, `${kind}Manifest.entries`, kind === "items" ? 5_000 : 9).entries()) {
    const pathName = `${kind}Manifest.entries[${index}]`;
    const entry = recordAt(raw, pathName, ["id", "sourceFileName", "sourceSha256", "outputSha256", "outputFileName", "outputWidth", "outputHeight", "outputBytes", "imageUrl"]);
    const id = kind === "items" ? assertId(entry.id, `${pathName}.id`) : stringAt(entry.id, `${pathName}.id`, 32)!;
    ids.push(id);
    const sourceFileName = stringAt(entry.sourceFileName, `${pathName}.sourceFileName`, 512)!;
    if (!sourceFileName.startsWith("pyPalworldAPI-0.2.0/pyPalworldAPI/public/images/") || sourceFileName.includes("..") || !sourceFileName.endsWith(".png")) fail(`${pathName}.sourceFileName`, "고정 archive 내부 PNG 경로여야 합니다.");
    shaAt(entry.sourceSha256, `${pathName}.sourceSha256`);
    const outputSha256 = shaAt(entry.outputSha256, `${pathName}.outputSha256`);
    if (entry.outputFileName !== `${outputSha256}.webp`) fail(`${pathName}.outputFileName`, "content hash 파일명이어야 합니다.");
    integerAt(entry.outputWidth, `${pathName}.outputWidth`, 1, 512);
    integerAt(entry.outputHeight, `${pathName}.outputHeight`, 1, 512);
    integerAt(entry.outputBytes, `${pathName}.outputBytes`, 1, 512 * 1024);
    const imageUrl = assertImageUrl(entry.imageUrl, `${pathName}.imageUrl`, kind);
    if (imageUrl !== `/images/palworld/${PALWORLD_CATALOG_RELEASE}/${kind}/${entry.outputFileName as string}`) {
      fail(`${pathName}.imageUrl`, "outputFileName과 동일한 content hash 경로여야 합니다.");
    }
  }
  assertUniqueSorted(ids, `${kind}Manifest.entries`);
  return value as PalworldCatalogAssetManifest;
}

export function deterministicCatalogJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function sha256CatalogText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function readRegularJson(filePath: string, maxBytes: number): Promise<unknown> {
  const resolved = path.resolve(filePath);
  const info = await lstat(resolved);
  if (info.isSymbolicLink() || !info.isFile() || info.size < 2 || info.size > maxBytes) fail(filePath, "안전한 JSON regular file이 아닙니다.");
  const canonical = await realpath(resolved);
  if (canonical !== resolved) fail(filePath, "symlink 경로를 허용하지 않습니다.");
  const handle = await open(resolved, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size !== info.size) fail(filePath, "검사 중 JSON 파일이 변경되었습니다.");
    return JSON.parse(await handle.readFile("utf8"));
  } finally {
    await handle.close();
  }
}

export async function validatePalworldCatalogAssetFiles(input: {
  root: string;
  kind: "items" | "elements";
  manifest: PalworldCatalogAssetManifest;
}): Promise<void> {
  const resolvedRoot = path.resolve(input.root);
  const rootInfo = await lstat(resolvedRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory() || await realpath(resolvedRoot) !== resolvedRoot) {
    fail(`${input.kind}ImageRoot`, "symlink가 아닌 canonical directory여야 합니다.");
  }
  const expectedFiles = new Set(input.manifest.entries.map((entry) => entry.outputFileName));
  const actualNames = await readdir(resolvedRoot);
  for (const name of actualNames) {
    if (!/^[a-f0-9]{64}\.webp$/u.test(name) || !expectedFiles.has(name)) {
      fail(`${input.kind}ImageRoot.${name}`, "manifest에 없는 파일 또는 허용되지 않은 형식입니다.");
    }
  }
  if (actualNames.length !== expectedFiles.size) fail(`${input.kind}ImageRoot`, "manifest 파일 집합과 실제 asset 파일 집합이 다릅니다.");
  const entriesByFile = new Map<string, PalworldCatalogAssetManifest["entries"]>();
  for (const entry of input.manifest.entries) {
    const entries = entriesByFile.get(entry.outputFileName) ?? [];
    entries.push(entry);
    entriesByFile.set(entry.outputFileName, entries);
  }
  for (const [fileName, entries] of entriesByFile) {
    await validatePalworldCatalogAssetFile(resolvedRoot, input.kind, fileName, entries);
  }
}

async function validatePalworldCatalogAssetFile(
  resolvedRoot: string,
  kind: "items" | "elements",
  fileName: string,
  entries: PalworldCatalogAssetManifest["entries"]
): Promise<void> {
  const filePath = path.join(resolvedRoot, fileName);
  if (path.dirname(filePath) !== resolvedRoot) fail(`${kind}ImageRoot`, "asset 경로 traversal이 감지되었습니다.");
  const before = await lstat(filePath);
  if (before.isSymbolicLink() || !before.isFile() || before.size < 1 || before.size > 512 * 1024) fail(filePath, "안전한 WebP regular file이 아닙니다.");
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size) fail(filePath, "검사 중 asset 파일이 변경되었습니다.");
    const inspection = inspectPalworldWebp(await handle.readFile());
    if (fileName !== `${inspection.sha256}.webp`) fail(filePath, "content hash 파일명이 실제 내용과 다릅니다.");
    for (const entry of entries) {
      if (
        entry.outputSha256 !== inspection.sha256
        || entry.outputWidth !== inspection.width
        || entry.outputHeight !== inspection.height
        || entry.outputBytes !== inspection.bytes
      ) fail(filePath, "asset manifest 크기·hash가 실제 WebP와 다릅니다.");
    }
  } finally {
    await handle.close();
  }
}

export type PalworldCatalogRuntimeAssetCoverage = {
  validIds: ReadonlySet<string>;
  invalidIds: readonly string[];
};

/**
 * 공개 runtime에서는 개별 content-hash asset만 검증합니다.
 * manifest 자체의 schema와 provenance는 선행 loader에서 fail-closed로 검증하며,
 * 한 파일의 손상은 그 파일을 참조하는 항목에만 fallback을 적용합니다.
 */
export async function collectPalworldCatalogRuntimeAssetCoverage(input: {
  root: string;
  kind: "items" | "elements";
  manifest: PalworldCatalogAssetManifest;
}): Promise<PalworldCatalogRuntimeAssetCoverage> {
  const resolvedRoot = path.resolve(input.root);
  const rootInfo = await lstat(resolvedRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory() || await realpath(resolvedRoot) !== resolvedRoot) {
    fail(`${input.kind}ImageRoot`, "symlink가 아닌 canonical directory여야 합니다.");
  }
  const entriesByFile = new Map<string, PalworldCatalogAssetManifest["entries"]>();
  for (const entry of input.manifest.entries) {
    const entries = entriesByFile.get(entry.outputFileName) ?? [];
    entries.push(entry);
    entriesByFile.set(entry.outputFileName, entries);
  }
  const directoryEntries = await readdir(resolvedRoot, { withFileTypes: true });
  for (const entry of directoryEntries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !entriesByFile.has(entry.name)) {
      fail(
        `${input.kind}ImageRoot`,
        "asset manifest에 없는 파일 또는 안전하지 않은 directory entry가 있습니다."
      );
    }
  }
  const validIds = new Set<string>();
  const invalidIds: string[] = [];
  for (const [fileName, entries] of entriesByFile) {
    try {
      await validatePalworldCatalogAssetFile(resolvedRoot, input.kind, fileName, entries);
      for (const entry of entries) validIds.add(entry.id);
    } catch (error) {
      if (
        !(error instanceof PalworldCatalogValidationError)
        && !(error instanceof PalworldPaldexValidationError)
        && (error as NodeJS.ErrnoException).code !== "ENOENT"
        && (error as NodeJS.ErrnoException).code !== "EACCES"
      ) {
        throw error;
      }
      for (const entry of entries) invalidIds.push(entry.id);
    }
  }
  return {
    validIds,
    invalidIds: invalidIds.sort((left, right) => left.localeCompare(right, "en"))
  };
}

export type PalworldCatalogRuntimeSource = {
  catalog: PalworldCatalogArtifact;
  itemImagesManifest: PalworldCatalogAssetManifest;
  elementImagesManifest: PalworldCatalogAssetManifest;
  manifest: PalworldCatalogReleaseManifest;
};

export async function loadPalworldCatalogDataSource(
  releaseRoot: string
): Promise<PalworldCatalogRuntimeSource> {
  const resolvedRoot = path.resolve(releaseRoot);
  const rootInfo = await lstat(resolvedRoot);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory() || await realpath(resolvedRoot) !== resolvedRoot) fail("releaseRoot", "symlink가 아닌 canonical directory여야 합니다.");
  const catalogRaw = await readRegularJson(path.join(resolvedRoot, PALWORLD_CATALOG_FILE), 32 * 1024 * 1024);
  const itemsRaw = await readRegularJson(path.join(resolvedRoot, "item-images-manifest.json"), 8 * 1024 * 1024);
  const elementsRaw = await readRegularJson(path.join(resolvedRoot, "element-images-manifest.json"), 256 * 1024);
  const manifestRaw = await readRegularJson(path.join(resolvedRoot, PALWORLD_CATALOG_MANIFEST_FILE), 128 * 1024);
  const catalog = assertPalworldCatalogArtifact(catalogRaw);
  const itemImagesManifest = assertPalworldCatalogAssetManifest(itemsRaw, "items");
  const elementImagesManifest = assertPalworldCatalogAssetManifest(elementsRaw, "elements");
  if (
    itemImagesManifest.sourceArchiveSha256 !== catalog.provenance.pyPalArchiveSha256
    || elementImagesManifest.sourceArchiveSha256 !== catalog.provenance.pyPalArchiveSha256
  ) fail("catalogManifest", "asset manifest source checksum이 catalog provenance와 일치하지 않습니다.");
  const manifest = recordAt(manifestRaw, "catalogManifest", ["schemaVersion", "release", "generatedAt", "catalogSha256", "itemImagesManifestSha256", "elementImagesManifestSha256", "counts", "runtimeActivation"]);
  if (manifest.schemaVersion !== 1 || manifest.release !== PALWORLD_CATALOG_RELEASE || manifest.runtimeActivation !== true) fail("catalogManifest", "활성 고정 release manifest가 아닙니다.");
  isoAt(manifest.generatedAt, "catalogManifest.generatedAt");
  const catalogText = deterministicCatalogJson(catalogRaw);
  const itemText = deterministicCatalogJson(itemsRaw);
  const elementText = deterministicCatalogJson(elementsRaw);
  if (shaAt(manifest.catalogSha256, "catalogManifest.catalogSha256") !== sha256CatalogText(catalogText)) fail("catalogManifest.catalogSha256", "catalog checksum이 일치하지 않습니다.");
  if (shaAt(manifest.itemImagesManifestSha256, "catalogManifest.itemImagesManifestSha256") !== sha256CatalogText(itemText)) fail("catalogManifest.itemImagesManifestSha256", "item manifest checksum이 일치하지 않습니다.");
  if (shaAt(manifest.elementImagesManifestSha256, "catalogManifest.elementImagesManifestSha256") !== sha256CatalogText(elementText)) fail("catalogManifest.elementImagesManifestSha256", "element manifest checksum이 일치하지 않습니다.");
  if (JSON.stringify(manifest.counts) !== JSON.stringify(catalog.coverage)) fail("catalogManifest.counts", "catalog coverage와 일치하지 않습니다.");
  if (itemImagesManifest.entries.length !== catalog.coverage.itemImages) {
    fail("itemImagesManifest.entries", "catalog item image coverage와 일치하지 않습니다.");
  }
  if (new Set(itemImagesManifest.entries.map((entry) => entry.outputSha256)).size !== catalog.coverage.uniqueItemImages) {
    fail("itemImagesManifest.entries", "catalog unique item image coverage와 일치하지 않습니다.");
  }
  if (elementImagesManifest.entries.length !== catalog.elements.length) {
    fail("elementImagesManifest.entries", "catalog element image 수와 일치하지 않습니다.");
  }
  const itemById = new Map(catalog.items.map((item) => [item.id, item]));
  const itemManifestById = new Map(itemImagesManifest.entries.map((entry) => [entry.id, entry]));
  for (const [index, entry] of itemImagesManifest.entries.entries()) {
    const item = itemById.get(entry.id);
    if (!item || item.imageUrl !== entry.imageUrl || item.imageWidth !== entry.outputWidth || item.imageHeight !== entry.outputHeight) {
      fail(`itemImagesManifest.entries[${index}]`, "catalog item 이미지 metadata와 일치하지 않습니다.");
    }
  }
  for (const [index, item] of catalog.items.entries()) {
    const entry = itemManifestById.get(item.id);
    if ((item.imageUrl === undefined) !== (entry === undefined)) {
      fail(`catalog.items[${index}].imageUrl`, "item manifest와 양방향으로 일치해야 합니다.");
    }
  }
  const elementById = new Map(catalog.elements.map((element) => [element.id, element]));
  const elementManifestById = new Map(elementImagesManifest.entries.map((entry) => [entry.id, entry]));
  for (const [index, entry] of elementImagesManifest.entries.entries()) {
    const element = elementById.get(entry.id);
    if (!element || element.imageUrl !== entry.imageUrl || element.imageWidth !== entry.outputWidth || element.imageHeight !== entry.outputHeight) {
      fail(`elementImagesManifest.entries[${index}]`, "catalog element 이미지 metadata와 일치하지 않습니다.");
    }
  }
  for (const [index, element] of catalog.elements.entries()) {
    if (!elementManifestById.has(element.id)) {
      fail(`catalog.elements[${index}].imageUrl`, "element manifest에 대응하는 asset이 없습니다.");
    }
  }
  return { catalog, itemImagesManifest, elementImagesManifest, manifest: manifestRaw as PalworldCatalogReleaseManifest };
}

export async function loadPalworldCatalogRuntimeSource(releaseRoot: string, options: {
  itemImageRoot: string;
  elementImageRoot: string;
}): Promise<PalworldCatalogRuntimeSource> {
  const source = await loadPalworldCatalogDataSource(releaseRoot);
  await Promise.all([
    validatePalworldCatalogAssetFiles({
      root: options.itemImageRoot,
      kind: "items",
      manifest: source.itemImagesManifest
    }),
    validatePalworldCatalogAssetFiles({
      root: options.elementImageRoot,
      kind: "elements",
      manifest: source.elementImagesManifest
    })
  ]);
  return source;
}

import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, mkdir, open, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PALWORLD_CATALOG_RELEASE,
  assertPalworldCatalogArtifact,
  assertPalworldCatalogAssetManifest,
  deterministicCatalogJson,
  sha256CatalogText,
  type PalworldCatalogArtifact,
  type PalworldCatalogAssetManifest,
  type PalworldCatalogItem,
  type PalworldCatalogPalDetail,
  type PalworldCatalogSkill,
  type PalworldCatalogSkillAssignment,
  type PalworldCatalogSpecialBreedingPair
} from "./palworld-catalog-artifact.js";
import {
  PALWORLD_IMAGE_SOURCE_MAX_PIXELS,
  inspectPalworldSourceImage,
  inspectPalworldWebp
} from "./palworld-image-import.js";
import {
  assertPalworldPaldexArtifact,
  assertPalworldPaldexReleaseManifest,
  type PalworldPaldexRecord,
  type PalworldPaldexSkillRecord
} from "./palworld-paldex-artifact.js";
import { PalworldSourceArchive, sha256File } from "./palworld-source-archive.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
export const PALWORLD_CATALOG_RELEASE_ROOT = path.join(REPOSITORY_ROOT, "apps/server/data/palworld", PALWORLD_CATALOG_RELEASE);
export const PALWORLD_CATALOG_PUBLIC_ROOT = path.join(REPOSITORY_ROOT, "apps/dashboard/public/images/palworld", PALWORLD_CATALOG_RELEASE);

export const PALWORLD_ATLAS_ARCHIVE_SHA256 = "8869d768d80d24e8443e6a82a3be338a092b4a656d77d6938a5265c3e2a164bb";
export const PALWORLD_PYPAL_ARCHIVE_SHA256 = "42676bdc3ecb6820e31fe8f18c875ba7ac226de5de78ddf966a92808709d5115";
export const PALWORLD_ATLAS_STEAM_BUILD_ID = "24181105";
export const PALWORLD_PYPAL_REVISION = "db70ea654aea70c4b1a4b0045bccfe58164cf01a";
export const PALWORLD_PYPAL_GAME_DATA_VERSION = "1.0.1.100619";
export const PALWORLD_CATALOG_VERIFIED_AT = "2026-07-22T00:00:00.000Z";

const ATLAS_ROOT = `palworld-atlas-data-main/published/v1/builds/${PALWORLD_ATLAS_STEAM_BUILD_ID}`;
const ATLAS_ITEMS_MEMBER = `${ATLAS_ROOT}/items/index.json`;
const ATLAS_BREEDING_MEMBER = `${ATLAS_ROOT}/breeding.json`;
const ATLAS_MANIFEST_MEMBER = `${ATLAS_ROOT}/manifest.json`;
const PALDEX_MANIFEST_FILE = "manifest.json";
const PYPAL_ROOT = "pyPalworldAPI-0.2.0";
const PYPAL_SQL_MEMBER = `${PYPAL_ROOT}/mysqldb/PalAPI.sql`;
const PYPAL_IMAGE_PREFIX = `${PYPAL_ROOT}/pyPalworldAPI`;
const PYPAL_SQL_SHA256 = "aaa759027e63f13c33a1d581fd1efd4bf434472053a46e6967aad94333811f0d";
const ATLAS_ITEMS_SHA256 = "7a48993c911a09a1030a92b9dbe454e3cbcc287b51fc9e3c94fe82d941a6c5a8";
const ATLAS_BREEDING_SHA256 = "dc39e4c8646eaa7f61573d832dcb854d31184713dfc815e0221dc83d947ae559";

type SqlPrimitive = string | number | null;
type SqlRow = Record<string, SqlPrimitive>;

const SQL_COLUMNS = {
  pals: ["ID", "DevName", "DexKey", "Image", "Name", "Wiki", "WikiImage", "Types", "Suitability", "Drops", "Aura", "Description", "Skills", "Stats", "Asset", "Genus", "Rarity", "Price", "Size", "Maps", "Breeding", "AIResponse", "Nocturnal", "Predator", "NooseTrap", "IsRaidBoss", "IgnoreStun", "IgnoreCombi", "FirstDefeatRewardItemID"],
  items: ["ID", "Name", "DevName", "Image", "Type", "Rank", "MaxStackCount", "Weight", "Gold", "Durability", "MagazineSize", "PhysicalAttackValue", "HPValue", "PhysicalDefenseValue", "ShieldValue", "MagicAttackValue", "MagicDefenseValue", "Description", "ItemActorClass", "PassiveSkills", "bLegalInGame"],
  crafting: ["ID", "SourceKey", "Name", "Output", "WorkAmount", "Material", "CraftExpRate"],
  passiveskills: ["ID", "Name", "DevName", "Ability", "Tier", "Description", "Image"],
  techtree: ["ID", "DevName", "Name", "UnlockBuildObjects", "UnlockItemRecipes", "Description", "Image", "RequireTechnology", "IsBossTechnology", "LevelCap", "Cost"]
} as const;

type AllowedSqlTable = keyof typeof SQL_COLUMNS;

type AtlasItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  rarity: number;
  rank: number;
  maxStack: number;
  weight: number;
  price: number;
  icon: string;
};

type ParsedPyItem = {
  name: string;
  devName: string;
  image: string | null;
  durability: number | null;
  description: string;
  legal: boolean;
};

type AtlasBreedingPair = {
  parentAId: string;
  parentBId: string;
  childId: string;
  parentAGender?: "male" | "female";
  parentBGender?: "male" | "female";
};

type ConvertedAsset = {
  member: string;
  sourceSha256: string;
  outputSha256: string;
  outputFileName: string;
  outputWidth: number;
  outputHeight: number;
  outputBytes: number;
  output: Buffer;
};

function fail(message: string): never {
  throw new TypeError(message);
}

function sha256(buffer: Buffer | string): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requireString(value: unknown, pathName: string, maxLength = 8_192): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.length > maxLength || value.includes("\0")) fail(`${pathName}: 올바른 문자열이 아닙니다.`);
  return value;
}

function requireNumber(value: unknown, pathName: string, min = 0, max = 1_000_000_000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(`${pathName}: 올바른 숫자가 아닙니다.`);
  return value;
}

function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[\t ]+/gu, " ")
    .replace(/ *\n */gu, "\n")
    .trim();
}

function publicId(sourceInternalId: string): string {
  const base = sourceInternalId
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLocaleLowerCase("en-US");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(base)) fail(`public ID를 만들 수 없는 internal ID입니다: ${sourceInternalId}`);
  return base;
}

function decodeMysqlEscape(character: string): string {
  if (character === "0") return "\0";
  if (character === "b") return "\b";
  if (character === "n") return "\n";
  if (character === "r") return "\r";
  if (character === "t") return "\t";
  if (character === "Z") return "\x1a";
  return character;
}

function parseSqlValue(sql: string, start: number): { value: SqlPrimitive; next: number } {
  if (sql[start] === "'") {
    let value = "";
    let cursor = start + 1;
    while (cursor < sql.length) {
      const character = sql[cursor]!;
      if (character === "\\") {
        if (cursor + 1 >= sql.length) fail("SQL 문자열 escape가 잘렸습니다.");
        value += decodeMysqlEscape(sql[cursor + 1]!);
        cursor += 2;
        continue;
      }
      if (character === "'") {
        if (sql[cursor + 1] === "'") {
          value += "'";
          cursor += 2;
          continue;
        }
        return { value, next: cursor + 1 };
      }
      value += character;
      cursor += 1;
    }
    fail("SQL 문자열이 닫히지 않았습니다.");
  }
  let cursor = start;
  while (cursor < sql.length && sql[cursor] !== "," && sql[cursor] !== ")") cursor += 1;
  const token = sql.slice(start, cursor).trim();
  if (token === "NULL") return { value: null, next: cursor };
  if (!/^-?(?:\d+|\d+\.\d+)(?:e[+-]?\d+)?$/iu.test(token)) fail(`허용되지 않은 SQL literal입니다: ${token.slice(0, 80)}`);
  const value = Number(token);
  if (!Number.isFinite(value)) fail("SQL 숫자가 유한하지 않습니다.");
  return { value, next: cursor };
}

function skipWhitespace(sql: string, start: number): number {
  let cursor = start;
  while (cursor < sql.length && /\s/u.test(sql[cursor]!)) cursor += 1;
  return cursor;
}

export function parseAllowedSqlTables(sql: string): Record<AllowedSqlTable, SqlRow[]> {
  if (Buffer.byteLength(sql) > 8 * 1024 * 1024 || sql.includes("\0")) fail("SQL source 크기 또는 형식이 허용 범위를 벗어납니다.");
  const output = Object.fromEntries(Object.keys(SQL_COLUMNS).map((table) => [table, []])) as unknown as Record<AllowedSqlTable, SqlRow[]>;
  const insertPattern = /INSERT INTO `([a-z]+)` \(([^\n]+)\) VALUES\s*/gu;
  let match: RegExpExecArray | null;
  while ((match = insertPattern.exec(sql)) !== null) {
    const table = match[1] as AllowedSqlTable;
    if (!(table in SQL_COLUMNS)) continue;
    const columns = [...match[2]!.matchAll(/`([A-Za-z0-9_]+)`/gu)].map((column) => column[1]!);
    const expected = SQL_COLUMNS[table] as readonly string[];
    if (columns.length !== expected.length || columns.some((column, index) => column !== expected[index])) fail(`${table}: SQL column allowlist와 일치하지 않습니다.`);
    let cursor = insertPattern.lastIndex;
    for (;;) {
      cursor = skipWhitespace(sql, cursor);
      if (sql[cursor] !== "(") fail(`${table}: SQL row 시작 괄호가 없습니다.`);
      cursor += 1;
      const values: SqlPrimitive[] = [];
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        cursor = skipWhitespace(sql, cursor);
        const parsed = parseSqlValue(sql, cursor);
        values.push(parsed.value);
        cursor = skipWhitespace(sql, parsed.next);
        const expectedSeparator = columnIndex === columns.length - 1 ? ")" : ",";
        if (sql[cursor] !== expectedSeparator) fail(`${table}: SQL column separator가 올바르지 않습니다.`);
        cursor += 1;
      }
      output[table].push(Object.fromEntries(columns.map((column, index) => [column, values[index]!])));
      cursor = skipWhitespace(sql, cursor);
      if (sql[cursor] === ";") {
        insertPattern.lastIndex = cursor + 1;
        break;
      }
      if (sql[cursor] !== ",") fail(`${table}: SQL row separator가 올바르지 않습니다.`);
      cursor += 1;
    }
  }
  for (const table of Object.keys(SQL_COLUMNS) as AllowedSqlTable[]) if (output[table].length < 1) fail(`필수 SQL table 데이터가 없습니다: ${table}`);
  return output;
}

function jsonValue(value: SqlPrimitive, pathName: string): unknown {
  if (typeof value !== "string" || value.length > 512 * 1024) fail(`${pathName}: JSON 문자열이 아닙니다.`);
  try {
    return JSON.parse(value);
  } catch {
    fail(`${pathName}: JSON 파싱에 실패했습니다.`);
  }
}

function sqlString(row: SqlRow, key: string, maxLength = 8_192): string {
  return requireString(row[key], key, maxLength);
}

function sqlValue(row: SqlRow, key: string): SqlPrimitive {
  if (!(key in row)) fail(`${key}: SQL allowlist row에 필드가 없습니다.`);
  return row[key]!;
}

function sqlNullableString(row: SqlRow, key: string, maxLength = 8_192): string | undefined {
  const value = row[key];
  if (value === null || value === "") return undefined;
  return requireString(value, key, maxLength);
}

function sqlNumber(row: SqlRow, key: string, min = 0, max = 1_000_000_000): number {
  return requireNumber(row[key], key, min, max);
}

function parsePyItem(row: SqlRow): ParsedPyItem {
  const image = row.Image === null || row.Image === "None" ? null : requireString(row.Image, "items.Image", 256);
  return {
    name: sqlString(row, "Name", 256),
    devName: sqlString(row, "DevName", 128),
    image,
    durability: row.Durability === null ? null : sqlNumber(row, "Durability"),
    description: plainText(sqlNullableString(row, "Description") ?? ""),
    legal: row.bLegalInGame === 1
  };
}

function assertAtlasItems(value: unknown): AtlasItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value as object).join(",") !== "records") fail("Atlas item root schema가 올바르지 않습니다.");
  const records = (value as { records?: unknown }).records;
  if (!Array.isArray(records) || records.length !== 1_891) fail("Atlas item 수가 1,891개가 아닙니다.");
  const allowed = ["id", "name", "description", "category", "subcategory", "rarity", "rank", "maxStack", "weight", "price", "icon"];
  const result: AtlasItem[] = [];
  const ids = new Set<string>();
  for (const [index, valueRecord] of records.entries()) {
    if (!valueRecord || typeof valueRecord !== "object" || Array.isArray(valueRecord)) fail(`Atlas items[${index}]가 객체가 아닙니다.`);
    const record = valueRecord as Record<string, unknown>;
    if (Object.keys(record).some((key) => !allowed.includes(key)) || allowed.some((key) => !(key in record))) fail(`Atlas items[${index}]에 허용되지 않거나 누락된 필드가 있습니다.`);
    const id = requireString(record.id, `Atlas items[${index}].id`, 128);
    if (!/^[A-Za-z0-9_]+$/u.test(id) || ids.has(id)) fail(`Atlas item internal ID가 올바르지 않거나 중복됩니다: ${id}`);
    ids.add(id);
    result.push({
      id,
      name: requireString(record.name, `Atlas items[${index}].name`, 256),
      description: plainText(requireString(record.description, `Atlas items[${index}].description`)),
      category: requireString(record.category, `Atlas items[${index}].category`, 128),
      subcategory: requireString(record.subcategory, `Atlas items[${index}].subcategory`, 128),
      rarity: requireNumber(record.rarity, `Atlas items[${index}].rarity`, 0, 20),
      rank: requireNumber(record.rank, `Atlas items[${index}].rank`, 0, 1_000),
      maxStack: requireNumber(record.maxStack, `Atlas items[${index}].maxStack`, 0, 100_000_000),
      weight: requireNumber(record.weight, `Atlas items[${index}].weight`, 0, 1_000_000),
      price: requireNumber(record.price, `Atlas items[${index}].price`),
      icon: requireString(record.icon, `Atlas items[${index}].icon`, 128)
    });
  }
  return result;
}

function assertAtlasBreeding(value: unknown): AtlasBreedingPair[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Atlas breeding root가 객체가 아닙니다.");
  const root = value as Record<string, unknown>;
  if (Object.keys(root).some((key) => key !== "sameSpeciesProducesSelf" && key !== "uniquePairs")) {
    fail("Atlas breeding root에 허용되지 않은 필드가 있습니다.");
  }
  if (root.sameSpeciesProducesSelf !== true || !Array.isArray(root.uniquePairs) || root.uniquePairs.length !== 257) {
    fail("Atlas breeding 고정 inventory가 same-species=true, 257행과 일치하지 않습니다.");
  }
  const seen = new Set<string>();
  return root.uniquePairs.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`Atlas breeding.uniquePairs[${index}]가 객체가 아닙니다.`);
    const pair = raw as Record<string, unknown>;
    const allowed = new Set(["parentAId", "parentBId", "childId", "parentAGender", "parentBGender"]);
    if (Object.keys(pair).some((key) => !allowed.has(key))) fail(`Atlas breeding.uniquePairs[${index}]에 허용되지 않은 필드가 있습니다.`);
    const result: AtlasBreedingPair = {
      parentAId: requireString(pair.parentAId, `Atlas breeding.uniquePairs[${index}].parentAId`, 128),
      parentBId: requireString(pair.parentBId, `Atlas breeding.uniquePairs[${index}].parentBId`, 128),
      childId: requireString(pair.childId, `Atlas breeding.uniquePairs[${index}].childId`, 128)
    };
    for (const field of ["parentAId", "parentBId", "childId"] as const) {
      if (!/^[A-Za-z0-9_]+$/u.test(result[field])) fail(`Atlas breeding.uniquePairs[${index}].${field}가 고정 internal ID가 아닙니다.`);
    }
    for (const field of ["parentAGender", "parentBGender"] as const) {
      const gender = pair[field];
      if (gender !== undefined && gender !== "male" && gender !== "female") fail(`Atlas breeding.uniquePairs[${index}].${field}가 허용된 성별이 아닙니다.`);
      if (gender !== undefined) result[field] = gender;
    }
    const key = JSON.stringify(result);
    if (seen.has(key)) fail(`Atlas breeding.uniquePairs[${index}]가 중복됩니다.`);
    seen.add(key);
    return result;
  });
}

function itemCategory(item: AtlasItem): PalworldCatalogItem["category"] {
  if (item.subcategory === "SPWeaponCaptureBall") return "sphere";
  if (item.subcategory === "Medicine" || item.subcategory === "Drug") return "medicine";
  const mapping: Record<string, PalworldCatalogItem["category"]> = {
    Accessory: "accessory",
    Ammo: "ammo",
    Armor: "armor",
    Blueprint: "key_item",
    CaptureItemModifier: "other",
    Consume: "consumable",
    Essential: "key_item",
    Food: "food",
    Glider: "accessory",
    Material: "material",
    SpecialWeapon: "weapon",
    Weapon: "weapon"
  };
  const category = mapping[item.category];
  if (!category) fail(`명시적으로 매핑되지 않은 Atlas item category입니다: ${item.category}`);
  return category;
}

function elementFromSource(value: string): string | undefined {
  const mapping: Record<string, string> = {
    None: "neutral",
    Neutral: "neutral",
    Fire: "fire",
    Water: "water",
    Electric: "electric",
    Electricity: "electric",
    Grass: "grass",
    Leaf: "grass",
    Ice: "ice",
    Earth: "ground",
    Ground: "ground",
    Dark: "dark",
    Dragon: "dragon"
  };
  return mapping[value];
}

function sourceImageMember(sourcePath: string): string | undefined {
  if (!/^\/public\/images\/[A-Za-z0-9_./-]+\.png$/u.test(sourcePath) || sourcePath.includes("..")) return undefined;
  return `${PYPAL_IMAGE_PREFIX}${sourcePath}`;
}

function imageAssetKey(imagePath: string): string | undefined {
  const fileName = path.posix.basename(imagePath, ".png");
  const key = fileName.replace(/^T_(?:itemicon|icon)_/u, "");
  return /^[A-Za-z0-9_]+$/u.test(key) ? key : undefined;
}

async function convertIcon(source: Buffer, member: string): Promise<ConvertedAsset> {
  const inspection = await inspectPalworldSourceImage(source, member);
  const { default: sharp } = await import("sharp");
  let output = await sharp(source, { animated: false, failOn: "warning", limitInputPixels: PALWORLD_IMAGE_SOURCE_MAX_PIXELS })
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  if (output.length > 512 * 1024) {
    output = await sharp(source, { animated: false, failOn: "warning", limitInputPixels: PALWORLD_IMAGE_SOURCE_MAX_PIXELS })
      .rotate()
      .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .webp({ nearLossless: true, quality: 90, alphaQuality: 100, effort: 6 })
      .toBuffer();
  }
  const converted = inspectPalworldWebp(output);
  return {
    member,
    sourceSha256: inspection.sha256,
    outputSha256: converted.sha256,
    outputFileName: `${converted.sha256}.webp`,
    outputWidth: converted.width,
    outputHeight: converted.height,
    outputBytes: converted.bytes,
    output
  };
}

async function writeContentHashAsset(directory: string, asset: ConvertedAsset): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o755 });
  const target = path.join(directory, asset.outputFileName);
  if (path.dirname(target) !== directory) fail("asset output 경로 traversal이 감지되었습니다.");
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile() || info.size !== asset.output.length) fail(`기존 asset이 안전하지 않습니다: ${target}`);
    const handle = await open(target, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    try {
      const existing = await handle.readFile();
      if (!existing.equals(asset.output)) fail(`기존 content-hash asset 내용이 다릅니다: ${target}`);
    } finally {
      await handle.close();
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = path.join(directory, `.${asset.outputFileName}.${process.pid}.tmp`);
  try {
    await writeFile(temporary, asset.output, { flag: "wx", mode: 0o644 });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function writeAtomicText(filePath: string, value: string): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o755 });
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, value, { flag: "wx", mode: 0o644 });
    await rename(temporary, filePath);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

async function mapLimit<T, R>(values: readonly T[], limit: number, task: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      output[index] = await task(values[index]!);
    }
  }));
  return output;
}

function uniqueNameMap(items: ReadonlyArray<{ nameEn: string; id: string }>): Map<string, string> {
  const candidates = new Map<string, string | null>();
  for (const item of items) {
    const existing = candidates.get(item.nameEn);
    candidates.set(item.nameEn, existing === undefined ? item.id : existing === item.id ? item.id : null);
  }
  return new Map([...candidates].flatMap(([name, id]) => id === null ? [] : [[name, id]]));
}

function parseDropList(value: SqlPrimitive, pathName: string): Array<{ nameEn: string; minimum: number; maximum: number; rate: number }> {
  const parsed = jsonValue(value, pathName);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const drop = raw as Record<string, unknown>;
    const nameEn = typeof drop.Name === "string" ? plainText(drop.Name) : "";
    if (!nameEn) return [];
    const minimum = requireNumber(drop.Min, `${pathName}[${index}].Min`, 0, 1_000_000);
    const maximum = requireNumber(drop.Max, `${pathName}[${index}].Max`, 0, 1_000_000);
    const rate = requireNumber(drop.Rate, `${pathName}[${index}].Rate`, 0, 100);
    if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) fail(`${pathName}[${index}]: drop 수량이 올바르지 않습니다.`);
    return [{ nameEn, minimum, maximum, rate }];
  });
}

function verifiedElementImagePaths(rows: readonly SqlRow[]): ReadonlyMap<string, string> {
  const paths = new Map<string, string>();
  for (const row of rows) {
    const sourceInternalId = sqlString(row, "DevName", 128);
    const rawTypes = jsonValue(sqlValue(row, "Types"), `pals.${sourceInternalId}.Types`);
    if (!Array.isArray(rawTypes)) fail(`pals.${sourceInternalId}.Types는 배열이어야 합니다.`);
    for (const [index, rawType] of rawTypes.entries()) {
      if (!rawType || typeof rawType !== "object" || Array.isArray(rawType)) {
        fail(`pals.${sourceInternalId}.Types[${index}]가 객체가 아닙니다.`);
      }
      const type = rawType as Record<string, unknown>;
      if (Object.keys(type).some((key) => key !== "Name" && key !== "Image")) {
        fail(`pals.${sourceInternalId}.Types[${index}]에 허용되지 않은 필드가 있습니다.`);
      }
      const sourceName = requireString(type.Name, `pals.${sourceInternalId}.Types[${index}].Name`, 32);
      const sourcePath = requireString(type.Image, `pals.${sourceInternalId}.Types[${index}].Image`, 128);
      if (!/^\/public\/images\/elements\/T_Icon_element_s_[0-9]{2}\.png$/u.test(sourcePath)) {
        fail(`pals.${sourceInternalId}.Types[${index}].Image가 고정 element PNG 경로가 아닙니다.`);
      }
      const existing = paths.get(sourceName);
      if (existing !== undefined && existing !== sourcePath) {
        fail(`동일한 source element가 서로 다른 이미지에 연결되었습니다: ${sourceName}`);
      }
      paths.set(sourceName, sourcePath);
    }
  }
  return paths;
}

function skillId(type: "active" | "passive", sourceId: string, signature: string): string {
  const base = publicId(sourceId).slice(0, 84);
  return `${type}-${base}-${sha256(signature).slice(0, 10)}`;
}

const ACTIVE_SKILL_CONFLICT_OVERRIDES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // 두 원문 설명은 서로 다른 Pal에 실제로 배정되어 있으므로 병합하지 않고 별도 canonical ID로 보존한다.
  "Double Fang": Object.freeze([
    JSON.stringify(["Double Fang", "neutral", 40, 2, "Bites rapidly in succession to attack enemies."]),
    JSON.stringify(["Double Fang", "neutral", 40, 2, "Launches a rapid succession of bites at the enemy."])
  ].sort(codePointCompare))
});

function assertActiveSkillConflictOverrides(activeNameSignatures: ReadonlyMap<string, ReadonlySet<string>>): number {
  const conflicts = [...activeNameSignatures]
    .filter(([, signatures]) => signatures.size > 1)
    .sort(([left], [right]) => codePointCompare(left, right));
  const expectedNames = Object.keys(ACTIVE_SKILL_CONFLICT_OVERRIDES).sort(codePointCompare);
  if (conflicts.length !== expectedNames.length) fail("active skill 이름 충돌 수가 명시적 canonical override와 다릅니다.");
  for (const [index, [name, signatures]] of conflicts.entries()) {
    if (name !== expectedNames[index]) fail(`검토되지 않은 active skill 이름 충돌입니다: ${name}`);
    const expected = ACTIVE_SKILL_CONFLICT_OVERRIDES[name]!;
    const actual = [...signatures].sort(codePointCompare);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      fail(`active skill canonical override의 signature가 원본과 다릅니다: ${name}`);
    }
  }
  return conflicts.length;
}

function embeddedPaldexSkill(
  skill: PalworldCatalogSkill,
  unlockLevel?: number
): PalworldPaldexSkillRecord {
  if (skill.type !== "active" && skill.type !== "partner") fail(`Pal 상세에 배정할 수 없는 skill 종류입니다: ${skill.id}`);
  return {
    id: skill.id,
    type: skill.type,
    nameEn: skill.nameEn,
    ...(skill.descriptionEn === undefined ? {} : { descriptionEn: skill.descriptionEn }),
    ...(skill.element === undefined ? {} : { element: skill.element as PalworldPaldexSkillRecord["element"] }),
    ...(skill.power === undefined ? {} : { power: skill.power }),
    ...(skill.cooldownSeconds === undefined ? {} : { cooldownSeconds: skill.cooldownSeconds }),
    ...(unlockLevel === undefined ? {} : { unlockLevel })
  };
}

async function assertRegularArchive(filePath: string, expectedSha256: string): Promise<void> {
  const resolved = path.resolve(filePath);
  const info = await lstat(resolved);
  if (info.isSymbolicLink() || !info.isFile() || await realpath(resolved) !== resolved) fail(`archive는 symlink가 아닌 canonical regular file이어야 합니다: ${path.basename(filePath)}`);
  const actual = await sha256File(resolved);
  if (actual.sha256 !== expectedSha256) fail(`${path.basename(filePath)} SHA-256이 고정값과 일치하지 않습니다.`);
}

export async function importPalworldCatalog(input: {
  atlasArchivePath: string;
  pyPalArchivePath: string;
  releaseRoot?: string;
  publicRoot?: string;
}): Promise<{ catalog: PalworldCatalogArtifact; itemManifest: PalworldCatalogAssetManifest; elementManifest: PalworldCatalogAssetManifest }> {
  await Promise.all([
    assertRegularArchive(input.atlasArchivePath, PALWORLD_ATLAS_ARCHIVE_SHA256),
    assertRegularArchive(input.pyPalArchivePath, PALWORLD_PYPAL_ARCHIVE_SHA256)
  ]);
  const [atlasArchive, pyPalArchive] = await Promise.all([
    PalworldSourceArchive.open(input.atlasArchivePath),
    PalworldSourceArchive.open(input.pyPalArchivePath)
  ]);
  try {
    const [atlasItemsBytes, atlasBreedingBytes, atlasManifestBytes, sqlBytes, paldexBytes, paldexManifestBytes] = await Promise.all([
      atlasArchive.readEntry(ATLAS_ITEMS_MEMBER, 2 * 1024 * 1024),
      atlasArchive.readEntry(ATLAS_BREEDING_MEMBER, 256 * 1024),
      atlasArchive.readEntry(ATLAS_MANIFEST_MEMBER, 128 * 1024),
      pyPalArchive.readEntry(PYPAL_SQL_MEMBER, 8 * 1024 * 1024),
      readFile(path.join(PALWORLD_CATALOG_RELEASE_ROOT, "paldex.json")),
      readFile(path.join(PALWORLD_CATALOG_RELEASE_ROOT, PALDEX_MANIFEST_FILE))
    ]);
    if (sha256(atlasItemsBytes) !== ATLAS_ITEMS_SHA256) fail("Atlas items entry checksum이 고정값과 일치하지 않습니다.");
    if (sha256(atlasBreedingBytes) !== ATLAS_BREEDING_SHA256) fail("Atlas breeding entry checksum이 고정값과 일치하지 않습니다.");
    if (sha256(sqlBytes) !== PYPAL_SQL_SHA256) fail("pyPal SQL entry checksum이 고정값과 일치하지 않습니다.");
    const atlasManifest = JSON.parse(atlasManifestBytes.toString("utf8")) as Record<string, unknown>;
    if (atlasManifest.steamBuildId !== PALWORLD_ATLAS_STEAM_BUILD_ID) fail("Atlas manifest Steam build가 고정값과 일치하지 않습니다.");
    const atlasItems = assertAtlasItems(JSON.parse(atlasItemsBytes.toString("utf8")));
    const atlasBreeding = assertAtlasBreeding(JSON.parse(atlasBreedingBytes.toString("utf8")));
    const tables = parseAllowedSqlTables(sqlBytes.toString("utf8"));
    if (tables.pals.length !== 271 || tables.items.length !== 1_790 || tables.crafting.length !== 913 || tables.passiveskills.length !== 79 || tables.techtree.length !== 586) {
      fail("pyPal SQL table record 수가 고정 inventory와 일치하지 않습니다.");
    }

    const paldex = JSON.parse(paldexBytes.toString("utf8")) as {
      metadata?: unknown;
      records?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(paldex.records) || paldex.records.length !== 287) fail("기존 canonical Pal artifact가 287종이 아닙니다.");
    const canonicalPals = paldex.records.map((record, index) => ({
      palId: publicId(requireString(record.id, `paldex.records[${index}].id`, 128)),
      sourceInternalId: requireString(record.sourceInternalId, `paldex.records[${index}].sourceInternalId`, 128)
    }));
    const palByInternalId = new Map(canonicalPals.map((pal) => [pal.sourceInternalId, pal]));
    let unresolvedBreedingReferences = 0;
    const specialBreedingPairs: PalworldCatalogSpecialBreedingPair[] = [];
    for (const pair of atlasBreeding) {
      const parentA = palByInternalId.get(pair.parentAId);
      const parentB = palByInternalId.get(pair.parentBId);
      const child = palByInternalId.get(pair.childId);
      if (!parentA || !parentB || !child) {
        unresolvedBreedingReferences += 1;
        continue;
      }
      if (pair.parentAId === pair.parentBId && pair.parentAId === pair.childId) continue;
      specialBreedingPairs.push({
        parentAId: parentA.palId,
        parentBId: parentB.palId,
        childId: child.palId,
        ...(pair.parentAGender === undefined ? {} : { parentAGender: pair.parentAGender }),
        ...(pair.parentBGender === undefined ? {} : { parentBGender: pair.parentBGender })
      });
    }
    specialBreedingPairs.sort((left, right) => codePointCompare(
      `${left.childId}\0${left.parentAId}\0${left.parentBId}\0${left.parentAGender ?? ""}\0${left.parentBGender ?? ""}`,
      `${right.childId}\0${right.parentAId}\0${right.parentBId}\0${right.parentAGender ?? ""}\0${right.parentBGender ?? ""}`
    ));
    if (new Set(specialBreedingPairs.map((pair) => JSON.stringify(pair))).size !== specialBreedingPairs.length) {
      fail("Atlas special breeding exact mapping이 중복됩니다.");
    }

    const pyItems = tables.items.map(parsePyItem);
    const pyItemsByDev = new Map<string, ParsedPyItem>();
    for (const item of pyItems) {
      if (pyItemsByDev.has(item.devName)) fail(`pyPal item DevName이 중복됩니다: ${item.devName}`);
      pyItemsByDev.set(item.devName, item);
    }
    const placeholderItems = new Set(atlasItems.filter((item) => item.name === "en Text").map((item) => item.id));
    const illegalItems = new Set(atlasItems.filter((item) => pyItemsByDev.get(item.id)?.legal === false).map((item) => item.id));
    const runtimeAtlasItems = atlasItems.filter((item) => !placeholderItems.has(item.id) && !illegalItems.has(item.id));

    const publicIds = new Map<string, string>();
    for (const item of runtimeAtlasItems) {
      let id = publicId(item.id);
      const existing = publicIds.get(id);
      if (existing && existing !== item.id) id = `${id}-${sha256(item.id).slice(0, 8)}`;
      if (publicIds.has(id)) fail(`결정적 item public ID가 충돌합니다: ${item.id}`);
      publicIds.set(id, item.id);
    }
    const itemIdByInternal = new Map([...publicIds].map(([id, internal]) => [internal, id]));

    const exactIconSources = new Map<string, string | null>();
    for (const item of runtimeAtlasItems) {
      const pyItem = pyItemsByDev.get(item.id);
      if (!pyItem?.legal || !pyItem.image) continue;
      // exact DevName으로 검증된 item의 Atlas icon key를 source PNG에 고정한다.
      // 이후 동일한 Atlas icon key를 공유하는 변형만 명시적으로 전파한다.
      const sourceKey = imageAssetKey(pyItem.image);
      if (!sourceKey) continue;
      const member = sourceImageMember(pyItem.image);
      if (!member || !pyPalArchive.entries.has(member)) continue;
      const existing = exactIconSources.get(item.icon);
      exactIconSources.set(item.icon, existing === undefined || existing === member ? member : null);
    }

    const itemSourceMembers = new Map<string, string>();
    for (const item of runtimeAtlasItems) {
      const pyItem = pyItemsByDev.get(item.id);
      const directMember = pyItem?.legal && pyItem.image ? sourceImageMember(pyItem.image) : undefined;
      if (directMember && pyPalArchive.entries.has(directMember)) itemSourceMembers.set(item.id, directMember);
      else {
        const propagated = exactIconSources.get(item.icon);
        if (propagated) itemSourceMembers.set(item.id, propagated);
      }
    }

    const uniqueImageMembers = [...new Set(itemSourceMembers.values())].sort(codePointCompare);
    const convertedByMember = new Map<string, ConvertedAsset>();
    const itemImageRoot = path.join(input.publicRoot ?? PALWORLD_CATALOG_PUBLIC_ROOT, "items");
    const convertedItems = await mapLimit(uniqueImageMembers, 8, async (member) => {
      const source = await pyPalArchive.readEntry(member, 16 * 1024 * 1024);
      const converted = await convertIcon(source, member);
      await writeContentHashAsset(itemImageRoot, converted);
      return converted;
    });
    convertedItems.forEach((asset) => convertedByMember.set(asset.member, asset));

    const baseItems: PalworldCatalogItem[] = runtimeAtlasItems.map((atlasItem) => {
      const pyItem = pyItemsByDev.get(atlasItem.id);
      const member = itemSourceMembers.get(atlasItem.id);
      const image = member ? convertedByMember.get(member) : undefined;
      const id = itemIdByInternal.get(atlasItem.id)!;
      return {
        id,
        sourceInternalId: atlasItem.id,
        nameEn: atlasItem.name,
        ...(atlasItem.description ? { descriptionEn: atlasItem.description } : pyItem?.description ? { descriptionEn: pyItem.description } : {}),
        category: itemCategory(atlasItem),
        sourceCategory: `${atlasItem.category}/${atlasItem.subcategory}`,
        rarity: atlasItem.rarity,
        rank: atlasItem.rank,
        maxStack: atlasItem.maxStack,
        weight: atlasItem.weight,
        ...(atlasItem.price > 0 ? { sellPrice: atlasItem.price } : {}),
        ...(pyItem?.durability !== null && pyItem?.durability !== undefined ? { durability: pyItem.durability } : {}),
        craftingMaterials: [],
        dropPalIds: [],
        ...(image ? {
          imageUrl: `/images/palworld/${PALWORLD_CATALOG_RELEASE}/items/${image.outputFileName}`,
          imageWidth: image.outputWidth,
          imageHeight: image.outputHeight
        } : {})
      };
    });
    const itemById = new Map(baseItems.map((item) => [item.id, item]));
    const itemNameToId = uniqueNameMap(baseItems);

    let unresolvedCraftingReferences = 0;
    for (const row of tables.crafting) {
      const targetId = itemIdByInternal.get(sqlString(row, "SourceKey", 128));
      if (!targetId) continue;
      const target = itemById.get(targetId)!;
      const rawMaterials = jsonValue(sqlValue(row, "Material"), "crafting.Material");
      if (!rawMaterials || typeof rawMaterials !== "object" || Array.isArray(rawMaterials)) continue;
      const materials: Array<{ itemId: string; quantity: number }> = [];
      for (const [name, rawQuantity] of Object.entries(rawMaterials as Record<string, unknown>)) {
        const materialId = itemNameToId.get(name);
        if (!materialId) {
          unresolvedCraftingReferences += 1;
          continue;
        }
        const quantity = requireNumber(rawQuantity, `crafting.Material.${name}`, 1, 1_000_000);
        if (!Number.isInteger(quantity)) fail("crafting material quantity는 정수여야 합니다.");
        materials.push({ itemId: materialId, quantity });
      }
      materials.sort((left, right) => codePointCompare(left.itemId, right.itemId));
      target.craftingMaterials = materials;
    }

    let unresolvedTechnologyReferences = 0;
    const technologyLevels = new Map<string, number>();
    for (const row of tables.techtree) {
      const raw = jsonValue(sqlValue(row, "UnlockItemRecipes"), "techtree.UnlockItemRecipes");
      if (raw === null) continue;
      if (!Array.isArray(raw)) fail("techtree.UnlockItemRecipes는 배열 또는 null이어야 합니다.");
      const level = sqlNumber(row, "LevelCap", 0, 1_000);
      for (const name of raw) {
        if (typeof name !== "string") fail("techtree recipe 이름은 문자열이어야 합니다.");
        const itemId = itemNameToId.get(name);
        if (!itemId) {
          unresolvedTechnologyReferences += 1;
          continue;
        }
        technologyLevels.set(itemId, Math.min(technologyLevels.get(itemId) ?? level, level));
      }
    }
    for (const [itemId, technologyLevel] of technologyLevels) itemById.get(itemId)!.technologyLevel = technologyLevel;

    const skillsBySignature = new Map<string, PalworldCatalogSkill>();
    const assignments: PalworldCatalogSkillAssignment[] = [];
    const palDetails: PalworldCatalogPalDetail[] = [];
    const dropPalIdsByItem = new Map<string, Set<string>>();
    let unresolvedDropReferences = 0;
    let activeSkillConflicts = 0;
    const activeNameSignatures = new Map<string, Set<string>>();
    for (const row of tables.pals) {
      const sourceInternalId = sqlString(row, "DevName", 128);
      const canonical = palByInternalId.get(sourceInternalId);
      if (!canonical) continue;
      const descriptionEn = plainText(sqlNullableString(row, "Description") ?? "");
      const rawAura = jsonValue(sqlValue(row, "Aura"), `pals.${sourceInternalId}.Aura`);
      let partnerSkillId: string | undefined;
      if (rawAura && typeof rawAura === "object" && !Array.isArray(rawAura)) {
        const aura = rawAura as Record<string, unknown>;
        const auraDescription = typeof aura.Description === "string" ? plainText(aura.Description) : "";
        const auraName = typeof aura.Name === "string" && aura.Name.trim() ? plainText(aura.Name) : `Partner Skill: ${sqlString(row, "Name", 256)}`;
        if (auraDescription || (typeof aura.Name === "string" && aura.Name.trim())) {
          partnerSkillId = `partner-${canonical.palId}`;
          skillsBySignature.set(partnerSkillId, { id: partnerSkillId, type: "partner", nameEn: auraName, ...(auraDescription ? { descriptionEn: auraDescription } : {}) });
          assignments.push({ palId: canonical.palId, skillId: partnerSkillId, kind: "partner" });
        }
      }
      const rawSkills = jsonValue(sqlValue(row, "Skills"), `pals.${sourceInternalId}.Skills`);
      if (!Array.isArray(rawSkills)) fail(`pals.${sourceInternalId}.Skills는 배열이어야 합니다.`);
      for (const [index, rawSkill] of rawSkills.entries()) {
        if (!rawSkill || typeof rawSkill !== "object" || Array.isArray(rawSkill)) fail(`pals.${sourceInternalId}.Skills[${index}]가 객체가 아닙니다.`);
        const skill = rawSkill as Record<string, unknown>;
        const nameEn = requireString(skill.Name, `pals.${sourceInternalId}.Skills[${index}].Name`, 256);
        const sourceElement = requireString(skill.Type, `pals.${sourceInternalId}.Skills[${index}].Type`, 32);
        const element = elementFromSource(sourceElement);
        if (element === undefined) fail(`pals.${sourceInternalId}.Skills[${index}].Type에 명시적으로 매핑되지 않은 element가 있습니다: ${sourceElement}`);
        const power = requireNumber(skill.Power, `pals.${sourceInternalId}.Skills[${index}].Power`, 0, 100_000);
        const cooldownSeconds = requireNumber(skill.Cooldown, `pals.${sourceInternalId}.Skills[${index}].Cooldown`, 0, 100_000);
        const unlockLevel = requireNumber(skill.Level, `pals.${sourceInternalId}.Skills[${index}].Level`, 0, 1_000);
        if (!Number.isInteger(power) || !Number.isInteger(unlockLevel)) fail("active skill power와 level은 정수여야 합니다.");
        const description = typeof skill.Description === "string" ? plainText(skill.Description) : "";
        const signature = JSON.stringify([nameEn, element, power, cooldownSeconds, description]);
        const id = skillId("active", nameEn, signature);
        const nameSignatures = activeNameSignatures.get(nameEn) ?? new Set<string>();
        nameSignatures.add(signature);
        activeNameSignatures.set(nameEn, nameSignatures);
        skillsBySignature.set(id, {
          id,
          type: "active",
          nameEn,
          ...(description ? { descriptionEn: description } : {}),
          element,
          power,
          cooldownSeconds
        });
        assignments.push({ palId: canonical.palId, skillId: id, kind: "active", unlockLevel });
      }
      const drops = parseDropList(sqlValue(row, "Drops"), `pals.${sourceInternalId}.Drops`).map((drop) => {
        const itemId = itemNameToId.get(drop.nameEn);
        if (!itemId) unresolvedDropReferences += 1;
        else {
          const set = dropPalIdsByItem.get(itemId) ?? new Set<string>();
          set.add(canonical.palId);
          dropPalIdsByItem.set(itemId, set);
        }
        return {
          ...(itemId ? { itemId, itemSourceInternalId: itemById.get(itemId)!.sourceInternalId } : {}),
          ...drop
        };
      });
      palDetails.push({
        palId: canonical.palId,
        sourceInternalId,
        ...(descriptionEn ? { descriptionEn } : {}),
        ...(partnerSkillId ? { partnerSkillId } : {}),
        drops
      });
    }
    activeSkillConflicts = assertActiveSkillConflictOverrides(activeNameSignatures);

    for (const row of tables.passiveskills) {
      const devName = sqlString(row, "DevName", 128);
      const nameEn = sqlString(row, "Name", 256);
      const descriptionEn = plainText(sqlNullableString(row, "Description") ?? "");
      const passiveAbility = sqlString(row, "Ability", 256);
      const passiveTier = sqlNumber(row, "Tier", -20, 20);
      if (!Number.isInteger(passiveTier)) fail("passive tier는 정수여야 합니다.");
      const signature = JSON.stringify([devName, nameEn, passiveAbility, passiveTier, descriptionEn]);
      const id = skillId("passive", devName, signature);
      skillsBySignature.set(id, { id, type: "passive", nameEn, ...(descriptionEn ? { descriptionEn } : {}), passiveTier, passiveAbility });
    }
    for (const [itemId, palIds] of dropPalIdsByItem) itemById.get(itemId)!.dropPalIds = [...palIds].sort(codePointCompare);

    const elementSources = [
      ["neutral", "Neutral", "00"],
      ["fire", "Fire", "01"],
      ["water", "Water", "02"],
      ["electric", "Electric", "03"],
      ["grass", "Grass", "04"],
      ["dark", "Dark", "05"],
      ["dragon", "Dragon", "06"],
      ["ground", "Ground", "07"],
      ["ice", "Ice", "08"]
    ] as const;
    const sourceElementImages = verifiedElementImagePaths(tables.pals);
    if (sourceElementImages.size !== elementSources.length) {
      fail("pyPal Pal type 데이터의 element 이름·이미지 관계가 고정 9종과 일치하지 않습니다.");
    }
    for (const [, sourceName, suffix] of elementSources) {
      const expectedSourcePath = `/public/images/elements/T_Icon_element_s_${suffix}.png`;
      if (sourceElementImages.get(sourceName) !== expectedSourcePath) {
        fail(`pyPal source element mapping이 명시적 mapping과 일치하지 않습니다: ${sourceName}`);
      }
    }
    const elementRoot = path.join(input.publicRoot ?? PALWORLD_CATALOG_PUBLIC_ROOT, "elements");
    const elementAssets = await mapLimit(elementSources, 4, async ([id, , suffix]) => {
      const member = `${PYPAL_IMAGE_PREFIX}/public/images/elements/T_Icon_element_s_${suffix}.png`;
      const source = await pyPalArchive.readEntry(member, 64 * 1024);
      const converted = await convertIcon(source, member);
      await writeContentHashAsset(elementRoot, converted);
      return { id, converted };
    });
    const elements = elementAssets.map(({ id, converted }) => ({
      id,
      sourceName: elementSources.find(([candidate]) => candidate === id)![1],
      imageUrl: `/images/palworld/${PALWORLD_CATALOG_RELEASE}/elements/${converted.outputFileName}`,
      imageWidth: converted.outputWidth,
      imageHeight: converted.outputHeight
    })).sort((left, right) => codePointCompare(left.id, right.id));

    const items = [...itemById.values()].sort((left, right) => codePointCompare(left.id, right.id));
    const skills = [...skillsBySignature.values()].sort((left, right) => codePointCompare(left.id, right.id));
    palDetails.sort((left, right) => codePointCompare(left.palId, right.palId));
    assignments.sort((left, right) => codePointCompare(`${left.palId}\0${left.kind}\0${left.skillId}`, `${right.palId}\0${right.kind}\0${right.skillId}`));
    const duplicateAssignments = new Set(assignments.map((assignment) => `${assignment.palId}\0${assignment.kind}\0${assignment.skillId}`));
    if (duplicateAssignments.size !== assignments.length) fail("Pal skill assignment가 중복됩니다.");

    const itemManifest = assertPalworldCatalogAssetManifest({
      schemaVersion: 1,
      release: PALWORLD_CATALOG_RELEASE,
      kind: "items",
      sourceArchiveSha256: PALWORLD_PYPAL_ARCHIVE_SHA256,
      usageBasis: "operator_reference_use",
      rightsVerified: false,
      entries: items.flatMap((item) => {
        const member = itemSourceMembers.get(item.sourceInternalId);
        const image = member ? convertedByMember.get(member) : undefined;
        return image ? [{
          id: item.id,
          sourceFileName: member!,
          sourceSha256: image.sourceSha256,
          outputSha256: image.outputSha256,
          outputFileName: image.outputFileName,
          outputWidth: image.outputWidth,
          outputHeight: image.outputHeight,
          outputBytes: image.outputBytes,
          imageUrl: item.imageUrl!
        }] : [];
      })
    }, "items");
    const elementManifest = assertPalworldCatalogAssetManifest({
      schemaVersion: 1,
      release: PALWORLD_CATALOG_RELEASE,
      kind: "elements",
      sourceArchiveSha256: PALWORLD_PYPAL_ARCHIVE_SHA256,
      usageBasis: "operator_reference_use",
      rightsVerified: false,
      entries: elementAssets.map(({ id, converted }) => ({
        id,
        sourceFileName: converted.member,
        sourceSha256: converted.sourceSha256,
        outputSha256: converted.outputSha256,
        outputFileName: converted.outputFileName,
        outputWidth: converted.outputWidth,
        outputHeight: converted.outputHeight,
        outputBytes: converted.outputBytes,
        imageUrl: `/images/palworld/${PALWORLD_CATALOG_RELEASE}/elements/${converted.outputFileName}`
      })).sort((left, right) => codePointCompare(left.id, right.id))
    }, "elements");

    const activeSkills = skills.filter((skill) => skill.type === "active").length;
    const partnerSkills = skills.filter((skill) => skill.type === "partner").length;
    const passiveSkills = skills.filter((skill) => skill.type === "passive").length;
    const itemImages = items.filter((item) => item.imageUrl).length;
    const catalog = assertPalworldCatalogArtifact({
      schemaVersion: 1,
      release: PALWORLD_CATALOG_RELEASE,
      metadata: {
        gameVersion: PALWORLD_PYPAL_GAME_DATA_VERSION,
        sourceName: "Awy64/palworld-atlas-data + pyPalworldAPI 0.2.0",
        sourceUrl: "https://github.com/Awy64/palworld-atlas-data",
        sourceRevision: `${PALWORLD_ATLAS_STEAM_BUILD_ID}+${PALWORLD_PYPAL_REVISION}`,
        extractedAt: "2026-07-18T21:38:00.000Z",
        verifiedAt: PALWORLD_CATALOG_VERIFIED_AT,
        license: "MIT_CODE_ONLY_GAME_ASSET_RIGHTS_NOT_VERIFIED"
      },
      provenance: {
        atlasArchiveSha256: PALWORLD_ATLAS_ARCHIVE_SHA256,
        atlasSteamBuildId: PALWORLD_ATLAS_STEAM_BUILD_ID,
        pyPalArchiveSha256: PALWORLD_PYPAL_ARCHIVE_SHA256,
        pyPalRevision: PALWORLD_PYPAL_REVISION,
        pyPalGameDataVersion: PALWORLD_PYPAL_GAME_DATA_VERSION,
        usageBasis: "operator_reference_use",
        rightsVerified: false
      },
      coverage: {
        canonicalPals: canonicalPals.length,
        exactPalDetails: palDetails.length,
        palDetailsWithoutSource: canonicalPals.length - palDetails.length,
        atlasItems: atlasItems.length,
        runtimeItems: items.length,
        excludedPlaceholderItems: placeholderItems.size,
        excludedIllegalItems: illegalItems.size,
        itemImages,
        itemImageFallbacks: items.length - itemImages,
        uniqueItemImages: new Set([...convertedByMember.values()].map((image) => image.outputSha256)).size,
        activeSkills,
        partnerSkills,
        passiveSkills,
        skillAssignments: assignments.length,
        unresolvedDropReferences,
        unresolvedCraftingReferences,
        unresolvedTechnologyReferences,
        activeSkillConflicts,
        atlasBreedingPairs: atlasBreeding.length,
        specialBreedingPairs: specialBreedingPairs.length,
        unresolvedBreedingReferences,
        genderedBreedingPairs: specialBreedingPairs.filter((pair) => pair.parentAGender || pair.parentBGender).length,
        localizedKo: 0,
        localizedJa: 0
      },
      palDetails,
      items,
      skills,
      skillAssignments: assignments,
      specialBreedingPairs,
      elements
    });

    const catalogSkillsById = new Map(catalog.skills.map((skill) => [skill.id, skill]));
    const catalogDetailsByPalId = new Map(catalog.palDetails.map((detail) => [detail.palId, detail]));
    const catalogAssignmentsByPalId = new Map<string, PalworldCatalogSkillAssignment[]>();
    for (const assignment of catalog.skillAssignments) {
      const entries = catalogAssignmentsByPalId.get(assignment.palId) ?? [];
      entries.push(assignment);
      catalogAssignmentsByPalId.set(assignment.palId, entries);
    }
    const specialParentPairsByChildId = new Map<string, PalworldCatalogSpecialBreedingPair[]>();
    for (const pair of catalog.specialBreedingPairs) {
      const entries = specialParentPairsByChildId.get(pair.childId) ?? [];
      entries.push(pair);
      specialParentPairsByChildId.set(pair.childId, entries);
    }
    const enrichedPaldexRecords = paldex.records.map((raw, index) => {
      const id = publicId(requireString(raw.id, `paldex.records[${index}].id`, 128));
      const detail = catalogDetailsByPalId.get(id);
      const palAssignments = catalogAssignmentsByPalId.get(id) ?? [];
      const activeSkills = palAssignments
        .filter((assignment) => assignment.kind === "active")
        .map((assignment) => {
          const skill = catalogSkillsById.get(assignment.skillId);
          if (!skill) fail(`paldex.records[${index}] active skill 참조가 없습니다: ${assignment.skillId}`);
          return embeddedPaldexSkill(skill, assignment.unlockLevel);
        });
      const partnerAssignment = palAssignments.filter((assignment) => assignment.kind === "partner");
      if (partnerAssignment.length > 1) fail(`paldex.records[${index}] partner skill 배정이 중복됩니다.`);
      const partnerSkill = partnerAssignment[0] === undefined
        ? undefined
        : catalogSkillsById.get(partnerAssignment[0].skillId);
      if (partnerAssignment[0] !== undefined && !partnerSkill) {
        fail(`paldex.records[${index}] partner skill 참조가 없습니다: ${partnerAssignment[0].skillId}`);
      }
      if (detail?.partnerSkillId !== partnerAssignment[0]?.skillId) {
        fail(`paldex.records[${index}] partner skill 상세와 assignment가 일치하지 않습니다.`);
      }
      if (typeof raw.nocturnal !== "boolean") fail(`paldex.records[${index}].nocturnal이 boolean이 아닙니다.`);
      const imageUrl = raw.imageUrl === undefined ? undefined : requireString(raw.imageUrl, `paldex.records[${index}].imageUrl`, 256);
      return {
        id,
        sourceInternalId: requireString(raw.sourceInternalId, `paldex.records[${index}].sourceInternalId`, 128),
        number: requireNumber(raw.number, `paldex.records[${index}].number`, 1, 10_000),
        nameKo: requireString(raw.nameKo, `paldex.records[${index}].nameKo`, 160),
        nameJa: requireString(raw.nameJa, `paldex.records[${index}].nameJa`, 160),
        nameEn: requireString(raw.nameEn, `paldex.records[${index}].nameEn`, 160),
        variantType: raw.variantType,
        elements: raw.elements,
        rarity: requireNumber(raw.rarity, `paldex.records[${index}].rarity`, 1, 20),
        stats: raw.stats,
        workSuitabilities: raw.workSuitabilities,
        breedingPower: requireNumber(raw.breedingPower, `paldex.records[${index}].breedingPower`, 0, 1_000_000),
        nocturnal: raw.nocturnal,
        ...(detail?.descriptionEn === undefined ? {} : { descriptionEn: detail.descriptionEn }),
        ...(partnerSkill === undefined ? {} : { partnerSkill: embeddedPaldexSkill(partnerSkill) }),
        activeSkills,
        drops: detail?.drops.map((drop) => ({ ...drop })) ?? [],
        specialParentPairs: (specialParentPairsByChildId.get(id) ?? []).map((pair) => ({
          parentAId: pair.parentAId,
          parentBId: pair.parentBId,
          ...(pair.parentAGender === undefined ? {} : { parentAGender: pair.parentAGender }),
          ...(pair.parentBGender === undefined ? {} : { parentBGender: pair.parentBGender })
        })),
        ...(imageUrl === undefined ? {} : { imageUrl })
      };
    });
    const enrichedPaldex = assertPalworldPaldexArtifact({
      schemaVersion: 2,
      release: PALWORLD_CATALOG_RELEASE,
      steamBuildId: PALWORLD_ATLAS_STEAM_BUILD_ID,
      metadata: paldex.metadata,
      detailProvenance: {
        sourceName: "pyPalworldAPI 0.2.0",
        sourceRevision: PALWORLD_PYPAL_REVISION,
        sourceChecksum: PALWORLD_PYPAL_ARCHIVE_SHA256,
        gameVersion: PALWORLD_PYPAL_GAME_DATA_VERSION,
        license: "MIT_CODE_ONLY_GAME_ASSET_RIGHTS_NOT_VERIFIED",
        rightsVerified: false,
        breedingSourceName: "Awy64/palworld-atlas-data breeding.json",
        breedingSourceRevision: PALWORLD_ATLAS_STEAM_BUILD_ID,
        breedingSourceChecksum: PALWORLD_ATLAS_ARCHIVE_SHA256,
        exactPalDetails: catalog.coverage.exactPalDetails,
        palDetailsWithoutSource: catalog.coverage.palDetailsWithoutSource,
        specialBreedingPairs: catalog.coverage.specialBreedingPairs,
        unresolvedBreedingReferences: catalog.coverage.unresolvedBreedingReferences,
        genderedBreedingPairs: catalog.coverage.genderedBreedingPairs
      },
      records: enrichedPaldexRecords
    });

    const releaseRoot = input.releaseRoot ?? PALWORLD_CATALOG_RELEASE_ROOT;
    await mkdir(releaseRoot, { recursive: true, mode: 0o755 });
    const paldexText = deterministicCatalogJson(enrichedPaldex);
    const updatedPaldexManifest = assertPalworldPaldexReleaseManifest({
      ...JSON.parse(paldexManifestBytes.toString("utf8")) as Record<string, unknown>,
      paldexSha256: sha256CatalogText(paldexText)
    });
    const paldexManifestText = deterministicCatalogJson(updatedPaldexManifest);
    const catalogText = deterministicCatalogJson(catalog);
    const itemText = deterministicCatalogJson(itemManifest);
    const elementText = deterministicCatalogJson(elementManifest);
    const manifestText = deterministicCatalogJson({
      schemaVersion: 1,
      release: PALWORLD_CATALOG_RELEASE,
      generatedAt: PALWORLD_CATALOG_VERIFIED_AT,
      catalogSha256: sha256CatalogText(catalogText),
      itemImagesManifestSha256: sha256CatalogText(itemText),
      elementImagesManifestSha256: sha256CatalogText(elementText),
      counts: catalog.coverage,
      runtimeActivation: true
    });
    await Promise.all([
      writeAtomicText(path.join(releaseRoot, "catalog.json"), catalogText),
      writeAtomicText(path.join(releaseRoot, "item-images-manifest.json"), itemText),
      writeAtomicText(path.join(releaseRoot, "element-images-manifest.json"), elementText),
      writeAtomicText(path.join(releaseRoot, "catalog-manifest.json"), manifestText),
      writeAtomicText(path.join(releaseRoot, "paldex.json"), paldexText),
      writeAtomicText(path.join(releaseRoot, PALDEX_MANIFEST_FILE), paldexManifestText)
    ]);
    return { catalog, itemManifest, elementManifest };
  } finally {
    await Promise.all([atlasArchive.close(), pyPalArchive.close()]);
  }
}

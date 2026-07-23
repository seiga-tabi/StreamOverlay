import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import type { PalworldCatalogArtifact } from "./palworld-catalog-artifact.js";
import { PALWORLD_CATALOG_RELEASE } from "./palworld-catalog-artifact.js";
import { PALWORLD_SNAPSHOT } from "./palworld-snapshot.js";

const MAX_ALIAS_BYTES = 64 * 1024;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,127}$/u;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,159}$/u;

export const PALWORLD_REVIEWED_ITEM_ALIASES_FILE = "locales/reviewed-item-aliases.json";

export type PalworldReviewedItemAlias = Readonly<{
  release: string;
  oldId: string;
  canonicalId: string;
  sourceInternalId: string;
  nameEn: string;
  reason: string;
}>;

function recordAt(value: unknown, pathName: string, allowedKeys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${pathName}는 객체여야 합니다.`);
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new TypeError(`${pathName}.${key}는 허용되지 않은 필드입니다.`);
  }
  return record;
}

function stringAt(value: unknown, pathName: string, maximum: number): string {
  if (
    typeof value !== "string"
    || value.trim() !== value
    || value.length === 0
    || value.length > maximum
    || value.includes("\0")
  ) {
    throw new TypeError(`${pathName}는 앞뒤 공백 없는 1~${maximum}자 문자열이어야 합니다.`);
  }
  return value;
}

export function validatePalworldReviewedItemAliases(
  value: unknown,
  catalog: PalworldCatalogArtifact
): PalworldReviewedItemAlias[] {
  const root = recordAt(value, "reviewedItemAliases", ["schemaVersion", "release", "aliases"]);
  if (root.schemaVersion !== 1 || root.release !== PALWORLD_CATALOG_RELEASE || !Array.isArray(root.aliases)) {
    throw new TypeError("reviewedItemAliases header가 현재 release와 일치하지 않습니다.");
  }
  if (root.aliases.length > 100) throw new TypeError("reviewedItemAliases.aliases 크기 제한을 초과했습니다.");

  const legacyItems = new Map(PALWORLD_SNAPSHOT.items.map((item) => [item.id, item]));
  const canonicalItems = new Map(catalog.items.map((item) => [item.id, item]));
  const oldIds = new Set<string>();
  const canonicalIds = new Set<string>();
  let previousCanonicalId = "";
  return root.aliases.map((valueEntry, index) => {
    const entryPath = `reviewedItemAliases.aliases[${index}]`;
    const entry = recordAt(valueEntry, entryPath, [
      "release",
      "oldId",
      "canonicalId",
      "sourceInternalId",
      "nameEn",
      "reason"
    ]);
    const release = stringAt(entry.release, `${entryPath}.release`, 64);
    const oldId = stringAt(entry.oldId, `${entryPath}.oldId`, 128);
    const canonicalId = stringAt(entry.canonicalId, `${entryPath}.canonicalId`, 128);
    const sourceInternalId = stringAt(entry.sourceInternalId, `${entryPath}.sourceInternalId`, 160);
    const nameEn = stringAt(entry.nameEn, `${entryPath}.nameEn`, 256);
    const reason = stringAt(entry.reason, `${entryPath}.reason`, 500);
    if (!ID_PATTERN.test(oldId) || !ID_PATTERN.test(canonicalId) || !SOURCE_ID_PATTERN.test(sourceInternalId)) {
      throw new TypeError(`${entryPath} ID 형식이 올바르지 않습니다.`);
    }
    if (release !== PALWORLD_CATALOG_RELEASE) {
      throw new TypeError(`${entryPath}.release가 현재 catalog release와 일치하지 않습니다.`);
    }
    if (canonicalId.localeCompare(previousCanonicalId, "en") <= 0) {
      throw new TypeError("reviewedItemAliases.aliases는 canonicalId 오름차순이어야 합니다.");
    }
    if (oldIds.has(oldId) || canonicalIds.has(canonicalId)) {
      throw new TypeError(`${entryPath}에 중복 oldId 또는 canonicalId가 있습니다.`);
    }
    oldIds.add(oldId);
    canonicalIds.add(canonicalId);
    previousCanonicalId = canonicalId;

    const legacy = legacyItems.get(oldId);
    const canonical = canonicalItems.get(canonicalId);
    if (
      legacy === undefined
      || legacy.nameKo === undefined
      || legacy.nameJa === undefined
      || legacy.nameEn !== nameEn
    ) {
      throw new TypeError(`${entryPath}.oldId가 기존 검수 아이템과 정확히 일치하지 않습니다.`);
    }
    if (
      canonical === undefined
      || canonical.sourceInternalId !== sourceInternalId
      || canonical.nameEn !== nameEn
    ) {
      throw new TypeError(`${entryPath}.canonicalId가 catalog sourceInternalId·영문 이름과 정확히 일치하지 않습니다.`);
    }
    return Object.freeze({ release, oldId, canonicalId, sourceInternalId, nameEn, reason });
  });
}

export async function loadPalworldReviewedItemAliases(
  releaseRoot: string,
  catalog: PalworldCatalogArtifact
): Promise<PalworldReviewedItemAlias[]> {
  const filePath = path.resolve(releaseRoot, PALWORLD_REVIEWED_ITEM_ALIASES_FILE);
  const expectedRoot = path.resolve(releaseRoot);
  if (!filePath.startsWith(`${expectedRoot}${path.sep}`)) {
    throw new TypeError("reviewed item alias 경로가 release root 밖에 있습니다.");
  }
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > MAX_ALIAS_BYTES) {
    throw new TypeError("reviewed item alias는 허용 크기의 regular file이어야 합니다.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    throw new TypeError("reviewed item alias JSON을 읽을 수 없습니다.");
  }
  return validatePalworldReviewedItemAliases(parsed, catalog);
}

export function localizedReviewedItemsByCanonicalId(
  aliases: readonly PalworldReviewedItemAlias[]
): ReadonlyMap<string, PalworldDataSnapshotItem> {
  const legacyItems = new Map(PALWORLD_SNAPSHOT.items.map((item) => [item.id, item]));
  return new Map(aliases.map((alias) => {
    const item = legacyItems.get(alias.oldId);
    if (item === undefined || item.nameEn !== alias.nameEn) {
      throw new TypeError(`검수 아이템 alias가 기존 locale과 일치하지 않습니다: ${alias.canonicalId}`);
    }
    return [alias.canonicalId, item];
  }));
}

type PalworldDataSnapshotItem = (typeof PALWORLD_SNAPSHOT.items)[number];

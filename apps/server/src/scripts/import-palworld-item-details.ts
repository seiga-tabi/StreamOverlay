import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PALWORLD_TECHNOLOGY_BUILDINGS } from "../data/palworld-technology-buildings.generated.js";
import { withPalworldPakArchive } from "../data/palworld-pak-preflight.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const CATALOG_FILE = path.join(
  REPOSITORY_ROOT,
  "apps/server/data/palworld/1.0.1/catalog.json",
);
const OUTPUT_FILE = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-item-details.generated.ts",
);

const MEMBERS = Object.freeze({
  recipes: "Pal/DataTable/Item/DT_ItemRecipeDataTable_Common.json",
  technology: "Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common.json",
  mapObjects: "Pal/DataTable/MapObject/DT_MapObjectMasterDataTable_Common.json",
  shops: "Pal/DataTable/ItemShop/DT_ItemShopCreateData_Common.json",
  chests: "Pal/DataTable/Item/DT_ItemLotteryDataTable.json",
  products: "Pal/DataTable/MapObject/DT_MapObjectItemProductDataTable_Common.json",
});

type JsonRecord = Record<string, unknown>;
type Arguments = {
  blueprintArchivePath: string;
  blueprintArchiveSha256: string;
  contentArchivePath: string;
  contentArchiveSha256: string;
  deltaArchivePath: string;
  deltaArchiveSha256: string;
};
type CatalogItem = {
  id: string;
  sourceInternalId: string;
  sourceCategory: string;
  rank: number;
};
type GeneratedRecipe = {
  sourceRowId: string;
  resultCount: number;
  workAmount: number;
  materials: Array<{
    sourceInternalId: string;
    quantity: number;
  }>;
};
type GeneratedItemDetail = {
  recipes?: GeneratedRecipe[];
  merchant?: true;
  chest?: true;
  gathering?: true;
};
type GeneratedFacilityRule = {
  sourceRowId: string;
  targetTypesA: string[];
  targetTypesB: string[];
  targetRankMax: number;
};

function fail(message: string): never {
  throw new TypeError(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, pathName: string): string {
  if (typeof value !== "string" || value.length < 1) {
    fail(`${pathName}: 비어 있지 않은 문자열이 필요합니다.`);
  }
  return value;
}

function integerValue(
  value: unknown,
  pathName: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    fail(`${pathName}: ${minimum}~${maximum} 정수가 필요합니다.`);
  }
  return value as number;
}

function finiteNumber(
  value: unknown,
  pathName: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    fail(`${pathName}: ${minimum}~${maximum} 숫자가 필요합니다.`);
  }
  return value;
}

function parseArguments(argv: string[]): Arguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !value || !key.startsWith("--")) {
      fail("모든 인자는 --이름 값 형식이어야 합니다.");
    }
    values.set(key, value);
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) fail(`${key} 값이 필요합니다.`);
    return value;
  };
  return {
    blueprintArchivePath: path.resolve(required("--blueprint-archive")),
    blueprintArchiveSha256: required("--blueprint-sha256"),
    contentArchivePath: path.resolve(required("--content-archive")),
    contentArchiveSha256: required("--content-sha256"),
    deltaArchivePath: path.resolve(required("--delta-archive")),
    deltaArchiveSha256: required("--delta-sha256"),
  };
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function enumSuffix(value: unknown, prefix: string, pathName: string): string {
  const source = stringValue(value, pathName);
  if (!source.startsWith(prefix) || source.length === prefix.length) {
    fail(`${pathName}: ${prefix} enum 값이 필요합니다.`);
  }
  return source.slice(prefix.length);
}

function enumArray(
  value: unknown,
  prefix: string,
  pathName: string,
  allowEmpty = false,
): string[] {
  if (!Array.isArray(value)) fail(`${pathName}: 배열이 필요합니다.`);
  const result = value.map((entry, index) =>
    enumSuffix(entry, prefix, `${pathName}[${index}]`)
  );
  if (!allowEmpty && result.length < 1) fail(`${pathName}: 값이 하나 이상 필요합니다.`);
  return [...new Set(result)].sort((left, right) => left.localeCompare(right, "en"));
}

function catalogItems(value: unknown): CatalogItem[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    fail("활성 catalog.json의 items 배열을 읽을 수 없습니다.");
  }
  return value.items.map((entry, index) => {
    if (!isRecord(entry)) fail(`catalog.items[${index}]: 객체가 필요합니다.`);
    return {
      id: stringValue(entry.id, `catalog.items[${index}].id`),
      sourceInternalId: stringValue(
        entry.sourceInternalId,
        `catalog.items[${index}].sourceInternalId`,
      ),
      sourceCategory: stringValue(
        entry.sourceCategory,
        `catalog.items[${index}].sourceCategory`,
      ),
      rank: integerValue(entry.rank, `catalog.items[${index}].rank`, 0, 1_000),
    };
  });
}

function mapObjectClassIndex(rows: Record<string, unknown>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [sourceRowId, value] of Object.entries(rows)) {
    if (!isRecord(value) || typeof value.BlueprintClassName !== "string") continue;
    const blueprintClassName = value.BlueprintClassName;
    if (!blueprintClassName.startsWith("BP_BuildObject_")) continue;
    result.set(blueprintClassName, [
      ...(result.get(blueprintClassName) ?? []),
      sourceRowId,
    ]);
  }
  return result;
}

function generatedSource(input: {
  source: Record<string, string | number>;
  items: Readonly<Record<string, GeneratedItemDetail>>;
  facilities: readonly GeneratedFacilityRule[];
}): string {
  return [
    "/**",
    " * `import-palworld-item-details.ts`가 고정된 운영자 export에서 생성합니다.",
    " * sourceInternalId exact join이 실패한 행은 포함하지 않으며 수동 편집하지 않습니다.",
    " */",
    "export type PalworldGeneratedItemRecipeSource = {",
    "  sourceRowId: string;",
    "  resultCount: number;",
    "  workAmount: number;",
    "  materials: Array<{ sourceInternalId: string; quantity: number }>;",
    "};",
    "",
    "export type PalworldGeneratedItemDetailSource = {",
    "  recipes?: PalworldGeneratedItemRecipeSource[];",
    "  merchant?: true;",
    "  chest?: true;",
    "  gathering?: true;",
    "};",
    "",
    "export type PalworldGeneratedFacilityRule = {",
    "  sourceRowId: string;",
    "  targetTypesA: string[];",
    "  targetTypesB: string[];",
    "  targetRankMax: number;",
    "};",
    "",
    `export const PALWORLD_ITEM_DETAIL_SOURCE = Object.freeze(${JSON.stringify(input.source, null, 2)});`,
    "",
    "export const PALWORLD_ITEM_DETAILS_BY_SOURCE_INTERNAL_ID = Object.freeze(",
    `${JSON.stringify(input.items, null, 2)},`,
    ") as Readonly<Record<string, PalworldGeneratedItemDetailSource>>;",
    "",
    "export const PALWORLD_CRAFTING_FACILITY_RULES = Object.freeze(",
    `${JSON.stringify(input.facilities, null, 2)},`,
    ") as readonly PalworldGeneratedFacilityRule[];",
    "",
  ].join("\n");
}

const args = parseArguments(process.argv.slice(2));

try {
  const catalogBytes = await readFile(CATALOG_FILE);
  const catalog = catalogItems(JSON.parse(catalogBytes.toString("utf8")));
  const catalogBySourceInternalId = new Map(
    catalog.map((item) => [item.sourceInternalId, item]),
  );
  if (catalogBySourceInternalId.size !== catalog.length) {
    fail("활성 catalog.json에 중복 sourceInternalId가 있습니다.");
  }

  const content = await withPalworldPakArchive(
    args.contentArchivePath,
    {
      expectedSha256: args.contentArchiveSha256,
      profile: "fixed_asset_overlay",
    },
    async (reader) => {
      const [recipeBytes, recipeRows] = await Promise.all([
        reader.readBytes(MEMBERS.recipes),
        reader.readDataTable(MEMBERS.recipes),
      ]);
      return { recipeBytes, recipeRows };
    },
  );

  const delta = await withPalworldPakArchive(
    args.deltaArchivePath,
    {
      expectedSha256: args.deltaArchiveSha256,
      profile: "fixed_asset_overlay",
    },
    async (reader) => {
      const [
        mapObjectBytes,
        technologyBytes,
        shopBytes,
        chestBytes,
        productBytes,
        mapObjectRows,
        technologyRows,
        shopRows,
        chestRows,
        productRows,
      ] = await Promise.all([
        reader.readBytes(MEMBERS.mapObjects),
        reader.readBytes(MEMBERS.technology),
        reader.readBytes(MEMBERS.shops),
        reader.readBytes(MEMBERS.chests),
        reader.readBytes(MEMBERS.products),
        reader.readDataTable(MEMBERS.mapObjects),
        reader.readDataTable(MEMBERS.technology),
        reader.readDataTable(MEMBERS.shops),
        reader.readDataTable(MEMBERS.chests),
        reader.readDataTable(MEMBERS.products),
      ]);
      return {
        mapObjectBytes,
        technologyBytes,
        shopBytes,
        chestBytes,
        productBytes,
        mapObjectRows,
        technologyRows,
        shopRows,
        chestRows,
        productRows,
      };
    },
  );

  const recipesByProduct = new Map<string, GeneratedRecipe[]>();
  let recipeRowsForCatalog = 0;
  let excludedRecipeRows = 0;
  for (const [sourceRowId, value] of Object.entries(content.recipeRows)) {
    if (!isRecord(value)) fail(`${MEMBERS.recipes}.${sourceRowId}: 객체가 필요합니다.`);
    const productSourceInternalId = stringValue(
      value.Product_Id,
      `${MEMBERS.recipes}.${sourceRowId}.Product_Id`,
    );
    if (!catalogBySourceInternalId.has(productSourceInternalId)) continue;
    recipeRowsForCatalog += 1;
    const materials: GeneratedRecipe["materials"] = [];
    let hasUnresolvedReference = false;
    for (let slot = 1; slot <= 5; slot += 1) {
      const rawMaterial = value[`Material${slot}_Id`];
      if (rawMaterial === undefined || rawMaterial === "None") continue;
      const sourceInternalId = stringValue(
        rawMaterial,
        `${MEMBERS.recipes}.${sourceRowId}.Material${slot}_Id`,
      );
      if (!catalogBySourceInternalId.has(sourceInternalId)) {
        hasUnresolvedReference = true;
        continue;
      }
      materials.push({
        sourceInternalId,
        quantity: integerValue(
          value[`Material${slot}_Count`],
          `${MEMBERS.recipes}.${sourceRowId}.Material${slot}_Count`,
          1,
          1_000_000,
        ),
      });
    }
    if (hasUnresolvedReference) {
      excludedRecipeRows += 1;
      continue;
    }
    const recipe: GeneratedRecipe = {
      sourceRowId,
      resultCount: integerValue(
        value.Product_Count,
        `${MEMBERS.recipes}.${sourceRowId}.Product_Count`,
        1,
        100_000_000,
      ),
      workAmount: finiteNumber(
        value.WorkAmount,
        `${MEMBERS.recipes}.${sourceRowId}.WorkAmount`,
        0,
        1_000_000_000_000,
      ),
      materials,
    };
    recipesByProduct.set(productSourceInternalId, [
      ...(recipesByProduct.get(productSourceInternalId) ?? []),
      recipe,
    ]);
  }

  const merchantItems = new Set<string>();
  for (const [sourceRowId, value] of Object.entries(delta.shopRows)) {
    if (!isRecord(value) || !Array.isArray(value.productDataArray)) {
      fail(`${MEMBERS.shops}.${sourceRowId}.productDataArray: 배열이 필요합니다.`);
    }
    for (const [index, product] of value.productDataArray.entries()) {
      if (!isRecord(product)) {
        fail(`${MEMBERS.shops}.${sourceRowId}.productDataArray[${index}]: 객체가 필요합니다.`);
      }
      if (
        typeof product.StaticItemId === "string"
        && catalogBySourceInternalId.has(product.StaticItemId)
      ) {
        merchantItems.add(product.StaticItemId);
      }
    }
  }

  const chestItems = new Set<string>();
  for (const [sourceRowId, value] of Object.entries(delta.chestRows)) {
    if (!isRecord(value)) fail(`${MEMBERS.chests}.${sourceRowId}: 객체가 필요합니다.`);
    if (
      typeof value.StaticItemId === "string"
      && catalogBySourceInternalId.has(value.StaticItemId)
    ) {
      chestItems.add(value.StaticItemId);
    }
  }

  const gatheringItems = new Set<string>();
  for (const [sourceRowId, value] of Object.entries(delta.productRows)) {
    if (!isRecord(value)) fail(`${MEMBERS.products}.${sourceRowId}: 객체가 필요합니다.`);
    if (
      typeof value.Product_Id === "string"
      && catalogBySourceInternalId.has(value.Product_Id)
    ) {
      gatheringItems.add(value.Product_Id);
    }
  }

  const technologyBuildingsBySourceRowId = new Map(
    PALWORLD_TECHNOLOGY_BUILDINGS.map((building) => [
      building.sourceRowId,
      building,
    ]),
  );
  const technologyBuildingSourceRowIdByMapObjectId = new Map<string, string>();
  for (const [technologySourceRowId, value] of Object.entries(delta.technologyRows)) {
    if (!technologyBuildingsBySourceRowId.has(technologySourceRowId)) continue;
    if (!isRecord(value) || !Array.isArray(value.UnlockBuildObjects)) {
      fail(`${MEMBERS.technology}.${technologySourceRowId}.UnlockBuildObjects: 배열이 필요합니다.`);
    }
    const exactUnlockBuildObjects = value.UnlockBuildObjects.filter(
      (mapObjectId): mapObjectId is string =>
        typeof mapObjectId === "string"
        && delta.mapObjectRows[mapObjectId] !== undefined,
    );
    const mapObjectCandidates = exactUnlockBuildObjects.length > 0
      ? exactUnlockBuildObjects
      : (
          typeof value.IconName === "string"
          && delta.mapObjectRows[value.IconName] !== undefined
            ? [value.IconName]
            : []
        );
    for (const [index, mapObjectId] of mapObjectCandidates.entries()) {
      const sourceRowId = stringValue(
        mapObjectId,
        `${MEMBERS.technology}.${technologySourceRowId}.mapObjectCandidates[${index}]`,
      );
      const existing = technologyBuildingSourceRowIdByMapObjectId.get(sourceRowId);
      if (existing !== undefined && existing !== technologySourceRowId) {
        fail(`${sourceRowId}: 공개 기술 건축물 연결이 중복되었습니다.`);
      }
      technologyBuildingSourceRowIdByMapObjectId.set(sourceRowId, technologySourceRowId);
    }
  }
  const mapObjectRowsByBlueprintClass = mapObjectClassIndex(delta.mapObjectRows);
  const facilities = await withPalworldPakArchive(
    args.blueprintArchivePath,
    {
      expectedSha256: args.blueprintArchiveSha256,
      profile: "fixed_asset_overlay",
    },
    async (reader) => {
      const rules: GeneratedFacilityRule[] = [];
      const seenFacilities = new Set<string>();
      for (const member of reader.members) {
        if (
          !/^MapObject\/BuildObject\/BP_BuildObject_[A-Za-z0-9_]+\.json$/u.test(member.name)
        ) {
          continue;
        }
        const value = await reader.readJson(member.name);
        if (!Array.isArray(value)) fail(`${member.name}: Blueprint export 배열이 필요합니다.`);
        const components = value.filter(
          (entry): entry is JsonRecord =>
            isRecord(entry)
            && entry.Type === "PalMapObjectItemConverterParameterComponent",
        );
        if (components.length === 0) continue;
        if (components.length !== 1) {
          fail(`${member.name}: 제작 시설 parameter component가 중복되었습니다.`);
        }
        const blueprintClassName = path.basename(member.name, ".json");
        const technologyRows = (mapObjectRowsByBlueprintClass.get(blueprintClassName) ?? [])
          .flatMap((mapObjectSourceRowId) => {
            const technologySourceRowId =
              technologyBuildingSourceRowIdByMapObjectId.get(mapObjectSourceRowId);
            return technologySourceRowId === undefined ? [] : [technologySourceRowId];
          });
        if (technologyRows.length === 0) continue;
        if (technologyRows.length !== 1) {
          fail(`${member.name}: 공개 기술 건축물 exact match가 중복되었습니다.`);
        }
        const sourceRowId = technologyRows[0]!;
        if (seenFacilities.has(sourceRowId)) {
          fail(`${sourceRowId}: 제작 시설 규칙이 중복되었습니다.`);
        }
        seenFacilities.add(sourceRowId);
        const properties = components[0]!.Properties;
        if (!isRecord(properties)) fail(`${member.name}.Properties: 객체가 필요합니다.`);
        rules.push({
          sourceRowId,
          targetTypesA: enumArray(
            properties.TargetTypesA ?? [],
            "EPalItemTypeA::",
            `${member.name}.TargetTypesA`,
            true,
          ),
          targetTypesB: enumArray(
            properties.TargetTypesB,
            "EPalItemTypeB::",
            `${member.name}.TargetTypesB`,
          ),
          targetRankMax: integerValue(
            properties.TargetRankMax,
            `${member.name}.TargetRankMax`,
            0,
            100,
          ),
        });
      }
      return rules.sort((left, right) =>
        left.targetRankMax - right.targetRankMax
        || left.sourceRowId.localeCompare(right.sourceRowId, "en")
      );
    },
  );

  const items: Record<string, GeneratedItemDetail> = {};
  for (const sourceInternalId of [...catalogBySourceInternalId.keys()].sort((left, right) =>
    left.localeCompare(right, "en")
  )) {
    const recipes = recipesByProduct.get(sourceInternalId)?.sort((left, right) =>
      left.sourceRowId.localeCompare(right.sourceRowId, "en")
    );
    const detail: GeneratedItemDetail = {
      ...(recipes === undefined ? {} : { recipes }),
      ...(merchantItems.has(sourceInternalId) ? { merchant: true } : {}),
      ...(chestItems.has(sourceInternalId) ? { chest: true } : {}),
      ...(gatheringItems.has(sourceInternalId) ? { gathering: true } : {}),
    };
    if (Object.keys(detail).length > 0) items[sourceInternalId] = detail;
  }

  const source = {
    blueprintArchiveSha256: args.blueprintArchiveSha256,
    contentArchiveSha256: args.contentArchiveSha256,
    deltaArchiveSha256: args.deltaArchiveSha256,
    catalogSha256: sha256(catalogBytes),
    recipeTableSha256: sha256(content.recipeBytes),
    mapObjectTableSha256: sha256(delta.mapObjectBytes),
    technologyTableSha256: sha256(delta.technologyBytes),
    shopTableSha256: sha256(delta.shopBytes),
    chestTableSha256: sha256(delta.chestBytes),
    productTableSha256: sha256(delta.productBytes),
    catalogItems: catalog.length,
    recipeRowsForCatalog,
    publishedRecipeRows: [...recipesByProduct.values()].reduce(
      (total, recipes) => total + recipes.length,
      0,
    ),
    excludedRecipeRows,
    recipeProducts: recipesByProduct.size,
    merchantItems: merchantItems.size,
    chestItems: chestItems.size,
    gatheringItems: gatheringItems.size,
    craftingFacilities: facilities.length,
  };
  const temporaryFile = `${OUTPUT_FILE}.tmp-${process.pid}`;
  await writeFile(temporaryFile, generatedSource({ source, items, facilities }), "utf8");
  await rename(temporaryFile, OUTPUT_FILE);
  console.info(JSON.stringify(source, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

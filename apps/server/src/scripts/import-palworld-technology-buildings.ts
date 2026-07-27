import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PalworldTechnologyUnlockSummary } from "@streamops/shared";
import { importPalworldPakPngAsset } from "../data/palworld-pak-assets.js";
import { withPalworldPakArchive } from "../data/palworld-pak-preflight.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const RELEASE = "1.0.1";
const OUTPUT_FILE = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-technology-buildings.generated.ts",
);
const ASSET_ROOT = path.join(
  REPOSITORY_ROOT,
  `apps/dashboard/public/images/palworld/${RELEASE}/technology`,
);

const MEMBERS = Object.freeze({
  technology: "Pal/DataTable/Technology/DT_TechnologyRecipeUnlock_Common.json",
  buildingIcons: "Pal/DataTable/MapObject/Building/DT_BuildObjectIconDataTable.json",
  technologyNameJa: "Pal/DataTable/Text/DT_TechnologyNameText_Common.json",
  technologyNameKo: "L10N/ko/Pal/DataTable/Text/DT_TechnologyNameText_Common.json",
  mapObjectNameJa: "Pal/DataTable/Text/DT_MapObjectNameText_Common.json",
  mapObjectNameKo: "L10N/ko/Pal/DataTable/Text/DT_MapObjectNameText_Common.json",
});

type JsonRecord = Record<string, unknown>;
type TechnologyRow = {
  UnlockBuildObjects: string[];
  Name: string;
  IconName: string;
  LevelCap: number;
  Tier: number;
  Cost: number;
};
type Arguments = {
  contentArchivePath: string;
  contentArchiveSha256: string;
  deltaArchivePath: string;
  deltaArchiveSha256: string;
};
type BuildingEntry = Extract<
  PalworldTechnologyUnlockSummary,
  { kind: "building" }
>;

function fail(message: string): never {
  throw new TypeError(message);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
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
    contentArchivePath: path.resolve(required("--content-archive")),
    contentArchiveSha256: required("--content-sha256"),
    deltaArchivePath: path.resolve(required("--delta-archive")),
    deltaArchiveSha256: required("--delta-sha256"),
  };
}

function technologyRow(value: unknown, rowId: string): TechnologyRow {
  if (!isRecord(value)) fail(`${rowId}: 기술 행이 객체가 아닙니다.`);
  const unlockBuildObjects = value.UnlockBuildObjects;
  if (
    !Array.isArray(unlockBuildObjects)
    || unlockBuildObjects.some((item) => typeof item !== "string")
  ) {
    fail(`${rowId}: UnlockBuildObjects가 문자열 배열이 아닙니다.`);
  }
  for (const field of ["Name", "IconName"] as const) {
    if (typeof value[field] !== "string" || value[field].length < 1) {
      fail(`${rowId}.${field}: 문자열이 필요합니다.`);
    }
  }
  for (const field of ["LevelCap", "Tier", "Cost"] as const) {
    if (!Number.isSafeInteger(value[field]) || (value[field] as number) < 0) {
      fail(`${rowId}.${field}: 0 이상의 정수가 필요합니다.`);
    }
  }
  return {
    UnlockBuildObjects: unlockBuildObjects as string[],
    Name: value.Name as string,
    IconName: value.IconName as string,
    LevelCap: value.LevelCap as number,
    Tier: value.Tier as number,
    Cost: value.Cost as number,
  };
}

function localizedText(rows: Record<string, unknown>, key: string): string | undefined {
  const row = rows[key];
  if (!isRecord(row) || !isRecord(row.TextData)) return undefined;
  const value = row.TextData.LocalizedString ?? row.TextData.SourceString;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveTechnologyName(
  technologyNames: Record<string, unknown>,
  mapObjectNames: Record<string, unknown>,
  row: TechnologyRow,
): string {
  const raw = localizedText(technologyNames, row.Name);
  const match = raw?.match(/^<mapObjectName id=\|([^|]+)\|\/>$/iu);
  const resolved = match?.[1]
    ? localizedText(mapObjectNames, `MAPOBJECT_NAME_${match[1]}`)
    : raw;
  const fallback = localizedText(
    mapObjectNames,
    `MAPOBJECT_NAME_${row.UnlockBuildObjects[0] ?? ""}`,
  );
  const value = resolved ?? fallback;
  if (
    !value
    || /^(?:ko|ja|en)[ _-]?Text$/iu.test(value)
    || /<[^>]+>/u.test(value)
  ) {
    fail(`${row.Name}: 공개 가능한 기술 이름을 해석하지 못했습니다.`);
  }
  return value;
}

function iconMember(iconRows: Record<string, unknown>, row: TechnologyRow): string {
  const candidates = [row.IconName, ...row.UnlockBuildObjects];
  for (const candidate of candidates) {
    const icon = iconRows[candidate];
    if (!isRecord(icon) || !isRecord(icon.SoftIcon)) continue;
    const assetPath = icon.SoftIcon.AssetPathName;
    if (typeof assetPath !== "string" || assetPath === "None") continue;
    const member = assetPath
      .replace(/^\/Game\//u, "")
      .replace(/\.[^.]+$/u, "")
      .concat(".png");
    if (!member.startsWith("Pal/Texture/BuildObject/")) {
      fail(`${row.IconName}: 건축물 아이콘 경로가 허용된 root 밖에 있습니다.`);
    }
    return member;
  }
  fail(`${row.IconName}: 건축물 아이콘 매핑을 찾지 못했습니다.`);
}

function publicId(rowId: string): string {
  const slug = rowId
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .replace(/[^A-Za-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLocaleLowerCase("en-US");
  if (!slug) fail(`${rowId}: 공개 ID를 만들 수 없습니다.`);
  return `building-${slug}`;
}

function generatedSource(
  source: Record<string, string>,
  entries: readonly BuildingEntry[],
): string {
  return [
    'import type { PalworldTechnologyUnlockSummary } from "@streamops/shared";',
    "",
    "/**",
    " * `import-palworld-technology-buildings.ts`가 고정된 운영자 export에서 생성합니다.",
    " * 수동 편집하지 않습니다.",
    " */",
    `export const PALWORLD_TECHNOLOGY_BUILDING_SOURCE = Object.freeze(${JSON.stringify(source, null, 2)});`,
    "",
    "export const PALWORLD_TECHNOLOGY_BUILDINGS = Object.freeze(",
    `${JSON.stringify(entries, null, 2)},`,
    ") as readonly Extract<",
    "  PalworldTechnologyUnlockSummary,",
    '  { kind: "building" }',
    ">[];",
    "",
  ].join("\n");
}

const args = parseArguments(process.argv.slice(2));

try {
  const delta = await withPalworldPakArchive(
    args.deltaArchivePath,
    {
      expectedSha256: args.deltaArchiveSha256,
      profile: "fixed_asset_overlay",
    },
    async (reader) => {
      const [technologyBytes, iconBytes, technologyRows, iconRows] = await Promise.all([
        reader.readBytes(MEMBERS.technology),
        reader.readBytes(MEMBERS.buildingIcons),
        reader.readDataTable(MEMBERS.technology),
        reader.readDataTable(MEMBERS.buildingIcons),
      ]);
      return {
        technologyBytes,
        iconBytes,
        technologyRows,
        iconRows,
      };
    },
  );

  const generated = await withPalworldPakArchive(
    args.contentArchivePath,
    { expectedSha256: args.contentArchiveSha256 },
    async (reader) => {
      const [
        technologyNameJaBytes,
        technologyNameKoBytes,
        mapObjectNameJaBytes,
        mapObjectNameKoBytes,
        technologyNameJa,
        technologyNameKo,
        mapObjectNameJa,
        mapObjectNameKo,
      ] = await Promise.all([
        reader.readBytes(MEMBERS.technologyNameJa),
        reader.readBytes(MEMBERS.technologyNameKo),
        reader.readBytes(MEMBERS.mapObjectNameJa),
        reader.readBytes(MEMBERS.mapObjectNameKo),
        reader.readDataTable(MEMBERS.technologyNameJa),
        reader.readDataTable(MEMBERS.technologyNameKo),
        reader.readDataTable(MEMBERS.mapObjectNameJa),
        reader.readDataTable(MEMBERS.mapObjectNameKo),
      ]);
      const imageCache = new Map<string, Awaited<ReturnType<typeof importPalworldPakPngAsset>>>();
      const entries: BuildingEntry[] = [];
      const ids = new Set<string>();
      const rows = Object.entries(delta.technologyRows)
        .map(([rowId, value]) => [rowId, technologyRow(value, rowId)] as const)
        .filter(([, row]) => row.UnlockBuildObjects.length > 0)
        .sort((left, right) =>
          left[1].LevelCap - right[1].LevelCap
          || left[0].localeCompare(right[0], "en")
        );
      for (const [rowId, row] of rows) {
        const id = publicId(rowId);
        if (ids.has(id)) fail(`${rowId}: 공개 ID가 중복됩니다.`);
        ids.add(id);
        const member = iconMember(delta.iconRows, row);
        if (!reader.has(member)) fail(`${rowId}: ${member} PNG가 Content archive에 없습니다.`);
        let image = imageCache.get(member);
        if (!image) {
          image = await importPalworldPakPngAsset({
            reader,
            memberName: member,
            id: row.IconName,
            kind: "item",
            outputRoot: ASSET_ROOT,
            maximumOutputDimension: 512,
          });
          imageCache.set(member, image);
        }
        entries.push({
          id,
          kind: "building",
          sourceRowId: rowId,
          nameKo: resolveTechnologyName(technologyNameKo, mapObjectNameKo, row),
          nameJa: resolveTechnologyName(technologyNameJa, mapObjectNameJa, row),
          imageUrl: `/images/palworld/${RELEASE}/technology/${image.outputFile}`,
          imageWidth: image.outputWidth,
          imageHeight: image.outputHeight,
          technologyLevel: row.LevelCap,
          tier: row.Tier,
          cost: row.Cost,
        });
      }
      return {
        entries,
        uniqueImages: imageCache.size,
        source: {
          contentArchiveSha256: args.contentArchiveSha256,
          deltaArchiveSha256: args.deltaArchiveSha256,
          technologyTableSha256: sha256(delta.technologyBytes),
          buildingIconTableSha256: sha256(delta.iconBytes),
          technologyNameJaSha256: sha256(technologyNameJaBytes),
          technologyNameKoSha256: sha256(technologyNameKoBytes),
          mapObjectNameJaSha256: sha256(mapObjectNameJaBytes),
          mapObjectNameKoSha256: sha256(mapObjectNameKoBytes),
        },
      };
    },
  );

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  const temporary = `${OUTPUT_FILE}.tmp-${process.pid}`;
  await writeFile(temporary, generatedSource(generated.source, generated.entries), {
    encoding: "utf8",
    flag: "wx",
    mode: 0o644,
  });
  await rename(temporary, OUTPUT_FILE);
  process.stdout.write(`${JSON.stringify({
    buildings: generated.entries.length,
    uniqueImages: generated.uniqueImages,
    outputFile: path.relative(REPOSITORY_ROOT, OUTPUT_FILE),
    assetRoot: path.relative(REPOSITORY_ROOT, ASSET_ROOT),
    source: generated.source,
  }, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  process.stderr.write(`Palworld 건축물 기술 반입 실패: ${message}\n`);
  process.exitCode = 1;
}

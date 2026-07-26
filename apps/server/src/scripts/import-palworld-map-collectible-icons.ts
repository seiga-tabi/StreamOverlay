import path from "node:path";
import { fileURLToPath } from "node:url";
import { importPalworldMapCollectibleIcons } from "../data/palworld-map-collectible-icon-import.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const RELEASE = "1.0.1";
const MAPPING_PATH = path.join(
  REPOSITORY_ROOT,
  "apps/server/src/data/palworld-map-mappings/collectible-icon-map.json"
);
const RELEASE_ROOT = path.join(
  REPOSITORY_ROOT,
  `apps/server/data/palworld/${RELEASE}`
);
const ASSET_ROOT = path.join(
  REPOSITORY_ROOT,
  `apps/dashboard/public/images/palworld/${RELEASE}/map-icons`
);

type Arguments = {
  blueprintArchivePath: string;
  inventoryArchivePath: string;
  publish: boolean;
};

function parseArguments(argv: string[]): Arguments {
  let blueprintArchivePath: string | undefined;
  let inventoryArchivePath: string | undefined;
  let publish = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--publish") {
      publish = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value) throw new TypeError(`${argument}: 값이 필요합니다.`);
    if (argument === "--blueprint-archive") {
      blueprintArchivePath = path.resolve(value);
    } else if (argument === "--inventory-archive") {
      inventoryArchivePath = path.resolve(value);
    } else {
      throw new TypeError(`${argument}: 허용되지 않은 인자입니다.`);
    }
    index += 1;
  }
  if (!blueprintArchivePath || !inventoryArchivePath) {
    throw new TypeError(
      "사용법: import:palworld-map-collectible-icons -- "
      + "--blueprint-archive <Blueprint.zip> "
      + "--inventory-archive <InventoryItemIcon.zip> [--publish]"
    );
  }
  return { blueprintArchivePath, inventoryArchivePath, publish };
}

try {
  const args = parseArguments(process.argv.slice(2));
  const result = await importPalworldMapCollectibleIcons({
    release: RELEASE,
    blueprintArchivePath: args.blueprintArchivePath,
    inventoryArchivePath: args.inventoryArchivePath,
    mappingPath: MAPPING_PATH,
    releaseRoot: RELEASE_ROOT,
    assetRoot: ASSET_ROOT,
    publish: args.publish
  });
  process.stdout.write(`${JSON.stringify({
    release: RELEASE,
    published: result.published,
    manifestSha256: result.manifestSha256,
    mappingSha256: result.mappingSha256,
    manifestEntries: result.manifest.entries.length,
    uniqueImportedImages: result.uniqueImportedImages,
    statueImages: result.statueImages,
    regionalEggTypes: result.regionalEggTypes,
    sharedRegionalEggImages: result.sharedRegionalEggImages,
    rightsVerified: result.manifest.rightsVerified
  }, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류";
  process.stderr.write(`Palworld 지도 collectible 아이콘 반입 실패: ${message}\n`);
  process.exitCode = 1;
}

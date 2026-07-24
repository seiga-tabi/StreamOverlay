import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  PALWORLD_DATA_ROOT,
  assertPalworldActiveRuntimeManifest,
  loadPalworldActiveRuntime
} from "../data/palworld-active-runtime.js";
import {
  createPalworldLegacyCompositeRuntimeManifest
} from "../data/palworld-legacy-composite-runtime.js";
import {
  activatePalworldRuntimeManifest
} from "../data/palworld-pak-promotion.js";

type Options = {
  dataRoot: string;
  workImages: "candidate" | "unavailable";
  skillImages: "candidate" | "unavailable";
};

function parseArgs(args: string[]): Options {
  let dataRoot = PALWORLD_DATA_ROOT;
  let workImages: Options["workImages"] = "unavailable";
  let skillImages: Options["skillImages"] = "unavailable";
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--data-root" && value !== undefined) {
      dataRoot = path.resolve(value);
      index += 1;
      continue;
    }
    if (
      argument === "--work-images"
      && (value === "candidate" || value === "unavailable")
    ) {
      workImages = value;
      index += 1;
      continue;
    }
    if (
      argument === "--skill-images"
      && (value === "candidate" || value === "unavailable")
    ) {
      skillImages = value;
      index += 1;
      continue;
    }
    throw new Error(
      "사용법: pin-palworld-legacy-runtime "
      + "[--data-root <path>] "
      + "[--work-images candidate|unavailable] "
      + "[--skill-images candidate|unavailable]"
    );
  }
  return { dataRoot, workImages, skillImages };
}

export async function pinPalworldLegacyRuntime(
  options: Options
): Promise<void> {
  const active = await loadPalworldActiveRuntime({
    dataRoot: options.dataRoot
  });
  if (active.manifest.format === "operator_pak_v1") {
    throw new Error(
      "operator PAK runtime은 자체 runtime-manifest를 사용하므로 legacy composite로 변환할 수 없습니다."
    );
  }
  const composite = await createPalworldLegacyCompositeRuntimeManifest({
    releaseRoot: active.releaseRoot,
    release: active.manifest.release,
    workImages: options.workImages,
    skillImages: options.skillImages
  });
  const releaseManifestBytes = await readFile(active.releaseManifestPath);
  const next = assertPalworldActiveRuntimeManifest({
    schemaVersion: 2,
    format: "legacy_composite_v2",
    release: active.manifest.release,
    releaseDirectory: active.manifest.releaseDirectory,
    manifestFile: "manifest.json",
    manifestSha256: createHash("sha256")
      .update(releaseManifestBytes)
      .digest("hex"),
    composite
  });
  const activated = await activatePalworldRuntimeManifest({
    dataRoot: options.dataRoot,
    manifest: next
  });
  console.log(
    `[palworld-data] legacy composite runtime 고정 완료: `
    + `release ${activated.release}, artifact ${composite.artifacts.length}개, `
    + `marker ${composite.availability.mapMarkers}, `
    + `spawn ${composite.availability.mapSpawns}, `
    + `work image ${composite.availability.workImages}`
  );
}

const isDirectExecution = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  try {
    await pinPalworldLegacyRuntime(parseArgs(process.argv.slice(2)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    console.error(`[palworld-data] legacy composite runtime 고정 실패: ${message}`);
    process.exitCode = 1;
  }
}

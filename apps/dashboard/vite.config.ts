import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

type WorkStaticAsset = {
  id: string;
  imageUrl: string;
  outputBytes: number;
  outputFileName: string;
  outputSha256: string;
  outputWidth: number;
  outputHeight: number;
};

type MapLayerStaticAsset = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const WORK_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const MAP_LAYER_DIRECT_ICON_IDS = [
  "boss",
  "dungeon",
  "egg-desert",
  "egg-glacier",
  "egg-grass",
  "egg-sakurajima",
  "egg-sky-island",
  "egg-tenraku",
  "egg-volcanic",
  "egg-world-tree",
  "fast-travel",
  "npc",
  "statue-cattiva",
  "statue-depresso",
  "statue-herbil",
  "statue-lamball",
  "statue-lifmunk",
  "statue-lunaris",
  "statue-munchill",
  "statue-pengullet",
  "statue-relaxaurus",
  "statue-rooby",
  "statue-tanzee",
  "statue-yakumo",
  "treasure"
] as const;
const MAP_LAYER_REPRESENTATIVE_ICON_IDS = [
  "journal",
  "resource",
  "resource-ancient-beast-bone",
  "resource-ancient-tree-bark",
  "resource-chromite",
  "resource-hexolite-quartz",
  "resource-coal",
  "resource-copper-ore",
  "resource-manganese-ore",
  "resource-pal-crystal",
  "resource-quartz",
  "resource-solarlite",
  "resource-stone",
  "resource-sulfur",
  "resource-world-tree-ore",
  "skill-fruit",
  "spawn"
] as const;
const MAP_LAYER_ICON_IDS = [
  ...MAP_LAYER_DIRECT_ICON_IDS,
  ...MAP_LAYER_REPRESENTATIVE_ICON_IDS
] as const;
const MAP_LAYER_SOURCE_IDS = [
  "blueprint-map-objects",
  "content-map-assets",
  "inventory-item-icons"
] as const;
const MAP_LAYER_SOURCE_TYPES: Readonly<Record<
  (typeof MAP_LAYER_SOURCE_IDS)[number],
  string
>> = {
  "blueprint-map-objects": "operator_blueprint_export",
  "content-map-assets": "operator_pak_export",
  "inventory-item-icons": "operator_inventory_item_icon_export"
};
const MAP_LAYER_ICON_URL_PATTERN =
  /^\/images\/palworld\/((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\/(map-icons|pals|items)\/([a-f0-9]{64})\.webp$/u;

function palworldStaticAssetPolicy(): Plugin {
  let outputDirectory = fileURLToPath(new URL("./dist", import.meta.url));
  let activeWorkAssets: WorkStaticAsset[] = [];
  let activeWorkRelease = "";
  let activeMapLayerAssets: MapLayerStaticAsset[] = [];
  let assetsValidated = false;
  return {
    name: "streamops-palworld-static-asset-policy",
    apply: "build",
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      const [
        activeManifestText,
        generatedText,
        mapManifestText,
        mapLayerMappingBytes,
        workMappingBytes,
        workManifestText
      ] = await Promise.all([
        readFile(
          fileURLToPath(new URL(
            "../server/data/palworld/runtime/active-manifest.json",
            import.meta.url
          )),
          "utf8"
        ),
        readFile(
          fileURLToPath(new URL(
            "./src/features/public-palworld/data/palworld-static-assets.generated.json",
            import.meta.url
          )),
          "utf8"
        ),
        readFile(
          fileURLToPath(new URL(
            "../server/data/palworld/1.0.1/map-images-manifest.json",
            import.meta.url
          )),
          "utf8"
        ),
        readFile(
          fileURLToPath(new URL(
            "../server/src/data/palworld-map-mappings/collectible-icon-map.json",
            import.meta.url
          ))
        ),
        readFile(
          fileURLToPath(new URL(
            "../server/src/data/palworld-pak-mappings/work-icon-map.json",
            import.meta.url
          ))
        ),
        readFile(
          fileURLToPath(new URL(
            "../server/data/palworld/1.0.1/work-images-manifest.json",
            import.meta.url
          )),
          "utf8"
        )
      ]);
      const activeManifest = JSON.parse(activeManifestText) as {
        schemaVersion?: unknown;
        format?: unknown;
        release?: unknown;
        releaseDirectory?: unknown;
        composite?: {
          artifacts?: Array<{
            kind?: unknown;
            file?: unknown;
            sha256?: unknown;
          }>;
          availability?: {
            mapLayerIcons?: unknown;
            workImages?: unknown;
          };
        };
      };
      const generated = JSON.parse(generatedText) as {
        schemaVersion?: unknown;
        map?: { imageUrl?: unknown; width?: unknown; height?: unknown };
        displayMap?: { imageUrl?: unknown; width?: unknown; height?: unknown };
        maps?: Record<
          string,
          { imageUrl?: unknown; width?: unknown; height?: unknown }
        >;
        workSource?: {
          release?: unknown;
          sourceType?: unknown;
          sourceArchiveSha256?: unknown;
          mappingSha256?: unknown;
          status?: unknown;
          usageBasis?: unknown;
          rightsVerified?: unknown;
        };
        work?: Array<{
          id?: unknown;
          imageUrl?: unknown;
          width?: unknown;
          height?: unknown;
        }>;
      };
      const mapManifest = JSON.parse(mapManifestText) as {
        entries?: Array<{
          id?: unknown;
          imageUrl?: unknown;
          outputWidth?: unknown;
          outputHeight?: unknown;
        }>;
      };
      const workManifest = JSON.parse(workManifestText) as {
        schemaVersion?: unknown;
        release?: unknown;
        kind?: unknown;
        status?: unknown;
        sourceType?: unknown;
        sourceArchiveSha256?: unknown;
        mappingSha256?: unknown;
        usageBasis?: unknown;
        rightsVerified?: unknown;
        entries?: Array<Partial<WorkStaticAsset> & {
          sourceMember?: unknown;
          sourceSha256?: unknown;
        }>;
      };
      if (
        typeof activeManifest.release !== "string"
        || typeof activeManifest.releaseDirectory !== "string"
        || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(
          activeManifest.release
        )
        || activeManifest.releaseDirectory !== activeManifest.release
      ) {
        throw new Error(
          "Dashboard 지도 필터 아이콘의 active release 경로가 올바르지 않습니다."
        );
      }
      const releaseRoot = path.resolve(
        fileURLToPath(new URL("../server/data/palworld", import.meta.url)),
        activeManifest.releaseDirectory
      );
      const [
        mapLayerGeneratedText,
        mapLayerManifestText,
        palImagesManifestText,
        catalogText
      ] = await Promise.all([
        readFile(
          fileURLToPath(new URL(
            "./src/features/public-palworld/data/palworld-map-layer-icons.json",
            import.meta.url
          )),
          "utf8"
        ),
        readFile(path.join(releaseRoot, "map-layer-icons-manifest.json"), "utf8"),
        readFile(path.join(releaseRoot, "images-manifest.json"), "utf8"),
        readFile(path.join(releaseRoot, "catalog.json"), "utf8")
      ]);
      const mapLayerGenerated = JSON.parse(mapLayerGeneratedText) as {
        schemaVersion?: unknown;
        release?: unknown;
        entries?: Array<{
          id?: unknown;
          kind?: unknown;
          mappingStatus?: unknown;
          sourceReference?: unknown;
          imageUrl?: unknown;
          width?: unknown;
          height?: unknown;
        }>;
      };
      const mapLayerManifest = JSON.parse(mapLayerManifestText) as {
        schemaVersion?: unknown;
        release?: unknown;
        kind?: unknown;
        status?: unknown;
        sourceType?: unknown;
        sources?: Array<{
          id?: unknown;
          sourceType?: unknown;
          archiveSha256?: unknown;
        }>;
        mappingSha256?: unknown;
        usageBasis?: unknown;
        rightsVerified?: unknown;
        entries?: Array<{
          id?: unknown;
          mappingStatus?: unknown;
          sourceId?: unknown;
          sourceReference?: unknown;
          imageUrl?: unknown;
          outputWidth?: unknown;
          outputHeight?: unknown;
        }>;
      };
      const palImagesManifest = JSON.parse(palImagesManifestText) as {
        entries?: Array<{
          sourceInternalId?: unknown;
          imageUrl?: unknown;
          outputWidth?: unknown;
          outputHeight?: unknown;
        }>;
      };
      const catalog = JSON.parse(catalogText) as {
        items?: Array<{
          sourceInternalId?: unknown;
          imageUrl?: unknown;
          imageWidth?: unknown;
          imageHeight?: unknown;
        }>;
      };
      const mapLayerManifestSha256 = createHash("sha256")
        .update(mapLayerManifestText)
        .digest("hex");
      const mapLayerMappingSha256 = createHash("sha256")
        .update(mapLayerMappingBytes)
        .digest("hex");
      const mapLayerArtifacts = activeManifest.composite?.artifacts
        ?.filter((artifact) =>
          artifact.kind === "map-layer-icons-manifest"
          || artifact.file === "map-layer-icons-manifest.json"
        ) ?? [];
      if (
        activeManifest.composite?.availability?.mapLayerIcons !== "active"
        || mapLayerArtifacts.length !== 1
        || mapLayerArtifacts[0]?.kind !== "map-layer-icons-manifest"
        || mapLayerArtifacts[0]?.file !== "map-layer-icons-manifest.json"
        || mapLayerArtifacts[0]?.sha256 !== mapLayerManifestSha256
        || mapLayerManifest.schemaVersion !== 2
        || mapLayerManifest.release !== activeManifest.release
        || mapLayerManifest.kind !== "map-layer-icons"
        || mapLayerManifest.status !== "operator_acknowledged"
        || mapLayerManifest.sourceType !== "operator_pak_export"
        || mapLayerManifest.mappingSha256 !== mapLayerMappingSha256
        || mapLayerManifest.usageBasis !== "operator_reference_use"
        || mapLayerManifest.rightsVerified !== false
        || mapLayerGenerated.schemaVersion !== 1
        || mapLayerGenerated.release !== activeManifest.release
        || !Array.isArray(mapLayerGenerated.entries)
        || !Array.isArray(mapLayerManifest.entries)
        || !Array.isArray(palImagesManifest.entries)
        || !Array.isArray(catalog.items)
      ) {
        throw new Error(
          "Dashboard 지도 필터 아이콘이 active manifest의 provenance gate를 통과하지 못했습니다."
        );
      }
      const sourceIds = mapLayerManifest.sources?.map((source) => source.id) ?? [];
      if (
        sourceIds.length !== MAP_LAYER_SOURCE_IDS.length
        || new Set(sourceIds).size !== sourceIds.length
        || MAP_LAYER_SOURCE_IDS.some((id) => !sourceIds.includes(id))
        || mapLayerManifest.sources?.some((source) =>
          typeof source.id !== "string"
          || !MAP_LAYER_SOURCE_IDS.includes(
            source.id as (typeof MAP_LAYER_SOURCE_IDS)[number]
          )
          || source.sourceType !== MAP_LAYER_SOURCE_TYPES[
            source.id as (typeof MAP_LAYER_SOURCE_IDS)[number]
          ]
          || typeof source.archiveSha256 !== "string"
          || !SHA256_PATTERN.test(source.archiveSha256)
        )
      ) {
        throw new Error(
          "Dashboard 지도 필터 아이콘 source provenance가 올바르지 않습니다."
        );
      }
      const generatedIds = mapLayerGenerated.entries.map((entry) => entry.id);
      const directIds = mapLayerManifest.entries.map((entry) => entry.id);
      if (
        new Set(generatedIds).size !== generatedIds.length
        || generatedIds.some((id) =>
          !(MAP_LAYER_ICON_IDS as readonly unknown[]).includes(id)
        )
        || MAP_LAYER_ICON_IDS.some((id) => !generatedIds.includes(id))
        || new Set(directIds).size !== directIds.length
        || directIds.length !== MAP_LAYER_DIRECT_ICON_IDS.length
        || MAP_LAYER_DIRECT_ICON_IDS.some((id) => !directIds.includes(id))
        || mapLayerManifest.entries.some((entry) =>
          !MAP_LAYER_DIRECT_ICON_IDS.includes(
            entry.id as (typeof MAP_LAYER_DIRECT_ICON_IDS)[number]
          )
          || !MAP_LAYER_SOURCE_IDS.includes(
            entry.sourceId as (typeof MAP_LAYER_SOURCE_IDS)[number]
          )
        )
      ) {
        throw new Error(
          "Dashboard 지도 필터 아이콘 canonical ID 집합 또는 필수 asset이 올바르지 않습니다."
        );
      }
      const directById = new Map(
        mapLayerManifest.entries.map((entry) => [entry.id, entry])
      );
      const palBySource = new Map(
        palImagesManifest.entries.map((entry) => [
          entry.sourceInternalId,
          entry
        ])
      );
      const itemBySource = new Map(
        catalog.items.map((entry) => [entry.sourceInternalId, entry])
      );
      activeMapLayerAssets = mapLayerGenerated.entries.map((entry) => {
        const match = typeof entry.imageUrl === "string"
          ? MAP_LAYER_ICON_URL_PATTERN.exec(entry.imageUrl)
          : null;
        if (
          typeof entry.id !== "string"
          || !(MAP_LAYER_ICON_IDS as readonly string[]).includes(entry.id)
          || typeof entry.sourceReference !== "string"
          || match?.[1] !== activeManifest.release
          || !Number.isInteger(entry.width)
          || !Number.isInteger(entry.height)
          || Number(entry.width) < 1
          || Number(entry.width) > 512
          || Number(entry.height) < 1
          || Number(entry.height) > 512
        ) {
          throw new Error(
            "Dashboard 지도 필터 아이콘 entry가 안전한 local asset이 아닙니다."
          );
        }
        const sourceEntry = entry.kind === "map"
          ? directById.get(entry.id)
          : entry.kind === "pal"
            ? palBySource.get(entry.sourceReference)
            : entry.kind === "item"
              ? itemBySource.get(entry.sourceReference)
              : undefined;
        const expectedDirectory = entry.kind === "map"
          ? "map-icons"
          : entry.kind === "pal"
            ? "pals"
            : entry.kind === "item"
              ? "items"
              : undefined;
        const sourceWidth = entry.kind === "map"
          ? sourceEntry?.outputWidth
          : entry.kind === "pal"
            ? sourceEntry?.outputWidth
            : sourceEntry?.imageWidth;
        const sourceHeight = entry.kind === "map"
          ? sourceEntry?.outputHeight
          : entry.kind === "pal"
            ? sourceEntry?.outputHeight
            : sourceEntry?.imageHeight;
        if (
          sourceEntry === undefined
          || match[2] !== expectedDirectory
          || sourceEntry.imageUrl !== entry.imageUrl
          || sourceWidth !== entry.width
          || sourceHeight !== entry.height
          || (
            entry.kind === "map"
            && (
              sourceEntry.mappingStatus !== entry.mappingStatus
              || sourceEntry.sourceReference !== entry.sourceReference
            )
          )
          || (
            entry.kind !== "map"
            && entry.mappingStatus !== "representative_runtime_asset"
            && entry.mappingStatus !== "representative_game_asset"
          )
        ) {
          throw new Error(
            `Dashboard 지도 필터 아이콘 mapping이 active source와 다릅니다: ${entry.id}`
          );
        }
        return {
          id: entry.id,
          imageUrl: entry.imageUrl,
          width: Number(entry.width),
          height: Number(entry.height)
        };
      });
      const mainMap = mapManifest.entries?.find((entry) => entry.id === "main");
      const mainDisplayMap = mapManifest.entries?.find(
        (entry) => entry.id === "main-display"
      );
      const generatedMapIds = Object.keys(generated.maps ?? {}).sort();
      const manifestMapIds = (mapManifest.entries ?? [])
        .flatMap((entry) => typeof entry.id === "string" ? [entry.id] : [])
        .sort();
      if (
        mainMap === undefined
        || mainDisplayMap === undefined
        || generated.map?.imageUrl !== mainMap.imageUrl
        || generated.map.width !== mainMap.outputWidth
        || generated.map.height !== mainMap.outputHeight
        || generated.displayMap?.imageUrl !== mainDisplayMap.imageUrl
        || generated.displayMap.width !== mainDisplayMap.outputWidth
        || generated.displayMap.height !== mainDisplayMap.outputHeight
        || JSON.stringify(generatedMapIds) !== JSON.stringify(manifestMapIds)
        || (mapManifest.entries ?? []).some((entry) => {
          const generatedEntry =
            typeof entry.id === "string" ? generated.maps?.[entry.id] : undefined;
          return generatedEntry?.imageUrl !== entry.imageUrl
            || generatedEntry.width !== entry.outputWidth
            || generatedEntry.height !== entry.outputHeight;
        })
      ) {
        throw new Error(
          "Dashboard 지도 asset과 active Palworld map image manifest가 일치하지 않습니다."
        );
      }
      const workSource = generated.workSource;
      const workManifestSha256 = createHash("sha256")
        .update(workManifestText)
        .digest("hex");
      const workMappingSha256 = createHash("sha256")
        .update(workMappingBytes)
        .digest("hex");
      const workManifestArtifacts = activeManifest.composite?.artifacts
        ?.filter((artifact) =>
          artifact.kind === "work-images-manifest"
          || artifact.file === "work-images-manifest.json"
        ) ?? [];
      if (
        activeManifest.schemaVersion !== 2
        || activeManifest.format !== "legacy_composite_v2"
        || activeManifest.release !== workManifest.release
        || activeManifest.releaseDirectory !== workManifest.release
        || activeManifest.composite?.availability?.workImages !== "active"
        || workManifestArtifacts.length !== 1
        || workManifestArtifacts[0]?.kind !== "work-images-manifest"
        || workManifestArtifacts[0]?.file !== "work-images-manifest.json"
        || workManifestArtifacts[0]?.sha256 !== workManifestSha256
        || generated.schemaVersion !== 1
        || workSource === undefined
        || workManifest.schemaVersion !== 1
        || workManifest.kind !== "work"
        || typeof workManifest.release !== "string"
        || workManifest.release !== workSource?.release
        || workManifest.sourceType !== "operator_pak_export"
        || workManifest.sourceType !== workSource.sourceType
        || workManifest.sourceArchiveSha256 !== workSource.sourceArchiveSha256
        || workManifest.mappingSha256 !== workSource.mappingSha256
        || workManifest.mappingSha256 !== workMappingSha256
        || workManifest.status !== "operator_acknowledged"
        || workManifest.status !== workSource.status
        || workManifest.usageBasis !== "operator_reference_use"
        || workManifest.usageBasis !== workSource.usageBasis
        || workManifest.rightsVerified !== false
        || workSource.rightsVerified !== false
        || !SHA256_PATTERN.test(String(workManifest.sourceArchiveSha256))
        || !SHA256_PATTERN.test(String(workManifest.mappingSha256))
        || !Array.isArray(generated.work)
        || !Array.isArray(workManifest.entries)
        || generated.work.length === 0
        || generated.work.length !== workManifest.entries.length
      ) {
        throw new Error(
          "Dashboard 작업 적성 asset과 active Palworld work image manifest의 provenance가 일치하지 않습니다."
        );
      }
      activeWorkRelease = workManifest.release;
      const generatedById = new Map(generated.work.map((entry) => [
        entry.id,
        entry
      ]));
      const workIds = new Set<string>();
      activeWorkAssets = workManifest.entries.map((entry) => {
        const generatedEntry = generatedById.get(entry.id);
        const expectedImageUrl =
          `/images/palworld/${workManifest.release}/work/${entry.outputSha256}.webp`;
        if (
          typeof entry.id !== "string"
          || !WORK_ID_PATTERN.test(entry.id)
          || workIds.has(entry.id)
          || typeof entry.outputSha256 !== "string"
          || !SHA256_PATTERN.test(entry.outputSha256)
          || entry.outputFileName !== `${entry.outputSha256}.webp`
          || entry.imageUrl !== expectedImageUrl
          || !Number.isInteger(entry.outputWidth)
          || !Number.isInteger(entry.outputHeight)
          || entry.outputWidth !== 64
          || entry.outputHeight !== 64
          || !Number.isInteger(entry.outputBytes)
          || Number(entry.outputBytes) < 20
          || typeof entry.sourceMember !== "string"
          || !entry.sourceMember.startsWith("Pal/Texture/UI/InGame/")
          || typeof entry.sourceSha256 !== "string"
          || !SHA256_PATTERN.test(entry.sourceSha256)
          || generatedEntry?.imageUrl !== entry.imageUrl
          || generatedEntry.width !== entry.outputWidth
          || generatedEntry.height !== entry.outputHeight
        ) {
          throw new Error(
            "Dashboard 작업 적성 asset entry가 active manifest와 일치하지 않습니다."
          );
        }
        workIds.add(entry.id);
        return entry as WorkStaticAsset;
      });
      if (
        workIds.size !== generatedById.size
        || [...generatedById.keys()].some((id) =>
          typeof id !== "string" || !workIds.has(id)
        )
      ) {
        throw new Error(
          "Dashboard 작업 적성 asset ID 집합이 active manifest와 일치하지 않습니다."
        );
      }
      assetsValidated = true;
    },
    async closeBundle() {
      if (!assetsValidated) {
        return;
      }
      // 비버전 candidate 경로는 제거하고 manifest가 고정한 release asset만 게시합니다.
      await rm(
        path.resolve(outputDirectory, "images/palworld/work"),
        { recursive: true, force: true }
      );
      const workDirectory = path.resolve(
        outputDirectory,
        "images/palworld",
        activeWorkRelease,
        "work"
      );
      const actualNames = (await readdir(workDirectory)).sort();
      const expectedNames = activeWorkAssets
        .map((entry) => entry.outputFileName)
        .sort();
      if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
        throw new Error(
          "Dashboard build의 작업 적성 asset 파일 집합이 active manifest와 일치하지 않습니다."
        );
      }
      await Promise.all(activeWorkAssets.map(async (entry) => {
        const bytes = await readFile(path.join(workDirectory, entry.outputFileName));
        if (
          bytes.length !== entry.outputBytes
          || bytes.subarray(0, 4).toString("ascii") !== "RIFF"
          || bytes.subarray(8, 12).toString("ascii") !== "WEBP"
          || createHash("sha256").update(bytes).digest("hex")
            !== entry.outputSha256
        ) {
          throw new Error(
            `Dashboard 작업 적성 asset 검증에 실패했습니다: ${entry.id}`
          );
        }
      }));
      await Promise.all(activeMapLayerAssets.map(async (entry) => {
        const match = MAP_LAYER_ICON_URL_PATTERN.exec(entry.imageUrl);
        if (match === null) {
          throw new Error(
            `Dashboard 지도 필터 아이콘 URL 검증에 실패했습니다: ${entry.id}`
          );
        }
        const filePath = path.resolve(
          outputDirectory,
          ...entry.imageUrl.slice(1).split("/")
        );
        const bytes = await readFile(filePath);
        if (
          bytes.subarray(0, 4).toString("ascii") !== "RIFF"
          || bytes.subarray(8, 12).toString("ascii") !== "WEBP"
          || createHash("sha256").update(bytes).digest("hex") !== match[3]
        ) {
          throw new Error(
            `Dashboard 지도 필터 아이콘 파일 검증에 실패했습니다: ${entry.id}`
          );
        }
      }));
    }
  };
}

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE_PATH ?? (command === "build" ? "/dashboard/" : "/"),
  html: {
    cspNonce: "__STREAMOPS_CSP_NONCE__"
  },
  build: {
    cssMinify: "lightningcss",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/apps/dashboard/src/shared/ui/")) {
            return "dashboard-shared-ui";
          }
          if (/\/(?:CommunityModeration|EventLog|Events|ServerStatus|StreamerRiotRequests|SupportInbox)Page\.tsx$/.test(id)) {
            return "dashboard-admin-pages";
          }
          if (/\/(?:Followers|Settings|TwitchConnection)Page\.tsx$/.test(id)) {
            return "dashboard-settings-pages";
          }
          if (/\/(?:Dashboard|LolOperations|OverlayOps)Page\.tsx$/.test(id)) {
            return "dashboard-operations-pages";
          }
          return undefined;
        }
      }
    }
  },
  plugins: [react(), palworldStaticAssetPolicy()],
  server: {
    port: 5173
  }
}));

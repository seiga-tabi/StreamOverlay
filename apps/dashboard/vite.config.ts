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

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const WORK_ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;

function palworldStaticAssetPolicy(): Plugin {
  let outputDirectory = fileURLToPath(new URL("./dist", import.meta.url));
  let activeWorkAssets: WorkStaticAsset[] = [];
  let activeWorkRelease = "";
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
            workImages?: unknown;
          };
        };
      };
      const generated = JSON.parse(generatedText) as {
        schemaVersion?: unknown;
        map?: { imageUrl?: unknown; width?: unknown; height?: unknown };
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
      const mainMap = mapManifest.entries?.find((entry) => entry.id === "main");
      if (
        mainMap === undefined
        || generated.map?.imageUrl !== mainMap.imageUrl
        || generated.map.width !== mainMap.outputWidth
        || generated.map.height !== mainMap.outputHeight
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
    },
    async closeBundle() {
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
          if (/\/(?:Followers|Settings|Tournaments|TwitchConnection)Page\.tsx$/.test(id)) {
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

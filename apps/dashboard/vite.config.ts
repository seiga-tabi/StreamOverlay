import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function palworldStaticAssetPolicy(): Plugin {
  let outputDirectory = fileURLToPath(new URL("./dist", import.meta.url));
  return {
    name: "streamops-palworld-static-asset-policy",
    apply: "build",
    configResolved(config) {
      outputDirectory = path.resolve(config.root, config.build.outDir);
    },
    async buildStart() {
      const [generatedText, mapManifestText] = await Promise.all([
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
        )
      ]);
      const generated = JSON.parse(generatedText) as {
        map?: { imageUrl?: unknown; width?: unknown; height?: unknown };
      };
      const mapManifest = JSON.parse(mapManifestText) as {
        entries?: Array<{
          id?: unknown;
          imageUrl?: unknown;
          outputWidth?: unknown;
          outputHeight?: unknown;
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
    },
    async closeBundle() {
      // candidate 작업 아이콘은 source 검수용으로만 보존하고 public runtime에는 게시하지 않습니다.
      await rm(
        path.resolve(outputDirectory, "images/palworld/work"),
        { recursive: true, force: true }
      );
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

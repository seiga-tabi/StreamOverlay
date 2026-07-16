import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react()],
  server: {
    port: 5173
  }
}));

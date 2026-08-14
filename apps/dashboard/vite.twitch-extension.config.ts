import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));

/* Twitch Extension 정적 번들 — Twitch CDN 에 zip 업로드되므로
 * base 는 상대 경로여야 하고, 외부 요청은 Twitch Helper + EBS(런타임 fetch)뿐이어야 합니다. */
export default defineConfig({
  root: path.join(here, "twitch-extension"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.join(here, "dist-twitch-extension"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: path.join(here, "twitch-extension/panel.html"),
        video_overlay: path.join(here, "twitch-extension/video_overlay.html"),
        config: path.join(here, "twitch-extension/config.html"),
        mobile: path.join(here, "twitch-extension/mobile.html"),
        video_component: path.join(here, "twitch-extension/video_component.html"),
      },
    },
  },
});

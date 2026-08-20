/* 임시 프로브 설정 — 검증 후 삭제합니다. */
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "zz-probe-hero.spec.ts",
  workers: 1,
  timeout: 60000,
  reporter: "line",
  use: { locale: "ko-KR" }
});

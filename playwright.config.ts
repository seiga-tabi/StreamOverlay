import { defineConfig, devices } from "@playwright/test";

const dashboardPort = 4173;
const baselinePlatform = process.platform;

export default defineConfig({
  testDir: "./qa/visual-regression",
  outputDir: "./qa/visual-regression/results",
  snapshotPathTemplate: `{testDir}/baselines/${baselinePlatform}/{projectName}/{arg}{ext}`,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "qa/visual-regression/report", open: "never" }]]
    : "line",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.003,
      threshold: 0.2
    }
  },
  use: {
    baseURL: `http://127.0.0.1:${dashboardPort}`,
    colorScheme: "dark",
    locale: "ko-KR",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    trace: "retain-on-failure"
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 }
      }
    }
  ],
  webServer: {
    command: `npm --workspace apps/dashboard run dev -- --host 127.0.0.1 --port ${dashboardPort} --strictPort`,
    url: `http://127.0.0.1:${dashboardPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});

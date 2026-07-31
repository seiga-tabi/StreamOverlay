import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  googleAnalyticsPageLocation,
  isGoogleAnalyticsPublicPath
} from "../src/analytics/google-analytics";

test("Google Analytics 측정 ID와 공개 페이지 범위를 고정한다", () => {
  assert.equal(GOOGLE_ANALYTICS_MEASUREMENT_ID, "G-SEG94KMT1H");
  assert.equal(isGoogleAnalyticsPublicPath("/"), true);
  assert.equal(isGoogleAnalyticsPublicPath("/palworld/pals"), true);
  assert.equal(isGoogleAnalyticsPublicPath("/bot/features"), true);
  assert.equal(isGoogleAnalyticsPublicPath("/dashboard"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/dashboard/organizations"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/admin/settings"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/account/connections"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/login"), false);
});

test("Analytics page location은 query와 hash를 포함하지 않는다", () => {
  assert.equal(
    googleAnalyticsPageLocation({
      origin: "https://yoro.gg",
      pathname: "/palworld/search"
    }),
    "https://yoro.gg/palworld/search"
  );
});

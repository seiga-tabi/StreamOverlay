import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  GOOGLE_CONSENT_CHANGE_EVENT,
  GOOGLE_CONSENT_STORAGE_KEY,
  analyticsEventsForLink,
  googleAnalyticsPageLocation,
  googleConsentState,
  isGoogleAnalyticsPublicPath
} from "../src/analytics/google-analytics";

test("Google Analytics 측정 ID와 공개 페이지 범위를 고정한다", () => {
  assert.equal(GOOGLE_ANALYTICS_MEASUREMENT_ID, "G-SEG94KMT1H");
  assert.equal(isGoogleAnalyticsPublicPath("/"), true);
  assert.equal(isGoogleAnalyticsPublicPath("/palworld/pals"), true);
  assert.equal(isGoogleAnalyticsPublicPath("/bot/commands"), true);
  assert.equal(isGoogleAnalyticsPublicPath("/dashboard"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/dashboard/organizations"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/admin/settings"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/account/connections"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/login"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/ko/dashboard"), false);
  assert.equal(isGoogleAnalyticsPublicPath("/ja/palworld/map"), true);
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

test("Consent Mode v2 선택은 분석·광고 저장 상태 네 가지를 함께 갱신한다", () => {
  assert.equal(GOOGLE_CONSENT_STORAGE_KEY, "yoro.google.consent.v1");
  assert.equal(GOOGLE_CONSENT_CHANGE_EVENT, "yoro:google-consent");
  assert.deepEqual(googleConsentState("granted"), {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted"
  });
  assert.deepEqual(googleConsentState("denied"), {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  });
});

test("공개 링크의 Discord·Twitch·outbound·Dashboard 이벤트를 분류한다", () => {
  assert.deepEqual(
    analyticsEventsForLink("https://discord.gg/yoro", "https://yoro.gg", "/ko/lol"),
    ["outbound_click", "discord_click"]
  );
  assert.deepEqual(
    analyticsEventsForLink("https://www.twitch.tv/yoro", "https://yoro.gg", "/lol"),
    ["outbound_click", "twitch_click"]
  );
  assert.deepEqual(
    analyticsEventsForLink("/dashboard", "https://yoro.gg", "/ja/bot"),
    ["bot_dashboard"]
  );
  assert.deepEqual(
    analyticsEventsForLink("/overlay/viewer", "https://yoro.gg", "/lol"),
    []
  );
});

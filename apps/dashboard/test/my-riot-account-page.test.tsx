import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardStreamerInfo } from "../src/api/client";
import { setDashboardLocale } from "../src/i18n";

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "http://dashboard.test" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
  },
});

const streamer: DashboardStreamerInfo = {
  twitchUserId: "streamer-1",
  twitchLogin: "streamer_login",
  twitchDisplayName: "테스트 스트리머",
  twitchProfileImageUrl: "https://static-cdn.jtvnw.net/test-profile.png",
  riotGameName: "게임이름",
  riotTagLine: "KR1",
  overlaySlug: "should-not-render",
  overlayKey: "secret-overlay-key-should-not-render",
  profileLinkUrl: "https://example.com/should-not-render",
  profileLinkLabel: "비공개 링크",
};

test("Riot ID 전용 페이지는 Overlay와 프로필 링크 정보를 DOM에 노출하지 않는다", async () => {
  const { MyRiotAccountPage } = await import("../src/pages/MyRiotAccountPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<MyRiotAccountPage streamer={streamer} />);

  assert.match(html, /내 Riot ID/);
  assert.match(html, /게임이름#KR1/);
  assert.match(html, /새 Riot ID/);
  assert.match(html, /Riot ID 저장/);
  assert.doesNotMatch(html, /should-not-render/);
  assert.doesNotMatch(html, /secret-overlay-key/);
  assert.doesNotMatch(html, /Overlay 접근|프로필 링크/);
});

test("미등록 방송인은 등록 안내 EmptyState를 한국어와 일본어로 표시한다", async () => {
  const { MyRiotAccountPage } = await import("../src/pages/MyRiotAccountPage");
  setDashboardLocale("ko");
  const korean = renderToStaticMarkup(<MyRiotAccountPage />);
  assert.match(korean, /방송인 등록이 필요합니다/);
  assert.match(korean, /방송인 등록 화면으로 이동/);

  setDashboardLocale("ja");
  const japanese = renderToStaticMarkup(<MyRiotAccountPage />);
  assert.match(japanese, /配信者登録が必要です/);
  assert.match(japanese, /配信者登録画面へ/);
  setDashboardLocale("ko");
});

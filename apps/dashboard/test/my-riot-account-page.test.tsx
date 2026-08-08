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
  profileLinkUrl: "https://example.com/should-not-render",
  profileLinkLabel: "비공개 링크",
};

test("Riot ID 전용 페이지는 프로필 링크 정보를 DOM에 노출하지 않는다", async () => {
  const { MyRiotAccountPage } = await import("../src/pages/MyRiotAccountPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<MyRiotAccountPage streamer={streamer} />);

  assert.match(html, /내 Riot ID/);
  assert.match(html, /계정 상태/);
  assert.match(html, /연결된 계정/);
  assert.match(html, /검색 결과 미리보기/);
  assert.match(html, /Twitch · Riot/);
  assert.match(html, /게임이름#KR1/);
  assert.match(html, /새 Riot ID/);
  assert.match(html, /Riot ID 저장/);
  assert.doesNotMatch(html, /should-not-render/);
  assert.doesNotMatch(html, /Overlay 접근|프로필 링크/);
});

test("Riot 계정 목록 카드는 서브 계정 추가 폼과 개수 안내를 제공한다", async () => {
  const { MyRiotAccountPage } = await import("../src/pages/MyRiotAccountPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<MyRiotAccountPage csrfToken="csrf-test" streamer={streamer} />);

  assert.match(html, /Riot 계정 목록/);
  assert.match(html, /서브 계정으로 검색해도 같은 스트리머로 연결됩니다|같은 스트리머로 연결/);
  assert.match(html, /추가할 Riot ID/);
  assert.match(html, /계정 추가/);
  assert.match(html, /서브 계정 4개 더 추가할 수 있습니다/);
  // 계정 목록을 불러오기 전에는 skeleton이 자리를 지킵니다(SSR 초기 상태).
  assert.match(html, /aria-busy="true"/);
  // 개명 카드는 계정 추가와 역할이 분리된 문구를 씁니다.
  assert.match(html, /대표 계정 이름 변경/);

  setDashboardLocale("ja");
  const japanese = renderToStaticMarkup(<MyRiotAccountPage csrfToken="csrf-test" streamer={streamer} />);
  assert.match(japanese, /Riot アカウント一覧/);
  assert.match(japanese, /アカウント追加/);
  assert.match(japanese, /サブアカウントをあと 4 件追加できます/);
  assert.match(japanese, /メインアカウントの名前を変更/);
  setDashboardLocale("ko");
});

test("Riot ID 계정 상태와 검색 미리보기는 일본어 UI 구조를 함께 제공한다", async () => {
  const { MyRiotAccountPage } = await import("../src/pages/MyRiotAccountPage");
  setDashboardLocale("ja");
  const html = renderToStaticMarkup(<MyRiotAccountPage streamer={streamer} />);

  assert.match(html, /アカウント状態/);
  assert.match(html, /連携アカウント/);
  assert.match(html, /検索結果プレビュー/);
  assert.match(html, /Twitch・Riot/);
  assert.match(html, /게임이름#KR1/);
  setDashboardLocale("ko");
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

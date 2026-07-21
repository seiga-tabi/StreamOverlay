import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FollowerOAuthStatus } from "@streamops/shared";
import { Layout } from "../src/components/Layout";
import { setDashboardLocale, uiText } from "../src/i18n";

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

function oauthStatus(state: FollowerOAuthStatus["state"]): FollowerOAuthStatus {
  return {
    state,
    missingScopes: state === "missing_scopes" ? ["moderator:read:followers"] : [],
  };
}

test("스트리머 메뉴에 팔로워 관리가 활성 페이지로 표시된다", () => {
  const html = renderToStaticMarkup(
    <Layout
      locale="ko"
      onLocaleChange={() => undefined}
      page="followers"
      role="streamer"
      setPage={() => undefined}
    >
      <div>팔로워 본문</div>
    </Layout>
  );

  assert.match(html, /class="nav-item active"[^>]*data-ko="팔로워 관리"/);
  assert.match(html, /팔로워 본문/);
});

test("팔로워 페이지 초기 로딩은 Skeleton을 표시하고 새로고침을 비활성화한다", async () => {
  const { FollowersPage } = await import("../src/pages/FollowersPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<FollowersPage />);

  assert.match(html, /aria-label="팔로워 정보를 불러오는 중입니다\."/);
  assert.match(html, /disabled=""/);
  assert.match(html, /팔로워 목록 새로고침/);
});

test("팔로워 OAuth 미연결, 권한 부족, token 만료 상태를 구분한다", async () => {
  const { FollowerOAuthNotice } = await import("../src/pages/FollowersPage");
  setDashboardLocale("ko");
  const disconnected = renderToStaticMarkup(
    <FollowerOAuthNotice connecting={false} oauth={oauthStatus("disconnected")} onConnect={() => undefined} />
  );
  const missingScopes = renderToStaticMarkup(
    <FollowerOAuthNotice connecting={false} oauth={oauthStatus("missing_scopes")} onConnect={() => undefined} />
  );
  const tokenExpired = renderToStaticMarkup(
    <FollowerOAuthNotice connecting={false} oauth={oauthStatus("token_expired")} onConnect={() => undefined} />
  );
  const connected = renderToStaticMarkup(
    <FollowerOAuthNotice connecting={false} oauth={oauthStatus("connected")} onConnect={() => undefined} />
  );

  assert.match(disconnected, /data-oauth-state="disconnected"/);
  assert.match(disconnected, /팔로워 관리 권한을 연결해주세요/);
  assert.match(disconnected, /Twitch 운영 권한 연결/);
  assert.match(missingScopes, /data-oauth-state="missing_scopes"/);
  assert.match(missingScopes, /moderator:read:followers/);
  assert.match(missingScopes, /권한 다시 승인/);
  assert.match(tokenExpired, /data-oauth-state="token_expired"/);
  assert.match(tokenExpired, /Twitch 운영 권한이 만료되었습니다/);
  assert.match(tokenExpired, /Twitch 다시 연결/);
  assert.equal(connected, "");

  setDashboardLocale("ja");
  const japaneseMissingScopes = renderToStaticMarkup(
    <FollowerOAuthNotice connecting={false} oauth={oauthStatus("missing_scopes")} onConnect={() => undefined} />
  );
  assert.match(japaneseMissingScopes, /フォロワー取得権限が不足しています/);
  assert.match(japaneseMissingScopes, /権限を再承認/);
  assert.match(uiText.followersPage.dataNotes.join(" "), /フォロー解除/);
  assert.equal(uiText.followersPage.genres.chat, "チャット参加");
  setDashboardLocale("ko");
});

test("팔로워 데이터가 없으면 공통 EmptyState를 표시한다", async () => {
  const { FollowerEmptyState } = await import("../src/pages/FollowersPage");
  const html = renderToStaticMarkup(<FollowerEmptyState text="아직 기록된 팔로워가 없습니다." />);

  assert.match(html, /class="yoro-empty-state followers-inline-empty"/);
  assert.match(html, /아직 기록된 팔로워가 없습니다/);
});

test("서버가 반환한 Twitch OAuth URL은 공식 HTTPS host만 허용한다", async () => {
  const { safeFollowerOAuthUrl } = await import("../src/pages/FollowersPage");
  assert.match(
    safeFollowerOAuthUrl("https://id.twitch.tv/oauth2/authorize?client_id=test") ?? "",
    /^https:\/\/id\.twitch\.tv\/oauth2\/authorize/
  );
  assert.equal(safeFollowerOAuthUrl("http://id.twitch.tv/oauth2/authorize"), undefined);
  assert.equal(safeFollowerOAuthUrl("https://id.twitch.tv.example.com/oauth2/authorize"), undefined);
  assert.equal(safeFollowerOAuthUrl("https://id.twitch.tv:444/oauth2/authorize"), undefined);
  assert.equal(safeFollowerOAuthUrl("https://user@id.twitch.tv/oauth2/authorize"), undefined);
  assert.equal(safeFollowerOAuthUrl("https://id.twitch.tv/redirect"), undefined);
  assert.equal(safeFollowerOAuthUrl("not-a-url"), undefined);
});

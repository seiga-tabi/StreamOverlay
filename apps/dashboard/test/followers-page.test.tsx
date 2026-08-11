import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FollowerOAuthStatus, FollowerRecord } from "@streamops/shared";
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

test("팔로워 페이지 초기 로딩은 Skeleton을 표시한다", async () => {
  const { FollowersPage } = await import("../src/pages/FollowersPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<FollowersPage />);

  assert.match(html, /class="followers-page"/);
  assert.match(html, /aria-labelledby="followers-page-title"/);
  assert.match(html, /aria-label="팔로워 정보를 불러오는 중입니다\."/);
  assert.match(html, /팔로워 관리/);
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
  assert.equal(uiText.followersPage.statuses.unfollowed, "解除の推定");
  assert.equal(uiText.followersPage.hero.followers, "フォロワー");
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

function follower(overrides: Partial<FollowerRecord> & Pick<FollowerRecord, "userId">): FollowerRecord {
  return {
    userName: overrides.userId,
    userLogin: overrides.userId.toLowerCase(),
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    lastSeenAt: "2026-01-01T00:00:00.000Z",
    status: "following",
    source: "eventsub",
    activity: { chatMessages: 0, participationEntries: 0, total: 0, genres: {} },
    ...overrides
  };
}

test("filterFollowerDirectory는 이름·로그인·Riot ID로 검색하고 상태로 필터링한다", async () => {
  const { filterFollowerDirectory } = await import("../src/pages/FollowersPage");
  const records = [
    follower({ userId: "u1", userName: "Faker", userLogin: "faker_kr", riotGameName: "Hide", riotTagLine: "KR1", status: "following" }),
    follower({ userId: "u2", userName: "Chovy", userLogin: "chovy_gen", status: "unfollowed" }),
    follower({ userId: "u3", userName: "Zeus", userLogin: "zeus_t1", riotGameName: "Doran", riotTagLine: "KR1", status: "following" })
  ];

  assert.deepEqual(filterFollowerDirectory(records, "", "all").map((r) => r.userId), ["u1", "u2", "u3"]);
  assert.deepEqual(filterFollowerDirectory(records, "", "unfollowed").map((r) => r.userId), ["u2"]);
  assert.deepEqual(filterFollowerDirectory(records, "chovy", "all").map((r) => r.userId), ["u2"]);
  assert.deepEqual(filterFollowerDirectory(records, "hide#kr1", "all").map((r) => r.userId), ["u1"]);
  assert.deepEqual(filterFollowerDirectory(records, "zeus", "unfollowed").map((r) => r.userId), []);
  assert.deepEqual(filterFollowerDirectory(records, "  FAKER  ", "all").map((r) => r.userId), ["u1"]);
});

test("sortFollowerDirectory는 팔로우 시각 기준 오름차순/내림차순 정렬한다", async () => {
  const { sortFollowerDirectory } = await import("../src/pages/FollowersPage");
  const records = [
    follower({ userId: "old", followedAt: "2026-01-01T00:00:00.000Z" }),
    follower({ userId: "new", followedAt: "2026-03-01T00:00:00.000Z" }),
    follower({ userId: "mid", followedAt: "2026-02-01T00:00:00.000Z" })
  ];

  assert.deepEqual(
    sortFollowerDirectory(records, { key: "followedAt", dir: "desc" }).map((r) => r.userId),
    ["new", "mid", "old"]
  );
  assert.deepEqual(
    sortFollowerDirectory(records, { key: "followedAt", dir: "asc" }).map((r) => r.userId),
    ["old", "mid", "new"]
  );
});

test("팔로워 화면은 히어로 스탯 바와 4컬럼 디렉토리로 구성된다", async () => {
  const source = await readFile(new URL("../src/pages/FollowersPage.tsx", import.meta.url), "utf8");

  // 히어로: 팔로워 수 + 주간 증감(+N) + 기록 전체 · 마지막 동기화 + 새로고침.
  assert.match(source, /followers-hero-stat/u);
  assert.match(source, /followers-hero-delta/u);
  assert.match(source, /t\.hero\.known\.replace\("\{count\}", formatCount\(state\.summary\.knownFollowers\)\)/u);
  assert.match(source, /t\.hero\.synced\.replace\("\{time\}", formatDate\(state\.lastSnapshotAt\)\)/u);

  // 주간 증감은 newFollowers7d가 0보다 클 때만 표시합니다.
  assert.match(source, /state\.summary\.newFollowers7d > 0/u);

  // 팔로워 목록에 검색, 상태 필터, 팔로우 날짜 정렬, 페이지네이션이 있어야 합니다.
  assert.match(source, /follower-directory-search/u);
  assert.match(source, /type="search"/u);
  assert.match(source, /follower-status-filter/u);
  assert.match(source, /aria-pressed=\{directoryStatus === option\}/u);
  assert.match(source, /toggleDirectorySort\(\)/u);
  assert.match(source, /follower-directory-pagination/u);
  assert.match(source, /follower-pager/u);

  // 4컬럼: 사용자 / Riot ID / 상태 / 팔로우 날짜 — 관측 활동·장르 컬럼은 제거되었습니다.
  assert.match(source, /data-label=\{t\.columns\.riotId\}/u);
  assert.match(source, /data-label=\{t\.columns\.followedAt\}/u);
  assert.doesNotMatch(source, /columns\.activity/u);
  assert.doesNotMatch(source, /columns\.genre/u);
  assert.doesNotMatch(source, /genre-bar/u);
  assert.doesNotMatch(source, /FollowerMiniList/u);
  assert.doesNotMatch(source, /ops-note/u);
  assert.doesNotMatch(source, /scope-warning/u);
});

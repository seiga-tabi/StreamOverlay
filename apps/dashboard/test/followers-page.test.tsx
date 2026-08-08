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

test("팔로워 페이지 초기 로딩은 Skeleton을 표시하고 새로고침을 비활성화한다", async () => {
  const { FollowersPage } = await import("../src/pages/FollowersPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<FollowersPage />);

  assert.match(html, /class="followers-page"/);
  assert.match(html, /aria-labelledby="followers-page-title"/);
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

test("sortFollowerDirectory는 팔로우 시각·관측 활동 기준 오름차순/내림차순 정렬한다", async () => {
  const { sortFollowerDirectory } = await import("../src/pages/FollowersPage");
  const records = [
    follower({ userId: "old-low", followedAt: "2026-01-01T00:00:00.000Z", activity: { chatMessages: 1, participationEntries: 0, total: 1, genres: {} } }),
    follower({ userId: "new-high", followedAt: "2026-03-01T00:00:00.000Z", activity: { chatMessages: 9, participationEntries: 0, total: 9, genres: {} } }),
    follower({ userId: "mid-mid", followedAt: "2026-02-01T00:00:00.000Z", activity: { chatMessages: 5, participationEntries: 0, total: 5, genres: {} } })
  ];

  assert.deepEqual(
    sortFollowerDirectory(records, { key: "followedAt", dir: "desc" }).map((r) => r.userId),
    ["new-high", "mid-mid", "old-low"]
  );
  assert.deepEqual(
    sortFollowerDirectory(records, { key: "followedAt", dir: "asc" }).map((r) => r.userId),
    ["old-low", "mid-mid", "new-high"]
  );
  assert.deepEqual(
    sortFollowerDirectory(records, { key: "activity", dir: "desc" }).map((r) => r.userId),
    ["new-high", "mid-mid", "old-low"]
  );
  assert.deepEqual(
    sortFollowerDirectory(records, { key: "activity", dir: "asc" }).map((r) => r.userId),
    ["old-low", "mid-mid", "new-high"]
  );
});

test("genreBarPercent은 최댓값 대비 비율을 0~100 사이로 계산한다", async () => {
  const { genreBarPercent } = await import("../src/pages/FollowersPage");
  assert.equal(genreBarPercent(50, 100), 50);
  assert.equal(genreBarPercent(100, 100), 100);
  assert.equal(genreBarPercent(0, 100), 0);
  assert.equal(genreBarPercent(33, 0), 0);
  assert.equal(genreBarPercent(1, 3), 33);
});

test("팔로워 목록에는 관측 장르 막대 그래프, 검색·필터·정렬·페이지네이션 UI가 있다", async () => {
  const source = await readFile(new URL("../src/pages/FollowersPage.tsx", import.meta.url), "utf8");

  // 관측 장르는 텍스트 두 줄이 아니라 실제 비율 막대(genre-bar-track/fill)로 렌더링합니다.
  assert.match(source, /genre-bar-track/u);
  assert.match(source, /genre-bar-fill/u);
  assert.match(source, /genreBarPercent\(genre\.count, maxGenreCount\)/u);

  // 팔로워 목록에 검색, 상태 필터, 정렬 가능한 헤더, 페이지네이션이 있어야 합니다.
  assert.match(source, /follower-directory-search/u);
  assert.match(source, /type="search"/u);
  assert.match(source, /follower-status-filter/u);
  assert.match(source, /aria-pressed=\{directoryStatus === option\}/u);
  assert.match(source, /toggleDirectorySort\("followedAt"\)/u);
  assert.match(source, /toggleDirectorySort\("activity"\)/u);
  assert.match(source, /follower-directory-pagination/u);
  assert.match(source, /follower-pager/u);

  // 모바일 카드형 라벨(data-label)이 Riot ID·팔로우 시각·관측 활동·주요 관측 장르에 있어야 합니다.
  assert.match(source, /data-label=\{t\.columns\.riotId\}/u);
  assert.match(source, /data-label=\{t\.columns\.followedAt\}/u);
  assert.match(source, /data-label=\{t\.columns\.activity\}/u);
  assert.match(source, /data-label=\{t\.columns\.genre\}/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LolBottomTabBar } from "../src/features/public-home/components/HomeTabBar";
import { LolSubnav } from "../src/features/public-home/components/LolHomeSections";
import { StreamersBody, StreamersPageHead } from "../src/features/public-home/components/LolStreamersSections";
import { homeI18n } from "../src/features/public-home/i18n/home-i18n";
import { lolHomeI18n } from "../src/features/public-home/i18n/lol-home-i18n";
import { lolStreamersI18n } from "../src/features/public-home/i18n/lol-streamers-i18n";
import type { PublicTwitchFollowedLolResponse } from "../src/features/public-lol/types/public-lol";

/* LoL 스트리머(/follow) 리디자인 — 목업 캔버스 page-3 의 구조 계약을 단언합니다. */

const noop = () => undefined;

function followedFixture(): PublicTwitchFollowedLolResponse {
  return {
    connected: true,
    truncated: false,
    matchedCount: 3,
    subscriptionScopeGranted: false,
    subscriptions: [],
    channels: [
      {
        twitchUserId: "1",
        twitchLogin: "dawn_tiger",
        twitchDisplayName: "새벽호랑이",
        followedAt: "2026-08-01T00:00:00.000Z",
        isLive: true,
        viewerCount: 1204,
        title: "정글 동선 설명하면서 갑니다",
        thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_dawn_tiger-{width}x{height}.jpg",
        riotId: "새벽호랑이#KR1",
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "IV",
          leaguePoints: 55,
          wins: 127,
          losses: 110,
          winRate: 54,
          fetchedAt: "2026-08-19T00:00:00.000Z"
        }
      },
      {
        twitchUserId: "2",
        twitchLogin: "hide_bush",
        twitchDisplayName: "Hide on bush",
        followedAt: "2025-11-03T00:00:00.000Z",
        isLive: false,
        riotId: "Hide on bush#KR1",
        rankedStats: {
          queueType: "RANKED_SOLO_5x5",
          tier: "CHALLENGER",
          leaguePoints: 1420,
          wins: 300,
          losses: 200,
          winRate: 60,
          fetchedAt: "2026-08-19T00:00:00.000Z"
        }
      },
      {
        twitchUserId: "3",
        twitchLogin: "gureum",
        twitchDisplayName: "gureum",
        followedAt: "2026-03-02T00:00:00.000Z",
        isLive: false
      }
    ]
  };
}

test("페이지 헤드는 노리개·제목·인원·새로고침을 갖춘다", () => {
  const html = renderToStaticMarkup(
    <StreamersPageHead count={12} loading={false} onRefresh={noop} text={lolStreamersI18n.ko} />
  );
  assert.match(html, /yoro-streamers-title/u);
  assert.match(html, />스트리머</u);
  assert.match(html, /12명/u);
  assert.match(html, /새로고침/u);
  assert.match(html, /yoro-home-section-norigae/u);
});

test("본문은 필터 3종+랭크순, 방송 카드(랭크 배지·전적 보기), 오프라인 행(팔로우 날짜·미연동)을 렌더한다", () => {
  const html = renderToStaticMarkup(
    <StreamersBody
      configured
      connected
      error={false}
      followed={followedFixture()}
      homeText={homeI18n.ko}
      loading={false}
      locale="ko"
      onLoginOpen={noop}
      onRetry={noop}
      text={lolStreamersI18n.ko}
    />
  );
  /* 필터 — 방송 중 1 · 전체 3 · 전적 연동 2 + 랭크순 */
  assert.match(html, /방송 중/u);
  assert.match(html, /전적 연동/u);
  assert.match(html, /랭크순/u);
  assert.match(html, /aria-pressed="true"/u);
  /* 방송 카드: 공통 카드 골격 + 랭크 배지(실서비스 영문 티어) + 액션 */
  assert.match(html, /yoro-home-live-badge/u);
  assert.match(html, /1,204명 시청/u);
  assert.match(html, /정글 동선 설명하면서 갑니다/u);
  assert.match(html, /Diamond IV/u);
  assert.match(html, /전적 보기/u);
  assert.match(html, /\/lol\/summoners\//u);
  /* 오프라인: 행 + 팔로우 날짜 + 미연동 표기 + Challenger 배지 */
  assert.match(html, /오프라인/u);
  assert.match(html, /Hide on bush/u);
  assert.match(html, /Challenger/u);
  assert.match(html, /2025년 11월 3일 팔로우/u);
  assert.match(html, /전적 미연동/u);
});

test("로그인 전에는 잠든 백호 빈 상태와 Twitch 로그인 CTA를 보여준다", () => {
  const html = renderToStaticMarkup(
    <StreamersBody
      configured
      connected={false}
      error={false}
      followed={null}
      homeText={homeI18n.ko}
      loading={false}
      locale="ko"
      onLoginOpen={noop}
      onRetry={noop}
      text={lolStreamersI18n.ko}
    />
  );
  assert.match(html, /yoro-home-live-empty-tiger/u);
  assert.match(html, /로그인이 필요합니다/u);
  assert.match(html, /Twitch로 로그인/u);
});

test("오류 상태는 다시 시도 버튼을, 빈 팔로우는 안내 문구를 보여준다", () => {
  const error = renderToStaticMarkup(
    <StreamersBody
      configured
      connected
      error
      followed={null}
      homeText={homeI18n.ko}
      loading={false}
      locale="ko"
      onLoginOpen={noop}
      onRetry={noop}
      text={lolStreamersI18n.ko}
    />
  );
  assert.match(error, /목록을 불러오지 못했습니다/u);
  assert.match(error, /다시 시도/u);

  const empty = renderToStaticMarkup(
    <StreamersBody
      configured
      connected
      error={false}
      followed={{ ...followedFixture(), channels: [] }}
      homeText={homeI18n.ko}
      loading={false}
      locale="ko"
      onLoginOpen={noop}
      onRetry={noop}
      text={lolStreamersI18n.ko}
    />
  );
  assert.match(empty, /팔로우한 LoL 스트리머가 없습니다/u);
});

test("2행 메뉴와 하단 탭바는 스트리머 항목을 활성(꼬리 밑줄 + aria-current)으로 표시한다", () => {
  const subnav = renderToStaticMarkup(<LolSubnav active="streamers" text={lolHomeI18n.ko} />);
  assert.match(subnav, /yoro-lol-subnav-item is-active"[^>]*href="\/ko\/follow"/u);
  assert.match(subnav, /aria-current="page"/u);
  assert.match(subnav, /yoro-lol-subnav-tail/u);
  /* 홈은 활성 아니고 메인 홈(/) 링크 유지 */
  assert.match(subnav, /href="\/ko\/"/u);

  const tabbar = renderToStaticMarkup(<LolBottomTabBar active="streamers" text={lolHomeI18n.ko} />);
  assert.match(tabbar, /is-active"[^>]*href="\/ko\/follow"/u);
  assert.match(tabbar, /aria-current="page"/u);
});

test("스트리머 i18n 은 ko·ja·en 세 로케일에 같은 키를 제공한다", () => {
  const koKeys = Object.keys(lolStreamersI18n.ko).sort();
  assert.deepEqual(Object.keys(lolStreamersI18n.ja).sort(), koKeys);
  assert.deepEqual(Object.keys(lolStreamersI18n.en).sort(), koKeys);
});

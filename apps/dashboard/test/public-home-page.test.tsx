import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeHeader } from "../src/features/public-home/components/HomeHeader";
import { HomeHero } from "../src/features/public-home/components/HomeHero";
import {
  HomeBotSection,
  HomeBreedingSection,
  HomeFooter,
  HomeLiveSection,
  HomeLoginModal
} from "../src/features/public-home/components/HomeSections";
import { HomeBottomTabBar } from "../src/features/public-home/components/HomeTabBar";
import { homeI18n } from "../src/features/public-home/i18n/home-i18n";

/* 루트 홈(백자·수묵 리디자인) — 목업 캔버스 v8 의 구조 계약을 단언합니다.
 * usePublicViewerTwitchSession 등 브라우저 의존 훅은 페이지 셸에 있으므로,
 * 여기서는 셸 아래 조각들을 SSR 로 검증합니다. */

const noop = () => undefined;

test("홈 헤더는 확장형 게임 드롭다운 트리거와 지구본·테마·로그인을 제공한다", () => {
  const html = renderToStaticMarkup(
    <HomeHeader
      connected={false}
      locale="ko"
      onDashboard={noop}
      onLocale={noop}
      onLoginOpen={noop}
      onLogout={noop}
      onToggleTheme={noop}
      text={homeI18n.ko}
    />
  );
  assert.match(html, /YORO<span>\.GG<\/span>/u);
  assert.match(html, /yoro-home-games-trigger/u);
  assert.match(html, /게임/u);
  assert.match(html, /YORO Bot/u);
  assert.match(html, /언어 선택/u);
  assert.match(html, /라이트\/다크 테마 전환/u);
  assert.match(html, /로그인/u);
  /* 접힌 상태에선 게임 메뉴 행이 렌더되지 않습니다(클릭 시 열림). */
  assert.doesNotMatch(html, /리그 오브 레전드/u);
});

test("홈 히어로는 명조 헤드라인과 게임 카테고리 3:4 포스터 격자를 갖춘다", () => {
  /* 목업 「카테고리 선택」 — 검색 폼·붓글씨 마크 대신 네 게임 타일. 타일은
     <a> 이고(이동이지 선택이 아님) 표시는 hover/focus 의 테두리·꼬리 밑줄뿐. */
  const ko = renderToStaticMarkup(<HomeHero text={homeI18n.ko} />);
  assert.match(ko, /LoL 전적부터 팰월드 도감까지, 검색 한 번으로/u);
  assert.match(ko, /yoro-home-headline-tail/u);
  assert.match(ko, /yoro-home-hero--cats/u);
  // 네 게임 이름과 로케일 프리픽스 경로.
  assert.match(ko, /리그 오브 레전드/u);
  assert.match(ko, /팰월드/u);
  assert.match(ko, /발로란트/u);
  assert.match(ko, /마인크래프트/u);
  assert.match(ko, /href="\/ko\/lol"/u);
  assert.match(ko, /href="\/ko\/palworld"/u);
  assert.match(ko, /href="\/ko\/valorant"/u);
  assert.match(ko, /href="\/ko\/minecraft"/u);
  // 타일 4장 — LoL·팰월드는 키아트 <picture>(안 A), 나머지 둘은 마크 타일.
  // --mark 변형이 substring 으로 겹치지 않게 클래스 경계까지 본다.
  assert.equal((ko.match(/yoro-home-cat-art[" ]/gu) ?? []).length, 4);
  assert.equal((ko.match(/yoro-home-cat-art--mark/gu) ?? []).length, 2);
  assert.equal((ko.match(/<picture>/gu) ?? []).length, 2);
  // 그림은 장식 — 접근성 이름은 옆의 게임 이름 글자가 맡습니다.
  assert.match(ko, /<img alt=""/u);
  // 검색 폼과 붓글씨 마크가 사라졌는지 — /lol 히어로 전용으로 남습니다.
  assert.doesNotMatch(ko, /yoro-home-search-box/u);
  assert.doesNotMatch(ko, /yoro-home-mark-word/u);

  /* 로케일 프리픽스는 currentPublicLocale() 이 정합니다 — window 가 없는 SSR
     테스트에서는 ko 폴백이라, ja 는 문구만 단언합니다. */
  const ja = renderToStaticMarkup(<HomeHero text={homeI18n.ja} />);
  assert.match(ja, /LoL戦績からパルワールド図鑑まで、検索ひとつで/u);
  assert.match(ja, /リーグ・オブ・レジェンド/u);
  assert.match(ja, /パルワールド/u);
  assert.match(ja, /ヴァロラント|VALORANT|バロラント/u);
});

test("지금 방송 중은 로그인 전 상태에서 잠든 백호 빈 상태와 로그인 CTA를 보여준다", () => {
  const html = renderToStaticMarkup(
    <HomeLiveSection connected={false} followedChannels={null} onLoginOpen={noop} text={homeI18n.ko} />
  );
  assert.match(html, /지금 방송 중/u);
  assert.match(html, /yoro-home-live-empty-tiger/u);
  assert.match(html, /지금은 방송 중인 스트리머가 없습니다/u);
  assert.match(html, /Twitch로 로그인하면/u);
  assert.match(html, /Twitch로 로그인/u);
});

test("지금 방송 중은 라이브 채널을 썸네일 카드(LIVE 배지·시청자 수)로 렌더한다", () => {
  const html = renderToStaticMarkup(
    <HomeLiveSection
      connected
      followedChannels={{
        connected: true,
        truncated: false,
        matchedCount: 1,
        subscriptionScopeGranted: false,
        subscriptions: [],
        channels: [{
          twitchUserId: "t1",
          twitchLogin: "tiger_live",
          twitchDisplayName: "새벽호랑이",
          followedAt: "2026-01-01T00:00:00Z",
          isLive: true,
          viewerCount: 1204,
          gameName: "League of Legends",
          thumbnailUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_tiger_live-{width}x{height}.jpg"
        }]
      }}
      onLoginOpen={noop}
      text={homeI18n.ko}
    />
  );
  assert.match(html, /yoro-home-live-badge/u);
  assert.match(html, /LIVE/u);
  assert.match(html, /1,204명 시청/u);
  assert.match(html, /새벽호랑이/u);
  assert.match(html, /yoro-home-live-thumb/u);
});

test("교배·봇·푸터는 실제 경로와 법적 표기를 한국어·일본어로 제공한다", () => {
  const ko = renderToStaticMarkup(
    <>
      <HomeBreedingSection text={homeI18n.ko} />
      <HomeBotSection text={homeI18n.ko} />
      <HomeFooter locale="ko" onLocale={noop} text={homeI18n.ko} />
    </>
  );
  assert.match(ko, /교배 조합, 바로 계산/u);
  assert.match(ko, /\/palworld\/breeding/u);
  assert.match(ko, /디스코드 서버 운영을 맡습니다/u);
  assert.match(ko, /\/bot/u);
  assert.match(ko, /Riot Games의 공식 파트너가 아니며/u);
  assert.match(ko, /Pocketpair, Inc\./u);
  assert.match(ko, /이용약관/u);
  assert.match(ko, /日本語/u);

  const ja = renderToStaticMarkup(
    <>
      <HomeBreedingSection text={homeI18n.ja} />
      <HomeFooter locale="ja" onLocale={noop} text={homeI18n.ja} />
    </>
  );
  assert.match(ja, /配合の組み合わせをすぐ計算/u);
  assert.match(ja, /Riot Gamesの公式パートナーではなく/u);
  assert.match(ja, /利用規約/u);
});

test("로그인 팝업은 노리개 표식·Twitch 계속하기·약관 고지를 갖추고 닫힌 상태에선 렌더하지 않는다", () => {
  const open = renderToStaticMarkup(
    <HomeLoginModal onClose={noop} onTwitchLogin={noop} open text={homeI18n.ko} />
  );
  assert.match(open, /role="dialog"/u);
  assert.match(open, /Twitch로 계속하기/u);
  assert.match(open, /이용약관과 개인정보처리방침에 동의/u);

  const closed = renderToStaticMarkup(
    <HomeLoginModal onClose={noop} onTwitchLogin={noop} open={false} text={homeI18n.ko} />
  );
  assert.equal(closed, "");
});

test("모바일 하단 탭바는 홈·게임·YORO Bot·로그인 4탭을 제공하고 홈이 활성이다", () => {
  const html = renderToStaticMarkup(
    <HomeBottomTabBar connected={false} onLoginOpen={noop} text={homeI18n.ko} />
  );
  assert.match(html, /yoro-home-tabbar/u);
  assert.match(html, /aria-current="page"/u);
  assert.match(html, /yoro-home-tabbar-tail/u);
  assert.match(html, />홈</u);
  assert.match(html, />게임</u);
  assert.match(html, />YORO Bot</u);
  assert.match(html, />로그인</u);
  /* 게임 패널은 접힌 상태에선 렌더되지 않습니다(탭 클릭 시 열림). */
  assert.doesNotMatch(html, /리그 오브 레전드/u);

  /* 로그인된 상태에선 4번째 탭이 대시보드로 바뀝니다. */
  const connected = renderToStaticMarkup(
    <HomeBottomTabBar connected onLoginOpen={noop} text={homeI18n.ko} />
  );
  assert.match(connected, />대시보드</u);
  assert.doesNotMatch(connected, />로그인</u);
});

test("홈 i18n 은 ko·ja·en 세 로케일에 같은 키를 제공한다", () => {
  const koKeys = Object.keys(homeI18n.ko).sort();
  assert.deepEqual(Object.keys(homeI18n.ja).sort(), koKeys);
  assert.deepEqual(Object.keys(homeI18n.en).sort(), koKeys);
});

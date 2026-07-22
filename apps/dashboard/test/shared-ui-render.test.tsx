import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChampionFilterSelect } from "../src/features/public-lol/components/ChampionFilterSelect";
import { PublicAppHeader } from "../src/features/public-lol/components/PublicAppHeader";
import { PublicHomeSearchPanel, type PublicHomeSearchPanelText } from "../src/features/public-lol/components/PublicHomeSearchPanel";
import { ProfileTopPanel } from "../src/features/public-lol/components/ProfileTopPanel";
import { RecentMatchRow } from "../src/features/public-lol/components/RecentMatchRow";
import { Button } from "../src/shared/ui/Button";
import { StatusPill } from "../src/shared/ui/Status";
import { PublicTwitchAccountChip } from "../src/shared/PublicTwitchAccountChip";

test("Shared Button loading 상태가 중복 클릭 방지와 접근성 속성을 함께 출력한다", () => {
  const html = renderToStaticMarkup(<Button loading loadingLabel="검색 중">검색</Button>);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /data-loading="true"/);
  assert.match(html, /검색 중/);
});

test("Shared Status가 tone과 size 계약을 마크업에 유지한다", () => {
  const html = renderToStaticMarkup(<StatusPill tone="live" size="sm">LIVE</StatusPill>);
  assert.match(html, /data-tone="live"/);
  assert.match(html, /data-size="sm"/);
  assert.match(html, />LIVE</);
});

test("공통 Twitch account chip이 프로필과 접근 가능한 메뉴 action을 렌더링한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountChip
      configured
      connected
      loginLabel="Twitch 로그인"
      loginTitle="Twitch 로그인이 필요합니다."
      logoutLabel="Twitch 로그아웃"
      menuActions={[{
        id: "dashboard",
        label: "대시보드 열기",
        onSelect: () => undefined,
        variant: "dashboard"
      }]}
      menuLabel="Twitch 프로필 메뉴"
      onLogin={() => undefined}
      onLogout={() => undefined}
      onOpenChange={() => undefined}
      open
      user={{
        login: "yorogg",
        displayName: "YORO",
        profileImageUrl: "https://example.com/avatar.png"
      }}
    />
  );

  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /role="menu" aria-label="Twitch 프로필 메뉴"/);
  assert.equal((html.match(/role="menuitem"/g) ?? []).length, 2);
  assert.match(html, /src="https:\/\/example\.com\/avatar\.png"/);
  assert.match(html, />YORO</);
  assert.match(html, /class="dashboard"/);
  assert.match(html, />Twitch 로그아웃</);
});

test("공통 Twitch account chip이 미로그인 상태에서 token 없이 로그인 동작만 노출한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountChip
      configured
      connected={false}
      loginLabel="Twitch ログイン"
      loginTitle="Twitch ログインが必要です。"
      logoutLabel="Twitch ログアウト"
      menuLabel="Twitch プロフィールメニュー"
      onLogin={() => undefined}
      onLogout={() => undefined}
      onOpenChange={() => undefined}
      open={false}
    />
  );

  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Twitch ログイン</);
  assert.doesNotMatch(html, /role="menu"/);
  assert.doesNotMatch(html, /Twitch ログアウト/);
});

test("LoL PublicAppHeader가 공통 Twitch account chip으로 기존 프로필을 표시한다", () => {
  const html = renderToStaticMarkup(
    <PublicAppHeader
      activePage="search"
      activeTarget="search"
      filterActive={false}
      locale="ko"
      onAutoLocale={() => undefined}
      onHome={() => undefined}
      onLocale={() => undefined}
      onPage={() => undefined}
      onStreamerDashboard={() => undefined}
      onStreamerRecord={() => undefined}
      onStreamerRegister={() => undefined}
      onTwitchLogin={() => undefined}
      onTwitchLogout={() => undefined}
      showFilters={false}
      showSearch={false}
      twitchStatus={{
        configured: true,
        connected: true,
        missingScopes: [],
        requiredScopes: ["user:read:follows", "user:read:subscriptions"],
        user: {
          id: "viewer-1",
          login: "yorogg",
          displayName: "YORO",
          profileImageUrl: "https://example.com/avatar.png"
        }
      }}
    />
  );

  assert.match(html, /public-twitch-login-chip connected/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /src="https:\/\/example\.com\/avatar\.png"/);
  assert.match(html, />YORO</);
  assert.match(html, /class="public-brand-mark public-brand-mobile-logo" src="\/images\/yorogg-home-logo\.webp" alt="" aria-hidden="true"/);
  assert.doesNotMatch(html, /src="\/images\/yorogg-mark\.png"/);
});

test("LoL 홈은 공통 LIVE rail로 기존 스트리머 카드와 전체 보기 동작을 유지한다", () => {
  const localized = (label: string) => ({ label, ko: label, ja: `JA ${label}` });
  const text: PublicHomeSearchPanelText = {
    eyebrow: localized("전적 검색"),
    title: localized("YORO.gg"),
    description: localized("소환사 검색"),
    loadingStatus: localized("불러오는 중"),
    readyStatus: localized("준비 완료"),
    errorTitle: localized("오류"),
    emptyTitle: localized("검색 결과 없음"),
    emptyDescription: localized("다시 검색하세요"),
    guideTitle: localized("검색 안내"),
    guideDescription: localized("Riot ID를 입력하세요"),
    liveTitle: localized("팔로우 중인 LIVE 스트리머"),
    liveViewAll: localized("전체 보기"),
    liveWatch: localized("방송 보기"),
    liveEmptyTitle: localized("LIVE 방송 없음"),
    liveEmptyDescription: localized("방송이 시작되면 표시됩니다"),
  };
  const html = renderToStaticMarkup(
    <PublicHomeSearchPanel
      error=""
      liveLoading={false}
      liveStreamers={[{
        id: "streamer-1",
        name: "LoL Streamer",
        primaryMeta: "League of Legends",
        avatarLabel: "L",
        channelUrl: "https://www.twitch.tv/lol_streamer",
        statusLabel: "LIVE",
      }]}
      loading={false}
      onShowStreamers={() => undefined}
      searchForm={<form aria-label="소환사 검색" />}
      showEmptyResult={false}
      text={text}
    />
  );

  assert.match(html, /data-testid="public-live-streamer-rail"/u);
  assert.match(html, /class="public-home-brand-logo-image" src="\/images\/yorogg-home-logo\.webp"/u);
  assert.match(html, /LoL Streamer/u);
  assert.match(html, /League of Legends/u);
  assert.match(html, /href="https:\/\/www\.twitch\.tv\/lol_streamer"/u);
  assert.match(html, /전체 보기/u);
});

test("챔피언 필터가 선택된 챔피언 이미지와 목록형 선택 접근성 정보를 출력한다", () => {
  const html = renderToStaticMarkup(
    <ChampionFilterSelect
      allLabel="모든 챔피언"
      label="챔피언 필터"
      labelJa="チャンピオンフィルター"
      labelKo="챔피언 필터"
      onChange={() => undefined}
      options={[{
        value: "266",
        label: "아트록스",
        iconUrl: "https://example.com/aatrox.png",
        fallbackLabel: "아"
      }]}
      value="266"
    />
  );

  assert.match(html, /aria-haspopup="listbox"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /src="https:\/\/example\.com\/aatrox\.png"/);
  assert.match(html, />아트록스</);
});

test("Profile 상단은 상세 정보를 접고 최근 경기 바로가기를 먼저 제공한다", () => {
  const html = renderToStaticMarkup(
    <ProfileTopPanel
      favoriteActionLabel="즐겨찾기"
      favoriteActive={false}
      favoriteAriaLabel="즐겨찾기 추가"
      fetchedAtText="방금 전"
      gameName="YORO"
      loading={false}
      metricStrip={<div id="metric-strip">상세 지표</div>}
      onRefresh={() => undefined}
      onToggleFavorite={() => undefined}
      primaryRankLabel="Platinum I"
      primaryRankTone="info"
      profileLinks={<div />}
      refreshButtonLabel="전적 갱신"
      refreshCooldownLabel=""
      refreshCoolingDown={false}
      refreshDisabled={false}
      refreshTitle="전적 갱신"
      searchForm={<div>검색</div>}
      seasonBadges={<div>시즌</div>}
      tagLine="JP1"
      text={{
        ranking: "랭킹",
        cachedRanking: { label: "캐시", ko: "캐시", ja: "キャッシュ" },
        liveDataNotice: { label: "실시간", ko: "실시간", ja: "リアルタイム" },
        profileLinksLabel: { label: "프로필 링크", ko: "프로필 링크", ja: "プロフィールリンク" },
        serverLabel: "JP",
        searching: "검색 중",
        showDetails: { label: "상세 보기", ko: "상세 보기", ja: "詳細を見る" },
        hideDetails: { label: "상세 접기", ko: "상세 접기", ja: "詳細を閉じる" },
        recentMatches: { label: "최근 경기", ko: "최근 경기", ja: "最近の試合" },
      }}
    />
  );

  assert.match(html, /details-collapsed/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /최근 경기/);
  assert.doesNotMatch(html, /id="metric-strip"/);
});

test("최근 전적 행이 모바일 카드에 필요한 다국어 정보와 로드아웃을 유지한다", () => {
  const html = renderToStaticMarkup(
    <RecentMatchRow
      aiScore={91}
      aiScoreText={{ label: "MVP", ko: "MVP", ja: "MVP" }}
      badges={<span>MVP</span>}
      championFallback="제"
      championIconUrl="https://example.com/champion.png"
      championName="제드"
      championRoleLevel="미드 · Lv.18"
      csLabel="CS 210"
      csPerMinuteMetric="7.8 CS/분"
      expanded={false}
      expandAriaLabel="경기 상세 펼치기"
      highlightClass="highlight-mvp"
      itemSlots={Array.from({ length: 6 }, (_, index) => ({ key: `item-${index}`, content: `아이템${index}` }))}
      itemsLabel="아이템"
      kdaMetric="Perfect"
      kdaScore={<><span>9</span><i>/</i><span className="deaths">0</span><i>/</i><span>6</span></>}
      killParticipationMetric="킬 관여 70%"
      onToggleExpand={() => undefined}
      queueLabel="솔로랭크"
      relativeLabel="13시간 전"
      result="win"
      resultDurationLabel="26:50"
      resultLabel="승리"
      scoreClassName="metric-tone-excellent"
      spellItems={Array.from({ length: 4 }, (_, index) => ({ key: `loadout-${index}`, content: `로드아웃${index}` }))}
      startedAtLabel="2026. 7. 14."
      summonerSpellsLabel="소환사 주문과 룬"
    />
  );

  assert.match(html, /public-match-row win highlight-mvp/);
  assert.match(html, /data-ko="MVP" data-ja="MVP"/);
  assert.equal((html.match(/로드아웃\d/g) ?? []).length, 4);
  assert.equal((html.match(/아이템\d/g) ?? []).length, 6);
  assert.match(html, /class="deaths">0/);
});

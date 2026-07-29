import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChampionFilterSelect } from "../src/features/public-lol/components/ChampionFilterSelect";
import { PublicAppHeader } from "../src/features/public-lol/components/PublicAppHeader";
import { PublicHomeSearchPanel, type PublicHomeSearchPanelText } from "../src/features/public-lol/components/PublicHomeSearchPanel";
import { PublicSiteFooter } from "../src/features/public-lol/components/PublicSiteFooter";
import { ProfileTopPanel } from "../src/features/public-lol/components/ProfileTopPanel";
import { RecentMatchRow } from "../src/features/public-lol/components/RecentMatchRow";
import { Button } from "../src/shared/ui/Button";
import { StatusPill } from "../src/shared/ui/Status";
import { PublicTwitchAccountChip, PublicTwitchAccountPanel } from "../src/shared/PublicTwitchAccountChip";
import { PublicMobileMenuSheet } from "../src/shared/PublicMobileMenuSheet";
import { PublicGameHeaderFrame } from "../src/shared/PublicGameChrome";
import { DISCORD_SYMBOL_ICON_SRC } from "../src/shared/DiscordSymbolIcon";
import { TWITCH_GLITCH_ICON_URL } from "../src/shared/TwitchGlitchIcon";

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

test("공개 footer의 법적 고지와 문의는 crawler와 키보드가 접근 가능한 링크다", () => {
  const localized = (label: string, ja: string) => ({ label, ko: label, ja });
  const html = renderToStaticMarkup(
    <PublicSiteFooter
      onPage={() => undefined}
      text={{
        privacy: localized("개인정보 처리 방침", "プライバシーポリシー"),
        terms: localized("이용약관", "利用規約"),
        contact: localized("문의", "お問い合わせ"),
        riotDisclaimer: localized("Riot Games 비공식 서비스", "Riot Games 非公式サービス"),
        copyright: localized("© YORO.gg", "© YORO.gg"),
      }}
    />
  );

  assert.match(html, /<a[^>]+href="\/privacy"[^>]*>개인정보 처리 방침<\/a>/u);
  assert.match(html, /<a[^>]+href="\/terms"[^>]*>이용약관<\/a>/u);
  assert.match(html, /<a[^>]+href="\/contact"[^>]*>문의<\/a>/u);
  assert.match(html, /data-ja="プライバシーポリシー"/u);
  assert.doesNotMatch(html, /<button/u);
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

test("공통 account chip이 미로그인 상태에서 Discord·Twitch 로그인 메뉴를 노출한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountChip
      configured
      connected={false}
      discordLoginLabel="Discord ログイン"
      loginLabel="ログイン"
      loginMenuLabel="ログイン方法"
      loginTitle="ログイン方法を選択"
      logoutLabel="Twitch ログアウト"
      menuLabel="Twitch プロフィールメニュー"
      onDiscordLogin={() => undefined}
      onLogin={() => undefined}
      onLogout={() => undefined}
      onOpenChange={() => undefined}
      open
      twitchLoginLabel="Twitch ログイン"
    />
  );

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, />ログイン</);
  assert.match(html, /role="menu" aria-label="ログイン方法"/);
  assert.equal((html.match(/role="menuitem"/g) ?? []).length, 2);
  assert.match(html, />Discord ログイン</);
  assert.match(html, new RegExp(`src="${DISCORD_SYMBOL_ICON_SRC}"`, "u"));
  assert.match(html, new RegExp(`src="${TWITCH_GLITCH_ICON_URL}"`, "u"));
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
  assert.match(html, /class="public-game-header__brand-logo" src="\/images\/yorogg-home-logo\.webp" alt="YORO\.gg"/);
  assert.doesNotMatch(html, /src="\/images\/yorogg-mark\.png"/);
  assert.match(html, /data-testid="lol-primary-nav"/u);
  assert.match(html, /홈[\s\S]*스트리머[\s\S]*참여[\s\S]*대회[\s\S]*커뮤니티/u);
  assert.match(html, /aria-current="page"[^>]*data-ko="홈"/u);
  assert.match(html, /data-ko="메뉴" data-ja="メニュー"/u);
  assert.match(html, /aria-haspopup="dialog"/u);
  assert.match(html, /aria-label="메뉴 열기"/u);
  assert.match(html, /aria-label="주 메뉴"/u);
});

test("모바일 통합 메뉴는 게임·언어·계정 로그인을 중첩 팝오버 없이 렌더링한다", () => {
  const html = renderToStaticMarkup(
    <PublicMobileMenuSheet
      activePage="search"
      id="test-mobile-menu"
      labels={{
        close: "메뉴 닫기",
        discordLogin: "Discord 로그인",
        game: "게임 선택",
        language: "언어",
        login: "로그인",
        loginLoading: "로그인 중…",
        logout: "로그아웃",
        title: "메뉴",
        twitch: "계정",
        twitchLogin: "Twitch 로그인",
        twitchUnavailable: "현재 Twitch 로그인을 사용할 수 없습니다.",
      }}
      locale="ko"
      onClose={() => undefined}
      onGamePage={() => undefined}
      onLocale={() => undefined}
      onDiscordLogin={() => undefined}
      onTwitchLogin={() => undefined}
      onTwitchLogout={() => undefined}
      open
      twitchConfigured={false}
      twitchConnected={false}
    />
  );

  assert.match(html, /data-sheet-state="opening"/u);
  assert.match(html, /<h3>게임 선택<\/h3>[\s\S]*<h3>언어<\/h3>[\s\S]*<h3>계정<\/h3>/u);
  assert.match(html, /role="listbox"/u);
  assert.match(html, /role="radiogroup"/u);
  assert.match(html, />Discord 로그인</u);
  assert.match(html, />Twitch 로그인</u);
  assert.match(html, /현재 Twitch 로그인을 사용할 수 없습니다/u);
  assert.doesNotMatch(html, /public-locale-popover/u);
  assert.doesNotMatch(html, /public-twitch-profile-menu/u);

  const css = readFileSync(
    new URL("../src/shared/ui/BottomSheet.css", import.meta.url),
    "utf8",
  );
  assert.match(
    css,
    /--public-bottom-sheet-open-duration:\s*[\s\S]*?var\(--yoro-motion-duration-slow\)[\s\S]*?var\(--yoro-motion-duration-instant\)/u,
  );
  assert.match(
    css,
    /\.public-bottom-sheet\[data-sheet-state="open"\] \.yoro-modal__dialog\s*\{[\s\S]*?transform:\s*translate3d\(0,\s*0,\s*0\)/u,
  );
  assert.doesNotMatch(
    css,
    /\.public-bottom-sheet\[data-sheet-state="open"\] \.public-bottom-sheet__surface/u,
  );
  assert.match(css, /overflow-anchor:\s*none/u);
});

test("모바일 Twitch inline 패널은 로그인 계정과 기존 action을 일반 버튼으로 제공한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountPanel
      configured
      connected
      loginLabel="Twitch 로그인"
      loginLoadingLabel="로그인 중…"
      logoutLabel="로그아웃"
      menuActions={[{
        id: "dashboard",
        label: "대시보드",
        onSelect: () => undefined,
        variant: "dashboard",
      }]}
      onLogin={() => undefined}
      onLogout={() => undefined}
      unavailableLabel="사용할 수 없습니다."
      user={{ displayName: "YORO", login: "yoro" }}
    />
  );

  assert.match(html, />YORO</u);
  assert.match(html, />@yoro</u);
  assert.match(html, new RegExp(`src="${TWITCH_GLITCH_ICON_URL}"`, "u"));
  assert.match(html, />대시보드</u);
  assert.match(html, />로그아웃</u);
  assert.doesNotMatch(html, /role="menu"/u);
});

test("공개 게임 Header frame은 1행 product·search·tools와 2행 navigation 구조를 유지한다", () => {
  const html = renderToStaticMarkup(
    <PublicGameHeaderFrame
      accountTools={<span>TOOLS</span>}
      brand={<span>BRAND</span>}
      gameSelector={<span>GAME</span>}
      mobileMenuToggle={<button type="button">MENU</button>}
      navigation={<nav>NAV</nav>}
      pageActions={<button type="button">FILTER</button>}
      search={<form>SEARCH</form>}
    />
  );

  assert.match(html, /public-game-header__primary-row[\s\S]*public-game-header__product[\s\S]*BRAND[\s\S]*GAME/u);
  assert.match(html, /public-game-header__primary-row[\s\S]*public-game-header__search-slot[\s\S]*SEARCH[\s\S]*FILTER[\s\S]*public-game-header__tools[\s\S]*TOOLS/u);
  assert.match(html, /public-game-header__secondary-row[\s\S]*public-game-header__nav-slot[\s\S]*NAV/u);
  assert.match(html, /data-search="true"/u);
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
      onPage={() => undefined}
      onShowStreamers={() => undefined}
      searchForm={<form aria-label="소환사 검색" />}
      showEmptyResult={false}
      text={text}
    />
  );

  assert.match(html, /data-testid="public-live-streamer-rail"/u);
  assert.match(html, /class="public-game-home__picture"/u);
  assert.match(html, /\/images\/public-home\/lol\/mobile\.[a-f0-9]{16}\.avif/u);
  assert.match(html, /public-game-home__eyebrow[\s\S]*전적 검색/u);
  assert.match(html, /<h1 id="public-lol-home-title"[\s\S]*YORO\.gg<\/h1>/u);
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

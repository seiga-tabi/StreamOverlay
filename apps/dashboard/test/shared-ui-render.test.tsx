import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChampionFilterSelect } from "../src/features/public-lol/components/ChampionFilterSelect";
import { PublicAppHeader } from "../src/features/public-lol/components/PublicAppHeader";
import { PublicHomeSearchPanel, type PublicHomeSearchPanelText } from "../src/features/public-lol/components/PublicHomeSearchPanel";
import { PublicSiteFooter } from "../src/features/public-lol/components/PublicSiteFooter";
import { ProfileMetricStrip } from "../src/features/public-lol/components/ProfileMetricStrip";
import { ProfileTopIdentity } from "../src/features/public-lol/components/ProfileTopIdentity";
import { ProfileTopPanel } from "../src/features/public-lol/components/ProfileTopPanel";
import { PublicProfileShareButton } from "../src/features/public-lol/components/PublicProfileShareButton";
import { MatchTeamCompare } from "../src/features/public-lol/components/MatchTeamCompare";
import { RecentMatchBuildRuneBoard } from "../src/features/public-lol/components/RecentMatchBuildRuneBoard";
import { RecentMatchRow } from "../src/features/public-lol/components/RecentMatchRow";
import { Button } from "../src/shared/ui/Button";
import { StatusPill } from "../src/shared/ui/Status";
import { PublicTwitchAccountChip, PublicTwitchAccountPanel } from "../src/shared/PublicTwitchAccountChip";
import { PublicMobileMenuSheet } from "../src/shared/PublicMobileMenuSheet";
import { PublicGameHeaderFrame } from "../src/shared/PublicGameChrome";
import { DISCORD_SYMBOL_ICON_SRC } from "../src/shared/DiscordSymbolIcon";
import { TWITCH_GLITCH_ICON_URL } from "../src/shared/TwitchGlitchIcon";
import { safeTwitchStreamPreviewUrl } from "../src/features/public-twitch/stream-preview";

test("Twitch 방송 미리보기는 공식 CDN의 16:9 썸네일만 허용한다", () => {
  assert.equal(
    safeTwitchStreamPreviewUrl("https://static-cdn.jtvnw.net/previews-ttv/live_user_yoro-{width}x{height}.jpg"),
    "https://static-cdn.jtvnw.net/previews-ttv/live_user_yoro-640x360.jpg"
  );
  assert.equal(
    safeTwitchStreamPreviewUrl("https://static-cdn.jtvnw.net/previews-ttv/live_user_yoro-%7Bwidth%7Dx%7Bheight%7D.jpg"),
    "https://static-cdn.jtvnw.net/previews-ttv/live_user_yoro-640x360.jpg"
  );
  assert.equal(safeTwitchStreamPreviewUrl("http://static-cdn.jtvnw.net/previews-ttv/live_user_yoro.jpg"), undefined);
  assert.equal(safeTwitchStreamPreviewUrl("https://evil.example/previews-ttv/live_user_yoro.jpg"), undefined);
  assert.equal(safeTwitchStreamPreviewUrl("https://static-cdn.jtvnw.net/jtv_user_pictures/avatar.png"), undefined);
});

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

  assert.match(html, /<a[^>]+href="\/ko\/privacy"[^>]*>개인정보 처리 방침<\/a>/u);
  assert.match(html, /<a[^>]+href="\/ko\/terms"[^>]*>이용약관<\/a>/u);
  assert.match(html, /<a[^>]+href="\/ko\/contact"[^>]*>문의<\/a>/u);
  assert.match(html, /data-ja="プライバシーポリシー"/u);
  assert.doesNotMatch(html, /<button/u);
});

test("공통 Twitch account chip이 프로필과 접근 가능한 메뉴 action을 렌더링한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountChip
      configured
      connected
      dashboardLabel="YORO Dashboard"
      dashboardLabelJa="YORO Dashboard"
      dashboardLabelKo="YORO Dashboard"
      loginLabel="Twitch 로그인"
      loginTitle="Twitch 로그인이 필요합니다."
      logoutLabel="Twitch 로그아웃"
      menuLabel="Twitch 프로필 메뉴"
      onDashboard={() => undefined}
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
  assert.match(html, /data-ko="YORO Dashboard" data-ja="YORO Dashboard"/u);
  assert.match(html, />Twitch 로그아웃</);
});

test("PC account chip은 Discord 인증 제공자와 표시명을 로그인 상태로 구분해 보여준다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountChip
      configured
      connected
      loginLabel="로그인"
      loginTitle="로그인이 필요합니다."
      logoutLabel="로그아웃"
      menuLabel="계정 메뉴"
      onLogin={() => undefined}
      onLogout={() => undefined}
      onOpenChange={() => undefined}
      open
      user={{
        displayName: "YORO Discord 사용자",
        profileImageUrl:
          "https://cdn.discordapp.com/avatars/987654321098765432/avatar.png?size=64",
        provider: "discord"
      }}
    />
  );

  assert.match(html, /public-twitch-login-chip connected/u);
  assert.match(html, />YORO Discord 사용자</u);
  assert.match(html, />Discord</u);
  assert.match(
    html,
    /src="https:\/\/cdn\.discordapp\.com\/avatars\/987654321098765432\/avatar\.png\?size=64"/u
  );
  assert.doesNotMatch(html, new RegExp(`src="${DISCORD_SYMBOL_ICON_SRC}"`, "u"));
  assert.doesNotMatch(html, new RegExp(`src="${TWITCH_GLITCH_ICON_URL}"`, "u"));
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
  assert.match(html, /홈[\s\S]*스트리머[\s\S]*참여[\s\S]*칼바람[\s\S]*커뮤니티/u);
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
        dashboard: "YORO Dashboard",
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
      onDashboard={() => undefined}
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
  assert.match(
    css,
    /z-index:\s*calc\([\s\S]*?var\(--yoro-z-toast\)[\s\S]*?var\(--yoro-z-toast\)[\s\S]*?var\(--yoro-z-dropdown\)[\s\S]*?\)/u,
  );
  assert.match(css, /isolation:\s*isolate/u);
  assert.doesNotMatch(
    css,
    /\.public-bottom-sheet\[data-sheet-state="open"\] \.public-bottom-sheet__surface/u,
  );
  assert.match(css, /overflow-anchor:\s*none/u);
});

test("모바일 통합 메뉴는 YORO 계정의 Twitch 로그인 상태를 표시한다", () => {
  const html = renderToStaticMarkup(
    <PublicMobileMenuSheet
      accountConnected
      accountUser={{
        displayName: "YORO Twitch 사용자",
        provider: "twitch"
      }}
      activePage="search"
      id="test-mobile-account-menu"
      labels={{
        close: "메뉴 닫기",
        dashboard: "YORO Dashboard",
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
      onAccountLogout={() => undefined}
      onClose={() => undefined}
      onDiscordLogin={() => undefined}
      onDashboard={() => undefined}
      onGamePage={() => undefined}
      onLocale={() => undefined}
      onTwitchLogin={() => undefined}
      onTwitchLogout={() => undefined}
      open
      twitchConfigured
      twitchConnected={false}
    />
  );

  assert.match(html, />YORO Twitch 사용자</u);
  assert.match(html, />Twitch</u);
  assert.match(html, />YORO Dashboard</u);
  assert.match(html, new RegExp(`src="${TWITCH_GLITCH_ICON_URL}"`, "u"));
  assert.match(html, />로그아웃</u);
  assert.doesNotMatch(html, />Discord 로그인</u);
});

test("모바일 Twitch inline 패널은 로그인 계정과 기존 action을 일반 버튼으로 제공한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountPanel
      configured
      connected
      dashboardLabel="YORO Dashboard"
      loginLabel="Twitch 로그인"
      loginLoadingLabel="로그인 중…"
      logoutLabel="로그아웃"
      onDashboard={() => undefined}
      onLogin={() => undefined}
      onLogout={() => undefined}
      unavailableLabel="사용할 수 없습니다."
      user={{ displayName: "YORO", login: "yoro" }}
    />
  );

  assert.match(html, />YORO</u);
  assert.match(html, />@yoro</u);
  assert.match(html, new RegExp(`src="${TWITCH_GLITCH_ICON_URL}"`, "u"));
  assert.match(html, />YORO Dashboard</u);
  assert.match(html, />로그아웃</u);
  assert.doesNotMatch(html, /role="menu"/u);
});

test("모바일 계정 패널은 Twitch를 대표 프로필로 두고 연결된 provider 아이콘을 함께 표시한다", () => {
  const html = renderToStaticMarkup(
    <PublicTwitchAccountPanel
      configured
      connected
      dashboardLabel="YORO Dashboard"
      loginLabel="로그인"
      loginLoadingLabel="로그인 중…"
      logoutLabel="로그아웃"
      onDashboard={() => undefined}
      onLogin={() => undefined}
      onLogout={() => undefined}
      unavailableLabel="사용할 수 없습니다."
      user={{
        displayName: "Twitch 사용자",
        linkedProviders: ["discord", "twitch"],
        profileImageUrl: "https://static-cdn.jtvnw.net/avatar.png",
        provider: "twitch"
      }}
    />
  );

  assert.match(html, />Twitch 사용자</u);
  assert.match(html, /aria-label="twitch, discord"/u);
  assert.match(
    html,
    new RegExp(
      `public-twitch-account-panel__providers[\\s\\S]*src="${TWITCH_GLITCH_ICON_URL}"[\\s\\S]*src="${DISCORD_SYMBOL_ICON_SRC}"`,
      "u"
    )
  );
  assert.match(html, /src="https:\/\/static-cdn\.jtvnw\.net\/avatar\.png"/u);
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
    guideTitle: localized("검색 안내"),
    guideDescription: localized("Riot ID를 입력하세요"),
    liveTitle: localized("팔로우 중인 LIVE 스트리머"),
    livePrevious: localized("이전 LIVE 스트리머"),
    liveNext: localized("다음 LIVE 스트리머"),
    liveViewAll: localized("전체 보기"),
    liveWatch: localized("방송 보기"),
    liveEmptyTitle: localized("LIVE 방송 없음"),
    liveEmptyDescription: localized("방송이 시작되면 표시됩니다"),
    primaryFeaturesTitle: localized("YORO.gg에서 참여해보세요"),
    participationTitle: localized("커뮤니티 참여"),
    participationDescription: localized("참여 방송을 확인하세요"),
    aramTitle: localized("증강 칼바람"),
    aramDescription: localized("증강 데이터를 확인하세요"),
    communityTitle: localized("커뮤니티"),
    communityDescription: localized("함께 플레이할 팀을 찾으세요"),
    additionalFeaturesTitle: localized("더 둘러보기"),
    streamerTitle: localized("스트리머"),
    streamerDescription: localized("등록된 스트리머를 확인하세요"),
  };
  const html = renderToStaticMarkup(
    <PublicHomeSearchPanel
      liveLoading={false}
      liveStreamers={[{
        id: "streamer-1",
        name: "LoL Streamer",
        primaryMeta: "League of Legends",
        avatarLabel: "L",
        previewLabel: "LoL Streamer 방송 미리보기",
        previewUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_lol_streamer-640x360.jpg",
        channelUrl: "https://www.twitch.tv/lol_streamer",
        statusLabel: "LIVE",
      }]}
      loading={false}
      onPage={() => undefined}
      onShowStreamers={() => undefined}
      searchForm={<form aria-label="소환사 검색" />}
      text={text}
    />
  );

  assert.match(html, /data-testid="public-live-streamer-rail"/u);
  assert.match(html, /public-game-home__hero-grid public-game-home__hero-grid--centered/u);
  assert.match(html, /public-game-home__live-strip/u);
  assert.match(html, /class="public-game-home__picture"/u);
  assert.match(html, /\/images\/public-home\/lol\/mobile\.[a-f0-9]{16}\.avif/u);
  assert.match(html, /public-game-home__eyebrow[\s\S]*전적 검색/u);
  assert.match(html, /<h1 id="public-lol-home-title"[\s\S]*YORO\.gg<\/h1>/u);
  assert.match(html, /LoL Streamer/u);
  assert.match(html, /public-home-live-card--preview/u);
  assert.match(html, /alt="LoL Streamer 방송 미리보기"/u);
  assert.match(html, /live_user_lol_streamer-640x360\.jpg/u);
  assert.match(html, /League of Legends/u);
  assert.match(html, /href="https:\/\/www\.twitch\.tv\/lol_streamer"/u);
  assert.match(html, /전체 보기/u);
  assert.doesNotMatch(html, /검색 실패|표시할 데이터가 없습니다/u);
  const homeCss = readFileSync(
    new URL("../src/styles/shared/public-game-home.css", import.meta.url),
    "utf8",
  );
  assert.match(homeCss, /\.public-game-home__live-strip \.public-home-live-rail\s*\{[\s\S]*?grid-auto-columns:\s*17\.5rem/u);
  assert.match(homeCss, /\.public-game-home__live-strip \.public-home-live-card\s*\{[\s\S]*?grid-template-rows:\s*repeat\(6,\s*auto\)/u);
  assert.match(homeCss, /\.public-game-home__live-strip \.public-home-live-card\s*\{[\s\S]*?aspect-ratio:\s*auto/u);
  assert.match(homeCss, /\.public-game-home__live-strip \.public-home-live-card\s*\{[\s\S]*?gap:\s*var\(--yoro-space-3\)/u);
  assert.match(homeCss, /\.public-game-home__live-strip \.public-home-live-card > \.public-home-live-action\s*\{[\s\S]*?margin:\s*0/u);
  assert.match(homeCss, /\.public-game-home__live-strip \.public-home-live-pill\.yoro-status\s*\{[\s\S]*?position:\s*static;[\s\S]*?grid-row:\s*1/u);
  assert.match(homeCss, /\.public-game-home__hero:has\(\.public-suggestion-panel\),\s*\.public-game-home__hero:has\(\.palworld-autocomplete\)\s*\{[\s\S]*?z-index:\s*var\(--yoro-z-dropdown\)/u);
  assert.match(homeCss, /@media \(max-width:\s*72rem\)\s*\{[\s\S]*?\.public-game-home__hero-grid:not\(\.public-game-home__hero-grid--centered\)/u);
  assert.ok(
    html.indexOf("public-game-home__hero") < html.indexOf("public-game-home__live-strip")
      && html.indexOf("public-game-home__live-strip") < html.indexOf("YORO.gg에서 참여해보세요")
  );
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

test("Profile 상단은 중복 검색을 제거하고 스트리머 CTA 우선순위를 유지한다", () => {
  const html = renderToStaticMarkup(
    <ProfileTopPanel
      favoriteActionLabel="즐겨찾기"
      favoriteActive={false}
      favoriteAriaLabel="즐겨찾기 추가"
      fetchedAtText="방금 전"
      gameName="YORO"
      loading={false}
      onOpenParticipation={() => undefined}
      onRefresh={() => undefined}
      onToggleFavorite={() => undefined}
      primaryRankLabel="Platinum I"
      primaryRankTone="info"
      profileIconUrl="https://static-cdn.jtvnw.net/jtv_user_pictures/yoro-profile_image.png"
      profileLinks={<div />}
      refreshButtonLabel="전적 갱신"
      refreshCooldownLabel=""
      refreshCoolingDown={false}
      refreshDisabled={false}
      refreshTitle="전적 갱신"
      seasonBadges={<div>시즌</div>}
      shareAction={(
        <PublicProfileShareButton
          copiedLabel="링크를 복사했습니다."
          copyFailedLabel="링크를 복사하지 못했습니다."
          label="전적 공유"
          text="YORO.gg에서 전적을 확인하세요."
          title="YORO#JP1 전적 | YORO.gg"
          url="https://yoro.gg/ko/lol/summoners/jp/YORO-JP1"
        />
      )}
      streamerSpotlight={{
        isLive: true,
        eyebrow: "스트리머 전적",
        displayName: "YORO Live",
        statusLabel: "LIVE NOW",
        title: "랭크 방송 중",
        viewerLabel: "125 시청자",
        channelUrl: "https://www.twitch.tv/yoro",
        channelActionLabel: "Twitch에서 보기",
        participationActionLabel: "참여 신청",
        supportingLinks: [{
          id: "discord",
          label: "Discord",
          url: "https://discord.gg/yoro",
          platform: "discord",
        }],
        metrics: [
          { id: "game", label: "현재 게임", value: "League of Legends", tone: "live" },
          { id: "rank", label: "솔로 랭크", value: "Platinum I", tone: "accent" },
          { id: "viewers", label: "시청자", value: "125", tone: "live" },
          { id: "participation", label: "참여", value: "참여 대기열 열림", tone: "live" }
        ]
      }}
      tagLine="JP1"
      text={{
        profileLinksLabel: { label: "프로필 링크", ko: "프로필 링크", ja: "プロフィールリンク" },
        searching: "검색 중",
        recentMatches: { label: "최근 경기", ko: "최근 경기", ja: "最近の試合" },
      }}
    />
  );

  assert.match(html, /최근 경기/);
  assert.match(html, /public-profile-streamer-spotlight is-live/u);
  assert.match(html, /public-profile-platform-hero has-streamer/u);
  assert.match(html, /public-avatar square is-streamer is-live/u);
  assert.match(html, /<span class="sr-only">LIVE NOW<\/span>/u);
  assert.match(html, /href="https:\/\/www\.twitch\.tv\/yoro"/u);
  assert.match(html, /href="https:\/\/discord\.gg\/yoro"/u);
  assert.match(html, />참여 신청</u);
  assert.ok(html.indexOf("참여 신청") < html.indexOf("Twitch에서 보기"));
  assert.doesNotMatch(html, /public-ranking-shared-toolbar/u);
  assert.match(html, /public-profile-streamer-spotlight__metrics/u);
  assert.match(html, />League of Legends</u);
  assert.match(html, />전적 공유</u);
  assert.match(html, /data-share-url="https:\/\/yoro\.gg\/ko\/lol\/summoners\/jp\/YORO-JP1"/u);
  assert.doesNotMatch(html, /token=|\?/u);
  assert.match(html, />Platinum I</u);
  assert.match(html, />참여 대기열 열림</u);
  assert.doesNotMatch(html, /public-profile-rank-summary|public-profile-details-toggle/u);
});

test("Profile 티어 영역은 솔로·자유·5v5 랭크만 독립적으로 렌더링한다", () => {
  const html = renderToStaticMarkup(
    <ProfileMetricStrip
      ariaLabel="랭크 티어"
      cards={[
        { key: "solo", tone: "blue", icon: "S", title: "솔로랭크", value: "Platinum II 99 LP", valueTone: "good", detail: "37게임", rank: "승률 51%", statusTone: "success" },
        { key: "flex", tone: "green", icon: "F", title: "자유랭크", value: "Emerald III 32 LP", valueTone: "good", detail: "10게임", rank: "승률 50%", statusTone: "success" },
        { key: "ranked-5v5", tone: "purple", icon: "5", title: "5v5 랭크", value: "언랭크", valueTone: "neutral", detail: "표시할 데이터가 없습니다.", statusTone: "neutral" },
      ]}
    />
  );

  assert.match(html, /aria-label="랭크 티어"/u);
  assert.match(html, />솔로랭크</u);
  assert.match(html, />자유랭크</u);
  assert.match(html, />5v5 랭크</u);
  assert.equal((html.match(/public-profile-metric-card/g) ?? []).length, 3);
});

test("모바일 전적 필터는 상단에 고정되지 않고 문서 흐름을 따른다", () => {
  const profileCss = readFileSync(
    new URL("../src/styles/pages/public-lol/20-profile-platform.css", import.meta.url),
    "utf8",
  );
  assert.match(
    profileCss,
    /@media \(max-width:\s*48rem\)[\s\S]*?\.public-profile-platform-v2 \.public-match-filter-bar\s*\{[\s\S]*?position:\s*static;[\s\S]*?z-index:\s*auto;[\s\S]*?top:\s*auto;/u,
  );
});

test("스트리머 프로필 이미지는 방송 상태를 테두리 class와 접근성 문구로 구분한다", () => {
  const renderIdentity = (streamerStatus: "live" | "offline", streamerStatusLabel: string) => renderToStaticMarkup(
    <ProfileTopIdentity
      identity={{
        avatarFallbackLabel: "Y",
        fetchedAtText: "방금 전",
        gameName: "YORO",
        primaryRankLabel: "Platinum I",
        primaryRankTone: "info",
        profileIconUrl: "https://static-cdn.jtvnw.net/jtv_user_pictures/yoro-profile_image.png",
        streamerStatus,
        streamerStatusLabel,
        tagLine: "JP1",
      }}
      renderActions={() => <div />}
      renderSeasonBadges={() => null}
    />
  );

  const liveHtml = renderIdentity("live", "방송 중");
  const offlineHtml = renderIdentity("offline", "오프라인");
  assert.match(liveHtml, /public-avatar square is-streamer is-live/u);
  assert.match(liveHtml, /<span class="sr-only">방송 중<\/span>/u);
  assert.match(offlineHtml, /public-avatar square is-streamer is-offline/u);
  assert.match(offlineHtml, /<span class="sr-only">오프라인<\/span>/u);
});

test("최근 전적 행이 모바일 카드에 필요한 다국어 정보와 로드아웃을 유지한다", () => {
  const html = renderToStaticMarkup(
    <RecentMatchRow
      aiScore={91}
      aiScoreText={{ label: "점수", ko: "점수", ja: "スコア" }}
      scoreDescription={{ label: "YORO 경기 점수 설명", ko: "YORO 경기 점수 설명", ja: "YORO試合スコアの説明" }}
      badges={<span>MVP</span>}
      championFallback="제"
      championIconUrl="https://example.com/champion.png"
      championName="제드"
      championRoleLevel="미드 · Lv.18"
      expanded={false}
      expandAriaLabel="경기 상세 펼치기"
      highlightClass="highlight-mvp"
      itemSlots={Array.from({ length: 7 }, (_, index) => ({ key: `item-${index}`, label: `아이템 ${index + 1}`, focusable: true, content: `아이템${index}` }))}
      itemsLabel="아이템"
      kdaMetric="Perfect"
      kdaScore={<><span>9</span><i>/</i><span className="deaths">0</span><i>/</i><span>6</span></>}
      matchAriaLabel="승리 · 제드 · 9/0/6"
      metrics={[
        { key: "kill-participation", label: "킬 관여율", value: "70%" },
        { key: "cs", label: "CS", value: "210" },
        { key: "cs-per-minute", label: "분당 CS", value: "7.8" },
        { key: "average-tier", label: "평균 티어", value: "Platinum II" }
      ]}
      onToggleExpand={() => undefined}
      queueLabel="솔로랭크"
      result="win"
      resultDurationLabel="26:50"
      resultLabel="승리"
      scoreAriaLabel="점수 91"
      scoreClassName="metric-tone-excellent"
      spellItems={Array.from({ length: 4 }, (_, index) => ({
        key: `loadout-${index}`,
        className: index < 2 ? "spell" : "rune",
        content: `로드아웃${index}`
      }))}
      startedAtLabel="2026. 7. 14."
      startedAtTimeLabel="오후 1:20"
      summonerSpellsLabel="소환사 주문과 룬"
    />
  );

  assert.match(html, /public-match-row win highlight-mvp/);
  assert.match(html, /data-ko="점수" data-ja="スコア"/u);
  assert.equal((html.match(/로드아웃\d/g) ?? []).length, 4);
  assert.match(html, /public-match-loadout-column spells/u);
  assert.match(html, /public-match-loadout-column runes/u);
  assert.equal((html.match(/아이템\d/g) ?? []).length, 7);
  const championCellStart = html.indexOf("public-champion-cell");
  const itemRowStart = html.indexOf("public-match-inline-items");
  const kdaStart = html.indexOf("public-kda");
  const statsStart = html.indexOf("public-match-meta");
  const timeStart = html.indexOf("public-match-time");
  assert.ok(championCellStart >= 0 && kdaStart > championCellStart && itemRowStart > kdaStart);
  assert.ok(statsStart > itemRowStart && timeStart > statsStart);
  assert.match(html, /아이템0.*아이템1.*아이템2.*아이템3.*아이템4.*아이템5.*아이템6/u);
  assert.match(html, /title="아이템 1"/u);
  assert.match(html, /tabindex="0" title="아이템 1"/u);
  assert.match(html, /class="deaths">0/);
  assert.doesNotMatch(html, /public-match-featured-label/u);
  assert.match(html, /public-kda-summary/u);
  assert.doesNotMatch(html, /public-match-score-stars/u);
  assert.match(html, /<strong>70%<\/strong><small>킬 관여율<\/small>.*<strong>210<\/strong><small>CS<\/small>.*<strong>7\.8<\/strong><small>분당 CS<\/small>.*<strong>Platinum II<\/strong><small>평균 티어<\/small>/u);
  assert.match(html, /public-match-expand-label" role="tooltip">경기 상세 펼치기/u);
  assert.match(html, /aria-label="승리 · 제드 · 9\/0\/6"/u);
  assert.equal((html.match(/aria-label="점수 91"/gu) ?? []).length, 1);
  assert.match(html, /class="public-match-score metric-tone-excellent" data-grade="S\+"[^>]*><b>S\+<\/b><strong>91<\/strong>/u);
  assert.match(html, /public-match-score-description.*YORO 경기 점수 설명/u);
});

test("전적 상세 룬 보드는 읽기 전용 이미지의 선택과 드래그를 막는다", () => {
  const html = renderToStaticMarkup(
    <RecentMatchBuildRuneBoard
      label={{ label: "룬", ko: "룬", ja: "ルーン" }}
      noDataLabel="룬 정보 없음"
      runeColumns={[{
        key: "primary",
        className: "public-match-rune-column primary",
        titleClassName: "public-match-rune-title",
        title: "지배",
        titleIcon: {
          className: "public-match-rune-style selected",
          title: "지배",
          iconUrl: "https://example.com/domination.png",
          fallbackLabel: "지"
        },
        rows: [{
          key: "keystone",
          className: "public-match-rune-row",
          slots: [{
            key: "electrocute",
            className: "selected",
            title: "감전",
            iconUrl: "https://example.com/electrocute.png",
            fallbackLabel: "감"
          }]
        }]
      }]}
    />
  );

  assert.equal((html.match(/draggable="false"/g) ?? []).length, 2);
});

test("경기 상세 팀 비교는 피해량·시야·골드·오브젝트를 전환 탭으로 제공한다", () => {
  const team = (side: "left" | "right", label: string) => ({
    side,
    label,
    resultSummary: "승리 · 20/10/30",
    objectivesAriaLabel: `${label} 오브젝트`,
    objectives: [{
      key: `${side}:dragon`,
      className: "public-team-compare-objective dragon",
      title: "드래곤",
      shortLabel: "용",
      value: 3
    }]
  });
  const metric = (key: string, label: string) => ({
    key,
    label,
    leftValueLabel: "40,000",
    rightValueLabel: "35,000",
    leftWidth: 54,
    rightWidth: 46
  });
  const html = renderToStaticMarkup(
    <MatchTeamCompare
      viewModel={{
        ariaLabel: "팀 상세",
        tabsLabel: "팀 지표 선택",
        objectivesLabel: "오브젝트",
        leftTeam: team("left", "상대 팀"),
        rightTeam: team("right", "아군 팀"),
        metrics: [metric("damage", "피해량"), metric("vision", "시야"), metric("gold", "골드")]
      }}
    />
  );

  assert.match(html, /role="tablist" aria-label="팀 지표 선택"/u);
  assert.equal((html.match(/role="tab"/gu) ?? []).length, 4);
  assert.match(html, /aria-selected="true"[^>]*>피해량</u);
});

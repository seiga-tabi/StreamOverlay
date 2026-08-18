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
import {
  ProfileLpRecordCard,
  ProfileMetricProfileCard,
  ProfileRoleCard,
} from "../src/features/public-lol/components/ProfileSidebarCards";
import { ProfileTopIdentity } from "../src/features/public-lol/components/ProfileTopIdentity";
import { ProfileStreamerCast } from "../src/features/public-lol/components/ProfileStreamerCast";
import { ProfileTopPanel } from "../src/features/public-lol/components/ProfileTopPanel";
import { PublicProfileShareButton } from "../src/features/public-lol/components/PublicProfileShareButton";
import { MatchTeamCompare } from "../src/features/public-lol/components/MatchTeamCompare";
import { RecentMatchBuildRuneBoard } from "../src/features/public-lol/components/RecentMatchBuildRuneBoard";
import { RecentMatchRow } from "../src/features/public-lol/components/RecentMatchRow";
import { ProfileShareActions } from "../src/features/public-lol/components/ProfileShareActions";
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
  /* 커뮤니티가 있던 자리를 패치 노트가 이어받았습니다. */
  assert.match(html, /홈[\s\S]*스트리머[\s\S]*참여[\s\S]*칼바람[\s\S]*패치 노트/u);
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
  assert.doesNotMatch(html, /public-game-home__eyebrow/u);
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
  assert.match(homeCss, /@media \(max-width:\s*64rem\)\s*\{[\s\S]*?\.public-game-home__hero-grid:not\(\.public-game-home__hero-grid--centered\)/u);
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
      profileIconUrl="https://static-cdn.jtvnw.net/jtv_user_pictures/yoro-profile_image.png"
      profileLinks={<div />}
      refreshButtonLabel="전적 갱신"
      refreshCooldownLabel=""
      refreshCoolingDown={false}
      refreshDisabled={false}
      refreshTitle="전적 갱신"
      channelAriaLabel="YORO Live · Twitch에서 보기"
      channelName="YORO Live"
      channelUrl="https://www.twitch.tv/yoro"
      liveStatus={{ isLive: true, label: "LIVE · 125" }}
      seasonBadges={<div>시즌</div>}
      streamerCast={(
        <ProfileStreamerCast
          channelUrl="https://www.twitch.tv/yoro"
          gameName="League of Legends"
          isInGame
          isLive
          links={[{ id: "discord", url: "https://discord.gg/yoro", label: "Discord", platform: "discord" }]}
          onOpenParticipation={() => undefined}
          participationOpen
          previewUrl="https://static-cdn.jtvnw.net/previews-ttv/live_user_yoro-640x360.jpg"
          renderLinkIcon={(link) => <a href={link.url}>{link.label}</a>}
          text={{
            ingameLabel: "인게임",
            ingameNotice: "지금 랭크 게임 중입니다",
            liveBadge: "LIVE",
            liveHeading: "방송 중",
            offlineHeading: "최근 방송",
            offlineLabel: "현재 오프라인",
            participationLabel: "참여 신청",
            thumbnailLabel: "방송 미리보기",
            watchAriaLabel: "Twitch에서 보기",
            watchLabel: "Twitch",
          }}
          title="랭크 방송 중"
          uptimeLabel="1시간 30분째"
          viewersLabel="125명 시청"
        />
      )}
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

  // 방송 카드는 새 행이 아니라 랭크와 같은 행(body)에 놓입니다.
  assert.match(html, /public-profile-hero has-streamer is-live/u);
  assert.match(html, /public-profile-hero-body has-cast/u);
  assert.match(html, /public-profile-hero-avatar is-streamer is-live/u);
  assert.match(html, /<span class="yoro-u-sr-only">LIVE NOW<\/span>/u);
  // 소환사 신원과 Twitch 채널이 같은 줄에서 이어집니다.
  assert.match(html, /public-profile-hero-name[\s\S]*public-profile-hero-channel[^>]*href="https:\/\/www\.twitch\.tv\/yoro"[\s\S]*>YORO Live</u);
  // LIVE 는 색 단독이 아니라 문자와 시청자 수로도 전달합니다.
  assert.match(html, /public-profile-hero-live-pill[^>]*>[\s\S]*LIVE · 125/u);
  assert.match(html, /href="https:\/\/discord\.gg\/yoro"/u);
  assert.match(html, />참여 신청</u);
  // 참여가 열려 있으면 참여가 주 버튼이고 Twitch 가 그 뒤에 옵니다.
  assert.ok(html.indexOf("참여 신청") < html.indexOf(">Twitch<"));
  assert.match(html, /public-profile-hero-cast-action is-primary[^>]*>참여 신청</u);
  // Twitch 버튼 라벨은 좁은 폭에서 넘치지 않도록 짧게 두고 설명은 aria-label 로 보냅니다.
  assert.match(html, /aria-label="Twitch에서 보기"[^>]*class="public-profile-hero-cast-action is-twitch"/u);
  assert.doesNotMatch(html, />Twitch에서 보기</u);
  // 썸네일은 안전 검증을 통과한 공식 CDN URL 만 들어옵니다.
  assert.match(html, /src="https:\/\/static-cdn\.jtvnw\.net\/previews-ttv\/live_user_yoro-640x360\.jpg"/u);
  assert.match(html, /public-profile-hero-cast-thumb[\s\S]*<i aria-hidden="true">LIVE<\/i>/u);
  // 인게임은 방송 카드 안에서만 한 줄로 추가됩니다.
  assert.match(html, /public-profile-hero-cast-ingame[\s\S]*지금 랭크 게임 중입니다/u);
  assert.doesNotMatch(html, /public-ranking-shared-toolbar/u);
  assert.doesNotMatch(html, /public-profile-streamer-spotlight/u);
  assert.match(html, />League of Legends</u);
  assert.match(html, />전적 공유</u);
  assert.match(html, /data-share-url="https:\/\/yoro\.gg\/ko\/lol\/summoners\/jp\/YORO-JP1"/u);
  assert.doesNotMatch(html, /token=|\?/u);
  // 티어는 히어로 신원이 아니라 rankSection 이 소유합니다(프로필·티어 테스트에서 검증).
  // 참여 상태는 메트릭 박스가 아니라 버튼의 라벨과 우선순위로 전달합니다(위에서 검증).
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
  assert.match(liveHtml, /public-profile-hero-avatar is-streamer is-live/u);
  assert.match(liveHtml, /<span class="yoro-u-sr-only">방송 중<\/span>/u);
  assert.match(offlineHtml, /public-profile-hero-avatar is-streamer is-offline/u);
  assert.match(offlineHtml, /<span class="yoro-u-sr-only">오프라인<\/span>/u);
});

test("최근 전적 행이 모바일 카드에 필요한 다국어 정보와 로드아웃을 유지한다", () => {
  const html = renderToStaticMarkup(
    <RecentMatchRow
      scoreDescription={{ label: "YORO 경기 점수 설명", ko: "YORO 경기 점수 설명", ja: "YORO試合スコアの説明" }}
      championFallback="제"
      championIconUrl="https://example.com/champion.png"
      championName="제드"
      championLevelLabel="18"
      championRoleLabel="미드"
      expanded={false}
      expandAriaLabel="경기 상세 펼치기"
      highlightClass="highlight-mvp"
      itemSlots={Array.from({ length: 6 }, (_, index) => ({ key: `item-${index}`, label: `아이템 ${index + 1}`, focusable: true, content: `아이템${index}` }))}
      itemsLabel="아이템"
      teams={{
        allies: Array.from({ length: 5 }, (_, index) => ({ key: `ally-${index}`, label: `아군${index}`, isTarget: index === 0, content: `아군${index}` })),
        opponents: Array.from({ length: 5 }, (_, index) => ({ key: `foe-${index}`, label: `상대${index}`, content: `상대${index}` })),
        compositionLabel: "참가 챔피언",
        alliesLabel: "아군",
        opponentsLabel: "상대"
      }}
      trinketSlot={{ key: "trinket", label: "장신구", content: "장신구0" }}
      kdaMetric="Perfect"
      kdaScore={<><span>9</span><i>/</i><span className="deaths">0</span><i>/</i><span>6</span></>}
      matchAriaLabel="승리 · 제드 · 9/0/6"
      metrics={[
        { key: "kill-participation", label: "킬 관여율", ratio: 70, value: "70%" },
        { key: "cs", label: "CS", labelSuffix: " · 7.8/분", value: "210" },
        { key: "damage-share", label: "피해 점유", ratio: 24, value: "24%" }
      ]}
      onToggleExpand={() => undefined}
      queueLabel="솔로랭크"
      result="win"
      resultDurationLabel="26:50"
      resultLabel="승리"
      resultShortLabel="승"
      scoreAriaLabel="종합 등급 S+"
      scoreClassName="metric-tone-excellent"
      scoreGrade="S+"
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

  assert.match(html, /public-match-card win highlight-mvp/u);
  // 승패는 색 단독이 아니라 문자 배지로도 전달합니다.
  assert.match(html, /class="public-match-card-result win"[^>]*>승</u);
  assert.match(html, /class="yoro-u-sr-only">승리</u);
  // 상대 시각과 게임 길이만 노출하고 절대 시각은 title 로 보냅니다.
  assert.match(html, /title="오후 1:20 · 26:50"[\s\S]*2026\. 7\. 14\.[\s\S]*26:50/u);
  // MVP·ACE 는 챔피언 이름 줄에 놓입니다.
  assert.match(html, /public-match-card-copy[\s\S]*public-match-card-highlight mvp[^>]*>MVP</u);
  assert.equal((html.match(/로드아웃\d/g) ?? []).length, 4);
  assert.match(html, /public-match-card-loadout-column spells/u);
  assert.match(html, /public-match-card-loadout-column runes/u);
  // 장비 6칸과 장신구 1칸을 분리합니다.
  assert.equal((html.match(/아이템\d/g) ?? []).length, 6);
  assert.match(html, /class="public-match-card-trinket [^"]*"[^>]*>장신구0</u);

  // 시선 순서: 결과 → 챔피언 → 성과 → 지표 → 아이템 → 팀 구성 → 확장
  const order = [
    "public-match-card-outcome",
    "public-match-card-champion",
    "public-match-card-perf",
    "public-match-card-stats",
    "public-match-card-items",
    "public-match-card-team",
    "public-match-card-expand",
  ].map((name) => html.indexOf(name));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));

  assert.match(html, /tabindex="0" title="아이템 1"/u);
  assert.match(html, /class="deaths">0/u);
  assert.match(html, /public-match-card-kda-summary/u);
  // 모든 지표 셀이 "값 위 / 라벨 아래" 한 규칙을 씁니다.
  assert.match(html, /<strong>70%<\/strong><small[^>]*><i class="public-match-card-stat-label">킬 관여율<\/i><\/small>/u);
  assert.match(html, /<strong>210<\/strong><small[^>]*><i class="public-match-card-stat-label">CS<\/i><i class="public-match-card-stat-suffix"> · 7\.8\/분<\/i><\/small>/u);
  assert.match(html, /<strong>24%<\/strong><small[^>]*><i class="public-match-card-stat-label">피해 점유<\/i><\/small>/u);
  // 비율 지표에만 게이지가 붙습니다.
  assert.equal((html.match(/public-match-card-stat-bar/gu) ?? []).length, 2);
  // 팀 구성은 아군 5 / 상대 5 이고 본인만 강조합니다.
  assert.equal((html.match(/public-match-card-team-member/gu) ?? []).length, 10);
  assert.equal((html.match(/public-match-card-team-member is-target/gu) ?? []).length, 1);

  assert.match(html, /public-match-card-expand-label" role="tooltip">경기 상세 펼치기/u);
  assert.match(html, /aria-expanded="false"/u);
  assert.match(html, /aria-label="승리 · 제드 · 9\/0\/6"/u);
  assert.equal((html.match(/aria-label="종합 등급 S\+"/gu) ?? []).length, 1);
  assert.match(html, /class="public-match-card-score metric-tone-excellent" data-grade="S\+"[^>]*><b>S\+<\/b>/u);
  assert.match(html, /public-match-card-score-description.*YORO 경기 점수 설명/u);
});

test("프로필 공유 기능은 티어·주부라인 카드를 이미지 저장과 시스템 공유로 제공한다", () => {
  const html = renderToStaticMarkup(
    <ProfileShareActions
      card={{
        riotId: "YORO#JP1",
        tierLabel: "다이아몬드 2",
        tierIconUrl: "https://example.com/emblem.png",
        leaguePoints: 45,
        wins: 132,
        losses: 108,
        winRate: 55,
        summonerLevel: 312,
        queueLabel: "솔로랭크",
        masteryChampionArtUrl: "https://example.com/champion-splash.jpg",
        mainLane: {
          iconUrl: "/images/roles/position-middle.svg",
          roleLabel: "미드",
          games: 48,
          winRate: 58,
          kda: 3.4,
          champions: [{ name: "아리", iconUrl: "https://example.com/ahri.png", games: 21, winRate: 57 }],
        },
        subLane: {
          iconUrl: "/images/roles/position-utility.svg",
          roleLabel: "서포터",
          games: 19,
          winRate: 58,
          kda: 3.1,
          champions: [{ name: "쓰레쉬", games: 9, winRate: 67 }],
        },
        streamer: {
          displayName: "징크스방송국",
          channelLabel: "twitch.tv/jinxlive",
          profileImageUrl: "https://example.com/streamer.png",
          isLive: true,
          title: "다이아 탈출 각!",
        },
      }}
      text={{
        title: "프로필 공유 카드",
        description: "티어와 주·부 라인, 라인별 주력 챔피언을 한 장의 이미지로 정리합니다.",
        download: "이미지 저장",
        share: "프로필 공유",
        preparing: "공유 이미지를 만드는 중입니다.",
        saved: "프로필 이미지를 저장했습니다.",
        shared: "프로필 이미지를 공유했습니다.",
        failed: "공유 이미지를 만들지 못했습니다.",
        mainLane: "주 라인",
        subLane: "부 라인",
        unranked: "언랭크",
        levelPrefix: "Lv.",
        games: "경기",
        sampleNote: "최근 40경기 기준",
        liveBadge: "LIVE",
      }}
    />
  );

  assert.match(html, /public-match-share-actions/u);
  assert.match(html, />프로필 공유 카드</u);
  assert.match(html, />이미지 저장</u);
  assert.match(html, />프로필 공유</u);
  assert.match(html, /aria-live="polite"/u);

  const shareSource = readFileSync(
    new URL("../src/features/public-lol/components/ProfileShareActions.tsx", import.meta.url),
    "utf8",
  );
  /* 목업 lol-profile-share-card.html v1.3 의 확정 사양이 코드에 살아 있는지 고정합니다. */
  assert.match(shareSource, /canvas\.toBlob/u);
  assert.match(shareSource, /const CARD_WIDTH = 1080;/u);
  /* SNS 크롭 경계(1.91:1) 가드 — 블록이 줄어도 이 높이 아래로 내려가지 않습니다. */
  assert.match(shareSource, /const MIN_CARD_HEIGHT = 566;/u);
  assert.match(shareSource, /drawTrimmedEmblem/u);
  assert.match(shareSource, /drawLaneBlock/u);
  assert.match(shareSource, /masteryChampionArtUrl/u);
  assert.match(shareSource, /navigator\.canShare\(\{ files: \[file\] \}\)/u);
});
test("모바일 최근 전적은 3행으로 압축하고 등급·지표 정렬 축을 고정한다", () => {
  const cardCss = readFileSync(
    new URL("../src/styles/pages/public-lol/22-match-card.css", import.meta.url),
    "utf8",
  );

  // 소환사 주문은 왼쪽 열에 D 위 / F 아래, 룬은 오른쪽 열에 주 룬 위 / 보조 룬 아래로 쌓습니다.
  assert.match(cardCss, /\.public-match-card-loadout\s*\{[\s\S]*?display:\s*flex/u);
  assert.match(cardCss, /\.public-match-card-loadout-column\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-rows:\s*repeat\(2, 1\.25rem\)/u);

  // 남는 폭을 한 열에 몰아주는 대신 열 사이에 균등 분배합니다.
  // track 폭이 행마다 동일해야 열 정렬이 흔들리지 않으므로 track 에는 상한을 둡니다.
  assert.match(cardCss, /\.public-match-card-summary\s*\{[\s\S]*?justify-content:\s*space-between/u);
  assert.match(cardCss, /\.public-match-card-summary\s*\{[\s\S]*?minmax\(11rem, 12\.5rem\)\s*\/\* 2 챔피언/u);
  // 그룹 내부 여백(12px)과 그룹 사이 여백(column-gap 16px + 분배분)의 위계를 유지합니다.
  assert.match(cardCss, /\.public-match-card-summary\s*\{[\s\S]*?column-gap:\s*var\(--yoro-space-4\)/u);
  for (const group of ["champion", "perf", "stats", "items"]) {
    assert.match(cardCss, new RegExp(`\\.public-match-card-${group}\\s*\\{[\\s\\S]*?gap:\\s*var\\(--yoro-space-3\\)`, "u"));
  }

  // 반응형 기준은 viewport 가 아니라 리스트 컨테이너 폭입니다.
  assert.match(cardCss, /\.public-matches-panel\s*\{[\s\S]*?container-type:\s*inline-size[\s\S]*?container-name:\s*match-list/u);
  assert.match(cardCss, /@container match-list \(max-width: 1180px\)[\s\S]*?\.public-match-card-team\s*\{\s*display:\s*none/u);
  assert.match(cardCss, /@container match-list \(max-width: 980px\)[\s\S]*?\.public-match-card-stats > span:nth-child\(3\)\s*\{\s*display:\s*none/u);
  // 980 구간의 하한은 container 721px 입니다. track 합이 그 폭을 넘지 않도록 gap 도 함께 줄입니다.
  assert.match(cardCss, /@container match-list \(max-width: 980px\)[\s\S]*?column-gap:\s*var\(--yoro-space-3\)/u);

  const mobile = cardCss.slice(cardCss.indexOf("@container match-list (max-width: 720px)"));
  // 3·4·5열은 고정 폭이라 KDA 자릿수와 무관하게 등급 배지 x 좌표가 행마다 같습니다.
  assert.match(mobile, /\.public-match-card-summary\s*\{[\s\S]*?grid-template-columns:\s*2\.25rem minmax\(0, 1fr\) 2rem 4\.25rem 2\.75rem/u);
  // 세로로 쌓지 않고 겹치기 위해 챔피언 셀을 풀어 각각 배치합니다.
  assert.match(mobile, /\.public-match-card-champion\s*\{\s*display:\s*contents/u);
  assert.match(mobile, /\.public-match-card-portrait\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1 \/ span 2/u);
  // 등급은 행 가운데 열에 홀로 세워 오른쪽에 여백을 만듭니다.
  assert.match(mobile, /\.public-match-card-perf\s*\{\s*display:\s*contents/u);
  assert.match(mobile, /\.public-match-card-score\s*\{[\s\S]*?grid-column:\s*3;\s*grid-row:\s*1 \/ span 2[\s\S]*?justify-self:\s*center/u);
  assert.match(mobile, /\.public-match-card-kda\s*\{\s*grid-column:\s*4;\s*grid-row:\s*1 \/ span 2/u);
  // 상세 버튼 열은 44px 입니다. 좁게 두면 touch target 최소 폭 때문에 열 밖으로 번집니다.
  assert.match(mobile, /\.public-match-card-expand\s*\{\s*grid-column:\s*5[\s\S]*?width:\s*var\(--yoro-size-touch-target\)/u);
  // MVP·ACE 는 챔피언 이름 바로 옆.
  assert.match(mobile, /\.public-match-card-highlight\s*\{\s*margin-left:\s*0/u);
  // 지표는 4~5열 안에만 놓아 카드 가장자리에 밀착하지 않습니다.
  assert.match(mobile, /\.public-match-card-stats\s*\{\s*grid-column:\s*4 \/ 6;\s*grid-row:\s*3/u);
  // 아이템 격자는 stretch 로 두어야 유연한 슬롯이 0 폭으로 붕괴하지 않습니다.
  assert.match(mobile, /\.public-match-card-items\s*\{[\s\S]*?justify-self:\s*stretch/u);
  // 폭이 좁아지면 보조 문구·게이지·후행 지표 순으로 덜어냅니다.
  assert.match(mobile, /\.public-match-card-stat-bar\s*\{\s*display:\s*none/u);
  // 긴 라벨 대신 짧은 라벨로 바꿔 본문 최소 12px 를 지키면서 폭을 확보합니다.
  assert.match(mobile, /\.public-match-card-stat-label\s*\{\s*display:\s*none/u);
  assert.match(mobile, /\.public-match-card-stat-label-short\s*\{\s*display:\s*inline/u);
  // 큐와 포지션은 390px 에서 접고 title 로 남깁니다.
  assert.match(mobile, /\.public-match-card-role\s*\{\s*display:\s*none/u);
  assert.match(mobile, /\.public-match-card-outcome-line strong\s*\{\s*display:\s*none/u);
  // 모바일은 3행 높이를 아이템 한 줄에 맞추기 위해 주문을 가로로 두고 룬은 접습니다.
  assert.match(mobile, /\.public-match-card-loadout-column\s*\{[\s\S]*?grid-auto-flow:\s*column/u);
  assert.match(mobile, /\.public-match-card-loadout \.runes\s*\{\s*display:\s*none/u);
  // 확장 버튼은 44px 터치 타깃을 지키고, 카드 전체도 토글 영역입니다.
  assert.match(mobile, /\.public-match-card-expand\s*\{[\s\S]*?height:\s*var\(--yoro-size-touch-target\)/u);
  assert.match(cardCss, /\.public-match-card-summary\s*\{[\s\S]*?cursor:\s*pointer/u);
  // 필터 칩은 모바일에서 44px 터치 타깃을 지킵니다.
  assert.match(mobile, /\.public-match-queue-chips button\s*\{\s*min-height:\s*var\(--yoro-size-touch-target\)/u);
});

test("전적 카드는 MVP와 ACE를 금색·은색 shimmer 로 구분한다", () => {
  const cardCss = readFileSync(
    new URL("../src/styles/pages/public-lol/22-match-card.css", import.meta.url),
    "utf8",
  );

  assert.match(cardCss, /\.public-match-card:is\(\.highlight-mvp, \.highlight-ace\)::after\s*\{[\s\S]*?animation:\s*public-match-card-featured-shimmer/u);
  assert.match(cardCss, /@keyframes public-match-card-featured-shimmer\s*\{[\s\S]*?background-position:\s*-75% 0, 0 0[\s\S]*?background-position:\s*175% 0, 0 0/u);
  assert.match(cardCss, /\.public-match-card\.highlight-mvp::after\s*\{[\s\S]*?var\(--yoro-color-warning\)/u);
  assert.match(cardCss, /\.public-match-card\.highlight-ace::after\s*\{[\s\S]*?var\(--yoro-color-text-on-dark\)/u);
  assert.match(cardCss, /prefers-reduced-motion:\s*reduce[\s\S]*?\.public-match-card:is\(\.highlight-mvp, \.highlight-ace\)::after[\s\S]*?animation:\s*none/u);
  // 승패는 스트라이프 + 배경 틴트 + 문자 배지 3중 인코딩입니다.
  assert.match(cardCss, /\.public-match-card\.win::before\s*\{\s*background:\s*var\(--yoro-color-match-win-accent\)/u);
  assert.match(cardCss, /\.public-match-card\.loss::before\s*\{\s*background:\s*var\(--yoro-color-match-loss-accent\)/u);
});

test("LoL 모바일 상단바는 스크롤 방향에 따라 탐색·검색 행을 애니메이션으로 전환한다", () => {
  const profileCss = readFileSync(
    new URL("../src/styles/pages/public-lol/20-profile-platform.css", import.meta.url),
    "utf8",
  );

  assert.match(profileCss, /@media \(max-width:\s*48rem\)[\s\S]*?\.lol-public-game-header \.public-game-header__nav-slot\s*\{[\s\S]*?padding-block:\s*var\(--yoro-space-0\)/u);
  assert.match(profileCss, /\.lol-public-game-header \.public-game-header__search-slot\s*\{[\s\S]*?padding-block:\s*var\(--yoro-space-1\)/u);
  assert.match(profileCss, /\.lol-public-game-header \.public-horizontal-nav__content > :is\(button, a\)\s*\{[\s\S]*?min-block-size:\s*var\(--yoro-size-touch-target\)/u);
  assert.match(profileCss, /\.lol-public-game-header :is\([\s\S]*?\.public-game-header__nav-slot,[\s\S]*?\.public-game-header__search-slot[\s\S]*?\)\s*\{[\s\S]*?max-block-size:[\s\S]*?transition:/u);
  assert.match(profileCss, /\.lol-public-game-header\.mobile-chrome-scrolled :is\([\s\S]*?\.public-game-header__nav-slot,[\s\S]*?\.public-game-header__search-slot[\s\S]*?\)\s*\{[\s\S]*?max-block-size:\s*var\(--yoro-space-0\)[\s\S]*?transform:\s*translateY/u);
  const hiddenChromeBlock = profileCss.match(
    /\.lol-public-game-header\.mobile-chrome-scrolled :is\([\s\S]*?\)\s*\{([^}]*)\}/u,
  )?.[1] ?? "";
  assert.doesNotMatch(hiddenChromeBlock, /display:\s*none/u);

  const headerSource = readFileSync(
    new URL("../src/features/public-lol/components/PublicAppHeader.tsx", import.meta.url),
    "utf8",
  );
  assert.match(headerSource, /const delta = currentScrollY - lastScrollY/u);
  assert.match(headerSource, /delta > MOBILE_CHROME_DELTA_THRESHOLD/u);
  assert.match(headerSource, /delta < -MOBILE_CHROME_DELTA_THRESHOLD/u);
  assert.match(headerSource, /mobileChromeScrolled \? "mobile-chrome-scrolled"/u);
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

test("프로필 사이드바 지표 카드는 비교 기준이 없으면 기준선 없이 값만 알린다", () => {
  const metrics = [
    { key: "kda", label: "KDA", value: "3.42", ratio: 57 },
    { key: "kp", label: "킬 관여", value: "55%", ratio: 55 },
  ];
  const text = {
    title: "최근 20경기 지표",
    gradeAriaLabel: "종합 등급",
    noBenchmarkNotice: "동티어 비교 기준을 아직 제공하지 않습니다 · 값만 표시합니다",
    sampleShortNotice: "표본이 얇습니다 · 2경기 더 필요",
  };

  const plain = renderToStaticMarkup(
    <ProfileMetricProfileCard grade="S" metrics={metrics} score={78} text={text} />
  );
  assert.match(plain, /class="public-profile-side-card public-profile-metric-profile"/u);
  assert.match(plain, /aria-label="종합 등급 S"/u);
  // 기준선은 benchmarkRatio 가 있을 때만 그립니다.
  assert.doesNotMatch(plain, /<i aria-hidden="true"/u);
  assert.match(plain, /동티어 비교 기준을 아직 제공하지 않습니다/u);
  assert.match(plain, /aria-label="KDA 3\.42"/u);

  const benchmarked = renderToStaticMarkup(
    <ProfileMetricProfileCard
      grade="S"
      metrics={[{ ...metrics[0], benchmarkRatio: 40, percentileLabel: "상위 22%" }]}
      score={78}
      text={text}
    />
  );
  assert.match(benchmarked, /<i aria-hidden="true" style="left:40%"/u);
  assert.match(benchmarked, /aria-label="KDA 3\.42, 상위 22%"/u);
  assert.doesNotMatch(benchmarked, /동티어 비교 기준을 아직 제공하지 않습니다/u);

  // 표본이 얇으면 비교 표시를 모두 끄고 얇다는 사실만 알립니다.
  const short = renderToStaticMarkup(
    <ProfileMetricProfileCard
      grade="B"
      metrics={[{ ...metrics[0], benchmarkRatio: 40, percentileLabel: "상위 22%" }]}
      sampleShort
      score={51}
      text={text}
    />
  );
  assert.match(short, /public-profile-metric-list is-sample-short/u);
  assert.doesNotMatch(short, /<i aria-hidden="true"/u);
  assert.doesNotMatch(short, /상위 22%/u);
  assert.match(short, /표본이 얇습니다 · 2경기 더 필요/u);
});

test("프로필 사이드바 LP·포지션 카드는 빈 상태와 기록을 구분해 렌더링한다", () => {
  const lpText = {
    title: "LP 기록",
    periodLabel: "최근 30일",
    recordCountLabel: "기록",
    emptyTitle: "아직 LP 기록이 없습니다",
    emptyDescription: "랭크 경기를 치르면 변화를 모아 보여드립니다",
  };

  const empty = renderToStaticMarkup(
    <ProfileLpRecordCard currentLabel="Unranked" entries={[]} recordCount={0} text={lpText} />
  );
  assert.match(empty, /public-profile-side-empty/u);
  assert.match(empty, /아직 LP 기록이 없습니다/u);
  assert.doesNotMatch(empty, /public-profile-lp-log/u);

  const filled = renderToStaticMarkup(
    <ProfileLpRecordCard
      changeLabel="+124 LP"
      changeTone="up"
      currentLabel="Grandmaster I 636 LP"
      entries={[{ key: "a", dateLabel: "8월 6일", delta: 22, deltaLabel: "+22 LP", rangeLabel: "614 → 636 LP" }]}
      recordCount={12}
      text={lpText}
    />
  );
  assert.match(filled, /public-profile-lp-delta" data-tone="up">\+124 LP/u);
  assert.match(filled, /<ol class="public-profile-lp-log">/u);
  assert.match(filled, /class="delta" data-tone="up">\+22 LP/u);
  assert.match(filled, /614 → 636 LP/u);

  const roles = renderToStaticMarkup(
    <ProfileRoleCard
      roles={[
        { key: "MIDDLE", label: "미드", isMain: true, winRate: 61, winRateLabel: "61%", recordLabel: "41전 25승", kdaLabel: "4.2" },
        { key: "JUNGLE", label: "정글", winRate: 44.4, winRateLabel: "44%", recordLabel: "18전 8승", kdaLabel: "2.8" },
      ]}
      text={{ title: "포지션별 승률", periodLabel: "최근 20경기", mainTag: "주 포지션", emptyLabel: "데이터 없음" }}
    />
  );
  // 주 포지션과 50% 미만 포지션은 형태로도 구분합니다.
  assert.match(roles, /public-profile-role is-main/u);
  assert.match(roles, /public-profile-role\s+is-low/u);
  assert.match(roles, /class="tag">주 포지션/u);
  assert.match(roles, /aria-label="미드 61%, 41전 25승, KDA 4\.2"/u);
});

test("프로필 사이드바 CSS는 legacy 반응형 grid 를 덮지 않고 값 열 폭만 고정한다", () => {
  const sidebarCss = readFileSync(
    new URL("../src/styles/pages/public-lol/25-profile-sidebar.css", import.meta.url),
    "utf8",
  );

  // 패널의 display 는 legacy 가 폭별로 소유합니다. 여기서 덮으면 반응형이 죽습니다.
  const panelRule = sidebarCss.slice(
    sidebarCss.indexOf(".public-overview-dashboard-panel {"),
    sidebarCss.indexOf(".public-profile-side-card {"),
  );
  assert.match(panelRule, /container-type:\s*inline-size/u);
  assert.match(panelRule, /container-name:\s*profile-side/u);
  assert.doesNotMatch(panelRule, /display:/u);

  // 값 열 폭이 고정이라야 막대 시작점이 행마다 같은 x 에 옵니다.
  assert.match(sidebarCss, /\.public-profile-metric-row\s*\{[\s\S]*?grid-template-columns:\s*4\.25rem 2\.5rem minmax\(0, 1fr\)/u);
  // legacy 의 metric-tone-* 가 !important 로 색을 덮으므로 등급 색은 안쪽 요소에 둡니다.
  assert.match(sidebarCss, /\.public-profile-metric-grade > b\s*\{[\s\S]*?color:\s*var\(--yoro-color-match-score-on-bright\)/u);
  // 패널 자신은 자기 container 가 아니므로 패널 레이아웃에 container query 를 쓰지 않습니다.
  assert.doesNotMatch(sidebarCss, /@container profile-side[^{]*\{\s*\.public-overview-dashboard-panel/u);
  // 선언에는 !important 를 쓰지 않습니다(주석의 언급은 제외).
  assert.doesNotMatch(sidebarCss, /[a-z-]+:[^;{}]*!important/u);
});

test("app entry는 서버가 넣은 SEO fallback 본문을 mount 전에 제거한다", () => {
  const entry = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  // fallback이 남으면 실제 화면 위에 중복 콘텐츠가 보입니다.
  // React의 container 정리 동작에 의존하지 않고 명시적으로 제거해야 합니다.
  assert.match(entry, /querySelector\("\[data-seo-fallback\]"\)\?\.remove\(\)/u);
  assert.match(entry, /createRoot\(container\)/u);
});

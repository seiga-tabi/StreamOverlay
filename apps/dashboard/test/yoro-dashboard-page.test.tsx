import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "ko-KR" }
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    },
    navigator: { language: "ko-KR" },
    location: {
      assign: () => undefined,
      pathname: "/dashboard",
      search: ""
    },
    history: {
      pushState: () => undefined,
      replaceState: () => undefined
    },
    dispatchEvent: () => true,
    scrollTo: () => undefined,
    setTimeout,
    clearTimeout
  }
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: {
      dataset: {},
      lang: "ko"
    }
  }
});

test("공통 YORO Dashboard는 로그인 사용자용 진입점과 KO·JA 문구를 제공한다", async () => {
  const { YoroDashboardPage } = await import(
    "../src/features/yoro-dashboard/YoroDashboardPage"
  );
  const source = await readFile(
    new URL("../src/features/yoro-dashboard/YoroDashboardPage.tsx", import.meta.url),
    "utf8"
  );
  const markup = renderToStaticMarkup(<YoroDashboardPage />);

  assert.match(markup, /Dashboard를 불러오는 중입니다/u);
  assert.match(source, /연결 계정/u);
  assert.match(source, /連携アカウント/u);
  assert.match(source, /Discord Bot 제어/u);
  assert.match(source, /Discord Bot コントロール/u);
  assert.match(source, /Palworld 서버/u);
  assert.match(source, /Palworldサーバー/u);
  assert.match(source, /updateAccountPreferences/u);
  assert.match(source, /discordIdentity\.displayName/u);
  assert.match(source, /twitchIdentity\.displayName/u);
  assert.match(source, /yoro-dh-card-text/u);
  assert.match(source, /DiscordSetupPage/u);
  assert.match(source, /BotManagementPage/u);
  assert.match(source, /스트리머 이용 상태/u);
  assert.match(source, /ストリーマー利用状況/u);
  assert.match(source, /시청자 참여/u);
  assert.match(source, /視聴者参加/u);
  assert.match(source, /ParticipationManagementPage/u);
  assert.match(source, /Dashboard 메뉴 열기/u);
  assert.match(source, /Dashboardメニューを開く/u);
  assert.match(source, /aria-controls="yoro-dashboard-navigation"/u);
  assert.match(source, /moderator:read:followers/u);
  assert.doesNotMatch(source, /streamingPermissions/u);
  assert.match(source, /onClick=\{\(\) => void openFollowerPermission\(\)\}/u);
  assert.match(source, /applyForStreamer/u);
  assert.match(source, /FollowersPage dataSource/u);
  assert.match(source, /MyRiotAccountPage/u);
  assert.match(source, /현재 설정 미리보기/u);
  assert.match(source, /現在の設定プレビュー/u);
  assert.match(source, /yoro-dashboard-settings-layout/u);
  assert.match(source, /yoro-dashboard-settings-preview/u);
  assert.match(source, /yoro-dashboard-toggle-track/u);
  assert.match(source, /settingsChanged/u);
  assert.match(source, /cancelPreferenceChanges/u);
  assert.equal(source.includes("방송 자동화"), false);
  assert.equal(source.includes("配信自動化"), false);
  assert.equal(source.includes("Overlay 관리"), false);
  assert.equal(source.includes("localStorage.setItem"), false);

  const css = await readFile(
    new URL("../src/styles/pages/account/18-yoro-dashboard.css", import.meta.url),
    "utf8"
  );
  assert.match(css, /grid-template-columns:\s*288px minmax\(0, 1fr\)/u);
  // 브랜드 링크는 글자 높이(ko 25px · ja 32px)로만 잡히던 것을 44px 로 세웁니다.
  assert.match(css, /\.yoro-dashboard-brand\s*\{[\s\S]*?min-height:\s*44px/u);
  assert.match(
    css,
    /\.yoro-dashboard-main[\s\S]*?margin-inline:\s*auto/u
  );
  assert.match(
    css,
    /\.yoro-dashboard-sidebar\.is-open[\s\S]*?transform:\s*translateX\(0\)/u
  );
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/u);
  assert.match(
    css,
    /\.yoro-dashboard-settings\s*\{[\s\S]*?max-width:\s*1240px/u
  );
  assert.match(
    css,
    /\.yoro-dashboard-settings-layout[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(300px, \.42fr\)/u
  );
  assert.match(
    css,
    /\.yoro-dashboard-settings-actions[\s\S]*?position:\s*sticky/u
  );
});

test("Dashboard 홈은 상태별로 다른 화면을 보여 주고 지표를 링크로 만든다", async () => {
  const source = await readFile(
    new URL("../src/features/yoro-dashboard/YoroDashboardPage.tsx", import.meta.url),
    "utf8"
  );

  // 같은 진행 상태를 "빠른 시작"과 "다음 작업"으로 두 번 말하던 구조를 없앴습니다.
  assert.equal(source.includes("yoro-dashboard-quick-start"), false);
  assert.equal(source.includes("yoro-dashboard-next"), false);
  assert.equal(source.includes("yoro-dashboard-summary-grid"), false);
  assert.equal(source.includes("yoro-dashboard-metrics"), false);

  // 단계 카드는 남은 단계가 있을 때만 렌더링합니다.
  assert.match(source, /\{currentSetupStep \? \(/u);
  assert.match(source, /const currentSetupStep = setupSteps\.find/u);

  // 운영 상태는 값을 실제로 받은 항목만 올립니다.
  assert.match(source, /\{opsCards\.length > 0 \? \(/u);
  assert.match(source, /lastSnapshotAt/u);
  assert.match(source, /getYoroParticipation/u);
  assert.match(source, /getManagementBotControl/u);
  assert.match(source, /listManagementGameServers/u);
  // 실시간 접속 여부·응답 시간을 주는 계약이 없으므로 그렇게 적지 않습니다.
  assert.equal(source.includes("온라인"), false);
  assert.equal(source.includes("オンライン"), false);
  assert.equal(/응답\s*\d+\s*ms/u.test(source), false);
  // 7일 신규는 서버가 이미 계산한 값을 그대로 씁니다.
  assert.match(source, /newFollowers7d/u);

  // 지표 4개는 전부 해당 화면으로 이동합니다.
  for (const target of [
    "streamingFollowers",
    "streamingParticipation",
    "organizations",
    "account"
  ]) {
    assert.match(
      source,
      new RegExp(`className="yoro-dh-kpi"\\s*\\n\\s*onClick=\\{\\(\\) => navigate\\("${target}"\\)\\}`, "u")
    );
  }

  // ko·ja 문구를 함께 관리합니다.
  for (const pair of [
    ["시청자 참여 열림", "視聴者参加 受付中"],
    ["Followers 최근 갱신", "Followers 最終更新"],
    ["{n}일 전", "{n}日前"],
    ["소유 {owner} · 그 외 {other}", "所有 {owner} · その他 {other}"],
    ["Discord Bot 설치됨", "Discord Bot 導入済み"],
    ["게임 서버 연결 정상", "ゲームサーバー接続 正常"],
    ["7일 신규 +{n}", "7日 新規 +{n}"]
  ]) {
    assert.equal(source.includes(pair[0]), true, pair[0]);
    assert.equal(source.includes(pair[1]), true, pair[1]);
  }

  const css = await readFile(
    new URL("../src/styles/pages/account/31-dashboard-home.css", import.meta.url),
    "utf8"
  );
  // legacy !important 를 피하려고 만든 이름이므로 layer 와 무가중치 규칙을 유지합니다.
  // 주석에 옛 이름이 근거로 적혀 있어 선언부만 남기고 검사합니다.
  const cssRules = css.replace(/\/\*[\s\S]*?\*\//gu, "");
  assert.match(cssRules, /@layer pages \{/u);
  assert.equal(cssRules.includes("!important"), false);
  assert.equal(
    /\.yoro-dashboard-(metrics|quick-start|summary-grid|next)\b/u.test(cssRules),
    false
  );
  // 조작 요소는 44px 를 지킵니다.
  assert.match(css, /\.yoro-dh-action\s*\{[\s\S]*?min-height:\s*44px/u);
  assert.match(css, /\.yoro-dh-card-list > li\s*\{[\s\S]*?min-height:\s*44px/u);
});

test("공통 Dashboard 경로는 기존 방송 운영 하위 경로와 겹치지 않는다", async () => {
  const { YORO_DASHBOARD_PATH } = await import(
    "../src/features/yoro-account/api"
  );
  const {
    canonicalYoroDashboardPath,
    yoroDashboardPageFromPath
  } = await import(
    "../src/features/yoro-dashboard/YoroDashboardPage"
  );
  assert.equal(YORO_DASHBOARD_PATH, "/dashboard");
  assert.doesNotMatch(YORO_DASHBOARD_PATH, /[?#]|user|discord|twitch|token/iu);
  assert.equal(yoroDashboardPageFromPath("/dashboard"), "overview");
  assert.equal(yoroDashboardPageFromPath("/dashboard/account"), "account");
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/organizations/"),
    "organizations"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/organizations/bot"),
    "organizationBot"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/organizations/servers/"),
    "organizationServers"
  );
  assert.equal(
    canonicalYoroDashboardPath("/dashboard/organizations/bot/"),
    "/dashboard/organizations/bot"
  );
  assert.equal(yoroDashboardPageFromPath("/dashboard/settings"), "settings");
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/streaming"),
    "streaming"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/streaming/permissions/"),
    "streaming"
  );
  assert.equal(
    canonicalYoroDashboardPath("/dashboard/streaming/permissions/"),
    "/dashboard/streaming"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/streaming/followers"),
    "streamingFollowers"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/streaming/participation"),
    "streamingParticipation"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/streaming/riot-id"),
    "streamingRiot"
  );
  assert.equal(
    canonicalYoroDashboardPath("/dashboard/followers"),
    "/dashboard/streaming/followers"
  );
  assert.equal(
    canonicalYoroDashboardPath("/dashboard/lol/participation"),
    "/dashboard/streaming/participation"
  );
  assert.equal(
    canonicalYoroDashboardPath("/dashboard/participation"),
    "/dashboard/streaming/participation"
  );
  assert.equal(
    canonicalYoroDashboardPath(
      "/dashboard/legacy_user/sdk_0123456789abcdefghijklmnopqrstuv/participation"
    ),
    "/dashboard/streaming/participation"
  );
  assert.equal(
    canonicalYoroDashboardPath(
      "/dashboard/legacy_user/sdk_0123456789abcdefghijklmnopqrstuv/riot-id"
    ),
    "/dashboard/streaming/riot-id"
  );
  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8"
  );
  const clientSource = await readFile(
    new URL("../src/api/client.ts", import.meta.url),
    "utf8"
  );
  const dashboardSource = await readFile(
    new URL("../src/features/yoro-dashboard/YoroDashboardPage.tsx", import.meta.url),
    "utf8"
  );
  assert.equal(appSource.includes("StreamerDashboardEntryPage"), false);
  assert.equal(appSource.includes("streamerAccess"), false);
  assert.equal(clientSource.includes("X-StreamOps-Dashboard-Key"), false);
  assert.equal(clientSource.includes("X-StreamOps-Streamer-Slug"), false);
  assert.equal(
    dashboardSource.includes(
      "${canonicalPath}${window.location.search}${window.location.hash}"
    ),
    false
  );
  assert.equal(
    appSource.includes('pathname.startsWith("/dashboard/")'),
    true
  );
  assert.equal(appSource.includes('"/setup/discord"'), false);
  assert.equal(appSource.includes('"/bot/manage"'), false);
});

test("시청자 참여 관리 화면은 KO·JA와 세션·대기열 관리 계약을 제공한다", async () => {
  const { ParticipationManagementPage } = await import(
    "../src/features/yoro-dashboard/ParticipationManagementPage"
  );
  const source = await readFile(
    new URL(
      "../src/features/yoro-dashboard/ParticipationManagementPage.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const css = await readFile(
    new URL(
      "../src/styles/pages/account/19-participation-management.css",
      import.meta.url
    ),
    "utf8"
  );
  const koMarkup = renderToStaticMarkup(
    <ParticipationManagementPage csrfToken="csrf-test" locale="ko" />
  );
  const jaMarkup = renderToStaticMarkup(
    <ParticipationManagementPage csrfToken="csrf-test" locale="ja" />
  );

  assert.match(koMarkup, /시청자 참여 상태를 불러오는 중입니다/u);
  assert.match(jaMarkup, /視聴者参加の状態を読み込んでいます/u);
  assert.match(source, /새 참여 세션/u);
  assert.match(source, /新しい参加セッション/u);
  assert.match(source, /선택한 참가자 선정/u);
  assert.match(source, /選択した参加者を選出/u);
  assert.match(source, /다음 참가자로 선택/u);
  assert.match(source, /次の参加者として選択/u);
  assert.match(source, /참여 페이지 공개 범위/u);
  assert.match(source, /参加ページの公開範囲/u);
  assert.match(source, /listingVisibility/u);
  assert.doesNotMatch(source, /URL 복사/u);
  assert.doesNotMatch(source, /URLをコピー/u);
  assert.match(source, /\/participation/u);
  assert.match(source, /updateYoroParticipationEntry/u);
  assert.match(css, /overflow-x:\s*auto/u);
  assert.match(css, /@media \(max-width:\s*48rem\)/u);
  assert.match(css, /var\(--surface\)/u);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}/iu);
});

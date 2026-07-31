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
  assert.match(source, /yoro-dashboard-identity-label/u);
  assert.match(source, /DiscordSetupPage/u);
  assert.match(source, /BotManagementPage/u);
  assert.match(source, /스트리머 이용 상태/u);
  assert.match(source, /ストリーマー利用状況/u);
  assert.match(source, /Dashboard 메뉴 열기/u);
  assert.match(source, /Dashboardメニューを開く/u);
  assert.match(source, /aria-controls="yoro-dashboard-navigation"/u);
  assert.match(source, /moderator:read:followers/u);
  assert.match(source, /applyForStreamer/u);
  assert.match(source, /FollowersPage dataSource/u);
  assert.match(source, /MyRiotAccountPage/u);
  assert.equal(source.includes("방송 자동화"), false);
  assert.equal(source.includes("配信自動化"), false);
  assert.equal(source.includes("Overlay 관리"), false);
  assert.equal(source.includes("localStorage.setItem"), false);

  const css = await readFile(
    new URL("../src/styles/pages/account/18-yoro-dashboard.css", import.meta.url),
    "utf8"
  );
  assert.match(
    css,
    /\.yoro-dashboard-summary-grid li > \.discord-symbol-icon[\s\S]*?width:\s*22px/u
  );
  assert.match(css, /grid-template-columns:\s*288px minmax\(0, 1fr\)/u);
  assert.match(
    css,
    /\.yoro-dashboard-main[\s\S]*?margin-inline:\s*auto/u
  );
  assert.match(
    css,
    /\.yoro-dashboard-sidebar\.is-open[\s\S]*?transform:\s*translateX\(0\)/u
  );
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/u);
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
    "streamingPermissions"
  );
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/streaming/followers"),
    "streamingFollowers"
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
    canonicalYoroDashboardPath(
      "/dashboard/legacy_user/sdk_0123456789abcdefghijklmnopqrstuv/riot-id"
    ),
    "/dashboard/streaming/riot-id"
  );
  assert.equal(
    canonicalYoroDashboardPath(
      "/dashboard/legacy_user/sdk_0123456789abcdefghijklmnopqrstuv/alerts"
    ),
    "/dashboard/streaming"
  );

  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8"
  );
  const clientSource = await readFile(
    new URL("../src/api/client.ts", import.meta.url),
    "utf8"
  );
  const socketSource = await readFile(
    new URL("../src/api/socket.ts", import.meta.url),
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
  assert.equal(socketSource.includes("dashboardKey"), false);
  assert.equal(socketSource.includes("streamerSlug"), false);
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

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

const localStorageStub = {
  getItem: () => null,
  setItem: () => undefined
};

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    localStorage: localStorageStub,
    navigator: { language: "ko-KR" },
    location: {
      assign: () => undefined,
      search: "",
      pathname: "/login"
    }
  }
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { documentElement: { lang: "ko" } }
});

test("YORO 로그인 페이지는 Discord와 Twitch를 별도 비밀번호 없는 로그인 수단으로 제공한다", async () => {
  const { YoroLoginPage } = await import("../src/features/yoro-account/YoroLoginPage");
  const markup = renderToStaticMarkup(<YoroLoginPage />);
  const source = await readFile(
    new URL("../src/features/yoro-account/YoroLoginPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(markup, /YORO\.gg 로그인/u);
  assert.match(source, /Discord로 계속하기/u);
  assert.match(source, /Twitch로 계속하기/u);
  assert.match(source, /accountOAuthUrl\("discord", "login"/u);
  assert.match(source, /accountOAuthUrl\("twitch", "login"/u);
  assert.doesNotMatch(markup, /type="password"/u);
  assert.doesNotMatch(source, /localStorage/u);
});

test("YORO 계정 페이지는 Discord와 Twitch 연결 상태를 한 화면에서 관리한다", async () => {
  const { YoroAccountPage } = await import("../src/features/yoro-account/YoroAccountPage");
  const markup = renderToStaticMarkup(<YoroAccountPage />);

  assert.match(markup, /연결된 계정/u);
  assert.match(markup, /Discord와 Twitch는 로그인 수단/u);
  assert.doesNotMatch(markup, /providerSubject/u);
});

test("공개 헤더용 계정 선택기는 실제 인증에 사용한 Discord·Twitch identity를 우선한다", async () => {
  const { authenticatedYoroIdentity } = await import(
    "../src/features/yoro-account/useYoroAccountSession"
  );
  const discordIdentity = {
    provider: "discord" as const,
    displayName: "Discord 사용자",
    avatarUrl: "https://cdn.discordapp.com/avatars/1/avatar.png?size=64",
    connectedAt: "2026-07-29T00:00:00.000Z",
    lastAuthenticatedAt: "2026-07-29T00:00:00.000Z"
  };
  const twitchIdentity = {
    provider: "twitch" as const,
    displayName: "Twitch 사용자",
    connectedAt: "2026-07-29T00:00:00.000Z",
    lastAuthenticatedAt: "2026-07-29T00:00:00.000Z"
  };

  assert.deepEqual(authenticatedYoroIdentity({
    authenticated: true,
    authenticationProvider: "discord",
    csrfToken: "csrf",
    identities: [twitchIdentity, discordIdentity],
    preferences: {
      locale: "ko",
      defaultDashboardPage: "overview",
      reducedMotion: false
    }
  }), discordIdentity);
  assert.equal(authenticatedYoroIdentity({ authenticated: false }), undefined);
});

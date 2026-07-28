import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    location: { search: "" },
    navigator: { language: "ko-KR" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    }
  }
});

test("Discord 설정 화면은 초기 loading과 한국어·일본어 접근성 문구를 함께 제공한다", async () => {
  const { DiscordSetupPage } = await import("../src/features/discord-onboarding/DiscordSetupPage");
  const markup = renderToStaticMarkup(<DiscordSetupPage />);
  assert.match(markup, /Discord 연결 설정/u);
  assert.match(markup, /Discord 連携設定/u);
  assert.match(markup, /aria-busy="true"/u);
  assert.match(markup, /Discord 연결 상태를 확인하는 중입니다/u);
  assert.doesNotMatch(markup, /accessToken|refreshToken|organizationId|csrfToken/u);
});

test("Discord OAuth 시작 URL은 setup token 외 상태를 추가하지 않는다", async () => {
  const { discordOAuthStartUrl } = await import("../src/features/discord-onboarding/api");
  const token = "a".repeat(43);
  const url = new URL(discordOAuthStartUrl(token), "https://yoro.gg");
  assert.equal(url.pathname, "/api/discord/oauth/start");
  assert.deepEqual([...url.searchParams.keys()], ["setup"]);
  assert.equal(url.searchParams.get("setup"), token);
});

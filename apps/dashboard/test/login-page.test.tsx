import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    location: {
      href: "http://localhost:5173/admin",
      search: ""
    },
    navigator: { language: "ko-KR" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    }
  }
});

test("관리자 로그인은 Twitch를 주 진입점으로 제공하고 토큰 폼을 기본적으로 접어 둔다", async () => {
  const { LoginPage } = await import("../src/components/LoginPage");
  const markup = renderToStaticMarkup(
    <LoginPage
      checking={false}
      error=""
      locale="ko"
      onLogin={async () => undefined}
    />
  );
  const japaneseMarkup = renderToStaticMarkup(
    <LoginPage
      checking={false}
      error=""
      locale="ja"
      onLogin={async () => undefined}
    />
  );
  const source = await readFile(
    new URL("../src/components/LoginPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(markup, /Twitch로 로그인/u);
  assert.match(markup, /토큰으로 로그인/u);
  assert.match(markup, /aria-expanded="false"/u);
  assert.doesNotMatch(markup, /type="password"/u);
  assert.match(source, /publicTwitchLoginUrl\("\/admin"\)/u);
  assert.match(source, /window\.location\.href/u);
  assert.match(source, /type="password"/u);
  assert.match(japaneseMarkup, /Twitchでログイン/u);
  assert.match(japaneseMarkup, /トークンでログイン/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let storedLocale: "ko" | "ja" | null = null;

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    location: { search: "", assign: () => undefined },
    navigator: { language: "ko-KR" },
    localStorage: {
      getItem: () => storedLocale,
      setItem: (_key: string, value: string) => {
        storedLocale = value === "ja" ? "ja" : "ko";
      }
    },
    setTimeout,
    clearTimeout
  }
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    language: "ko-KR",
    clipboard: { writeText: async () => undefined }
  }
});

test("Bot 관리 화면은 초기 상태와 한국어·일본어 접근성 문구를 함께 제공한다", async () => {
  const { BotManagementPage } = await import(
    "../src/features/bot-management/BotManagementPage"
  );
  storedLocale = "ko";
  const koMarkup = renderToStaticMarkup(<BotManagementPage />);
  storedLocale = "ja";
  const jaMarkup = renderToStaticMarkup(<BotManagementPage />);
  assert.match(koMarkup, /Organization 관리/u);
  assert.match(jaMarkup, /Organization 管理/u);
  assert.match(koMarkup, /aria-busy="true"/u);
  assert.match(koMarkup, /Organization 관리 정보를 불러오는 중입니다/u);
  assert.doesNotMatch(koMarkup, /installToken|csrfToken|accessToken|refreshToken/u);
  assert.doesNotMatch(koMarkup, /docker run|:latest/u);
});

test("관리 로그인 URL은 고정된 내부 OAuth 시작 경로만 사용한다", async () => {
  const { managementLoginUrl } = await import("../src/features/bot-management/api");
  const url = new URL(managementLoginUrl(), "https://yoro.gg");
  assert.equal(url.pathname, "/api/discord/management/oauth/start");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});

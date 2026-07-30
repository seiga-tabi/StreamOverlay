import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: { lang: "ko" }
  }
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "ko-KR" }
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    location: {
      origin: "https://yoro.gg",
      pathname: "/bot"
    },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    }
  }
});

test("YORO Bot 소개 페이지는 중앙 Hero와 3개 독립 페이지 메뉴를 제공한다", async () => {
  const { PublicBotPage } = await import("../src/features/public-bot/PublicBotPage");
  window.location.pathname = "/bot";
  const markup = renderToStaticMarkup(<PublicBotPage />);

  assert.match(markup, /게임 서버 운영을 Discord에서 더 간단하게/u);
  assert.match(markup, /Discord 연결 기반 준비됨/u);
  assert.match(markup, /설정 명령 구현됨 · 운영 활성화 필요/u);
  assert.doesNotMatch(markup, /public-bot-header-status/u);
  assert.match(markup, /public-twitch-login-chip[\s\S]*?>로그인<\/strong>/u);
  assert.match(markup, /Discord 서버에 YORO Bot 추가/u);
  assert.match(markup, /href="\/api\/discord\/bot\/install"/u);
  assert.match(markup, /target="_blank"/u);
  assert.match(markup, /rel="noopener noreferrer"/u);
  assert.match(markup, /aria-label="Discord 서버에 YORO Bot 추가 \(새 탭에서 열림\)"/u);
  assert.match(markup, /href="\/dashboard"/u);
  assert.match(markup, /Palworld REST 직접 연결 기반은 구현/u);
  assert.match(markup, /OAuth token 평문 미저장/u);
  assert.match(markup, /aria-label="YORO Bot 홈"/u);
  assert.match(markup, /href="\/bot\/features"/u);
  assert.match(markup, /href="\/bot\/connect"/u);
  assert.doesNotMatch(markup, /href="#bot-(?:overview|features|flow|security)"/u);
  assert.match(markup, /discord-symbol-blurple\.f6c1a66250d3\.png/u);
  assert.doesNotMatch(markup, /class="public-bot-node is-discord">D</u);
  assert.doesNotMatch(markup, /accessToken|refreshToken|clientSecret|setupToken/u);
});

test("YORO Bot 기능과 연결 과정은 URL별 독립 콘텐츠로 렌더링된다", async () => {
  const {
    PublicBotPage,
    publicBotSectionFromPath
  } = await import("../src/features/public-bot/PublicBotPage");

  assert.equal(publicBotSectionFromPath("/bot"), "overview");
  assert.equal(publicBotSectionFromPath("/bot/features/"), "features");
  assert.equal(publicBotSectionFromPath("/bot/connect"), "connect");

  window.location.pathname = "/bot/features";
  const featureMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.match(featureMarkup, /현재 사용할 수 있는 기반/u);
  assert.match(featureMarkup, /Organization 관리/u);
  assert.match(featureMarkup, /안전한 Discord 연결/u);
  assert.match(featureMarkup, /aria-current="page"[^>]*href="\/bot\/features"/u);
  assert.doesNotMatch(featureMarkup, /게임 서버 운영을 Discord에서 더 간단하게/u);
  assert.doesNotMatch(featureMarkup, /복구용 일회성 링크/u);

  window.location.pathname = "/bot/connect";
  const connectMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.match(connectMarkup, /연결 과정/u);
  assert.match(connectMarkup, /YORO Bot 추가/u);
  assert.match(connectMarkup, /Discord 로그인/u);
  assert.match(connectMarkup, /복구용 일회성 링크/u);
  assert.match(connectMarkup, /aria-current="page"[^>]*href="\/bot\/connect"/u);
  assert.doesNotMatch(connectMarkup, /Organization 관리/u);
});

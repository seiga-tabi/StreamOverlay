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

test("YORO Bot 소개 페이지는 서비스형 Hero와 4개 독립 페이지 메뉴를 제공한다", async () => {
  const { PublicBotPage } = await import("../src/features/public-bot/PublicBotPage");
  window.location.pathname = "/bot";
  const markup = renderToStaticMarkup(<PublicBotPage />);

  assert.match(markup, /Discord 안에서/u);
  assert.match(markup, /게임 서버 운영을/u);
  assert.match(markup, /더 간단하게/u);
  assert.match(markup, /YORO Bot으로 할 수 있는 것/u);
  assert.match(markup, /Discord에서 보이는 화면/u);
  assert.match(markup, /예시 데이터/u);
  assert.match(markup, /실제 값은 등록된 서버의 REST 응답에 따라 달라집니다/u);
  assert.match(markup, /보안 중심 설계/u);
  assert.match(markup, /현재 제공하는 기능과 준비 중인 기능/u);
  assert.match(markup, /Minecraft 서버 연동/u);
  assert.doesNotMatch(markup, /다음 구현 단계/u);
  assert.doesNotMatch(markup, /public-bot-header-status/u);
  assert.match(markup, /public-twitch-login-chip[\s\S]*?>로그인<\/strong>/u);
  assert.match(markup, /Discord 서버에 YORO Bot 추가/u);
  assert.match(markup, /href="\/api\/discord\/bot\/install"/u);
  assert.match(markup, /target="_blank"/u);
  assert.match(markup, /rel="noopener noreferrer"/u);
  assert.match(markup, /aria-label="Discord 서버에 YORO Bot 추가 \(새 탭에서 열림\)"/u);
  assert.match(markup, /href="\/dashboard"/u);
  assert.match(markup, /Palworld REST 상태·플레이어 조회/u);
  assert.match(markup, /OAuth token 평문 미저장/u);
  assert.match(markup, /aria-label="YORO Bot 홈"/u);
  assert.match(markup, /href="\/ko\/bot\/getting-started"/u);
  assert.match(markup, /href="\/ko\/bot\/commands"/u);
  assert.match(markup, /href="\/ko\/bot\/game-files"/u);
  assert.doesNotMatch(markup, /href="#bot-(?:overview|features|flow|security)"/u);
  assert.match(markup, /discord-symbol-blurple\.f6c1a66250d3\.png/u);
  assert.doesNotMatch(markup, /class="public-bot-node is-discord">D</u);
  assert.doesNotMatch(markup, /accessToken|refreshToken|clientSecret|setupToken/u);
});

test("YORO Bot 사용방법·명령어·게임파일은 canonical URL별 독립 콘텐츠로 렌더링된다", async () => {
  const {
    PublicBotPage,
    publicBotCommandIdsByTab,
    publicBotSectionFromPath
  } = await import("../src/features/public-bot/PublicBotPage");

  assert.equal(publicBotSectionFromPath("/bot"), "overview");
  assert.equal(publicBotSectionFromPath("/bot/getting-started/"), "gettingStarted");
  assert.equal(publicBotSectionFromPath("/bot/commands"), "commands");
  assert.equal(publicBotSectionFromPath("/bot/game-files/"), "gameFiles");
  assert.equal(publicBotSectionFromPath("/ko/bot/features"), "commands");
  assert.equal(publicBotSectionFromPath("/ja/bot/dedicated-server"), "gameFiles");

  window.location.pathname = "/bot/commands";
  const commandMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.match(commandMarkup, /Discord 명령어/u);
  assert.match(commandMarkup, /role="tablist"/u);
  assert.match(commandMarkup, /유저 명령어/u);
  assert.match(commandMarkup, /관리자 명령어/u);
  assert.doesNotMatch(commandMarkup, /명령어 검색/u);
  assert.deepEqual(publicBotCommandIdsByTab.user, ["status", "player", "guide", "dashboard", "help"]);
  assert.deepEqual(publicBotCommandIdsByTab.admin, ["setup", "language"]);
  assert.match(commandMarkup, /COMMAND DETAIL/u);
  assert.match(commandMarkup, /\/yoro status/u);
  assert.match(commandMarkup, /!yoro status/u);
  assert.doesNotMatch(commandMarkup, /!yoro 상태/u);
  assert.match(commandMarkup, /\/yoro player/u);
  assert.doesNotMatch(commandMarkup, /\/yoro setup/u);
  assert.match(commandMarkup, /Discord 응답 미리보기/u);
  assert.match(commandMarkup, /표시 값은 문서용 예시/u);
  assert.match(commandMarkup, /지원 명령과 세부 조건 보기/u);
  assert.doesNotMatch(commandMarkup, /\/yoro server status/u);
  assert.match(commandMarkup, /aria-current="page"[^>]*href="\/ko\/bot\/commands"/u);
  assert.doesNotMatch(commandMarkup, /게임 서버 운영을 Discord에서 더 간단하게/u);

  window.location.pathname = "/ja/bot/commands";
  const japaneseCommandMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.match(japaneseCommandMarkup, /Discordコマンド/u);
  assert.match(japaneseCommandMarkup, /ユーザーコマンド/u);
  assert.match(japaneseCommandMarkup, /管理者コマンド/u);
  assert.doesNotMatch(japaneseCommandMarkup, /コマンド検索/u);
  assert.match(japaneseCommandMarkup, /!yoro status/u);
  assert.doesNotMatch(japaneseCommandMarkup, /!yoro 状態/u);
  assert.match(japaneseCommandMarkup, /Discord応答プレビュー/u);

  window.location.pathname = "/bot/getting-started";
  const connectMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.match(connectMarkup, /연결 과정/u);
  assert.match(connectMarkup, /YORO Bot 추가/u);
  assert.match(connectMarkup, /Palworld REST 등록/u);
  assert.match(connectMarkup, /Discord Bot 제어/u);
  assert.match(connectMarkup, /복구용 일회성 링크/u);
  assert.match(connectMarkup, /aria-current="page"[^>]*href="\/ko\/bot\/getting-started"/u);

  window.location.pathname = "/bot/game-files";
  const dedicatedServerMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.match(dedicatedServerMarkup, /전용 서버 설정 만들기/u);
  assert.match(dedicatedServerMarkup, /PalWorldSettings\.ini/u);
  assert.match(dedicatedServerMarkup, /입력값은 YORO 서버로 전송하거나 계정에 저장하지 않습니다/u);
  assert.match(dedicatedServerMarkup, /aria-current="page"[^>]*href="\/ko\/bot\/game-files"/u);
  assert.match(dedicatedServerMarkup, /type="password"/u);
  assert.match(dedicatedServerMarkup, /REST API/u);
  assert.match(dedicatedServerMarkup, /RCON/u);
  assert.doesNotMatch(dedicatedServerMarkup, /accessToken|refreshToken|clientSecret|setupToken/u);
});

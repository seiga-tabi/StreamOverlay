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
  /* 리디자인(2026-08-19): 히어로 Embed 와 같은 내용을 두 번 보여주던
     "Discord에서 보이는 화면" 별도 섹션은 제거했습니다 — 프리뷰는 히어로 1곳. */
  assert.doesNotMatch(markup, /Discord에서 보이는 화면/u);
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
  assert.doesNotMatch(connectMarkup, /public-bot-onboarding__hero/u);
  assert.doesNotMatch(connectMarkup, /5분 안에 Discord와 게임 서버를 연결하세요/u);
  assert.match(connectMarkup, /YORO Bot 추가/u);
  assert.match(connectMarkup, /로그인 및 Organization 연결/u);
  assert.match(connectMarkup, /Palworld REST 연결/u);
  assert.match(connectMarkup, /사용할 명령 활성화/u);
  assert.match(connectMarkup, /Discord에서 사용 시작/u);
  assert.match(connectMarkup, /완료 결과/u);
  assert.match(connectMarkup, /연결이 끝나면 이렇게 보입니다/u);
  assert.match(connectMarkup, /public-bot-onboarding__progress/u);
  assert.match(connectMarkup, /public-bot-onboarding__timeline/u);
  assert.match(connectMarkup, /public-bot-onboarding__preview/u);
  assert.match(connectMarkup, /href="\/ko\/bot\/commands"/u);
  assert.match(connectMarkup, /복구용 일회성 링크/u);
  assert.match(connectMarkup, /aria-current="page"[^>]*href="\/ko\/bot\/getting-started"/u);
  assert.ok(
    connectMarkup.indexOf("YORO Bot 추가")
      < connectMarkup.indexOf("로그인 및 Organization 연결"),
  );
  assert.ok(
    connectMarkup.indexOf("로그인 및 Organization 연결")
      < connectMarkup.indexOf("Palworld REST 연결"),
  );

  window.location.pathname = "/ja/bot/getting-started";
  const japaneseConnectMarkup = renderToStaticMarkup(<PublicBotPage />);
  assert.doesNotMatch(japaneseConnectMarkup, /public-bot-onboarding__hero/u);
  assert.doesNotMatch(japaneseConnectMarkup, /5分でDiscordとゲームサーバーを連携しましょう/u);
  assert.match(japaneseConnectMarkup, /ログインとOrganization連携/u);
  assert.match(japaneseConnectMarkup, /完了結果/u);
  assert.match(japaneseConnectMarkup, /連携完了後はこのように表示されます/u);
  assert.match(japaneseConnectMarkup, /href="\/ja\/bot\/commands"/u);

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

test("공개 게임 헤더는 Twitch 로그인 가용성을 서버 실값으로만 판정한다", async () => {
  /* 회귀 고정 — Bot 만 configured 를 하드코딩 true 로 두어, Twitch 앱이 미설정인
     환경에서도 로그인 버튼이 활성으로 보였습니다. 계정 OAuth 와 공개 뷰어 상태는
     같은 자격증명(appConfig.twitch.clientId/clientSecret/publicRedirectUri)을 쓰므로
     configured=false 면 계정 로그인도 반드시 실패합니다 — 별도 필드가 아니라
     같은 값을 게이트로 써야 합니다. */
  const { readFile } = await import("node:fs/promises");
  const sources = await Promise.all([
    readFile(new URL("../src/features/public-bot/PublicBotPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/public-palworld/components/PalworldHeader.tsx", import.meta.url), "utf8"),
  ]);

  for (const source of sources) {
    /* 값 없는 `configured` 는 JSX 에서 true 와 같습니다 — 하드코딩 금지. */
    assert.doesNotMatch(
      source,
      /<PublicTwitchAccount(?:Chip|Panel)\b[^>]*?\n\s*configured\s*\n/u,
      "configured 를 하드코딩하지 말고 서버 실값을 전달해야 합니다.",
    );
    assert.doesNotMatch(source, /configured=\{true\}/u);
  }

  const botSource = sources[0];
  assert.match(botSource, /twitchConfigured,/u);
  assert.match(botSource, /configured=\{twitchConfigured\}/u);
  /* 칩(데스크톱)과 패널(모바일 메뉴) 두 곳 모두 같은 값을 씁니다. */
  assert.equal((botSource.match(/configured=\{twitchConfigured\}/gu) ?? []).length, 2);
});

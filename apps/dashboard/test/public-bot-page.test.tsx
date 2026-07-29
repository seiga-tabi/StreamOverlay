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
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    }
  }
});

test("YORO Bot 페이지는 구현 완료 기능과 준비 중 기능을 구분한다", async () => {
  const { PublicBotPage } = await import("../src/features/public-bot/PublicBotPage");
  const markup = renderToStaticMarkup(<PublicBotPage />);

  assert.match(markup, /게임 서버 운영을 Discord에서 더 간단하게/u);
  assert.match(markup, /Discord 연결 기반 준비됨/u);
  assert.match(markup, /설정 명령 구현됨 · 운영 활성화 필요/u);
  assert.match(markup, /Discord 서버에 YORO Bot 추가/u);
  assert.match(markup, /href="\/api\/discord\/bot\/install"/u);
  assert.match(markup, /href="\/bot\/manage"/u);
  assert.match(markup, /복구용 일회성 링크/u);
  assert.match(markup, /Agent daemon과 상태 Ingestion 기반이 구현/u);
  assert.match(markup, /Organization 관리/u);
  assert.match(markup, /OAuth token 평문 미저장/u);
  assert.match(markup, /aria-label="YORO Bot 홈"/u);
  assert.doesNotMatch(markup, /accessToken|refreshToken|clientSecret|setupToken/u);
});

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { ValorantBottomTabBar } from "../src/features/public-valorant/components/ValorantBottomTabBar";
import { ValorantComingSoonPage } from "../src/features/public-valorant/components/ValorantComingSoonPage";
import { ValorantHeader, valorantNavItems } from "../src/features/public-valorant/components/ValorantHeader";
import { ValorantHome } from "../src/features/public-valorant/components/ValorantHome";
import { ValorantNotFoundPage } from "../src/features/public-valorant/components/ValorantNotFoundPage";
import {
  isValorantPath,
  valorantPageFromPath,
  valorantPathForPage,
} from "../src/features/public-valorant/utils/routes";
import { valorantSeoMetadata } from "../src/features/public-valorant/utils/seo";

test("발로란트 라우트는 ko·ja prefix와 알 수 없는 경로를 구분한다", () => {
  assert.equal(isValorantPath("/valorant"), true);
  assert.equal(isValorantPath("/valorant/"), true);
  assert.equal(isValorantPath("/ja/valorant/agents"), true);
  assert.equal(isValorantPath("/palworld"), false);
  assert.equal(isValorantPath("/valorantx"), false);
  assert.equal(valorantPageFromPath("/valorant"), "home");
  assert.equal(valorantPageFromPath("/ja/valorant/ranked"), "ranked");
  assert.equal(valorantPageFromPath("/valorant/agents/jett"), null);
  assert.equal(valorantPathForPage("weapons"), "/valorant/weapons");
});

test("발로란트 SEO 메타는 페이지·언어별 canonical을 만든다", () => {
  const ko = valorantSeoMetadata("home", "ko");
  assert.equal(ko.canonicalUrl, "https://yoro.gg/ko/valorant");
  assert.match(ko.title, /발로란트 \| YORO\.gg/u);
  const ja = valorantSeoMetadata("agents", "ja");
  assert.equal(ja.canonicalUrl, "https://yoro.gg/ja/valorant/agents");
  assert.match(ja.title, /エージェント \| YORO\.gg/u);
});

test("발로란트 홈은 전적 3단 모델과 RSO 정책 경계를 한국어·일본어로 설명한다", () => {
  setActivePublicLocale("ko");
  const korean = renderToStaticMarkup(<ValorantHome locale="ko" />);
  assert.match(korean, /스트리머 전적부터 요원 데이터까지/u);
  assert.match(korean, /스트리머 전적/u);
  assert.match(korean, /내 전적/u);
  assert.match(korean, /경쟁전 리더보드/u);
  assert.match(korean, /본인이 동의\(RSO\)한 계정의 전적만 공개/u);
  assert.match(korean, /준비 중 — Riot 프로덕션 승인 진행 단계/u);
  /* 준비 단계라 가짜 표본 전적(KDA·RR·티어 수치)·동작하지 않는 로그인 CTA를 두지 않습니다. */
  assert.doesNotMatch(korean, /KDA|\d+ RR|불멸|초월자/u);
  assert.doesNotMatch(korean, /<button/u);

  const japanese = renderToStaticMarkup(<ValorantHome locale="ja" />);
  assert.match(japanese, /配信者の戦績からエージェントデータまで/u);
  assert.match(japanese, /本人が同意\(RSO\)したアカウントの戦績のみ公開/u);
});

test("발로란트 데이터 화면은 정직한 준비 중 상태와 홈 복귀 동작을 제공한다", () => {
  setActivePublicLocale("ko");
  for (const page of ["agents", "weapons", "maps", "ranked"] as const) {
    const korean = renderToStaticMarkup(<ValorantComingSoonPage locale="ko" page={page} />);
    assert.match(korean, /준비하고 있습니다/u);
    assert.match(korean, /발로란트 홈으로/u);
    const japanese = renderToStaticMarkup(<ValorantComingSoonPage locale="ja" page={page} />);
    assert.match(japanese, /準備しています/u);
    assert.match(japanese, /VALORANT ホームへ/u);
  }
  const ranked = renderToStaticMarkup(<ValorantComingSoonPage locale="ko" page="ranked" />);
  assert.match(ranked, /익명으로 표시됩니다/u);
});

test("발로란트 헤더 nav는 5개 항목과 활성 상태를 유지하고 게임 선택기에 발로란트가 있다", () => {
  setActivePublicLocale("ko");
  assert.equal(valorantNavItems.length, 5);
  const markup = renderToStaticMarkup(
    <ValorantHeader locale="ko" onLocale={() => undefined} page="agents" />,
  );
  assert.match(markup, /data-testid="valorant-secondary-nav"/u);
  for (const item of valorantNavItems) {
    assert.match(markup, new RegExp(`data-ko="${item.ko}"`, "u"));
    assert.match(markup, new RegExp(`data-ja="${item.ja}"`, "u"));
  }
  assert.match(markup, /aria-current="page"[^>]*data-ko="요원"|data-ko="요원"[^>]*aria-current="page"/u);
  assert.match(markup, /발로란트/u);
  assert.doesNotMatch(markup, /src="https?:\/\//u);
});

test("발로란트 하단 탭바는 5칸이며 더보기 시트가 없다", () => {
  setActivePublicLocale("ko");
  const markup = renderToStaticMarkup(<ValorantBottomTabBar locale="ko" page="ranked" />);
  assert.equal((markup.match(/public-bottom-tab-bar__item/gu) ?? []).length, 5);
  assert.match(markup, /data-testid="valorant-bottom-tab-bar"/u);
  assert.match(markup, /aria-current="page"[^>]*data-ko="랭킹"|data-ko="랭킹"[^>]*aria-current="page"/u);
  assert.doesNotMatch(markup, /더보기|aria-haspopup/u);
  const japanese = renderToStaticMarkup(<ValorantBottomTabBar locale="ja" page="home" />);
  assert.match(japanese, /エージェント/u);
  assert.match(japanese, /ランキング/u);
});

test("발로란트 404 화면은 한국어·일본어 안내와 홈 복귀를 제공한다", () => {
  const korean = renderToStaticMarkup(<ValorantNotFoundPage locale="ko" />);
  assert.match(korean, /페이지를 찾을 수 없습니다\./u);
  assert.match(korean, /data-ja="ページが見つかりません。"/u);
  assert.match(korean, /발로란트 홈으로/u);
});

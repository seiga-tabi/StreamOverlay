import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PalworldBottomTabBar } from "../src/features/public-palworld/components/PalworldBottomTabBar";

const palworldPage = readFileSync(
  new URL("../src/pages/PublicPalworldPage.tsx", import.meta.url),
  "utf8"
);
const headerSource = readFileSync(
  new URL("../src/features/public-palworld/components/PalworldHeader.tsx", import.meta.url),
  "utf8"
);

/* LoL 탭바에서 실제로 났던 사고의 재발 방지: 탭바가 헤더 안으로 들어가면
   헤더의 backdrop-filter 가 position:fixed 기준이 되어 화면 하단에서 떨어집니다.
   jsdom 은 배치를 계산하지 않으므로 구조(헤더 밖 렌더링)를 소스로 단언합니다. */
test("Palworld 하단 탭바는 헤더가 아니라 AppShell 직계 자식으로 렌더링한다", () => {
  assert.doesNotMatch(headerSource, /<PalworldBottomTabBar/u);
  assert.match(palworldPage, /<\/AppShellMain>[\s\S]{0,400}<PalworldBottomTabBar\b/u);
});

test("탭바는 핵심 4개 + 더보기로 구성되고 교배는 짧은 라벨을 쓴다", () => {
  const html = renderToStaticMarkup(<PalworldBottomTabBar locale="ko" page="home" />);

  // 상시 노출 4칸 + 더보기
  assert.match(html, /홈/);
  assert.match(html, /Pal 도감/);
  assert.match(html, /지도/);
  assert.match(html, /더보기/);
  // 탭바의 교배 라벨은 전체 라벨("교배 조합")이 아니라 짧은 라벨입니다.
  assert.match(html, />교배</);
  assert.doesNotMatch(html, /교배 조합/);
  // 더보기 항목(아이템·기술·스킬)은 시트가 닫혀 있으면 렌더되지 않습니다.
  assert.doesNotMatch(html, /아이템|기술 해금|스킬/);
  // 활성 탭과 더보기 트리거의 접근성 계약
  assert.match(html, /aria-current="page"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
});

test("일본어 탭바는 配合 짧은 라벨을 쓰고 その他 트리거를 제공한다", () => {
  const html = renderToStaticMarkup(<PalworldBottomTabBar locale="ja" page="breeding" />);

  assert.match(html, /ホーム/);
  assert.match(html, /パル図鑑/);
  assert.match(html, />配合</);
  assert.doesNotMatch(html, /配合組み合わせ/);
  assert.match(html, /マップ/);
  assert.match(html, /その他/);
});

test("더보기 안 항목이 활성이면 더보기 탭이 활성색을 이어받는다", () => {
  const html = renderToStaticMarkup(<PalworldBottomTabBar locale="ko" page="technology" />);

  // technology 는 탭바에 없으므로 aria-current 탭은 없고,
  const currentMatches = html.match(/aria-current="page"/gu) ?? [];
  assert.equal(currentMatches.length, 0);
  // 더보기 트리거가 active 클래스를 가집니다.
  assert.match(html, /aria-controls="palworld-more-menu"[^>]*class="public-bottom-tab-bar__item active"/u);
});

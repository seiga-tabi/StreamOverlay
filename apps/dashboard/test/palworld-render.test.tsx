import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicGameSelector } from "../src/features/public-lol/components/PublicGameSelector";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { PalworldHeader } from "../src/features/public-palworld/components/PalworldHeader";
import { PalworldPalsPage } from "../src/features/public-palworld/components/PalworldPalsPage";

test("게임 선택 메뉴에는 LoL과 펠월드 두 항목만 표시한다", () => {
  setActivePublicLocale("ko");
  const html = renderToStaticMarkup(<PublicGameSelector activePage="palworld" onPage={() => undefined} mode="tray" />);
  assert.equal((html.match(/role="option"/g) ?? []).length, 2);
  assert.match(html, /리그 오브 레전드/);
  assert.match(html, /펠월드/);
  assert.doesNotMatch(html, /발로란트|마인크래프트/);
});

test("펠월드 홈 헤더에는 상단 검색이 없고 하위 페이지에는 표시한다", () => {
  setActivePublicLocale("ko");
  const home = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="home" />);
  const child = renderToStaticMarkup(<PalworldHeader locale="ko" onLocale={() => undefined} page="pals" searchContent={<div data-testid="header-search">검색</div>} />);
  assert.doesNotMatch(home, /data-testid="header-search"/);
  assert.match(child, /data-testid="header-search"/);
  assert.match(child, /data-testid="palworld-secondary-nav"/);
  assert.match(child, /aria-current="page"[^>]*data-ko="Pal 도감"/);
});

test("Pal 필터는 URL query 값을 선택 상태로 렌더하고 전체 희귀도를 제공한다", () => {
  const html = renderToStaticMarkup(<PalworldPalsPage locale="ja" params={new URLSearchParams("element=fire&work=mining&sort=number&rarity=10")} onOpenPal={() => undefined} />);
  assert.match(html, /value="fire" selected=""/);
  assert.match(html, /value="mining" selected=""/);
  assert.match(html, /value="10" selected=""/);
  assert.match(html, /value="20"/);
  assert.match(html, /パル図鑑/);
});

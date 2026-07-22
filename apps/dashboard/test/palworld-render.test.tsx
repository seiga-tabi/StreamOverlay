import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PalworldDomainCoverage } from "@streamops/shared";
import { PublicGameSelector } from "../src/features/public-lol/components/PublicGameSelector";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { PalworldHeader } from "../src/features/public-palworld/components/PalworldHeader";
import { PalCard } from "../src/features/public-palworld/components/PalworldCards";
import { PalworldMedia } from "../src/features/public-palworld/components/PalworldMedia";
import { PalworldDomainCoverageNotice } from "../src/features/public-palworld/components/PalworldCoverageNotice";
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

test("이미지 없는 Pal은 카드 높이를 유지하는 한국어·일본어 대체 표시를 렌더한다", () => {
  const korean = renderToStaticMarkup(<PalworldMedia alt="도로롱" locale="ko" kind="pal" />);
  const japanese = renderToStaticMarkup(<PalworldMedia alt="モコロン" locale="ja" kind="pal" />);
  assert.match(korean, /role="img"/);
  assert.match(korean, /aria-label="도로롱 · 이미지 준비 중"/);
  assert.match(korean, /data-ko="이미지 준비 중"/);
  assert.match(japanese, /aria-label="モコロン · 画像準備中"/);
});

test("Pal 카드 이미지 alt는 현재 locale 이름을 사용하고 동일 출처 경로를 유지한다", () => {
  const imageUrl = `/images/palworld/1.0.1/pals/${"a".repeat(64)}.webp`;
  const pal = {
    id: "lamball",
    number: 1,
    nameKo: "도로롱",
    nameJa: "モコロン",
    nameEn: "Lamball",
    imageUrl,
    elements: ["neutral" as const],
    rarity: 1,
    variantType: "normal" as const,
    workSuitabilities: [{ type: "handiwork" as const, level: 1 }]
  };
  const korean = renderToStaticMarkup(<PalCard locale="ko" pal={pal} onOpen={() => undefined} />);
  const japanese = renderToStaticMarkup(<PalCard locale="ja" pal={pal} onOpen={() => undefined} />);
  assert.match(korean, new RegExp(`src="${imageUrl.replaceAll("/", "\\/")}" alt="도로롱"`));
  assert.match(japanese, /alt="モコロン"/);
});

test("이미지 URL이 없는 Pal 287종은 모두 접근 가능한 대체 이미지를 렌더한다", () => {
  const html = renderToStaticMarkup(<>{Array.from({ length: 287 }, (_, index) => (
    <PalworldMedia alt={`Pal ${index + 1}`} locale="ko" kind="pal" key={index} />
  ))}</>);
  assert.equal((html.match(/role="img"/g) ?? []).length, 287);
  assert.equal((html.match(/data-ko="이미지 준비 중"/g) ?? []).length, 287);
  assert.doesNotMatch(html, /<img/u);
});

test("아이템과 교배의 샘플 출처를 한국어·일본어 안내와 배지로 표시한다", () => {
  const metadata = {
    gameVersion: "sample-baseline",
    sourceName: "StreamOverlay curated sample snapshot",
    sourceUrl: "https://example.com/palworld-sample",
    sourceRevision: "sample-revision",
    extractedAt: "2026-07-21T00:00:00.000Z",
    verifiedAt: "2026-07-21T00:00:00.000Z",
    license: "Test-only fixture",
  };
  const itemsCoverage: PalworldDomainCoverage = { status: "sample", recordCount: 10, metadata };
  const breedingCoverage: PalworldDomainCoverage = { status: "sample", recordCount: 3, metadata };
  const korean = renderToStaticMarkup(<PalworldDomainCoverageNotice coverage={itemsCoverage} domain="items" locale="ko" />);
  const japanese = renderToStaticMarkup(<PalworldDomainCoverageNotice coverage={breedingCoverage} domain="breeding" locale="ja" />);
  const unknown = renderToStaticMarkup(<PalworldDomainCoverageNotice domain="items" locale="ko" />);
  assert.match(korean, /data-testid="palworld-items-coverage"/);
  assert.match(korean, /data-ko="샘플"/);
  assert.match(korean, /Pal 1.0.1 전체 아이템 데이터가 아닙니다/);
  assert.match(korean, /StreamOverlay curated sample snapshot · sample-revision/);
  assert.match(japanese, /data-testid="palworld-breeding-coverage"/);
  assert.match(japanese, /data-ja="サンプル"/);
  assert.match(japanese, /パル1.0.1の全配合データではありません/);
  assert.match(unknown, /범위 확인 중/);
  assert.match(unknown, /전체 데이터로 표시하지 않습니다/);
});

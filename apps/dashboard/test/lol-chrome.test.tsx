import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LolChrome, lolSubnavActive } from "../src/features/public-home/components/LolChrome";
import type { LolSubnavItem } from "../src/features/public-home/components/LolHomeSections";

/* LoL 상단바 한 벌(LolChrome) — 1행+2행 조립 계약을 단언합니다(통합 프롬프트 §3-1).
 * 개별 컴포넌트의 세부 계약은 public-lol-home-page.test.tsx(HomeHeader·LolSubnav)가
 * 이미 다루므로 여기서는 조립(둘이 같이, 순서대로, 활성 하나)만 봅니다. */

const noop = () => undefined;

function renderChrome(active: LolSubnavItem | "none", extra?: { className?: string; children?: React.ReactNode }) {
  return renderToStaticMarkup(
    <LolChrome
      active={active}
      className={extra?.className}
      connected={false}
      locale="ko"
      onLocale={noop}
      onLoginOpen={noop}
      onLogout={noop}
      onToggleTheme={noop}
    >
      {extra?.children}
    </LolChrome>
  );
}

test("LolChrome 은 1행 헤더와 2행 LoL 메뉴를 yoro-home-chrome 래퍼 안에 같이 렌더한다", () => {
  const html = renderChrome("home");
  assert.match(html, /class="yoro-app-shell__header yoro-home-chrome"/u);
  assert.match(html, /yoro-home-header/u);
  assert.match(html, /yoro-lol-subnav/u);
  /* 1행이 2행보다 앞 */
  assert.ok(html.indexOf("yoro-home-header") < html.indexOf("yoro-lol-subnav"));
  /* 1행 게임 트리거는 LoL 활성 고정 */
  assert.match(html, /yoro-home-games-trigger-name/u);
});

test("다섯 active 값 각각에서 2행 항목이 5개·순서 고정이고 활성이 정확히 하나다", () => {
  const order = ["홈", "스트리머", "시청자 참여", "증강 칼바람", "패치노트"];
  const actives: LolSubnavItem[] = ["home", "streamers", "participation", "aram", "patchNotes"];
  for (const active of actives) {
    const html = renderChrome(active);
    const items = html.match(/yoro-lol-subnav-item/gu) ?? [];
    assert.equal(items.length, 5, `active=${active}: 항목 5개`);
    assert.equal((html.match(/yoro-lol-subnav-item is-active/gu) ?? []).length, 1, `active=${active}: 활성 1개`);
    assert.equal((html.match(/aria-current="page"[^>]*class="yoro-lol-subnav-item/gu) ?? []).length, 1);
    let cursor = html.indexOf("yoro-lol-subnav");
    for (const label of order) {
      const next = html.indexOf(`>${label}<`, cursor);
      assert.ok(next > cursor, `active=${active}: ${label} 순서`);
      cursor = next;
    }
  }
});

test('active="none" 이면 2행에 활성 항목이 없다', () => {
  const html = renderChrome("none");
  assert.equal((html.match(/yoro-lol-subnav-item is-active/gu) ?? []).length, 0);
  assert.doesNotMatch(html, /yoro-lol-subnav-tail/u);
});

test("className 과 children 은 래퍼에 덧붙는다(전적 상세의 진행 헤어라인 자리)", () => {
  const html = renderChrome("none", {
    className: "public-standard-header-frame",
    children: <div className="public-profile-progress" />
  });
  assert.match(html, /class="yoro-app-shell__header yoro-home-chrome public-standard-header-frame"/u);
  /* children 은 2행 뒤에 */
  assert.ok(html.indexOf("yoro-lol-subnav") < html.indexOf("public-profile-progress"));
});

test("lolSubnavActive 는 메뉴 페이지 넷만 활성으로 매핑하고 나머지는 none 이다", () => {
  assert.equal(lolSubnavActive("subscriptions"), "streamers");
  assert.equal(lolSubnavActive("followJoin"), "participation");
  assert.equal(lolSubnavActive("aram"), "aram");
  assert.equal(lolSubnavActive("patchNotes"), "patchNotes");
  for (const page of ["search", "palworld", "valorant", "minecraft", "bot", "games", "streamers", "privacy", "terms", "contact"] as const) {
    assert.equal(lolSubnavActive(page), "none", `page=${page}`);
  }
});

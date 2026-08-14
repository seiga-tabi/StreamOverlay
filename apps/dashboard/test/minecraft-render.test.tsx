import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { MinecraftBottomTabBar } from "../src/features/public-minecraft/components/MinecraftBottomTabBar";
import { MinecraftComingSoonPage } from "../src/features/public-minecraft/components/MinecraftComingSoonPage";
import { MinecraftEnchantsPage } from "../src/features/public-minecraft/components/MinecraftEnchantsPage";
import { MinecraftHeader, minecraftNavItems, minecraftTabItems } from "../src/features/public-minecraft/components/MinecraftHeader";
import { MinecraftHome } from "../src/features/public-minecraft/components/MinecraftHome";
import { MinecraftItemsPage } from "../src/features/public-minecraft/components/MinecraftItemsPage";
import { MinecraftNotFoundPage } from "../src/features/public-minecraft/components/MinecraftNotFoundPage";
import { MinecraftRecipesPage } from "../src/features/public-minecraft/components/MinecraftRecipesPage";
import {
  isMinecraftPath,
  minecraftPageFromPath,
  minecraftPathForPage,
} from "../src/features/public-minecraft/utils/routes";
import { minecraftSeoMetadata } from "../src/features/public-minecraft/utils/seo";

test("마인크래프트 라우트는 ko·ja prefix와 알 수 없는 경로를 구분한다", () => {
  assert.equal(isMinecraftPath("/minecraft"), true);
  assert.equal(isMinecraftPath("/minecraft/"), true);
  assert.equal(isMinecraftPath("/ja/minecraft/recipes"), true);
  assert.equal(isMinecraftPath("/palworld"), false);
  assert.equal(isMinecraftPath("/minecraftx"), false);
  assert.equal(minecraftPageFromPath("/minecraft"), "home");
  assert.equal(minecraftPageFromPath("/ja/minecraft/patch-notes"), "patchNotes");
  assert.equal(minecraftPageFromPath("/minecraft/recipes/diamond-sword"), null);
  assert.equal(minecraftPathForPage("library"), "/minecraft/library");
});

test("마인크래프트 SEO 메타는 페이지·언어별 canonical을 만든다", () => {
  const ko = minecraftSeoMetadata("home", "ko");
  assert.equal(ko.canonicalUrl, "https://yoro.gg/ko/minecraft");
  assert.match(ko.title, /마인크래프트 \| YORO\.gg/u);
  const ja = minecraftSeoMetadata("patchNotes", "ja");
  assert.equal(ja.canonicalUrl, "https://yoro.gg/ja/minecraft/patch-notes");
  assert.match(ja.title, /パッチノート \| YORO\.gg/u);
});

test("위키 홈은 구성 소개·비공식 고지를 ko·ja로 렌더하고 데이터 도착 전 가짜 수치를 두지 않는다", () => {
  setActivePublicLocale("ko");
  const korean = renderToStaticMarkup(<MinecraftHome locale="ko" />);
  assert.match(korean, /무엇이든 찾는 마인크래프트 위키/u);
  /* metadata 도착 전(SSR 포함)에는 준비 중 문구를 유지합니다 — 가짜 수치 금지. */
  assert.match(korean, /준비 중 — 카탈로그 파이프라인 연결 단계/u);
  assert.match(korean, /제작·제련·양조·대장장이/u);
  assert.match(korean, /효과 공식·최대 레벨·배타 관계/u);
  assert.match(korean, /2차/u);
  assert.match(korean, /Mojang Synergies AB 의 상표/u);
  assert.doesNotMatch(korean, /\d+개 레시피|<input|<button/u);
  /* 카테고리 타일은 실제 라우트로 가는 링크입니다. */
  assert.match(korean, /href="\/minecraft\/recipes"/u);
  assert.match(korean, /href="\/minecraft\/items"/u);
  assert.match(korean, /href="\/minecraft\/enchants"/u);
  assert.match(korean, /href="\/minecraft\/patch-notes"/u);

  const japanese = renderToStaticMarkup(<MinecraftHome locale="ja" />);
  assert.match(japanese, /なんでも探せるマインクラフト Wiki/u);
  assert.match(japanese, /Mojang Synergies AB の商標/u);
});

test("자료실·패치 노트는 정직한 준비 중 상태와 위키 홈 복귀를 제공한다", () => {
  setActivePublicLocale("ko");
  for (const page of ["library", "patchNotes"] as const) {
    const korean = renderToStaticMarkup(<MinecraftComingSoonPage locale="ko" page={page} />);
    assert.match(korean, /준비하고 있습니다/u);
    assert.match(korean, /위키 홈으로/u);
    const japanese = renderToStaticMarkup(<MinecraftComingSoonPage locale="ja" page={page} />);
    assert.match(japanese, /準備しています/u);
    assert.match(japanese, /Wiki ホームへ/u);
  }
  const library = renderToStaticMarkup(<MinecraftComingSoonPage locale="ko" page="library" />);
  assert.match(library, /파일은 호스팅하지 않고 공식 출처로만/u);
});

test("카탈로그 3화면은 검색 UI·제목을 ko·ja로 렌더하고 로딩 상태로 시작한다", () => {
  setActivePublicLocale("ko");
  const recipes = renderToStaticMarkup(<MinecraftRecipesPage locale="ko" />);
  assert.match(recipes, /id="minecraft-recipes-title"/u);
  assert.match(recipes, /조합법/u);
  assert.match(recipes, /이름 또는 영문 ID 검색/u);
  /* crafting 만 원천 제공 — 나머지 유형 칩은 비활성 + 미제공 표기 */
  assert.match(recipes, /제작/u);
  assert.match(recipes, /원천 미제공/u);
  assert.match(recipes, /disabled/u);
  /* 데이터 도착 전에는 skeleton 로딩만 — 가짜 레시피 카드 금지 */
  assert.doesNotMatch(recipes, /minecraft-recipe-card/u);
  assert.match(recipes, /maxlength="80"/iu);

  const items = renderToStaticMarkup(<MinecraftItemsPage locale="ja" />);
  assert.match(items, /id="minecraft-items-title"/u);
  assert.match(items, /名前または英語 ID を検索/u);
  assert.doesNotMatch(items, /minecraft-item-row/u);

  const enchants = renderToStaticMarkup(<MinecraftEnchantsPage locale="ko" />);
  assert.match(enchants, /id="minecraft-enchants-title"/u);
  assert.doesNotMatch(enchants, /minecraft-enchant-card/u);
});

test("마인크래프트 헤더 nav는 6개, 탭바는 5칸이며 게임 선택기에 마인크래프트가 있다", () => {
  setActivePublicLocale("ko");
  assert.equal(minecraftNavItems.length, 6);
  assert.equal(minecraftTabItems.length, 5);
  assert.equal(minecraftTabItems.some((item) => item.page === "enchants"), false);
  const markup = renderToStaticMarkup(
    <MinecraftHeader locale="ko" onLocale={() => undefined} page="recipes" />,
  );
  assert.match(markup, /data-testid="minecraft-secondary-nav"/u);
  for (const item of minecraftNavItems) {
    assert.match(markup, new RegExp(`data-ko="${item.ko}"`, "u"));
    assert.match(markup, new RegExp(`data-ja="${item.ja}"`, "u"));
  }
  assert.match(markup, /aria-current="page"[^>]*data-ko="조합법"|data-ko="조합법"[^>]*aria-current="page"/u);
  assert.match(markup, /마인크래프트/u);
  assert.doesNotMatch(markup, /src="https?:\/\//u);

  const tabBar = renderToStaticMarkup(<MinecraftBottomTabBar locale="ko" page="library" />);
  assert.equal((tabBar.match(/public-bottom-tab-bar__item/gu) ?? []).length, 5);
  assert.match(tabBar, /data-testid="minecraft-bottom-tab-bar"/u);
  assert.match(tabBar, /aria-current="page"[^>]*data-ko="자료실"|data-ko="자료실"[^>]*aria-current="page"/u);
});

test("마인크래프트 404 화면은 한국어·일본어 안내와 홈 복귀를 제공한다", () => {
  const korean = renderToStaticMarkup(<MinecraftNotFoundPage locale="ko" />);
  assert.match(korean, /페이지를 찾을 수 없습니다\./u);
  assert.match(korean, /data-ja="ページが見つかりません。"/u);
  assert.match(korean, /위키 홈으로/u);
});

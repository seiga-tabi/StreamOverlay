import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setActivePublicLocale } from "../src/features/public-lol/i18n/public-lol-i18n";
import { MinecraftBottomTabBar } from "../src/features/public-minecraft/components/MinecraftBottomTabBar";
import { MinecraftComingSoonPage } from "../src/features/public-minecraft/components/MinecraftComingSoonPage";
import { MinecraftHeader, minecraftNavItems, minecraftTabItems } from "../src/features/public-minecraft/components/MinecraftHeader";
import { MinecraftHome } from "../src/features/public-minecraft/components/MinecraftHome";
import { MinecraftNotFoundPage } from "../src/features/public-minecraft/components/MinecraftNotFoundPage";
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

test("위키 홈은 준비 상태·구성 소개·비공식 고지를 ko·ja로 렌더하고 가짜 수치를 두지 않는다", () => {
  setActivePublicLocale("ko");
  const korean = renderToStaticMarkup(<MinecraftHome locale="ko" />);
  assert.match(korean, /무엇이든 찾는 마인크래프트 위키/u);
  assert.match(korean, /준비 중 — 카탈로그 파이프라인 연결 단계/u);
  assert.match(korean, /제작·제련·양조·대장장이/u);
  assert.match(korean, /효과 공식·최대 레벨·배타 관계/u);
  assert.match(korean, /2차/u);
  assert.match(korean, /Mojang Synergies AB 의 상표/u);
  /* 준비 단계 — 가짜 레시피 수·검색 입력·동작하지 않는 CTA 를 두지 않습니다. */
  assert.doesNotMatch(korean, /\d+개 레시피|<input|<button/u);

  const japanese = renderToStaticMarkup(<MinecraftHome locale="ja" />);
  assert.match(japanese, /なんでも探せるマインクラフト Wiki/u);
  assert.match(japanese, /Mojang Synergies AB の商標/u);
});

test("데이터 화면은 정직한 준비 중 상태와 위키 홈 복귀를 제공한다", () => {
  setActivePublicLocale("ko");
  for (const page of ["recipes", "items", "enchants", "library", "patchNotes"] as const) {
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

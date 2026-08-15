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
import {
  MINECRAFT_TEXTURE_ORIGIN,
  MINECRAFT_TEXTURE_VERSION,
  MinecraftItemImage,
  minecraftTextureUrls,
} from "../src/features/public-minecraft/components/MinecraftItemImage";
import { MinecraftNotFoundPage } from "../src/features/public-minecraft/components/MinecraftNotFoundPage";
import { MinecraftPatchNotesPage } from "../src/features/public-minecraft/components/MinecraftPatchNotesPage";
import { MinecraftRecipesPage } from "../src/features/public-minecraft/components/MinecraftRecipesPage";
import {
  isMinecraftPath,
  minecraftPageFromPath,
  minecraftPathForPage,
} from "../src/features/public-minecraft/utils/routes";
import { minecraftSeoMetadata } from "../src/features/public-minecraft/utils/seo";
import { publicPathForPage, publicPageRouteFromPath } from "../src/features/public-lol/utils/routes";

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
  /* LoL 메인의 게임 선택기는 PUBLIC_PAGE_PATHS 를 경유합니다 — 항목 누락 시 선택이 무시됩니다. */
  assert.equal(publicPathForPage("minecraft"), "/minecraft");
  assert.deepEqual(publicPageRouteFromPath("/minecraft"), { page: "minecraft" });
});

test("마인크래프트 SEO 메타는 페이지·언어별 canonical을 만든다", () => {
  const ko = minecraftSeoMetadata("home", "ko");
  assert.equal(ko.canonicalUrl, "https://yoro.gg/ko/minecraft");
  assert.match(ko.title, /마인크래프트 \| YORO\.gg/u);
  const ja = minecraftSeoMetadata("patchNotes", "ja");
  assert.equal(ja.canonicalUrl, "https://yoro.gg/ja/minecraft/patch-notes");
  assert.match(ja.title, /パッチノート \| YORO\.gg/u);
});

test("위키 홈은 검색 히어로·코어 카드·비공식 고지를 ko·ja로 렌더하고 데이터 도착 전 가짜 수치를 두지 않는다", () => {
  setActivePublicLocale("ko");
  const korean = renderToStaticMarkup(<MinecraftHome locale="ko" />);
  assert.match(korean, /무엇이든 찾는 마인크래프트 위키/u);
  /* 히어로가 곧 검색 — 스코프 칩과 함께 렌더됩니다. */
  assert.match(korean, /role="search"/u);
  assert.match(korean, /예: 다이아몬드 검, diamond_sword/u);
  assert.match(korean, /검색 대상/u);
  assert.match(korean, /maxlength="80"/iu);
  /* metadata 도착 전(SSR 포함)에는 준비 중 문구를 유지하고 수치를 그리지 않습니다. */
  assert.match(korean, /준비 중 — 카탈로그 파이프라인 연결 단계/u);
  assert.doesNotMatch(korean, /minecraft-core-card__count|\d{1,3},\d{3}/u);
  assert.match(korean, /3×3 제작대 그리드로 보는 전체 레시피/u);
  assert.match(korean, /최대 레벨·획득 경로·상충 관계 정리/u);
  /* 준비 중·예정 배지가 클릭 전에 보입니다. */
  assert.match(korean, /준비 중<\/span>/u);
  assert.match(korean, /2차/u);
  assert.match(korean, /Mojang Synergies AB 의 상표/u);
  /* 코어·보조 카드는 실제 라우트로 가는 링크입니다. */
  assert.match(korean, /href="\/minecraft\/recipes"/u);
  assert.match(korean, /href="\/minecraft\/items"/u);
  assert.match(korean, /href="\/minecraft\/enchants"/u);
  assert.match(korean, /href="\/minecraft\/library"/u);
  assert.match(korean, /href="\/minecraft\/patch-notes"/u);

  const japanese = renderToStaticMarkup(<MinecraftHome locale="ja" />);
  assert.match(japanese, /なんでも探せるマインクラフト Wiki/u);
  assert.match(japanese, /一度の検索で/u);
  assert.match(japanese, /Mojang Synergies AB の商標/u);
});

test("자료실은 정직한 준비 중 상태와 위키 홈 복귀를 제공한다", () => {
  setActivePublicLocale("ko");
  const korean = renderToStaticMarkup(<MinecraftComingSoonPage locale="ko" page="library" />);
  assert.match(korean, /준비하고 있습니다/u);
  assert.match(korean, /위키 홈으로/u);
  assert.match(korean, /파일은 호스팅하지 않고 공식 출처로만/u);
  const japanese = renderToStaticMarkup(<MinecraftComingSoonPage locale="ja" page="library" />);
  assert.match(japanese, /準備しています/u);
  assert.match(japanese, /Wiki ホームへ/u);
});

test("패치 노트 페이지는 에디션 탭·유형 칩·가이드를 ko·ja 로 렌더하고 로딩으로 시작한다", () => {
  setActivePublicLocale("ko");
  const korean = renderToStaticMarkup(<MinecraftPatchNotesPage locale="ko" />);
  assert.match(korean, /aria-pressed="true"[^>]*class="[^"]*is-java"|is-java[^>]*aria-pressed="true"/u);
  assert.match(korean, /Bedrock/u);
  assert.match(korean, /하이라이트는 YORO\.gg 가 요약한 것/u);
  assert.match(korean, /정식/u);
  assert.match(korean, /스냅샷/u);
  /* 데이터 도착 전에는 skeleton — 가짜 패치 카드 금지 */
  assert.doesNotMatch(korean, /minecraft-patch is-latest|data-testid="minecraft-patch-card"/u);
  /* 가이드는 상태와 무관하게 항상 렌더(광고 오인 빈 박스 금지) */
  assert.match(korean, /Mojang 공식 런처 피드를 주기적으로 수집합니다/u);
  assert.match(korean, /스냅샷은 어디서 받나요\?/u);
  const japanese = renderToStaticMarkup(<MinecraftPatchNotesPage locale="ja" />);
  assert.match(japanese, /要約は人が直接作成しています/u);
});

test("카탈로그 3화면은 검색 UI·제목을 ko·ja로 렌더하고 로딩 상태로 시작한다", () => {
  setActivePublicLocale("ko");
  const recipes = renderToStaticMarkup(<MinecraftRecipesPage locale="ko" />);
  assert.match(recipes, /id="minecraft-recipes-title"/u);
  assert.match(recipes, /조합법/u);
  assert.match(recipes, /이름 또는 영문 ID 검색/u);
  /* crafting 만 원천 제공 — 제공 유형만 칩, 미제공은 캡션 한 줄 */
  assert.match(recipes, /제작/u);
  assert.match(recipes, /원천 미제공: 제련 · 양조 · 대장장이 · 절단/u);
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

test("아이템 이미지는 버전 고정 allowlist URL만 만들고 잘못된 ID는 자체 fallback으로 닫힌다", () => {
  assert.deepEqual(minecraftTextureUrls("diamond_sword"), [
    `${MINECRAFT_TEXTURE_ORIGIN}/${MINECRAFT_TEXTURE_VERSION}/assets/minecraft/textures/item/diamond_sword.png`,
    `${MINECRAFT_TEXTURE_ORIGIN}/${MINECRAFT_TEXTURE_VERSION}/assets/minecraft/textures/block/diamond_sword.png`,
  ]);
  assert.deepEqual(minecraftTextureUrls("https://example.com/attack.png"), []);

  const texture = renderToStaticMarkup(
    <MinecraftItemImage fallbackText="다이아몬드 검" id="diamond_sword" label="다이아몬드 검" />,
  );
  assert.match(texture, /role="img"/u);
  assert.match(texture, /assets\.mcasset\.cloud\/1\.21\.11/u);
  assert.match(texture, /referrerPolicy="no-referrer"/u);

  const fallback = renderToStaticMarkup(
    <MinecraftItemImage fallbackText="차단" id="../attack" label="차단" />,
  );
  assert.doesNotMatch(fallback, /<img|https?:\/\//u);
  assert.match(fallback, />차단</u);
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

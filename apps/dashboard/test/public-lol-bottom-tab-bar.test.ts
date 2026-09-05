import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* 상단바는 HomeHeader 한 벌로 통일(2026-08-21 공용 규격) — 구 PublicAppHeader 는
   삭제됐고, 같은 가드를 HomeHeader 소스에 겁니다. */
const appHeader = readFileSync(
  new URL("../src/features/public-home/components/HomeHeader.tsx", import.meta.url),
  "utf8"
);
const lolPage = readFileSync(
  new URL("../src/pages/PublicLolPage.tsx", import.meta.url),
  "utf8"
);
const tabBarCss = readFileSync(
  new URL("../src/styles/pages/public-lol/31-bottom-tab-bar.css", import.meta.url),
  "utf8"
);
const bottomTabBar = readFileSync(
  new URL("../src/features/public-lol/components/PublicBottomTabBar.tsx", import.meta.url),
  "utf8"
);
const headerMenu = readFileSync(
  new URL("../src/features/public-lol/components/PublicHeaderMenu.tsx", import.meta.url),
  "utf8"
);
const publicI18nSource = readFileSync(
  new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
  "utf8"
);

/* 하단 탭바를 헤더 안으로 되돌리면 전적검색 결과 화면에서만 탭바가 화면 하단에
   닿지 않습니다 — 그 헤더에는 backdrop-filter 가 걸려 있어 자손 position:fixed 의
   기준(containing block)이 뷰포트가 아니라 헤더가 되기 때문입니다. jsdom 은 실제
   배치를 계산하지 않으므로, 버그를 되살리는 유일한 변경인 "헤더 안 렌더링"을
   구조로 막습니다. */
test("하단 탭바는 헤더가 아니라 AppShell 직계 자식으로 렌더링한다", () => {
  assert.doesNotMatch(appHeader, /<PublicBottomTabBar/u);

  /* 전적검색 결과 분기는 목업 page-4 크롬(LolBottomTabBar)으로 전환했습니다(2026-08-20). */
  const renderCount = lolPage.match(/<PublicBottomTabBar\b/gu)?.length ?? 0;
  assert.equal(renderCount, 2, "AppShell 2개 조기 반환 분기(등록·비검색)에 기존 탭바가 있어야 합니다");
  /* 활성 탭은 리터럴이 아니라 activeMainPage 매핑으로 넘깁니다(2026-09-05 탭바 개편). */
  assert.match(lolPage, /<LolBottomTabBar active=\{lolTabBarActive\(activeMainPage\)\} text=\{lolHomeI18n\[locale\]\} \/>/u);

  for (const match of lolPage.matchAll(/<PublicBottomTabBar\b[^/]*\/>/gu)) {
    assert.match(match[0], /activePage=\{activeMainPage\}/u);
    assert.match(match[0], /activeTarget=\{activeNav\}/u);
    /* 홈 메뉴는 루트 메인 홈(/)으로 나가는 navigateFromMenu 를 씁니다(2026-08-19). */
    assert.match(match[0], /onPage=\{navigateFromMenu\}/u);
  }
});

test("검색 실패와 빈 초기 검색은 구 홈이 아니라 통합 프로필 셸에서 처리한다", () => {
  assert.doesNotMatch(lolPage, /if \(!profile && activeMainPage === "search" && !loading\)/u);
  assert.match(lolPage, /if \(activeMainPage !== "search"\) \{/u);
  assert.match(lolPage, /error && !loading \? \([\s\S]*?<PublicProfileErrorState error=\{error\} \/>[\s\S]*?<ProfileSearchSkeleton riotId=\{query\} \/>/u);
});

/* 본문 여백을 main 에 걸면 전적검색 결과 화면에서만 무효가 됩니다 — 그 main 에는
   legacy layer 의 !important padding shorthand 가 있고, !important 는 cascade
   layer 순서가 뒤집혀 legacy 가 pages 를 이깁니다. shell 루트에는 경쟁하는
   !important 가 없어 pages layer 규칙이 그대로 적용됩니다. */
test("탭바 높이만큼의 여백은 main 이 아니라 shell 루트에 두고, Palworld도 포함한다", () => {
  /* Palworld 도 하단 탭바를 렌더링하므로(.palworld-shell 은 .public-lol-shell 을
     공유) shell 여백에서 더 이상 제외하면 안 됩니다 — 제외가 남으면 Palworld
     모바일에서 탭바가 마지막 콘텐츠·푸터를 덮습니다. */
  assert.match(
    tabBarCss,
    /\.public-lol-shell\.yoro-app-shell \{[\s\S]*?--public-bottom-tab-bar-height:[\s\S]*?padding-block-end: var\(--public-bottom-tab-bar-height\);/u
  );
  assert.doesNotMatch(tabBarCss, /:not\(\.palworld-shell\)/u);
  assert.doesNotMatch(tabBarCss, /\.yoro-app-shell__main \{/u);
});

test("모바일에서 탭바를 쓰는 4개 게임 헤더의 상단 nav 가 전부 숨는다", () => {
  /* 2026-08-15 결함 회귀 방지 — valorant·minecraft 가 그룹에서 빠지면
     모바일에서 상단 nav + 하단 탭바가 이중 표시됩니다. */
  for (const header of ["lol-public-game-header", "palworld-header", "valorant-header", "minecraft-header"]) {
    assert.match(
      tabBarCss,
      new RegExp(`\\.${header} \\.public-game-header__nav-slot[\\s\\S]{0,220}display: none;`, "u")
    );
  }
  // Palworld 탭바 활성색은 헤더와 같은 초록 토큰을 씁니다.
  assert.match(
    tabBarCss,
    /\.palworld-shell \.public-bottom-tab-bar \{[\s\S]{0,120}--public-game-accent: var\(--yoro-color-success\);/u
  );
});

/* 2026-09-05 개편 — 모바일에서는 상단 nav 가 숨어 탭바가 유일한 내비인데 5칸이
   홈·스트리머·참여·칼바람·패치노트로 차 있어 챔피언 진입점이 없었습니다. 상시
   4탭 + 더보기 시트 구조가 되살아나지 않게 고정합니다(승인 스펙 §1·§4). */
test("메뉴 화면 하단 탭바는 4탭(홈·챔피언·칼바람·패치노트) + 더보기 시트다", () => {
  assert.match(bottomTabBar, /const TAB_ICONS = \["home", "champions", "aram", "patchNotes"\] as const;/u);
  assert.match(bottomTabBar, /const MORE_ICONS = \["streamers", "participation"\] as const;/u);
  // 챔피언 항목은 상단 nav 와 공유하는 같은 데이터에서 옵니다 — 라벨이 갈리지 않습니다.
  assert.match(headerMenu, /icon: "champions",\s*page: "champions",/u);
  assert.match(headerMenu, /champions: <>/u);

  /* 시트 안 항목이 현재 위치면 더보기 탭이 활성색을 이어받아야 합니다 —
     빠지면 스트리머·참여에 있는 동안 탭바에서 현재 위치가 사라집니다. */
  assert.match(
    bottomTabBar,
    /const moreActive = moreOpen \|\| moreItems\.some\(\(item\) => isHeaderMenuItemActive\(item, activePage, activeTarget\)\);/u
  );
  // 시트는 공용 BottomSheet 재사용 — 포커스 트랩·스크롤 락을 다시 구현하지 않습니다.
  assert.match(bottomTabBar, /<BottomSheet\b/u);
  assert.match(bottomTabBar, /returnFocusRef=\{moreTriggerRef\}/u);
});

test("챔피언 탭 라벨은 3개 로케일에 함께 있다", () => {
  for (const [locale, label] of [["ko", "챔피언"], ["ja", "チャンピオン"], ["en", "Champions"]]) {
    assert.match(
      publicI18nSource,
      new RegExp(`championsHeaderNav: "${label}",`, "u"),
      `${locale} championsHeaderNav 없음`
    );
  }
});

/* 수묵 셸은 --yoro-color-public-primary 를 심회(#4A5563)로 재정의합니다 — 채움용
   값이라 글자색으로 쓰면 다크 지면 위 2.4:1 로 비활성보다 어두워져 켜진 탭이 꺼져
   보였습니다(391px 실측). 활성은 색이 아니라 명도로 말해야 합니다. */
test("수묵 메뉴 화면에서 활성 탭은 잉크색과 밑줄로 구분된다", () => {
  assert.match(
    tabBarCss,
    /\.public-profile-platform-v2 \.public-bottom-tab-bar \{[\s\S]{0,160}--public-game-accent: var\(--public-gray-text\);/u
  );
  assert.match(
    tabBarCss,
    /\.public-profile-platform-v2 \.public-bottom-tab-bar__item\.active::after \{/u
  );
});

/* --public-game-* 토큰은 .public-game-header 요소 자신에만 정의됩니다. 탭바는 그
   자손이 아니므로 직접 선언하지 않으면 var() 가 무효값이 되어 활성 탭과 비활성
   탭의 색이 같아집니다. */
test("탭바는 활성·비활성 색 토큰을 자신에게 정의한다", () => {
  assert.match(
    tabBarCss,
    /\.public-bottom-tab-bar \{[\s\S]*?--public-game-accent: var\(--yoro-color-public-primary\);[\s\S]*?--public-game-chrome-text-muted: var\(--yoro-color-product-gray-muted\);/u
  );
});

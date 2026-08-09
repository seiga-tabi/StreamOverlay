import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appHeader = readFileSync(
  new URL("../src/features/public-lol/components/PublicAppHeader.tsx", import.meta.url),
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

/* 하단 탭바를 헤더 안으로 되돌리면 전적검색 결과 화면에서만 탭바가 화면 하단에
   닿지 않습니다 — 그 헤더에는 backdrop-filter 가 걸려 있어 자손 position:fixed 의
   기준(containing block)이 뷰포트가 아니라 헤더가 되기 때문입니다. jsdom 은 실제
   배치를 계산하지 않으므로, 버그를 되살리는 유일한 변경인 "헤더 안 렌더링"을
   구조로 막습니다. */
test("하단 탭바는 헤더가 아니라 AppShell 직계 자식으로 렌더링한다", () => {
  assert.doesNotMatch(appHeader, /<PublicBottomTabBar/u);

  const renderCount = lolPage.match(/<PublicBottomTabBar\b/gu)?.length ?? 0;
  assert.equal(renderCount, 4, "AppShell 4개 분기(등록·홈 검색·비검색·전적검색 결과) 모두에 탭바가 있어야 합니다");

  for (const match of lolPage.matchAll(/<PublicBottomTabBar\b[^/]*\/>/gu)) {
    assert.match(match[0], /activePage=\{activeMainPage\}/u);
    assert.match(match[0], /activeTarget=\{activeNav\}/u);
    assert.match(match[0], /onPage=\{changeMainPage\}/u);
  }
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

test("모바일에서 Palworld 헤더의 상단 nav 도 탭바로 대체되어 숨는다", () => {
  assert.match(
    tabBarCss,
    /\.palworld-header \.public-game-header__nav-slot \{[\s\S]{0,80}display: none;/u
  );
  // Palworld 탭바 활성색은 헤더와 같은 초록 토큰을 씁니다.
  assert.match(
    tabBarCss,
    /\.palworld-shell \.public-bottom-tab-bar \{[\s\S]{0,120}--public-game-accent: var\(--yoro-color-success\);/u
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

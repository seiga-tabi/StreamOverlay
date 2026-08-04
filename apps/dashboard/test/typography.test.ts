import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readDashboardSource = (relativePath: string): string => readFileSync(
  new URL(`../src/${relativePath}`, import.meta.url),
  "utf8",
);

test("일본어 UI는 번들된 Noto Sans JP 가변 폰트를 사용한다", () => {
  const mainSource = readDashboardSource("main.tsx");
  const fontLoaderSource = readDashboardSource("fonts/japanese-font.ts");
  const typographyCss = readDashboardSource("styles/foundation/typography.css");
  const viteSource = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

  assert.match(mainSource, /initializeJapaneseFont\(\)/u);
  assert.match(fontLoaderSource, /root\.lang\.toLowerCase\(\)\.startsWith\("ja"\)/u);
  assert.match(fontLoaderSource, /fonts\/noto-sans-jp\/wght\.css/u);
  assert.match(viteSource, /notoSansJpStaticAssets/u);
  assert.match(viteSource, /@fontsource-variable\/noto-sans-jp/u);
  assert.match(typographyCss, /--yoro-font-family-ja:\s*"Noto Sans JP Variable"/u);
  assert.match(
    typographyCss,
    /:root:lang\(ja\)\s*\{[\s\S]*?--yoro-font-family-base:\s*var\(--yoro-font-family-ja\)/u,
  );
});

test("언어별 폰트는 합성 굵기 없이 표준 굵기 토큰을 사용한다", () => {
  const typographyCss = readDashboardSource("styles/foundation/typography.css");
  const resetCss = readDashboardSource("styles/foundation/reset.css");
  const coreCss = readDashboardSource("styles/legacy/01-core.css");
  const publicLolCss = readDashboardSource("styles/pages/public-lol/02-legacy.css");

  assert.match(resetCss, /font-family:\s*var\(--yoro-font-family-base\)/u);
  assert.match(resetCss, /:root:lang\(ja\) body\s*\{[\s\S]*?font-synthesis:\s*none/u);
  assert.match(typographyCss, /--yoro-font-weight-ja-medium:\s*600/u);
  assert.match(typographyCss, /--yoro-font-weight-ja-bold:\s*700/u);
  assert.match(typographyCss, /--yoro-font-weight-ja-black:\s*800/u);
  assert.match(typographyCss, /--yoro-font-weight-medium:\s*700/u);
  assert.match(typographyCss, /--yoro-font-weight-bold:\s*850/u);
  assert.match(typographyCss, /--yoro-font-weight-black:\s*900/u);
  assert.match(coreCss, /\.app-shell\[data-locale="ja"\][\s\S]*?font-family:\s*var\(--yoro-font-family-ja\)/u);
  assert.match(coreCss, /font-weight:\s*var\(--yoro-font-weight-ja-bold\)/u);
  assert.match(publicLolCss, /html\[lang="ja"\][\s\S]*?font-family:\s*var\(--yoro-font-family-ja\)/u);
  assert.match(publicLolCss, /font-weight:\s*var\(--yoro-font-weight-ja-medium\)/u);
});

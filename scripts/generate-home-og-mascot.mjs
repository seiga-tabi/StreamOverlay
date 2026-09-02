/* 홈 대표 OG 카드(1200×630) 정적 PNG 생성기.
 *
 * 원본: docs/mockups/home-og-mascot-redesign-v1.html 의 v3-⑥ 섹션
 *       "A안 최종 카드 · v3 마스코트 적용" (symbol#card-a3) — 사용자 승인본.
 * 목업은 symbol/use + CSS 커스텀 프로퍼티(--wobble, --yoro-face)로 여러 변형을
 * 한 페이지에서 비교하는 구조라, 여기서는 승인본 1장에 해당하는 값만 확정해
 * 평평한 단일 SVG 로 펼칩니다(use → transform, var() → 기본값 하드코딩).
 *   - use href="#yoro-ink-wash" x=690 y=60 520×520 → translate(690,60) scale(1.3)
 *   - use href="#yoro-mascot-v3" x=700 y=70 500×500 → translate(700,70) scale(1.25)
 * 좌표·굵기·색은 목업에서 한 값도 바꾸지 않았습니다.
 *
 * 렌더러는 Chromium(playwright)을 씁니다 — 승인 시점에 사용자가 실제로 본 화면이
 * 브라우저 렌더링이고, 워드마크가 Google Fonts 의 Noto Serif KR 700 이라
 * 같은 엔진·같은 웹폰트로 구워야 승인본과 어긋나지 않습니다.
 *
 * 실행: npm run generate:home-og-mascot
 */

import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(repositoryRoot, "apps/dashboard/public/images/yorogg-og-home-mascot.png");

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/* 목업과 동일한 웹폰트 — 이게 로드되지 않으면 워드마크가 Georgia 로 떨어지므로
   렌더 전에 document.fonts.check() 로 실제 적용 여부를 확인합니다. */
const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700&display=swap";

const cardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <defs>
    <linearGradient id="yoroBrand" gradientUnits="userSpaceOnUse" x1="60" y1="340" x2="340" y2="40">
      <stop offset="0" stop-color="#4C6BF5"/>
      <stop offset="0.55" stop-color="#7B4BF0"/>
      <stop offset="1" stop-color="#A855F7"/>
    </linearGradient>

    <filter id="yoroInkEdgeSoft" x="-14%" y="-14%" width="128%" height="128%"
            color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.013" numOctaves="2" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <mask id="yoroEyeV3Y" maskUnits="userSpaceOnUse" x="118" y="96" width="84" height="84">
      <circle cx="158" cy="136" r="33" fill="#fff"/>
      <g fill="none" stroke="#000" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M146 118 C149 124, 154.5 130, 160 134 C165.5 130, 171 124, 174 118"/>
        <path d="M160 133 C159.4 140, 159.4 147, 160 152"/>
      </g>
    </mask>

    <mask id="yoroEyeV3R" maskUnits="userSpaceOnUse" x="213" y="96" width="84" height="84">
      <circle cx="253" cy="136" r="33.5" fill="#fff"/>
      <g fill="none" stroke="#000" stroke-width="10.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M239 119 C254 119, 261 124.5, 261 130.5 C261 136.5, 254 142, 239 142"/>
        <path d="M239 119 C238.4 130, 238.4 144, 239 155"/>
        <path d="M250 142 C255 146, 259.5 150.5, 263 155"/>
      </g>
    </mask>
  </defs>

  <rect width="1200" height="630" fill="#1C1D22"/>
  <rect x="0.5" y="0.5" width="1199" height="629" fill="none" stroke="#3A404B"/>

  <text x="80" y="176" font-family="'Noto Serif KR','Noto Serif JP',Georgia,serif"
        font-size="104" font-weight="700" fill="#F5F6F8">YORO<tspan
        font-family="Pretendard,-apple-system,sans-serif" font-size="46"
        font-weight="800" fill="#8795A6" dx="8">.GG</tspan></text>
  <path d="M3 6.2 C 78 2, 168 9.4, 296 4.6 C 200 7.6, 96 7, 3 8.6 Z"
        fill="#4A5563" transform="translate(80, 198) scale(1.48, 1.7)"/>

  <text x="80" y="256" font-family="Pretendard,-apple-system,sans-serif"
        font-size="32" font-weight="500" fill="#B9C3D0">Game data, one search away</text>

  <g>
    <g transform="translate(80, 300)">
      <rect x="0.5" y="0.5" width="83" height="83" rx="3" fill="none" stroke="#3A404B"/>
      <g fill="#F5F6F8">
        <rect x="24" y="46" width="9" height="14" rx="1.5"/>
        <rect x="38" y="36" width="9" height="24" rx="1.5"/>
        <rect x="52" y="26" width="9" height="34" rx="1.5"/>
      </g>
    </g>
    <text x="80" y="414" font-family="Pretendard,-apple-system,sans-serif"
          font-size="18" font-weight="600" fill="#8795A6">LoL Stats</text>

    <g transform="translate(230, 300)">
      <rect x="0.5" y="0.5" width="83" height="83" rx="3" fill="none" stroke="#3A404B"/>
      <g fill="none" stroke="#F5F6F8" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M42 30 C37 26 29 25 22 27 L22 55 C29 53 37 54 42 58
                 C47 54 55 53 62 55 L62 27 C55 25 47 26 42 30 Z"/>
        <path d="M42 30 L42 58"/>
      </g>
    </g>
    <text x="230" y="414" font-family="Pretendard,-apple-system,sans-serif"
          font-size="18" font-weight="600" fill="#8795A6">Palworld DB</text>

    <g transform="translate(380, 300)">
      <rect x="0.5" y="0.5" width="83" height="83" rx="3" fill="none" stroke="#3A404B"/>
      <g fill="none" stroke="#F5F6F8" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <rect x="20" y="26" width="44" height="30" rx="3"/>
        <path d="M34 64 L50 64"/>
        <path d="M42 56 L42 64"/>
      </g>
      <path d="M38 34 L50 41 L38 48 Z" fill="#F5F6F8"/>
      <circle cx="64" cy="24" r="5.5" fill="#C93850"/>
    </g>
    <text x="380" y="414" font-family="Pretendard,-apple-system,sans-serif"
          font-size="18" font-weight="600" fill="#8795A6">Live Streamers</text>

    <g transform="translate(530, 300)">
      <rect x="0.5" y="0.5" width="83" height="83" rx="3" fill="none" stroke="#3A404B"/>
      <g fill="none" stroke="#F5F6F8" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <rect x="26" y="22" width="32" height="40" rx="3"/>
        <path d="M34 34 L50 34"/>
        <path d="M34 42 L50 42"/>
        <path d="M34 50 L44 50"/>
      </g>
    </g>
    <text x="530" y="414" font-family="Pretendard,-apple-system,sans-serif"
          font-size="18" font-weight="600" fill="#8795A6">Patch Notes</text>
  </g>

  <rect x="80" y="472" width="228" height="58" rx="3" fill="#F5F6F8"/>
  <text x="194" y="512" text-anchor="middle" font-family="Pretendard,-apple-system,sans-serif"
        font-size="32" font-weight="700" fill="#1C1D22">yoro.gg</text>

  <!-- 먹 번짐(yoro-ink-wash) — use x=690 y=60 520×520, viewBox 400 → scale 1.3 -->
  <g transform="translate(690, 60) scale(1.3)">
    <g transform="translate(-20 4) scale(1.22 1.10)" opacity=".8">
      <path d="M212 38c46-14 92 6 118 44 21 31 10 63 30 94 22 34 12 78-18 104-36 31-74 16-116 32-38 14-84 24-120 0-33-22-44-66-36-106 7-36 34-50 42-88 8-40 52-66 100-80Z"
            fill="#252730"/>
      <path d="M244 96c28 4 48 30 50 62 2 26-12 44-8 70 4 30-14 54-42 60-30 7-52-12-84-10-28 2-56-8-64-36-7-26 8-46 12-72 4-28 24-46 52-52 30-7 56-26 84-22Z"
            fill="#3A404B" opacity=".38"/>
    </g>
  </g>

  <!-- 마스코트 v3 — use x=700 y=70 500×500, viewBox 400 → scale 1.25 -->
  <g transform="translate(700, 70) scale(1.25)">
    <g filter="url(#yoroInkEdgeSoft)">
      <g fill="#A855F7">
        <path d="M286 54 C290 44, 295 34, 301 27 C302 36, 300 46, 295 57 Z"/>
        <path d="M306 80 C313 72, 322 65, 331 57 C328 66, 321 73, 313 82 Z"/>
        <path d="M322 110 C331 105, 342 100, 353 95 C343 103, 333 108, 325 116 Z"/>
      </g>

      <g fill="none" stroke="url(#yoroBrand)" stroke-width="13"
         stroke-linecap="round" stroke-linejoin="round">
        <path d="M302 146
                 C302 163 296 179 284 193
                 L322 246 L261 213
                 C232 231 194 233 162 219
                 C130 205 110 177 110 146
                 C110 101 153 64 206 64
                 C259 64 302 101 302 146 Z"/>
        <path d="M166 220
                 C157 254 156 288 162 312
                 C176 334 240 334 252 312
                 C258 288 252 250 238 223"/>
      </g>

      <g fill="none" stroke="url(#yoroBrand)" stroke-width="15.5"
         stroke-linecap="round" opacity=".9">
        <path d="M110 146 C110 177, 130 205, 162 219"/>
        <path d="M166 220 C157 254, 156 288, 162 312"/>
      </g>

      <g fill="url(#yoroBrand)">
        <path d="M164 246 C136 230, 105 188, 85 136 L75 140 C96 190, 128 234, 156 258 Z"/>
        <path d="M257 267 C272 285, 281 306, 281 322 L272 322 C272 307, 264 290, 247 277 Z"/>
        <path d="M180 322 C179 334, 178.5 344, 178.5 352 L184 352 C184.5 344, 186 334, 187.5 322 Z"/>
        <path d="M227 322 C227.5 334, 228.5 344, 228.5 352 L234 352 C234.5 344, 234 334, 234.5 322 Z"/>
        <path d="M168 358 C176 352.5, 188 352.5, 196 357 C188 363.5, 176 363.5, 168 358 Z"/>
        <path d="M218 358 C226 352.5, 238 352.5, 246 357 C238 363.5, 226 363.5, 218 358 Z"/>
      </g>
      <g fill="none" stroke="url(#yoroBrand)" stroke-width="12" stroke-linecap="round">
        <circle cx="72" cy="124" r="17"/>
        <circle cx="278" cy="332" r="15"/>
      </g>

      <g fill="#F5F6F8">
        <circle cx="158" cy="136" r="33" mask="url(#yoroEyeV3Y)"/>
        <circle cx="253" cy="136" r="33.5" mask="url(#yoroEyeV3R)"/>
      </g>

      <g fill="none" stroke="#F5F6F8" stroke-linecap="round">
        <path d="M170 182 C180 202, 232 202, 242 181" stroke-width="10"/>
        <path d="M184.1 193.2 Q206 200.7 227.9 192.8" stroke-width="12.5" opacity=".92"/>
      </g>
    </g>
  </g>
</svg>
`.trim();

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_STYLESHEET}">
<style>html,body{margin:0;padding:0;background:#1C1D22}svg{display:block}</style>
</head><body>${cardSvg}</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  /* 웹폰트가 실제로 붙었는지 확인. document.fonts.check() 는 못 씁니다 — Google
     Fonts 는 Noto Serif KR 을 unicode-range 서브셋 수백 벌로 쪼개 내려주는데
     check() 는 그중 하나라도 unloaded 면 false 라 항상 false 가 나옵니다.
     대신 워드마크를 실제로 조판해 폭을 재고 generic serif 폴백과 다른지 봅니다. */
  const wordmark = await page.evaluate(() => {
    const measure = (family) => {
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:700 104px ${family}`;
      probe.textContent = "YORO";
      document.body.appendChild(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    };
    return { webfont: measure('"Noto Serif KR"'), fallback: measure("serif") };
  });
  if (wordmark.webfont === wordmark.fallback) {
    throw new Error("Noto Serif KR 웹폰트가 적용되지 않았습니다 — 네트워크를 확인하고 다시 실행하세요.");
  }
  const buffer = await page.screenshot({ type: "png" });
  await writeFile(outputPath, buffer);
  /* public/images/* 의 다른 정적 자산과 같은 0644 로 맞춥니다 — umask 에 따라
     0600 으로 떨어지면 정적 서빙 단계에서 읽히지 않을 수 있습니다. */
  await chmod(outputPath, 0o644);
  console.log(`[home-og-mascot] ${path.relative(repositoryRoot, outputPath)} (${buffer.byteLength} bytes)`);
  console.log(
    `[home-og-mascot] 워드마크 Noto Serif KR 적용됨` +
      ` (webfont ${wordmark.webfont.toFixed(2)}px / serif 폴백 ${wordmark.fallback.toFixed(2)}px)`,
  );
} finally {
  await browser.close();
}

import type { PublicUrlLocale } from "../routing/public-dashboard-routes.js";

/* yoro.gg 홈(대표) SNS 공유 카드(1200×630).
 *
 * 이전까지는 정적 PNG(yorogg-og-lol.png) 1장을 ko/ja/en 전부가 공유했습니다 —
 * 텍스트가 이미지 파일에 하드코딩돼 있어 언어 분기가 구조적으로 불가능했고,
 * 배경도 보라 그라디언트라 리디자인된 메인 홈(--home-* 헤어라인 톤)과 달랐습니다
 * (실측 확인, 사용자 승인 완료: docs/mockups/yorogg-home-og-redesign-v1.html).
 *
 * 패치노트 카드(patch-notes-social-card.ts)와 같은 SVG→sharp PNG 파이프라인을
 * 쓰되, 홈 카피는 배포마다 거의 안 바뀌므로 매 요청 프로필 조회 없이 로케일별
 * 텍스트만 굽습니다 — ko/ja/en 3벌을 프로세스 시작 시 지연 렌더링 후 캐시.
 */

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const RENDER_TIMEOUT_SECONDS = 3;

/* 메인 홈 디자인 시스템(--home-*) 다크 톤 — 01-public-home.css 실측값 그대로.
   Canvas/SVG 는 CSS 커스텀 프로퍼티를 읽지 못해 hex 값을 그대로 복제합니다. */
const HOME_COLOR = {
  bg: "#1C1D22",
  card: "#252730",
  ink: "#F5F6F8",
  sub: "#B9C3D0",
  line: "#3A404B",
  mid: "#8795A6",
  win: "#87A183",
} as const;

const HOME_CARD_COPY: Readonly<Record<PublicUrlLocale, { kicker: string; title: string; sub: string }>> = Object.freeze({
  ko: {
    kicker: "게임 데이터, 검색 한 번",
    title: "LoL 전적부터 팰월드 도감까지",
    sub: "방송 중인 스트리머의 판을 보고, 시청자로 직접 참여합니다.",
  },
  ja: {
    kicker: "ゲームデータ、検索ひとつで",
    title: "LoL戦績からパルワールド図鑑まで",
    sub: "配信中のストリーマーの試合を見て、視聴者として参加できます。",
  },
  en: {
    kicker: "Game data, one search away",
    title: "From LoL Stats to the Palworld Paldeck",
    sub: "Watch live streamers and join their games as a viewer.",
  },
});

type SharpFactory = typeof import("sharp")["default"];

let sharpFactoryPromise: Promise<SharpFactory> | undefined;

async function loadSharpFactory(): Promise<SharpFactory> {
  sharpFactoryPromise ??= import("sharp").then((module) => module.default);
  return sharpFactoryPromise;
}

function svgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** 홈 워드마크와 같은 붓 밑줄 — RecentMatchesShareActions.tsx drawBrushUnderline 과 동일 경로. */
const BRUSH_PATH = "M3 6.2 C 78 2, 168 9.4, 296 4.6 C 200 7.6, 96 7, 3 8.6 Z";

/** 노리개(장신구) 마크 — 홈 문법(원 + 세로선 + 삼각) 실측 좌표 재사용. */
function norigaeMarkSvg(x: number, y: number, color: string): string {
  return `
    <g transform="translate(${x}, ${y})" stroke="${color}" stroke-width="1.4" fill="none">
      <circle cx="8" cy="6" r="4.2"/>
      <line x1="8" y1="10.4" x2="8" y2="21"/>
      <path d="M4.6 21 L11.4 21 L8 28 Z"/>
    </g>
  `;
}

function overlaySvg(locale: PublicUrlLocale): Buffer {
  const copy = HOME_CARD_COPY[locale];
  const fontFamily = "Inter, Noto Sans CJK KR, Noto Sans CJK JP, sans-serif";
  const serifFamily = "Noto Serif CJK KR, Noto Serif CJK JP, Georgia, serif";
  /* 영어 타이틀("From LoL Stats to the Palworld Paldeck")은 한/일보다 글자 수가
     훨씬 많아 58px 그대로 쓰면 1200px 카드 폭을 넘어 잘립니다(실측 확인) —
     로케일별로 폭에 맞는 폰트 크기를 미리 계산합니다(진짜 자동 줄바꿈 대신
     카드가 한 줄 히어로 문구를 요구하므로 축소 방식을 씁니다). */
  const titleFontSize = locale === "en" ? 40 : 58;
  const titleY = locale === "en" ? 322 : 330;
  /* 카카오톡은 og:image(1200×630)를 중앙 630×630 근처로 정사각 크롭하는 경향이
     있어(실측 확인, LoL/패치노트 카드에서도 동일 대응) 좌측 정렬이면 브랜드
     로고와 본문 앞부분이 크롭됩니다 — 모든 텍스트를 카드 중앙(x=600)에
     text-anchor="middle"로 정렬해 어떤 크롭에도 안전하게 만듭니다. */
  const centerX = CARD_WIDTH / 2;
  return Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="${HOME_COLOR.bg}"/>
      <rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" fill="none" stroke="${HOME_COLOR.line}" stroke-width="1"/>
      <g text-anchor="middle">
        <text x="${centerX - 66}" y="98" font-family="${serifFamily}" font-size="42" font-weight="700" fill="${HOME_COLOR.ink}">YORO</text>
        <text x="${centerX + 64}" y="98" font-family="${fontFamily}" font-size="22" font-weight="800" fill="${HOME_COLOR.mid}">.GG</text>
        <text x="${centerX}" y="272" font-family="${fontFamily}" font-size="20" font-weight="700" letter-spacing="3" fill="${HOME_COLOR.mid}">${svgText(copy.kicker)}</text>
        <text x="${centerX}" y="${titleY}" font-family="${serifFamily}" font-size="${titleFontSize}" font-weight="700" fill="${HOME_COLOR.ink}">${svgText(copy.title)}</text>
        <text x="${centerX}" y="404" font-family="${fontFamily}" font-size="26" font-weight="500" fill="${HOME_COLOR.sub}">${svgText(copy.sub)}</text>
        <text x="${centerX}" y="${CARD_HEIGHT - 46}" font-family="${fontFamily}" font-size="20" font-weight="600" fill="${HOME_COLOR.mid}">yoro.gg</text>
      </g>
      <path d="${BRUSH_PATH}" fill="#4a5563" transform="translate(${centerX - 148}, 356) scale(1.2, 1)"/>
      ${norigaeMarkSvg(centerX + 148, 60, HOME_COLOR.mid)}
    </svg>
  `);
}

export class HomeSocialCardRenderer {
  private readonly cards = new Map<PublicUrlLocale, Buffer>();
  private readonly inFlight = new Map<PublicUrlLocale, Promise<Buffer>>();

  constructor(private readonly sharpFactoryLoader: () => Promise<SharpFactory> = loadSharpFactory) {}

  async render(locale: PublicUrlLocale): Promise<Buffer> {
    const cached = this.cards.get(locale);
    if (cached) return cached;
    const running = this.inFlight.get(locale);
    if (running) return running;
    const task = (async () => {
      const sharp = await this.sharpFactoryLoader();
      const body = await sharp(overlaySvg(locale))
        .timeout({ seconds: RENDER_TIMEOUT_SECONDS })
        .png({ compressionLevel: 9 })
        .toBuffer();
      this.cards.set(locale, body);
      return body;
    })();
    this.inFlight.set(locale, task);
    try {
      return await task;
    } finally {
      this.inFlight.delete(locale);
    }
  }
}

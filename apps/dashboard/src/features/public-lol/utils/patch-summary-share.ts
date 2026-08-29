import type { PatchNote, PatchPlayRecord } from "@streamops/shared";
import type { PatchTopChampion } from "../components/PatchChangeSummaryPanel";
import { patchStatLabel, type PatchChangeSummary, type PatchStatLabelLocale } from "../types/patch-change-summary";

/* 패치 요약 공유 카드(캔버스) — 목업 docs/mockups/patch-share-card-redesign-v2.html v5 승인 반영.
 *
 * 이전(v1.2) 디자인은 보라/파랑 그라디언트 + 반투명 패널이라 리디자인된 메인 홈
 * (--home-* 헤어라인 톤)과 어긋났고, 세 칸(시스템/챔피언/아이템)의 높이가 내용량에
 * 따라 제각각이라 정렬이 안 맞았습니다(사용자 실측 지적, 2026-08-29).
 *
 * v2~v5 반복 승인 경위:
 *  - v1(반려): 버프/너프/조정 색을 무채색으로 지워 한눈에 구분이 안 됨 → 반려.
 *  - v2: 3칸 높이를 COLUMN_HEIGHT 고정값으로 통일 + --home-win/--home-loss/gold
 *        3색을 유지 + Data Dragon 실제 아이콘 사용.
 *  - v3: 히어로 텍스트 오른쪽에 키 아트 썸네일 추가.
 *  - v4: 썸네일을 히어로 전체 폭 배경으로 확장, 텍스트 영역은 블러+반투명
 *        오버레이로 가독성 확보(요청: "배경 영역을 전부 채우고 글씨 영역은 흐리게").
 *  - v5(최종): 이미지 크롭 기준을 중앙→상단으로 변경(얼굴/타이틀이 위쪽에 있는
 *        가로 배너·세로 로딩스크린에서 핵심 요소가 잘리는 것을 방지).
 *
 * 이미지 출처 확인: imageUrl 은 서버가 Riot 패치노트 피드에서 수집한 카드
 * 대표 썸네일(patch-notes-source.ts: card.imageMedia.url)이며, 같은-origin
 * 프록시(/api/public/patch-notes/keyart)로 받으므로 "패치노트의 메인 이미지"를
 * 실제로 쓰는 것이 맞다 — 별도 이미지 소스 불필요(사용자 확인 요청에 대한 답).
 */

export type PatchSummaryShareText = {
  eyebrow: string;
  scope: string;
  system: string;
  buff: string;
  nerf: string;
  adjust: string;
  items: string;
  championCount: string;
  winRate: string;
  topChampions: string;
  games: string;
  source: string;
  itemNew: string;
  itemRemoved: string;
};

export type PatchSummaryShareInput = {
  note: PatchNote;
  summary: PatchChangeSummary;
  record?: PatchPlayRecord;
  topChampions?: readonly PatchTopChampion[];
  delta?: number;
  locale: PatchStatLabelLocale;
  text: PatchSummaryShareText;
};

/* 1200×630 고정 — 1.905:1. 서버 OG 카드(patch-notes-social-card.ts)와 규격 동일. */
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CARD_FONT = '"Inter", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif';
/* 패치 버전 숫자·YORO 워드마크는 홈 소셜카드(home-social-card.ts)와 같은
   세리프 계열을 써서 사이트 전체 브랜드 문법을 맞춘다. */
const SERIF_FONT = '"Noto Serif KR", "Noto Serif JP", Georgia, serif';
const HERO_MIN_HEIGHT = 176;
const HERO_MAX_HEIGHT = 300;
const FOOTER_HEIGHT = 64;
const PAD = 48;
const COLUMN_GAP = 16;
const COLUMN_WIDTH = (CARD_WIDTH - (PAD * 2) - (COLUMN_GAP * 2)) / 3;
const COLUMNS_BOTTOM = CARD_HEIGHT - FOOTER_HEIGHT - 12;
/* 히어로 텍스트가 앉는 블러 패널 폭 — 오른쪽은 키 아트가 그대로 선명하게 보인다. */
const HERO_TEXT_PANEL_WIDTH = 620;
/* 텍스트가 좁은 패널 폭을 넘지 않도록: scope 문구의 가용 폭 계산에 재사용. */
const HERO_TEXT_INNER_WIDTH = HERO_TEXT_PANEL_WIDTH - PAD;

/* 메인 홈 디자인 시스템(--home-*) 다크 톤 실측값 그대로(01-public-home.css) +
   버프/너프/조정 기능색은 유지한다(장식용 그라디언트만 제거 — 정보 색상은
   "한눈에 훑는" 기능이라 지우면 안 된다는 것이 v1 반려 사유였다). */
const COLOR = {
  bg: "#1C1D22",
  card: "#252730",
  ink: "#F5F6F8",
  sub: "#B9C3D0",
  line: "#3A404B",
  mid: "#8795A6",
  win: "#87A183",
  loss: "#DC4A5E",
  gold: "#D8B36A",
} as const;

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawRoundedImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
  radius: number,
): void {
  context.save();
  drawRoundedRect(context, x, y, size, size, radius);
  context.clip();
  context.drawImage(image, x, y, size, size);
  context.restore();
}

/** anchor="top": 패치노트 카드 이미지는 보통 위쪽에 캐릭터 얼굴·타이틀이 있는
 *  가로 배너이거나 세로로 긴 로딩스크린이라, 중앙 크롭이면 핵심 요소가
 *  위아래로 잘릴 수 있다(v5 반영 — 실측: 세로형 이미지에서 얼굴이 잘림). */
function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: "top" | "center" = "center",
): void {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = anchor === "top" ? 0 : (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadCanvasImage(url: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | undefined) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(undefined), 4_000);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => finish(image);
    image.onerror = () => finish(undefined);
    image.src = url;
  });
}

function fillTextEllipsis(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  if (context.measureText(value).width <= maxWidth) {
    context.fillText(value, x, y);
    return;
  }
  let text = value;
  while (text.length > 1 && context.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  context.fillText(`${text}…`, x, y);
}

/**
 * 키 아트는 같은 origin 프록시로 받습니다.
 *
 * Riot CDN(cmsassets.rgpub.io)은 access-control-allow-origin 을 주지 않아
 * crossOrigin 로드가 실패합니다(2026-08-18 실측). 서버가 같은 수집 경로로
 * 프록시하므로 URL 만 우리 쪽으로 돌립니다. 없으면 404 → 기존 폴백입니다.
 */
function heroArtUrl(patchVersion: string, locale: PatchStatLabelLocale): string {
  /* 키 아트는 노트 피드에서 오고 피드는 ko·ja 뿐입니다 — en 은 ko 아트로 떨어뜨립니다
     (영문 피드는 서버 작업, docs/handoffs/2026-08-23-patch-notes-en-locale-handoff.md). */
  const query = new URLSearchParams({ patch: patchVersion, locale: locale === "ja" ? "ja" : "ko" });
  return `/api/public/patch-notes/keyart?${query.toString()}`;
}

/** #RRGGBB 만 통과시킵니다 — 노트의 accentColor 는 외부 값이라 그대로 믿지 않습니다. */
function safeAccent(value: string | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/iu.test(value) ? value : undefined;
}

/** 패널 상자 하나 — 헤어라인 카드 배경 + 제목 + 구분선. 세 칸 모두 같은
 *  height(COLUMN_HEIGHT)를 넘겨받아 그려서 시각적 정렬을 맞춘다(v2 반영 —
 *  이전에는 칸마다 내용량만큼만 그려 높이가 제각각이었다). */
function drawPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
): number {
  drawRoundedRect(context, x, y, width, height, 3);
  context.fillStyle = COLOR.card;
  context.fill();
  context.strokeStyle = COLOR.line;
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = COLOR.mid;
  context.font = `700 18px ${CARD_FONT}`;
  context.fillText(title, x + 18, y + 27);
  context.strokeStyle = COLOR.line;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + 18, y + 40);
  context.lineTo(x + width - 18, y + 40);
  context.stroke();
  return y + 54;
}

/** 아이콘 + 방향 색 막대 + 이름 + 설명 한 줄. tone 이 있으면 버프(초록)/너프(빨강)/
 *  조정(골드) 중 하나 — v1에서 실수로 지웠다가 사용자 지적으로 복원한 색이다. */
function drawEntryRow(
  context: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    width: number;
    icon?: HTMLImageElement;
    name: string;
    detail: string;
    tone?: string;
  },
): void {
  const { x, y, width, icon, name, detail, tone } = options;
  const iconSize = 36;
  if (tone) {
    drawRoundedRect(context, x + 18, y, 3, iconSize, 1.5);
    context.fillStyle = tone;
    context.fill();
  }
  const iconX = x + 18 + (tone ? 10 : 0);
  if (icon) {
    drawRoundedImage(context, icon, iconX, y, iconSize, 6);
    if (tone) {
      context.strokeStyle = tone;
      context.lineWidth = 1.5;
      drawRoundedRect(context, iconX, y, iconSize, iconSize, 6);
      context.stroke();
    }
  } else {
    drawRoundedRect(context, iconX, y, iconSize, iconSize, 6);
    context.fillStyle = COLOR.bg;
    context.fill();
    context.strokeStyle = tone ?? COLOR.line;
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = COLOR.sub;
    context.font = `700 15px ${CARD_FONT}`;
    context.textAlign = "center";
    context.fillText(name.slice(0, 1), iconX + iconSize / 2, y + iconSize / 2 + 5);
    context.textAlign = "start";
  }
  const textX = iconX + iconSize + 12;
  const textWidth = width - (textX - x) - 16;
  context.fillStyle = COLOR.ink;
  context.font = `700 20px ${CARD_FONT}`;
  fillTextEllipsis(context, name, textX, y + 15, textWidth);
  context.fillStyle = tone ?? COLOR.mid;
  context.font = `700 16px ${CARD_FONT}`;
  fillTextEllipsis(context, detail, textX, y + 33, textWidth);
}

export async function createPatchSummaryShareBlob(input: PatchSummaryShareInput): Promise<Blob> {
  const { note, summary, record, topChampions, delta, locale, text } = input;

  /* 조정(강화·약화가 섞인 챔피언)은 화면 패널에 나옵니다. 카드에서만 빠지면 그
     패치에서 가장 많이 바뀐 챔피언이 공유 이미지에서 사라집니다
     (실측 26.16: 뽀삐 — 마나·마나성장·체력재생 ↑, 공격력 ↓). */
  const CHAMPION_ROW_LIMIT = 5;
  const byDirection = (["buff", "nerf", "adjust"] as const).map((direction) => ({
    direction,
    tone: direction === "buff" ? COLOR.win : direction === "nerf" ? COLOR.loss : COLOR.gold,
    list: summary.championChanges.filter((champion) => champion.direction === direction),
  }));
  /* 방향마다 최소 한 자리를 먼저 잡고 남는 칸을 채웁니다 — 앞에서부터 자르면
     버프가 많은 패치에서 조정·너프가 통째로 밀려납니다. */
  const championRows = [
    ...byDirection.flatMap(({ tone, list }) => list.slice(0, 1).map((champion) => ({ champion, tone }))),
    ...byDirection.flatMap(({ tone, list }) => list.slice(1).map((champion) => ({ champion, tone }))),
  ].slice(0, CHAMPION_ROW_LIMIT);
  const systemChanges = summary.systemChanges.slice(0, 3);
  const items = summary.itemChanges.slice(0, 2);
  const tops = (topChampions ?? []).slice(0, 3);

  /* 키 아트만 프록시를 지납니다 — Data Dragon 아이콘은 CORS 를 허용합니다. */
  const heroUrl = summary.patchVersion ? heroArtUrl(summary.patchVersion, locale) : undefined;
  const urls = [
    heroUrl,
    ...championRows.map((row) => row.champion.iconUrl),
    ...items.map((item) => item.iconUrl),
    ...tops.map((champion) => champion.iconUrl),
  ].filter((url): url is string => Boolean(url));
  const loaded = await Promise.all(Array.from(new Set(urls)).map(async (url) => [url, await loadCanvasImage(url)] as const));
  const images = new Map(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => Boolean(entry[1])));

  /* 세 칸이 실제로 쓰는 높이를 먼저 재고, 남는 만큼 히어로에 돌려줍니다.
     칸 자체는 항상 COLUMN_HEIGHT 로 그려 정렬을 맞추지만(v2), 히어로 크기
     계산에는 실제 내용 높이가 필요합니다(내용이 적을 때 히어로가 커짐). */
  const systemColumnHeight = systemChanges.length > 0 ? 46 + (systemChanges.length * 54) : 0;
  const championColumnHeight = championRows.length > 0 ? 46 + (championRows.length * 48) : 0;
  const itemsColumnHeight = items.length > 0 ? 46 + (items.length * 42) : 0;
  const mineColumnHeight = record ? (tops.length > 0 ? 152 : 100) + (itemsColumnHeight > 0 ? 12 : 0) : 0;
  const columnsHeight = Math.max(systemColumnHeight, championColumnHeight, itemsColumnHeight + mineColumnHeight);
  const quoteHeight = note.summary ? 72 : 24;
  const HERO_HEIGHT = Math.min(
    HERO_MAX_HEIGHT,
    Math.max(HERO_MIN_HEIGHT, COLUMNS_BOTTOM - columnsHeight - quoteHeight),
  );
  const COLUMNS_TOP = HERO_HEIGHT + quoteHeight;
  const COLUMN_HEIGHT = COLUMNS_BOTTOM - COLUMNS_TOP;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("patch_share_canvas_unavailable");

  /* 배경 — 그라디언트 대신 --home-bg 단색 + 카드 전체 1px 헤어라인 테두리
     (홈 소셜카드와 동일 문법, v2 반영). */
  context.fillStyle = COLOR.bg;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.strokeStyle = COLOR.line;
  context.lineWidth = 1;
  context.strokeRect(0.5, 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1);

  /* ── 히어로: 키 아트를 전체 폭에 cover 로 채운다(v4) — 상단 기준 크롭(v5). ── */
  const art = heroUrl ? images.get(heroUrl) : undefined;
  const accent = safeAccent(note.accentColor);
  context.save();
  drawRoundedRect(context, 0, 0, CARD_WIDTH, HERO_HEIGHT, 0);
  context.clip();
  if (art) {
    drawCoverImage(context, art, 0, 0, CARD_WIDTH, HERO_HEIGHT, "top");
  } else {
    /* 키 아트를 못 받으면(수집 실패·구버전 패치) 무채색 폴백 — 빈 공백을
       남기지 않는다. 그라디언트/글로우는 넣지 않는다(홈 디자인 원칙). */
    context.fillStyle = accent ? `${accent}22` : COLOR.card;
    context.fillRect(0, 0, CARD_WIDTH, HERO_HEIGHT);
  }
  context.restore();
  context.strokeStyle = COLOR.line;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, HERO_HEIGHT - 0.5);
  context.lineTo(CARD_WIDTH, HERO_HEIGHT - 0.5);
  context.stroke();

  /* ── 텍스트 블러 패널: 오프스크린 캔버스에 히어로를 blur 필터로 다시 그려
     텍스트가 앉을 영역만 오려 붙인다. 그 위에 반투명 어둠을 한 겹 더 얹어
     대비를 확보하되, 이미지 자체는 옅게 비치게 남긴다 — "배경을 전부
     채우되 글씨 자리만 흐리게"라는 요청대로 완전히 가리지 않는다(v4/v5). */
  if (art) {
    const off = document.createElement("canvas");
    off.width = CARD_WIDTH;
    off.height = HERO_HEIGHT;
    const offCtx = off.getContext("2d");
    if (offCtx) {
      offCtx.filter = "blur(10px)";
      drawCoverImage(offCtx, art, -20, -20, CARD_WIDTH + 40, HERO_HEIGHT + 40, "top");
      context.save();
      drawRoundedRect(context, 0, 0, HERO_TEXT_PANEL_WIDTH, HERO_HEIGHT, 0);
      context.clip();
      context.drawImage(off, 0, 0);
      const shade = context.createLinearGradient(0, 0, HERO_TEXT_PANEL_WIDTH, 0);
      shade.addColorStop(0, "rgba(20, 22, 28, 0.62)");
      shade.addColorStop(0.7, "rgba(20, 22, 28, 0.5)");
      shade.addColorStop(1, "rgba(20, 22, 28, 0.1)");
      context.fillStyle = shade;
      context.fillRect(0, 0, HERO_TEXT_PANEL_WIDTH, HERO_HEIGHT);
      context.restore();
      /* 블러 패널과 원본 이미지 경계 — 합성 지점을 의도로 보이게 헤어라인 하나. */
      context.strokeStyle = "rgba(245,246,248,0.12)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(HERO_TEXT_PANEL_WIDTH, 0);
      context.lineTo(HERO_TEXT_PANEL_WIDTH, HERO_HEIGHT);
      context.stroke();
    }
  }

  /* 히어로가 커져도 문구는 아래에 붙어 키 아트를 가리지 않습니다. */
  const heroTextBaseline = HERO_HEIGHT - 44;
  /* 텍스트에 약한 그림자를 줘 블러 뒤로 밝은 색이 지나가도 대비가 무너지지 않는다. */
  context.shadowColor = "rgba(0,0,0,0.55)";
  context.shadowBlur = 10;
  context.fillStyle = COLOR.mid;
  context.font = `700 20px ${CARD_FONT}`;
  context.fillText(text.eyebrow, PAD, heroTextBaseline - 58);
  context.fillStyle = COLOR.ink;
  context.font = `700 54px ${SERIF_FONT}`;
  context.fillText(summary.patchVersion, PAD, heroTextBaseline);
  const versionWidth = context.measureText(summary.patchVersion).width;
  context.fillStyle = COLOR.sub;
  context.font = `600 23px ${CARD_FONT}`;
  fillTextEllipsis(context, text.scope, PAD + versionWidth + 16, heroTextBaseline, HERO_TEXT_INNER_WIDTH - versionWidth - 16);
  context.shadowColor = "transparent";
  context.shadowBlur = 0;

  /* 노트 한 줄 요약 — 히어로 아래 전폭 바(카드 배경 위라 블러 불필요). */
  if (note.summary) {
    context.fillStyle = COLOR.line;
    context.fillRect(PAD, HERO_HEIGHT + 18, 3, 34);
    context.fillStyle = COLOR.sub;
    context.font = `500 21px ${CARD_FONT}`;
    fillTextEllipsis(context, note.summary, PAD + 18, HERO_HEIGHT + 42, CARD_WIDTH - (PAD * 2) - 18);
  }

  const columnX = (index: number): number => PAD + (index * (COLUMN_WIDTH + COLUMN_GAP));

  /* ── 1단: 시스템 변경(칸 높이 COLUMN_HEIGHT 고정) ── */
  if (systemChanges.length > 0) {
    let rowY = drawPanel(context, columnX(0), COLUMNS_TOP, COLUMN_WIDTH, COLUMN_HEIGHT, text.system);
    for (const change of systemChanges) {
      context.fillStyle = COLOR.ink;
      context.font = `700 20px ${CARD_FONT}`;
      fillTextEllipsis(context, patchStatLabel(change.stat, locale), columnX(0) + 18, rowY + 6, COLUMN_WIDTH - 36);
      const arrow = change.to > change.from ? "↑" : "↓";
      const tone = change.to > change.from ? COLOR.win : COLOR.loss;
      context.font = `700 18px ${CARD_FONT}`;
      context.fillStyle = tone;
      fillTextEllipsis(
        context,
        `${change.from} → ${change.to} ${arrow} · ${text.championCount.replace("{n}", String(change.championCount))}`,
        columnX(0) + 18,
        rowY + 32,
        COLUMN_WIDTH - 36,
      );
      rowY += 58;
    }
  }

  /* ── 2단: 챔피언 변경(버프 초록 → 너프 빨강 → 조정 골드), 실제 챔피언 아이콘 ── */
  if (championRows.length > 0) {
    let rowY = drawPanel(context, columnX(1), COLUMNS_TOP, COLUMN_WIDTH, COLUMN_HEIGHT, `${text.buff} · ${text.nerf} · ${text.adjust}`);
    for (const row of championRows) {
      drawEntryRow(context, {
        x: columnX(1),
        y: rowY,
        width: COLUMN_WIDTH,
        ...(row.champion.iconUrl && images.get(row.champion.iconUrl)
          ? { icon: images.get(row.champion.iconUrl)! }
          : {}),
        name: row.champion.name,
        detail: row.champion.changes.slice(0, 1)
          .map((change) => `${patchStatLabel(change.stat, locale)} ${change.from}→${change.to}`)
          .join(""),
        tone: row.tone,
      });
      rowY += 52;
    }
  }

  /* ── 3단: 아이템 변경 + 내 전적 — 같은 칸 높이 안에 나란히(v2: 칸 높이 정렬 통일) ── */
  {
    let rowY = drawPanel(context, columnX(2), COLUMNS_TOP, COLUMN_WIDTH, COLUMN_HEIGHT, text.items);
    for (const item of items) {
      drawEntryRow(context, {
        x: columnX(2),
        y: rowY,
        width: COLUMN_WIDTH,
        ...(item.iconUrl && images.get(item.iconUrl) ? { icon: images.get(item.iconUrl)! } : {}),
        name: item.name,
        detail: item.kind === "price" && item.from !== undefined && item.to !== undefined
          ? `${item.from} → ${item.to} G`
          : item.kind === "new" ? text.itemNew : text.itemRemoved,
      });
      rowY += 52;
    }

    if (record) {
      /* 내 전적 서브패널 — 칸 하단까지 남는 공간을 전부 채운다. 공간이
         좁으면(최다 사용 아이콘 자리 부족) 승률만 보여주고 최다 사용은
         통째로 생략한다 — v1에서 억지로 욱여넣다 푸터와 겹치던 문제를
         여기서 원천 차단. */
      const subTop = rowY + 10;
      const subHeight = COLUMNS_TOP + COLUMN_HEIGHT - subTop;
      if (subHeight >= 60) {
        const showTops = tops.length > 0 && subHeight >= 150;
        drawRoundedRect(context, columnX(2) + 12, subTop, COLUMN_WIDTH - 24, subHeight, 3);
        context.fillStyle = COLOR.bg;
        context.fill();
        context.strokeStyle = COLOR.line;
        context.lineWidth = 1;
        context.stroke();

        context.fillStyle = COLOR.mid;
        context.font = `700 16px ${CARD_FONT}`;
        context.fillText(text.winRate, columnX(2) + 30, subTop + 24);
        context.fillStyle = record.winRate >= 50 ? COLOR.win : COLOR.loss;
        context.font = `700 30px ${CARD_FONT}`;
        const rateText = `${record.winRate.toFixed(1)}%`;
        context.fillText(rateText, columnX(2) + 30, subTop + 56);
        const rateWidth = context.measureText(rateText).width;
        if (delta !== undefined && delta !== 0) {
          context.fillStyle = delta > 0 ? COLOR.win : COLOR.loss;
          context.font = `700 16px ${CARD_FONT}`;
          context.fillText(`${delta > 0 ? "▲" : "▼"}${Math.abs(delta).toFixed(1)}%p`, columnX(2) + 30 + rateWidth + 10, subTop + 56);
        }
        const losses = Math.max(0, record.games - record.wins);
        context.fillStyle = COLOR.mid;
        context.font = `600 15px ${CARD_FONT}`;
        context.textAlign = "right";
        context.fillText(`${record.games}${text.games} · ${record.wins}W ${losses}L`, columnX(2) + COLUMN_WIDTH - 30, subTop + 56);
        context.textAlign = "start";

        const gaugeWidth = COLUMN_WIDTH - 60;
        const winWidth = record.games > 0 ? (record.wins / record.games) * gaugeWidth : 0;
        drawRoundedRect(context, columnX(2) + 30, subTop + 68, gaugeWidth, 4, 2);
        context.fillStyle = COLOR.line;
        context.fill();
        context.save();
        drawRoundedRect(context, columnX(2) + 30, subTop + 68, winWidth, 4, 2);
        context.clip();
        context.fillStyle = COLOR.win;
        context.fillRect(columnX(2) + 30, subTop + 68, winWidth, 4);
        context.restore();

        if (showTops) {
          context.fillStyle = COLOR.mid;
          context.font = `600 14px ${CARD_FONT}`;
          context.fillText(text.topChampions, columnX(2) + 30, subTop + 92);
          const slot = (COLUMN_WIDTH - 60) / 3;
          tops.forEach((champion, index) => {
            const x = columnX(2) + 30 + (index * slot);
            const icon = champion.iconUrl ? images.get(champion.iconUrl) : undefined;
            if (icon) drawRoundedImage(context, icon, x, subTop + 98, 28, 6);
            else {
              drawRoundedRect(context, x, subTop + 98, 28, 28, 6);
              context.fillStyle = COLOR.card;
              context.fill();
            }
            const rate = champion.games > 0 ? Math.round((champion.wins / champion.games) * 100) : 0;
            context.fillStyle = rate >= 50 ? COLOR.win : COLOR.loss;
            context.font = `700 13px ${CARD_FONT}`;
            fillTextEllipsis(context, `${champion.games}${text.games}·${rate}%`, x, subTop + 140, slot - 8);
          });
        }
      }
    }
  }

  const footerY = CARD_HEIGHT - FOOTER_HEIGHT;
  context.fillStyle = COLOR.line;
  context.fillRect(PAD, footerY, CARD_WIDTH - (PAD * 2), 1);
  /* 홈 워드마크 문법 그대로: 세리프 YORO + 고딕 .GG(home-social-card.ts와 동일). */
  context.fillStyle = COLOR.ink;
  context.font = `700 23px ${SERIF_FONT}`;
  context.fillText("YORO", PAD, footerY + 42);
  const brandWidth = context.measureText("YORO").width;
  context.fillStyle = COLOR.mid;
  context.font = `800 15px ${CARD_FONT}`;
  context.fillText(".GG", PAD + brandWidth + 4, footerY + 42);
  /* 출처·범위는 항상 답니다 — 이 카드는 Riot 본문 요약이 아닙니다. */
  context.textAlign = "right";
  context.fillStyle = COLOR.mid;
  context.font = `600 17px ${CARD_FONT}`;
  fillTextEllipsis(context, text.source, CARD_WIDTH - PAD, footerY + 42, CARD_WIDTH - 320);
  context.textAlign = "start";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("patch_share_blob_unavailable"));
    }, "image/png", .92);
  });
}

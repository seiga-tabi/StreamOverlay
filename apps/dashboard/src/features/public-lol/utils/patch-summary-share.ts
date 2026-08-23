import type { PatchNote, PatchPlayRecord } from "@streamops/shared";
import type { PatchTopChampion } from "../components/PatchChangeSummaryPanel";
import { patchStatLabel, type PatchChangeSummary, type PatchStatLabelLocale } from "../types/patch-change-summary";

/* 패치 요약 공유 카드(캔버스) — 목업 docs/mockups/lol-patch-summary-share.html v1.2 §③.
 *
 * 키 아트 + 노트의 accentColor 위에 우리가 계산한 요약을 얹습니다. 프로필 공유
 * 카드와 같은 규격을 씁니다: 폭 1080 고정, 최소 높이 566(1.91:1 — 인스타 피드·X
 * 크롭 경계), 개별 이미지 실패는 도형 폴백으로 닫고 전체 실패만 오류로 올립니다.
 *
 * 푸터의 출처·범위 문구는 선택이 아닙니다 — 이 카드가 담은 것은 Riot 본문 요약이
 * 아니라 기본 스탯·아이템 비교 결과이며, 그 사실을 카드가 스스로 밝혀야 합니다.
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

/* 1200×630 고정 — 1.905:1.
 *
 * 예전에는 폭 1080 에 내용만큼 세로로 늘렸는데, 블록이 다 차면 1080×990(1.09:1)까지
 * 자라 SNS 타임라인이 위아래를 잘라 냈습니다(푸터의 출처 문구까지 사라짐).
 * 목업의 가드는 "높이 ≥ 566"이라 세로로 길어지는 쪽을 막지 못했습니다.
 * 이제 높이를 고정하고 본문을 3단으로 놓아 모든 블록이 한 화면에 들어옵니다.
 * 서버 OG 카드(1200×630)와도 규격이 같아집니다. */
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CARD_FONT = '"Inter", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif';
/* 히어로는 남는 세로를 흡수합니다 — 높이가 고정이라 내용이 적은 패치에서
   아래가 통째로 비지 않게 키 아트를 키웁니다. */
const HERO_MIN_HEIGHT = 176;
const HERO_MAX_HEIGHT = 320;
const FOOTER_HEIGHT = 64;
const PAD = 48;
const COLUMN_GAP = 16;
const COLUMN_WIDTH = (CARD_WIDTH - (PAD * 2) - (COLUMN_GAP * 2)) / 3;
const COLUMNS_BOTTOM = CARD_HEIGHT - FOOTER_HEIGHT - 12;

const COLOR = {
  bg0: "#0e1320",
  bg1: "#171e30",
  text: "#f2f5fa",
  muted: "#a9b4c9",
  dim: "#7f8ba2",
  line: "rgba(255, 255, 255, .09)",
  brand: "#9b90ff",
  buff: "#3b95fb",
  nerf: "#f4555f",
  gold: "#f0c25f",
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

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(
    image,
    (image.width - sourceWidth) / 2,
    (image.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
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
 * crossOrigin 로드가 실패합니다(2026-08-18 실측). 그대로 두면 히어로가 늘 빈
 * 그라디언트로 닫혀 "이미지가 안 나온다"로 보입니다. 서버가 같은 수집 경로로
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

/** 패널 상자 하나 — 둥근 배경 + 제목. 반환값은 내용이 시작되는 y 입니다. */
function drawPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  tone: string = COLOR.dim,
): number {
  drawRoundedRect(context, x, y, width, height, 18);
  context.fillStyle = "rgba(255, 255, 255, .03)";
  context.fill();
  context.strokeStyle = COLOR.line;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = tone;
  context.font = `800 19px ${CARD_FONT}`;
  context.fillText(title, x + 18, y + 28);
  return y + 48;
}

/** 아이콘 + 이름 + 설명 한 줄. 열 폭 안에서 이름·설명 모두 말줄임 처리합니다. */
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
  const { x, y, width, icon, name, detail } = options;
  const iconSize = 36;
  if (icon) drawRoundedImage(context, icon, x + 18, y, iconSize, 9);
  else {
    drawRoundedRect(context, x + 18, y, iconSize, iconSize, 9);
    context.fillStyle = "#26334a";
    context.fill();
  }
  if (options.tone) {
    /* 방향 표시 — 아이콘 왼쪽의 얇은 막대. 색 하나로 버프·너프·조정을 구분합니다. */
    drawRoundedRect(context, x + 8, y + 4, 4, iconSize - 8, 2);
    context.fillStyle = options.tone;
    context.fill();
  }
  const textX = x + 18 + iconSize + 12;
  const textWidth = width - (textX - x) - 16;
  context.fillStyle = COLOR.text;
  context.font = `850 21px ${CARD_FONT}`;
  fillTextEllipsis(context, name, textX, y + 16, textWidth);
  context.fillStyle = COLOR.dim;
  context.font = `700 17px ${CARD_FONT}`;
  fillTextEllipsis(context, detail, textX, y + 34, textWidth);
}

export async function createPatchSummaryShareBlob(input: PatchSummaryShareInput): Promise<Blob> {
  const { note, summary, record, topChampions, delta, locale, text } = input;

  /* 조정(강화·약화가 섞인 챔피언)은 화면 패널에 나옵니다. 카드에서만 빠지면 그
     패치에서 가장 많이 바뀐 챔피언이 공유 이미지에서 사라집니다
     (실측 26.16: 뽀삐 — 마나·마나성장·체력재생 ↑, 공격력 ↓). */
  const CHAMPION_ROW_LIMIT = 5;
  const byDirection = (["buff", "nerf", "adjust"] as const).map((direction) => ({
    direction,
    tone: direction === "buff" ? COLOR.buff : direction === "nerf" ? COLOR.nerf : COLOR.gold,
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

  /* 세 단이 실제로 쓰는 높이를 먼저 재고, 남는 만큼 히어로에 돌려줍니다. */
  const systemColumnHeight = systemChanges.length > 0 ? 48 + (systemChanges.length * 54) : 0;
  const championColumnHeight = championRows.length > 0 ? 48 + (championRows.length * 50) : 0;
  const itemsColumnHeight = items.length > 0 ? 48 + (items.length * 44) : 0;
  const mineColumnHeight = record ? (tops.length > 0 ? 156 : 104) + (itemsColumnHeight > 0 ? 12 : 0) : 0;
  const columnsHeight = Math.max(systemColumnHeight, championColumnHeight, itemsColumnHeight + mineColumnHeight);
  const quoteHeight = note.summary ? 74 : 24;
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

  const background = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  background.addColorStop(0, COLOR.bg1);
  background.addColorStop(.55, COLOR.bg0);
  background.addColorStop(1, COLOR.bg0);
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  /* 히어로 — 키 아트 + accentColor 틴트 + 하단 페이드.
     프록시가 404 이거나 로드가 실패하면 accentColor + 브랜드 그라디언트로 닫습니다 —
     빈 검은 띠를 남기지 않습니다. */
  const art = heroUrl ? images.get(heroUrl) : undefined;
  const accent = safeAccent(note.accentColor);
  if (art) {
    drawCoverImage(context, art, 0, 0, CARD_WIDTH, HERO_HEIGHT);
    if (accent) {
      context.save();
      context.globalAlpha = .42;
      context.fillStyle = accent;
      context.fillRect(0, 0, CARD_WIDTH, HERO_HEIGHT);
      context.restore();
    }
  } else {
    const heroFallback = context.createLinearGradient(0, 0, CARD_WIDTH, HERO_HEIGHT);
    heroFallback.addColorStop(0, accent ?? "#1d2440");
    heroFallback.addColorStop(.62, "#242c4a");
    heroFallback.addColorStop(1, COLOR.bg0);
    context.fillStyle = heroFallback;
    context.fillRect(0, 0, CARD_WIDTH, HERO_HEIGHT);
    const glow = context.createRadialGradient(CARD_WIDTH * .78, 0, 0, CARD_WIDTH * .78, 0, CARD_WIDTH * .6);
    glow.addColorStop(0, "rgba(155, 144, 255, .3)");
    glow.addColorStop(1, "rgba(155, 144, 255, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, CARD_WIDTH, HERO_HEIGHT);
  }
  const shade = context.createLinearGradient(0, 0, 0, HERO_HEIGHT);
  shade.addColorStop(0, "rgba(14, 19, 32, .48)");
  shade.addColorStop(.55, "rgba(14, 19, 32, .8)");
  shade.addColorStop(1, COLOR.bg0);
  context.fillStyle = shade;
  context.fillRect(0, 0, CARD_WIDTH, HERO_HEIGHT);

  /* 히어로가 커져도 문구는 아래에 붙어 키 아트를 가리지 않습니다. */
  const heroTextBaseline = HERO_HEIGHT - 44;
  context.fillStyle = COLOR.gold;
  context.font = `800 21px ${CARD_FONT}`;
  context.fillText(text.eyebrow, PAD, heroTextBaseline - 58);
  context.fillStyle = COLOR.text;
  context.font = `900 54px ${CARD_FONT}`;
  context.fillText(summary.patchVersion, PAD, heroTextBaseline);
  const versionWidth = context.measureText(summary.patchVersion).width;
  context.fillStyle = COLOR.muted;
  context.font = `700 24px ${CARD_FONT}`;
  fillTextEllipsis(context, text.scope, PAD + versionWidth + 16, heroTextBaseline, CARD_WIDTH - PAD * 2 - versionWidth - 16);

  /* 노트 한 줄 요약 — 히어로 바로 아래 전폭. */
  if (note.summary) {
    context.fillStyle = COLOR.gold;
    context.fillRect(PAD, HERO_HEIGHT + 18, 4, 34);
    context.fillStyle = COLOR.muted;
    context.font = `650 22px ${CARD_FONT}`;
    fillTextEllipsis(context, note.summary, PAD + 18, HERO_HEIGHT + 42, CARD_WIDTH - (PAD * 2) - 18);
  }

  const columnX = (index: number): number => PAD + (index * (COLUMN_WIDTH + COLUMN_GAP));

  /* ── 1단: 시스템 변경 ── */
  if (systemChanges.length > 0) {
    const height = 48 + (systemChanges.length * 54);
    let rowY = drawPanel(context, columnX(0), COLUMNS_TOP, COLUMN_WIDTH, Math.min(height, COLUMN_HEIGHT), text.system);
    for (const change of systemChanges) {
      context.fillStyle = COLOR.text;
      context.font = `800 21px ${CARD_FONT}`;
      fillTextEllipsis(context, patchStatLabel(change.stat, locale), columnX(0) + 18, rowY + 8, COLUMN_WIDTH - 36);
      /* 값과 대상 인원은 아랫줄로 내립니다 — 한 줄에 붙이면 좁은 단에서 넘칩니다. */
      context.font = `700 19px ${CARD_FONT}`;
      context.fillStyle = COLOR.muted;
      const fromText = `${change.from} → `;
      context.fillText(fromText, columnX(0) + 18, rowY + 32);
      const fromWidth = context.measureText(fromText).width;
      context.fillStyle = change.to > change.from ? COLOR.buff : COLOR.nerf;
      context.font = `800 19px ${CARD_FONT}`;
      context.fillText(String(change.to), columnX(0) + 18 + fromWidth, rowY + 32);
      const toWidth = context.measureText(String(change.to)).width;
      context.fillStyle = COLOR.dim;
      context.font = `700 17px ${CARD_FONT}`;
      fillTextEllipsis(
        context,
        ` · ${text.championCount.replace("{n}", String(change.championCount))}`,
        columnX(0) + 18 + fromWidth + toWidth,
        rowY + 32,
        COLUMN_WIDTH - 36 - fromWidth - toWidth,
      );
      rowY += 54;
    }
  }

  /* ── 2단: 챔피언 변경(버프 → 너프 → 조정) ── */
  if (championRows.length > 0) {
    const height = 48 + (championRows.length * 50);
    let rowY = drawPanel(context, columnX(1), COLUMNS_TOP, COLUMN_WIDTH, Math.min(height, COLUMN_HEIGHT), text.buff + " · " + text.nerf + " · " + text.adjust);
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
      rowY += 50;
    }
  }

  /* ── 3단: 아이템 + 내 전적 ── */
  let thirdY = COLUMNS_TOP;
  if (items.length > 0) {
    const height = 48 + (items.length * 44);
    let rowY = drawPanel(context, columnX(2), thirdY, COLUMN_WIDTH, height, text.items);
    for (const item of items) {
      drawEntryRow(context, {
        x: columnX(2),
        y: rowY - 4,
        width: COLUMN_WIDTH,
        ...(item.iconUrl && images.get(item.iconUrl) ? { icon: images.get(item.iconUrl)! } : {}),
        name: item.name,
        detail: item.kind === "price" && item.from !== undefined && item.to !== undefined
          ? `${item.from} → ${item.to} G`
          : item.kind === "new" ? text.itemNew : text.itemRemoved,
      });
      rowY += 44;
    }
    thirdY += height + 12;
  }

  if (record && thirdY < COLUMNS_BOTTOM - 60) {
    const available = COLUMNS_BOTTOM - thirdY;
    /* 최다 사용 챔피언까지 담으려면 156 이 필요합니다. 모자라면 승률·게이지만 남깁니다. */
    const showTops = tops.length > 0 && available >= 156;
    const height = Math.min(available, showTops ? 156 : 104);
    drawRoundedRect(context, columnX(2), thirdY, COLUMN_WIDTH, height, 18);
    context.fillStyle = "rgba(155, 144, 255, .08)";
    context.fill();
    context.strokeStyle = "rgba(155, 144, 255, .35)";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = COLOR.dim;
    context.font = `700 19px ${CARD_FONT}`;
    context.fillText(text.winRate, columnX(2) + 18, thirdY + 26);
    context.fillStyle = record.winRate >= 50 ? COLOR.buff : COLOR.nerf;
    context.font = `900 34px ${CARD_FONT}`;
    const rateText = `${record.winRate.toFixed(1)}%`;
    context.fillText(rateText, columnX(2) + 18, thirdY + 62);
    const rateWidth = context.measureText(rateText).width;
    if (delta !== undefined && delta !== 0) {
      context.fillStyle = delta > 0 ? COLOR.buff : COLOR.nerf;
      context.font = `800 19px ${CARD_FONT}`;
      context.fillText(`${delta > 0 ? "▲" : "▼"}${Math.abs(delta).toFixed(1)}%p`, columnX(2) + 18 + rateWidth + 10, thirdY + 62);
    }
    const losses = Math.max(0, record.games - record.wins);
    context.fillStyle = COLOR.dim;
    context.font = `700 17px ${CARD_FONT}`;
    context.textAlign = "right";
    context.fillText(`${record.games}${text.games} · ${record.wins}W ${losses}L`, columnX(2) + COLUMN_WIDTH - 18, thirdY + 62);
    context.textAlign = "start";

    /* 승/패 게이지 — 승 파랑, 패 빨강. */
    const gaugeWidth = COLUMN_WIDTH - 36;
    const winWidth = record.games > 0 ? (record.wins / record.games) * gaugeWidth : 0;
    context.save();
    drawRoundedRect(context, columnX(2) + 18, thirdY + 74, gaugeWidth, 9, 5);
    context.clip();
    context.fillStyle = COLOR.nerf;
    context.fillRect(columnX(2) + 18, thirdY + 74, gaugeWidth, 9);
    context.fillStyle = COLOR.buff;
    context.fillRect(columnX(2) + 18, thirdY + 74, winWidth, 9);
    context.restore();

    /* 최다 사용 챔피언 — 얼굴로 읽히는 자리라 이름 대신 아이콘과 성적을 냅니다
       (좁은 단에서 이름을 넣으면 "아우렐…"처럼 잘립니다). */
    if (showTops) {
      context.fillStyle = COLOR.dim;
      context.font = `700 16px ${CARD_FONT}`;
      context.fillText(text.topChampions, columnX(2) + 18, thirdY + 100);
      /* 성적은 아이콘 옆이 아니라 아래에 둡니다 — 옆에 두면 한 칸이 60px 남짓이라
         "7게임·…" 처럼 잘립니다(실측). 아래로 내리면 칸 폭 전체를 씁니다. */
      const slot = (COLUMN_WIDTH - 36) / 3;
      tops.forEach((champion, index) => {
        const x = columnX(2) + 18 + (index * slot);
        const icon = champion.iconUrl ? images.get(champion.iconUrl) : undefined;
        if (icon) drawRoundedImage(context, icon, x, thirdY + 106, 30, 8);
        else {
          drawRoundedRect(context, x, thirdY + 106, 30, 30, 8);
          context.fillStyle = "#26334a";
          context.fill();
        }
        const rate = champion.games > 0 ? Math.round((champion.wins / champion.games) * 100) : 0;
        context.fillStyle = rate >= 50 ? COLOR.buff : COLOR.nerf;
        context.font = `800 15px ${CARD_FONT}`;
        fillTextEllipsis(context, `${champion.games}${text.games} · ${rate}%`, x, thirdY + 148, slot - 8);
      });
    }
  }

  const footerY = CARD_HEIGHT - FOOTER_HEIGHT;
  context.fillStyle = COLOR.line;
  context.fillRect(PAD, footerY, CARD_WIDTH - (PAD * 2), 2);
  context.fillStyle = COLOR.text;
  context.font = `900 24px ${CARD_FONT}`;
  context.fillText("YORO", PAD, footerY + 42);
  const brandWidth = context.measureText("YORO").width;
  context.fillStyle = COLOR.brand;
  context.fillText(".gg", PAD + brandWidth, footerY + 42);
  /* 출처·범위는 항상 답니다 — 이 카드는 Riot 본문 요약이 아닙니다. */
  context.textAlign = "right";
  context.fillStyle = COLOR.dim;
  context.font = `650 18px ${CARD_FONT}`;
  fillTextEllipsis(context, text.source, CARD_WIDTH - PAD, footerY + 42, CARD_WIDTH - 320);
  context.textAlign = "start";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("patch_share_blob_unavailable"));
    }, "image/png", .92);
  });
}

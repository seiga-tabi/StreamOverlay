import type { PatchNote, PatchPlayRecord } from "@streamops/shared";
import type { PatchTopChampion } from "../components/PatchChangeSummaryPanel";
import { patchStatLabel, type PatchChangeSummary } from "../types/patch-change-summary";

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
  locale: "ko" | "ja";
  text: PatchSummaryShareText;
};

const CARD_WIDTH = 1080;
/* 1080 / 1.91 ≈ 565.4 — SNS 크롭 경계(프로필 공유 카드와 같은 가드). */
const MIN_CARD_HEIGHT = 566;
const CARD_FONT = '"Inter", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif';
const HERO_HEIGHT = 264;
const FOOTER_HEIGHT = 76;

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

/** #RRGGBB 만 통과시킵니다 — 노트의 accentColor 는 외부 값이라 그대로 믿지 않습니다. */
function safeAccent(value: string | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/iu.test(value) ? value : undefined;
}

export async function createPatchSummaryShareBlob(input: PatchSummaryShareInput): Promise<Blob> {
  const { note, summary, record, topChampions, delta, locale, text } = input;

  const buffs = summary.championChanges.filter((champion) => champion.direction === "buff").slice(0, 3);
  const nerfs = summary.championChanges.filter((champion) => champion.direction === "nerf").slice(0, 3);
  const systemChanges = summary.systemChanges.slice(0, 2);
  const items = summary.itemChanges.slice(0, 2);
  const tops = (topChampions ?? []).slice(0, 3);

  const urls = [
    note.imageUrl,
    ...buffs.map((champion) => champion.iconUrl),
    ...nerfs.map((champion) => champion.iconUrl),
    ...items.map((item) => item.iconUrl),
    ...tops.map((champion) => champion.iconUrl),
  ].filter((url): url is string => Boolean(url));
  const loaded = await Promise.all(Array.from(new Set(urls)).map(async (url) => [url, await loadCanvasImage(url)] as const));
  const images = new Map(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => Boolean(entry[1])));

  /* 블록 구성에 따라 높이가 달라집니다 — 없는 블록은 자리를 차지하지 않습니다. */
  const quoteHeight = note.summary ? 58 : 0;
  const systemHeight = systemChanges.length > 0 ? 40 + (systemChanges.length * 34) : 0;
  const championHeight = buffs.length > 0 || nerfs.length > 0
    ? 40 + (Math.max(buffs.length, nerfs.length) * 56)
    : 0;
  const itemHeight = items.length > 0 ? 40 + (items.length * 52) : 0;
  const mineHeight = record ? 108 : 0;
  const bodyHeight = quoteHeight + systemHeight + championHeight + itemHeight + mineHeight;
  const height = Math.max(MIN_CARD_HEIGHT, HERO_HEIGHT + 24 + bodyHeight + FOOTER_HEIGHT);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("patch_share_canvas_unavailable");

  const background = context.createLinearGradient(0, 0, CARD_WIDTH, height);
  background.addColorStop(0, COLOR.bg1);
  background.addColorStop(.55, COLOR.bg0);
  background.addColorStop(1, COLOR.bg0);
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, height);

  /* 히어로 — 키 아트 + accentColor 틴트 + 하단 페이드.
     키 아트(cmsassets.rgpub.io)는 CORS 헤더를 주지 않아 crossOrigin 로드가 실패합니다
     (2026-08-18 실측: access-control-allow-origin 없음). 서버 이미지 프록시가 생기면
     그대로 그려지고, 그 전까지는 accentColor + 브랜드 그라디언트로 닫습니다 —
     빈 검은 띠를 남기지 않습니다. */
  const art = note.imageUrl ? images.get(note.imageUrl) : undefined;
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
  shade.addColorStop(0, "rgba(14, 19, 32, .5)");
  shade.addColorStop(.55, "rgba(14, 19, 32, .82)");
  shade.addColorStop(1, COLOR.bg0);
  context.fillStyle = shade;
  context.fillRect(0, 0, CARD_WIDTH, HERO_HEIGHT);

  context.fillStyle = COLOR.gold;
  context.font = `800 22px ${CARD_FONT}`;
  context.fillText(text.eyebrow, 48, HERO_HEIGHT - 96);
  context.fillStyle = COLOR.text;
  context.font = `900 52px ${CARD_FONT}`;
  context.fillText(summary.patchVersion, 48, HERO_HEIGHT - 44);
  const versionWidth = context.measureText(summary.patchVersion).width;
  context.fillStyle = COLOR.muted;
  context.font = `700 26px ${CARD_FONT}`;
  fillTextEllipsis(context, text.scope, 48 + versionWidth + 16, HERO_HEIGHT - 44, CARD_WIDTH - versionWidth - 120);

  let y = HERO_HEIGHT + 24;

  if (note.summary) {
    context.fillStyle = COLOR.gold;
    context.fillRect(48, y, 4, 36);
    context.fillStyle = COLOR.muted;
    context.font = `650 23px ${CARD_FONT}`;
    fillTextEllipsis(context, note.summary, 66, y + 25, CARD_WIDTH - 114);
    y += quoteHeight;
  }

  const blockTitle = (title: string, blockY: number) => {
    context.fillStyle = COLOR.dim;
    context.font = `800 20px ${CARD_FONT}`;
    context.fillText(title, 68, blockY + 30);
  };

  if (systemChanges.length > 0) {
    drawRoundedRect(context, 48, y, CARD_WIDTH - 96, systemHeight - 12, 18);
    context.fillStyle = "rgba(255, 255, 255, .03)";
    context.fill();
    context.strokeStyle = COLOR.line;
    context.lineWidth = 2;
    context.stroke();
    blockTitle(text.system, y);
    systemChanges.forEach((change, index) => {
      const rowY = y + 62 + (index * 34);
      context.fillStyle = COLOR.text;
      context.font = `800 24px ${CARD_FONT}`;
      const label = patchStatLabel(change.stat, locale);
      context.fillText(label, 68, rowY);
      const labelWidth = context.measureText(label).width;
      context.fillStyle = COLOR.muted;
      context.font = `700 24px ${CARD_FONT}`;
      const fromText = `  ${change.from} → `;
      context.fillText(fromText, 68 + labelWidth, rowY);
      context.fillStyle = change.to > change.from ? COLOR.buff : COLOR.nerf;
      context.font = `800 24px ${CARD_FONT}`;
      context.fillText(String(change.to), 68 + labelWidth + context.measureText(fromText).width, rowY);
      context.fillStyle = COLOR.dim;
      context.font = `700 21px ${CARD_FONT}`;
      context.textAlign = "right";
      context.fillText(text.championCount.replace("{n}", String(change.championCount)), CARD_WIDTH - 68, rowY);
      context.textAlign = "start";
    });
    y += systemHeight;
  }

  if (buffs.length > 0 || nerfs.length > 0) {
    const columnWidth = (CARD_WIDTH - 96 - 16) / 2;
    const columnHeight = championHeight - 12;
    ([[text.buff, COLOR.buff, buffs, 48], [text.nerf, COLOR.nerf, nerfs, 48 + columnWidth + 16]] as const)
      .forEach(([title, tone, list, x]) => {
        drawRoundedRect(context, x, y, columnWidth, columnHeight, 18);
        context.fillStyle = "rgba(255, 255, 255, .03)";
        context.fill();
        context.strokeStyle = COLOR.line;
        context.lineWidth = 2;
        context.stroke();
        context.fillStyle = tone;
        context.font = `800 20px ${CARD_FONT}`;
        context.fillText(title, x + 20, y + 30);
        list.forEach((champion, index) => {
          const rowY = y + 46 + (index * 56);
          const icon = champion.iconUrl ? images.get(champion.iconUrl) : undefined;
          if (icon) drawRoundedImage(context, icon, x + 20, rowY, 40, 10);
          else {
            drawRoundedRect(context, x + 20, rowY, 40, 40, 10);
            context.fillStyle = "#26334a";
            context.fill();
          }
          context.fillStyle = COLOR.text;
          context.font = `850 23px ${CARD_FONT}`;
          fillTextEllipsis(context, champion.name, x + 72, rowY + 18, columnWidth - 92);
          context.fillStyle = COLOR.dim;
          context.font = `700 19px ${CARD_FONT}`;
          const detail = champion.changes.slice(0, 1)
            .map((change) => `${patchStatLabel(change.stat, locale)} ${change.from}→${change.to}`)
            .join("");
          fillTextEllipsis(context, detail, x + 72, rowY + 38, columnWidth - 92);
        });
      });
    y += championHeight;
  }

  if (items.length > 0) {
    drawRoundedRect(context, 48, y, CARD_WIDTH - 96, itemHeight - 12, 18);
    context.fillStyle = "rgba(255, 255, 255, .03)";
    context.fill();
    context.strokeStyle = COLOR.line;
    context.lineWidth = 2;
    context.stroke();
    blockTitle(text.items, y);
    items.forEach((item, index) => {
      const rowY = y + 44 + (index * 52);
      const icon = item.iconUrl ? images.get(item.iconUrl) : undefined;
      if (icon) drawRoundedImage(context, icon, 68, rowY, 38, 9);
      else {
        drawRoundedRect(context, 68, rowY, 38, 38, 9);
        context.fillStyle = "#26334a";
        context.fill();
      }
      context.fillStyle = COLOR.text;
      context.font = `850 23px ${CARD_FONT}`;
      fillTextEllipsis(context, item.name, 118, rowY + 17, 420);
      context.fillStyle = COLOR.dim;
      context.font = `700 20px ${CARD_FONT}`;
      const detail = item.kind === "price" && item.from !== undefined && item.to !== undefined
        ? `${item.from} → ${item.to} G`
        : item.kind === "new" ? text.itemNew : text.itemRemoved;
      context.fillText(detail, 118, rowY + 37);
    });
    y += itemHeight;
  }

  if (record) {
    const blockHeight = mineHeight - 12;
    drawRoundedRect(context, 48, y, CARD_WIDTH - 96, blockHeight, 18);
    context.fillStyle = "rgba(155, 144, 255, .08)";
    context.fill();
    context.strokeStyle = "rgba(155, 144, 255, .35)";
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = COLOR.dim;
    context.font = `700 20px ${CARD_FONT}`;
    context.fillText(text.winRate, 68, y + 30);
    context.fillStyle = record.winRate >= 50 ? COLOR.buff : COLOR.nerf;
    context.font = `900 38px ${CARD_FONT}`;
    const rateText = `${record.winRate.toFixed(1)}%`;
    context.fillText(rateText, 68, y + 70);
    if (delta !== undefined && delta !== 0) {
      const rateWidth = context.measureText(rateText).width;
      context.fillStyle = delta > 0 ? COLOR.buff : COLOR.nerf;
      context.font = `800 21px ${CARD_FONT}`;
      context.fillText(`${delta > 0 ? "▲" : "▼"}${Math.abs(delta).toFixed(1)}%p`, 68 + rateWidth + 10, y + 70);
    }
    /* 승/패 게이지 — 승 파랑, 패 빨강. */
    const losses = Math.max(0, record.games - record.wins);
    const gaugeWidth = 250;
    const winWidth = record.games > 0 ? (record.wins / record.games) * gaugeWidth : 0;
    drawRoundedRect(context, 68, y + 82, gaugeWidth, 10, 5);
    context.fillStyle = "rgba(255, 255, 255, .08)";
    context.fill();
    context.save();
    drawRoundedRect(context, 68, y + 82, gaugeWidth, 10, 5);
    context.clip();
    context.fillStyle = COLOR.buff;
    context.fillRect(68, y + 82, winWidth, 10);
    context.fillStyle = COLOR.nerf;
    context.fillRect(68 + winWidth, y + 82, gaugeWidth - winWidth, 10);
    context.restore();
    context.fillStyle = COLOR.dim;
    context.font = `700 19px ${CARD_FONT}`;
    context.fillText(`${record.games}${text.games} · ${record.wins}W ${losses}L`, 332, y + 90);

    /* 최다 사용 챔피언 — 계약이 아직 없는 배포에서는 이 칸이 비고, 왼쪽 수치만 남습니다. */
    if (tops.length > 0) {
      context.fillStyle = COLOR.dim;
      context.font = `700 19px ${CARD_FONT}`;
      context.fillText(text.topChampions, 560, y + 30);
      tops.forEach((champion, index) => {
        const x = 560 + (index * 152);
        const icon = champion.iconUrl ? images.get(champion.iconUrl) : undefined;
        if (icon) drawRoundedImage(context, icon, x, y + 44, 40, 10);
        else {
          drawRoundedRect(context, x, y + 44, 40, 40, 10);
          context.fillStyle = "#26334a";
          context.fill();
        }
        const rate = champion.games > 0 ? Math.round((champion.wins / champion.games) * 100) : 0;
        context.fillStyle = COLOR.text;
        context.font = `850 21px ${CARD_FONT}`;
        fillTextEllipsis(context, champion.name ?? `#${champion.championId}`, x + 50, y + 60, 92);
        context.fillStyle = rate >= 50 ? COLOR.buff : COLOR.nerf;
        context.font = `800 19px ${CARD_FONT}`;
        context.fillText(`${champion.games}${text.games} · ${rate}%`, x + 50, y + 82);
      });
    }
    y += mineHeight;
  }

  const footerY = height - FOOTER_HEIGHT;
  context.fillStyle = COLOR.line;
  context.fillRect(48, footerY, CARD_WIDTH - 96, 2);
  context.fillStyle = COLOR.text;
  context.font = `900 26px ${CARD_FONT}`;
  context.fillText("YORO", 48, footerY + 46);
  const brandWidth = context.measureText("YORO").width;
  context.fillStyle = COLOR.brand;
  context.fillText(".gg", 48 + brandWidth, footerY + 46);
  /* 출처·범위는 항상 답니다 — 이 카드는 Riot 본문 요약이 아닙니다. */
  context.textAlign = "right";
  context.fillStyle = COLOR.dim;
  context.font = `650 19px ${CARD_FONT}`;
  fillTextEllipsis(context, text.source, CARD_WIDTH - 48, footerY + 46, CARD_WIDTH - 320);
  context.textAlign = "start";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("patch_share_blob_unavailable"));
    }, "image/png", .92);
  });
}

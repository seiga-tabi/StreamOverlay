import { useEffect, useRef, useState } from "react";
import { Button } from "../../../shared/ui/Button";

export type RecentMatchShareItem = {
  key: string;
  result: "win" | "loss" | "unknown";
  resultLabel: string;
  championName: string;
  championIconUrl?: string;
  queueLabel: string;
  kda: string;
  kdaMetric: string;
  grade: string;
  score: number;
  highlight?: "mvp" | "ace";
  /** 7슬롯 고정(장비 6 + 장신구 1) — 빈 슬롯은 undefined로 유지합니다. */
  itemIconUrls: Array<string | undefined>;
  durationLabel: string;
  startedAtLabel: string;
};

export type RecentMatchesShareText = {
  title: string;
  description: string;
  download: string;
  share: string;
  preparing: string;
  saved: string;
  shared: string;
  failed: string;
  recentMatches: string;
  games: string;
  generatedBy: string;
  wins: string;
  losses: string;
  winRate: string;
  /** 경기 목록 섹션 제목(기존 t().matchRecordTab). 없으면 recentMatches 로 대체. */
  recordTitle?: string;
};

export type RecentMatchesShareActionsProps = {
  riotId: string;
  matches: RecentMatchShareItem[];
  profileImageUrl?: string;
  masteryChampionArtUrl?: string;
  text: RecentMatchesShareText;
};

type ShareStatus = "idle" | "preparing" | "saved" | "shared" | "failed";

const SHARE_CARD_WIDTH = 1080;
/* 필터 결과 상위 10경기 고정 — "필터에 따른 10게임을 항상 보여주도록" 요청 반영. */
const SHARE_CARD_MAX_MATCHES = 10;
/* 목업 LolShareCard — 좌우 여백 64, 행 90px(최종 B안: 단일 컬럼, 아이템 원형 6개). */
const SHARE_CARD_MARGIN = 64;
const SHARE_CARD_ROW_HEIGHT = 90;
const SHARE_CARD_BODY_FONT = 'Pretendard, "Noto Sans KR", "Noto Sans JP", sans-serif';
const SHARE_CARD_SERIF_FONT = '"Noto Serif KR", "Noto Serif JP", serif';
const SHARE_CARD_BRUSH_FONT = '"Yuji Boku", "Yuji Syuku", serif';

/* 공유 이미지는 뷰어 테마를 따르지 않고 만들 때의 테마로 굳습니다(목업). */
type ShareCardTheme = {
  bg: string; card: string; blob1: string; blob2: string; line: string;
  ink: string; sub: string; mid: string; win: string; loss: string;
  row: {
    win: string; loss: string; mvp: string; ace: string;
    mvpLine: string; aceLine: string;
  };
};

const SHARE_CARD_THEMES: Record<"dark" | "light", ShareCardTheme> = {
  dark: {
    bg: "#1c1d22", card: "#252730", blob1: "#23252e", blob2: "#2b2f3a",
    line: "#3a404b", ink: "#f5f6f8", sub: "#b9c3d0", mid: "#7c8b9c",
    win: "#63c375", loss: "#e97180",
    row: {
      win: "#1B1E39", loss: "#301C22", mvp: "#2F2C29", ace: "#222C29",
      mvpLine: "rgba(216,179,106,0.50)", aceLine: "rgba(99,195,117,0.45)",
    },
  },
  light: {
    bg: "#f5f6f8", card: "#ffffff", blob1: "#edf0f4", blob2: "#e2e7ed",
    line: "#e4e8ed", ink: "#1c1d22", sub: "#5a6675", mid: "#7c8b9c",
    win: "#1d8139", loss: "#c0394a",
    row: {
      win: "#E9F3FB", loss: "#F8EEF1", mvp: "#EFEADF", ace: "#E4EDE9",
      mvpLine: "rgba(176,134,48,0.55)", aceLine: "rgba(29,129,57,0.45)",
    },
  },
};

function shareCardActiveTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

/* 붓 자국 밑줄(홈 히어로와 같은 도형) — viewBox 300×10 을 이름 폭으로 스케일. */
function drawBrushUnderline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  const path = new Path2D("M3 6.2 C 78 2, 168 9.4, 296 4.6 C 200 7.6, 96 7, 3 8.6 Z");
  context.save();
  context.translate(x, y);
  context.scale(width / 300, 1);
  context.fillStyle = color;
  context.fill(path);
  context.restore();
}

/* 노리개 섹션 표시(홈 문법) — 16×30, stroke 1.4. */
function drawNorigaeMark(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.lineWidth = 1.4;
  context.beginPath();
  context.arc(8, 6, 4.2, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(8, 10.4);
  context.lineTo(8, 21);
  context.stroke();
  context.beginPath();
  context.moveTo(4.6, 21);
  context.lineTo(11.4, 21);
  context.lineTo(8, 28);
  context.closePath();
  context.stroke();
  context.restore();
}

/* 먹 얼룩(불규칙 타원) — 홈 히어로의 두 겹. */
function drawInkBlob(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  color: string,
): void {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, rotation, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

/* 캔버스는 웹폰트 로드를 기다리지 않으므로 명시적으로 기다립니다.
   실패해도 그리기는 계속하되(타임아웃), Inter 로 되돌아가지 않게 폰트 스택에
   Pretendard/Noto 만 둡니다. */
async function waitForShareFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`46px ${SHARE_CARD_BRUSH_FONT}`, "YORO"),
        document.fonts.load(`700 54px ${SHARE_CARD_SERIF_FONT}`, "가"),
        document.fonts.load(`800 21px ${SHARE_CARD_BODY_FONT}`, "가"),
        document.fonts.load(`700 21px ${SHARE_CARD_BODY_FONT}`, "가Hg0"),
        document.fonts.load(`500 15px ${SHARE_CARD_BODY_FONT}`, "가Hg0"),
        document.fonts.load(`500 14px ${SHARE_CARD_BODY_FONT}`, "가Hg0"),
        document.fonts.ready,
      ]),
      new Promise((resolve) => window.setTimeout(resolve, 2_500)),
    ]);
  } catch {
    /* 폰트가 없으면 fallback 스택으로 그립니다. */
  }
}


function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: "center" | "top" = "center",
): void {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = anchor === "top" ? 0 : (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawCircularImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.clip();
  context.drawImage(image, centerX - radius, centerY - radius, radius * 2, radius * 2);
  context.restore();
}

/* 행 배경의 둥근 테두리 — 프로필 공유 카드(ProfileShareActions)의 동명 헬퍼와
   같은 알고리즘이지만 이 파일은 독립 모듈이라 별도로 둡니다. */
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

const LEADING_PROBE = "Hg";
const INK_PROBE = "한H0";
const LINE_INK_GAP = 3.5;
type ShareTextMetrics = { ascent: number; descent: number };
const shareTextMetricCache = new Map<string, ShareTextMetrics>();

function probeShareTextMetrics(
  context: CanvasRenderingContext2D,
  font: string,
  probe: string,
): ShareTextMetrics {
  const key = `${font}\u0000${probe}`;
  const cached = shareTextMetricCache.get(key);
  if (cached) return cached;

  const previousFont = context.font;
  context.font = font;
  const metrics = context.measureText(probe);
  context.font = previousFont;
  const measured = {
    ascent: metrics.actualBoundingBoxAscent,
    descent: metrics.actualBoundingBoxDescent,
  };
  shareTextMetricCache.set(key, measured);
  return measured;
}

function twoLineBaselines(
  context: CanvasRenderingContext2D,
  centerY: number,
  topFonts: string[],
  bottomFonts: string[],
): { top: number; bottom: number } {
  const maxMetric = (fonts: string[], probe: string, key: keyof ShareTextMetrics) => (
    fonts.reduce(
      (maximum, font) => Math.max(maximum, probeShareTextMetrics(context, font, probe)[key]),
      0,
    )
  );
  const topInkAscent = maxMetric(topFonts, INK_PROBE, "ascent");
  const topLeadDescent = maxMetric(topFonts, LEADING_PROBE, "descent");
  const bottomInkAscent = maxMetric(bottomFonts, INK_PROBE, "ascent");
  const bottomInkDescent = maxMetric(bottomFonts, INK_PROBE, "descent");
  const lineGap = topLeadDescent + LINE_INK_GAP + bottomInkAscent;
  const blockHeight = topInkAscent + lineGap + bottomInkDescent;
  const topBaseline = centerY - blockHeight / 2 + topInkAscent;

  return {
    top: Math.round(topBaseline),
    bottom: Math.round(topBaseline + lineGap),
  };
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

async function loadShareImages(
  matches: RecentMatchShareItem[],
  additionalUrls: Array<string | undefined>,
): Promise<Map<string, HTMLImageElement>> {
  const urls = Array.from(new Set([
    ...matches.map((match) => match.championIconUrl),
    ...matches.flatMap((match) => match.itemIconUrls),
    ...additionalUrls,
  ].filter((url): url is string => Boolean(url))));
  const loaded = await Promise.all(urls.map(async (url) => [url, await loadCanvasImage(url)] as const));
  return new Map(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => Boolean(entry[1])));
}

function shareCardFileName(riotId: string): string {
  const safeId = riotId.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `yoro-${safeId || "lol"}-recent-matches.png`;
}

export async function createRecentMatchesShareBlob(
  riotId: string,
  sourceMatches: RecentMatchShareItem[],
  text: RecentMatchesShareText,
  options: {
    profileImageUrl?: string;
    masteryChampionArtUrl?: string;
  } = {},
): Promise<Blob> {
  /* v3 리디자인 — 경기 기록을 좌우 2열이 아니라 위→아래 한 줄씩(단일 컬럼)으로
     바꾸고(요청 반영), SNS 만족도 분석(피드 크롭 안전 비율 + 스캔 밀도) 결과에
     따라 행 높이를 압축(1080×1220 2열 → 1080×1427 1열)해 인스타그램 권장
     4:5 비율에 근접시켰습니다. 승인 문서: docs/mockups/recent-matches-share-redesign-v1.html(v3). */
  const matches = sourceMatches.slice(0, SHARE_CARD_MAX_MATCHES);
  if (matches.length === 0) throw new Error("share_matches_empty");

  const theme = SHARE_CARD_THEMES[shareCardActiveTheme()];
  const width = SHARE_CARD_WIDTH;
  const margin = SHARE_CARD_MARGIN;
  const contentWidth = width - margin * 2;
  const rowCount = matches.length;
  const rowHeight = SHARE_CARD_ROW_HEIGHT;

  /* 구역 좌표 — 좌우 64 여백, 구역 간격 56/48/52(목업). */
  const headTop = 64;
  const labelTop = headTop + 46 + 46;
  const nameTop = labelTop + 20 + 14;
  const headBottom = nameTop + 54 + 14 + 10;
  const summaryTop = headBottom + 56;
  const summaryHeight = 1 + 30 + 36 + 8 + 19 + 30 + 1;
  const sectionTop = summaryTop + summaryHeight + 48;
  const rowsTop = sectionTop + 30 + 22;
  const rowsBottom = rowsTop + rowCount * rowHeight;
  const footerTop = rowsBottom + 52;
  const height = footerTop + 1 + 28 + 21 + 56;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("share_canvas_unavailable");

  await waitForShareFonts();
  const imageMap = await loadShareImages(matches, [options.masteryChampionArtUrl]);

  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  /* 바탕 — 그라데이션 없는 먹/백자 단색(수묵 문법). */
  context.fillStyle = theme.bg;
  context.fillRect(0, 0, width, height);

  /* 히어로 — 챔피언 아트를 헤더 전체 폭 배경으로 채우고, 텍스트(좌측)가 있는
     영역만 블러(14px)+반투명 어둠으로 덮어 가독성을 지킵니다(v3, 패치노트
     공유 카드와 동일 문법). 이미지가 없으면 먹 얼룩 폴백을 그대로 유지합니다. */
  const headerHeight = headBottom + 60;
  const masteryChampionArt = options.masteryChampionArtUrl
    ? imageMap.get(options.masteryChampionArtUrl)
    : undefined;
  context.save();
  context.beginPath();
  context.rect(0, 0, width, headerHeight);
  context.clip();
  if (masteryChampionArt) {
    drawCoverImage(context, masteryChampionArt, 0, 0, width, headerHeight, "top");
  } else {
    drawInkBlob(context, width - 250, 210, 310, 250, -0.12, theme.blob1);
    drawInkBlob(context, width - 240, 246, 200, 150, 0.18, theme.blob2);
  }
  context.restore();

  if (masteryChampionArt) {
    /* 블러 → 선명 전환 구간(220px)을 두어 경계가 뚝 끊기지 않고 자연스럽게
       "흐려짐 → 점점 선명해짐"으로 이어지도록 합니다(목업: recent-matches-share-hero-blur-edge-v1.html).
       하드 클립 대신 블러 레이어 자체를 destination-in 그라디언트 마스크로
       알파 1→0 전환시켜 합성합니다. */
    const textZoneWidth = Math.min(560, width * 0.52);
    const transitionWidth = 220;
    const maskEnd = textZoneWidth + transitionWidth;

    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = width;
    blurCanvas.height = headerHeight;
    const blurContext = blurCanvas.getContext("2d");
    if (blurContext) {
      blurContext.filter = "blur(14px)";
      drawCoverImage(blurContext, masteryChampionArt, -20, -20, width + 40, headerHeight + 40, "top");

      blurContext.globalCompositeOperation = "destination-in";
      const mask = blurContext.createLinearGradient(0, 0, maskEnd, 0);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(textZoneWidth / maskEnd, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      blurContext.fillStyle = mask;
      blurContext.fillRect(0, 0, width, headerHeight);
      blurContext.globalCompositeOperation = "source-over";

      context.drawImage(blurCanvas, 0, 0);

      const shade = context.createLinearGradient(0, 0, maskEnd, 0);
      shade.addColorStop(0, `${theme.bg}d1`);
      shade.addColorStop((textZoneWidth / maskEnd) * 0.85, `${theme.bg}a8`);
      shade.addColorStop(1, `${theme.bg}00`);
      context.fillStyle = shade;
      context.fillRect(0, 0, maskEnd, headerHeight);
    }
    const bottomShade = context.createLinearGradient(0, headerHeight - 60, 0, headerHeight);
    bottomShade.addColorStop(0, `${theme.bg}00`);
    bottomShade.addColorStop(1, theme.bg);
    context.fillStyle = bottomShade;
    context.fillRect(0, headerHeight - 60, width, 60);
  } else {
    const heroShade = context.createLinearGradient(0, 0, width, 0);
    heroShade.addColorStop(0, theme.bg);
    heroShade.addColorStop(.46, theme.bg);
    heroShade.addColorStop(.62, `${theme.bg}db`);
    heroShade.addColorStop(.92, `${theme.bg}26`);
    heroShade.addColorStop(1, `${theme.bg}00`);
    context.fillStyle = heroShade;
    context.fillRect(0, 0, width, headerHeight);
  }

  /* 붓 워드마크 — YORO(Yuji Boku 46px) + .GG(무채 22/800). 보라·파랑 없음. */
  context.textAlign = "start";
  context.shadowColor = masteryChampionArt ? "rgba(0,0,0,0.5)" : "transparent";
  context.shadowBlur = masteryChampionArt ? 8 : 0;
  context.fillStyle = theme.ink;
  context.font = `46px ${SHARE_CARD_BRUSH_FONT}`;
  context.fillText("YORO", margin, headTop + 42);
  const wordmarkWidth = context.measureText("YORO").width;
  context.fillStyle = theme.mid;
  context.font = `800 22px ${SHARE_CARD_BODY_FONT}`;
  context.fillText(".GG", margin + wordmarkWidth + 10, headTop + 42);

  /* 머리말 — 파랑 대신 --mid 무채. */
  context.fillStyle = theme.mid;
  context.font = `500 20px ${SHARE_CARD_BODY_FONT}`;
  context.fillText(text.recentMatches, margin, labelTop + 18);

  /* 명조 제목(Riot ID) + 붓 자국 밑줄 — 홈 히어로 문법. */
  const hashIndex = riotId.lastIndexOf("#");
  const riotName = hashIndex > 0 ? riotId.slice(0, hashIndex) : riotId;
  const riotTag = hashIndex > 0 ? riotId.slice(hashIndex) : "";
  context.fillStyle = theme.ink;
  context.font = `700 54px ${SHARE_CARD_SERIF_FONT}`;
  const nameWidth = Math.min(context.measureText(riotName).width, contentWidth - 460);
  context.fillText(riotName, margin, nameTop + 48, contentWidth - 460);
  if (riotTag) {
    context.fillStyle = theme.mid;
    context.font = `700 28px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(riotTag, margin + nameWidth + 12, nameTop + 48, 150);
  }
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  drawBrushUnderline(context, margin, nameTop + 54 + 8, Math.max(nameWidth, 160), "#4a5563");

  /* 요약 — 위아래 헤어라인 사이 padding 30(목업). 평균 KDA 는 공유 데이터에
     없어 3칸만 그립니다(없는 값을 만들지 않음). */
  context.fillStyle = theme.line;
  context.fillRect(margin, summaryTop, contentWidth, 1);
  context.fillRect(margin, summaryTop + summaryHeight - 1, contentWidth, 1);
  const summaryValueY = summaryTop + 1 + 30 + 30;
  const summaryLabelY = summaryValueY + 8 + 17;
  const summaryColumn = contentWidth / 3;
  const drawSummaryCell = (
    index: number,
    label: string,
    parts: Array<{ text: string; color: string; small?: boolean }>,
  ) => {
    let x = margin + summaryColumn * index;
    for (const part of parts) {
      context.fillStyle = part.color;
      context.font = part.small
        ? `700 22px ${SHARE_CARD_BODY_FONT}`
        : `900 36px ${SHARE_CARD_BODY_FONT}`;
      context.fillText(part.text, x, summaryValueY);
      x += context.measureText(part.text).width + (part.small ? 6 : 0);
    }
    context.fillStyle = theme.mid;
    context.font = `500 19px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(label, margin + summaryColumn * index, summaryLabelY);
  };
  drawSummaryCell(0, text.recentMatches, [
    { text: `${matches.length}`, color: theme.ink },
    { text: text.games, color: theme.mid, small: true },
  ]);
  drawSummaryCell(1, `${text.wins} · ${text.losses}`, [
    { text: `${wins}`, color: theme.win },
    { text: `${text.wins} `, color: theme.mid, small: true },
    { text: `${losses}`, color: theme.loss },
    { text: text.losses, color: theme.mid, small: true },
  ]);
  drawSummaryCell(2, text.winRate, [
    { text: `${winRate}`, color: theme.ink },
    { text: "%", color: theme.mid, small: true },
  ]);

  /* 경기 기록 — 노리개 섹션 표시(홈 문법) + 단일 컬럼(v3). */
  drawNorigaeMark(context, margin, sectionTop, theme.mid);
  context.fillStyle = theme.ink;
  context.font = `800 25px ${SHARE_CARD_BODY_FONT}`;
  context.fillText(text.recordTitle ?? text.recentMatches, margin + 28, sectionTop + 24);

  /* 확정 B안 트랙: 승패 30 · 아바타 36 · 이름 210 · KDA 1fr ·
     아이템 원형 6개 · 등급 52. KDA 트랙이 남는 폭을 흡수합니다. */
  const trackGap = 16;
  const resultWidth = 30;
  const avatarRadius = 18;
  const itemCircleRadius = 17;
  const itemCircleGap = 8;
  const nameTrackWidth = 210;
  const gradeWidth = 52;
  const gradeBadgeRadius = 23;
  const gradeFont = 22;
  const itemsBlockWidth = itemCircleRadius * 2 * 6 + itemCircleGap * 5;
  const kdaTrackWidth = contentWidth
    - resultWidth
    - avatarRadius * 2
    - nameTrackWidth
    - itemsBlockWidth
    - gradeWidth
    - trackGap * 5;
  const twoLineTopFonts = [
    `700 21px ${SHARE_CARD_BODY_FONT}`,
    `800 21px ${SHARE_CARD_BODY_FONT}`,
  ];
  const twoLineBottomFonts = [
    `500 15px ${SHARE_CARD_BODY_FONT}`,
    `500 14px ${SHARE_CARD_BODY_FONT}`,
  ];
  const gradeColorFor = (grade: string): string => {
    const normalized = grade.trim().toUpperCase();
    if (normalized.startsWith("S")) return "#d8b36a";
    if (normalized.startsWith("A")) return theme.win;
    return theme.mid;
  };

  matches.forEach((match, index) => {
    const x = margin;
    const y = rowsTop + index * rowHeight;
    const rowCenterY = y + rowHeight / 2;
    const twoLine = twoLineBaselines(context, rowCenterY, twoLineTopFonts, twoLineBottomFonts);

    /* 모든 행에 결과 tint를 적용하되 MVP/ACE는 전용 강조색과 테두리만 배타 적용합니다. */
    const rowBackground: { fill: string; stroke?: string } | undefined = match.highlight === "mvp"
      ? { fill: theme.row.mvp, stroke: theme.row.mvpLine }
      : match.highlight === "ace"
        ? { fill: theme.row.ace, stroke: theme.row.aceLine }
        : match.result === "win"
          ? { fill: theme.row.win }
          : match.result === "loss"
            ? { fill: theme.row.loss }
            : undefined;
    if (rowBackground) {
      drawRoundedRect(context, x - 18, y + 4, contentWidth + 36, rowHeight - 8, 10);
      context.fillStyle = rowBackground.fill;
      context.fill();
      if (rowBackground.stroke) {
        context.strokeStyle = rowBackground.stroke;
        context.lineWidth = 1.4;
        context.stroke();
      }
    }

    /* 승/패 글자 — 전용색 두 가지에만. */
    const resultColor = match.result === "win" ? theme.win : match.result === "loss" ? theme.loss : theme.mid;
    context.fillStyle = resultColor;
    context.font = `800 22px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(match.resultLabel.slice(0, 1) || "—", x, rowCenterY + 8);

    /* 아바타 원형 — MVP/ACE 는 강조 테두리 + 원형 배지. */
    const avatarX = x + resultWidth + trackGap;
    const avatarCenterX = avatarX + avatarRadius;
    const championImage = match.championIconUrl ? imageMap.get(match.championIconUrl) : undefined;
    if (championImage) {
      drawCircularImage(context, championImage, avatarCenterX, rowCenterY, avatarRadius);
    } else {
      context.beginPath();
      context.arc(avatarCenterX, rowCenterY, avatarRadius, 0, Math.PI * 2);
      context.fillStyle = theme.card;
      context.fill();
      context.fillStyle = theme.mid;
      context.textAlign = "center";
      context.font = `800 15px ${SHARE_CARD_BODY_FONT}`;
      context.fillText(match.championName.slice(0, 1), avatarCenterX, rowCenterY + 5);
      context.textAlign = "start";
    }
    context.beginPath();
    context.arc(avatarCenterX, rowCenterY, avatarRadius, 0, Math.PI * 2);
    context.strokeStyle = match.highlight === "mvp" ? "#d8b36a" : match.highlight === "ace" ? theme.win : theme.line;
    context.lineWidth = match.highlight ? 2.5 : 1;
    context.stroke();
    if (match.highlight) {
      const badgeX = avatarCenterX + 12;
      const badgeY = rowCenterY + 12;
      context.beginPath();
      context.arc(badgeX, badgeY, 8, 0, Math.PI * 2);
      context.fillStyle = match.highlight === "mvp" ? "#d8b36a" : theme.win;
      context.fill();
      context.fillStyle = theme.bg;
      context.font = `800 9px ${SHARE_CARD_BODY_FONT}`;
      context.textAlign = "center";
      context.fillText(match.highlight === "mvp" ? "M" : "A", badgeX, badgeY + 3);
      context.textAlign = "start";
    }

    /* 이름(21/700) · 큐·시간(15 --mid). */
    const nameX = avatarX + avatarRadius * 2 + trackGap;
    context.fillStyle = theme.ink;
    context.font = `700 21px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(match.championName, nameX, twoLine.top, nameTrackWidth);
    context.fillStyle = theme.mid;
    context.font = `500 15px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(`${match.queueLabel} · ${match.durationLabel}`, nameX, twoLine.bottom, nameTrackWidth);

    /* KDA — 이름 오른쪽의 가변 트랙에서 중앙 정렬(데스만 패색). */
    const kdaX = nameX + nameTrackWidth + trackGap;
    const kdaCenterX = kdaX + kdaTrackWidth / 2;
    const kdaParts = match.kda.split("/").map((part) => part.trim());
    context.font = `800 21px ${SHARE_CARD_BODY_FONT}`;
    if (kdaParts.length === 3) {
      const segments: Array<{ text: string; color: string }> = [
        { text: kdaParts[0]!, color: theme.ink },
        { text: "/", color: theme.mid },
        { text: kdaParts[1]!, color: theme.loss },
        { text: "/", color: theme.mid },
        { text: kdaParts[2]!, color: theme.ink },
      ];
      let totalWidth = 0;
      for (const segment of segments) totalWidth += context.measureText(segment.text).width;
      let drawX = kdaCenterX - totalWidth / 2;
      for (const segment of segments) {
        context.fillStyle = segment.color;
        context.fillText(segment.text, drawX, twoLine.top);
        drawX += context.measureText(segment.text).width;
      }
    } else {
      context.fillStyle = theme.ink;
      context.textAlign = "center";
      context.fillText(match.kda, kdaCenterX, twoLine.top, kdaTrackWidth);
      context.textAlign = "start";
    }
    const gradeText = match.kdaMetric.split(" ")[0] ?? match.kdaMetric;
    context.fillStyle = theme.sub;
    context.font = `500 14px ${SHARE_CARD_BODY_FONT}`;
    context.textAlign = "center";
    context.fillText(gradeText, kdaCenterX, twoLine.bottom, kdaTrackWidth);
    context.textAlign = "start";

    /* 아이템 6개 — KDA 오른쪽에서 등급 배지와 같은 원형 문법으로 렌더링합니다. */
    const itemsX = kdaX + kdaTrackWidth + trackGap;
    const equipmentSlots = match.itemIconUrls.slice(0, 6);
    equipmentSlots.forEach((iconUrl, slotIndex) => {
      const circleCenterX = itemsX
        + itemCircleRadius
        + slotIndex * (itemCircleRadius * 2 + itemCircleGap);
      const itemImage = iconUrl ? imageMap.get(iconUrl) : undefined;
      if (itemImage) {
        context.save();
        context.beginPath();
        context.arc(circleCenterX, rowCenterY, itemCircleRadius, 0, Math.PI * 2);
        context.clip();
        context.drawImage(
          itemImage,
          circleCenterX - itemCircleRadius,
          rowCenterY - itemCircleRadius,
          itemCircleRadius * 2,
          itemCircleRadius * 2,
        );
        context.restore();
      } else {
        context.beginPath();
        context.arc(circleCenterX, rowCenterY, itemCircleRadius, 0, Math.PI * 2);
        context.fillStyle = theme.card;
        context.fill();
      }
      context.beginPath();
      context.arc(circleCenterX, rowCenterY, itemCircleRadius, 0, Math.PI * 2);
      context.strokeStyle = theme.line;
      context.lineWidth = 1.2;
      context.stroke();
    });

    /* 등급 배지 — 맨 오른쪽 원형(S=골드, A=초록, 그 외 무채). */
    const gradeColor = gradeColorFor(match.grade);
    const gradeCx = x + contentWidth - gradeWidth / 2;
    context.beginPath();
    context.arc(gradeCx, rowCenterY, gradeBadgeRadius, 0, Math.PI * 2);
    context.strokeStyle = gradeColor;
    context.lineWidth = 1.6;
    context.stroke();
    context.fillStyle = gradeColor;
    context.font = `800 ${gradeFont}px ${SHARE_CARD_BODY_FONT}`;
    context.textAlign = "center";
    context.fillText(match.grade, gradeCx, rowCenterY + gradeFont * 0.34);
    context.textAlign = "start";
  });

  /* 꼬리 — 헤어라인 + 좌 안내 / 우 날짜. */
  context.fillStyle = theme.line;
  context.fillRect(margin, footerTop, contentWidth, 1);
  context.fillStyle = theme.sub;
  context.font = `500 21px ${SHARE_CARD_BODY_FONT}`;
  context.fillText(text.generatedBy, margin, footerTop + 1 + 28 + 16, contentWidth - 220);
  context.fillStyle = theme.mid;
  context.textAlign = "right";
  context.fillText(new Date().toISOString().slice(0, 10), width - margin, footerTop + 1 + 28 + 16);
  context.textAlign = "start";

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("share_blob_unavailable"));
    }, "image/png", .92);
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = fileName;
  anchor.href = url;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function RecentMatchesShareActions({
  riotId,
  matches,
  profileImageUrl,
  masteryChampionArtUrl,
  text,
}: RecentMatchesShareActionsProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateStatus = (next: ShareStatus) => {
    if (mountedRef.current) setStatus(next);
  };

  const makeBlob = async () => {
    updateStatus("preparing");
    return createRecentMatchesShareBlob(riotId, matches, text, { profileImageUrl, masteryChampionArtUrl });
  };

  const onDownload = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const blob = await makeBlob();
      downloadBlob(blob, shareCardFileName(riotId));
      updateStatus("saved");
    } catch {
      updateStatus("failed");
    } finally {
      inFlightRef.current = false;
    }
  };

  const onShare = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const blob = await makeBlob();
      const file = new File([blob], shareCardFileName(riotId), { type: "image/png" });
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        updateStatus("shared");
        return;
      }
      downloadBlob(blob, file.name);
      updateStatus("saved");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        updateStatus("idle");
        return;
      }
      updateStatus("failed");
    } finally {
      inFlightRef.current = false;
    }
  };

  const statusText = status === "preparing"
    ? text.preparing
    : status === "saved"
      ? text.saved
      : status === "shared"
        ? text.shared
        : status === "failed"
          ? text.failed
          : "";
  const busy = status === "preparing";

  return (
    <section className="public-match-share-actions" aria-labelledby="public-match-share-title">
      <div>
        <strong id="public-match-share-title">{text.title}</strong>
        <span>{text.description}</span>
      </div>
      <div className="public-match-share-buttons">
        {/* 텍스트 글리프(↓↗)는 글꼴에 따라 크기·정렬이 흔들려 SVG 로 그립니다(목업 §2-6). */}
        <Button disabled={busy || matches.length === 0} loading={busy} onClick={() => void onDownload()} size="sm" type="button" variant="secondary">
          <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="13">
            <path d="M8 2 L 8 11 M4.5 7.5 L 8 11 L 11.5 7.5" />
            <path d="M2.5 13.5 L 13.5 13.5" />
          </svg>
          {text.download}
        </Button>
        <Button disabled={busy || matches.length === 0} onClick={() => void onShare()} size="sm" type="button">
          <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="13">
            <path d="M8 11 L 8 2 M4.5 5.5 L 8 2 L 11.5 5.5" />
            <path d="M2.5 13.5 L 13.5 13.5" />
          </svg>
          {text.share}
        </Button>
      </div>
      <span className="public-match-share-status" role={status === "failed" ? "alert" : "status"} aria-live="polite">
        {statusText}
      </span>
    </section>
  );
}

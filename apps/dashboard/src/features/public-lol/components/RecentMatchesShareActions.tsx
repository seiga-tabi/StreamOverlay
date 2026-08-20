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
  itemIconUrls: string[];
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
const SHARE_CARD_MAX_MATCHES = 20;
/* 목업 LolShareCard — 좌우 여백 64, 행 74px, 2열 간격 44. */
const SHARE_CARD_MARGIN = 64;
const SHARE_CARD_ROW_HEIGHT = 74;
const SHARE_CARD_COLUMN_GAP = 44;
const SHARE_CARD_BODY_FONT = 'Pretendard, "Noto Sans KR", "Noto Sans JP", sans-serif';
const SHARE_CARD_SERIF_FONT = '"Noto Serif KR", "Noto Serif JP", serif';
const SHARE_CARD_BRUSH_FONT = '"Yuji Boku", "Yuji Syuku", serif';

/* 공유 이미지는 뷰어 테마를 따르지 않고 만들 때의 테마로 굳습니다(목업). */
type ShareCardTheme = {
  bg: string; card: string; blob1: string; blob2: string; line: string;
  ink: string; sub: string; mid: string; win: string; loss: string;
};

const SHARE_CARD_THEMES: Record<"dark" | "light", ShareCardTheme> = {
  dark: {
    bg: "#1c1d22", card: "#252730", blob1: "#23252e", blob2: "#2b2f3a",
    line: "#3a404b", ink: "#f5f6f8", sub: "#b9c3d0", mid: "#7c8b9c",
    win: "#63c375", loss: "#e97180",
  },
  light: {
    bg: "#f5f6f8", card: "#ffffff", blob1: "#edf0f4", blob2: "#e2e7ed",
    line: "#e4e8ed", ink: "#1c1d22", sub: "#5a6675", mid: "#7c8b9c",
    win: "#1d8139", loss: "#c0394a",
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
): void {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
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
  /* 목업 LolShareCard — 20경기 전부(10 × 2열). 요약이 20경기라 말하면
     그림도 20경기를 보여야 합니다. 적으면 있는 만큼만 그리고 높이를 줄입니다. */
  const matches = sourceMatches.slice(0, SHARE_CARD_MAX_MATCHES);
  if (matches.length === 0) throw new Error("share_matches_empty");

  const theme = SHARE_CARD_THEMES[shareCardActiveTheme()];
  const width = SHARE_CARD_WIDTH;
  const margin = SHARE_CARD_MARGIN;
  const contentWidth = width - margin * 2;
  const columnWidth = (contentWidth - SHARE_CARD_COLUMN_GAP) / 2;
  const rowsPerColumn = Math.ceil(matches.length / 2);

  /* 구역 좌표 — 좌우 64 여백, 구역 간격 56/48/52(목업). */
  const headTop = 64;
  const labelTop = headTop + 46 + 46;
  const nameTop = labelTop + 20 + 14;
  const headBottom = nameTop + 54 + 14 + 10;
  const summaryTop = headBottom + 56;
  const summaryHeight = 1 + 30 + 36 + 8 + 19 + 30 + 1;
  const sectionTop = summaryTop + summaryHeight + 48;
  const rowsTop = sectionTop + 30 + 22;
  const rowsBottom = rowsTop + rowsPerColumn * SHARE_CARD_ROW_HEIGHT;
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

  /* 머리 오른쪽 — 먹 얼룩 두 겹 + 챔피언 아트, 왼쪽 46% 는 불투명하게 덮어
     글자를 지킵니다(목업 헤더). */
  const headerHeight = headBottom + 60;
  context.save();
  context.beginPath();
  context.rect(0, 0, width, headerHeight);
  context.clip();
  drawInkBlob(context, width - 250, 210, 310, 250, -0.12, theme.blob1);
  drawInkBlob(context, width - 240, 246, 200, 150, 0.18, theme.blob2);
  const masteryChampionArt = options.masteryChampionArtUrl
    ? imageMap.get(options.masteryChampionArtUrl)
    : undefined;
  if (masteryChampionArt) {
    context.save();
    context.globalAlpha = .8;
    context.beginPath();
    context.ellipse(width - 240, 246, 200, 150, 0.18, 0, Math.PI * 2);
    context.clip();
    drawCoverImage(context, masteryChampionArt, width - 460, 80, 440, 340);
    context.restore();
  }
  const heroShade = context.createLinearGradient(0, 0, width, 0);
  heroShade.addColorStop(0, theme.bg);
  heroShade.addColorStop(.46, theme.bg);
  heroShade.addColorStop(.62, `${theme.bg}db`);
  heroShade.addColorStop(.92, `${theme.bg}26`);
  heroShade.addColorStop(1, `${theme.bg}00`);
  context.fillStyle = heroShade;
  context.fillRect(0, 0, width, headerHeight);
  context.restore();

  /* 붓 워드마크 — YORO(Yuji Boku 46px) + .GG(무채 22/800). 보라·파랑 없음. */
  context.textAlign = "start";
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
  const nameWidth = Math.min(context.measureText(riotName).width, contentWidth - 160);
  context.fillText(riotName, margin, nameTop + 48, contentWidth - 160);
  if (riotTag) {
    context.fillStyle = theme.mid;
    context.font = `700 28px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(riotTag, margin + nameWidth + 12, nameTop + 48, 150);
  }
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

  /* 경기 기록 — 노리개 섹션 표시(홈 문법) + 10 × 2열. */
  drawNorigaeMark(context, margin, sectionTop, theme.mid);
  context.fillStyle = theme.ink;
  context.font = `800 25px ${SHARE_CARD_BODY_FONT}`;
  context.fillText(text.recordTitle ?? text.recentMatches, margin + 28, sectionTop + 24);

  /* 행 트랙(두 열 공통): 승패 30 · 아바타 44 · 이름 1fr · KDA 104(우) · 평점 56(우), gap 14. */
  const trackGap = 14;
  const kdaWidth = 104;
  const gradeWidth = 56;
  const nameTrackWidth = columnWidth - 30 - 44 - kdaWidth - gradeWidth - trackGap * 4;

  matches.forEach((match, index) => {
    const column = Math.floor(index / rowsPerColumn);
    const rowIndex = index % rowsPerColumn;
    const x = margin + column * (columnWidth + SHARE_CARD_COLUMN_GAP);
    const y = rowsTop + rowIndex * SHARE_CARD_ROW_HEIGHT;
    const centerY = y + SHARE_CARD_ROW_HEIGHT / 2;
    const isLastRow = rowIndex === rowsPerColumn - 1;

    /* 아래 1px 헤어라인(열 마지막 행은 선 없음). 둥근 카드·색 레일 없음. */
    if (!isLastRow) {
      context.fillStyle = theme.line;
      context.fillRect(x, y + SHARE_CARD_ROW_HEIGHT - 1, columnWidth, 1);
    }

    /* 승/패 글자 — 전용색 두 가지에만. */
    const resultColor = match.result === "win" ? theme.win : match.result === "loss" ? theme.loss : theme.mid;
    context.fillStyle = resultColor;
    context.font = `800 22px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(match.resultLabel.slice(0, 1) || "—", x, centerY + 8);

    /* 아바타 44 원형. */
    const avatarX = x + 30 + trackGap;
    const avatarCenterX = avatarX + 22;
    const championImage = match.championIconUrl ? imageMap.get(match.championIconUrl) : undefined;
    if (championImage) {
      drawCircularImage(context, championImage, avatarCenterX, centerY, 22);
    } else {
      context.beginPath();
      context.arc(avatarCenterX, centerY, 22, 0, Math.PI * 2);
      context.fillStyle = theme.card;
      context.fill();
      context.fillStyle = theme.mid;
      context.textAlign = "center";
      context.font = `800 17px ${SHARE_CARD_BODY_FONT}`;
      context.fillText(match.championName.slice(0, 1), avatarCenterX, centerY + 6);
      context.textAlign = "start";
    }
    context.beginPath();
    context.arc(avatarCenterX, centerY, 22, 0, Math.PI * 2);
    context.strokeStyle = theme.line;
    context.lineWidth = 1;
    context.stroke();

    /* 이름(23/700) · 큐·시간(17 --mid). */
    const nameX = avatarX + 44 + trackGap;
    context.fillStyle = theme.ink;
    context.font = `700 23px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(match.championName, nameX, centerY - 4, nameTrackWidth);
    context.fillStyle = theme.mid;
    context.font = `500 17px ${SHARE_CARD_BODY_FONT}`;
    context.fillText(`${match.queueLabel} · ${match.durationLabel}`, nameX, centerY + 20, nameTrackWidth);

    /* KDA 우측 정렬 — 데스 숫자만 패색. */
    const kdaRight = x + columnWidth - gradeWidth - trackGap;
    const kdaParts = match.kda.split("/").map((part) => part.trim());
    context.font = `800 23px ${SHARE_CARD_BODY_FONT}`;
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
      let drawX = kdaRight - totalWidth;
      for (const segment of segments) {
        context.fillStyle = segment.color;
        context.fillText(segment.text, drawX, centerY + 8);
        drawX += context.measureText(segment.text).width;
      }
    } else {
      context.fillStyle = theme.ink;
      context.textAlign = "right";
      context.fillText(match.kda, kdaRight, centerY + 8, kdaWidth);
      context.textAlign = "start";
    }

    /* 평점(kdaMetric 의 수치) 우측 정렬. */
    const gradeText = match.kdaMetric.split(" ")[0] ?? match.kdaMetric;
    context.fillStyle = theme.sub;
    context.font = `500 20px ${SHARE_CARD_BODY_FONT}`;
    context.textAlign = "right";
    context.fillText(gradeText, x + columnWidth, centerY + 7, gradeWidth);
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
        await navigator.share({ title: text.title, text: text.description, files: [file] });
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

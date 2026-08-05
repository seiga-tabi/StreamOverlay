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
};

export type RecentMatchesShareActionsProps = {
  riotId: string;
  matches: RecentMatchShareItem[];
  text: RecentMatchesShareText;
};

type ShareStatus = "idle" | "preparing" | "saved" | "shared" | "failed";

const SHARE_CARD_WIDTH = 1080;
const SHARE_CARD_ROW_HEIGHT = 112;
const SHARE_CARD_MAX_MATCHES = 8;

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

async function loadShareImages(matches: RecentMatchShareItem[]): Promise<Map<string, HTMLImageElement>> {
  const urls = Array.from(new Set(matches.flatMap((match) => [
    match.championIconUrl,
    ...match.itemIconUrls,
  ]).filter((url): url is string => Boolean(url))));
  const loaded = await Promise.all(urls.map(async (url) => [url, await loadCanvasImage(url)] as const));
  return new Map(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => Boolean(entry[1])));
}

function shareCardFileName(riotId: string): string {
  const safeId = riotId.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `yoro-${safeId || "lol"}-recent-matches.png`;
}

async function createRecentMatchesShareBlob(
  riotId: string,
  sourceMatches: RecentMatchShareItem[],
  text: RecentMatchesShareText,
): Promise<Blob> {
  const matches = sourceMatches.slice(0, SHARE_CARD_MAX_MATCHES);
  if (matches.length === 0) throw new Error("share_matches_empty");

  const width = SHARE_CARD_WIDTH;
  const height = 248 + (matches.length * SHARE_CARD_ROW_HEIGHT) + 112;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("share_canvas_unavailable");

  const imageMap = await loadShareImages(matches);
  const wins = matches.filter((match) => match.result === "win").length;
  const losses = matches.filter((match) => match.result === "loss").length;
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#080f1d");
  background.addColorStop(.52, "#10182a");
  background.addColorStop(1, "#080d18");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(width * .78, 0, 0, width * .78, 0, width * .7);
  glow.addColorStop(0, "rgba(123, 92, 255, .34)");
  glow.addColorStop(1, "rgba(123, 92, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#ffffff";
  context.font = "italic 800 38px Inter, Arial, sans-serif";
  context.fillText("YORO.gg", 52, 64);
  context.fillStyle = "#8ea8ff";
  context.font = "700 21px Inter, Arial, sans-serif";
  context.fillText(text.recentMatches.toUpperCase(), 52, 108);
  context.fillStyle = "#f7f8fa";
  context.font = "800 42px Inter, Arial, sans-serif";
  context.fillText(riotId, 52, 158, width - 104);
  context.fillStyle = "#aeb6c4";
  context.font = "600 23px Inter, Arial, sans-serif";
  context.fillText(
    `${matches.length}${text.games} · ${wins}${text.wins} ${losses}${text.losses} · ${text.winRate} ${winRate}%`,
    52,
    204,
  );

  matches.forEach((match, index) => {
    const rowY = 236 + (index * SHARE_CARD_ROW_HEIGHT);
    const rowColor = match.result === "win" ? "#10273a" : match.result === "loss" ? "#301a29" : "#192231";
    const accentColor = match.result === "win" ? "#32b5ff" : match.result === "loss" ? "#ff5775" : "#8a94a6";
    drawRoundedRect(context, 44, rowY, width - 88, SHARE_CARD_ROW_HEIGHT - 10, 18);
    context.fillStyle = rowColor;
    context.fill();
    context.fillStyle = accentColor;
    drawRoundedRect(context, 44, rowY, 8, SHARE_CARD_ROW_HEIGHT - 10, 4);
    context.fill();

    context.fillStyle = accentColor;
    context.font = "800 22px Inter, Arial, sans-serif";
    context.fillText(match.resultLabel, 68, rowY + 43);
    context.fillStyle = "#9ca8ba";
    context.font = "600 16px Inter, Arial, sans-serif";
    context.fillText(`${match.startedAtLabel} · ${match.durationLabel}`, 68, rowY + 72, 150);

    const championX = 224;
    const championY = rowY + 17;
    const championImage = match.championIconUrl ? imageMap.get(match.championIconUrl) : undefined;
    if (championImage) drawRoundedImage(context, championImage, championX, championY, 68, 18);
    else {
      drawRoundedRect(context, championX, championY, 68, 68, 18);
      context.fillStyle = "#26334a";
      context.fill();
      context.fillStyle = "#f7f8fa";
      context.font = "800 28px Inter, Arial, sans-serif";
      context.textAlign = "center";
      context.fillText(match.championName.slice(0, 1), championX + 34, championY + 45);
      context.textAlign = "start";
    }
    context.fillStyle = "#f7f8fa";
    context.font = "800 23px Inter, Arial, sans-serif";
    context.fillText(match.championName, 308, rowY + 39, 142);
    context.fillStyle = "#9ca8ba";
    context.font = "600 16px Inter, Arial, sans-serif";
    context.fillText(match.queueLabel, 308, rowY + 68, 142);

    context.fillStyle = "#f7f8fa";
    context.font = "800 24px Inter, Arial, sans-serif";
    context.fillText(match.kda, 466, rowY + 39);
    context.fillStyle = "#9ca8ba";
    context.font = "600 16px Inter, Arial, sans-serif";
    context.fillText(match.kdaMetric, 466, rowY + 68, 118);

    context.fillStyle = match.score >= 75 ? "#f8bd4b" : match.score >= 55 ? "#8ea8ff" : "#aeb6c4";
    context.font = "900 26px Inter, Arial, sans-serif";
    context.fillText(match.grade, 604, rowY + 39);
    context.fillStyle = "#9ca8ba";
    context.font = "600 16px Inter, Arial, sans-serif";
    context.fillText(`${match.score}`, 608, rowY + 68);

    match.itemIconUrls.slice(0, 7).forEach((url, itemIndex) => {
      const itemX = 690 + (itemIndex * 44);
      const image = imageMap.get(url);
      if (image) drawRoundedImage(context, image, itemX, rowY + 31, 36, 8);
      else {
        drawRoundedRect(context, itemX, rowY + 31, 36, 36, 8);
        context.fillStyle = "#253047";
        context.fill();
      }
    });
  });

  context.fillStyle = "#69758a";
  context.font = "600 18px Inter, Arial, sans-serif";
  context.fillText(text.generatedBy, 52, height - 48);
  context.textAlign = "right";
  context.fillStyle = "#aeb6c4";
  context.fillText(new Date().toISOString().slice(0, 10), width - 52, height - 48);
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

export function RecentMatchesShareActions({ riotId, matches, text }: RecentMatchesShareActionsProps) {
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
    return createRecentMatchesShareBlob(riotId, matches, text);
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
        <Button disabled={busy || matches.length === 0} loading={busy} onClick={() => void onDownload()} size="sm" type="button" variant="secondary">
          <span aria-hidden="true">↓</span>
          {text.download}
        </Button>
        <Button disabled={busy || matches.length === 0} onClick={() => void onShare()} size="sm" type="button">
          <span aria-hidden="true">↗</span>
          {text.share}
        </Button>
      </div>
      <span className="public-match-share-status" role={status === "failed" ? "alert" : "status"} aria-live="polite">
        {statusText}
      </span>
    </section>
  );
}

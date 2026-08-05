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
const SHARE_CARD_HEADER_HEIGHT = 316;
const SHARE_CARD_ROW_HEIGHT = 108;
const SHARE_CARD_FOOTER_HEIGHT = 96;
const SHARE_CARD_MAX_MATCHES = 8;
const SHARE_CARD_LOGO_URL = "/images/yorogg-home-logo.webp";
const SHARE_CARD_FONT = '"Inter", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif';

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
    ...matches.flatMap((match) => [match.championIconUrl, ...match.itemIconUrls]),
    ...additionalUrls,
  ].filter((url): url is string => Boolean(url))));
  const loaded = await Promise.all(urls.map(async (url) => [url, await loadCanvasImage(url)] as const));
  return new Map(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => Boolean(entry[1])));
}

function shareCardFileName(riotId: string): string {
  const safeId = riotId.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `yoro-${safeId || "lol"}-recent-matches.png`;
}

function drawBrandLogo(context: CanvasRenderingContext2D, logoImage: HTMLImageElement | undefined): void {
  if (logoImage) {
    context.save();
    context.filter = "brightness(0) invert(1)";
    context.drawImage(logoImage, 48, 34, 194, 65);
    context.restore();
  } else {
    context.fillStyle = "#f7f8fa";
    context.font = `italic 900 40px ${SHARE_CARD_FONT}`;
    context.fillText("YORO", 48, 76);
    context.fillStyle = "#8b6cff";
    context.font = `italic 900 27px ${SHARE_CARD_FONT}`;
    context.fillText(".GG", 166, 76);
  }

  const underline = context.createLinearGradient(48, 0, 238, 0);
  underline.addColorStop(0, "#6ea8ff");
  underline.addColorStop(.58, "#7c5cff");
  underline.addColorStop(1, "rgba(168, 85, 247, 0)");
  context.fillStyle = underline;
  drawRoundedRect(context, 48, 100, 194, 3, 2);
  context.fill();
}

function drawProfileAvatar(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  riotId: string,
): void {
  const centerX = 112;
  const centerY = 204;
  const radius = 60;
  context.save();
  context.shadowColor = "rgba(124, 92, 255, .72)";
  context.shadowBlur = 28;
  context.beginPath();
  context.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
  const ring = context.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  ring.addColorStop(0, "#6ea8ff");
  ring.addColorStop(.48, "#7c5cff");
  ring.addColorStop(1, "#d16cff");
  context.strokeStyle = ring;
  context.lineWidth = 8;
  context.stroke();
  context.restore();

  if (image) {
    drawCircularImage(context, image, centerX, centerY, radius);
    return;
  }

  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = "#18223a";
  context.fill();
  context.fillStyle = "#f7f8fa";
  context.textAlign = "center";
  context.font = `900 38px ${SHARE_CARD_FONT}`;
  context.fillText(riotId.slice(0, 1).toUpperCase(), centerX, centerY + 13);
  context.textAlign = "start";
}

function drawSummaryMetric(
  context: CanvasRenderingContext2D,
  x: number,
  label: string,
  value: string,
  valueColor = "#f7f8fa",
): void {
  context.fillStyle = "rgba(9, 15, 29, .64)";
  drawRoundedRect(context, x, 178, 112, 76, 16);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, .09)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = valueColor;
  context.textAlign = "center";
  context.font = `900 27px ${SHARE_CARD_FONT}`;
  context.fillText(value, x + 56, 211, 92);
  context.fillStyle = "#9ba8bd";
  context.font = `700 14px ${SHARE_CARD_FONT}`;
  context.fillText(label, x + 56, 236, 96);
  context.textAlign = "start";
}

function drawSpecialRowGlow(
  context: CanvasRenderingContext2D,
  highlight: "mvp" | "ace",
  rowY: number,
  rowWidth: number,
): void {
  const isMvp = highlight === "mvp";
  const start = isMvp ? "rgba(252, 190, 65, .30)" : "rgba(224, 231, 241, .25)";
  const middle = isMvp ? "rgba(245, 158, 11, .12)" : "rgba(148, 163, 184, .10)";
  const border = isMvp ? "rgba(255, 205, 92, .88)" : "rgba(226, 232, 240, .78)";
  const glow = context.createLinearGradient(44, rowY, 44 + rowWidth, rowY);
  glow.addColorStop(0, start);
  glow.addColorStop(.32, middle);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.save();
  context.shadowColor = border;
  context.shadowBlur = 16;
  context.fillStyle = glow;
  drawRoundedRect(context, 44, rowY, rowWidth, SHARE_CARD_ROW_HEIGHT - 10, 18);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = border;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
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
  const matches = sourceMatches.slice(0, SHARE_CARD_MAX_MATCHES);
  if (matches.length === 0) throw new Error("share_matches_empty");

  const width = SHARE_CARD_WIDTH;
  const height = SHARE_CARD_HEADER_HEIGHT + (matches.length * SHARE_CARD_ROW_HEIGHT) + SHARE_CARD_FOOTER_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("share_canvas_unavailable");

  const imageMap = await loadShareImages(matches, [
    options.profileImageUrl,
    options.masteryChampionArtUrl,
    SHARE_CARD_LOGO_URL,
  ]);
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

  const masteryChampionArt = options.masteryChampionArtUrl
    ? imageMap.get(options.masteryChampionArtUrl)
    : undefined;
  if (masteryChampionArt) {
    context.save();
    context.globalAlpha = .56;
    context.filter = "saturate(.92) contrast(1.08)";
    drawCoverImage(context, masteryChampionArt, 360, 0, width - 360, SHARE_CARD_HEADER_HEIGHT + 32);
    context.restore();
  }

  const heroShade = context.createLinearGradient(0, 0, width, 0);
  heroShade.addColorStop(0, "rgba(5, 10, 22, .98)");
  heroShade.addColorStop(.42, "rgba(8, 14, 29, .92)");
  heroShade.addColorStop(.72, "rgba(8, 14, 29, .54)");
  heroShade.addColorStop(1, "rgba(8, 14, 29, .32)");
  context.fillStyle = heroShade;
  context.fillRect(0, 0, width, SHARE_CARD_HEADER_HEIGHT + 32);
  const heroFade = context.createLinearGradient(0, 205, 0, SHARE_CARD_HEADER_HEIGHT + 32);
  heroFade.addColorStop(0, "rgba(8, 14, 29, 0)");
  heroFade.addColorStop(1, "#080f1d");
  context.fillStyle = heroFade;
  context.fillRect(0, 205, width, SHARE_CARD_HEADER_HEIGHT - 173);

  const glow = context.createRadialGradient(width * .78, 0, 0, width * .78, 0, width * .7);
  glow.addColorStop(0, "rgba(123, 92, 255, .34)");
  glow.addColorStop(1, "rgba(123, 92, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  drawBrandLogo(context, imageMap.get(SHARE_CARD_LOGO_URL));
  drawProfileAvatar(
    context,
    options.profileImageUrl ? imageMap.get(options.profileImageUrl) : undefined,
    riotId,
  );
  context.fillStyle = "#8ea8ff";
  context.font = `800 16px ${SHARE_CARD_FONT}`;
  context.fillText(text.recentMatches.toUpperCase(), 194, 151);
  context.fillStyle = "#f7f8fa";
  context.font = `900 38px ${SHARE_CARD_FONT}`;
  context.fillText(riotId, 194, 199, 340);
  context.fillStyle = "#aeb6c4";
  context.font = `650 17px ${SHARE_CARD_FONT}`;
  context.fillText(text.generatedBy, 194, 230, 320);

  drawSummaryMetric(context, 548, text.games, `${matches.length}`);
  drawSummaryMetric(context, 668, text.wins, `${wins}`, "#51b9ff");
  drawSummaryMetric(context, 788, text.losses, `${losses}`, "#ff6b86");
  drawSummaryMetric(context, 908, text.winRate, `${winRate}%`, "#b794ff");

  context.fillStyle = "rgba(255, 255, 255, .08)";
  context.fillRect(44, SHARE_CARD_HEADER_HEIGHT - 18, width - 88, 1);

  matches.forEach((match, index) => {
    const rowY = SHARE_CARD_HEADER_HEIGHT + (index * SHARE_CARD_ROW_HEIGHT);
    const rowColor = match.result === "win" ? "#10273a" : match.result === "loss" ? "#301a29" : "#192231";
    const accentColor = match.result === "win" ? "#32b5ff" : match.result === "loss" ? "#ff5775" : "#8a94a6";
    drawRoundedRect(context, 44, rowY, width - 88, SHARE_CARD_ROW_HEIGHT - 10, 18);
    context.fillStyle = rowColor;
    context.fill();
    if (match.highlight) drawSpecialRowGlow(context, match.highlight, rowY, width - 88);
    context.fillStyle = accentColor;
    drawRoundedRect(context, 44, rowY, 8, SHARE_CARD_ROW_HEIGHT - 10, 4);
    context.fill();

    context.fillStyle = accentColor;
    context.font = `850 22px ${SHARE_CARD_FONT}`;
    context.fillText(match.resultLabel, 68, rowY + 40);
    context.fillStyle = "#9ca8ba";
    context.font = `650 15px ${SHARE_CARD_FONT}`;
    context.fillText(match.startedAtLabel, 68, rowY + 66, 136);
    context.fillText(match.durationLabel, 68, rowY + 85, 136);

    const championX = 194;
    const championY = rowY + 16;
    const championImage = match.championIconUrl ? imageMap.get(match.championIconUrl) : undefined;
    if (championImage) drawRoundedImage(context, championImage, championX, championY, 66, 17);
    else {
      drawRoundedRect(context, championX, championY, 66, 66, 17);
      context.fillStyle = "#26334a";
      context.fill();
      context.fillStyle = "#f7f8fa";
      context.font = `800 28px ${SHARE_CARD_FONT}`;
      context.textAlign = "center";
      context.fillText(match.championName.slice(0, 1), championX + 33, championY + 44);
      context.textAlign = "start";
    }
    context.fillStyle = "#f7f8fa";
    context.font = `800 22px ${SHARE_CARD_FONT}`;
    context.fillText(match.championName, 276, rowY + 39, 132);
    context.fillStyle = "#9ca8ba";
    context.font = `600 15px ${SHARE_CARD_FONT}`;
    context.fillText(match.queueLabel, 276, rowY + 66, 132);

    context.fillStyle = "#f7f8fa";
    context.font = `850 23px ${SHARE_CARD_FONT}`;
    context.fillText(match.kda, 420, rowY + 39, 142);
    context.fillStyle = "#9ca8ba";
    context.font = `650 15px ${SHARE_CARD_FONT}`;
    context.fillText(match.kdaMetric, 420, rowY + 66, 118);

    context.fillStyle = match.score >= 75 ? "#f8bd4b" : match.score >= 55 ? "#8ea8ff" : "#aeb6c4";
    context.font = `900 28px ${SHARE_CARD_FONT}`;
    context.fillText(match.grade, 566, rowY + 48);

    if (match.highlight) {
      const isMvp = match.highlight === "mvp";
      const badgeX = 558;
      const badgeY = rowY + 61;
      const badgeGradient = context.createLinearGradient(badgeX, badgeY, badgeX + 72, badgeY);
      badgeGradient.addColorStop(0, isMvp ? "#f7c84b" : "#f8fafc");
      badgeGradient.addColorStop(1, isMvp ? "#f59e0b" : "#94a3b8");
      context.fillStyle = badgeGradient;
      drawRoundedRect(context, badgeX, badgeY, 70, 24, 12);
      context.fill();
      context.fillStyle = isMvp ? "#382407" : "#172033";
      context.textAlign = "center";
      context.font = `900 13px ${SHARE_CARD_FONT}`;
      context.fillText(match.highlight.toUpperCase(), badgeX + 35, badgeY + 17);
      context.textAlign = "start";
    }

    match.itemIconUrls.slice(0, 7).forEach((url, itemIndex) => {
      const itemX = 662 + (itemIndex * 47);
      const image = imageMap.get(url);
      if (image) drawRoundedImage(context, image, itemX, rowY + 30, 40, 9);
      else {
        drawRoundedRect(context, itemX, rowY + 30, 40, 40, 9);
        context.fillStyle = "#253047";
        context.fill();
      }
    });
  });

  const footerY = height - SHARE_CARD_FOOTER_HEIGHT;
  const footerGradient = context.createLinearGradient(0, footerY, width, footerY);
  footerGradient.addColorStop(0, "rgba(75, 83, 164, .18)");
  footerGradient.addColorStop(.5, "rgba(124, 92, 255, .24)");
  footerGradient.addColorStop(1, "rgba(35, 45, 77, .16)");
  context.fillStyle = footerGradient;
  context.fillRect(0, footerY, width, SHARE_CARD_FOOTER_HEIGHT);
  context.fillStyle = "#f7f8fa";
  context.font = `italic 900 30px ${SHARE_CARD_FONT}`;
  context.fillText("YORO.GG", 52, height - 42);
  context.fillStyle = "#8f9db4";
  context.font = `650 16px ${SHARE_CARD_FONT}`;
  context.fillText(text.generatedBy, 226, height - 45, 520);
  context.textAlign = "right";
  context.fillStyle = "#aeb6c4";
  context.fillText(new Date().toISOString().slice(0, 10), width - 52, height - 45);
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

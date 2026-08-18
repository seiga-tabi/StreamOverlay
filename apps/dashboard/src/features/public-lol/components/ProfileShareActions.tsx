import { useEffect, useRef, useState } from "react";
import { Button } from "../../../shared/ui/Button";

/* 프로필 공유 카드 — 목업 docs/mockups/lol-profile-share-card.html v1.3.
 *
 * 최근 경기 8줄을 나열하던 전적 공유 카드를 대체합니다. 카드가 담는 것:
 * 티어 엠블럼·라이엇 이름·티어/LP/승률 → 주 라인(라인 아이콘·성과 + 주력 챔피언 3)
 * → 부 라인(같은 문법) → 푸터. 스트리머(twitchStream.matched)는 헤더가 트위치
 * 아바타·채널명·LIVE·방송 제목으로 바뀌고 티어가 우측으로 이동하며, 라인 블록은
 * 일반 카드와 동일합니다 — 한 장에 스트리머 정보와 라인 정보가 함께 담깁니다.
 *
 * 캔버스 규격(§⑤-1 실측 검증): 폭 1080 고정, 높이는 블록 구성에 따라 805~961.
 * 전 조합이 X 무크롭(3:4~2:1)·인스타 피드(4:5~1.91:1) 범위 안에 들어오도록
 * MIN_CARD_HEIGHT(566) 가드를 둡니다 — 블록이 줄어도 1.91:1 을 넘지 않습니다.
 *
 * 이미지는 전부 CORS 프록시(assetUrl)를 거친 URL 을 받으며, 개별 로드 실패는
 * 도형·이니셜 폴백으로 닫고 전체 실패만 오류로 올립니다(가짜 데이터 금지).
 */

export type ProfileShareChampion = {
  name: string;
  iconUrl?: string;
  games: number;
  winRate: number;
};

export type ProfileShareLane = {
  /** 라인 아이콘 SVG 경로(/images/roles/position-*.svg) — 없으면 라벨만 그립니다. */
  iconUrl?: string;
  roleLabel: string;
  games: number;
  winRate: number;
  kda: number;
  champions: ProfileShareChampion[];
};

export type ProfileShareStreamer = {
  displayName: string;
  channelLabel?: string;
  profileImageUrl?: string;
  isLive: boolean;
  title?: string;
};

export type ProfileShareCard = {
  riotId: string;
  tierLabel?: string;
  tierIconUrl?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  summonerLevel?: number;
  queueLabel?: string;
  profileImageUrl?: string;
  masteryChampionArtUrl?: string;
  mainLane?: ProfileShareLane;
  subLane?: ProfileShareLane;
  streamer?: ProfileShareStreamer;
};

export type ProfileShareText = {
  title: string;
  description: string;
  download: string;
  share: string;
  preparing: string;
  saved: string;
  shared: string;
  failed: string;
  mainLane: string;
  subLane: string;
  unranked: string;
  levelPrefix: string;
  games: string;
  sampleNote: string;
  liveBadge: string;
};

export type ProfileShareActionsProps = {
  card: ProfileShareCard;
  text: ProfileShareText;
  /** 프로필 헤더처럼 설명 블록이 들어갈 자리가 없는 곳에서 버튼만 그립니다. */
  compact?: boolean;
};

type ShareStatus = "idle" | "preparing" | "saved" | "shared" | "failed";

const CARD_WIDTH = 1080;
/* 1080 / 1.91 ≈ 565.4 — 인스타 피드·X 크롭 경계(목업 §⑤ 최소 높이 가드). */
const MIN_CARD_HEIGHT = 566;
const CARD_FONT = '"Inter", "Noto Sans KR", "Noto Sans JP", Arial, sans-serif';
const LANE_BLOCK_HEIGHT = 196;
const FOOTER_HEIGHT = 78;

const COLOR = {
  bg0: "#0e1320",
  bg1: "#171e30",
  text: "#f2f5fa",
  muted: "#a9b4c9",
  dim: "#7f8ba2",
  line: "rgba(255, 255, 255, .09)",
  brand: "#9b90ff",
  win: "#3b95fb",
  gold: "#f0c25f",
  twitch: "#a970ff",
  live: "#eb0400",
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
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

/* 티어 엠블럼은 투명 여백이 큰 원본(cdragon 1280×720)이라 그대로 그리면 실물이
   절반 크기로 보입니다. 알파 경계를 재서 잘라낸 뒤 정사각으로 맞춥니다
   (목업 v1.1 — 실측으로 확인한 결함). 실패하면 원본 비율로 폴백합니다. */
function drawTrimmedEmblem(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
): void {
  const probe = document.createElement("canvas");
  probe.width = image.width;
  probe.height = image.height;
  const probeContext = probe.getContext("2d", { willReadFrequently: true });
  let bounds: { x: number; y: number; width: number; height: number } | undefined;
  if (probeContext) {
    probeContext.drawImage(image, 0, 0);
    try {
      const { data, width, height } = probeContext.getImageData(0, 0, probe.width, probe.height);
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      for (let row = 0; row < height; row += 1) {
        for (let column = 0; column < width; column += 1) {
          if (data[((row * width) + column) * 4 + 3]! > 8) {
            if (column < minX) minX = column;
            if (column > maxX) maxX = column;
            if (row < minY) minY = row;
            if (row > maxY) maxY = row;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) {
        bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
      }
    } catch {
      /* 프록시를 거치지 않은 교차 출처 이미지는 캔버스를 오염시켜 읽을 수 없습니다. */
    }
  }
  if (!bounds) {
    const scale = Math.min(size / image.width, size / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    context.drawImage(image, x + (size - drawWidth) / 2, y + (size - drawHeight) / 2, drawWidth, drawHeight);
    return;
  }
  const side = Math.max(bounds.width, bounds.height);
  const scale = size / side;
  context.drawImage(
    image,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    x + ((size - (bounds.width * scale)) / 2),
    y + ((size - (bounds.height * scale)) / 2),
    bounds.width * scale,
    bounds.height * scale,
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

async function loadCardImages(card: ProfileShareCard): Promise<Map<string, HTMLImageElement>> {
  const lanes = [card.mainLane, card.subLane].filter((lane): lane is ProfileShareLane => Boolean(lane));
  const urls = Array.from(new Set([
    card.tierIconUrl,
    card.profileImageUrl,
    card.masteryChampionArtUrl,
    card.streamer?.profileImageUrl,
    ...lanes.flatMap((lane) => [lane.iconUrl, ...lane.champions.map((champion) => champion.iconUrl)]),
  ].filter((url): url is string => Boolean(url))));
  const loaded = await Promise.all(urls.map(async (url) => [url, await loadCanvasImage(url)] as const));
  return new Map(loaded.filter((entry): entry is readonly [string, HTMLImageElement] => Boolean(entry[1])));
}

export function profileShareFileName(riotId: string): string {
  const safeId = riotId.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "");
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `yoro-lol-profile-${safeId || "summoner"}-${stamp}.png`;
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

/** 라인 블록 하나를 그리고 다음 y 좌표를 돌려줍니다. */
function drawLaneBlock(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  lane: ProfileShareLane,
  tagLabel: string,
  isMain: boolean,
  y: number,
  text: ProfileShareText,
): number {
  const x = 48;
  const width = CARD_WIDTH - 96;
  const height = LANE_BLOCK_HEIGHT - 20;

  drawRoundedRect(context, x, y, width, height, 24);
  context.fillStyle = isMain ? "rgba(155, 144, 255, .07)" : "rgba(255, 255, 255, .03)";
  context.fill();
  context.strokeStyle = isMain ? "rgba(155, 144, 255, .45)" : COLOR.line;
  context.lineWidth = 2;
  context.stroke();

  /* 태그 pill — 주 라인은 브랜드 채움, 부 라인은 회색. */
  context.font = `900 20px ${CARD_FONT}`;
  const tagWidth = context.measureText(tagLabel).width + 36;
  drawRoundedRect(context, x + 26, y + 22, tagWidth, 38, 19);
  context.fillStyle = isMain ? COLOR.brand : "rgba(255, 255, 255, .1)";
  context.fill();
  context.fillStyle = isMain ? "#14102e" : COLOR.muted;
  context.textAlign = "center";
  context.fillText(tagLabel, x + 26 + (tagWidth / 2), y + 48);
  context.textAlign = "start";

  /* 라인 아이콘 + 라인명. 아이콘은 흰색 계열이라 밝기만 올려 그립니다. */
  let roleX = x + 26 + tagWidth + 18;
  const roleIcon = lane.iconUrl ? images.get(lane.iconUrl) : undefined;
  if (roleIcon) {
    context.save();
    context.filter = "brightness(1.5)";
    context.drawImage(roleIcon, roleX, y + 22, 38, 38);
    context.restore();
    roleX += 48;
  }
  context.fillStyle = COLOR.text;
  context.font = `900 29px ${CARD_FONT}`;
  context.fillText(lane.roleLabel, roleX, y + 50);

  /* 라인 성과 — 우측 정렬. */
  context.textAlign = "right";
  context.font = `700 22px ${CARD_FONT}`;
  const statsRight = x + width - 28;
  const gamesLabel = `${lane.games}${text.games}`;
  const kdaLabel = ` · KDA ${lane.kda.toFixed(1)}`;
  const rateLabel = ` · ${lane.winRate}%`;
  context.fillStyle = COLOR.muted;
  context.fillText(kdaLabel, statsRight, y + 48);
  const kdaWidth = context.measureText(kdaLabel).width;
  context.fillStyle = COLOR.win;
  context.font = `800 22px ${CARD_FONT}`;
  context.fillText(rateLabel, statsRight - kdaWidth, y + 48);
  const rateWidth = context.measureText(rateLabel).width;
  context.fillStyle = COLOR.muted;
  context.font = `700 22px ${CARD_FONT}`;
  context.fillText(gamesLabel, statsRight - kdaWidth - rateWidth, y + 48);
  context.textAlign = "start";

  /* 챔피언 3칸 — 있는 만큼만(0이면 성과 줄만 남습니다). */
  const slotGap = 16;
  const slotWidth = (width - 52 - (slotGap * 2)) / 3;
  lane.champions.slice(0, 3).forEach((champion, index) => {
    const slotX = x + 26 + (index * (slotWidth + slotGap));
    const slotY = y + 76;
    drawRoundedRect(context, slotX, slotY, slotWidth, 72, 18);
    context.fillStyle = "rgba(0, 0, 0, .22)";
    context.fill();
    context.strokeStyle = COLOR.line;
    context.lineWidth = 2;
    context.stroke();

    const iconImage = champion.iconUrl ? images.get(champion.iconUrl) : undefined;
    if (iconImage) drawRoundedImage(context, iconImage, slotX + 18, slotY + 17, 38, 10);
    else {
      drawRoundedRect(context, slotX + 18, slotY + 17, 38, 38, 10);
      context.fillStyle = "#26334a";
      context.fill();
      context.fillStyle = COLOR.text;
      context.font = `800 20px ${CARD_FONT}`;
      context.textAlign = "center";
      context.fillText(champion.name.slice(0, 1), slotX + 37, slotY + 44);
      context.textAlign = "start";
    }

    const copyX = slotX + 68;
    const copyWidth = slotWidth - 84;
    context.fillStyle = COLOR.text;
    context.font = `850 23px ${CARD_FONT}`;
    fillTextEllipsis(context, champion.name, copyX, slotY + 32, copyWidth);
    context.fillStyle = COLOR.dim;
    context.font = `700 20px ${CARD_FONT}`;
    const gamesText = `${champion.games}${text.games} · `;
    context.fillText(gamesText, copyX, slotY + 57);
    context.fillStyle = COLOR.win;
    context.font = `800 20px ${CARD_FONT}`;
    context.fillText(`${champion.winRate}%`, copyX + context.measureText(gamesText).width, slotY + 57);
  });

  return y + LANE_BLOCK_HEIGHT;
}

export async function createProfileShareBlob(card: ProfileShareCard, text: ProfileShareText): Promise<Blob> {
  const images = await loadCardImages(card);
  const lanes: Array<{ lane: ProfileShareLane; tag: string; main: boolean }> = [];
  if (card.mainLane) lanes.push({ lane: card.mainLane, tag: text.mainLane, main: true });
  if (card.subLane) lanes.push({ lane: card.subLane, tag: text.subLane, main: false });

  const streamer = card.streamer;
  const showStreamTitle = Boolean(streamer?.isLive && streamer.title);
  /* 스트리머 헤더 높이 — LIVE 배지 하단이 y=170 이라 제목 박스를 186 부터 그립니다
     (실측: 152 에서 시작하면 배지와 겹쳤습니다). 제목이 없으면 배지 아래 여백만. */
  const headerHeight = streamer ? (showStreamTitle ? 262 : 190) : 268;
  const bodyHeight = headerHeight + (lanes.length * LANE_BLOCK_HEIGHT) + FOOTER_HEIGHT + 12;
  const height = Math.max(MIN_CARD_HEIGHT, bodyHeight);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("share_canvas_unavailable");

  /* 배경: 기본 그라디언트 → 숙련도 1위 스플래시 → 가독성 오버레이(목업 v1.2). */
  const background = context.createLinearGradient(0, 0, CARD_WIDTH, height);
  background.addColorStop(0, COLOR.bg1);
  background.addColorStop(.55, COLOR.bg0);
  background.addColorStop(1, COLOR.bg0);
  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, height);

  const splash = card.masteryChampionArtUrl ? images.get(card.masteryChampionArtUrl) : undefined;
  if (splash) {
    const splashHeight = Math.round(height * .62);
    context.save();
    context.globalAlpha = .85;
    drawCoverImage(context, splash, 0, 0, CARD_WIDTH, splashHeight);
    context.restore();

    const shade = context.createLinearGradient(0, 0, 0, splashHeight);
    shade.addColorStop(0, "rgba(14, 19, 32, .62)");
    shade.addColorStop(.34, "rgba(17, 22, 36, .88)");
    shade.addColorStop(.58, COLOR.bg0);
    shade.addColorStop(1, COLOR.bg0);
    context.fillStyle = shade;
    context.fillRect(0, 0, CARD_WIDTH, splashHeight);
  }

  if (streamer) {
    /* 스트리머 헤더: 아바타(트위치 링) · 채널명 · LIVE · 티어(우측). */
    const avatarImage = streamer.profileImageUrl ? images.get(streamer.profileImageUrl) : undefined;
    const centerX = 106;
    const centerY = 88;
    context.save();
    context.beginPath();
    context.arc(centerX, centerY, 66, 0, Math.PI * 2);
    context.strokeStyle = COLOR.twitch;
    context.lineWidth = 5;
    context.stroke();
    context.restore();
    if (avatarImage) drawCircularImage(context, avatarImage, centerX, centerY, 62);
    else {
      context.beginPath();
      context.arc(centerX, centerY, 62, 0, Math.PI * 2);
      context.fillStyle = "#18223a";
      context.fill();
      context.fillStyle = COLOR.text;
      context.font = `900 40px ${CARD_FONT}`;
      context.textAlign = "center";
      context.fillText(streamer.displayName.slice(0, 1).toUpperCase(), centerX, centerY + 14);
      context.textAlign = "start";
    }
    if (streamer.isLive) {
      context.font = `900 19px ${CARD_FONT}`;
      const liveWidth = context.measureText(text.liveBadge).width + 26;
      drawRoundedRect(context, centerX - (liveWidth / 2), centerY + 52, liveWidth, 30, 10);
      context.fillStyle = COLOR.live;
      context.fill();
      context.fillStyle = "#ffffff";
      context.textAlign = "center";
      context.fillText(text.liveBadge, centerX, centerY + 73);
      context.textAlign = "start";
    }

    context.fillStyle = COLOR.text;
    context.font = `900 36px ${CARD_FONT}`;
    fillTextEllipsis(context, streamer.displayName, 196, 82, 420);
    if (streamer.channelLabel) {
      context.fillStyle = COLOR.twitch;
      context.font = `700 22px ${CARD_FONT}`;
      fillTextEllipsis(context, streamer.channelLabel, 196, 116, 420);
    }

    /* 우측 티어 — 엠블럼 + 티어/LP + 승패. */
    const emblem = card.tierIconUrl ? images.get(card.tierIconUrl) : undefined;
    if (emblem) drawTrimmedEmblem(context, emblem, 664, 26, 120);
    context.textAlign = "right";
    context.fillStyle = COLOR.gold;
    context.font = `900 28px ${CARD_FONT}`;
    const tierText = card.tierLabel ?? text.unranked;
    const lpSuffix = card.leaguePoints !== undefined ? ` · ${card.leaguePoints.toLocaleString()} LP` : "";
    fillTextEllipsis(context, `${tierText}${lpSuffix}`, CARD_WIDTH - 48, 76, 260);
    context.fillStyle = COLOR.muted;
    context.font = `700 21px ${CARD_FONT}`;
    const record = card.wins !== undefined && card.losses !== undefined
      ? `${card.wins}W ${card.losses}L${card.winRate !== undefined ? ` · ${card.winRate}%` : ""}`
      : card.summonerLevel !== undefined ? `${text.levelPrefix}${card.summonerLevel}` : "";
    if (record) fillTextEllipsis(context, record, CARD_WIDTH - 48, 108, 260);
    context.textAlign = "start";

    if (showStreamTitle && streamer.title) {
      drawRoundedRect(context, 48, 186, CARD_WIDTH - 96, 56, 16);
      context.fillStyle = "rgba(255, 255, 255, .04)";
      context.fill();
      context.strokeStyle = COLOR.line;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = COLOR.muted;
      context.font = `650 23px ${CARD_FONT}`;
      fillTextEllipsis(context, streamer.title, 72, 222, CARD_WIDTH - 144);
    }
  } else {
    /* 일반 유저 헤더: 티어 엠블럼이 주인공(트림 후 300px). */
    const emblem = card.tierIconUrl ? images.get(card.tierIconUrl) : undefined;
    if (emblem) drawTrimmedEmblem(context, emblem, 40, 8, 300);
    else {
      const avatar = card.profileImageUrl ? images.get(card.profileImageUrl) : undefined;
      if (avatar) drawCircularImage(context, avatar, 190, 158, 92);
    }

    const copyX = 356;
    context.fillStyle = COLOR.text;
    context.font = `900 42px ${CARD_FONT}`;
    fillTextEllipsis(context, card.riotId, copyX, 108, CARD_WIDTH - copyX - 56);

    context.fillStyle = COLOR.gold;
    context.font = `900 34px ${CARD_FONT}`;
    const tierText = card.tierLabel ?? text.unranked;
    context.fillText(tierText, copyX, 158);
    if (card.leaguePoints !== undefined) {
      const tierWidth = context.measureText(tierText).width;
      context.fillStyle = COLOR.text;
      context.font = `800 30px ${CARD_FONT}`;
      context.fillText(` · ${card.leaguePoints.toLocaleString()} LP`, copyX + tierWidth, 158);
    }

    context.font = `700 24px ${CARD_FONT}`;
    let statX = copyX;
    if (card.wins !== undefined && card.losses !== undefined) {
      const record = `${card.wins}W ${card.losses}L · `;
      context.fillStyle = COLOR.muted;
      context.fillText(record, statX, 196);
      statX += context.measureText(record).width;
      if (card.winRate !== undefined) {
        context.fillStyle = COLOR.win;
        context.font = `800 24px ${CARD_FONT}`;
        const rate = `${card.winRate}%`;
        context.fillText(rate, statX, 196);
        statX += context.measureText(rate).width;
        context.font = `700 24px ${CARD_FONT}`;
      }
    }
    if (card.summonerLevel !== undefined) {
      /* 승패가 없는 언랭크에서는 앞의 구분점이 고아로 남습니다(실측). */
      const levelText = statX === copyX
        ? `${text.levelPrefix}${card.summonerLevel}`
        : ` · ${text.levelPrefix}${card.summonerLevel}`;
      context.fillStyle = COLOR.muted;
      context.fillText(levelText, statX, 196);
    }

    if (card.queueLabel) {
      context.font = `800 20px ${CARD_FONT}`;
      const queueWidth = context.measureText(card.queueLabel).width + 36;
      drawRoundedRect(context, copyX, 216, queueWidth, 36, 18);
      context.strokeStyle = COLOR.line;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = COLOR.dim;
      context.textAlign = "center";
      context.fillText(card.queueLabel, copyX + (queueWidth / 2), 241);
      context.textAlign = "start";
    }
  }

  let laneY = headerHeight;
  for (const entry of lanes) {
    laneY = drawLaneBlock(context, images, entry.lane, entry.tag, entry.main, laneY, text);
  }

  /* 푸터 — 로고 · 표본 안내 · 생성일. */
  const footerY = height - FOOTER_HEIGHT;
  context.fillStyle = COLOR.line;
  context.fillRect(48, footerY, CARD_WIDTH - 96, 2);
  context.fillStyle = COLOR.text;
  context.font = `900 26px ${CARD_FONT}`;
  context.fillText("YORO", 48, footerY + 48);
  const brandWidth = context.measureText("YORO").width;
  context.fillStyle = COLOR.brand;
  context.fillText(".gg", 48 + brandWidth, footerY + 48);
  context.fillStyle = COLOR.dim;
  context.font = `650 21px ${CARD_FONT}`;
  context.fillText(text.sampleNote, 48 + brandWidth + context.measureText(".gg").width + 22, footerY + 48);
  context.textAlign = "right";
  context.fillText(new Date().toISOString().slice(0, 10).replace(/-/g, "."), CARD_WIDTH - 48, footerY + 48);
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

export function ProfileShareActions({ card, text, compact }: ProfileShareActionsProps) {
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
    return createProfileShareBlob(card, text);
  };

  const onDownload = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const blob = await makeBlob();
      downloadBlob(blob, profileShareFileName(card.riotId));
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
      const file = new File([blob], profileShareFileName(card.riotId), { type: "image/png" });
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

  if (compact) {
    /* 헤더 배치 — 기존 공유 버튼과 같은 자리·같은 크기를 유지하고, 상태는 버튼
       아래 한 줄(aria-live)로만 알립니다. */
    /* 링크 공유 버튼(PublicProfileShareButton)과 같은 클래스·구조를 씁니다 —
       헤더 액션 줄의 크기·정렬·상태 툴팁 스타일을 그대로 물려받습니다. */
    return (
      <span className="public-profile-share-action">
        <Button
          className="public-secondary-action public-profile-share-button"
          disabled={busy}
          loading={busy}
          onClick={() => void onShare()}
          size="sm"
          type="button"
          variant="secondary"
        >
          <span aria-hidden="true">🖼</span>
          {text.share}
        </Button>
        <span className="public-profile-share-status" role={status === "failed" ? "alert" : "status"} aria-live="polite">
          {statusText}
        </span>
      </span>
    );
  }

  return (
    <section className="public-match-share-actions" aria-labelledby="public-profile-share-title">
      <div>
        <strong id="public-profile-share-title">{text.title}</strong>
        <span>{text.description}</span>
      </div>
      <div className="public-match-share-buttons">
        <Button disabled={busy} loading={busy} onClick={() => void onDownload()} size="sm" type="button" variant="secondary">
          <span aria-hidden="true">↓</span>
          {text.download}
        </Button>
        <Button disabled={busy} onClick={() => void onShare()} size="sm" type="button">
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

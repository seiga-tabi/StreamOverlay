/* 스트리머 추천 글 계약 — docs/mockups/streamer-board.
 *
 * 응답이 형식을 벗어나면 화면이 그 조각을 버립니다 — 패치 변경 요약이 쓴 방식과
 * 같습니다. 서버와 공유해야 하는 규칙(채널 정규화·길이 경계)은 여기가 아니라
 * packages/shared/src/streamer-board.ts 에 둡니다.
 */

import { streamerChannelHandle, streamerChannelKey, streamerOfficialChannelKey } from "@streamops/shared";
import type { LolRankTier } from "@streamops/shared";
import { rankTierLabel } from "../../public-lol/utils/rank";
import type { StreamerScope } from "../utils/routes";

/* 채널 정규화 규칙은 서버와 공유합니다(packages/shared/src/streamer-board.ts).
   두 벌 두면 프런트가 "중복 아님" 이라 본 채널을 서버가 409 로 막습니다. */
export { streamerChannelKey };

/** 연동된 플랫폼. twitch 만 프로필 이미지를 가져올 수 있습니다. */
export const STREAMER_PLATFORMS = ["twitch", "chzzk", "youtube"] as const;

export type StreamerPlatform = (typeof STREAMER_PLATFORMS)[number];

/** 게임 태그 — 목록 범위(nav)와 같은 값입니다. all 은 태그가 될 수 없습니다. */
export type StreamerGame = Exclude<StreamerScope, "all">;

export const STREAMER_GAMES: readonly StreamerGame[] = ["lol", "valorant", "palworld", "minecraft"];

/** 리그 오브 레전드 글에만 붙는 전적 요약. 다른 게임은 이 필드가 없습니다. */
export type StreamerLolProfile = {
  riotId: string;
  tier: string;
  /* 표기(tier)는 rankTierLabel 이 접은 문자열이라 티어 엠블럼 색을 고를 수 없습니다.
     서버가 이미 보내 주는 원본 코드를 함께 남겨 카드가 색을 직접 고릅니다. */
  tierCode: LolRankTier;
  leaguePoints: number;
  /** 0~100. */
  winRate: number;
  wins: number;
  losses: number;
  /** 최근 경기 결과, 최신순. 최대 5개. */
  recentResults: readonly ("win" | "loss")[];
};

export type StreamerOfficialProfile = {
  handle: string;
  seoSlug: string;
  liveStatusSupported: boolean;
};

export type StreamerPost = {
  id: string;
  streamerName: string;
  platform: StreamerPlatform;
  /** 로그인 전에는 서버가 이 필드를 비웁니다. */
  channelUrl?: string;
  /** twitch 만 채워집니다. 나머지는 화면이 플랫폼 마크를 씁니다. */
  profileImageUrl?: string;
  live: boolean;
  games: readonly StreamerGame[];
  /** 게임 태그 외의 자유 태그(칼바람 나락 등). */
  tags: readonly string[];
  votes: number;
  /** 이 사람이 이미 추천했는지. 비로그인은 항상 false 입니다. */
  voted: boolean;
  commentCount: number;
  authorName: string;
  createdAt: string;
  lolProfile?: StreamerLolProfile;
  registeredByAdmin: boolean;
  officialProfile?: StreamerOfficialProfile;
};

export type StreamerComment = {
  id: string;
  /** 익명 댓글은 이름을 싣지 않습니다. */
  authorName?: string;
  anonymous: boolean;
  body: string;
  createdAt: string;
};

export type StreamerPostList = {
  posts: readonly StreamerPost[];
  total: number;
  liveCount: number;
};

export type StreamerPostDetail = {
  post: StreamerPost;
  comments: readonly StreamerComment[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function counter(value: unknown): number {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= 0 ? Math.trunc(parsed) : 0;
}

/** 외부 URL 은 그대로 믿지 않습니다 — https 만, 그리고 알려진 호스트만 링크합니다. */
function safeChannelUrl(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    const allowed = host === "twitch.tv" || host.endsWith(".twitch.tv")
      || host === "chzzk.naver.com"
      || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be";
    return allowed ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/* 프로필 이미지는 서버가 받아 같은 origin 으로 다시 내보냅니다 — 시청자 브라우저가
   Twitch CDN 에 직접 붙지 않아야 하기 때문입니다(시청자 IP 가 외부로 새지 않도록).
   그래서 우리 아바타 경로만 받습니다. 외부 주소가 오면 쓰지 않고 플랫폼 마크로
   떨어집니다. */
const AVATAR_PATH_PATTERN = /^\/api\/public\/streamers\/[a-z0-9][a-z0-9_-]{0,63}\/avatar$/u;

function safeImageUrl(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return AVATAR_PATH_PATTERN.test(text) ? text : undefined;
}

const LOL_RANK_TIERS: readonly LolRankTier[] = [
  "IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM",
  "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER", "UNRANKED",
];

/* 표기와 코드를 같이 돌려줍니다 — 표기만 남기면 카드가 티어 색을 고를 수 없습니다. */
function parseTier(
  value: Record<string, unknown>
): { label: string; code: LolRankTier; leaguePoints: number } | undefined {
  const tier = LOL_RANK_TIERS.find((candidate) => candidate === value.tier);
  if (!tier) return undefined;
  const rank = safeText(value.rank, 4);
  const leaguePoints = counter(value.leaguePoints);
  return {
    label: rankTierLabel({
      queueType: "RANKED_SOLO_5x5",
      tier,
      ...(rank ? { rank } : {}),
      leaguePoints,
      wins: counter(value.wins),
      losses: counter(value.losses),
      winRate: 0,
      fetchedAt: new Date(0).toISOString(),
    }),
    code: tier,
    leaguePoints,
  };
}

function parseLolProfile(value: unknown): StreamerLolProfile | undefined {
  if (!isRecord(value)) return undefined;
  const riotId = safeText(value.riotId, 60);
  /* 서버는 티어 코드(DIAMOND)와 단계(II)를 줍니다. 표기는 다른 LoL 화면과 같은
     규칙으로 여기서 만듭니다 — 두 화면이 같은 계정을 다르게 부르면 안 됩니다. */
  const tier = parseTier(value);
  const winRate = finiteNumber(value.winRate);
  const wins = finiteNumber(value.wins);
  const losses = finiteNumber(value.losses);
  if (!riotId || !tier) return undefined;
  if (winRate === undefined || winRate < 0 || winRate > 100) return undefined;
  if (wins === undefined || losses === undefined || wins < 0 || losses < 0) return undefined;
  const recentResults = Array.isArray(value.recentResults)
    ? value.recentResults
      .filter((result): result is "win" | "loss" => result === "win" || result === "loss")
      .slice(0, 5)
    : [];
  return {
    riotId,
    tier: tier.label,
    tierCode: tier.code,
    leaguePoints: tier.leaguePoints,
    winRate: Math.round(winRate * 10) / 10,
    wins: Math.trunc(wins),
    losses: Math.trunc(losses),
    recentResults,
  };
}

function parseOfficialProfile(
  value: unknown,
  platform: StreamerPlatform
): StreamerOfficialProfile | undefined {
  if (!isRecord(value)) return undefined;
  const handle = safeText(value.handle, 80);
  const seoSlug = safeText(value.seoSlug, 80);
  if (!handle || !seoSlug) return undefined;
  const channelKey = streamerOfficialChannelKey(platform, handle);
  if (!channelKey || streamerChannelHandle(channelKey) !== seoSlug) return undefined;
  return {
    handle,
    seoSlug,
    /* 서버가 잘못된 값을 보내도 치지직·YouTube 실시간 UI는 열리지 않습니다. */
    liveStatusSupported: platform === "twitch" && value.liveStatusSupported === true,
  };
}

export function parseStreamerPost(value: unknown): StreamerPost | undefined {
  if (!isRecord(value)) return undefined;
  const id = safeText(value.id, 64);
  const streamerName = safeText(value.streamerName, 60);
  const authorName = safeText(value.authorName, 40);
  const createdAt = typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    ? value.createdAt
    : undefined;
  const platform = STREAMER_PLATFORMS.find((candidate) => candidate === value.platform);
  if (!id || !streamerName || !authorName || !createdAt || !platform) return undefined;

  const games = Array.isArray(value.games)
    ? STREAMER_GAMES.filter((game) => (value.games as unknown[]).includes(game))
    : [];
  const tags = Array.isArray(value.tags)
    ? value.tags.map((tag) => safeText(tag, 24)).filter((tag): tag is string => Boolean(tag)).slice(0, 4)
    : [];
  const channelUrl = safeChannelUrl(value.channelUrl);
  /* 프로필 이미지는 twitch 에서만 옵니다 — 다른 플랫폼이 보내와도 쓰지 않습니다. */
  const profileImageUrl = platform === "twitch" ? safeImageUrl(value.profileImageUrl) : undefined;
  const lolProfile = games.includes("lol") ? parseLolProfile(value.lolProfile) : undefined;
  const officialProfile = value.registeredByAdmin === true
    ? parseOfficialProfile(value.officialProfile, platform)
    : undefined;
  const registeredByAdmin = Boolean(officialProfile);

  return {
    id,
    streamerName,
    platform,
    ...(channelUrl ? { channelUrl } : {}),
    ...(profileImageUrl ? { profileImageUrl } : {}),
    live: value.live === true && (!registeredByAdmin || officialProfile?.liveStatusSupported === true),
    games,
    tags,
    votes: counter(value.votes),
    voted: value.voted === true,
    commentCount: counter(value.commentCount),
    authorName,
    createdAt,
    ...(lolProfile ? { lolProfile } : {}),
    registeredByAdmin,
    ...(officialProfile ? { officialProfile } : {}),
  };
}

export function parseStreamerComment(value: unknown): StreamerComment | undefined {
  if (!isRecord(value)) return undefined;
  const id = safeText(value.id, 64);
  const body = safeText(value.body, 600);
  const createdAt = typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    ? value.createdAt
    : undefined;
  if (!id || !body || !createdAt) return undefined;
  const anonymous = value.anonymous === true;
  const authorName = anonymous ? undefined : safeText(value.authorName, 40);
  /* 익명이 아닌데 이름이 없으면 화면이 "미상"을 만들게 됩니다 — 그런 댓글은 버립니다. */
  if (!anonymous && !authorName) return undefined;
  return {
    id,
    ...(authorName ? { authorName } : {}),
    anonymous,
    body,
    createdAt,
  };
}

export function parseStreamerPostList(value: unknown): StreamerPostList | undefined {
  if (!isRecord(value) || !Array.isArray(value.posts)) return undefined;
  const posts = value.posts
    .map(parseStreamerPost)
    .filter((post): post is StreamerPost => Boolean(post));
  const total = finiteNumber(value.total);
  return {
    posts,
    total: total !== undefined && total >= posts.length ? Math.trunc(total) : posts.length,
    liveCount: counter(value.liveCount),
  };
}

export function parseStreamerPostDetail(value: unknown): StreamerPostDetail | undefined {
  if (!isRecord(value)) return undefined;
  const post = parseStreamerPost(value.post);
  if (!post) return undefined;
  const comments = Array.isArray(value.comments)
    ? value.comments.map(parseStreamerComment).filter((comment): comment is StreamerComment => Boolean(comment))
    : [];
  return { post, comments };
}

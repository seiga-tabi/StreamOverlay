/* 스트리머 추천 글 계약 — docs/mockups/streamer-board.
 *
 * 서버 계약이 아직 없으므로(prompts 로 넘길 핸드오프 대상) 타입과 파서를 여기에
 * 둡니다. 응답이 형식을 벗어나면 화면이 그 조각을 버립니다 — 패치 변경 요약이
 * 쓴 방식과 같습니다. shared 로 옮길 때 이 파일은 지웁니다.
 */

import type { StreamerScope } from "../utils/routes";

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
  /** 0~100. */
  winRate: number;
  wins: number;
  losses: number;
  /** 최근 경기 결과, 최신순. 최대 5개. */
  recentResults: readonly ("win" | "loss")[];
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
  commentCount: number;
  authorName: string;
  createdAt: string;
  lolProfile?: StreamerLolProfile;
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

/* 채널 중복 판정용 정규화 키.
 *
 * 한 채널은 글 하나입니다. 사람마다 주소를 다르게 적기 때문에(www 유무, 대소문자,
 * 끝 슬래시, 추적 query) 문자열 비교로는 같은 채널을 못 잡습니다. 플랫폼과 채널
 * 식별자만 남겨 "twitch:bamtol" 형태로 줄인 뒤 비교합니다.
 *
 * YouTube 의 /channel/<id> 만 대소문자를 지킵니다 — 그 id 는 대소문자를 구분하는
 * 값이라, 낮춰 쓰면 서로 다른 채널이 같은 키가 될 수 있습니다. 나머지(트위치·치지직
 * 이름, @핸들)는 플랫폼이 대소문자를 구분하지 않습니다. */
export function streamerChannelKey(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  let url: URL;
  try {
    /* 사람은 보통 "twitch.tv/이름" 처럼 scheme 없이 붙여 넣습니다. */
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//iu.test(text) ? text : `https://${text}`);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
    /* /popout/<이름>/chat 같은 부수 경로에서도 채널 이름은 첫 실제 segment 입니다. */
    const name = segments[0] === "popout" ? segments[1] : segments[0];
    return name ? `twitch:${name.toLowerCase()}` : undefined;
  }
  if (host === "chzzk.naver.com") {
    const name = segments[0] === "live" || segments[0] === "video" ? segments[1] : segments[0];
    return name ? `chzzk:${name.toLowerCase()}` : undefined;
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (segments[0] === "channel" && segments[1]) return `youtube:${segments[1]}`;
    const name = segments[0] === "c" || segments[0] === "user" ? segments[1] : segments[0];
    if (!name) return undefined;
    return `youtube:${name.toLowerCase().replace(/^@/u, "")}`;
  }
  /* youtu.be 는 영상 주소입니다 — 채널을 가리키지 않으므로 키가 없습니다. */
  return undefined;
}

/** 프로필 이미지도 https 만 받습니다. 깨진 값은 플랫폼 마크로 떨어집니다. */
function safeImageUrl(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  try {
    return new URL(text).protocol === "https:" ? text : undefined;
  } catch {
    return undefined;
  }
}

function parseLolProfile(value: unknown): StreamerLolProfile | undefined {
  if (!isRecord(value)) return undefined;
  const riotId = safeText(value.riotId, 60);
  const tier = safeText(value.tier, 40);
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
    tier,
    winRate: Math.round(winRate * 10) / 10,
    wins: Math.trunc(wins),
    losses: Math.trunc(losses),
    recentResults,
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

  return {
    id,
    streamerName,
    platform,
    ...(channelUrl ? { channelUrl } : {}),
    ...(profileImageUrl ? { profileImageUrl } : {}),
    live: value.live === true,
    games,
    tags,
    votes: counter(value.votes),
    commentCount: counter(value.commentCount),
    authorName,
    createdAt,
    ...(lolProfile ? { lolProfile } : {}),
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

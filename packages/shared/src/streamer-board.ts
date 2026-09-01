/* 스트리머 추천 게시판 — 서버와 프런트가 함께 쓰는 계약.
 *
 * 채널 정규화·검증 규칙을 두 벌 두면 반드시 어긋납니다. 프런트가 "괜찮다" 한
 * 값을 서버가 거절하거나, 프런트가 중복이 아니라고 본 채널을 서버가 중복으로
 * 막는 식입니다. 그래서 여기 하나만 둡니다.
 *
 * 화면 계약: docs/mockups/streamer-board.
 */

/** 연동된 플랫폼. twitch 만 프로필 이미지와 LIVE 상태를 가져올 수 있습니다. */
export const STREAMER_PLATFORMS = ["twitch", "chzzk", "youtube"] as const;

export type StreamerPlatform = (typeof STREAMER_PLATFORMS)[number];

/** 게임 태그 — 목록 범위(nav)와 같은 값입니다. */
export const STREAMER_GAMES = ["lol", "valorant", "palworld", "minecraft"] as const;

export type StreamerGame = (typeof STREAMER_GAMES)[number];

export const STREAMER_REPORT_REASONS = ["spam", "abuse", "off_topic", "other"] as const;

export type StreamerReportReason = (typeof STREAMER_REPORT_REASONS)[number];

/* 길이 경계 — DB CHECK 제약과 같은 값입니다. 한쪽만 늘리면 저장에서 터집니다. */
export const STREAMER_NAME_MAX = 60;
export const STREAMER_CHANNEL_URL_MAX = 300;
export const STREAMER_CHANNEL_KEY_MAX = 120;
export const STREAMER_RIOT_ID_MAX = 60;
export const STREAMER_TAG_MAX = 24;
export const STREAMER_TAGS_MAX = 4;
export const STREAMER_COMMENT_MAX = 600;
export const STREAMER_SEARCH_MAX = 60;
export const STREAMER_HANDLE_MAX = 80;
/** 목록 한 번에 내려주는 최대 글 수. */
export const STREAMER_LIST_LIMIT = 60;

/** 글 id — 경로에 들어가므로 형식을 고정합니다(조작된 값을 조회로 넘기지 않기 위함). */
export const STREAMER_POST_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;

export function isStreamerPostId(value: unknown): value is string {
  return typeof value === "string" && STREAMER_POST_ID_PATTERN.test(value);
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

function boundedText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== "string") return undefined;
  /* 제어문자는 로그와 화면을 함께 망가뜨립니다 — 통째로 거절합니다. */
  if (CONTROL_CHARACTERS.test(value)) return undefined;
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maximum) return undefined;
  return normalized;
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
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > STREAMER_CHANNEL_URL_MAX) return undefined;
  let url: URL;
  try {
    /* 사람은 보통 "twitch.tv/이름" 처럼 scheme 없이 붙여 넣습니다. */
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//iu.test(text) ? text : `https://${text}`);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  const host = url.hostname.toLowerCase().replace(/^www\./u, "");
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });

  if (host === "twitch.tv" || host.endsWith(".twitch.tv")) {
    /* /popout/<이름>/chat 같은 부수 경로에서도 채널 이름은 첫 실제 segment 입니다. */
    const name = segments[0] === "popout" ? segments[1] : segments[0];
    return channelKeyFor("twitch", name?.toLowerCase());
  }
  if (host === "chzzk.naver.com") {
    const name = segments[0] === "live" || segments[0] === "video" ? segments[1] : segments[0];
    return channelKeyFor("chzzk", name?.toLowerCase());
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    if (segments[0] === "channel") return channelKeyFor("youtube", segments[1]);
    const name = segments[0] === "c" || segments[0] === "user" ? segments[1] : segments[0];
    return channelKeyFor("youtube", name?.toLowerCase().replace(/^@/u, ""));
  }
  /* youtu.be 는 영상 주소입니다 — 채널을 가리키지 않으므로 키가 없습니다. */
  return undefined;
}

/** 식별자에 경로 구분자나 제어문자가 섞이면 채널 이름이 아닙니다. */
function channelKeyFor(platform: StreamerPlatform, name: string | undefined): string | undefined {
  if (!name || !/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,79}$/u.test(name)) return undefined;
  const key = `${platform}:${name}`;
  return key.length <= STREAMER_CHANNEL_KEY_MAX ? key : undefined;
}

export function streamerPlatformFromChannelKey(channelKey: string): StreamerPlatform | undefined {
  const prefix = channelKey.split(":", 1)[0];
  return STREAMER_PLATFORMS.find((platform) => platform === prefix);
}

/** 키의 식별자 부분. Twitch 조회(login)와 화면 표기에 씁니다. */
export function streamerChannelHandle(channelKey: string): string | undefined {
  const index = channelKey.indexOf(":");
  return index > 0 ? channelKey.slice(index + 1) : undefined;
}

/** 저장·링크에 쓰는 정본 주소. 사용자가 적어 넣은 query 와 추적 값은 버립니다. */
export function streamerCanonicalChannelUrl(channelKey: string): string | undefined {
  const platform = streamerPlatformFromChannelKey(channelKey);
  const handle = streamerChannelHandle(channelKey);
  if (!platform || !handle) return undefined;
  const encoded = encodeURIComponent(handle);
  if (platform === "twitch") return `https://www.twitch.tv/${encoded}`;
  if (platform === "chzzk") return `https://chzzk.naver.com/${encoded}`;
  /* YouTube 는 채널 id 와 핸들의 경로 모양이 다릅니다. */
  return /^UC[A-Za-z0-9_-]{10,}$/u.test(handle)
    ? `https://www.youtube.com/channel/${encoded}`
    : `https://www.youtube.com/@${encoded}`;
}

export type StreamerOfficialProfile = {
  handle: string;
  seoSlug: string;
  liveStatusSupported: boolean;
};

export type StreamerOfficialProfileDraft = {
  streamerName: string;
  platform: StreamerPlatform;
  channelKey: string;
  channelUrl: string;
  games: readonly StreamerGame[];
  officialProfile: StreamerOfficialProfile;
};

/** 관리자 입력의 플랫폼·핸들을 기존 채널 URL 정규화 규칙으로 검증합니다. */
export function streamerOfficialChannelKey(
  platform: StreamerPlatform,
  handle: string
): string | undefined {
  const normalizedHandle = boundedText(handle, STREAMER_HANDLE_MAX);
  if (!normalizedHandle || normalizedHandle.includes("/")) return undefined;
  const candidate = platform === "twitch"
    ? `https://www.twitch.tv/${encodeURIComponent(normalizedHandle)}`
    : platform === "chzzk"
      ? `https://chzzk.naver.com/${encodeURIComponent(normalizedHandle)}`
      : /^UC[A-Za-z0-9_-]{10,}$/u.test(normalizedHandle)
        ? `https://www.youtube.com/channel/${encodeURIComponent(normalizedHandle)}`
        : `https://www.youtube.com/@${encodeURIComponent(normalizedHandle.replace(/^@/u, ""))}`;
  const channelKey = streamerChannelKey(candidate);
  return streamerPlatformFromChannelKey(channelKey ?? "") === platform ? channelKey : undefined;
}

/** 공식 프로필 생성·수정 요청. 라이브 연동은 1차 범위에서 Twitch만 허용합니다. */
export function parseStreamerOfficialProfileDraft(value: unknown): StreamerOfficialProfileDraft | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;
  const streamerName = boundedText(body.streamerName, STREAMER_NAME_MAX);
  const platform = STREAMER_PLATFORMS.find((candidate) => candidate === body.platform);
  const handleInput = boundedText(body.handle, STREAMER_HANDLE_MAX);
  if (!streamerName || !platform || !handleInput) return undefined;
  const channelKey = streamerOfficialChannelKey(platform, handleInput);
  const channelUrl = channelKey ? streamerCanonicalChannelUrl(channelKey) : undefined;
  const handle = channelKey ? streamerChannelHandle(channelKey) : undefined;
  if (!channelKey || !channelUrl || !handle) return undefined;
  if (!Array.isArray(body.games)) return undefined;
  const games = STREAMER_GAMES.filter((game) => (body.games as unknown[]).includes(game));
  if (games.length === 0) return undefined;
  return {
    streamerName,
    platform,
    channelKey,
    channelUrl,
    games,
    officialProfile: {
      handle,
      seoSlug: handle,
      /* YouTube 라이브 감지는 이번 1차 범위에서 비활성입니다. */
      liveStatusSupported: platform === "twitch"
    }
  };
}

export type StreamerPostDraft = {
  streamerName: string;
  /** 요청의 platform 은 참고만 합니다 — 실제 값은 채널 주소에서 뽑습니다. */
  platform: StreamerPlatform;
  channelKey: string;
  channelUrl: string;
  games: readonly StreamerGame[];
  tags: readonly string[];
  riotId?: string;
};

/**
 * 등록 요청 파싱. 형식이 조금이라도 어긋나면 undefined 이고 호출부가 400 을 냅니다.
 *
 * platform 을 요청에서 믿지 않는 이유: 채널 주소가 사실입니다. 목록 필터가
 * platform 으로 좁히는데, 주소는 치지직인데 twitch 로 저장되면 그 글은 어느
 * 필터에서도 제자리에 나오지 않습니다.
 */
export function parseStreamerPostDraft(value: unknown): StreamerPostDraft | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const body = value as Record<string, unknown>;

  const streamerName = boundedText(body.streamerName, STREAMER_NAME_MAX);
  if (!streamerName) return undefined;

  if (typeof body.channelUrl !== "string") return undefined;
  const channelKey = streamerChannelKey(body.channelUrl);
  if (!channelKey) return undefined;
  const platform = streamerPlatformFromChannelKey(channelKey);
  const channelUrl = streamerCanonicalChannelUrl(channelKey);
  if (!platform || !channelUrl) return undefined;

  if (!Array.isArray(body.games)) return undefined;
  const games = STREAMER_GAMES.filter((game) => (body.games as unknown[]).includes(game));
  if (games.length === 0) return undefined;

  const tags = Array.isArray(body.tags)
    ? body.tags
      .map((tag) => boundedText(tag, STREAMER_TAG_MAX))
      .filter((tag): tag is string => Boolean(tag))
      .slice(0, STREAMER_TAGS_MAX)
    : [];

  /* Riot ID 는 리그 오브 레전드 글에서만 뜻이 있습니다 — 다른 글에 실려 오면 버립니다. */
  const riotId = games.includes("lol") ? boundedText(body.riotId, STREAMER_RIOT_ID_MAX) : undefined;

  return {
    streamerName,
    platform,
    channelKey,
    channelUrl,
    games,
    tags,
    ...(riotId ? { riotId } : {})
  };
}

export type StreamerCommentDraft = {
  body: string;
  anonymous: boolean;
};

export function parseStreamerCommentDraft(value: unknown): StreamerCommentDraft | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const body = boundedText(record.body, STREAMER_COMMENT_MAX);
  if (!body) return undefined;
  return { body, anonymous: record.anonymous === true };
}

export function parseStreamerReportReason(value: unknown): StreamerReportReason | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const reason = (value as Record<string, unknown>).reason;
  return STREAMER_REPORT_REASONS.find((candidate) => candidate === reason);
}

export type StreamerListQuery = {
  game?: StreamerGame;
  search?: string;
  liveOnly: boolean;
  platforms: readonly StreamerPlatform[];
  sort: "votes" | "recent";
  channelKey?: string;
};

/** 목록 query 파싱. 모르는 값은 무시하고 기본값으로 떨어뜨립니다(400 을 내지 않습니다). */
export function parseStreamerListQuery(params: URLSearchParams): StreamerListQuery {
  const game = STREAMER_GAMES.find((candidate) => candidate === params.get("game"));
  const search = boundedText(params.get("q") ?? undefined, STREAMER_SEARCH_MAX);
  const platforms = STREAMER_PLATFORMS.filter((platform) => params.getAll("platform").includes(platform));
  const channelKeyParam = params.get("channel");
  const channelKey = channelKeyParam
    && channelKeyParam.length <= STREAMER_CHANNEL_KEY_MAX
    && streamerPlatformFromChannelKey(channelKeyParam)
    ? channelKeyParam
    : undefined;
  return {
    ...(game ? { game } : {}),
    ...(search ? { search } : {}),
    liveOnly: params.get("live") === "true",
    platforms,
    sort: params.get("sort") === "recent" ? "recent" : "votes",
    ...(channelKey ? { channelKey } : {})
  };
}

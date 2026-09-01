import { apiBase } from "../../../api/client";
import {
  parseStreamerPostDetail,
  parseStreamerPostList,
  type StreamerPlatform,
  type StreamerPostDetail,
  type StreamerPostList,
} from "../types/streamer-post";
import type { StreamerScope } from "../utils/routes";

/* 스트리머 추천 게시판 API.
 *
 * 서버 구현은 아직 handoff 대상입니다(prompts/codex-streamer-board-ko.txt).
 * 그래서 "아직 없음(404)" 과 "지금 안 됨(5xx·네트워크)" 을 구분해서 돌려줍니다 —
 * 둘을 같은 실패로 뭉치면 영원히 성공하지 않을 요청에 "잠시 후 다시 시도" 와
 * 재시도 버튼을 내밀게 됩니다. 어느 쪽이든 가짜 데이터는 만들지 않습니다.
 */

/** 404 는 배포에 그 경로가 없다는 뜻입니다 — 재시도로 해결되지 않습니다. */
export type StreamerApiFailure = "not_ready" | "error";

export type StreamerListQuery = {
  scope: StreamerScope;
  /** streamerChannelKey() 값. 채널 중복 조회에만 씁니다. */
  channelKey?: string;
  search?: string;
  liveOnly?: boolean;
  platforms?: readonly StreamerPlatform[];
  sort?: "votes" | "recent";
};

export type StreamerPostDraft = {
  streamerName: string;
  platform: StreamerPlatform;
  channelUrl: string;
  games: readonly string[];
  riotId?: string;
};

export type StreamerCommentDraft = {
  body: string;
  anonymous: boolean;
};

export type StreamerReportReason = "spam" | "abuse" | "off_topic" | "other";

/** 실패는 전부 undefined — 호출부가 화면 상태로 옮깁니다. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function listSearchParams(query: StreamerListQuery): string {
  const params = new URLSearchParams();
  if (query.scope !== "all") params.set("game", query.scope);
  if (query.channelKey) params.set("channel", query.channelKey);
  const search = query.search?.trim();
  if (search) params.set("q", search.slice(0, 60));
  if (query.liveOnly) params.set("live", "true");
  for (const platform of query.platforms ?? []) params.append("platform", platform);
  if (query.sort && query.sort !== "votes") params.set("sort", query.sort);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export type StreamerListResult =
  | { ok: true; list: StreamerPostList }
  | { ok: false; reason: StreamerApiFailure };

export async function fetchStreamerPosts(
  query: StreamerListQuery,
  signal?: AbortSignal,
): Promise<StreamerListResult> {
  try {
    const response = await fetch(`${apiBase}/api/public/streamers${listSearchParams(query)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (response.status === 404) return { ok: false, reason: "not_ready" };
    if (!response.ok) return { ok: false, reason: "error" };
    const list = parseStreamerPostList(await readJson(response));
    /* 200 인데 형식이 다르면 계약이 어긋난 것입니다 — 재시도할 값어치가 있습니다. */
    return list ? { ok: true, list } : { ok: false, reason: "error" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, reason: "error" };
  }
}

export type StreamerDetailResult =
  | { ok: true; detail: StreamerPostDetail }
  | { ok: false; reason: StreamerApiFailure };

export async function fetchStreamerPost(
  postId: string,
  signal?: AbortSignal,
): Promise<StreamerDetailResult> {
  try {
    const response = await fetch(`${apiBase}/api/public/streamers/${encodeURIComponent(postId)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    /* 글 상세의 404 는 "글이 없음" 일 수도 있습니다. 목록이 뜨는지로 갈립니다 —
       화면은 둘 다 "글을 찾을 수 없습니다" 로 닫으므로 여기서 나누지 않습니다. */
    if (response.status === 404) return { ok: false, reason: "not_ready" };
    if (!response.ok) return { ok: false, reason: "error" };
    const detail = parseStreamerPostDetail(await readJson(response));
    return detail ? { ok: true, detail } : { ok: false, reason: "error" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, reason: "error" };
  }
}

export async function fetchStreamerOfficialProfile(
  platform: StreamerPlatform,
  seoSlug: string,
  signal?: AbortSignal,
): Promise<StreamerDetailResult> {
  try {
    const response = await fetch(
      `${apiBase}/api/public/streamers/profile/${platform}/${encodeURIComponent(seoSlug)}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        ...(signal ? { signal } : {}),
      },
    );
    if (response.status === 404) return { ok: false, reason: "not_ready" };
    if (!response.ok) return { ok: false, reason: "error" };
    const detail = parseStreamerPostDetail(await readJson(response));
    return detail ? { ok: true, detail } : { ok: false, reason: "error" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { ok: false, reason: "error" };
  }
}

/* 아래 네 개는 변경 요청이라 실패를 호출부가 구분해야 합니다(로그인 필요 vs 그 외).
 *
 * duplicate_channel 은 등록에만 나옵니다 — 같은 채널이 이미 올라와 있다는 뜻이고,
 * 서버가 그 글을 알려주면 화면이 "이미 등록된 글 보기" 로 연결합니다. */
export type StreamerMutationResult =
  | { ok: true }
  | { ok: false; reason: "login_required" | StreamerApiFailure }
  | { ok: false; reason: "duplicate_channel"; existing?: StreamerChannelOwner };

/** 중복 판정에 필요한 최소한만 받습니다 — 없으면 목록으로 안내합니다. */
export type StreamerChannelOwner = {
  postId: string;
  streamerName?: string;
};

function parseChannelOwner(value: unknown): StreamerChannelOwner | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const source = typeof record.existing === "object" && record.existing !== null
    ? record.existing as Record<string, unknown>
    : record;
  const postId = typeof source.postId === "string" ? source.postId.trim().slice(0, 64) : "";
  if (!postId) return undefined;
  const streamerName = typeof source.streamerName === "string" ? source.streamerName.trim().slice(0, 60) : "";
  return { postId, ...(streamerName ? { streamerName } : {}) };
}

async function mutate(path: string, body: unknown): Promise<StreamerMutationResult> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, reason: "login_required" };
    if (response.status === 409) {
      const existing = parseChannelOwner(await readJson(response));
      return { ok: false, reason: "duplicate_channel", ...(existing ? { existing } : {}) };
    }
    if (response.status === 404) return { ok: false, reason: "not_ready" };
    if (!response.ok) return { ok: false, reason: "error" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export function createStreamerPost(draft: StreamerPostDraft): Promise<StreamerMutationResult> {
  return mutate("/api/public/streamers", draft);
}

/* 등록 전 미리 알려주는 조회. 서버 409 가 최종 판정이고 이건 편의입니다 —
   조회에 실패하면(미구현·네트워크) 막지 않고 그대로 진행시킵니다. */
export async function lookupStreamerChannel(
  channelKey: string,
  signal?: AbortSignal,
): Promise<StreamerChannelOwner | null | undefined> {
  const result = await fetchStreamerPosts({ scope: "all", channelKey }, signal);
  if (!result.ok) return undefined;
  const post = result.list.posts[0];
  if (!post) return null;
  return { postId: post.id, streamerName: post.streamerName };
}

export function createStreamerComment(
  postId: string,
  draft: StreamerCommentDraft,
): Promise<StreamerMutationResult> {
  return mutate(`/api/public/streamers/${encodeURIComponent(postId)}/comments`, draft);
}

export function reportStreamerComment(
  postId: string,
  commentId: string,
  reason: StreamerReportReason,
): Promise<StreamerMutationResult> {
  return mutate(
    `/api/public/streamers/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/report`,
    { reason },
  );
}

export function voteStreamerPost(postId: string): Promise<StreamerMutationResult> {
  return mutate(`/api/public/streamers/${encodeURIComponent(postId)}/vote`, {});
}

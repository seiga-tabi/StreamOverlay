import { apiBase } from "../../../api/client";
import {
  parseStreamerPostDetail,
  parseStreamerPostList,
  type StreamerComment,
  type StreamerPlatform,
  type StreamerPostDetail,
  type StreamerPostList,
} from "../types/streamer-post";
import { parseStreamerComment } from "../types/streamer-post";
import type { StreamerScope } from "../utils/routes";

/* 스트리머 추천 게시판 API.
 *
 * 서버 구현은 handoff 대상이라, 미구현 배포(404)·네트워크 오류·형식을 벗어난
 * 응답을 모두 같은 실패로 봅니다. 목록은 "불러오지 못했습니다" 화면으로 닫고
 * 글쓰기·댓글·신고는 버튼을 비활성으로 남깁니다 — 가짜 데이터를 만들지 않습니다.
 */

export type StreamerListQuery = {
  scope: StreamerScope;
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
  reason: string;
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
  const search = query.search?.trim();
  if (search) params.set("q", search.slice(0, 60));
  if (query.liveOnly) params.set("live", "true");
  for (const platform of query.platforms ?? []) params.append("platform", platform);
  if (query.sort && query.sort !== "votes") params.set("sort", query.sort);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchStreamerPosts(
  query: StreamerListQuery,
  signal?: AbortSignal,
): Promise<StreamerPostList | undefined> {
  try {
    const response = await fetch(`${apiBase}/api/public/streamers${listSearchParams(query)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return undefined;
    return parseStreamerPostList(await readJson(response));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return undefined;
  }
}

export async function fetchStreamerPost(
  postId: string,
  signal?: AbortSignal,
): Promise<StreamerPostDetail | undefined> {
  try {
    const response = await fetch(`${apiBase}/api/public/streamers/${encodeURIComponent(postId)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return undefined;
    return parseStreamerPostDetail(await readJson(response));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return undefined;
  }
}

/* 아래 세 개는 변경 요청이라 실패를 호출부가 구분해야 합니다(로그인 필요 vs 그 외). */
export type StreamerMutationResult =
  | { ok: true }
  | { ok: false; reason: "login_required" | "unavailable" };

async function mutate(path: string, body: unknown): Promise<StreamerMutationResult> {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, reason: "login_required" };
    if (!response.ok) return { ok: false, reason: "unavailable" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function createStreamerPost(draft: StreamerPostDraft): Promise<StreamerMutationResult> {
  return mutate("/api/public/streamers", draft);
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

/** 낙관적 렌더용 — 서버가 돌려준 댓글이 없을 때는 목록을 다시 부릅니다. */
export function parseCreatedComment(value: unknown): StreamerComment | undefined {
  return parseStreamerComment(value);
}

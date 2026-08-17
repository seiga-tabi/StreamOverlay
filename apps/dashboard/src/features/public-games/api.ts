import { apiBase } from "../../api/client";

/* 반응속도 기록 등록·리더보드·공유 계약 — 목업 reaction-test.html v5 §④-2.
 * 서버 구현은 Codex handoff(prompts/codex-games-records-ko.txt) 대상이며,
 * 프런트는 fail-closed 로 동작합니다: 리더보드 조회가 실패하면(미구현 404 포함)
 * 기록 등록·리더보드 UI 전체를 렌더하지 않습니다 — 로컬 게임·기록은 영향 없음. */

export type ReactionLeaderboardEntry = {
  rank: number;
  /** identity "public" 이면 표시 이름, "anonymous" 면 없음. */
  displayName?: string;
  /** 익명 표기용 고정 번호 라벨(예: "#4821"). */
  anonymousLabel?: string;
  avatarUrl?: string;
  averageMs: number;
  tierKey?: string;
};

export type ReactionLeaderboard = {
  entries: ReactionLeaderboardEntry[];
  /** 로그인 사용자의 내 기록(있을 때만) — 순위권 밖이어도 옵니다. */
  me?: ReactionLeaderboardEntry & { shareId?: string; identity?: "public" | "anonymous" };
  /** 랭킹 페이지 확장분(v6) — 서버 미지원 배포에서는 생략될 수 있습니다. */
  total?: number;
  tierDistribution?: Array<{ tierKey: string; count: number }>;
};

export type ReactionRecordSubmission = {
  averageMs: number;
  samples: number[];
  identity: "public" | "anonymous";
};

export type ReactionRecordResult = {
  shareId: string;
  rank?: number;
  percentile?: number;
};

export type ReactionSharedRecord = {
  averageMs: number;
  tierKey?: string;
  /** 익명 기록이면 서버가 이름 없이 내려줍니다. */
  displayName?: string;
  anonymousLabel?: string;
  percentile?: number;
  at?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 실패(미구현·네트워크·비정상 응답)는 null — 호출부가 기능 전체를 숨깁니다. */
export async function fetchReactionLeaderboard(limit?: number): Promise<ReactionLeaderboard | null> {
  try {
    const query = limit !== undefined ? `?limit=${limit}` : "";
    const response = await fetch(`${apiBase}/api/games/reaction/leaderboard${query}`, { credentials: "include" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.entries)) return null;
    return body as ReactionLeaderboard;
  } catch {
    return null;
  }
}

export async function submitReactionRecord(submission: ReactionRecordSubmission): Promise<ReactionRecordResult> {
  const response = await fetch(`${apiBase}/api/games/reaction/records`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(submission)
  });
  if (!response.ok) throw new Error(`record submit failed: ${response.status}`);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.shareId !== "string") throw new Error("record submit: invalid response");
  return body as ReactionRecordResult;
}

export async function deleteMyReactionRecord(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBase}/api/games/reaction/records/me`, {
      method: "DELETE",
      credentials: "include"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function fetchSharedReactionRecord(shareId: string): Promise<ReactionSharedRecord | null> {
  try {
    const response = await fetch(`${apiBase}/api/games/reaction/records/${encodeURIComponent(shareId)}`);
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.averageMs !== "number") return null;
    return body as ReactionSharedRecord;
  } catch {
    return null;
  }
}

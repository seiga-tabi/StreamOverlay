import { randomInt, randomUUID } from "node:crypto";
import { SafeDatabaseError } from "../errors.js";
import { requireUuid } from "../tenant-context.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

/* 반응속도 기록 저장 — 목업 docs/mockups/reaction-test.html v5 §④-2~④-5.
 *
 * 계정당 1행이고 "더 빠를 때만" 갱신합니다. identity(공개/익명)는 기록과 무관하게
 * 항상 갱신되는데, 공개 방식만 바꾸려는 요청이 기록 갱신 없이도 반영돼야 하기
 * 때문입니다.
 *
 * 공개 응답에는 계정 식별자를 절대 싣지 않습니다(§④-5). share_id·anonymous_no
 * 는 계정 정보에서 파생하지 않는 난수라 역추적되지 않습니다.
 */

export type ReactionIdentity = "public" | "anonymous";

export type ReactionRecordRow = {
  averageMs: number;
  identity: ReactionIdentity;
  anonymousNo: number;
  shareId: string;
  createdAt: string;
  updatedAt: string;
};

export type ReactionLeaderboardRow = ReactionRecordRow & {
  rank: number;
  userId: string;
  /* Twitch 표시 이름. 공개 기록에만 쓰고, 익명 기록에는 붙이지 않습니다.
     저장소에 이름을 복제해 두면 Twitch 에서 바꾼 이름이 리더보드에만 옛 값으로
     남으므로, 매 조회에서 external_identities 를 JOIN 해 최신값을 씁니다. */
  displayName?: string;
};

type DbRow = {
  average_ms: number;
  identity: ReactionIdentity;
  anonymous_no: number;
  share_id: string;
  created_at: Date;
  updated_at: Date;
};

type DbRankedRow = DbRow & { rank: string; user_id: string; display_name: string | null };

const SELECT_COLUMNS = "average_ms, identity, anonymous_no, share_id, created_at, updated_at";

/** 공유 링크 id — 불투명해야 하므로 계정 정보에서 파생하지 않습니다. */
function generateShareId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 22);
}

/** 익명 번호 "#4821" — 4자리 고정이라 목업 표기와 폭이 같습니다. */
function generateAnonymousNo(): number {
  return randomInt(1000, 10_000);
}

function toRecord(row: DbRow): ReactionRecordRow {
  return {
    averageMs: row.average_ms,
    identity: row.identity,
    anonymousNo: row.anonymous_no,
    shareId: row.share_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function requireRank(value: string): number {
  const rank = Number(value);
  if (!Number.isSafeInteger(rank) || rank < 1) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return rank;
}

export class ReactionRecordsRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  /** 상위 limit 명. 정렬은 빠른 순, 동률은 먼저 등록한 쪽이 위입니다. */
  async leaderboard(limit: number): Promise<ReactionLeaderboardRow[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    const result = await repositoryQuery<DbRankedRow>(
      this.queryable,
      `SELECT r.average_ms, r.identity, r.anonymous_no, r.share_id, r.created_at, r.updated_at,
              r.user_id::text AS user_id,
              RANK() OVER (ORDER BY r.average_ms ASC, r.created_at ASC)::text AS rank,
              twitch.display_name AS display_name
         FROM reaction_records r
         LEFT JOIN external_identities twitch
           ON twitch.user_id = r.user_id
          AND twitch.provider = 'twitch'
          AND twitch.revoked_at IS NULL
        ORDER BY r.average_ms ASC, r.created_at ASC
        LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => ({
      ...toRecord(row),
      rank: requireRank(row.rank),
      userId: row.user_id,
      ...(row.display_name ? { displayName: row.display_name } : {})
    }));
  }

  async findByUser(userId: string): Promise<(ReactionRecordRow & { rank: number; displayName?: string }) | undefined> {
    const result = await repositoryQuery<DbRow & { rank: string; display_name: string | null }>(
      this.queryable,
      `SELECT ranked.average_ms, ranked.identity, ranked.anonymous_no, ranked.share_id,
              ranked.created_at, ranked.updated_at, ranked.rank,
              twitch.display_name AS display_name
         FROM (
           SELECT ${SELECT_COLUMNS}, user_id,
                  RANK() OVER (ORDER BY average_ms ASC, created_at ASC)::text AS rank
             FROM reaction_records
         ) ranked
         LEFT JOIN external_identities twitch
           ON twitch.user_id = ranked.user_id
          AND twitch.provider = 'twitch'
          AND twitch.revoked_at IS NULL
        WHERE ranked.user_id = $1`,
      [requireUuid(userId, "userId")]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      ...toRecord(row),
      rank: requireRank(row.rank),
      ...(row.display_name ? { displayName: row.display_name } : {})
    };
  }

  async findByShareId(
    shareId: string
  ): Promise<(ReactionRecordRow & { rank: number; displayName?: string }) | undefined> {
    /* 형식이 안 맞으면 조회 자체를 하지 않습니다 — 조작된 값을 그대로 넘기지 않기 위함. */
    if (!/^[A-Za-z0-9_-]{8,64}$/u.test(shareId)) return undefined;
    const result = await repositoryQuery<DbRow & { rank: string; display_name: string | null }>(
      this.queryable,
      `SELECT ranked.average_ms, ranked.identity, ranked.anonymous_no, ranked.share_id,
              ranked.created_at, ranked.updated_at, ranked.rank,
              twitch.display_name AS display_name
         FROM (
           SELECT ${SELECT_COLUMNS}, user_id,
                  RANK() OVER (ORDER BY average_ms ASC, created_at ASC)::text AS rank
             FROM reaction_records
         ) ranked
         LEFT JOIN external_identities twitch
           ON twitch.user_id = ranked.user_id
          AND twitch.provider = 'twitch'
          AND twitch.revoked_at IS NULL
        WHERE ranked.share_id = $1`,
      [shareId]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      ...toRecord(row),
      rank: requireRank(row.rank),
      ...(row.display_name ? { displayName: row.display_name } : {})
    };
  }

  /** 전체 기록 수와 티어 계산에 쓸 average 분포용 원자료. */
  async stats(): Promise<{ total: number; averages: number[] }> {
    const result = await repositoryQuery<{ average_ms: number }>(
      this.queryable,
      "SELECT average_ms FROM reaction_records ORDER BY average_ms ASC",
      []
    );
    return { total: result.rows.length, averages: result.rows.map((row) => row.average_ms) };
  }

  /**
   * 등록/갱신. 기존보다 느린 기록은 average_ms·samples 를 남겨 두고 identity 만
   * 바꿉니다 — "공개 방식 변경"이 기록을 후퇴시키면 안 되기 때문입니다.
   * share_id·anonymous_no 는 최초 1회만 발급하고 이후 고정입니다(삭제 후
   * 재등록은 새 값이 되지만, 그 편이 삭제의 의미에 맞습니다).
   */
  async upsert(input: {
    userId: string;
    averageMs: number;
    samples: readonly number[];
    identity: ReactionIdentity;
  }): Promise<ReactionRecordRow & { rank: number }> {
    const result = await repositoryQuery<DbRow>(
      this.queryable,
      `INSERT INTO reaction_records (
         user_id, average_ms, samples, identity, anonymous_no, share_id
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         average_ms = LEAST(reaction_records.average_ms, EXCLUDED.average_ms),
         samples = CASE
           WHEN EXCLUDED.average_ms < reaction_records.average_ms THEN EXCLUDED.samples
           ELSE reaction_records.samples
         END,
         identity = EXCLUDED.identity,
         updated_at = NOW()
       RETURNING ${SELECT_COLUMNS}`,
      [
        requireUuid(input.userId, "userId"),
        input.averageMs,
        JSON.stringify([...input.samples]),
        input.identity,
        generateAnonymousNo(),
        generateShareId()
      ]
    );
    const row = result.rows[0];
    if (!row) throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    const ranked = await this.findByUser(input.userId);
    return ranked ?? { ...toRecord(row), rank: 1 };
  }

  /** 삭제된 뒤 공유 링크는 404 가 됩니다. */
  async deleteByUser(userId: string): Promise<boolean> {
    const result = await repositoryQuery<{ user_id: string }>(
      this.queryable,
      "DELETE FROM reaction_records WHERE user_id = $1 RETURNING user_id::text AS user_id",
      [requireUuid(userId, "userId")]
    );
    return result.rows.length > 0;
  }
}

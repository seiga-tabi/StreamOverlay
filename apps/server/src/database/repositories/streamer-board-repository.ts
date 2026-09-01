import { randomUUID } from "node:crypto";
import type { QueryResult } from "pg";
import {
  STREAMER_LIST_LIMIT,
  isStreamerPostId,
  type StreamerCommentDraft,
  type StreamerGame,
  type StreamerListQuery,
  type StreamerPlatform,
  type StreamerOfficialProfile,
  type StreamerOfficialProfileDraft,
  type StreamerPostDraft,
  type StreamerReportReason
} from "@streamops/shared";
import { SafeDatabaseError } from "../errors.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

/* 스트리머 추천 게시판 저장 — migration 0024_streamer_board.sql.
 *
 * 신원은 Twitch 사용자 id 입니다(users 행이 없는 공개 뷰어 세션도 글을 쓸 수
 * 있어야 하므로). 그 id 는 응답에 절대 싣지 않습니다 — 익명 댓글의 작성자가
 * 역추적되면 익명이 아닙니다.
 *
 * 채널 중복은 UNIQUE 제약이 판정합니다. 조회 후 삽입으로 막으면 두 사람이 동시에
 * 같은 채널을 올릴 때 둘 다 통과합니다.
 */

export type StreamerBoardPostRow = {
  id: string;
  channelKey: string;
  streamerName: string;
  platform: StreamerPlatform;
  channelUrl: string;
  games: readonly StreamerGame[];
  tags: readonly string[];
  riotId?: string;
  votes: number;
  commentCount: number;
  authorName: string;
  createdAt: string;
  /** 요청자가 이미 추천했는지. 로그인하지 않았으면 false 입니다. */
  voted: boolean;
  registeredByAdmin: boolean;
  officialProfile?: StreamerOfficialProfile;
  active: boolean;
};

export type StreamerBoardCommentRow = {
  id: string;
  authorName?: string;
  anonymous: boolean;
  body: string;
  createdAt: string;
};

export type StreamerBoardAuthor = {
  twitchUserId: string;
  displayName: string;
};

/** 같은 채널이 이미 있을 때 화면이 그 글로 안내할 수 있도록 최소한만 돌려줍니다. */
export type StreamerBoardChannelOwner = {
  postId: string;
  streamerName: string;
};

export class StreamerChannelTakenError extends Error {
  constructor(readonly existing: StreamerBoardChannelOwner) {
    super("channel already registered");
    this.name = "StreamerChannelTakenError";
  }
}

export class StreamerOfficialProfileTakenError extends Error {
  constructor(readonly existing: StreamerBoardChannelOwner) {
    super("official profile URL or channel already registered");
    this.name = "StreamerOfficialProfileTakenError";
  }
}

type PostDbRow = {
  id: string;
  channel_key: string;
  streamer_name: string;
  platform: StreamerPlatform;
  channel_url: string;
  games: string[];
  tags: string[];
  riot_id: string | null;
  vote_count: number;
  comment_count: number;
  author_display_name: string;
  created_at: Date;
  voted: boolean;
  registered_by_admin: boolean;
  official_handle: string | null;
  seo_slug: string | null;
  live_status_supported: boolean;
  active: boolean;
};

type CommentDbRow = {
  id: string;
  author_display_name: string;
  anonymous: boolean;
  body: string;
  created_at: Date;
};

const POST_FIELDS = `id, channel_key, streamer_name, platform, channel_url,
       games, tags, riot_id, vote_count, comment_count, author_display_name, created_at,
       registered_by_admin, official_handle, seo_slug, live_status_supported, active`;

/** 같은 열 목록의 별칭 붙은 형태. 두 곳이 어긋나면 조회가 조용히 열을 잃습니다. */
const POST_COLUMNS = POST_FIELDS.replaceAll(/\b(?=[a-z_]+\b)/gu, "p.");

/** 불투명 id — 경로에 노출되므로 계정 정보에서 파생하지 않습니다. */
function generateId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 22);
}

function requireTwitchUserId(value: string): string {
  /* Twitch 사용자 id 는 숫자 문자열입니다. 형식이 다르면 조회 자체를 하지 않습니다. */
  if (!/^\d{1,32}$/u.test(value)) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return value;
}

function requirePostId(value: string): string {
  if (!isStreamerPostId(value)) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return value;
}

function toPost(row: PostDbRow): StreamerBoardPostRow {
  return {
    id: row.id,
    channelKey: row.channel_key,
    streamerName: row.streamer_name,
    platform: row.platform,
    channelUrl: row.channel_url,
    games: row.games as StreamerGame[],
    tags: row.tags,
    ...(row.riot_id ? { riotId: row.riot_id } : {}),
    votes: row.vote_count,
    commentCount: row.comment_count,
    authorName: row.author_display_name,
    createdAt: row.created_at.toISOString(),
    voted: row.voted === true,
    registeredByAdmin: row.registered_by_admin === true,
    ...(row.registered_by_admin && row.official_handle && row.seo_slug
      ? {
          officialProfile: {
            handle: row.official_handle,
            seoSlug: row.seo_slug,
            liveStatusSupported: row.live_status_supported === true
          }
        }
      : {}),
    active: row.active === true
  };
}

function toComment(row: CommentDbRow): StreamerBoardCommentRow {
  return {
    id: row.id,
    /* 익명 댓글은 이름을 아예 싣지 않습니다 — 빈 문자열도 내보내지 않습니다. */
    ...(row.anonymous ? {} : { authorName: row.author_display_name }),
    anonymous: row.anonymous,
    body: row.body,
    createdAt: row.created_at.toISOString()
  };
}

export class StreamerBoardRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  /**
   * 목록. viewerTwitchUserId 가 있으면 각 글에 "내가 추천했는지"를 함께 표시합니다.
   *
   * 검색은 스트리머 이름과 태그만 봅니다 — 개인의 추천 이유는 글에 없습니다
   * (한 채널에 글이 하나라 여러 사람의 의견은 댓글로 모입니다).
   */
  async list(
    query: StreamerListQuery,
    viewerTwitchUserId?: string,
    liveChannelKeys: readonly string[] = []
  ): Promise<{ posts: StreamerBoardPostRow[]; total: number; liveCount: number }> {
    const viewer = viewerTwitchUserId ? requireTwitchUserId(viewerTwitchUserId) : null;
    const conditions: string[] = ["p.active = TRUE"];
    const values: unknown[] = [viewer];

    if (query.game) {
      values.push(query.game);
      conditions.push(`$${values.length}::TEXT = ANY(p.games)`);
    }
    if (query.platforms.length > 0) {
      values.push([...query.platforms]);
      conditions.push(`p.platform = ANY($${values.length}::TEXT[])`);
    }
    if (query.channelKey) {
      values.push(query.channelKey);
      conditions.push(`p.channel_key = $${values.length}`);
    }
    if (query.search) {
      /* LIKE 특수문자를 이스케이프해 "100%" 같은 검색어가 전체 일치로 번지지 않게 합니다. */
      const escaped = query.search.replace(/([\\%_])/gu, "\\$1");
      values.push(`%${escaped}%`);
      conditions.push(
        `(p.streamer_name ILIKE $${values.length} ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM unnest(p.tags) tag WHERE tag ILIKE $${values.length} ESCAPE '\\'))`
      );
    }
    if (query.liveOnly) {
      /* LIVE 는 DB 에 없는 값입니다(Twitch 실시간 조회 결과). 목록에서 걸러야 하므로
         호출부가 지금 방송 중인 채널 키를 넘겨 주고 여기서 좁힙니다. */
      values.push([...liveChannelKeys]);
      conditions.push(`p.channel_key = ANY($${values.length}::TEXT[])`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const order = query.sort === "recent"
      ? "p.created_at DESC"
      : "p.vote_count DESC, p.created_at DESC";
    values.push(STREAMER_LIST_LIMIT);

    const result = await repositoryQuery<PostDbRow & { total: string }>(
      this.queryable,
      `SELECT ${POST_COLUMNS},
              ($1::TEXT IS NOT NULL AND EXISTS (
                SELECT 1 FROM streamer_post_votes v
                 WHERE v.post_id = p.id AND v.voter_twitch_user_id = $1
              )) AS voted,
              COUNT(*) OVER ()::text AS total
         FROM streamer_posts p
         ${where}
        ORDER BY ${order}
        LIMIT $${values.length}`,
      values
    );

    const posts = result.rows.map(toPost);
    const total = Number(result.rows[0]?.total ?? "0");
    const liveKeys = new Set(liveChannelKeys);
    return {
      posts,
      total: Number.isSafeInteger(total) ? total : posts.length,
      liveCount: posts.filter((post) => liveKeys.has(post.channelKey)).length
    };
  }

  /**
   * 지금 방송 중인지 물어볼 Twitch 채널 목록. LIVE 는 DB 에 없는 값이라 매 요청
   * Twitch 에 묻는데, 게시판이 커져도 한 번에 묻는 양이 늘지 않도록 상한을 둡니다.
   */
  async twitchChannelKeys(limit = 300): Promise<string[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
      throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
    }
    const result = await repositoryQuery<{ channel_key: string }>(
      this.queryable,
      `SELECT channel_key FROM streamer_posts
        WHERE platform = 'twitch'
          AND active = TRUE
          AND (NOT registered_by_admin OR live_status_supported)
        ORDER BY vote_count DESC, created_at DESC
        LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => row.channel_key);
  }

  async findPost(postId: string, viewerTwitchUserId?: string): Promise<StreamerBoardPostRow | undefined> {
    if (!isStreamerPostId(postId)) return undefined;
    const viewer = viewerTwitchUserId ? requireTwitchUserId(viewerTwitchUserId) : null;
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `SELECT ${POST_COLUMNS},
              ($2::TEXT IS NOT NULL AND EXISTS (
                SELECT 1 FROM streamer_post_votes v
                 WHERE v.post_id = p.id AND v.voter_twitch_user_id = $2
              )) AS voted
         FROM streamer_posts p
        WHERE p.id = $1 AND p.active = TRUE`,
      [postId, viewer]
    );
    const row = result.rows[0];
    return row ? toPost(row) : undefined;
  }

  async findOfficialProfile(
    platform: StreamerPlatform,
    seoSlug: string,
    viewerTwitchUserId?: string
  ): Promise<StreamerBoardPostRow | undefined> {
    const viewer = viewerTwitchUserId ? requireTwitchUserId(viewerTwitchUserId) : null;
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `SELECT ${POST_COLUMNS},
              ($3::TEXT IS NOT NULL AND EXISTS (
                SELECT 1 FROM streamer_post_votes v
                 WHERE v.post_id = p.id AND v.voter_twitch_user_id = $3
              )) AS voted
         FROM streamer_posts p
        WHERE p.platform = $1 AND p.seo_slug = $2
          AND p.registered_by_admin = TRUE AND p.active = TRUE`,
      [platform, seoSlug, viewer]
    );
    const row = result.rows[0];
    return row ? toPost(row) : undefined;
  }

  async listOfficialProfiles(): Promise<StreamerBoardPostRow[]> {
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `SELECT ${POST_COLUMNS}, FALSE AS voted
         FROM streamer_posts p
        WHERE p.registered_by_admin = TRUE
        ORDER BY p.active DESC, p.updated_at DESC, p.created_at DESC
        LIMIT 500`,
      []
    );
    return result.rows.map(toPost);
  }

  async createOfficialProfile(draft: StreamerOfficialProfileDraft): Promise<StreamerBoardPostRow> {
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `INSERT INTO streamer_posts
         (id, channel_key, platform, channel_url, streamer_name, games, tags,
          author_twitch_user_id, author_display_name, registered_by_admin,
          official_handle, seo_slug, live_status_supported, active)
       VALUES ($1, $2, $3, $4, $5, $6::TEXT[], '{}', '0', 'YORO.gg',
               TRUE, $7, $8, $9, TRUE)
       ON CONFLICT DO NOTHING
       RETURNING ${POST_FIELDS}, FALSE AS voted`,
      [
        generateId(), draft.channelKey, draft.platform, draft.channelUrl,
        draft.streamerName, [...draft.games], draft.officialProfile.handle,
        draft.officialProfile.seoSlug, draft.officialProfile.liveStatusSupported
      ]
    );
    const row = result.rows[0];
    if (row) return toPost(row);
    throw await this.officialProfileTaken(draft.channelKey, draft.platform, draft.officialProfile.seoSlug);
  }

  async updateOfficialProfile(
    postId: string,
    draft: StreamerOfficialProfileDraft
  ): Promise<StreamerBoardPostRow | undefined> {
    const id = requirePostId(postId);
    let result: QueryResult<PostDbRow>;
    try {
      result = await repositoryQuery<PostDbRow>(
        this.queryable,
        `UPDATE streamer_posts p
            SET channel_key = $2, platform = $3, channel_url = $4, streamer_name = $5,
                games = $6::TEXT[], official_handle = $7, seo_slug = $8,
                live_status_supported = $9, updated_at = NOW()
          WHERE p.id = $1 AND p.registered_by_admin = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM streamer_posts other
               WHERE other.id <> p.id
                 AND (other.channel_key = $2 OR (
                   other.registered_by_admin = TRUE
                   AND other.platform = $3 AND other.seo_slug = $8
                 ))
            )
         RETURNING ${POST_FIELDS}, FALSE AS voted`,
        [
          id, draft.channelKey, draft.platform, draft.channelUrl, draft.streamerName,
          [...draft.games], draft.officialProfile.handle, draft.officialProfile.seoSlug,
          draft.officialProfile.liveStatusSupported
        ]
      );
    } catch (error) {
      /* NOT EXISTS 검사와 다른 트랜잭션의 삽입·수정 사이에 끼면 UNIQUE 제약이
         마지막 판정을 합니다. 그 경합은 다른 중복과 같은 409 이지 500 이 아닙니다. */
      if (error instanceof SafeDatabaseError && error.code === "DATABASE_CONFLICT") {
        throw await this.officialProfileTaken(draft.channelKey, draft.platform, draft.officialProfile.seoSlug);
      }
      throw error;
    }
    const row = result.rows[0];
    if (row) return toPost(row);
    const current = await repositoryQuery<{ exists: boolean }>(
      this.queryable,
      "SELECT EXISTS(SELECT 1 FROM streamer_posts WHERE id = $1 AND registered_by_admin = TRUE) AS exists",
      [id]
    );
    if (current.rows[0]?.exists) {
      throw await this.officialProfileTaken(draft.channelKey, draft.platform, draft.officialProfile.seoSlug);
    }
    return undefined;
  }

  async deactivateOfficialProfile(postId: string): Promise<StreamerBoardPostRow | undefined> {
    const id = requirePostId(postId);
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `UPDATE streamer_posts p SET active = FALSE, updated_at = NOW()
        WHERE p.id = $1 AND p.registered_by_admin = TRUE AND p.active = TRUE
       RETURNING ${POST_FIELDS}, FALSE AS voted`,
      [id]
    );
    const row = result.rows[0];
    return row ? toPost(row) : undefined;
  }

  /** 비활성화의 반대. 이미 활성이거나 공식 프로필이 아니면 undefined — 라우트가 404 로 옮깁니다. */
  async reactivateOfficialProfile(postId: string): Promise<StreamerBoardPostRow | undefined> {
    const id = requirePostId(postId);
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `UPDATE streamer_posts p SET active = TRUE, updated_at = NOW()
        WHERE p.id = $1 AND p.registered_by_admin = TRUE AND p.active = FALSE
       RETURNING ${POST_FIELDS}, FALSE AS voted`,
      [id]
    );
    const row = result.rows[0];
    return row ? toPost(row) : undefined;
  }

  private async officialProfileTaken(
    channelKey: string,
    platform: StreamerPlatform,
    seoSlug: string
  ): Promise<StreamerOfficialProfileTakenError> {
    const existing = await repositoryQuery<{ id: string; streamer_name: string }>(
      this.queryable,
      `SELECT id, streamer_name FROM streamer_posts
        WHERE channel_key = $1 OR (registered_by_admin = TRUE AND platform = $2 AND seo_slug = $3)
        ORDER BY registered_by_admin DESC LIMIT 1`,
      [channelKey, platform, seoSlug]
    );
    return new StreamerOfficialProfileTakenError({
      postId: existing.rows[0]?.id ?? "",
      streamerName: existing.rows[0]?.streamer_name ?? ""
    });
  }

  async comments(postId: string): Promise<StreamerBoardCommentRow[]> {
    if (!isStreamerPostId(postId)) return [];
    const result = await repositoryQuery<CommentDbRow>(
      this.queryable,
      `SELECT id, author_display_name, anonymous, body, created_at
         FROM streamer_comments c
        WHERE c.post_id = $1
          AND EXISTS (SELECT 1 FROM streamer_posts p WHERE p.id = c.post_id AND p.active = TRUE)
        ORDER BY created_at ASC
        LIMIT 200`,
      [postId]
    );
    return result.rows.map(toComment);
  }

  /** 이미 등록된 채널이면 StreamerChannelTakenError. 판정은 UNIQUE 제약이 합니다. */
  async createPost(draft: StreamerPostDraft, author: StreamerBoardAuthor): Promise<StreamerBoardPostRow> {
    const authorId = requireTwitchUserId(author.twitchUserId);
    const result = await repositoryQuery<PostDbRow>(
      this.queryable,
      `INSERT INTO streamer_posts
         (id, channel_key, platform, channel_url, streamer_name, games, tags, riot_id,
          author_twitch_user_id, author_display_name)
       VALUES ($1, $2, $3, $4, $5, $6::TEXT[], $7::TEXT[], $8, $9, $10)
       ON CONFLICT (channel_key) DO NOTHING
       RETURNING ${POST_FIELDS}, FALSE AS voted`,
      [
        generateId(),
        draft.channelKey,
        draft.platform,
        draft.channelUrl,
        draft.streamerName,
        [...draft.games],
        [...draft.tags],
        draft.riotId ?? null,
        authorId,
        author.displayName
      ]
    );
    const row = result.rows[0];
    if (row) return toPost(row);

    /* DO NOTHING 이 걸렸다는 것은 그 채널이 이미 있다는 뜻입니다. */
    const existing = await repositoryQuery<{ id: string; streamer_name: string }>(
      this.queryable,
      "SELECT id, streamer_name FROM streamer_posts WHERE channel_key = $1",
      [draft.channelKey]
    );
    const owner = existing.rows[0];
    throw new StreamerChannelTakenError({
      postId: owner?.id ?? "",
      streamerName: owner?.streamer_name ?? ""
    });
  }

  /** 추천은 계정당 1회. 이미 눌렀으면 아무 일도 일어나지 않습니다(에러가 아닙니다). */
  async vote(postId: string, voterTwitchUserId: string): Promise<{ votes: number } | undefined> {
    const id = requirePostId(postId);
    const voter = requireTwitchUserId(voterTwitchUserId);
    const inserted = await repositoryQuery<{ post_id: string }>(
      this.queryable,
      `INSERT INTO streamer_post_votes (post_id, voter_twitch_user_id)
       SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM streamer_posts WHERE id = $1 AND active = TRUE)
       ON CONFLICT DO NOTHING
       RETURNING post_id`,
      [id, voter]
    );
    if (inserted.rows.length === 0) {
      /* 이미 눌렀거나 글이 없습니다 — 현재 값을 그대로 돌려줍니다. */
      const current = await repositoryQuery<{ vote_count: number }>(
        this.queryable,
        "SELECT vote_count FROM streamer_posts WHERE id = $1 AND active = TRUE",
        [id]
      );
      const row = current.rows[0];
      return row ? { votes: row.vote_count } : undefined;
    }
    const updated = await repositoryQuery<{ vote_count: number }>(
      this.queryable,
      "UPDATE streamer_posts SET vote_count = vote_count + 1, updated_at = NOW() WHERE id = $1 RETURNING vote_count",
      [id]
    );
    const row = updated.rows[0];
    return row ? { votes: row.vote_count } : undefined;
  }

  async createComment(
    postId: string,
    draft: StreamerCommentDraft,
    author: StreamerBoardAuthor
  ): Promise<StreamerBoardCommentRow | undefined> {
    const id = requirePostId(postId);
    const authorId = requireTwitchUserId(author.twitchUserId);
    const result = await repositoryQuery<CommentDbRow>(
      this.queryable,
      `INSERT INTO streamer_comments
         (id, post_id, author_twitch_user_id, author_display_name, anonymous, body)
       SELECT $1, $2, $3, $4, $5, $6 WHERE EXISTS (SELECT 1 FROM streamer_posts WHERE id = $2 AND active = TRUE)
       RETURNING id, author_display_name, anonymous, body, created_at`,
      [generateId(), id, authorId, author.displayName, draft.anonymous, draft.body]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    await repositoryQuery(
      this.queryable,
      "UPDATE streamer_posts SET comment_count = comment_count + 1, updated_at = NOW() WHERE id = $1",
      [id]
    );
    return toComment(row);
  }

  /** 같은 댓글은 계정당 1회만 접수합니다. 두 번째부터는 조용히 무시합니다. */
  async reportComment(
    postId: string,
    commentId: string,
    reason: StreamerReportReason,
    reporterTwitchUserId: string
  ): Promise<boolean> {
    const post = requirePostId(postId);
    const comment = requirePostId(commentId);
    const reporter = requireTwitchUserId(reporterTwitchUserId);
    const inserted = await repositoryQuery<{ comment_id: string }>(
      this.queryable,
      `INSERT INTO streamer_comment_reports (comment_id, reporter_twitch_user_id, reason)
       SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM streamer_comments WHERE id = $1 AND post_id = $4)
       ON CONFLICT DO NOTHING
       RETURNING comment_id`,
      [comment, reporter, reason, post]
    );
    if (inserted.rows.length === 0) {
      /* 없는 댓글인지, 이미 신고한 것인지 구분해 알려 주지 않습니다 —
         신고 여부가 새면 다른 사람의 신고를 떠볼 수 있습니다. */
      const exists = await repositoryQuery<{ id: string }>(
        this.queryable,
        "SELECT id FROM streamer_comments WHERE id = $1 AND post_id = $2",
        [comment, post]
      );
      return exists.rows.length > 0;
    }
    await repositoryQuery(
      this.queryable,
      "UPDATE streamer_comments SET report_count = report_count + 1 WHERE id = $1",
      [comment]
    );
    return true;
  }
}

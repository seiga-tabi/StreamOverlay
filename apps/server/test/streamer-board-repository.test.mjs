import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/* 저장소 SQL 계약 — migration 0024_streamer_board.sql 을 실제로 적용해서 봅니다.
 *
 * 여기서만 확인할 수 있는 것들이 있습니다: UNIQUE 제약이 동시 등록을 실제로 막는지,
 * CHECK 제약이 서버 검증과 같은 경계인지, 배열 필터와 ILIKE 검색이 의도대로 좁히는지.
 * 대역으로는 전부 통과하지만 배포에서 터지는 것들입니다.
 *
 * 기본으로는 건너뜁니다 — CI 와 다른 사람의 기계에 Postgres 가 있다고 가정하지
 * 않습니다. 실행하려면 빈 DB 를 가리키는 URL 을 주세요(테이블을 새로 만듭니다):
 *
 *   STREAMER_BOARD_TEST_DATABASE_URL=postgres://localhost/scratch_db \
 *     node --test apps/server/test/streamer-board-repository.test.mjs
 */

const DATABASE_URL = process.env.STREAMER_BOARD_TEST_DATABASE_URL;

if (!DATABASE_URL) {
  test.skip("저장소 SQL — STREAMER_BOARD_TEST_DATABASE_URL 이 없어 건너뜁니다", () => {});
} else {
  const { Pool } = await import("pg");
  const { StreamerBoardRepository, StreamerChannelTakenError } =
    await import("../dist/database/repositories/streamer-board-repository.js");

  const migration = await readFile(fileURLToPath(new URL("../migrations/0024_streamer_board.sql", import.meta.url)), "utf8");
  const officialProfilesMigration = await readFile(fileURLToPath(new URL("../migrations/0026_streamer_official_profiles.sql", import.meta.url)), "utf8");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const board = new StreamerBoardRepository(pool);

  const AUTHOR = { twitchUserId: "4211", displayName: "쿠키맛젤리" };
  const OTHER = { twitchUserId: "8899", displayName: "눈사람공장" };

  function draft(overrides = {}) {
    return {
      streamerName: "밤톨",
      platform: "twitch",
      channelKey: "twitch:bamtol",
      channelUrl: "https://www.twitch.tv/bamtol",
      games: ["lol"],
      tags: ["칼바람 나락"],
      ...overrides,
    };
  }

  const listAll = { liveOnly: false, platforms: [], sort: "votes" };

  test.before(async () => {
    await pool.query(migration);
    await pool.query(officialProfilesMigration);
  });

  test.after(async () => {
    await pool.query(`DROP TABLE IF EXISTS streamer_comment_reports, streamer_comments,
                                          streamer_post_votes, streamer_posts CASCADE`);
    await pool.end();
  });

  test("한 채널은 글 하나 — 두 번째 등록은 그 글을 알려 주며 막힌다", async () => {
    const created = await board.createPost(draft(), AUTHOR);
    assert.equal(created.streamerName, "밤톨");
    assert.equal(created.votes, 0);
    assert.equal(created.voted, false);

    /* 표기가 달라도 채널 키가 같으면 같은 채널입니다(정규화는 shared 가 합니다). */
    await assert.rejects(
      () => board.createPost(draft({ streamerName: "다른이름" }), OTHER),
      (error) => {
        assert.ok(error instanceof StreamerChannelTakenError);
        assert.equal(error.existing.postId, created.id);
        assert.equal(error.existing.streamerName, "밤톨");
        return true;
      }
    );

    const list = await board.list(listAll);
    assert.equal(list.total, 1, "중복 시도가 글을 늘리지 않았습니다");
  });

  test("동시에 같은 채널을 올려도 하나만 성공한다", async () => {
    /* 조회 후 삽입으로 막으면 여기서 둘 다 통과합니다 — UNIQUE 제약이 판정합니다. */
    const attempts = await Promise.allSettled([
      board.createPost(draft({ channelKey: "twitch:race", channelUrl: "https://www.twitch.tv/race" }), AUTHOR),
      board.createPost(draft({ channelKey: "twitch:race", channelUrl: "https://www.twitch.tv/race" }), OTHER),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
  });

  test("추천은 계정당 1회고, 다시 눌러도 늘지 않는다", async () => {
    const post = await board.createPost(
      draft({ channelKey: "twitch:vote", channelUrl: "https://www.twitch.tv/vote" }),
      AUTHOR
    );
    assert.deepEqual(await board.vote(post.id, AUTHOR.twitchUserId), { votes: 1 });
    assert.deepEqual(await board.vote(post.id, AUTHOR.twitchUserId), { votes: 1 }, "같은 계정의 재투표");
    assert.deepEqual(await board.vote(post.id, OTHER.twitchUserId), { votes: 2 });

    /* 누른 사람에게만 눌린 것으로 보여야 합니다. */
    assert.equal((await board.findPost(post.id, AUTHOR.twitchUserId))?.voted, true);
    assert.equal((await board.findPost(post.id, "1234"))?.voted, false);
    assert.equal((await board.findPost(post.id))?.voted, false, "비로그인");

    /* 없는 글에 대한 투표는 undefined — 라우트가 404 로 옮깁니다. */
    assert.equal(await board.vote("nosuchpost", AUTHOR.twitchUserId), undefined);
  });

  test("댓글은 수를 함께 늘리고, 익명 댓글은 이름을 내보내지 않는다", async () => {
    const post = await board.createPost(
      draft({ channelKey: "twitch:talk", channelUrl: "https://www.twitch.tv/talk" }),
      AUTHOR
    );
    const named = await board.createComment(post.id, { body: "설명이 좋았습니다.", anonymous: false }, AUTHOR);
    const hidden = await board.createComment(post.id, { body: "익명으로 남깁니다.", anonymous: true }, OTHER);
    assert.equal(named?.authorName, "쿠키맛젤리");
    assert.equal(hidden?.authorName, undefined);
    assert.equal(hidden?.anonymous, true);

    assert.equal((await board.findPost(post.id))?.commentCount, 2);
    assert.equal((await board.comments(post.id)).length, 2);

    /* 없는 글에는 댓글이 달리지 않습니다. */
    assert.equal(await board.createComment("nosuchpost", { body: "x", anonymous: false }, AUTHOR), undefined);
  });

  test("같은 댓글 신고는 계정당 1회만 센다", async () => {
    const post = await board.createPost(
      draft({ channelKey: "twitch:report", channelUrl: "https://www.twitch.tv/report" }),
      AUTHOR
    );
    const comment = await board.createComment(post.id, { body: "광고입니다.", anonymous: false }, OTHER);
    assert.ok(comment);

    assert.equal(await board.reportComment(post.id, comment.id, "spam", AUTHOR.twitchUserId), true);
    assert.equal(await board.reportComment(post.id, comment.id, "spam", AUTHOR.twitchUserId), true, "중복 신고도 접수로 답합니다");
    const counted = await pool.query("SELECT report_count FROM streamer_comments WHERE id = $1", [comment.id]);
    assert.equal(counted.rows[0].report_count, 1, "중복 신고가 숫자를 부풀리면 안 됩니다");

    /* 다른 글의 댓글로 신고를 밀어 넣을 수 없습니다. */
    assert.equal(await board.reportComment("nosuchpost", comment.id, "spam", OTHER.twitchUserId), false);
  });

  test("필터와 검색은 의도한 글만 남긴다", async () => {
    await board.createPost(draft({
      channelKey: "chzzk:hangyeoul",
      channelUrl: "https://chzzk.naver.com/hangyeoul",
      platform: "chzzk",
      streamerName: "한겨울",
      games: ["palworld"],
      tags: ["건축"],
    }), OTHER);

    const palworld = await board.list({ ...listAll, game: "palworld" });
    assert.deepEqual(palworld.posts.map((post) => post.streamerName), ["한겨울"]);

    const chzzk = await board.list({ ...listAll, platforms: ["chzzk"] });
    assert.deepEqual(chzzk.posts.map((post) => post.platform), ["chzzk"]);

    /* 검색은 이름과 태그를 봅니다 — 개인의 추천 이유는 글에 없습니다. */
    assert.equal((await board.list({ ...listAll, search: "한겨" })).posts.length, 1);
    assert.equal((await board.list({ ...listAll, search: "건축" })).posts.length, 1);
    assert.equal((await board.list({ ...listAll, search: "없는말" })).posts.length, 0);

    /* LIKE 특수문자가 전체 일치로 번지면 안 됩니다. */
    assert.equal((await board.list({ ...listAll, search: "%" })).posts.length, 0);
    assert.equal((await board.list({ ...listAll, search: "_" })).posts.length, 0);

    /* 채널 조회는 그 채널만(중복 등록 사전 안내가 쓰는 경로). */
    const byChannel = await board.list({ ...listAll, channelKey: "chzzk:hangyeoul" });
    assert.equal(byChannel.posts.length, 1);
    assert.equal((await board.list({ ...listAll, channelKey: "twitch:nobody" })).posts.length, 0);

    /* LIVE 는 DB 에 없는 값이라 호출부가 넘긴 목록으로만 좁힙니다. */
    const live = await board.list({ ...listAll, liveOnly: true }, undefined, ["twitch:bamtol"]);
    assert.deepEqual(live.posts.map((post) => post.channelKey), ["twitch:bamtol"]);
    assert.equal(live.liveCount, 1);
    assert.equal((await board.list({ ...listAll, liveOnly: true }, undefined, [])).posts.length, 0);
  });

  test("DB 제약은 서버 검증과 같은 경계다", async () => {
    /* 서버 검증을 우회한 값이 들어와도 저장에서 막혀야 합니다. */
    await assert.rejects(() => pool.query(
      `INSERT INTO streamer_posts (id, channel_key, platform, channel_url, streamer_name, games,
                                   author_twitch_user_id, author_display_name)
       VALUES ('bad', 'twitch:x', 'kick', 'https://kick.com/x', 'x', ARRAY['lol'], '1', 'a')`
    ), /streamer_posts_platform_check/u);

    await assert.rejects(() => pool.query(
      `INSERT INTO streamer_posts (id, channel_key, platform, channel_url, streamer_name, games,
                                   author_twitch_user_id, author_display_name)
       VALUES ('bad2', 'twitch:y', 'twitch', 'https://www.twitch.tv/y', 'y', ARRAY['chess'], '1', 'a')`
    ), /streamer_posts_games_check/u);

    await assert.rejects(() => pool.query(
      `INSERT INTO streamer_posts (id, channel_key, platform, channel_url, streamer_name, games,
                                   author_twitch_user_id, author_display_name)
       VALUES ('bad3', 'twitch:z', 'twitch', 'http://www.twitch.tv/z', 'z', ARRAY['lol'], '1', 'a')`
    ), /streamer_posts_channel_url_check/u);

    await assert.rejects(() => pool.query(
      `INSERT INTO streamer_posts (id, channel_key, platform, channel_url, streamer_name, games,
                                   author_twitch_user_id, author_display_name)
       VALUES ('Bad-ID!', 'twitch:w', 'twitch', 'https://www.twitch.tv/w', 'w', ARRAY['lol'], '1', 'a')`
    ), /streamer_posts_id_check/u);
  });

  test("글을 지우면 딸린 추천·댓글·신고가 함께 사라진다", async () => {
    const post = await board.createPost(
      draft({ channelKey: "twitch:cascade", channelUrl: "https://www.twitch.tv/cascade" }),
      AUTHOR
    );
    const comment = await board.createComment(post.id, { body: "지워질 댓글", anonymous: false }, AUTHOR);
    await board.vote(post.id, AUTHOR.twitchUserId);
    await board.reportComment(post.id, comment.id, "spam", OTHER.twitchUserId);

    await pool.query("DELETE FROM streamer_posts WHERE id = $1", [post.id]);
    for (const table of ["streamer_post_votes", "streamer_comments"]) {
      const left = await pool.query(`SELECT 1 FROM ${table} WHERE post_id = $1`, [post.id]);
      assert.equal(left.rowCount, 0, table);
    }
    const reports = await pool.query("SELECT 1 FROM streamer_comment_reports WHERE comment_id = $1", [comment.id]);
    assert.equal(reports.rowCount, 0, "주인 없는 신고가 남으면 안 됩니다");
  });
}

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
  const { StreamerBoardRepository, StreamerChannelTakenError, StreamerOfficialProfileTakenError } =
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

  /* 관리자 등록 공식 프로필 초안 — handle 하나로 채널 키·URL·slug 를 함께 맞춥니다. */
  function officialDraft(handle, overrides = {}) {
    return {
      streamerName: `${handle} 공식`,
      platform: "twitch",
      channelKey: `twitch:${handle}`,
      channelUrl: `https://www.twitch.tv/${handle}`,
      games: ["lol"],
      officialProfile: { handle, seoSlug: handle, liveStatusSupported: true },
      ...overrides,
    };
  }

  function expectOfficialTaken(expectedPostId) {
    return (error) => {
      assert.ok(error instanceof StreamerOfficialProfileTakenError, String(error));
      assert.equal(error.existing.postId, expectedPostId);
      return true;
    };
  }

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

  test("공식 프로필은 만들고 고치고 끄고 다시 켤 수 있다", async () => {
    const created = await board.createOfficialProfile(officialDraft("official", { riotId: "Official#KR1" }));
    assert.equal(created.registeredByAdmin, true);
    assert.equal(created.active, true);
    assert.equal(created.authorName, "YORO.gg");
    assert.equal(created.riotId, "Official#KR1");
    assert.deepEqual(created.officialProfile, { handle: "official", seoSlug: "official", liveStatusSupported: true });
    assert.equal((await board.findOfficialProfile("twitch", "official"))?.id, created.id);

    const updated = await board.updateOfficialProfile(created.id, officialDraft("official", {
      streamerName: "새 이름",
      games: ["palworld"],
      officialProfile: { handle: "official", seoSlug: "official", liveStatusSupported: false },
    }));
    assert.equal(updated?.streamerName, "새 이름");
    assert.deepEqual(updated?.games, ["palworld"]);
    assert.equal(updated?.riotId, undefined, "LoL을 빼면 공식 프로필의 Riot ID도 비웁니다");
    assert.equal(updated?.officialProfile?.liveStatusSupported, false);
    assert.equal(await board.updateOfficialProfile("nosuchpost", officialDraft("nosuch")), undefined, "없는 글은 undefined — 라우트가 404 로 옮깁니다");

    const deactivated = await board.deactivateOfficialProfile(created.id);
    assert.equal(deactivated?.active, false);
    assert.equal(await board.findOfficialProfile("twitch", "official"), undefined, "꺼진 프로필은 공개 URL 에서 사라집니다");
    assert.equal(await board.deactivateOfficialProfile(created.id), undefined, "이미 꺼진 프로필은 다시 끌 수 없습니다");
    assert.ok(
      (await board.listOfficialProfiles()).some((post) => post.id === created.id && post.active === false),
      "관리자 목록에는 꺼진 프로필도 남습니다"
    );

    const reactivated = await board.reactivateOfficialProfile(created.id);
    assert.equal(reactivated?.active, true);
    assert.equal((await board.findOfficialProfile("twitch", "official"))?.id, created.id);
    assert.equal(await board.reactivateOfficialProfile(created.id), undefined, "이미 켜진 프로필은 다시 켤 수 없습니다");

    /* 추천 글은 공식 프로필 API 로 만질 수 없습니다. */
    const community = await board.createPost(
      draft({ channelKey: "twitch:community", channelUrl: "https://www.twitch.tv/community" }),
      AUTHOR
    );
    assert.equal(await board.deactivateOfficialProfile(community.id), undefined);
    assert.equal(await board.reactivateOfficialProfile(community.id), undefined);
    assert.equal(await board.updateOfficialProfile(community.id, officialDraft("community")), undefined);
  });

  test("시청자 추천 글은 공식 프로필로 승격되고 참여 데이터와 기존 Riot ID를 보존한다", async () => {
    const community = await board.createPost(
      draft({
        channelKey: "twitch:promoted",
        channelUrl: "https://www.twitch.tv/promoted",
        streamerName: "승격 전 이름",
        riotId: "Viewer#KR1",
      }),
      AUTHOR
    );
    await board.vote(community.id, AUTHOR.twitchUserId);
    await board.vote(community.id, OTHER.twitchUserId);
    await board.createComment(community.id, { body: "첫 댓글", anonymous: false }, AUTHOR);
    await board.createComment(community.id, { body: "둘째 댓글", anonymous: true }, OTHER);

    const promoted = await board.createOfficialProfile(officialDraft("promoted", {
      streamerName: "승격 후 공식 이름",
    }));
    assert.equal(promoted.id, community.id, "새 행 대신 기존 추천 글을 승격합니다");
    assert.equal(promoted.registeredByAdmin, true);
    assert.equal(promoted.streamerName, "승격 후 공식 이름");
    assert.deepEqual(promoted.tags, ["칼바람 나락"]);
    assert.equal(promoted.riotId, "Viewer#KR1", "관리자가 비워 둔 Riot ID는 기존 값을 보존합니다");
    assert.equal(promoted.votes, 2);
    assert.equal(promoted.commentCount, 2);
    assert.equal(promoted.authorName, "YORO.gg", "승격 후에는 시청자가 아닌 공식 작성자로 바뀝니다");

    await assert.rejects(
      () => board.createOfficialProfile(officialDraft("promoted")),
      expectOfficialTaken(community.id)
    );

    const communityWithOverride = await board.createPost(
      draft({
        channelKey: "twitch:promoted-override",
        channelUrl: "https://www.twitch.tv/promoted-override",
        riotId: "ViewerOld#KR1",
      }),
      AUTHOR
    );
    const overridden = await board.createOfficialProfile(officialDraft("promoted-override", {
      riotId: "AdminNew#JP1",
    }));
    assert.equal(overridden.id, communityWithOverride.id);
    assert.equal(overridden.riotId, "AdminNew#JP1", "관리자가 입력한 Riot ID는 기존 값을 대체합니다");
  });

  test("공식 URL 과 채널은 겹칠 수 없고, 꺼진 프로필의 URL 도 예약이 유지된다", async () => {
    const first = await board.createOfficialProfile(officialDraft("slug-a"));

    /* 같은 공식 URL(platform + seo_slug) — 채널이 달라도 막힙니다. */
    await assert.rejects(
      () => board.createOfficialProfile(officialDraft("slug-a", {
        channelKey: "twitch:slug-a-other",
        channelUrl: "https://www.twitch.tv/slug-a-other",
      })),
      expectOfficialTaken(first.id)
    );

    /* 수정으로 다른 공식 프로필의 URL 을 가져갈 수 없습니다. */
    const second = await board.createOfficialProfile(officialDraft("slug-b"));
    await assert.rejects(
      () => board.updateOfficialProfile(second.id, officialDraft("slug-a")),
      expectOfficialTaken(first.id)
    );
    assert.equal((await board.findOfficialProfile("twitch", "slug-b"))?.id, second.id, "실패한 수정은 아무것도 바꾸지 않습니다");

    /* 비활성화 뒤에도 같은 URL 은 다른 프로필에 재사용되지 않습니다(migration 0026). */
    await board.deactivateOfficialProfile(first.id);
    await assert.rejects(
      () => board.createOfficialProfile(officialDraft("slug-a", {
        channelKey: "twitch:slug-a-again",
        channelUrl: "https://www.twitch.tv/slug-a-again",
      })),
      expectOfficialTaken(first.id)
    );
  });

  test("동시에 같은 공식 URL 로 고쳐도 하나만 성공하고 나머지는 중복으로 답한다", async () => {
    /* NOT EXISTS 검사는 둘 다 통과할 수 있습니다 — 마지막 판정은 UNIQUE 제약이 하고,
       그 23505 는 500 이 아니라 다른 중복과 같은 예외여야 합니다. */
    const left = await board.createOfficialProfile(officialDraft("race-left"));
    const right = await board.createOfficialProfile(officialDraft("race-right"));
    const attempts = await Promise.allSettled([
      board.updateOfficialProfile(left.id, officialDraft("race-target")),
      board.updateOfficialProfile(right.id, officialDraft("race-target")),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = attempts.filter((result) => result.status === "rejected");
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof StreamerOfficialProfileTakenError, String(rejected[0].reason));
    const winner = attempts.find((result) => result.status === "fulfilled").value;
    assert.equal(rejected[0].reason.existing.postId, winner.id, "막힌 쪽은 이긴 프로필을 안내합니다");
    assert.equal((await board.findOfficialProfile("twitch", "race-target"))?.id, winner.id);
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

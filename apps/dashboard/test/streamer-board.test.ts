import test from "node:test";
import assert from "node:assert/strict";
import {
  isStreamersPath,
  streamerPostIdFromPath,
  streamerScopeFromSearch,
  streamersPageFromPath,
  streamersScopePath,
} from "../src/features/public-streamers/utils/routes";
import {
  parseStreamerComment,
  parseStreamerPost,
  parseStreamerPostList,
} from "../src/features/public-streamers/types/streamer-post";

/* 스트리머 추천 게시판 — 목업 docs/mockups/streamer-board.
   서버 계약이 아직 없어 프런트 파서가 방어선입니다. */

test("경로는 목록·상세·글쓰기만 인식하고 나머지는 404 로 넘긴다", () => {
  assert.equal(streamersPageFromPath("/streamers"), "list");
  assert.equal(streamersPageFromPath("/ko/streamers/"), "list");
  assert.equal(streamersPageFromPath("/ja/streamers/new"), "compose");
  assert.equal(streamersPageFromPath("/streamers/bamtol"), "detail");
  assert.equal(streamerPostIdFromPath("/ko/streamers/bamtol"), "bamtol");
  /* 글쓰기 경로가 글 id 로 잡히면 상세가 되어 버립니다. */
  assert.equal(streamerPostIdFromPath("/streamers/new"), null);
  /* 조작된 경로를 그대로 조회에 넘기지 않습니다. */
  assert.equal(streamersPageFromPath("/streamers/../etc"), null);
  assert.equal(streamersPageFromPath("/streamers/A".padEnd(200, "a")), null);
  assert.equal(streamersPageFromPath("/streamers/bam/tol"), null);
  assert.equal(isStreamersPath("/streamersish"), false);
  assert.equal(isStreamersPath("/ko/streamers/bamtol"), true);
});

test("게임 범위는 query 로 다니고 모르는 값은 전체로 떨어진다", () => {
  assert.equal(streamerScopeFromSearch("?game=lol"), "lol");
  assert.equal(streamerScopeFromSearch("?game=palworld"), "palworld");
  assert.equal(streamerScopeFromSearch("?game=chess"), "all");
  assert.equal(streamerScopeFromSearch(""), "all");
  assert.equal(streamersScopePath("all"), "/streamers");
  assert.equal(streamersScopePath("valorant"), "/streamers?game=valorant");
});

const basePost = {
  id: "bamtol",
  streamerName: "밤톨",
  platform: "twitch",
  live: true,
  games: ["lol"],
  tags: ["칼바람 나락"],
  reason: "정글 동선을 설명하면서 플레이합니다.",
  votes: 142,
  commentCount: 12,
  authorName: "쿠키맛젤리",
  createdAt: "2026-08-19T00:00:00.000Z",
};

test("글 파서는 필수 필드가 빠지면 그 글을 버린다", () => {
  assert.ok(parseStreamerPost(basePost));
  for (const key of ["id", "streamerName", "reason", "authorName", "createdAt", "platform"]) {
    const broken = { ...basePost, [key]: undefined };
    assert.equal(parseStreamerPost(broken), undefined, key);
  }
  assert.equal(parseStreamerPost({ ...basePost, platform: "kick" }), undefined);
  assert.equal(parseStreamerPost({ ...basePost, createdAt: "어제" }), undefined);
});

test("채널 주소는 https 이고 아는 플랫폼일 때만 링크한다", () => {
  const withUrl = (channelUrl: unknown) => parseStreamerPost({ ...basePost, channelUrl })?.channelUrl;
  assert.equal(withUrl("https://twitch.tv/bamtol"), "https://twitch.tv/bamtol");
  assert.equal(withUrl("https://chzzk.naver.com/abc"), "https://chzzk.naver.com/abc");
  assert.equal(withUrl("https://youtu.be/abc"), "https://youtu.be/abc");
  /* 로그인 전에는 서버가 비워 보냅니다 — 화면이 잠금 줄로 닫습니다. */
  assert.equal(withUrl(undefined), undefined);
  assert.equal(withUrl("http://twitch.tv/bamtol"), undefined);
  assert.equal(withUrl("https://evil.test/twitch.tv"), undefined);
  assert.equal(withUrl("javascript:alert(1)"), undefined);
});

test("프로필 이미지는 Twitch 글에서만 쓴다", () => {
  const image = "https://static-cdn.example/bamtol.png";
  assert.equal(parseStreamerPost({ ...basePost, profileImageUrl: image })?.profileImageUrl, image);
  /* 치지직·YouTube 는 연동이 없어 화면이 플랫폼 마크를 씁니다 — 값이 와도 쓰지 않습니다. */
  assert.equal(
    parseStreamerPost({ ...basePost, platform: "chzzk", profileImageUrl: image })?.profileImageUrl,
    undefined,
  );
  assert.equal(parseStreamerPost({ ...basePost, profileImageUrl: "http://x/y.png" })?.profileImageUrl, undefined);
});

test("전적 프로필은 리그 오브 레전드 글에만 붙는다", () => {
  const lolProfile = {
    riotId: "밤톨#KR1", tier: "다이아 2", winRate: 57.14, wins: 24, losses: 18,
    recentResults: ["win", "win", "loss", "win", "win", "win"],
  };
  const lolPost = parseStreamerPost({ ...basePost, lolProfile });
  assert.equal(lolPost?.lolProfile?.winRate, 57.1, "소수 한 자리로 고정합니다");
  assert.equal(lolPost?.lolProfile?.recentResults.length, 5, "최근 5경기까지");

  /* 다른 게임 글은 게임 표기까지입니다. */
  const palworldPost = parseStreamerPost({ ...basePost, games: ["palworld"], lolProfile });
  assert.equal(palworldPost?.lolProfile, undefined);

  /* 값이 앞뒤가 맞지 않으면 전적만 빠지고 글은 남습니다. */
  const brokenRate = parseStreamerPost({ ...basePost, lolProfile: { ...lolProfile, winRate: 140 } });
  assert.ok(brokenRate);
  assert.equal(brokenRate?.lolProfile, undefined);
});

test("댓글 파서는 익명 여부에 맞는 것만 통과시킨다", () => {
  const base = { id: "c1", body: "도움 됐습니다.", createdAt: "2026-08-19T00:00:00.000Z" };
  assert.equal(parseStreamerComment({ ...base, anonymous: true })?.authorName, undefined);
  assert.equal(parseStreamerComment({ ...base, anonymous: false, authorName: "사분면" })?.authorName, "사분면");
  /* 익명이 아닌데 이름이 없으면 화면이 "미상"을 만들게 됩니다. */
  assert.equal(parseStreamerComment({ ...base, anonymous: false }), undefined);
  /* 익명 댓글에 이름이 실려 와도 노출하지 않습니다. */
  assert.equal(parseStreamerComment({ ...base, anonymous: true, authorName: "사분면" })?.authorName, undefined);
});

test("목록 파서는 깨진 항목만 버리고 나머지를 살린다", () => {
  const list = parseStreamerPostList({
    total: 2,
    liveCount: 1,
    posts: [basePost, { ...basePost, id: undefined }],
  });
  assert.equal(list?.posts.length, 1);
  /* total 이 실제 개수보다 작으면 믿지 않습니다. */
  assert.equal(parseStreamerPostList({ total: 0, posts: [basePost] })?.total, 1);
  assert.equal(parseStreamerPostList({ posts: "nope" }), undefined);
});

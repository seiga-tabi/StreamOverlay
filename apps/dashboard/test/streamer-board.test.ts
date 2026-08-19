import test from "node:test";
import assert from "node:assert/strict";
import {
  isStreamersPath,
  streamerPostIdFromPath,
  streamerScopeFromSearch,
  streamersPageFromPath,
  streamersScopePath,
} from "../src/features/public-streamers/utils/routes";
import { parseStreamerComment, parseStreamerPost, parseStreamerPostList, streamerChannelKey } from "../src/features/public-streamers/types/streamer-post";
import { isLocalizablePublicPath, localizedPublicUrl } from "../src/features/public-lol/utils/public-locale-path";
import { streamersSeoMetadata } from "../src/features/public-streamers/utils/seo";

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
  votes: 142,
  commentCount: 12,
  authorName: "쿠키맛젤리",
  createdAt: "2026-08-19T00:00:00.000Z",
};

test("글 파서는 필수 필드가 빠지면 그 글을 버린다", () => {
  assert.ok(parseStreamerPost(basePost));
  for (const key of ["id", "streamerName", "authorName", "createdAt", "platform"]) {
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

test("프로필 이미지는 Twitch 글의 같은 origin 경로만 쓴다", () => {
  /* 서버가 Twitch 이미지를 받아 우리 경로로 다시 내보냅니다 — 시청자 브라우저가
     Twitch CDN 에 직접 붙으면 시청자 IP 가 외부로 샙니다. */
  const image = "/api/public/streamers/bamtol/avatar";
  assert.equal(parseStreamerPost({ ...basePost, profileImageUrl: image })?.profileImageUrl, image);
  /* 치지직·YouTube 는 연동이 없어 화면이 플랫폼 마크를 씁니다 — 값이 와도 쓰지 않습니다. */
  assert.equal(
    parseStreamerPost({ ...basePost, platform: "chzzk", profileImageUrl: image })?.profileImageUrl,
    undefined,
  );
  /* 외부 주소는 그대로 링크하지 않습니다. */
  for (const outside of [
    "https://static-cdn.jtvnw.net/bamtol.png",
    "http://x/y.png",
    "//evil.test/a.png",
    "/api/public/streamers/bamtol/avatar/../../../secret",
  ]) {
    assert.equal(parseStreamerPost({ ...basePost, profileImageUrl: outside })?.profileImageUrl, undefined, outside);
  }
});

test("전적 프로필은 리그 오브 레전드 글에만 붙는다", () => {
  /* 서버는 티어 코드와 단계를 줍니다 — 표기는 다른 LoL 화면과 같은 규칙으로 만듭니다. */
  const lolProfile = {
    riotId: "밤톨#KR1", tier: "DIAMOND", rank: "II", leaguePoints: 42,
    winRate: 57.14, wins: 24, losses: 18,
    recentResults: ["win", "win", "loss", "win", "win", "win"],
  };
  const lolPost = parseStreamerPost({ ...basePost, lolProfile });
  assert.equal(lolPost?.lolProfile?.tier, "Diamond II");
  assert.equal(lolPost?.lolProfile?.winRate, 57.1, "소수 한 자리로 고정합니다");
  assert.equal(lolPost?.lolProfile?.recentResults.length, 5, "최근 5경기까지");

  /* 모르는 티어 값은 전적을 통째로 버립니다 — 화면에 원문 코드를 노출하지 않습니다. */
  assert.equal(
    parseStreamerPost({ ...basePost, lolProfile: { ...lolProfile, tier: "WOOD" } })?.lolProfile,
    undefined,
  );

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

/* 한 채널은 글 하나 — 그 판정의 기준값입니다.
 *
 * 사람은 같은 채널을 서로 다른 문자열로 적습니다(www, 대소문자, 끝 슬래시,
 * 추적 query, 팝아웃 주소). 여기서 같은 키로 모이지 못하면 목록이 같은 스트리머로
 * 갈라지고, 반대로 다른 채널이 한 키가 되면 남의 등록을 막습니다. */

test("같은 트위치 채널은 표기가 달라도 한 키로 모인다", () => {
  const expected = "twitch:bamtol";
  for (const input of [
    "https://twitch.tv/bamtol",
    "https://www.twitch.tv/Bamtol",
    "https://twitch.tv/bamtol/",
    "https://twitch.tv/bamtol?tt_medium=share",
    "https://www.twitch.tv/popout/BamTol/chat",
    "twitch.tv/bamtol",
    "  https://twitch.tv/bamtol  ",
  ]) {
    assert.equal(streamerChannelKey(input), expected, input);
  }
});

test("치지직과 YouTube 도 채널 식별자만 남긴다", () => {
  assert.equal(streamerChannelKey("https://chzzk.naver.com/live/abc123"), "chzzk:abc123");
  assert.equal(streamerChannelKey("https://chzzk.naver.com/ABC123"), "chzzk:abc123");
  assert.equal(streamerChannelKey("https://www.youtube.com/@Hangyeoul"), "youtube:hangyeoul");
  assert.equal(streamerChannelKey("https://youtube.com/c/Hangyeoul"), "youtube:hangyeoul");
  assert.equal(streamerChannelKey("https://m.youtube.com/user/Hangyeoul"), "youtube:hangyeoul");
});

test("YouTube channel id 는 대소문자를 지킨다", () => {
  /* 이 id 는 대소문자를 구분하는 값이라, 낮춰 쓰면 서로 다른 채널이 한 키가 됩니다. */
  assert.equal(streamerChannelKey("https://www.youtube.com/channel/UCabcDEF"), "youtube:UCabcDEF");
  assert.notEqual(
    streamerChannelKey("https://www.youtube.com/channel/UCabcDEF"),
    streamerChannelKey("https://www.youtube.com/channel/UCABCdef"),
  );
});

test("서로 다른 채널은 절대 같은 키가 되지 않는다", () => {
  const keys = [
    "https://twitch.tv/bamtol",
    "https://twitch.tv/bamtol2",
    "https://chzzk.naver.com/bamtol",
    "https://www.youtube.com/@bamtol",
  ].map((url) => streamerChannelKey(url));
  assert.equal(new Set(keys).size, keys.length);
});

test("채널을 가리키지 않는 값은 키가 없다", () => {
  for (const input of [
    "",
    "   ",
    "not a url",
    "https://twitch.tv",
    "https://twitch.tv/",
    "https://youtu.be/abc123",
    "https://example.test/bamtol",
    "javascript:alert(1)",
  ]) {
    assert.equal(streamerChannelKey(input), undefined, JSON.stringify(input));
  }
});

test("글 상세 경로는 로케일이 붙는 경로다", () => {
  /* 여기 빠져 있으면 ja 화면에서 글을 열어도 /streamers/<id> 로 가서 로케일이
     통째로 떨어집니다 — 목록·글쓰기는 정확 목록에 있어 멀쩡한 탓에 늦게 드러납니다. */
  assert.equal(isLocalizablePublicPath("/streamers/bamtol"), true);
  assert.equal(isLocalizablePublicPath("/ja/streamers/bamtol"), true);
  assert.equal(localizedPublicUrl("/streamers/bamtol", "ja"), "/ja/streamers/bamtol");
  assert.equal(localizedPublicUrl("/ja/streamers/bamtol", "ko"), "/ko/streamers/bamtol");
  assert.equal(localizedPublicUrl("/streamers", "ja"), "/ja/streamers");
  assert.equal(localizedPublicUrl("/streamers?game=lol", "ja"), "/ja/streamers?game=lol");
});

test("canonical 은 그 화면의 주소를 가리킨다", () => {
  /* 글 상세가 목록을 가리키면 크롤러는 모든 글을 목록의 중복으로 보고 내립니다. */
  assert.equal(
    streamersSeoMetadata("detail", "ja", "밤톨", "bamtol").canonicalUrl,
    "https://yoro.gg/ja/streamers/bamtol",
  );
  assert.equal(streamersSeoMetadata("list", "ja").canonicalUrl, "https://yoro.gg/ja/streamers");
  assert.equal(streamersSeoMetadata("compose", "ko").canonicalUrl, "https://yoro.gg/ko/streamers/new");
  /* id 를 아직 모르는 첫 렌더에서는 목록으로 둡니다 — 없는 주소를 canonical 로 내지 않습니다. */
  assert.equal(streamersSeoMetadata("detail", "ko").canonicalUrl, "https://yoro.gg/ko/streamers");
});

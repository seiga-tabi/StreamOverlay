import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StreamerLiveCard, StreamerRow } from "../src/features/public-lol/components/StreamerPanels";
import { streamerBuckets } from "../src/features/public-lol/utils/streamers";
import type { PublicTwitchFollowedLolChannel } from "../src/features/public-lol/types/public-lol";

const ranked = (tier: string, leaguePoints: number) => ({
  queueType: "RANKED_SOLO_5x5",
  tier,
  rank: "I",
  leaguePoints,
  wins: 10,
  losses: 5,
  winRate: 66.7,
  hotStreak: false,
  veteran: false,
  freshBlood: false,
  inactive: false,
});

const channel = (over: Partial<PublicTwitchFollowedLolChannel>): PublicTwitchFollowedLolChannel => ({
  twitchUserId: "1",
  twitchLogin: "streamer",
  twitchDisplayName: "스트리머",
  followedAt: "2026-08-01T00:00:00.000Z",
  isLive: false,
  ...over,
} as PublicTwitchFollowedLolChannel);

test("스트리머 목록은 방송 중을 앞세우고 시청자 수와 랭크로 정렬한다", () => {
  const channels = [
    channel({ twitchUserId: "a", isLive: false, followedAt: "2026-08-01T00:00:00.000Z", rankedStats: ranked("GOLD", 10) as never }),
    channel({ twitchUserId: "b", isLive: true, viewerCount: 100 }),
    channel({ twitchUserId: "c", isLive: true, viewerCount: 900, rankedStats: ranked("DIAMOND", 20) as never }),
    channel({ twitchUserId: "d", isLive: false, followedAt: "2026-08-05T00:00:00.000Z" }),
  ];

  const base = streamerBuckets(channels);
  // 방송 중은 시청자 수가 많은 순입니다.
  assert.deepEqual(base.live.map((item) => item.twitchUserId), ["c", "b"]);
  // 오프라인은 최근 팔로우 순입니다.
  assert.deepEqual(base.offline.map((item) => item.twitchUserId), ["d", "a"]);
  assert.deepEqual(base.counts, { all: 4, live: 2, linked: 2 });

  // 랭크순으로 바꾸면 언랭크·미연결이 뒤로 갑니다.
  const byRank = streamerBuckets(channels, "all", true);
  assert.deepEqual(byRank.live.map((item) => item.twitchUserId), ["c", "b"]);
  assert.deepEqual(byRank.offline.map((item) => item.twitchUserId), ["a", "d"]);

  // 필터는 개수를 바꾸지 않고 보이는 목록만 좁힙니다.
  const live = streamerBuckets(channels, "live");
  assert.equal(live.offline.length, 0);
  assert.equal(live.counts.all, 4);
  const linked = streamerBuckets(channels, "linked");
  assert.deepEqual([...linked.live, ...linked.offline].map((item) => item.twitchUserId), ["c", "a"]);
});

test("스트리머 카드는 랭크와 두 개의 동작을 모두 렌더링한다", () => {
  const text = { liveLabel: "방송 중", watchLabel: "Twitch", profileLabel: "전적 보기", noRankLabel: "전적 미연결" };
  const view = {
    channelUrl: "https://twitch.tv/yoro",
    displayName: "코코넨네",
    isLive: true,
    key: "1",
    login: "yoro",
    onOpenProfile: () => undefined,
    previewUrl: "https://static-cdn.jtvnw.net/previews-ttv/live_user_yoro-640x360.jpg",
    rankClassName: "rank-challenger",
    rankLabel: "Challenger I",
    riotId: "코코넨네#KR1",
    title: "챌린저 가는 그날까지",
    uptimeLabel: "1시간 30분째",
    viewersLabel: "1,200명",
  };

  const live = renderToStaticMarkup(<StreamerLiveCard channel={view} text={text} />);
  assert.match(live, /Challenger I/u);
  assert.match(live, /1,200명/u);
  assert.match(live, /챌린저 가는 그날까지/u);
  assert.match(live, /전적 보기/u);
  assert.match(live, /previews-ttv/u);
  // 좁은 폭에서 썸네일이 접혀도 랭크·시청자 수가 남도록 보조 줄을 함께 둡니다.
  assert.match(live, /public-streamer-live-sub-compact/u);

  const row = renderToStaticMarkup(<StreamerRow channel={{ ...view, isLive: false }} text={text} />);
  assert.match(row, /Challenger I/u);
  assert.match(row, /코코넨네#KR1/u);
  assert.match(row, /전적 보기/u);

  // 전적이 연결되지 않은 채널은 미연결 배지와 Twitch 링크만 둡니다.
  const noRank = renderToStaticMarkup(
    <StreamerRow channel={{ ...view, isLive: false, onOpenProfile: undefined, rankLabel: undefined, riotId: undefined }} text={text} />
  );
  assert.match(noRank, /전적 미연결/u);
  assert.doesNotMatch(noRank, /전적 보기/u);
  assert.match(noRank, /twitch\.tv/u);
});

test("스트리머 스타일시트는 legacy 선택자를 쓰지 않고 카드 높이를 고정하지 않는다", () => {
  const raw = readFileSync(
    new URL("../src/styles/pages/public-lol/29-streamers.css", import.meta.url),
    "utf8"
  );
  // 파일 머리말 주석은 legacy 선택자를 문제 설명으로 인용합니다. 선언만 검사합니다.
  const css = raw.replace(/\/\*[\s\S]*?\*\//gu, "");
  const panels = readFileSync(
    new URL("../src/features/public-lol/components/StreamerPanels.tsx", import.meta.url),
    "utf8"
  );

  assert.match(raw, /@layer pages/u);
  assert.match(css, /container-name:\s*streamers/u);
  // legacy 는 카드에 64px 고정 높이와 overflow: hidden 을 걸어 내용을 잘라 냈습니다.
  // 같은 이름을 쓰면 그 규칙을 그대로 물려받습니다.
  for (const legacy of ["public-streamers-shared-card", "public-twitch-followed-list", "public-twitch-channel-"]) {
    assert.doesNotMatch(panels, new RegExp(legacy, "u"), `${legacy} 는 새 마크업에서 쓰지 않아야 합니다.`);
    assert.doesNotMatch(css, new RegExp(`\\.${legacy}`, "u"));
  }
  // 카드 높이를 고정하지 않아야 랭크·버튼이 잘리지 않습니다.
  assert.doesNotMatch(css, /\.public-streamer-(live|row)\s*\{[^}]*\bheight:/u);
  // 목록에 별도 스크롤을 두지 않습니다.
  assert.doesNotMatch(css, /\.public-streamer-rows\s*\{[^}]*overflow-y/u);
  assert.doesNotMatch(css, /[a-z-]+:[^;{}]*!important/u);

  // 조작 요소는 44px 터치 타깃을 지킵니다.
  for (const rule of ["public-streamer-button", "public-streamer-chip", "public-streamer-more", "public-streamer-sub"]) {
    assert.match(
      css,
      new RegExp(`\\.${rule}\\s*\\{[\\s\\S]*?min-height:\\s*var\\(--yoro-size-touch-target\\)`, "u"),
      `${rule} 은 44px 터치 타깃을 지켜야 합니다.`
    );
  }
});

test("스트리머 신규 문구는 한국어·일본어를 함께 둔다", () => {
  const i18n = readFileSync(
    new URL("../src/features/public-lol/i18n/public-lol-i18n.ts", import.meta.url),
    "utf8"
  );
  for (const [ko, ja] of [
    ["지금 방송 중", "配信中"],
    ["오프라인", "オフライン"],
    ["전적 연결 \\{count\\}", "戦績連携 \\{count\\}"],
    ["랭크순", "ランク順"],
    ["전적 미연결", "戦績未連携"],
  ]) {
    assert.match(i18n, new RegExp(ko, "u"));
    assert.match(i18n, new RegExp(ja, "u"));
  }
});

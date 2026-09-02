import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StreamerPostCard } from "../src/features/public-streamers/components/StreamerPostCard";
import { streamersI18n } from "../src/features/public-streamers/i18n/streamers-i18n";
import type { StreamerPost } from "../src/features/public-streamers/types/streamer-post";

/* 카드 우측 비주얼 슬롯 — 근거: docs/mockups/streamer-board-redesign-v1.html §v2.
   LoL 과 타게임이 같은 자리·같은 크기를 써야 목록 그리드가 흔들리지 않습니다. */

const text = streamersI18n.ko;

const post = (over: Partial<StreamerPost> = {}): StreamerPost => ({
  id: "p1",
  streamerName: "별빛수달",
  platform: "twitch",
  live: false,
  games: ["lol"],
  tags: [],
  votes: 128,
  voted: false,
  commentCount: 12,
  authorName: "밤샘라이더",
  createdAt: "2026-08-19T00:00:00.000Z",
  registeredByAdmin: false,
  ...over,
});

const lolProfile = {
  riotId: "별빛수달#KR1",
  tier: "Diamond II",
  tierCode: "DIAMOND" as const,
  leaguePoints: 74,
  winRate: 57.6,
  wins: 132,
  losses: 94,
  recentResults: [] as readonly ("win" | "loss")[],
};

test("LoL 카드는 티어 엠블럼 슬롯과 정수 승률 게이지를 그린다", () => {
  const html = renderToStaticMarkup(<StreamerPostCard post={post({ lolProfile })} text={text} />);

  /* 티어 색은 원본 코드로 고릅니다 — 표기 문자열로는 고를 수 없습니다. */
  assert.match(html, /class="streamers-media" data-tier="diamond"/u);
  assert.match(html, /streamers-media__tier">Diamond II</u);
  assert.match(html, /streamers-media__lp">74 LP</u);

  /* 서버 winRate 는 정수라 소수 자리를 만들어 붙이지 않습니다(58.4% 는 나올 수 없는 값). */
  assert.match(html, /streamers-rank-meter[\s\S]*?<b>58%<\/b>/u);
  assert.doesNotMatch(html, /57\.6%|58\.0%/u);
  assert.match(html, /class="streamers-rank-bar"[^>]*style="width:58%"|width:58%/u);
  assert.match(html, /aria-label="승률 58%, 132승 94패"/u);

  /* 최근 경기 결과는 서버가 아직 싣지 않습니다 — 막대 자리를 빈 채로 두지 않습니다. */
  assert.match(html, /streamers-rank-empty">최근 경기 기록 없음</u);
  assert.doesNotMatch(html, /streamers-rank-form/u);

  /* 티어 칩은 슬롯으로 옮겼습니다 — 전적 줄에 두 번 나오지 않아야 합니다. */
  assert.doesNotMatch(html, /streamers-rank-tier/u);
});

test("전적이 없는 LoL 글은 빈 액자 대신 게임 마크와 이유를 그린다", () => {
  const html = renderToStaticMarkup(<StreamerPostCard post={post()} text={text} />);
  assert.match(html, /class="streamers-media" data-game="lol"/u);
  assert.match(html, /streamers-media__game">리그 오브 레전드</u);
  assert.match(html, /streamers-media__hint">전적 없음</u);
  assert.doesNotMatch(html, /streamers-card__rank/u);
});

test("타게임 글은 주 게임(첫 태그) 박스아트 자리를 쓰고 전적 힌트는 붙이지 않는다", () => {
  const html = renderToStaticMarkup(
    <StreamerPostCard post={post({ games: ["valorant", "palworld"], lolProfile: undefined })} text={text} />
  );
  assert.match(html, /class="streamers-media" data-game="valorant"/u);
  assert.match(html, /streamers-media__game">발로란트</u);
  assert.doesNotMatch(html, /streamers-media__hint/u);
});

test("카드 그리드는 미디어 열을 갖고 좁은 화면 규칙이 슬롯을 함께 내린다", () => {
  const css = readFileSync(
    new URL("../src/styles/pages/public-streamers/streamers-route.css", import.meta.url),
    "utf8"
  );
  /* 5열 — 미디어는 고정 6rem 이라 본문(1fr)만 늘고 줄어듭니다. */
  assert.match(css, /\.streamers-card \{[\s\S]*?grid-template-columns: 3\.5rem 3\.5rem minmax\(0, 1fr\) 6rem auto;/u);
  /* 액자 비율은 박스아트 원본 285x380 입니다. */
  assert.match(css, /\.streamers-media__frame \{[\s\S]*?aspect-ratio: 285 \/ 380;/u);
  /* 좁은 화면 규칙에서 슬롯을 빠뜨리면 카드가 깨집니다(목업 §v2 경고). */
  const narrow = css.slice(css.indexOf("@media (max-width: 47.5rem)"));
  assert.match(narrow, /\.streamers-media \{[\s\S]*?grid-column: 1 \/ -1;/u);
  assert.match(narrow, /\.streamers-media__frame \{ width: 3\.5rem; \}/u);
});

test("게시판 톤은 홈 토큰·헤어라인·2~3px 라운드만 쓰고 보라 강조를 버렸다", () => {
  const css = readFileSync(
    new URL("../src/styles/pages/public-streamers/streamers-route.css", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(css, /#7c5cff|#6259ef|#b59eff/iu, "보라 강조는 전면 폐기입니다");
  assert.doesNotMatch(css, /box-shadow|linear-gradient/u, "그림자·그라디언트는 쓰지 않습니다");
  assert.doesNotMatch(css, /border: thin |border-radius: var\(--yoro-radius-(xs|sm|md|lg|pill)\)/u);
  /* 지면의 유일한 강조 — 흰 글자를 얹으므로 AA 를 넘기는 홍옥(홈 LIVE 배지와 같은 값). */
  assert.match(css, /--home-live-bg: #C93850;/u);
  assert.match(css, /\.streamers-primary-action \{[\s\S]*?background: var\(--home-live-bg\);/u);
});

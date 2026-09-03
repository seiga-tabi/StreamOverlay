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
  tierIconUrl: "/riot/ranked-emblems/diamond.png?v=ranked-emblems-1",
  leaguePoints: 74,
  winRate: 57.6,
  wins: 132,
  losses: 94,
  recentResults: [] as readonly ("win" | "loss")[],
};

test("LoL 카드는 티어 엠블럼 슬롯과 정수 승률 게이지를 그린다", () => {
  const html = renderToStaticMarkup(<StreamerPostCard post={post({ lolProfile })} text={text} />);

  /* 티어 색은 원본 코드로 고릅니다 — 표기 문자열로는 고를 수 없습니다. */
  assert.match(html, /class="streamers-media v2-tier" data-tier="diamond"/u);
  assert.match(html, /class="v2-tier__emblem" loading="lazy" src="http:\/\/localhost:3000\/riot\/ranked-emblems\/diamond\.png\?v=ranked-emblems-1"/u);
  assert.match(html, /alt=""/u);
  assert.match(html, /v2-tier__name">Diamond II</u);
  assert.match(html, /v2-tier__lp">74 LP</u);

  /* 서버 winRate 는 정수라 소수 자리를 만들어 붙이지 않습니다(58.4% 는 나올 수 없는 값). */
  assert.match(html, /v2-meter[\s\S]*?v2-meter__pct">58%/u);
  assert.doesNotMatch(html, /57\.6%|58\.0%/u);
  assert.match(html, /class="v2-meter__bar"[^>]*style="width:58%"|width:58%/u);
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

test("최근 폼·LIVE·투표 상태는 실제 데이터 개수와 상태값만큼 렌더링한다", () => {
  const recentResults = ["win", "loss", "win"] as const;
  const html = renderToStaticMarkup(
    <StreamerPostCard
      post={post({ live: true, voted: true, lolProfile: { ...lolProfile, recentResults } })}
      text={text}
    />
  );
  assert.match(html, /class="v2-vote" data-voted="true"/u);
  assert.match(html, /class="v2-avatar v2b-avatar" data-live="true"/u);
  assert.match(html, /class="v2-live"/u);
  assert.match(html, /v2-form__label">최근 3/u);
  assert.equal((html.match(/data-r=/gu) ?? []).length, 2, "승리 도트만 data-r=w를 갖습니다");
  assert.equal((html.match(/v2-form__dots[\s\S]*?<i/gu) ?? []).length, 1);
  assert.equal((html.match(/<i(?: data-r="w")?><\/i>/gu) ?? []).length, 3, "최근 경기 수만큼 도트를 그립니다");
});

test("타게임 글은 주 게임(첫 태그) 박스아트 자리를 쓰고 전적 힌트는 붙이지 않는다", () => {
  const html = renderToStaticMarkup(
    <StreamerPostCard post={post({ games: ["valorant", "palworld"], lolProfile: undefined })} text={text} />
  );
  assert.match(html, /class="streamers-media" data-game="valorant"/u);
  assert.match(html, /streamers-media__game">발로란트</u);
  assert.doesNotMatch(html, /streamers-media__hint/u);
});

test("카드는 승인된 2단 구조와 좁은 화면 재배치를 유지한다", () => {
  const css = readFileSync(
    new URL("../src/styles/pages/public-streamers/streamers-route.css", import.meta.url),
    "utf8"
  );
  assert.match(css, /\.v2b-card__top \{[\s\S]*?display: flex;[\s\S]*?padding: 14px 16px 12px;/u);
  assert.match(css, /\.v2b-card__strip \{[\s\S]*?border-top: \.5px solid var\(--home-line\);[\s\S]*?background: rgba\(255, 255, 255, \.015\);/u);
  assert.match(css, /\.v2-meter__bar \{[\s\S]*?width: 132px;[\s\S]*?height: 7px;[\s\S]*?background: #454C58;/u);
  const narrow = css.slice(css.indexOf("@media (max-width: 47.5rem)"));
  assert.match(narrow, /\.streamers-card\.v2b-card \{[\s\S]*?padding: 0;/u);
  assert.match(narrow, /\.streamers-media\.v2-tier,[\s\S]*?grid-column: 1 \/ -1;/u);
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

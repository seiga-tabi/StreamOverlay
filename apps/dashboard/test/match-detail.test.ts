import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTimestampLabel,
  matchGap,
  matchUsesFarmMetrics,
  isArenaQueue,
  arenaPlacementClass,
} from "../src/features/public-lol/utils/match-lanes";
import type { PublicLolRecentMatch } from "../src/features/public-lol/types/public-lol";

const player = (over: Record<string, unknown>) => ({
  riotId: "P#KR1",
  isTarget: false,
  champion: { championId: 1, championKey: "C", nameKo: "챔프", nameJa: "チャンプ" },
  championLevel: 15,
  kills: 1, deaths: 1, assists: 1, kda: 2,
  cs: 100, csPerMinute: 5,
  items: [], summonerSpells: [], runes: [], badges: [],
  ...over,
}) as never;

const match = (over: Record<string, unknown> = {}): PublicLolRecentMatch => ({
  matchId: "KR_1",
  champion: { championId: 1, championKey: "C", nameKo: "챔프", nameJa: "チャンプ" },
  queueId: 420,
  startedAt: "2026-08-08T00:00:00.000Z",
  durationSeconds: 1800,
  result: "win",
  kills: 1, deaths: 1, assists: 1, kda: 2, championLevel: 16,
  cs: 200, csPerMinute: 7,
  items: [], summonerSpells: [], runes: [], badges: [],
  teams: [
    {
      teamId: 100, result: "win", kills: 30, deaths: 20, assists: 40,
      goldEarned: 58_000, damageDealtToChampions: 92_000, damageDealtToObjectives: 1, damageTaken: 1,
      objectives: { baron: 1, dragon: 3, tower: 8 },
      players: [
        player({ position: "MIDDLE", isTarget: true, damageDealtToChampions: 30_000, goldEarned: 14_000 }),
        player({ position: "TOP", damageDealtToChampions: 20_000, goldEarned: 12_000 }),
        player({ position: "UTILITY", damageDealtToChampions: 5_000, goldEarned: 8_000 }),
      ],
    },
    {
      teamId: 200, result: "loss", kills: 20, deaths: 30, assists: 30,
      goldEarned: 51_000, damageDealtToChampions: 78_000, damageDealtToObjectives: 1, damageTaken: 1,
      objectives: { baron: 0, dragon: 1, tower: 3 },
      players: [
        player({ position: "TOP", damageDealtToChampions: 10_000, goldEarned: 12_000 }),
        player({ position: "MIDDLE", damageDealtToChampions: 10_000, goldEarned: 6_000 }),
        player({ position: "UTILITY", damageDealtToChampions: 5_000, goldEarned: 8_000 }),
      ],
    },
  ],
  ...over,
}) as PublicLolRecentMatch;

test("팀 격차와 내 순위를 계산한다", () => {
  const gap = matchGap(match());
  assert.equal(gap?.gold, 7_000);
  assert.equal(gap?.damage, 14_000);
  assert.deepEqual(gap?.objectives, { ally: 12, enemy: 4 });
  // 딜량 30,000 으로 팀 1위입니다.
  assert.equal(gap?.myRank, 1);
  assert.equal(gap?.teamSize, 3);
});

test("칼바람처럼 CS·시야가 의미 없는 큐를 구분한다", () => {
  assert.equal(matchUsesFarmMetrics(420), true);
  assert.equal(matchUsesFarmMetrics(450), false);
  assert.equal(matchUsesFarmMetrics(2400), false);
  assert.equal(matchUsesFarmMetrics(undefined), true);
  /* 아레나 3x6(1750)도 CS·시야 무의미 — 목업 lol-arena-match-row.html §⑥. */
  assert.equal(matchUsesFarmMetrics(1750), false);
});

test("아레나 큐 판정과 순위 톤 클래스", () => {
  assert.equal(isArenaQueue(1700), true);
  assert.equal(isArenaQueue(1710), true);
  assert.equal(isArenaQueue(1750), true);
  assert.equal(isArenaQueue(450), false);
  assert.equal(isArenaQueue(undefined), false);
  /* 1위 = 골드 프레임, 상위 절반 win · 하위 loss(목업 §②). */
  assert.equal(arenaPlacementClass(1), "win arena-first");
  assert.equal(arenaPlacementClass(2), "win");
  assert.equal(arenaPlacementClass(3), "win");
  assert.equal(arenaPlacementClass(4), "loss");
  assert.equal(arenaPlacementClass(6), "loss");
});

test("아이템 구매 시각을 분:초로 만든다", () => {
  assert.equal(buildTimestampLabel(134_000), "2:14");
  assert.equal(buildTimestampLabel(0), "0:00");
  assert.equal(buildTimestampLabel(undefined), undefined);
  assert.equal(buildTimestampLabel(Number.NaN), undefined);
  assert.equal(buildTimestampLabel(-1), undefined);
});

test("전적 상세 스타일시트는 legacy 선택자와 충돌하지 않는다", () => {
  const raw = readFileSync(
    new URL("../src/styles/pages/public-lol/30-match-detail.css", import.meta.url),
    "utf8"
  );
  const css = raw.replace(/\/\*[\s\S]*?\*\//gu, "");
  // 파일 머리말 주석은 legacy 이름을 문제 설명으로 인용합니다. 코드만 검사합니다.
  const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const board = stripComments(readFileSync(
    new URL("../src/features/public-lol/components/MatchBuildBoard.tsx", import.meta.url),
    "utf8"
  ));
  assert.match(raw, /@layer pages/u);
  assert.doesNotMatch(css, /[a-z-]+:[^;{}]*!important/u);

  // legacy 가 !important 로 잠근 이름을 쓰면 44px·격자 규칙이 전부 무시됩니다.
  /* 팀 상세(public-team-*)는 목업 v28 에서 전적 탭 본문으로 복귀했습니다 —
     legacy 이름 충돌 검사는 빌드 보드에만 적용합니다. */
  for (const legacy of ["public-team-card", "public-match-build-picker", "public-match-skill-grid", "public-match-expanded-tabs"]) {
    assert.doesNotMatch(board, new RegExp(legacy, "u"));
    assert.doesNotMatch(css, new RegExp(`\\.${legacy}`, "u"));
  }

  // 스킬 18칸은 폭을 나눠 갖습니다. 고정 폭이면 좁은 화면에서 가로 스크롤이 생깁니다.
  assert.match(css, /\.public-md-build-skill-cells\s*\{[\s\S]*?grid-template-columns:\s*repeat\(18,\s*minmax\(0,\s*1fr\)\)/u);
  // 빌드 머리말은 스크롤해도 붙어 있어야 합니다.
  assert.match(css, /\.public-md-build-headline\s*\{[\s\S]*?position:\s*sticky/u);

  for (const rule of ["public-md-tab", "public-md-build-chip", "public-md-replay"]) {
    assert.match(
      css,
      new RegExp(`\\.${rule}[^{]*\\{[\\s\\S]*?min-height:\\s*var\\(--yoro-size-touch-target\\)`, "u"),
      `${rule} 은 44px 터치 타깃을 지켜야 합니다.`
    );
  }

  // 존재하지 않는 토큰을 쓰면 색이 통째로 사라집니다.
  assert.doesNotMatch(css, /--yoro-color-rank-lp/u);
});

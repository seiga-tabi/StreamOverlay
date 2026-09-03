import assert from "node:assert/strict";
import test from "node:test";
import type { PublicLolRecentMatch } from "../src/features/public-lol/types/public-lol";
import { matchAiScore } from "../src/pages/PublicLolPage";

type MatchAiScoreScenario = Pick<
  PublicLolRecentMatch,
  | "result"
  | "kills"
  | "deaths"
  | "assists"
  | "kda"
  | "killParticipation"
  | "csPerMinute"
  | "damageShare"
  | "visionScorePerMinute"
>;

const scenarios: Array<{
  name: string;
  match: MatchAiScoreScenario;
  expectedScore: number;
}> = [
  {
    name: "A 캐리하다 많이 죽음",
    match: {
      result: "win",
      kills: 12,
      deaths: 15,
      assists: 8,
      kda: 1.3333333333333333,
      killParticipation: 65,
      csPerMinute: 8,
      damageShare: 32,
      visionScorePerMinute: 1.4,
    },
    expectedScore: 61,
  },
  {
    name: "B 방치/포기",
    match: {
      result: "loss",
      kills: 1,
      deaths: 15,
      assists: 2,
      kda: 0.2,
      killParticipation: 15,
      csPerMinute: 4,
      damageShare: 8,
      visionScorePerMinute: 0.5,
    },
    expectedScore: 11,
  },
  {
    name: "C 평범 게임",
    match: {
      result: "win",
      kills: 6,
      deaths: 8,
      assists: 6,
      kda: 1.5,
      killParticipation: 55,
      csPerMinute: 7,
      damageShare: 22,
      visionScorePerMinute: 1.0,
    },
    expectedScore: 55,
  },
  {
    name: "D 데스적고 잘함(캐리)",
    match: {
      result: "win",
      kills: 10,
      deaths: 2,
      assists: 5,
      kda: 7.5,
      killParticipation: 60,
      csPerMinute: 9,
      damageShare: 35,
      visionScorePerMinute: 1.5,
    },
    expectedScore: 78,
  },
  {
    name: "E 데스적고 못함(그냥생존)",
    match: {
      result: "loss",
      kills: 1,
      deaths: 2,
      assists: 1,
      kda: 1.0,
      killParticipation: 10,
      csPerMinute: 5,
      damageShare: 5,
      visionScorePerMinute: 1.2,
    },
    expectedScore: 19,
  },
  {
    name: "F 완전폭사",
    match: {
      result: "loss",
      kills: 0,
      deaths: 18,
      assists: 1,
      kda: 0.05555555555555555,
      killParticipation: 8,
      csPerMinute: 3,
      damageShare: 5,
      visionScorePerMinute: 0.4,
    },
    expectedScore: 8,
  },
];

for (const scenario of scenarios) {
  test(`matchAiScore: ${scenario.name} 시나리오를 확정 점수로 계산한다`, () => {
    assert.equal(
      matchAiScore(scenario.match as PublicLolRecentMatch),
      scenario.expectedScore,
    );
  });
}

import type { GamesLocale } from "./i18n/games-i18n";

/* 미니게임 레지스트리 — 목업 docs/mockups/reaction-test.html v3 §① 의 단일 원본.
 * 허브 그리드·게임 선택기 부제·LoL 프로필 배너가 전부 이 배열을 읽습니다.
 * 새 게임 추가 = 여기 1항목 + 게임 페이지 1개(status "coming" → "live" 전환). */

export type MiniGameStatus = "live" | "coming";

export type MiniGameDefinition = {
  id: string;
  /** 로케일 프리픽스 제외 경로. status "coming" 이면 아직 라우트가 없습니다. */
  path?: string;
  status: MiniGameStatus;
  icon: string;
  nameKo: string;
  nameJa: string;
  descriptionKo: string;
  descriptionJa: string;
  /** 점수 방향 — 반응속도(ms)는 낮을수록, 정확도류는 높을수록 좋습니다. */
  lowerIsBetter: boolean;
};

export const MINI_GAMES: MiniGameDefinition[] = [
  {
    id: "reaction",
    path: "/games/reaction",
    status: "live",
    icon: "⚡",
    nameKo: "반응속도 테스트",
    nameJa: "反応速度テスト",
    descriptionKo: "초록 신호에 최대한 빨리! 5회 평균으로 LoL 티어 등급을 받아보세요.",
    descriptionJa: "緑の信号にできるだけ早く! 5回平均でLoLティア等級を確認しましょう。",
    lowerIsBetter: true,
  },
  {
    id: "visual",
    status: "coming",
    icon: "👁",
    nameKo: "시각반응 (Go/No-Go)",
    nameJa: "視覚反応 (Go/No-Go)",
    descriptionKo: "초록이면 클릭, 빨강이면 참기 — 판별 속도와 정확도를 함께 측정합니다.",
    descriptionJa: "緑ならクリック、赤なら我慢 — 判別速度と正確度を同時に測定します。",
    lowerIsBetter: true,
  },
];

export function miniGameName(game: MiniGameDefinition, locale: GamesLocale): string {
  return locale === "ja" ? game.nameJa : game.nameKo;
}

export function miniGameDescription(game: MiniGameDefinition, locale: GamesLocale): string {
  return locale === "ja" ? game.descriptionJa : game.descriptionKo;
}

/* ── 반응속도 티어 환산(목업 §③) — 경계값 단일 원본. ── */

export type ReactionTier = {
  key: string;
  /** 이 티어가 되는 평균 ms 상한(포함). 마지막 항목은 Infinity. */
  maxMs: number;
  /** SNS 공유 "텍스트"에서만 사용 — UI 표기는 color 기반 단일 배지(목업 v7.2 리뷰: 이모지 혼용 금지). */
  emoji: string;
  /** 티어 배지 색 — UI 의 유일한 티어 시각 표기(dot/SVG). */
  color: string;
  labelKo: string;
  labelJa: string;
};

export const REACTION_TIER_TABLE: ReactionTier[] = [
  { key: "challenger", maxMs: 160, emoji: "🏆", color: "#f4c76c", labelKo: "챌린저", labelJa: "チャレンジャー" },
  { key: "grandmaster", maxMs: 175, emoji: "🔴", color: "#ff8b9c", labelKo: "그랜드마스터", labelJa: "グランドマスター" },
  { key: "master", maxMs: 190, emoji: "🟣", color: "#c9b6ff", labelKo: "마스터", labelJa: "マスター" },
  { key: "diamond", maxMs: 205, emoji: "💎", color: "#7fc7ff", labelKo: "다이아몬드", labelJa: "ダイヤモンド" },
  { key: "emerald", maxMs: 220, emoji: "🟢", color: "#7ee0bd", labelKo: "에메랄드", labelJa: "エメラルド" },
  { key: "gold", maxMs: 240, emoji: "🥇", color: "#e8c77a", labelKo: "골드", labelJa: "ゴールド" },
  { key: "silver", maxMs: 265, emoji: "🥈", color: "#cfd8e6", labelKo: "실버", labelJa: "シルバー" },
  { key: "bronze", maxMs: 300, emoji: "🥉", color: "#d3a67c", labelKo: "브론즈", labelJa: "ブロンズ" },
  { key: "iron", maxMs: Number.POSITIVE_INFINITY, emoji: "🪨", color: "#9aa4b5", labelKo: "아이언", labelJa: "アイアン" },
];

export function reactionTierForAverage(averageMs: number): ReactionTier {
  return REACTION_TIER_TABLE.find((tier) => averageMs <= tier.maxMs) ?? REACTION_TIER_TABLE[REACTION_TIER_TABLE.length - 1]!;
}

export function reactionTierLabel(tier: ReactionTier, locale: GamesLocale): string {
  return locale === "ja" ? tier.labelJa : tier.labelKo;
}

/** 상위 티어가 남아 있으면 그 경계까지 줄여야 하는 ms(양수)를 돌려줍니다. */
export function reactionMsToNextTier(averageMs: number): { tier: ReactionTier; deltaMs: number } | undefined {
  const index = REACTION_TIER_TABLE.findIndex((tier) => averageMs <= tier.maxMs);
  if (index <= 0) return undefined;
  const better = REACTION_TIER_TABLE[index - 1]!;
  return { tier: better, deltaMs: averageMs - better.maxMs };
}

/* ── 기록 저장(목업 §① 계약) — localStorage 전용, 서버 전송 없음. ── */

export type MiniGameBest = {
  /** 게임별 점수(반응속도: 평균 ms). */
  score: number;
  tierKey?: string;
  at: string;
};

function bestStorageKey(gameId: string): string {
  return `yoro.games.${gameId}.best.v1`;
}

export function readMiniGameBest(gameId: string): MiniGameBest | null {
  try {
    const raw = window.localStorage.getItem(bestStorageKey(gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MiniGameBest>;
    if (typeof parsed.score !== "number" || !Number.isFinite(parsed.score)) return null;
    return { score: parsed.score, tierKey: typeof parsed.tierKey === "string" ? parsed.tierKey : undefined, at: typeof parsed.at === "string" ? parsed.at : "" };
  } catch {
    /* 시크릿 모드 등 저장소 접근 불가 — 기록 UI 만 숨기고 게임은 정상 동작(fail-open). */
    return null;
  }
}

/* 기기 간 동기화(2026-08-17) — "내 최고 기록"의 원본은 두 곳입니다:
 * 이 브라우저(localStorage)와 계정(서버, 리더보드 me). 같은 계정을 다른 기기에서
 * 쓰면 로컬만 보던 기존 방식은 기기마다 값이 달라집니다. 리더보드를 조회하는
 * 시점(게임·랭킹 페이지, 등록 직후)마다 서버 기록을 로컬 캐시에 합류시켜
 * 표시 기준을 min(로컬, 계정)으로 맞춥니다. 로컬이 더 빠른 경우는 그대로 둡니다
 * — 이 기기에서 세운 미등록 기록이므로(자동 등록은 하지 않음, 등록은 사용자 의사).
 * 서버 미배포·비로그인에서는 me 가 없어 아무 일도 하지 않습니다(fail-open). */
export function syncMiniGameBestFromServer(
  game: MiniGameDefinition,
  server: { score: number; tierKey?: string } | undefined
): boolean {
  if (!server || !Number.isFinite(server.score)) return false;
  return writeMiniGameBest(game, { score: server.score, tierKey: server.tierKey, at: new Date().toISOString() });
}

/** 더 좋은 기록일 때만 저장하고, 갱신 여부를 돌려줍니다. */
export function writeMiniGameBest(game: MiniGameDefinition, next: MiniGameBest): boolean {
  const current = readMiniGameBest(game.id);
  const improved = !current || (game.lowerIsBetter ? next.score < current.score : next.score > current.score);
  if (!improved) return false;
  try {
    window.localStorage.setItem(bestStorageKey(game.id), JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

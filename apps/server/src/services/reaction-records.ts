/* 반응속도 기록의 순수 규칙 — 티어 경계·입력 검증·백분위.
 *
 * 티어 경계의 단일 원본은 프런트
 * apps/dashboard/src/features/public-games/registry.ts 의 REACTION_TIER_TABLE 입니다.
 * 서버가 OG 메타에 티어를 새겨야 해서 같은 값을 여기로 복제했습니다 — 한쪽만
 * 고치면 공유 이미지와 화면 배지가 어긋나므로, 경계를 바꿀 때는 두 파일을 함께
 * 고쳐야 합니다(테스트가 값 자체를 고정합니다).
 */

export type ReactionTierKey =
  | "challenger" | "grandmaster" | "master" | "diamond" | "emerald"
  | "gold" | "silver" | "bronze" | "iron";

export type ReactionTier = {
  key: ReactionTierKey;
  maxMs: number;
  emoji: string;
  labelKo: string;
  labelJa: string;
};

export const REACTION_TIER_TABLE: readonly ReactionTier[] = [
  { key: "challenger", maxMs: 160, emoji: "🏆", labelKo: "챌린저", labelJa: "チャレンジャー" },
  { key: "grandmaster", maxMs: 175, emoji: "🔴", labelKo: "그랜드마스터", labelJa: "グランドマスター" },
  { key: "master", maxMs: 190, emoji: "🟣", labelKo: "마스터", labelJa: "マスター" },
  { key: "diamond", maxMs: 205, emoji: "💎", labelKo: "다이아몬드", labelJa: "ダイヤモンド" },
  { key: "emerald", maxMs: 220, emoji: "🟢", labelKo: "에메랄드", labelJa: "エメラルド" },
  { key: "gold", maxMs: 240, emoji: "🥇", labelKo: "골드", labelJa: "ゴールド" },
  { key: "silver", maxMs: 265, emoji: "🥈", labelKo: "실버", labelJa: "シルバー" },
  { key: "bronze", maxMs: 300, emoji: "🥉", labelKo: "브론즈", labelJa: "ブロンズ" },
  { key: "iron", maxMs: Number.POSITIVE_INFINITY, emoji: "🪨", labelKo: "아이언", labelJa: "アイアン" }
];

export function reactionTierForAverage(averageMs: number): ReactionTier {
  return REACTION_TIER_TABLE.find((tier) => averageMs <= tier.maxMs)
    ?? REACTION_TIER_TABLE[REACTION_TIER_TABLE.length - 1]!;
}

/* 검증 경계 — DB CHECK 제약과 같은 값입니다. */
export const REACTION_SAMPLE_COUNT = 5;
export const REACTION_SAMPLE_MIN_MS = 120;
export const REACTION_SAMPLE_MAX_MS = 5_000;
export const REACTION_AVERAGE_MIN_MS = 120;
export const REACTION_AVERAGE_MAX_MS = 2_000;
/** 계정당 1분 1회. */
export const REACTION_SUBMIT_COOLDOWN_MS = 60_000;

export type ReactionSubmission = {
  averageMs: number;
  samples: number[];
  identity: "public" | "anonymous";
};

/**
 * 등록 요청 파싱. 형식이 조금이라도 어긋나면 undefined 이고 호출부가 400 을 냅니다.
 * averageMs 를 그대로 믿지 않고 samples 평균과 대조합니다 — 클라이언트가 보낸
 * 평균만 믿으면 임의 기록을 올릴 수 있습니다(±1 은 반올림 오차 허용).
 */
export function parseReactionSubmission(value: unknown): ReactionSubmission | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const body = value as Record<string, unknown>;

  const identity = body.identity;
  if (identity !== "public" && identity !== "anonymous") return undefined;

  const samples = body.samples;
  if (!Array.isArray(samples) || samples.length !== REACTION_SAMPLE_COUNT) return undefined;
  const parsedSamples: number[] = [];
  for (const sample of samples) {
    if (typeof sample !== "number" || !Number.isFinite(sample)) return undefined;
    const rounded = Math.round(sample);
    if (rounded < REACTION_SAMPLE_MIN_MS || rounded > REACTION_SAMPLE_MAX_MS) return undefined;
    parsedSamples.push(rounded);
  }

  const averageMs = body.averageMs;
  if (typeof averageMs !== "number" || !Number.isFinite(averageMs)) return undefined;
  const rounded = Math.round(averageMs);
  if (rounded < REACTION_AVERAGE_MIN_MS || rounded > REACTION_AVERAGE_MAX_MS) return undefined;

  const mean = Math.round(parsedSamples.reduce((sum, sample) => sum + sample, 0) / parsedSamples.length);
  if (Math.abs(mean - rounded) > 1) return undefined;

  return { averageMs: rounded, samples: parsedSamples, identity };
}

/**
 * 상위 몇 %인지. 1위는 상위 1%로 보이도록 올림하고, 표본이 1명 이하면 의미가
 * 없으므로 생략합니다(프런트에서 옵셔널).
 */
export function reactionPercentile(rank: number, total: number): number | undefined {
  if (!Number.isSafeInteger(rank) || rank < 1) return undefined;
  if (!Number.isSafeInteger(total) || total < 2) return undefined;
  return Math.max(1, Math.min(100, Math.ceil((rank / total) * 100)));
}

/** 티어별 기록 수 — 랭킹 페이지 분포 바용. 0인 티어도 자리를 지킵니다. */
export function reactionTierDistribution(
  averages: readonly number[]
): Array<{ tierKey: ReactionTierKey; count: number }> {
  const counts = new Map<ReactionTierKey, number>(
    REACTION_TIER_TABLE.map((tier) => [tier.key, 0])
  );
  for (const average of averages) {
    const tier = reactionTierForAverage(average);
    counts.set(tier.key, (counts.get(tier.key) ?? 0) + 1);
  }
  return REACTION_TIER_TABLE.map((tier) => ({ tierKey: tier.key, count: counts.get(tier.key) ?? 0 }));
}

/** 익명 표기 "#4821" — 공개 응답에서 계정을 가리키는 유일한 값이며 난수입니다. */
export function reactionAnonymousLabel(anonymousNo: number): string {
  return `#${String(anonymousNo).padStart(4, "0")}`;
}

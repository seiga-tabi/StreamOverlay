import type { LolRankedStats } from "@streamops/shared";
import { publicIntlLocale, activePublicLocale, t } from "../i18n/public-lol-i18n";
import type {
  PublicLolProfile,
  PublicLolRecentMatch,
  PublicTrendLine,
  PublicTrendPoint,
  PublicTrendAxisTick,
  PublicTrendTierBand,
} from "../types/public-lol";
import { roundTo } from "./match";

export const RECENT_ANALYSIS_MATCH_LIMIT = 20;
const LP_TREND_WINDOW_DAYS = 30;
const LP_TREND_WINDOW_MS = LP_TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const tierLabels: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
  UNRANKED: "Unranked"
};

/** LP 를 뺀 티어 이름입니다. LP 를 별도 요소로 두는 화면에서 씁니다. */
export function rankTierLabel(stats: LolRankedStats | undefined): string {
  if (!stats || stats.tier === "UNRANKED") return t().unranked;
  return `${tierLabels[stats.tier] ?? stats.tier} ${stats.rank ?? ""}`.trim();
}

export function rankLabel(stats: LolRankedStats | undefined): string {
  if (!stats || stats.tier === "UNRANKED") return t().unranked;
  return `${tierLabels[stats.tier] ?? stats.tier} ${stats.rank ?? ""} ${stats.leaguePoints} LP`.trim();
}

export function shortRankLabel(stats: LolRankedStats | undefined, emptyLabel = "JP", unrankedLabel = emptyLabel): string {
  if (!stats) return emptyLabel;
  if (stats.tier === "UNRANKED") return unrankedLabel;
  const tierInitials: Record<string, string> = {
    IRON: "I",
    BRONZE: "B",
    SILVER: "S",
    GOLD: "G",
    PLATINUM: "P",
    EMERALD: "E",
    DIAMOND: "D",
    MASTER: "M",
    GRANDMASTER: "GM",
    CHALLENGER: "C"
  };
  const rankNumbers: Record<string, string> = {
    I: "1",
    II: "2",
    III: "3",
    IV: "4"
  };
  const tier = tierInitials[stats.tier] ?? stats.tier.slice(0, 1);
  return `${tier}${stats.rank ? rankNumbers[stats.rank] ?? stats.rank : ""}`;
}

export function rankBadgeClass(stats: LolRankedStats | undefined): string {
  return `public-suggestion-rank ${stats?.tier ? stats.tier.toLocaleLowerCase() : "platform"}`;
}

export function rankTierClass(stats: LolRankedStats | undefined, state: "ready" | "loading" | "unknown" = "ready"): string {
  if (state === "loading") return "public-team-rank-badge loading";
  if (!stats) return "public-team-rank-badge unknown";
  return `public-team-rank-badge ${stats?.tier ? stats.tier.toLocaleLowerCase() : "unranked"}`;
}

export function rankTrendTierClass(stats: LolRankedStats | undefined): string {
  return `tier-${stats?.tier ? stats.tier.toLocaleLowerCase() : "unranked"}`;
}

export function matchRankBadgeLabel(stats: LolRankedStats | undefined, loading = false): string {
  if (loading) return "...";
  return shortRankLabel(stats, "-", "U");
}

export function totalGames(stats: LolRankedStats | undefined): number {
  return (stats?.wins ?? 0) + (stats?.losses ?? 0);
}

const RANK_TIER_SCORE: Record<string, number> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1200,
  PLATINUM: 1600,
  EMERALD: 2000,
  DIAMOND: 2400,
  MASTER: 2800,
  GRANDMASTER: 3200,
  CHALLENGER: 3600
};

const RANK_DIVISION_SCORE: Record<string, number> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300
};

function rankScoreFromParts(tier: string, rank: string | undefined, leaguePoints: number): number {
  if (tier === "UNRANKED") return 0;
  return (RANK_TIER_SCORE[tier] ?? 0)
    + (rank ? RANK_DIVISION_SCORE[rank] ?? 0 : 0)
    + Math.max(0, Math.trunc(leaguePoints));
}

function normalizedRankHistoryScore(point: NonNullable<PublicLolProfile["rankHistory"]>[number]): number {
  if (typeof point.tier === "string" && Number.isFinite(point.leaguePoints)) {
    return rankScoreFromParts(point.tier, point.rank, point.leaguePoints);
  }
  return Number.isFinite(point.rankScore) ? Math.max(0, point.rankScore) : 0;
}

export function rankScore(stats: LolRankedStats | undefined): number {
  if (!stats) return 0;
  return rankScoreFromParts(stats.tier, stats.rank, stats.leaguePoints);
}

const RANK_TIER_BANDS: Array<{ tier: string; base: number }> = [
  { tier: "IRON", base: 0 },
  { tier: "BRONZE", base: 400 },
  { tier: "SILVER", base: 800 },
  { tier: "GOLD", base: 1200 },
  { tier: "PLATINUM", base: 1600 },
  { tier: "EMERALD", base: 2000 },
  { tier: "DIAMOND", base: 2400 },
  { tier: "MASTER", base: 2800 },
  { tier: "GRANDMASTER", base: 3200 },
  { tier: "CHALLENGER", base: 3600 }
];

function tierBandFromScore(score: number): { tier: string; base: number } {
  return [...RANK_TIER_BANDS].reverse().find((item) => score >= item.base) ?? RANK_TIER_BANDS[0]!;
}

export function rankLabelFromScore(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return t().unranked;
  const tier = tierBandFromScore(score);
  if (tier.tier === "MASTER" || tier.tier === "GRANDMASTER" || tier.tier === "CHALLENGER") {
    return tierLabels[tier.tier] ?? tier.tier;
  }
  const remainder = Math.max(0, score - tier.base);
  const divisions = ["IV", "III", "II", "I"];
  const division = divisions[Math.min(3, Math.floor(remainder / 100))] ?? "IV";
  return `${tierLabels[tier.tier] ?? tier.tier} ${division}`;
}

/** rankScore 값이 속한 티어를 소문자 key로 돌려줍니다. LP 추이 그래프의 구간별 색상 지정에 씁니다. */
export function tierKeyFromScore(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return "unranked";
  return tierBandFromScore(score).tier.toLowerCase();
}

export function averageTierLabel(stats: Array<LolRankedStats | undefined>): string {
  const ranked = stats.filter((item): item is LolRankedStats => Boolean(item && item.tier !== "UNRANKED"));
  if (ranked.length === 0) return t().unranked;
  const averageScore = ranked.reduce((sum, item) => sum + rankScore(item), 0) / ranked.length;
  return rankLabelFromScore(averageScore);
}

function resultLabel(result: PublicLolRecentMatch["result"]): string {
  if (result === "win") return t().win;
  if (result === "loss") return t().loss;
  return t().unknown;
}

function formatShortDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(publicIntlLocale(), { month: "numeric", day: "numeric" }).format(date);
}

/* LP 는 랭크 큐에서만 움직입니다. 화면이 보여 주는 티어가 어느 큐의 것인지에
   따라 LP 를 움직일 수 있는 큐도 하나로 정해집니다. */
const TREND_QUEUE_ID_BY_RANKED_TYPE: Partial<Record<LolRankedStats["queueType"], number>> = {
  RANKED_SOLO_5x5: 420,
  RANKED_FLEX_SR: 440
};

function trendQueueId(stats: LolRankedStats | undefined): number | undefined {
  if (!stats) return undefined;
  return TREND_QUEUE_ID_BY_RANKED_TYPE[stats.queueType];
}

/* 추정 LP 그래프에 넣을 경기만 남깁니다.
 *
 * 이전에는 큐를 가리지 않고 승패만 봤습니다. 그래서 솔로랭크 기록이 하나도
 * 없어도 칼바람·일반·자유랭크 승리가 그대로 +20 으로 잡혀 LP 가 오르는 것처럼
 * 보였습니다(사용자 신고 그대로). queueId 가 없는 경기는 큐를 확인할 수 없으니
 * 넣지 않습니다 — 넣으면 같은 결함이 그대로 재발합니다.
 */
function rankedTrendMatches(
  matches: readonly PublicLolRecentMatch[],
  queueId: number | undefined
): PublicLolRecentMatch[] {
  if (queueId === undefined) return [];
  return matches.filter((match) => match.queueId === queueId);
}

function estimatedLpDelta(match: PublicLolRecentMatch): number {
  if (match.result === "win") return 20;
  if (match.result === "loss") return -18;
  return 0;
}

const rankTrendTierSteps = [
  { tier: "IRON", base: 0, code: "I" },
  { tier: "BRONZE", base: 400, code: "B" },
  { tier: "SILVER", base: 800, code: "S" },
  { tier: "GOLD", base: 1200, code: "G" },
  { tier: "PLATINUM", base: 1600, code: "P" },
  { tier: "EMERALD", base: 2000, code: "E" },
  { tier: "DIAMOND", base: 2400, code: "D" },
  { tier: "MASTER", base: 2800, code: "M" },
  { tier: "GRANDMASTER", base: 3200, code: "GM" },
  { tier: "CHALLENGER", base: 3600, code: "C" }
];

function rankTrendStepForScore(score: number): { tier: string; base: number; code: string } {
  return [...rankTrendTierSteps].reverse().find((item) => score >= item.base) ?? rankTrendTierSteps[0]!;
}

function rankTrendDivisionLabel(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return "U";
  const step = rankTrendStepForScore(score);
  if (step.tier === "MASTER" || step.tier === "GRANDMASTER" || step.tier === "CHALLENGER") return step.code;
  const divisions = ["4", "3", "2", "1"];
  const division = divisions[Math.min(3, Math.floor(Math.max(0, score - step.base) / 100))] ?? "4";
  return `${step.code}${division}`;
}

function rankTrendPointLabel(score: number): string {
  const step = rankTrendStepForScore(score);
  const lp = Math.max(0, Math.round(score - step.base));
  if (step.tier === "MASTER" || step.tier === "GRANDMASTER" || step.tier === "CHALLENGER") {
    return `${rankTrendDivisionLabel(score)} ${lp} LP`;
  }
  return `${rankTrendDivisionLabel(score)} ${Math.min(99, lp % 100)} LP`;
}

function rankTrendBandClass(score: number): string {
  const step = rankTrendStepForScore(score);
  return `tier-${step.tier.toLocaleLowerCase()}`;
}

function recentMatchesWithinWindow(matches: PublicLolRecentMatch[], windowMs: number): PublicLolRecentMatch[] {
  const cutoff = Date.now() - windowMs;
  return matches.filter((match) => {
    if (!match.startedAt) return false;
    const time = Date.parse(match.startedAt);
    return Number.isFinite(time) && time >= cutoff;
  });
}

export function rankTrendLine(profile: PublicLolProfile): PublicTrendLine | undefined {
  const windowEnd = Date.now();
  const windowStart = windowEnd - LP_TREND_WINDOW_MS;
  const currentRankScore = rankScore(profile.rankedStats);

  const storedRankSamples = (profile.rankHistory ?? [])
    .map((point, index) => {
      const startedAtMs = Date.parse(point.date);
      const value = normalizedRankHistoryScore(point);
      if (!Number.isFinite(startedAtMs) || !Number.isFinite(value)) return undefined;
      return {
        key: `${profile.riotId}:rank-history:${point.date}:${index}`,
        value,
        label: rankTrendPointLabel(value),
        result: "unknown" as PublicLolRecentMatch["result"],
        startedAtMs
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .sort((a, b) => a.startedAtMs - b.startedAtMs);
  const baselineRankSample = storedRankSamples
    .filter((point) => point.startedAtMs < windowStart)
    .at(-1);
  const historySamples = [
    ...(baselineRankSample ? [{
      ...baselineRankSample,
      key: `${baselineRankSample.key}:window-start`,
      startedAtMs: windowStart
    }] : []),
    ...storedRankSamples.filter((point) => point.startedAtMs >= windowStart && point.startedAtMs <= windowEnd)
  ];
  const samples = historySamples.length >= 2 ? historySamples : (() => {
    /* 화면에 표시 중인 티어가 속한 랭크 큐의 경기만 LP 를 움직입니다. */
    const trendQueue = trendQueueId(profile.rankedStats);
    const filteredMatches = rankedTrendMatches(
      recentMatchesWithinWindow(profile.recentMatches, LP_TREND_WINDOW_MS),
      trendQueue
    );
    /* 자르고 나서 거릅니다 — 걸러 놓고 20개를 채우면 조회 구간이 조용히
       과거로 늘어납니다. "최근 20경기 중 랭크" 라는 원래 범위를 지킵니다. */
    const fallbackMatches = rankedTrendMatches(
      profile.recentMatches.slice(0, RECENT_ANALYSIS_MATCH_LIMIT),
      trendQueue
    );
    const matches = (filteredMatches.length > 0 ? filteredMatches : fallbackMatches).slice().reverse();
    if (matches.length === 0 && currentRankScore <= 0) return [];
    const totalDelta = matches.reduce((sum, match) => sum + estimatedLpDelta(match), 0);
    const startingRankScore = Math.max(0, currentRankScore - totalDelta);
    let runningRankScore = startingRankScore;
    const fallbackStepMs = matches.length > 1 ? LP_TREND_WINDOW_MS / (matches.length - 1) : 0;
    const matchSamples = matches.map((match, index) => {
      runningRankScore += estimatedLpDelta(match);
      const displayValue = Math.max(0, runningRankScore);
      const parsedStartedAt = Date.parse(match.startedAt ?? "");
      const startedAtMs = Number.isFinite(parsedStartedAt)
        ? parsedStartedAt
        : matches.length === 1 ? windowEnd : windowStart + fallbackStepMs * index;
      return {
        key: `${match.matchId}:lp:${index}`,
        value: displayValue,
        label: `${resultLabel(match.result)} · ${rankTrendPointLabel(displayValue)}`,
        result: match.result,
        startedAtMs
      };
    });
    const currentDisplayRankScore = currentRankScore > 0
      ? currentRankScore
      : matchSamples[matchSamples.length - 1]?.value ?? 0;
    return matchSamples.length > 0
      ? [
          {
            key: `${profile.riotId}:lp:start`,
            value: startingRankScore,
            label: rankTrendPointLabel(startingRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowStart
          },
          ...matchSamples,
          {
            key: `${profile.riotId}:lp:current`,
            value: currentDisplayRankScore,
            label: rankTrendPointLabel(currentDisplayRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowEnd
          }
        ]
      : [
          {
            key: `${profile.riotId}:lp:start`,
            value: currentRankScore,
            label: rankTrendPointLabel(currentRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowStart
          },
          {
            key: `${profile.riotId}:lp:current`,
            value: currentRankScore,
            label: rankTrendPointLabel(currentRankScore),
            result: "unknown" as PublicLolRecentMatch["result"],
            startedAtMs: windowEnd
          }
        ];
  })();

  if (samples.length === 0) return undefined;
  const width = 320;
  const plotLeft = 52;
  const plotRight = 12;
  const plotTop = 12;
  const plotBottom = 140;
  const sampleTimes = samples
    .map((point) => point.startedAtMs)
    .filter((startedAtMs) => Number.isFinite(startedAtMs));
  const dataStart = sampleTimes.length > 0 ? Math.min(...sampleTimes) : windowStart;
  const dataEnd = sampleTimes.length > 0 ? Math.max(...sampleTimes) : windowEnd;
  const dataSpan = Math.max(0, dataEnd - dataStart);
  const useDataDomain = sampleTimes.length >= 2 && dataSpan > 0 && dataSpan < LP_TREND_WINDOW_MS * .72;
  const domainPadding = useDataDomain ? Math.max(LP_TREND_WINDOW_MS * .035, dataSpan * .16) : 0;
  const domainStart = useDataDomain ? Math.max(windowStart, dataStart - domainPadding) : windowStart;
  const domainEnd = useDataDomain ? Math.min(windowEnd, dataEnd + domainPadding) : windowEnd;
  const domainSpan = Math.max(1, domainEnd - domainStart);
  const domainMiddle = domainStart + (domainSpan / 2);
  const rawMin = Math.min(...samples.map((point) => point.value));
  const rawMax = Math.max(...samples.map((point) => point.value));
  const rawRange = Math.max(0, rawMax - rawMin);
  const scorePadding = Math.max(20, rawRange * .14);
  let min = Math.max(0, Math.floor((rawMin - scorePadding) / 25) * 25);
  let max = Math.ceil((rawMax + scorePadding) / 25) * 25;
  if (max - min < 100) {
    const center = (rawMin + rawMax) / 2;
    min = Math.max(0, Math.floor((center - 50) / 25) * 25);
    max = Math.max(min + 100, Math.ceil((center + 50) / 25) * 25);
  }
  const range = Math.max(1, max - min);
  const yForScore = (score: number) => plotTop + (1 - ((score - min) / range)) * (plotBottom - plotTop);
  const tierBands: PublicTrendTierBand[] = [];
  for (let start = Math.floor(min / 100) * 100; start < max; start += 100) {
    const visibleStart = Math.max(start, min);
    const visibleEnd = Math.min(start + 100, max);
    const top = yForScore(visibleEnd);
    const bottom = yForScore(visibleStart);
    if (bottom <= top) continue;
    const middle = visibleStart + ((visibleEnd - visibleStart) / 2);
    tierBands.push({
      key: `${visibleStart}:${visibleEnd}`,
      x: plotLeft,
      y: roundTo(top, 1),
      width: width - plotLeft - plotRight,
      height: roundTo(bottom - top, 1),
      label: rankTrendDivisionLabel(middle),
      className: rankTrendBandClass(middle)
    });
  }
  const axisTickScores = [max, Math.round(((min + max) / 2) / 25) * 25, min]
    .filter((value, index, values) => values.indexOf(value) === index);
  const axisTicks = axisTickScores.map((score): PublicTrendAxisTick => ({
    key: `${score}`,
    x1: plotLeft,
    x2: width - plotRight,
    y: roundTo(yForScore(score), 1),
    label: rankTrendPointLabel(score)
  }));
  const points = samples.map((point): PublicTrendPoint => {
    const rawTimeRatio = Number.isFinite(point.startedAtMs) ? (point.startedAtMs - domainStart) / domainSpan : .5;
    const timeRatio = samples.length === 1 ? .5 : Math.max(0, Math.min(1, rawTimeRatio));
    const x = plotLeft + timeRatio * (width - plotLeft - plotRight);
    const y = yForScore(point.value);
    return {
      key: point.key,
      x: roundTo(x, 1),
      y: roundTo(y, 1),
      value: point.value,
      label: point.label,
      result: point.result
    };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseY = plotBottom;
  const areaPath = points.length === 1
    ? `M ${points[0]!.x} ${baseY} L ${points[0]!.x} ${points[0]!.y} L ${points[0]!.x} ${baseY} Z`
    : `M ${points[0]!.x} ${baseY} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1]!.x} ${baseY} Z`;

  return {
    points,
    tierBands,
    axisTicks,
    linePoints,
    areaPath,
    change: Math.round((points.at(-1)?.value ?? 0) - (points[0]?.value ?? 0)),
    sampleCount: points.length,
    latestLabel: rankTrendPointLabel(points.at(-1)?.value ?? 0),
    startLabel: formatShortDate(new Date(domainStart).toISOString()),
    middleLabel: formatShortDate(new Date(domainMiddle).toISOString()),
    endLabel: formatShortDate(new Date(domainEnd).toISOString())
  };
}

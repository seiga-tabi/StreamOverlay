import type { LolRankedStats } from "@streamops/shared";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import type {
  PublicLolProfile,
  PublicLolRecentMatch,
  PublicTrendLine,
  PublicTrendPoint,
  PublicTrendTierBand,
  PublicTrendTierBoundary,
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

export function rankScore(stats: LolRankedStats | undefined): number {
  if (!stats || stats.tier === "UNRANKED") return 0;
  const tierScore: Record<string, number> = {
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
  const divisionScore: Record<string, number> = {
    IV: 0,
    III: 100,
    II: 200,
    I: 300
  };
  return (tierScore[stats.tier] ?? 0) + (stats.rank ? divisionScore[stats.rank] ?? 0 : 0) + stats.leaguePoints;
}

export function rankLabelFromScore(score: number): string {
  if (!Number.isFinite(score) || score <= 0) return t().unranked;
  const tiers = [
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
  const tier = [...tiers].reverse().find((item) => score >= item.base) ?? { tier: "IRON", base: 0 };
  if (tier.tier === "MASTER" || tier.tier === "GRANDMASTER" || tier.tier === "CHALLENGER") {
    return tierLabels[tier.tier] ?? tier.tier;
  }
  const remainder = Math.max(0, score - tier.base);
  const divisions = ["IV", "III", "II", "I"];
  const division = divisions[Math.min(3, Math.floor(remainder / 100))] ?? "IV";
  return `${tierLabels[tier.tier] ?? tier.tier} ${division}`;
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
  return new Intl.DateTimeFormat(activePublicLocale === "ja" ? "ja-JP" : "ko-KR", { month: "numeric", day: "numeric" }).format(date);
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

function rankTrendAxisLabels(minScore: number, maxScore: number): string[] {
  const minTick = Math.floor(minScore / 100) * 100;
  const maxTick = Math.ceil(maxScore / 100) * 100;
  const middleTick = Math.round(((minTick + maxTick) / 2) / 100) * 100;
  return [maxTick, middleTick, minTick]
    .filter((value, index, values) => values.indexOf(value) === index)
    .map(rankTrendDivisionLabel);
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
      const value = Number.isFinite(point.rankScore) ? point.rankScore : undefined;
      if (!Number.isFinite(startedAtMs) || value === undefined) return undefined;
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
    const filteredMatches = recentMatchesWithinWindow(profile.recentMatches, LP_TREND_WINDOW_MS);
    const matches = (filteredMatches.length > 0 ? filteredMatches : profile.recentMatches.slice(0, RECENT_ANALYSIS_MATCH_LIMIT)).slice().reverse();
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
  const height = 168;
  const plotLeft = 36;
  const plotRight = 20;
  const padY = 16;
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
  const min = Math.floor(rawMin / 100) * 100;
  const max = Math.max(min + 100, Math.ceil(rawMax / 100) * 100);
  const range = Math.max(1, max - min);
  const yForScore = (score: number) => padY + (1 - ((score - min) / range)) * (height - padY * 2);
  const bandYForScore = (score: number) => (1 - ((score - min) / range)) * height;
  const tierBands: PublicTrendTierBand[] = [];
  for (let start = min; start < max; start += 100) {
    const end = Math.min(start + 100, max);
    const top = Math.max(0, bandYForScore(end));
    const bottom = Math.min(height, bandYForScore(start));
    if (bottom <= top) continue;
    const middle = start + ((end - start) / 2);
    tierBands.push({
      key: `${start}:${end}`,
      x: 0,
      y: roundTo(top, 1),
      width,
      height: roundTo(bottom - top, 1),
      label: rankTrendDivisionLabel(middle),
      className: rankTrendBandClass(middle)
    });
  }
  const tierBoundaries: PublicTrendTierBoundary[] = [];
  for (let boundary = min + 100; boundary < max; boundary += 100) {
    tierBoundaries.push({
      key: `${boundary}`,
      x1: 0,
      x2: width,
      y: roundTo(bandYForScore(boundary), 1)
    });
  }
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
  const baseY = height - padY;
  const areaPath = points.length === 1
    ? `M ${points[0]!.x} ${baseY} L ${points[0]!.x} ${points[0]!.y} L ${points[0]!.x} ${baseY} Z`
    : `M ${points[0]!.x} ${baseY} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points[points.length - 1]!.x} ${baseY} Z`;

  return {
    points,
    tierBands,
    tierBoundaries,
    linePoints,
    areaPath,
    yLabels: rankTrendAxisLabels(rawMin, rawMax),
    startLabel: formatShortDate(new Date(domainStart).toISOString()),
    middleLabel: formatShortDate(new Date(domainMiddle).toISOString()),
    endLabel: formatShortDate(new Date(domainEnd).toISOString())
  };
}

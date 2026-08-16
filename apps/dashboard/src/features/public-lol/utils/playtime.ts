import type { PublicLolRecentMatch } from "../types/public-lol";

/* 플레이 시간대 요약 — 프로필 사이드바 "플레이 시간대" 카드의 데이터원.
 * 근거: docs/mockups/lol-profile-playtime-card.html
 *
 * 이미 받은 recentMatches(최근 20경기)의 startedAt·result 만 씁니다(추가 API 없음).
 * 시간대는 뷰어 로컬이 아니라 플랫폼 기준으로 고정합니다 — 남의 프로필을 봐도
 * 그 소환사의 생활 시간이 나오게. 큐는 거르지 않습니다: 생활 패턴이므로
 * 칼바람·일반도 포함합니다(LP 추이와 반대의 판단이며, 의도입니다).
 */

export type PlaytimeBandKey = "dawn" | "morning" | "day" | "afternoon" | "evening" | "night";

export type PlaytimeBand = {
  key: PlaytimeBandKey;
  /** 구간 시작 시(현지). 4시간 구간이며 night(22)는 자정을 넘어 02 에 끝납니다. */
  startHour: number;
  games: number;
  wins: number;
};

export type PlaytimeSummary = {
  /** startedAt 이 유효한 경기 수 — 카드의 모든 수치의 분모입니다. */
  totalGames: number;
  /** 현지 시간 0~23시별 게임 수. 스트립 막대의 높이입니다. */
  hourly: number[];
  peak?: PlaytimeBand;
  /** peak 의 전체 대비 비중(%). */
  peakShare: number;
  /** peak 구간 승률(%). thinSample 이면 undefined — 과신 방지. */
  peakWinRate?: number;
  /** peak 를 뺀 나머지 중 게임 수 상위 구간(3판 이상만, 최대 2개). */
  others: Array<PlaytimeBand & { winRate: number }>;
  /** 전체 10게임 미만 — 승률 계열을 모두 숨깁니다. */
  thinSample: boolean;
  /** 주 시간대가 아닌 구간이 확실히 더 잘 풀릴 때만 존재합니다. */
  insight?: { band: PlaytimeBand; winRate: number; diffPoints: number };
  /** peak 가 06–18시에 시작하면 낮 성향(해 아이콘·주황 틴트). */
  daytime: boolean;
};

/* 구간 시작시. night 만 자정을 넘습니다(22–02). */
const BAND_STARTS: Array<{ key: PlaytimeBandKey; startHour: number }> = [
  { key: "dawn", startHour: 2 },
  { key: "morning", startHour: 6 },
  { key: "day", startHour: 10 },
  { key: "afternoon", startHour: 14 },
  { key: "evening", startHour: 18 },
  { key: "night", startHour: 22 }
];

const BAND_SPAN_HOURS = 4;
/* 표본 규칙 — 패치노트 게이지의 THIN_SAMPLE_GAMES, 지표 카드의 sampleShort 와 같은 계열. */
const THIN_SAMPLE_TOTAL = 10;
const MIN_BAND_GAMES = 3;
const INSIGHT_MIN_DIFF_POINTS = 15;

/* 서비스 대상 플랫폼은 kr·jp1(둘 다 UTC+9)입니다. 모르는 플랫폼도 +9 로 둡니다 —
   억지 근사보다는, 대상 플랫폼을 늘릴 때 여기에 항목을 추가하는 것이 단일 원본입니다. */
const PLATFORM_UTC_OFFSET_HOURS: Record<string, number> = {
  kr: 9,
  jp1: 9
};
const DEFAULT_UTC_OFFSET_HOURS = 9;

export function platformUtcOffsetHours(lolPlatform: string | undefined): number {
  if (!lolPlatform) return DEFAULT_UTC_OFFSET_HOURS;
  return PLATFORM_UTC_OFFSET_HOURS[lolPlatform.toLowerCase()] ?? DEFAULT_UTC_OFFSET_HOURS;
}

/** 표기용 시간대 이름. kr→KST, jp1→JST — pill 에 그대로 씁니다. */
export function platformTimezoneLabel(lolPlatform: string | undefined): string {
  const platform = lolPlatform?.toLowerCase();
  if (platform === "kr") return "KST";
  if (platform === "jp1") return "JST";
  return `UTC+${platformUtcOffsetHours(lolPlatform)}`;
}

function bandForHour(hour: number): PlaytimeBandKey {
  /* night 는 22·23·0·1 시 — 자정 경계만 예외 처리하면 나머지는 등간격입니다. */
  if (hour >= 22 || hour < 2) return "night";
  if (hour < 6) return "dawn";
  if (hour < 10) return "morning";
  if (hour < 14) return "day";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function playtimeSummary(
  matches: readonly PublicLolRecentMatch[],
  lolPlatform: string | undefined
): PlaytimeSummary {
  const offsetMs = platformUtcOffsetHours(lolPlatform) * 3_600_000;
  const hourly = Array.from({ length: 24 }, () => 0);
  const bands = new Map<PlaytimeBandKey, PlaytimeBand>(
    BAND_STARTS.map(({ key, startHour }) => [key, { key, startHour, games: 0, wins: 0 }])
  );

  let totalGames = 0;
  for (const match of matches) {
    const startedAtMs = Date.parse(match.startedAt ?? "");
    if (!Number.isFinite(startedAtMs)) continue;
    /* UTC ms 에 고정 오프셋을 더한 뒤 getUTCHours() — 뷰어 브라우저의 시간대와
       무관하게 항상 플랫폼 현지 시가 나옵니다(getHours() 를 쓰면 뷰어 기준이 되어
       같은 프로필이 보는 사람마다 달라집니다). */
    const localHour = new Date(startedAtMs + offsetMs).getUTCHours();
    totalGames += 1;
    hourly[localHour] = (hourly[localHour] ?? 0) + 1;
    const band = bands.get(bandForHour(localHour))!;
    band.games += 1;
    if (match.result === "win") band.wins += 1;
  }

  /* peak = 게임 수 최다. 동수면 구간 정의 순서(dawn→night)의 앞쪽 — 결정적이어야
     같은 데이터에 같은 카드가 나옵니다. */
  let peak: PlaytimeBand | undefined;
  for (const { key } of BAND_STARTS) {
    const band = bands.get(key)!;
    if (band.games === 0) continue;
    if (!peak || band.games > peak.games) peak = band;
  }

  const thinSample = totalGames < THIN_SAMPLE_TOTAL;
  const rate = (band: PlaytimeBand): number => Math.round((band.wins / band.games) * 100);

  const others = thinSample || !peak
    ? []
    : BAND_STARTS
      .map(({ key }) => bands.get(key)!)
      .filter((band) => band.key !== peak!.key && band.games >= MIN_BAND_GAMES)
      .sort((a, b) => b.games - a.games)
      .slice(0, 2)
      .map((band) => ({ ...band, winRate: rate(band) }));

  /* 인사이트 — 항상 띄우면 소음입니다. 주 시간대보다 확실히(15%p↑) 잘 풀리는
     구간이 있고 양쪽 다 3판 이상일 때만. */
  let insight: PlaytimeSummary["insight"];
  if (!thinSample && peak && peak.games >= MIN_BAND_GAMES) {
    const peakRate = rate(peak);
    for (const candidate of others) {
      const diffPoints = candidate.winRate - peakRate;
      if (diffPoints >= INSIGHT_MIN_DIFF_POINTS && (!insight || candidate.winRate > insight.winRate)) {
        insight = { band: candidate, winRate: candidate.winRate, diffPoints };
      }
    }
  }

  return {
    totalGames,
    hourly,
    peak,
    peakShare: peak && totalGames > 0 ? Math.round((peak.games / totalGames) * 100) : 0,
    peakWinRate: peak && !thinSample ? rate(peak) : undefined,
    others,
    thinSample,
    insight,
    daytime: peak ? peak.startHour >= 6 && peak.startHour < 18 : false
  };
}

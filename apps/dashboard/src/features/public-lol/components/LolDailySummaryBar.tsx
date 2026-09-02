import type { ReactNode } from "react";
import { publicIntlLocale, publicI18n, t, activePublicLocale } from "../i18n/public-lol-i18n";
import type { PublicLolRecentMatch } from "../types/public-lol";

/* 전적 리스트의 "그날의 종합"(A안) — 로컬 날짜 경계마다 슬림 요약 바를 끼웁니다.
 *
 * 날짜는 사용자 기기 타임존 기준(startedAt), 요약은 화면에 보이는(필터 반영) 목록의
 * 합계입니다. 승패 점 막대는 시간순(왼쪽=이른 경기)으로 그날의 흐름을 보여줍니다.
 * 근거: docs/mockups/lol-daily-summary.html §A안 */

export type LolDailySummary = {
  /** 로컬 날짜 키(YYYY-MM-DD) — 그룹 식별용 */
  key: string;
  /** 0=오늘, 1=어제, 그 외 n일 전 */
  dayOffset: number;
  date: Date;
  games: number;
  wins: number;
  losses: number;
  /** result=unknown 만 있으면 undefined(표기 생략) */
  winRatePercent: number | undefined;
  /** 데스 합 0이면 "perfect" */
  averageKda: number | "perfect";
  /** 시간순(이른 경기부터) 승패 — 점 막대용 */
  results: readonly ("win" | "loss" | "remake" | "unknown")[];
};

export type LolDailyMatchGroup = {
  /** startedAt 이 없는 꼬리 그룹은 summary 없이 행만 이어집니다. */
  summary: LolDailySummary | undefined;
  matchCount: number;
};

function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 최신순 매치 목록을 로컬 날짜 그룹으로 자릅니다(목록 순서 보존, 1:1 연속 구간). */
export function groupLolMatchesByLocalDay(
  matches: readonly PublicLolRecentMatch[],
  now: Date = new Date(),
): LolDailyMatchGroup[] {
  const groups: LolDailyMatchGroup[] = [];
  const todayStart = localDayStart(now);
  for (const match of matches) {
    const startedAt = match.startedAt ? Date.parse(match.startedAt) : Number.NaN;
    if (!Number.isFinite(startedAt)) {
      /* 시각이 없는 매치는 요약 없이 이어 붙입니다 — 잘못된 날짜로 묶는 것보다 정직합니다. */
      const tail = groups.at(-1);
      if (tail && tail.summary === undefined) tail.matchCount += 1;
      else groups.push({ summary: undefined, matchCount: 1 });
      continue;
    }
    const date = new Date(startedAt);
    const key = localDayKey(date);
    const current = groups.at(-1);
    if (current?.summary?.key === key) {
      const summary = current.summary;
      current.matchCount += 1;
      summary.games += 1;
      if (match.result === "win") summary.wins += 1;
      if (match.result === "loss") summary.losses += 1;
      summary.results = [match.result, ...summary.results];
      continue;
    }
    groups.push({
      matchCount: 1,
      summary: {
        key,
        date,
        dayOffset: Math.max(0, Math.round((todayStart - localDayStart(date)) / 86_400_000)),
        games: 1,
        wins: match.result === "win" ? 1 : 0,
        losses: match.result === "loss" ? 1 : 0,
        winRatePercent: undefined,
        averageKda: 0,
        results: [match.result],
      },
    });
  }
  for (const group of groups) {
    const summary = group.summary;
    if (!summary) continue;
    const decided = summary.wins + summary.losses;
    summary.winRatePercent = decided > 0 ? Math.round((summary.wins / decided) * 100) : undefined;
  }
  return groups;
}

/** 합산 KDA — (킬+어시)/데스, 데스 0이면 perfect. */
function summaryAverageKda(matches: readonly PublicLolRecentMatch[]): number | "perfect" {
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  for (const match of matches) {
    kills += match.kills;
    deaths += match.deaths;
    assists += match.assists;
  }
  if (deaths === 0) return "perfect";
  return Math.round(((kills + assists) / deaths) * 100) / 100;
}

function dayLabel(summary: LolDailySummary): { title: string; date: string } {
  const locale = publicIntlLocale();
  const date = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", weekday: "short" })
    .format(summary.date);
  if (summary.dayOffset === 0) return { title: t().dailyToday, date };
  if (summary.dayOffset === 1) return { title: t().dailyYesterday, date };
  return { title: date, date: "" };
}

function winRateToneClass(percent: number): string {
  if (percent >= 60) return "is-hot";
  if (percent <= 40) return "is-cold";
  return "";
}

export function LolDailySummaryBar({ summary }: { summary: LolDailySummary }) {
  const label = dayLabel(summary);
  const winInitial = t().winShort;
  const lossInitial = t().lossShort;
  const kda = summary.averageKda;
  return (
    <div
      aria-label={`${t().dailySummaryLabel} — ${label.title} ${label.date}`.trim()}
      className="public-match-day-summary"
      data-ja={publicI18n.ja.dailySummaryLabel}
      data-ko={publicI18n.ko.dailySummaryLabel}
      data-testid="lol-daily-summary"
    >
      <span className="public-match-day-summary__date">
        <strong>{label.title}</strong>
        {label.date ? <small>{label.date}</small> : null}
      </span>
      <span className="public-match-day-summary__record">
        {summary.games}{t().games}
        {" "}
        <b className="is-win">{summary.wins}{winInitial}</b>
        {" "}
        <b className="is-loss">{summary.losses}{lossInitial}</b>
      </span>
      {summary.winRatePercent !== undefined ? (
        <>
          <span aria-hidden="true" className="public-match-day-summary__sep" />
          <span className={`public-match-day-summary__rate ${winRateToneClass(summary.winRatePercent)}`}>
            {t().winRate} {summary.winRatePercent}%
          </span>
        </>
      ) : null}
      <span aria-hidden="true" className="public-match-day-summary__sep" />
      <span className="public-match-day-summary__kda">
        {t().matchSummaryAverageKda} <b>{kda === "perfect" ? "Perfect" : kda.toFixed(2)}</b>
      </span>
      {/* 시간순 승패 점 — 수치 없이도 그날의 흐름(연승·연패)이 보입니다. */}
      <span aria-hidden="true" className="public-match-day-summary__dots">
        {summary.results.map((result, index) => (
          <i className={result === "win" ? "is-win" : result === "loss" ? "is-loss" : ""} key={index} />
        ))}
      </span>
    </div>
  );
}

/** 매치 목록과 1:1 로 만든 행 배열 사이에 날짜 요약 바를 끼워 넣습니다. */
export function withLolDailySummaryBars(
  matches: readonly PublicLolRecentMatch[],
  rows: readonly ReactNode[],
): ReactNode[] {
  if (matches.length !== rows.length || matches.length === 0) return [...rows];
  const groups = groupLolMatchesByLocalDay(matches);
  const output: ReactNode[] = [];
  let index = 0;
  for (const group of groups) {
    const dayMatches = matches.slice(index, index + group.matchCount);
    if (group.summary) {
      group.summary.averageKda = summaryAverageKda(dayMatches);
      output.push(<LolDailySummaryBar key={`day:${group.summary.key}`} summary={group.summary} />);
    }
    for (let offset = 0; offset < group.matchCount; offset += 1) {
      output.push(rows[index + offset]);
    }
    index += group.matchCount;
  }
  return output;
}

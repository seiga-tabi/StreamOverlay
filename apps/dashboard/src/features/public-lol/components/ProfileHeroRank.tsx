import { useId } from "react";

export type ProfileHeroRankQueue = {
  id: string;
  label: string;
  ranked: boolean;
  /** UNRANKED 를 제외한 소문자 tier 값. 크레스트 tint 와 게이지 색에 씁니다. */
  tierKey: string;
  tierIconUrl?: string;
  tierFallbackLabel: string;
  /** 세그먼트 우측 보조값. 랭크는 "1,636 LP", 언랭크는 "언랭크". */
  segmentValue: string;
  rankLabel: string;
  leaguePointsLabel?: string;
  wins: number;
  losses: number;
  winsLabel: string;
  lossesLabel: string;
  winRate: number;
  recordCaption: string;
  /** 다음 티어까지 남은 거리. 없으면 게이지를 그리지 않습니다. */
  goal?: { label: string; percent: number };
  unrankedDescription?: string;
};

export type ProfileHeroRankTrendPoint = {
  value: number;
  /** 소문자 tier key. 세그먼트 색상을 CSS 변수 --tier-lp-{key} 로 찾는 데 씁니다. */
  tierKey: string;
};

export type ProfileHeroRankTrend = {
  /** 시간순 LP 표본. 2개 미만이면 그리지 않습니다. */
  points: ProfileHeroRankTrendPoint[];
  changeLabel: string;
  changeTone: "up" | "down" | "flat";
  ariaLabel: string;
};

export type ProfileHeroRankText = {
  queueSwitcherLabel: string;
  unrankedTitle: string;
  viewRecentMatchesLabel: string;
  lpTrendLabel: string;
};

export type ProfileHeroRankProps = {
  queues: ProfileHeroRankQueue[];
  activeQueueId: string;
  text: ProfileHeroRankText;
  /** LP 추이 스파크라인. 없거나 표본이 부족하면 해당 칸을 그리지 않습니다. */
  trend?: ProfileHeroRankTrend;
  onSelectQueue: (id: string) => void;
  onViewRecentMatches?: () => void;
};

const SPARKLINE_WIDTH = 176;
const SPARKLINE_HEIGHT = 44;
const SPARKLINE_PADDING = 3;

function tierLpColor(tierKey: string): string {
  return `var(--tier-lp-${tierKey}, var(--tier-color))`;
}

function LpSparkline({ trend }: { trend: ProfileHeroRankTrend }) {
  const gradientId = useId();
  const { points } = trend;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const span = Math.max(1, max - min);
  const innerWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2;
  const innerHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2;
  const coords = points.map((point, index) => ({
    x: SPARKLINE_PADDING + (index * innerWidth) / (points.length - 1),
    y: SPARKLINE_HEIGHT - SPARKLINE_PADDING - ((point.value - min) / span) * innerHeight,
    tierKey: point.tierKey,
  }));
  // 각 구간은 "도착 지점"의 티어 색으로 칠합니다. 예: 골드→플래티넘 승급 지점부터 플래티넘 색이 시작되고,
  // 이미 지나간 골드 구간은 되돌아가 다시 칠하지 않습니다.
  const segments = coords.slice(1).map((to, index) => ({ from: coords[index]!, to }));
  const area = `${SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING} ${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")} ${SPARKLINE_WIDTH - SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING}`;
  const last = coords.at(-1) ?? { x: SPARKLINE_PADDING, y: SPARKLINE_HEIGHT - SPARKLINE_PADDING, tierKey: "unranked" };
  // 구간 경계마다 같은 offset 에 두 stop 을 겹쳐 그라디언트가 부드럽게 섞이지 않고 색이 바로 전환되도록 합니다.
  const gradientStops = segments.slice(0, -1).flatMap((segment, index) => {
    const boundaryOffset = (segment.to.x / SPARKLINE_WIDTH) * 100;
    return [
      <stop key={`${index}-out`} offset={`${boundaryOffset.toFixed(1)}%`} stopColor={tierLpColor(segment.to.tierKey)} />,
      <stop key={`${index}-in`} offset={`${boundaryOffset.toFixed(1)}%`} stopColor={tierLpColor(segments[index + 1]!.to.tierKey)} />,
    ];
  });

  return (
    <svg
      aria-label={trend.ariaLabel}
      className="public-profile-hero-sparkline"
      role="img"
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2={SPARKLINE_WIDTH} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={tierLpColor(segments[0]?.to.tierKey ?? last.tierKey)} />
          {gradientStops}
          <stop offset="100%" stopColor={tierLpColor(segments.at(-1)?.to.tierKey ?? last.tierKey)} />
        </linearGradient>
      </defs>
      <polygon className="area" fill={`url(#${gradientId})`} points={area} />
      {segments.map((segment, index) => (
        <line
          className="line"
          key={index}
          stroke={tierLpColor(segment.to.tierKey)}
          strokeLinecap="round"
          strokeWidth="2"
          x1={segment.from.x.toFixed(1)}
          x2={segment.to.x.toFixed(1)}
          y1={segment.from.y.toFixed(1)}
          y2={segment.to.y.toFixed(1)}
        />
      ))}
      {coords.slice(1, -1).map((point, index) => (
        point.tierKey !== coords[index]!.tierKey ? (
          <circle
            className="tier-change"
            cx={point.x.toFixed(1)}
            cy={point.y.toFixed(1)}
            key={`change-${index}`}
            r="3.5"
            stroke={tierLpColor(point.tierKey)}
          />
        ) : null
      ))}
      <circle className="head" cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="3" fill={tierLpColor(last.tierKey)} />
    </svg>
  );
}

const DONUT_RADIUS = 27;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function WinRateDonut({ percent, label }: { percent: number; label: string }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <span className="public-profile-hero-donut">
      <svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">
        <circle className="track" cx="30" cy="30" r={DONUT_RADIUS} fill="none" strokeWidth="5" />
        <circle
          className="value"
          cx="30"
          cy="30"
          r={DONUT_RADIUS}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${((DONUT_CIRCUMFERENCE * safe) / 100).toFixed(1)} ${DONUT_CIRCUMFERENCE.toFixed(1)}`}
        />
      </svg>
      <b aria-hidden="true">{label}</b>
    </span>
  );
}

export function ProfileHeroRank({
  queues,
  activeQueueId,
  text,
  trend,
  onSelectQueue,
  onViewRecentMatches,
}: ProfileHeroRankProps) {
  /* 목업 page-4(v21~v22): 큐 전환 세그먼트 대신 솔로/자유/5:5 세 카드를 나란히.
     각 카드 = 큐명 · 티어 크레스트(티어색) · 승률 도넛(승=청자/패=홍옥) ·
     티어명(티어색) · LP·승패 기록 · (표본이 있는 큐만) 분절 LP 스파크라인.
     LP 추이(rankHistory)는 현재 솔로 랭크 기준 단일 시계열이라 솔로 카드에만
     그립니다 — 큐별 시계열은 서버 확장 대상(핸드오프 기록). onSelectQueue 와
     activeQueueId 는 호출부 호환을 위해 받지만 카드형에서는 쓰지 않습니다. */
  void activeQueueId;
  void onSelectQueue;
  if (queues.length === 0) return null;

  return (
    <div aria-label={text.queueSwitcherLabel} className="public-profile-hero-rank public-profile-hero-rank--cards" role="group">
      {queues.map((queue) => (
        <section
          className={`public-hero-rank-card${queue.ranked ? "" : " is-unranked"}`}
          data-tier={queue.ranked ? queue.tierKey : "unranked"}
          key={queue.id}
        >
          <span className="public-hero-rank-card-queue">{queue.label}</span>
          <span className="public-hero-rank-card-row">
            <span className="public-profile-hero-crest">
              {queue.ranked && queue.tierIconUrl
                ? <img src={queue.tierIconUrl} alt="" />
                : <b aria-hidden="true">{queue.tierFallbackLabel}</b>}
            </span>
            {queue.ranked ? <WinRateDonut percent={queue.winRate} label={`${queue.winRate}%`} /> : null}
            <span className="public-hero-rank-card-copy">
              <b className="public-hero-rank-card-tier">{queue.ranked ? queue.rankLabel : text.unrankedTitle}</b>
              {queue.ranked ? (
                <span className="public-hero-rank-card-record">
                  {queue.leaguePointsLabel}
                  {" · "}
                  <em>{queue.wins}{queue.winsLabel}</em>
                  {" "}
                  <i>{queue.losses}{queue.lossesLabel}</i>
                </span>
              ) : (
                <span className="public-hero-rank-card-record">{queue.unrankedDescription ?? queue.recordCaption}</span>
              )}
              {queue.ranked && queue.goal ? (
                <span className="public-profile-hero-goal">
                  <span>{queue.goal.label}</span>
                  <span aria-hidden="true" className="public-profile-hero-goal-track">
                    <em style={{ width: `${Math.max(0, Math.min(100, queue.goal.percent))}%` }} />
                  </span>
                </span>
              ) : null}
            </span>
          </span>
          {queue.id === "solo" && trend && trend.points.length > 1 ? (
            <span className="public-hero-rank-card-trend">
              <span className="public-hero-rank-card-trend-label">
                {text.lpTrendLabel}
                <b data-tone={trend.changeTone}>{trend.changeLabel}</b>
              </span>
              <LpSparkline trend={trend} />
            </span>
          ) : null}
          {!queue.ranked && onViewRecentMatches ? (
            <button className="public-profile-hero-ghost" type="button" onClick={onViewRecentMatches}>
              {text.viewRecentMatchesLabel}
            </button>
          ) : null}
        </section>
      ))}
    </div>
  );
}

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

export type ProfileHeroRankTrend = {
  /** 시간순 LP 값. 2개 미만이면 그리지 않습니다. */
  values: number[];
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

function LpSparkline({ trend }: { trend: ProfileHeroRankTrend }) {
  const { values } = trend;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const innerWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2;
  const innerHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2;
  const coords = values.map((value, index) => [
    SPARKLINE_PADDING + (index * innerWidth) / (values.length - 1),
    SPARKLINE_HEIGHT - SPARKLINE_PADDING - ((value - min) / span) * innerHeight,
  ] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING} ${line} ${SPARKLINE_WIDTH - SPARKLINE_PADDING},${SPARKLINE_HEIGHT - SPARKLINE_PADDING}`;
  const last = coords.at(-1) ?? [SPARKLINE_PADDING, SPARKLINE_HEIGHT - SPARKLINE_PADDING] as const;

  return (
    <svg
      aria-label={trend.ariaLabel}
      className="public-profile-hero-sparkline"
      role="img"
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
    >
      <polygon className="area" points={area} />
      <polyline className="line" fill="none" points={line} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <circle className="head" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3" />
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
  const active = queues.find((queue) => queue.id === activeQueueId) ?? queues[0];
  if (!active) return null;

  return (
    <div className="public-profile-hero-rank">
      <div className="public-profile-hero-queues" role="group" aria-label={text.queueSwitcherLabel}>
        {queues.map((queue) => (
          <button
            aria-pressed={queue.id === active.id}
            className="public-profile-hero-queue"
            data-tier={queue.ranked ? queue.tierKey : "unranked"}
            key={queue.id}
            onClick={() => onSelectQueue(queue.id)}
            type="button"
          >
            <i aria-hidden="true" />
            <span>{queue.label}</span>
            <small>{queue.segmentValue}</small>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="public-profile-hero-rank-body">
        {active.ranked ? (
          <div className="public-profile-hero-tier" data-tier={active.tierKey}>
            <span className="public-profile-hero-crest">
              {active.tierIconUrl
                ? <img src={active.tierIconUrl} alt="" />
                : <b aria-hidden="true">{active.tierFallbackLabel}</b>}
            </span>

            <span className="public-profile-hero-tier-copy">
              <span className="public-profile-hero-queue-name">{active.label}</span>
              <span className="public-profile-hero-tier-name">
                {active.rankLabel}
                {active.leaguePointsLabel ? <em>{active.leaguePointsLabel}</em> : null}
              </span>
              {active.goal ? (
                <span className="public-profile-hero-goal">
                  <span>{active.goal.label}</span>
                  <span aria-hidden="true" className="public-profile-hero-goal-track">
                    <em style={{ width: `${Math.max(0, Math.min(100, active.goal.percent))}%` }} />
                  </span>
                </span>
              ) : null}
            </span>

            <span className="public-profile-hero-record">
              <WinRateDonut percent={active.winRate} label={`${active.winRate}%`} />
              <span className="public-profile-hero-record-copy">
                <strong>
                  <em>{active.wins}{active.winsLabel}</em>
                  {" "}
                  <i>{active.losses}{active.lossesLabel}</i>
                </strong>
                <span>{active.recordCaption}</span>
              </span>
            </span>

            {trend && trend.values.length > 1 ? (
              <span className="public-profile-hero-trend">
                <span>{text.lpTrendLabel}</span>
                <LpSparkline trend={trend} />
                <span className="public-profile-hero-trend-foot">
                  <b data-tone={trend.changeTone}>{trend.changeLabel}</b>
                </span>
              </span>
            ) : null}
          </div>
        ) : (
          <div className="public-profile-hero-tier is-unranked" data-tier="unranked">
            <span className="public-profile-hero-crest">
              <b aria-hidden="true">{active.tierFallbackLabel}</b>
            </span>
            <span className="public-profile-hero-tier-copy">
              <span className="public-profile-hero-queue-name">{active.label}</span>
              <span className="public-profile-hero-tier-name">{text.unrankedTitle}</span>
              {active.unrankedDescription
                ? <span className="public-profile-hero-unranked-note">{active.unrankedDescription}</span>
                : null}
            </span>
            {onViewRecentMatches ? (
              <button className="public-profile-hero-ghost" type="button" onClick={onViewRecentMatches}>
                {text.viewRecentMatchesLabel}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

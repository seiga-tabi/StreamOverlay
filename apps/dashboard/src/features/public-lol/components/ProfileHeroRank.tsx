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
  /** 숙련도 챔피언 블록 제목(목업 §2-7). masteryChampions 가 있을 때만 씁니다. */
  masteryTitle?: string;
};

/* 숙련도 챔피언 행(목업 §2-7) — 숙련도 응답에는 판수가 없고 대체 경로에는
   레벨·점수가 없으므로, 없는 쪽 라벨은 호출부가 아예 넘기지 않습니다. */
export type ProfileHeroMasteryChampion = {
  key: string;
  name: string;
  iconUrl?: string;
  fallbackLabel: string;
  /** "M7" — 숙련도 레벨 칩. 대체 경로에는 없습니다. */
  levelLabel?: string;
  /** "214,305점" 또는 "215게임" — 있는 쪽 하나만. */
  detailLabel?: string;
};

export type ProfileHeroRankProps = {
  queues: ProfileHeroRankQueue[];
  activeQueueId: string;
  text: ProfileHeroRankText;
  /** LP 추이 스파크라인. 없거나 표본이 부족하면 해당 칸을 그리지 않습니다. */
  trend?: ProfileHeroRankTrend;
  /** 숙련도 top3(목업 §2-7) — 스트리머 3열 격자의 네 번째 칸. 비면 블록 미렌더. */
  masteryChampions?: ProfileHeroMasteryChampion[];
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
      /* 카드 폭 전체를 쓰도록 viewBox 를 비율 무시로 늘립니다(목업 §2-4) —
         점 좌표를 컨테이너 폭으로 재계산하지 않아 리사이즈에 안정적입니다.
         선 굵기는 vector-effect 가 2px 로 고정합니다. */
      preserveAspectRatio="none"
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
          vectorEffect="non-scaling-stroke"
          x1={segment.from.x.toFixed(1)}
          x2={segment.to.x.toFixed(1)}
          y1={segment.from.y.toFixed(1)}
          y2={segment.to.y.toFixed(1)}
        />
      ))}
      {/* 점은 그리지 않는다 — 선만(그래프 대비 규격 §3-1 갱신판). 44px 카드에서는
          끝점·티어 변동점이 선보다 먼저 읽혀 추이를 가립니다. 티어 변동은 세그먼트
          색 전환이 그대로 전달합니다. 사이드바 LP 기록 그래프는 커서 점을 남깁니다. */}
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

/* 언랭크 크레스트 — 특정 엠블럼 대신 같은 슬롯에 중립 육각 실루엣(목업 §2-3).
   없는 티어를 색으로 암시하지 않도록 무채(--deep 계열)만 씁니다. */
function UnrankedCrestSilhouette() {
  return (
    <svg aria-hidden="true" fill="none" height="38" viewBox="0 0 40 44" width="34">
      <path d="M20 2 L37 12 V30 L20 42 L3 30 V12 Z" stroke="var(--public-gray-border-strong, #4a5563)" strokeWidth="1.5" />
      <path d="M20 10 L29 16 V26 L20 32 L11 26 V16 Z" stroke="var(--public-gray-border, #3a404b)" strokeWidth="1" />
    </svg>
  );
}

export function ProfileHeroRank({
  queues,
  activeQueueId,
  text,
  trend,
  masteryChampions,
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
            <span className={`public-profile-hero-crest${queue.ranked ? "" : " is-unranked"}`}>
              {queue.ranked
                ? (queue.tierIconUrl
                  ? <img src={queue.tierIconUrl} alt="" />
                  : <b aria-hidden="true">{queue.tierFallbackLabel}</b>)
                : <UnrankedCrestSilhouette />}
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
                  {/* 도넛을 접는 컴팩트 규격에서만 CSS 로 노출됩니다(§2-7). */}
                  <span aria-hidden="true" className="public-hero-rank-card-rate"> · {queue.winRate}%</span>
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
      {masteryChampions && masteryChampions.length > 0 && text.masteryTitle ? (
        <section className="public-hero-rank-card public-hero-mastery-card">
          <span className="public-hero-rank-card-queue">{text.masteryTitle}</span>
          <ul className="public-hero-mastery-list">
            {masteryChampions.slice(0, 3).map((champion) => (
              <li key={champion.key}>
                {champion.iconUrl
                  ? <img alt="" src={champion.iconUrl} />
                  : <i aria-hidden="true">{champion.fallbackLabel}</i>}
                <span className="public-hero-mastery-copy">
                  <b>{champion.name}</b>
                  {champion.detailLabel ? <small>{champion.detailLabel}</small> : null}
                </span>
                {champion.levelLabel ? <em>{champion.levelLabel}</em> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

import { useId, useRef, type KeyboardEvent } from "react";

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
  /** 오른쪽 절반 안내 제목("LP 추이") — 기간 접미사가 없는 짧은 형태입니다. */
  lpTrendTitle: string;
  /** 언랭크 큐 — "없음"이 아니라 "아직 없음"임을 구분합니다(목업 §1-A). */
  lpTrendAfterPlacementNote: string;
  /** 랭크는 있지만 rankHistory 표본이 2개 미만이라 선을 그릴 수 없는 경우. */
  lpTrendNoSamplesNote: string;
  /** 좌측 절반의 승률 줄 접두("승률"). 도넛을 뺀 자리를 텍스트가 대신합니다(§1-A). */
  winRateLabel: string;
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

/* 탭 패널 내부 — 좌우 반반(목업 §1-A).
   왼쪽: 크레스트 옆에 [티어명 · LP] → [승패 · 승률] → 다음 티어 게이지를 세로로 묶습니다.
   텍스트 5줄을 관계 있는 값끼리 묶되 값은 하나도 빼지 않습니다.
   좁은 폭(스트리머 절반 ≈148px)에서 승패·승률을 두 줄로 푸는 분기는 전부 CSS 입니다 —
   여기에 폭 조건문을 두지 않습니다(§5-A).
   오른쪽: LP 추이 스파크라인. 그릴 표본이 없는 큐는 같은 자리에 사유 한 줄 +
   "최근 게임 보기" 버튼을 둡니다 — 절반을 비워 두면 "데이터가 깨졌나"로 읽힙니다. */
function RankQueuePanelBody({
  queue,
  trend,
  text,
  onViewRecentMatches,
}: {
  queue: ProfileHeroRankQueue;
  trend?: ProfileHeroRankTrend;
  text: ProfileHeroRankText;
  onViewRecentMatches?: () => void;
}) {
  const hasTrend = trend !== undefined && trend.points.length > 1;
  const emptyNote = !queue.ranked
    ? text.lpTrendAfterPlacementNote
    : text.lpTrendNoSamplesNote;

  return (
    <div className="public-hero-rank-split">
      <div className="public-hero-rank-main">
        <div className="public-hero-rank-identity">
          <span className={`public-profile-hero-crest${queue.ranked ? "" : " is-unranked"}`}>
            {queue.ranked
              ? (queue.tierIconUrl
                ? <img src={queue.tierIconUrl} alt="" />
                : <b aria-hidden="true">{queue.tierFallbackLabel}</b>)
              : <UnrankedCrestSilhouette />}
          </span>
          {/* 구분점(·)은 DOM 요소가 아니라 두 번째 값의 ::before 입니다 — 로케일 문자열을 건드리지
              않고 CSS 로 켜고 끌 수 있으며, 값이 하나뿐인 언랭크 큐에서는 자동으로 사라집니다. */}
          <span className="public-hero-rank-line is-tier">
            <b className="public-hero-rank-card-tier">{queue.ranked ? queue.rankLabel : text.unrankedTitle}</b>
            {queue.ranked && queue.leaguePointsLabel
              ? <span className="public-hero-rank-lp">{queue.leaguePointsLabel}</span>
              : null}
          </span>
        </div>
        <div className="public-hero-rank-text">
          {queue.ranked ? (
            <span className="public-hero-rank-line public-hero-rank-record">
              <span className="public-hero-rank-card-record">
                <em>{queue.wins}{queue.winsLabel}</em>
                {" "}
                <i>{queue.losses}{queue.lossesLabel}</i>
              </span>
              <span className="public-hero-rank-card-record">{text.winRateLabel} {queue.winRate}%</span>
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
        </div>
      </div>
      <div className={`public-hero-rank-side${hasTrend ? "" : " is-note"}`}>
        {hasTrend && trend ? (
          <span className="public-hero-rank-card-trend">
            <span className="public-hero-rank-card-trend-label">
              {text.lpTrendLabel}
              <b data-tone={trend.changeTone}>{trend.changeLabel}</b>
            </span>
            <LpSparkline trend={trend} />
          </span>
        ) : (
          <div className="public-hero-rank-side-empty">
            <span className="public-hero-rank-side-title">{text.lpTrendTitle}</span>
            <span className="public-hero-rank-side-note">{emptyNote}</span>
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

export function ProfileHeroRank({
  queues,
  activeQueueId,
  text,
  trend,
  masteryChampions,
  onSelectQueue,
  onViewRecentMatches,
}: ProfileHeroRankProps) {
  /* 목업 profile-hero-tabs-performance-v1(v3) §1: 솔로/자유/5v5 3열 병렬 카드를
     탭 전환 하나로 바꿉니다. 카드 3개가 1개로 줄면서 생긴 가로 여백은 히어로가
     퍼포먼스 지표 패널에 넘깁니다(호출부에서 형제로 붙습니다).
     새 상태를 만들지 않고 이미 받아 두던 activeQueueId / onSelectQueue 를 씁니다. */
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  if (queues.length === 0) return null;

  const foundIndex = queues.findIndex((queue) => queue.id === activeQueueId);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;
  const tabId = (id: string) => `${baseId}-rank-tab-${id}`;
  const panelId = (id: string) => `${baseId}-rank-panel-${id}`;

  const moveFocus = (index: number) => {
    const next = (index + queues.length) % queues.length;
    const queue = queues[next];
    if (!queue) return;
    onSelectQueue(queue.id);
    /* 버튼 노드는 재렌더 뒤에도 그대로라 동기 focus 로 충분합니다. */
    tabRefs.current[next]?.focus();
  };

  const onTablistKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") moveFocus(activeIndex - 1);
    else if (event.key === "ArrowRight") moveFocus(activeIndex + 1);
    else if (event.key === "Home") moveFocus(0);
    else if (event.key === "End") moveFocus(queues.length - 1);
    else return;
    event.preventDefault();
  };

  return (
    <div className="public-profile-hero-rank public-profile-hero-rank--tabs">
      <section className="public-hero-rank-card public-hero-rank-tabs-card" data-tier={queues[activeIndex]?.ranked ? queues[activeIndex]?.tierKey : "unranked"}>
        {/* 탭 버튼은 [점 + 큐 이름] 한 줄뿐입니다 — 선택된 큐의 LP 는 바로 아래
            패널 왼쪽 절반에 크게 있어 탭에 다시 적으면 같은 숫자가 두 번 나옵니다(§1-B). */}
        <div
          aria-label={text.queueSwitcherLabel}
          className="public-hero-rank-tablist"
          onKeyDown={onTablistKeyDown}
          role="tablist"
        >
          {queues.map((queue, index) => {
            const selected = index === activeIndex;
            return (
              <button
                aria-controls={panelId(queue.id)}
                aria-selected={selected}
                className={`public-hero-rank-tab${queue.ranked ? "" : " is-unranked"}`}
                data-tier={queue.ranked ? queue.tierKey : "unranked"}
                id={tabId(queue.id)}
                key={queue.id}
                onClick={() => onSelectQueue(queue.id)}
                ref={(node) => { tabRefs.current[index] = node; }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <i aria-hidden="true" />
                <span>{queue.label}</span>
              </button>
            );
          })}
        </div>
        {/* 큐마다 패널 높이가 달라 전환 시 레이아웃이 튀지 않도록 최소 높이를 겁니다(§1-C). */}
        <div className="public-hero-rank-panels">
          {queues.map((queue, index) => (
            <div
              aria-labelledby={tabId(queue.id)}
              className="public-hero-rank-panel"
              data-tier={queue.ranked ? queue.tierKey : "unranked"}
              hidden={index !== activeIndex}
              id={panelId(queue.id)}
              key={queue.id}
              role="tabpanel"
              tabIndex={0}
            >
              <RankQueuePanelBody
                onViewRecentMatches={onViewRecentMatches}
                queue={queue}
                text={text}
                trend={trend}
              />
            </div>
          ))}
        </div>
      </section>
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

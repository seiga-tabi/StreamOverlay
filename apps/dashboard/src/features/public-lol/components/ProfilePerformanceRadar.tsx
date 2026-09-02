/* 퍼포먼스 지표 패널 — docs/mockups/profile-hero-tabs-performance-v1.html (v3) §3.
 *
 * 6축 레이더(킬 관여율·팀 피해 비중·DPM·CSM·GPM·VSPM) + 중앙 평점 숫자 + 막대 7행.
 * 계산은 전부 호출부(PublicLolPage)에서 끝내고 여기서는 그리기만 합니다 — 축 배열을
 * 받아 n각형을 그리는 순수 컴포넌트입니다.
 */

export type ProfilePerformanceMetric = {
  key: string;
  /** 막대 목록 라벨(전체 이름). */
  label: string;
  /** 레이더 축 전용 축약형. 없으면 label 을 씁니다 — 긴 라벨은 막대 열을 침범합니다(§3-6). */
  axisLabel?: string;
  /** undefined = 표본에 값이 없음. 축을 0(중심)으로 찍지 않고 다각형에서 제외합니다(§2 빈 상태 2). */
  value?: number;
  /** 막대·축 비율의 기준 상한. "만점"이 아니라 스케일 기준입니다. */
  max: number;
  display: string;
  /** 평점 행 — 레이더 축이 아니라 중앙 숫자 + 막대 첫 줄로만 씁니다(§3). */
  lead?: boolean;
};

export type ProfilePerformanceRadarText = {
  title: string;
  /** "최근 20경기 · 큐 구분 없음" — 큐 탭을 바꿔도 이 패널은 안 바뀐다는 고정 캡션(§1-C). */
  scope: string;
  /** 중앙 숫자 아래 보조 라벨. "평점 / 10". */
  scoreLabel: string;
  /** 막대 첫 줄 평점 뒤 스케일 표기. "/ 10". */
  scoreScaleSuffix: string;
  emptyTitle: string;
  emptyDescription: string;
  radarAriaLabel: string;
  emptyRadarAriaLabel: string;
  footNote: string;
};

export type ProfilePerformanceRadarProps = {
  /** 평점(lead) 1행 + 축 6행. 순서가 곧 막대 순서이자 레이더 축 순서입니다. */
  metrics: ProfilePerformanceMetric[];
  text: ProfilePerformanceRadarText;
};

const RADAR_SIZE = 200;
const RADAR_RADIUS = 62;
/* 홀 반지름 = 0.42r(= 26.04 뷰박스 단위). 스포크를 중심이 아니라 이 지점에서 시작시키고
   가장 안쪽 링을 정확히 여기에 둬서 중앙에는 그리드 선이 물리적으로 없습니다 —
   중앙 평점 글자 블록(대각 반경 ≈ 27.6px < 홀 32.3px)이 그 안에 들어갑니다(§3-1·2). */
const RADAR_HOLE = .42;
/* 라벨 반지름. r+17 은 5각형에서 라벨이 오른쪽 막대 열 위로 올라탔습니다(§3-6). */
const RADAR_LABEL_OFFSET = 14;
/** 다각형이 성립하는 최소 축 수. 이보다 적으면 점선 링만 남기고 값을 그리지 않습니다. */
const RADAR_MIN_AXES = 3;

function radarPoint(index: number, count: number, ratio: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const center = RADAR_SIZE / 2;
  return [
    center + Math.cos(angle) * RADAR_RADIUS * ratio,
    center + Math.sin(angle) * RADAR_RADIUS * ratio,
  ];
}

function axisRatio(metric: ProfilePerformanceMetric): number {
  if (metric.value === undefined || !Number.isFinite(metric.value) || metric.max <= 0) return 0;
  return Math.max(0, Math.min(1, metric.value / metric.max));
}

function pointsAttr(points: Array<[number, number]>): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

export function ProfilePerformanceRadar({ metrics, text }: ProfilePerformanceRadarProps) {
  const score = metrics.find((metric) => metric.lead);
  const axisMetrics = metrics.filter((metric) => !metric.lead);
  const usableAxes = axisMetrics.filter((metric) => metric.value !== undefined && Number.isFinite(metric.value));
  /* 표본 부족(값이 하나도 없음)과 가용 축 부족을 같은 화면으로 처리합니다 —
     둘 다 "다각형을 그릴 수 없다"이고, 사용자에게 보여야 할 것은 그 사실 하나입니다. */
  const isEmpty = usableAxes.length < RADAR_MIN_AXES;
  const axes = isEmpty ? axisMetrics : usableAxes;
  const axisCount = axes.length;
  const hasScore = !isEmpty && score !== undefined && score.value !== undefined;

  return (
    <section className="public-hero-performance">
      <div className="public-hero-performance-head">
        <span className="public-hero-rank-card-queue">{text.title}</span>
        <small>{text.scope}</small>
      </div>
      <div className="public-hero-performance-body">
        <div className="public-hero-performance-radar">
          <svg
            aria-label={isEmpty ? text.emptyRadarAriaLabel : text.radarAriaLabel}
            role="img"
            viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
          >
            {/* 링 3겹 — 가장 안쪽 링이 곧 홀 경계입니다. */}
            {[RADAR_HOLE, (RADAR_HOLE + 1) / 2, 1].map((ring) => (
              <polygon
                className={`ring${isEmpty ? " is-empty" : ""}`}
                key={ring}
                points={pointsAttr(axes.map((_, index) => radarPoint(index, axisCount, ring)))}
              />
            ))}
            {axes.map((metric, index) => {
              const [x1, y1] = radarPoint(index, axisCount, RADAR_HOLE);
              const [x2, y2] = radarPoint(index, axisCount, 1);
              return (
                <line
                  className="spoke"
                  key={metric.key}
                  x1={x1.toFixed(1)}
                  x2={x2.toFixed(1)}
                  y1={y1.toFixed(1)}
                  y2={y2.toFixed(1)}
                />
              );
            })}
            {isEmpty ? null : (
              <>
                <polygon
                  className="shape"
                  points={pointsAttr(axes.map((metric, index) => radarPoint(index, axisCount, axisRatio(metric))))}
                />
                {axes.map((metric, index) => {
                  const [cx, cy] = radarPoint(index, axisCount, axisRatio(metric));
                  return <circle className="vertex" cx={cx.toFixed(1)} cy={cy.toFixed(1)} key={metric.key} r="2" />;
                })}
              </>
            )}
            {axes.map((metric, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
              const center = RADAR_SIZE / 2;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const anchor = cos > .25 ? "start" : cos < -.25 ? "end" : "middle";
              const dy = sin > .5 ? 8 : sin < -.5 ? -3 : 3;
              const missing = metric.value === undefined || !Number.isFinite(metric.value);
              return (
                <text
                  className={`axis-label${missing ? " is-empty" : ""}`}
                  key={metric.key}
                  textAnchor={anchor}
                  x={(center + cos * (RADAR_RADIUS + RADAR_LABEL_OFFSET)).toFixed(1)}
                  y={(center + sin * (RADAR_RADIUS + RADAR_LABEL_OFFSET) + dy).toFixed(1)}
                >
                  {metric.axisLabel ?? metric.label}
                </text>
              );
            })}
          </svg>
          {isEmpty ? (
            <span className="public-hero-performance-empty">
              <b>{text.emptyTitle}</b>
              <span>{text.emptyDescription}</span>
            </span>
          ) : null}
          {/* 중앙 평점 — 배경 판 없이 숫자와 보조 라벨만. 가독성은 글자에만 붙는
              표면색 헤일로(text-shadow)가 담당합니다(§3-4, CSS 참조). */}
          {hasScore ? (
            <span className="public-hero-performance-score">
              <b>{score!.display}</b>
              <small>{text.scoreLabel}</small>
            </span>
          ) : null}
        </div>
        <div className="public-hero-performance-bars">
          {metrics.map((metric) => {
            const missing = metric.value === undefined || !Number.isFinite(metric.value);
            return (
              <div
                className={`public-hero-performance-bar${missing ? " is-empty" : ""}${metric.lead ? " is-lead" : ""}`}
                key={metric.key}
              >
                <span>
                  {metric.label}
                  {metric.lead ? <small>{text.scoreScaleSuffix}</small> : null}
                </span>
                <b>{metric.display}</b>
                <i aria-hidden="true">
                  {missing ? null : <em style={{ width: `${(axisRatio(metric) * 100).toFixed(1)}%` }} />}
                </i>
              </div>
            );
          })}
        </div>
      </div>
      <p className="public-hero-performance-foot">{text.footNote}</p>
    </section>
  );
}

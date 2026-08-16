import type { CSSProperties, ReactNode } from "react";

/* ── 지표 프로파일 ─────────────────────────────────────────── */

export type ProfileMetricRow = {
  key: string;
  label: string;
  /** 이미 포맷된 표시값. "3.42", "54%" 처럼 단위까지 포함합니다. */
  value: string;
  /** 0~100. 막대 길이입니다. 기준값이 없을 때는 지표별 참조 최대치 대비 비율입니다. */
  ratio: number;
  /** 동티어 평균 위치(0~100). 값이 있을 때만 기준선을 그립니다. */
  benchmarkRatio?: number;
  /** "상위 22%" 처럼 이미 조립된 문구. 있으면 접근성 라벨에 붙습니다. */
  percentileLabel?: string;
};

export type ProfileMetricProfileCardText = {
  title: string;
  gradeAriaLabel: string;
  noBenchmarkNotice: string;
  sampleShortNotice?: string;
};

export type ProfileMetricProfileCardProps = {
  metrics: ProfileMetricRow[];
  grade: string;
  score: number;
  gradeClassName?: string;
  /** 표본이 얇으면 막대를 흐리게 두고 비교 표시를 모두 끕니다. */
  sampleShort?: boolean;
  text: ProfileMetricProfileCardText;
};

export function ProfileMetricProfileCard({
  metrics,
  grade,
  score,
  gradeClassName,
  sampleShort = false,
  text,
}: ProfileMetricProfileCardProps) {
  const hasBenchmark = !sampleShort && metrics.some((metric) => metric.benchmarkRatio !== undefined);

  return (
    <article className="public-profile-side-card public-profile-metric-profile">
      <div className="public-profile-side-head">
        <h2>{text.title}</h2>
        <span
          aria-label={`${text.gradeAriaLabel} ${grade}`}
          className={`public-profile-metric-grade ${gradeClassName ?? ""}`}
          data-grade={grade}
        >
          <b>{grade}</b>
          <small>{score}</small>
        </span>
      </div>

      <div className={`public-profile-metric-list ${sampleShort ? "is-sample-short" : ""}`}>
        {metrics.map((metric) => (
          <div
            aria-label={`${metric.label} ${metric.value}${metric.percentileLabel && !sampleShort ? `, ${metric.percentileLabel}` : ""}`}
            className="public-profile-metric-row"
            key={metric.key}
            role="img"
          >
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <span className="public-profile-metric-bar">
              <em style={{ width: `${Math.max(0, Math.min(100, metric.ratio))}%` }} />
              {!sampleShort && metric.benchmarkRatio !== undefined ? (
                <i aria-hidden="true" style={{ left: `${Math.max(0, Math.min(100, metric.benchmarkRatio))}%` }} />
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <p className="public-profile-side-foot">
        {sampleShort ? text.sampleShortNotice : hasBenchmark ? null : text.noBenchmarkNotice}
      </p>
    </article>
  );
}

/* ── LP 기록 ───────────────────────────────────────────────── */

export type ProfileLpChangeEntry = {
  key: string;
  dateLabel: string;
  delta: number;
  deltaLabel: string;
  rangeLabel: string;
};

export type ProfileLpRecordCardText = {
  title: string;
  periodLabel: string;
  recordCountLabel: string;
  emptyTitle: string;
  emptyDescription: string;
};

export type ProfileLpRecordCardProps = {
  currentLabel: string;
  changeLabel?: string;
  changeTone?: "up" | "down" | "flat";
  recordCount: number;
  chart?: ReactNode;
  entries: ProfileLpChangeEntry[];
  text: ProfileLpRecordCardText;
};

export function ProfileLpRecordCard({
  currentLabel,
  changeLabel,
  changeTone = "flat",
  recordCount,
  chart,
  entries,
  text,
}: ProfileLpRecordCardProps) {
  const empty = recordCount === 0;

  return (
    <article className="public-profile-side-card public-profile-lp-record">
      <div className="public-profile-side-head">
        <h2>{text.title}</h2>
        <span className="public-profile-side-pill">{text.periodLabel}</span>
      </div>

      {empty ? (
        <div className="public-profile-side-empty">
          <strong>{text.emptyTitle}</strong>
          <span>{text.emptyDescription}</span>
        </div>
      ) : (
        <>
          <div className="public-profile-lp-headline">
            <strong>{currentLabel}</strong>
            {changeLabel ? <span className="public-profile-lp-delta" data-tone={changeTone}>{changeLabel}</span> : null}
            <small>{recordCount}{text.recordCountLabel}</small>
          </div>
          {chart ? <div className="public-profile-lp-chart">{chart}</div> : null}
          {/* 차트는 추세 모양만 맡고, 정확한 날짜·수치는 이 목록이 전달합니다. */}
          {entries.length > 0 ? (
            <ol className="public-profile-lp-log">
              {entries.map((entry) => (
                <li key={entry.key}>
                  <span className="date">{entry.dateLabel}</span>
                  <span className="delta" data-tone={entry.delta > 0 ? "up" : entry.delta < 0 ? "down" : "flat"}>
                    {entry.deltaLabel}
                  </span>
                  <span className="range">{entry.rangeLabel}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </article>
  );
}

/* ── 포지션 ────────────────────────────────────────────────── */

export type ProfileRoleEntry = {
  key: string;
  label: string;
  icon?: ReactNode;
  isMain?: boolean;
  winRate: number;
  winRateLabel: string;
  recordLabel: string;
  kdaLabel: string;
};

export type ProfileRoleCardText = {
  title: string;
  periodLabel: string;
  mainTag: string;
  emptyLabel: string;
};

export type ProfileRoleCardProps = {
  roles: ProfileRoleEntry[];
  text: ProfileRoleCardText;
};

export function ProfileRoleCard({ roles, text }: ProfileRoleCardProps) {
  return (
    <article className="public-profile-side-card public-profile-role-card">
      <div className="public-profile-side-head">
        <h2>{text.title}</h2>
        <span className="public-profile-side-pill">{text.periodLabel}</span>
      </div>

      {roles.length === 0 ? (
        <div className="public-profile-side-empty">
          <strong>{text.emptyLabel}</strong>
        </div>
      ) : (
        <div className="public-profile-role-list">
          {roles.map((role) => (
            <div
              className={`public-profile-role ${role.isMain ? "is-main" : ""} ${role.winRate < 50 ? "is-low" : ""}`}
              key={role.key}
            >
              <i aria-hidden="true">{role.icon}</i>
              <span className="public-profile-role-name">
                <b>{role.label}</b>
                {role.isMain ? <span className="tag">{text.mainTag}</span> : null}
                <small>{role.recordLabel} · KDA {role.kdaLabel}</small>
              </span>
              <span
                aria-label={`${role.label} ${role.winRateLabel}, ${role.recordLabel}, KDA ${role.kdaLabel}`}
                className="public-profile-role-bar"
                role="img"
              >
                <span><em style={{ width: `${Math.max(0, Math.min(100, role.winRate))}%` }} /></span>
                <b>{role.winRateLabel}</b>
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/* ── 플레이 시간대 ─────────────────────────────────────────── */
/* 근거: docs/mockups/lol-profile-playtime-card.html (v2).
 * 읽는 순서 1초/3초/5초 — 히어로(언제+승률 링) → 24h 스트립(peak 존) → 보조 2줄.
 * 계산은 utils/playtime.ts 의 playtimeSummary 가 전담하고 이 컴포넌트는 표현만 맡습니다. */

export type ProfilePlaytimeBandRow = {
  key: string;
  /** "밤 22–02" 처럼 이미 조립된 구간명. */
  label: string;
  /** 0~100. 분할 바의 승 구간 폭이자 표시 수치입니다. */
  winRate: number;
  games: number;
  /** "40% · 5판" — 로케일 조립은 호출부가 합니다. */
  statLabel: string;
};

export type ProfilePlaytimeCardText = {
  title: string;
  /** "최근 20경기 · KST" */
  pillLabel: string;
  peakZoneLabel: string;
  winRateLabel: string;
  stripAriaLabel: string;
  emptyTitle: string;
  emptyDescription: string;
};

export type ProfilePlaytimeCardProps = {
  /** 낮 성향(peak 06–18시 시작)이면 해 아이콘 + 주황 틴트. */
  daytime: boolean;
  /** "저녁 18–22시" */
  peakLabel?: string;
  /** "8게임 · 전체의 40%" */
  peakMetaLabel?: string;
  /** 없으면 링을 그리지 않습니다(표본 부족 — 과신 방지). */
  peakWinRate?: number;
  peakWinRateTone: "up" | "down" | "flat";
  /** 현지 0~23시별 게임 수. */
  hourly: number[];
  /** peak 구간 시작시. night(22)는 자정을 넘으므로 존을 둘로 쪼개 그립니다. */
  peakStartHour?: number;
  bands: ProfilePlaytimeBandRow[];
  footLabel?: string;
  /** 축 눈금 문구 — ["0시","6","12","18","24"] 형태. */
  axisLabels: string[];
  text: ProfilePlaytimeCardText;
};

const PLAYTIME_BAND_SPAN = 4;

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function ProfilePlaytimeCard({
  daytime,
  peakLabel,
  peakMetaLabel,
  peakWinRate,
  peakWinRateTone,
  hourly,
  peakStartHour,
  bands,
  footLabel,
  axisLabels,
  text,
}: ProfilePlaytimeCardProps) {
  const totalGames = hourly.reduce((sum, count) => sum + count, 0);
  const maxHourly = Math.max(1, ...hourly);

  /* 자정을 넘는 밤 구간(22–02)은 22–24 와 0–2 두 조각으로 그립니다.
     라벨은 첫 조각에만 — 두 번 붙이면 같은 문구가 겹쳐 보입니다. */
  const zones: Array<{ startHour: number; span: number; withLabel: boolean }> = [];
  if (peakStartHour !== undefined) {
    const end = peakStartHour + PLAYTIME_BAND_SPAN;
    if (end <= 24) {
      zones.push({ startHour: peakStartHour, span: PLAYTIME_BAND_SPAN, withLabel: true });
    } else {
      zones.push({ startHour: peakStartHour, span: 24 - peakStartHour, withLabel: true });
      zones.push({ startHour: 0, span: end - 24, withLabel: false });
    }
  }

  return (
    <article className="public-profile-side-card public-profile-playtime">
      <div className="public-profile-side-head">
        <h2>{text.title}</h2>
        <span className="public-profile-side-pill">{text.pillLabel}</span>
      </div>

      {totalGames === 0 ? (
        <div className="public-profile-side-empty">
          <strong>{text.emptyTitle}</strong>
          <span>{text.emptyDescription}</span>
        </div>
      ) : (
        <>
          <div className={`public-profile-playtime-hero ${daytime ? "is-day" : "is-night"}`}>
            <span aria-hidden="true" className="public-profile-playtime-icon">
              {daytime ? <SunIcon /> : <MoonIcon />}
            </span>
            <span className="public-profile-playtime-when">
              <b>{peakLabel}</b>
              <span>{peakMetaLabel}</span>
            </span>
            {peakWinRate !== undefined ? (
              <span
                aria-label={`${text.winRateLabel} ${peakWinRate}%`}
                className="public-profile-playtime-ring"
                data-tone={peakWinRateTone}
                role="img"
                style={{ "--playtime-rate": peakWinRate } as CSSProperties}
              >
                <b>{peakWinRate}%</b>
                <small>{text.winRateLabel}</small>
              </span>
            ) : null}
          </div>

          <div className="public-profile-playtime-strip-wrap">
            <div aria-label={text.stripAriaLabel} className="public-profile-playtime-strip" role="img">
              {zones.map((zone) => {
                /* 존 중심이 가장자리(18%/82% 밖)면 라벨을 안쪽 정렬로 붙입니다 —
                   중앙 고정(translateX -50%)은 새벽·심야 존에서 카드 밖으로 새던 결함. */
                const center = (zone.startHour + zone.span / 2) / 24;
                const align = center < 0.18 ? "start" : center > 0.82 ? "end" : "center";
                return (
                  <span
                    className="public-profile-playtime-zone"
                    data-align={align}
                    data-label={zone.withLabel ? text.peakZoneLabel : ""}
                    key={zone.startHour}
                    style={{ left: `${(zone.startHour / 24) * 100}%`, width: `${(zone.span / 24) * 100}%` }}
                  />
                );
              })}
              {hourly.map((count, hour) => (
                <i
                  /* 시간별 막대라 시(hour)가 곧 안정된 key 입니다. */
                  key={hour}
                  className={count > 0 ? "is-on" : ""}
                  style={{ height: count > 0 ? `${Math.max(18, Math.round((count / maxHourly) * 100))}%` : undefined }}
                />
              ))}
            </div>
            <div aria-hidden="true" className="public-profile-playtime-axis">
              {axisLabels.map((label, index) => (
                <span key={label} style={{ left: `${(index / (axisLabels.length - 1)) * 100}%` }}>{label}</span>
              ))}
            </div>
          </div>

          {bands.length > 0 ? (
            <ol className="public-profile-playtime-bands">
              {bands.map((band) => (
                <li key={band.key}>
                  <span className="zone">{band.label}</span>
                  <span aria-label={`${band.label} ${band.statLabel}`} className="split" role="img">
                    <span className="w" style={{ width: `${Math.max(0, Math.min(100, band.winRate))}%` }} />
                  </span>
                  <span className="stat">{band.statLabel}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {footLabel ? <p className="public-profile-side-foot">{footLabel}</p> : null}
        </>
      )}
    </article>
  );
}

import type { ReactNode } from "react";

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

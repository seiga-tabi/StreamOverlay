export type RecentMatchBuildSummaryBadgeViewModel = {
  key: string;
  className: string;
  label: string;
  ko?: string;
  ja?: string;
  ariaLabel?: string;
};

export type RecentMatchBuildSummaryMetricSnapshotViewModel = {
  score: number;
  damage?: number;
  vision?: number;
  gold?: number;
  cs?: number;
};

export type RecentMatchBuildSummaryViewModel = {
  participantLabel: string;
  championLabel: string;
  scoreLabel: string;
  badges: RecentMatchBuildSummaryBadgeViewModel[];
  metrics: RecentMatchBuildSummaryMetricSnapshotViewModel;
};

export type RecentMatchBuildSummaryProps = {
  summary: RecentMatchBuildSummaryViewModel;
};

export function RecentMatchBuildSummary({ summary }: RecentMatchBuildSummaryProps) {
  return (
    <div className="public-match-build-summary">
      <strong>{summary.participantLabel}</strong>
      <small>{summary.championLabel} · {summary.scoreLabel} {summary.metrics.score}</small>
      {summary.badges.length > 0 ? (
        <div className="public-match-badges">
          {summary.badges.map((badge) => (
            <span className={badge.className} key={badge.key} aria-label={badge.ariaLabel}  >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

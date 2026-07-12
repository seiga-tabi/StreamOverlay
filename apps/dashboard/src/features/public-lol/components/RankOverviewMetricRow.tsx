import { Badge, Metric, type StatusTone } from "../../../shared/ui/Status";

export type RankOverviewMetricRowViewModel = {
  title: string;
  tierIconUrl?: string;
  fallbackLabel: string;
  rankLabel: string;
  metricTone: StatusTone;
  description: string;
  statusLabel?: string;
  statusTone: StatusTone;
};

export type RankOverviewMetricRowProps = {
  metric: RankOverviewMetricRowViewModel;
};

export function RankOverviewMetricRow({
  metric,
}: RankOverviewMetricRowProps) {
  return (
    <>
      {metric.tierIconUrl ? <img src={metric.tierIconUrl} alt="" /> : <div className="public-rank-fallback">{metric.fallbackLabel}</div>}
      <Metric
        className="public-profile-shared-rank-metric"
        label={metric.title}
        value={metric.rankLabel}
        tone={metric.metricTone}
        description={metric.description}
        status={metric.statusLabel ? <Badge size="sm" tone={metric.statusTone}>{metric.statusLabel}</Badge> : undefined}
      />
    </>
  );
}

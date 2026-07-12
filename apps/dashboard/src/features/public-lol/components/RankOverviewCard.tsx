import { Card, type CardVariant } from "../../../shared/ui/Card";
import { type StatusTone } from "../../../shared/ui/Status";
import { RankOverviewMetricRow } from "./RankOverviewMetricRow";

export type RankOverviewCardProps = {
  title: string;
  tierIconUrl?: string;
  fallbackLabel: string;
  rankLabel: string;
  metricTone: StatusTone;
  description: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  variant: CardVariant;
};

export function RankOverviewCard({
  description,
  fallbackLabel,
  metricTone,
  rankLabel,
  statusLabel,
  statusTone = "neutral",
  tierIconUrl,
  title,
  variant,
}: RankOverviewCardProps) {
  return (
    <Card as="article" className="public-rank-overview-card public-profile-shared-rank-card" padding="md" variant={variant}>
      <RankOverviewMetricRow
        metric={{
          description,
          fallbackLabel,
          metricTone,
          rankLabel,
          statusLabel,
          statusTone,
          tierIconUrl,
          title,
        }}
      />
    </Card>
  );
}

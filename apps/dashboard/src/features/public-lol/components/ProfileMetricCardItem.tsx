import { Card } from "../../../shared/ui/Card";
import { Badge, Metric, type StatusTone } from "../../../shared/ui/Status";

export type ProfileMetricCardItemViewModel = {
  key: string;
  tone: string;
  icon: string;
  imageUrl?: string;
  imageFallbackLabel?: string;
  title: string;
  value: string;
  valueTone: string;
  detail: string;
  progress?: string;
  scale?: string[];
  rank?: string;
  statusTone: StatusTone;
};

export type ProfileMetricCardItemProps = {
  card: ProfileMetricCardItemViewModel;
};

export function ProfileMetricCardItem({
  card,
}: ProfileMetricCardItemProps) {
  const leftIcon = card.imageUrl ? (
    <span className="public-profile-metric-icon public-profile-rank-tier-icon">
      <img src={card.imageUrl} alt="" />
    </span>
  ) : (
    <span className="public-profile-metric-icon">{card.imageFallbackLabel ?? card.icon}</span>
  );
  const showProgress = Boolean(card.progress && card.scale?.length);

  return (
    <Card as="article" className={`public-profile-metric-card ${card.tone} public-profile-shared-metric-card`} padding="md" variant="elevated">
      <Metric
        className="public-profile-shared-metric"
        label={card.title}
        leftIcon={leftIcon}
        value={<span className={card.valueTone}>{card.value}</span>}
        description={card.detail}
        status={card.rank ? <Badge size="sm" tone={card.statusTone}>{card.rank}</Badge> : undefined}
        tone={card.statusTone}
      />
      {showProgress ? (
        <>
          <div className="public-profile-metric-bar" aria-hidden="true">
            <i style={{ width: card.progress }} />
          </div>
          <div className="public-profile-metric-scale" aria-hidden="true">
            {card.scale?.map((label) => <span key={`${card.key}:${label}`}>{label}</span>)}
          </div>
        </>
      ) : null}
    </Card>
  );
}

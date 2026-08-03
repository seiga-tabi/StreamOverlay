import { ProfileMetricCardItem, type ProfileMetricCardItemViewModel } from "./ProfileMetricCardItem";

export type ProfileMetricStripCard = ProfileMetricCardItemViewModel;

export type ProfileMetricStripProps = {
  ariaLabel: string;
  cards: ProfileMetricStripCard[];
};

export function ProfileMetricStrip({
  ariaLabel,
  cards,
}: ProfileMetricStripProps) {
  return (
    <div className="public-profile-metric-strip" aria-label={ariaLabel}>
      {cards.map((card) => (
        <ProfileMetricCardItem card={card} key={card.key} />
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import { ProfileMetricCardItem, type ProfileMetricCardItemViewModel } from "./ProfileMetricCardItem";

export type ProfileMetricStripCard = ProfileMetricCardItemViewModel;

export type ProfileMetricStripProps = {
  ariaLabel: string;
  cards: ProfileMetricStripCard[];
  recentChampionsCard: ReactNode;
};

export function ProfileMetricStrip({
  ariaLabel,
  cards,
  recentChampionsCard,
}: ProfileMetricStripProps) {
  return (
    <div className="public-profile-metric-strip" aria-label={ariaLabel}>
      {recentChampionsCard}
      {cards.map((card) => (
        <ProfileMetricCardItem card={card} key={card.key} />
      ))}
    </div>
  );
}

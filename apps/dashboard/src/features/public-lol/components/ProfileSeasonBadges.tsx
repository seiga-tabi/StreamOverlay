import { ProfileSeasonBadgeItem as ProfileSeasonBadgeItemPresenter, type ProfileSeasonBadgeItemViewModel } from "./ProfileSeasonBadgeItem";

export type ProfileSeasonBadgeItem = ProfileSeasonBadgeItemViewModel & {
  key: string;
};

export type ProfileSeasonBadgesProps = {
  ariaLabel: string;
  badges: ProfileSeasonBadgeItem[];
  recentForm: string;
};

export function ProfileSeasonBadges({
  ariaLabel,
  badges,
  recentForm,
}: ProfileSeasonBadgesProps) {
  return (
    <div className="public-season-badges" aria-label={ariaLabel}>
      {badges.map((badge) => (
        <ProfileSeasonBadgeItemPresenter badge={badge} key={badge.key} />
      ))}
      <span className="recent-form">{recentForm}</span>
    </div>
  );
}

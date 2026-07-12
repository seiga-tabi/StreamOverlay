export type ProfileSeasonBadgeItemViewModel = {
  className: string;
  label: string;
};

export type ProfileSeasonBadgeItemProps = {
  badge: ProfileSeasonBadgeItemViewModel;
};

export function ProfileSeasonBadgeItem({
  badge,
}: ProfileSeasonBadgeItemProps) {
  return (
    <span className={badge.className}>
      {badge.label}
    </span>
  );
}

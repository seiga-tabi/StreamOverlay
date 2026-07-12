export type PlayerItemBuildSlotViewModel = {
  key: string;
  className: string;
  iconUrl?: string;
  fallbackLabel?: string;
  ariaHidden?: boolean;
};

export type PlayerItemBuildViewModel = {
  ariaLabel: string;
  slots: PlayerItemBuildSlotViewModel[];
};

export type PlayerItemBuildProps = {
  viewModel: PlayerItemBuildViewModel;
};

export function PlayerItemBuild({ viewModel }: PlayerItemBuildProps) {
  return (
    <div className="public-team-item-build" aria-label={viewModel.ariaLabel}>
      {viewModel.slots.map((slot) => (
        <PlayerItemSlot slot={slot} key={slot.key} />
      ))}
    </div>
  );
}

function PlayerItemSlot({ slot }: { slot: PlayerItemBuildSlotViewModel }) {
  if (slot.ariaHidden) {
    return <span className={slot.className} aria-hidden="true" />;
  }

  return (
    <span className={slot.className}>
      {slot.iconUrl ? <img src={slot.iconUrl} alt="" /> : slot.fallbackLabel}
    </span>
  );
}

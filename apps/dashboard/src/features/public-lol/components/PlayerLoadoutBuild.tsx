export type PlayerLoadoutBuildSlotViewModel = {
  key: string;
  className: string;
  title?: string;
  iconUrl?: string;
  fallbackLabel?: string;
  ariaHidden?: boolean;
};

export type PlayerLoadoutBuildViewModel = {
  ariaLabel: string;
  spellsAriaLabel: string;
  runesAriaLabel: string;
  spellSlots: PlayerLoadoutBuildSlotViewModel[];
  runeSlots: PlayerLoadoutBuildSlotViewModel[];
};

export type PlayerLoadoutBuildProps = {
  viewModel: PlayerLoadoutBuildViewModel;
};

export function PlayerLoadoutBuild({ viewModel }: PlayerLoadoutBuildProps) {
  return (
    <div className="public-team-loadout-build" aria-label={viewModel.ariaLabel}>
      <div className="public-team-spell-build" aria-label={viewModel.spellsAriaLabel}>
        {viewModel.spellSlots.map((slot) => (
          <PlayerLoadoutSlot slot={slot} key={slot.key} />
        ))}
      </div>
      <div className="public-team-rune-build" aria-label={viewModel.runesAriaLabel}>
        {viewModel.runeSlots.map((slot) => (
          <PlayerLoadoutSlot slot={slot} key={slot.key} />
        ))}
      </div>
    </div>
  );
}

function PlayerLoadoutSlot({ slot }: { slot: PlayerLoadoutBuildSlotViewModel }) {
  if (slot.ariaHidden) {
    return <span className={slot.className} aria-hidden="true" />;
  }

  return (
    <span className={slot.className} title={slot.title}>
      {slot.iconUrl ? <img src={slot.iconUrl} alt="" /> : <b>{slot.fallbackLabel}</b>}
    </span>
  );
}

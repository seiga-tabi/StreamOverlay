export type TeamChampionAvatarStreamBadgeViewModel = {
  title: string;
  ariaLabel: string;
};

export type TeamChampionAvatarViewModel = {
  className: string;
  championIconUrl?: string;
  fallbackLabel: string;
  streamBadge?: TeamChampionAvatarStreamBadgeViewModel;
};

export type TeamChampionAvatarProps = {
  viewModel: TeamChampionAvatarViewModel;
};

export function TeamChampionAvatar({ viewModel }: TeamChampionAvatarProps) {
  return (
    <span className={viewModel.className}>
      {viewModel.championIconUrl ? <img src={viewModel.championIconUrl} alt="" /> : <span>{viewModel.fallbackLabel}</span>}
      {viewModel.streamBadge ? (
        <em title={viewModel.streamBadge.title} aria-label={viewModel.streamBadge.ariaLabel} role="img" />
      ) : null}
    </span>
  );
}

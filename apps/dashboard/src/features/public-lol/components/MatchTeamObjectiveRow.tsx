export type MatchTeamObjectiveRowViewModel = {
  key: string;
  className: string;
  title: string;
  shortLabel: string;
  value: number;
};

export type MatchTeamObjectiveRowProps = {
  viewModel: MatchTeamObjectiveRowViewModel;
};

export function MatchTeamObjectiveRow({ viewModel }: MatchTeamObjectiveRowProps) {
  return (
    <span className={viewModel.className} title={viewModel.title}>
      <i aria-hidden="true">{viewModel.shortLabel}</i>
      <b>{viewModel.value}</b>
    </span>
  );
}

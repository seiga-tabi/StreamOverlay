export type MatchTeamMetricRowViewModel = {
  key: string;
  label: string;
  leftValueLabel: string;
  rightValueLabel: string;
  leftWidth: number;
  rightWidth: number;
};

export type MatchTeamMetricRowProps = {
  viewModel: MatchTeamMetricRowViewModel;
};

export function MatchTeamMetricRow({ viewModel }: MatchTeamMetricRowProps) {
  return (
    <div className="public-team-compare-metric">
      <span className="public-team-compare-track">
        <i className="left" style={{ width: `${viewModel.leftWidth}%` }}>
          <b>{viewModel.leftValueLabel}</b>
        </i>
        <i className="right" style={{ width: `${viewModel.rightWidth}%` }}>
          <b>{viewModel.rightValueLabel}</b>
        </i>
        <em>{viewModel.label}</em>
      </span>
    </div>
  );
}

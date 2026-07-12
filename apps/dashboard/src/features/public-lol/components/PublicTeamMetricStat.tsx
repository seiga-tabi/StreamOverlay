export type PublicTeamMetricStatViewModel = {
  tone: "damage" | "cs" | "vision";
  fillWidth: string;
  valueLabel: string;
  label: string;
  labelClassName?: string;
};

export type PublicTeamMetricStatProps = {
  viewModel: PublicTeamMetricStatViewModel;
};

export function PublicTeamMetricStat({ viewModel }: PublicTeamMetricStatProps) {
  return (
    <div className={`public-team-stat metric-bar ${viewModel.tone}`}>
      <i className="public-team-stat-fill" style={{ width: viewModel.fillWidth }} aria-hidden="true" />
      <strong>{viewModel.valueLabel}</strong>
      <span className={viewModel.labelClassName}>{viewModel.label}</span>
    </div>
  );
}

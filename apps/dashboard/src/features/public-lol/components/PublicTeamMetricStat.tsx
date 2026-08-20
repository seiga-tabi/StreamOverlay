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

/* 채운 상자가 아니라 값 + 2px 트랙입니다(목업 §2-3) — 라벨은 title 로만 남깁니다. */
export function PublicTeamMetricStat({ viewModel }: PublicTeamMetricStatProps) {
  return (
    <div className={`public-team-stat metric-bar ${viewModel.tone}`} title={viewModel.label}>
      <strong>{viewModel.valueLabel}</strong>
      <span className="public-team-stat-track" aria-hidden="true">
        <i className="public-team-stat-fill" style={{ width: viewModel.fillWidth }} />
      </span>
    </div>
  );
}

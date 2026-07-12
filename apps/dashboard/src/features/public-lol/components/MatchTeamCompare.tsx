import { MatchTeamMetricRow, type MatchTeamMetricRowViewModel } from "./MatchTeamMetricRow";
import { MatchTeamObjectiveRow, type MatchTeamObjectiveRowViewModel } from "./MatchTeamObjectiveRow";

export type MatchTeamCompareObjectiveViewModel = MatchTeamObjectiveRowViewModel;

export type MatchTeamCompareTeamViewModel = {
  side: "left" | "right";
  label: string;
  resultSummary: string;
  objectivesAriaLabel: string;
  objectives: MatchTeamCompareObjectiveViewModel[];
};

export type MatchTeamCompareMetricViewModel = MatchTeamMetricRowViewModel;

export type MatchTeamCompareViewModel = {
  ariaLabel: string;
  leftTeam: MatchTeamCompareTeamViewModel;
  rightTeam: MatchTeamCompareTeamViewModel;
  metrics: MatchTeamCompareMetricViewModel[];
};

export type MatchTeamCompareProps = {
  viewModel: MatchTeamCompareViewModel;
};

export function MatchTeamCompare({ viewModel }: MatchTeamCompareProps) {
  return (
    <section className="public-team-compare" aria-label={viewModel.ariaLabel}>
      <div className="public-team-compare-label left">
        <strong>{viewModel.leftTeam.label}</strong>
        <span>{viewModel.leftTeam.resultSummary}</span>
      </div>
      <div className="public-team-compare-label right">
        <strong>{viewModel.rightTeam.label}</strong>
        <span>{viewModel.rightTeam.resultSummary}</span>
      </div>
      <MatchTeamCompareObjectiveList team={viewModel.leftTeam} />
      <div className="public-team-compare-bars">
        {viewModel.metrics.map((metric) => (
          <MatchTeamMetricRow key={metric.key} viewModel={metric} />
        ))}
      </div>
      <MatchTeamCompareObjectiveList team={viewModel.rightTeam} />
    </section>
  );
}

function MatchTeamCompareObjectiveList({ team }: { team: MatchTeamCompareTeamViewModel }) {
  return (
    <div className={`public-team-compare-objectives ${team.side}`} aria-label={team.objectivesAriaLabel}>
      {team.objectives.map((objective) => (
        <MatchTeamObjectiveRow key={objective.key} viewModel={objective} />
      ))}
    </div>
  );
}

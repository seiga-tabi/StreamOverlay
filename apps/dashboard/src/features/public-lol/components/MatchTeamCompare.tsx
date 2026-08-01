import { useState } from "react";
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
  tabsLabel: string;
  objectivesLabel: string;
  leftTeam: MatchTeamCompareTeamViewModel;
  rightTeam: MatchTeamCompareTeamViewModel;
  metrics: MatchTeamCompareMetricViewModel[];
};

export type MatchTeamCompareProps = {
  viewModel: MatchTeamCompareViewModel;
};

export function MatchTeamCompare({ viewModel }: MatchTeamCompareProps) {
  const [activeMetricKey, setActiveMetricKey] = useState(viewModel.metrics[0]?.key ?? "objectives");
  const activeMetric = viewModel.metrics.find((metric) => metric.key === activeMetricKey);
  const objectivesActive = activeMetricKey === "objectives";

  return (
    <section className={`public-team-compare ${objectivesActive ? "objectives-active" : "metric-active"}`} aria-label={viewModel.ariaLabel}>
      <div className="public-team-compare-tabs" role="tablist" aria-label={viewModel.tabsLabel}>
        {viewModel.metrics.map((metric) => (
          <button
            aria-selected={activeMetricKey === metric.key}
            key={metric.key}
            role="tab"
            type="button"
            onClick={() => setActiveMetricKey(metric.key)}
          >
            {metric.label}
          </button>
        ))}
        <button
          aria-selected={objectivesActive}
          role="tab"
          type="button"
          onClick={() => setActiveMetricKey("objectives")}
        >
          {viewModel.objectivesLabel}
        </button>
      </div>
      <div className="public-team-compare-label left">
        <strong>{viewModel.leftTeam.label}</strong>
        <span>{viewModel.leftTeam.resultSummary}</span>
      </div>
      <div className="public-team-compare-label right">
        <strong>{viewModel.rightTeam.label}</strong>
        <span>{viewModel.rightTeam.resultSummary}</span>
      </div>
      {objectivesActive ? <MatchTeamCompareObjectiveList team={viewModel.leftTeam} /> : <div />}
      <div className="public-team-compare-bars" role="tabpanel">
        {activeMetric ? <MatchTeamMetricRow key={activeMetric.key} viewModel={activeMetric} /> : null}
      </div>
      {objectivesActive ? <MatchTeamCompareObjectiveList team={viewModel.rightTeam} /> : <div />}
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

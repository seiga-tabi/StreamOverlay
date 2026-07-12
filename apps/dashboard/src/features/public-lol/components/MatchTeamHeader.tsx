import type { ReactNode } from "react";

export type MatchTeamHeaderViewModel = {
  label: ReactNode;
  resultSummary: ReactNode;
  summary: ReactNode;
  tierSummary: ReactNode;
};

export type MatchTeamHeaderProps = {
  viewModel: MatchTeamHeaderViewModel;
};

export function MatchTeamHeader({ viewModel }: MatchTeamHeaderProps) {
  return (
    <div className="public-team-head">
      <strong>{viewModel.label}</strong>
      <span>{viewModel.resultSummary}</span>
      <div className="public-team-head-summary">
        <small>{viewModel.summary}</small>
      </div>
      <em>{viewModel.tierSummary}</em>
    </div>
  );
}

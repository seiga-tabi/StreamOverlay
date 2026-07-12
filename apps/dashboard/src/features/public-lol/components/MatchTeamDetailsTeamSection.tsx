import { Fragment, type ReactNode } from "react";
import { MatchTeamDetailsPlayerRow, type MatchTeamDetailsPlayerRowViewModel } from "./MatchTeamDetailsPlayerRow";
import { MatchTeamHeader, type MatchTeamHeaderViewModel } from "./MatchTeamHeader";

export type MatchTeamDetailsTeamSectionViewModel = {
  key: string;
  className: string;
  label: MatchTeamHeaderViewModel["label"];
  resultSummary: MatchTeamHeaderViewModel["resultSummary"];
  summary: MatchTeamHeaderViewModel["summary"];
  tierSummary: MatchTeamHeaderViewModel["tierSummary"];
  players: MatchTeamDetailsPlayerRowViewModel[];
  compareAfter?: ReactNode;
};

export type MatchTeamDetailsTeamSectionProps = {
  kdaLabel: string;
  team: MatchTeamDetailsTeamSectionViewModel;
  onSearchRiotId: (riotId: string) => void;
};

export function MatchTeamDetailsTeamSection({
  kdaLabel,
  team,
  onSearchRiotId
}: MatchTeamDetailsTeamSectionProps) {
  return (
    <Fragment>
      <section className={team.className}>
        <MatchTeamHeader
          viewModel={{
            label: team.label,
            resultSummary: team.resultSummary,
            summary: team.summary,
            tierSummary: team.tierSummary
          }}
        />
        <div className="public-team-player-list">
          {team.players.map((player) => (
            <MatchTeamDetailsPlayerRow
              kdaLabel={kdaLabel}
              key={player.key}
              onSearchRiotId={onSearchRiotId}
              player={player}
            />
          ))}
        </div>
      </section>
      {team.compareAfter}
    </Fragment>
  );
}

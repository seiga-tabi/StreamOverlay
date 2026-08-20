import {
  MatchTeamDetailsTeamSection,
  type MatchTeamDetailsColumnLabels,
  type MatchTeamDetailsTeamSectionViewModel
} from "./MatchTeamDetailsTeamSection";
import type { MatchTeamDetailsPlayerRowViewModel } from "./MatchTeamDetailsPlayerRow";

export type MatchTeamDetailsPlayer = MatchTeamDetailsPlayerRowViewModel;
export type MatchTeamDetailsTeam = MatchTeamDetailsTeamSectionViewModel;
export type MatchTeamDetailsColumns = MatchTeamDetailsColumnLabels;

export type MatchTeamDetailsProps = {
  ariaLabel: string;
  kdaLabel: string;
  columns: MatchTeamDetailsColumnLabels;
  teams: MatchTeamDetailsTeam[];
  onSearchRiotId: (riotId: string) => void;
};

export function MatchTeamDetails({ ariaLabel, kdaLabel, columns, teams, onSearchRiotId }: MatchTeamDetailsProps) {
  if (teams.length === 0) return null;

  return (
    <div className="public-team-detail" aria-label={ariaLabel}>
      {teams.map((team) => (
        <MatchTeamDetailsTeamSection
          columns={columns}
          kdaLabel={kdaLabel}
          key={team.key}
          onSearchRiotId={onSearchRiotId}
          team={team}
        />
      ))}
    </div>
  );
}

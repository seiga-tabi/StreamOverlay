import { MatchTeamDetailsPlayerRow, type MatchTeamDetailsPlayerRowViewModel } from "./MatchTeamDetailsPlayerRow";
import { MatchTeamHeader, type MatchTeamHeaderViewModel } from "./MatchTeamHeader";

export type MatchTeamDetailsColumnLabels = {
  champion: string;
  summoner: string;
  kda: string;
  damage: string;
  csVision: string;
  items: string;
};

export type MatchTeamDetailsTeamSectionViewModel = {
  key: string;
  className: string;
  label: MatchTeamHeaderViewModel["label"];
  resultSummary: MatchTeamHeaderViewModel["resultSummary"];
  summary: MatchTeamHeaderViewModel["summary"];
  tierSummary: MatchTeamHeaderViewModel["tierSummary"];
  players: MatchTeamDetailsPlayerRowViewModel[];
};

export type MatchTeamDetailsTeamSectionProps = {
  kdaLabel: string;
  columns: MatchTeamDetailsColumnLabels;
  team: MatchTeamDetailsTeamSectionViewModel;
  onSearchRiotId: (riotId: string) => void;
};

export function MatchTeamDetailsTeamSection({
  kdaLabel,
  columns,
  team,
  onSearchRiotId
}: MatchTeamDetailsTeamSectionProps) {
  return (
    <section className={team.className}>
        <MatchTeamHeader
          viewModel={{
            label: team.label,
            resultSummary: team.resultSummary,
            summary: team.summary,
            tierSummary: team.tierSummary
          }}
        />
        {/* 열 이름 한 줄 — 일본어 「チャンピオン」이 줄바꿈되지 않게 nowrap 은 CSS 에서 강제(목업 §2-4). */}
        <div className="public-team-columns" aria-hidden="true">
          <span className="col-champion">{columns.champion}</span>
          <span className="col-summoner">{columns.summoner}</span>
          <span className="col-kda">{columns.kda}</span>
          <span className="col-damage">{columns.damage}</span>
          <span className="col-cs-vision">{columns.csVision}</span>
          <span className="col-items">{columns.items}</span>
        </div>
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
  );
}

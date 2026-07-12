import type { ReactNode } from "react";
import { PublicTeamMetricStat, type PublicTeamMetricStatViewModel } from "./PublicTeamMetricStat";
import { SearchableRiotId, type SearchableRiotIdViewModel } from "./SearchableRiotId";
import { TeamChampionAvatar, type TeamChampionAvatarViewModel } from "./TeamChampionAvatar";

export type MatchTeamDetailsPlayerRankViewModel = {
  className: string;
  title: string;
  label: ReactNode;
};

export type MatchTeamDetailsPlayerStreamerBadgeViewModel = {
  title: string;
  label: string;
  ko: string;
  ja: string;
};

export type MatchTeamDetailsPlayerKdaViewModel = {
  score: ReactNode;
  metric: ReactNode;
};

export type MatchTeamDetailsPlayerStatsViewModel = {
  damage: PublicTeamMetricStatViewModel;
  cs: PublicTeamMetricStatViewModel;
  vision: PublicTeamMetricStatViewModel;
};

export type MatchTeamDetailsPlayerRowViewModel = {
  key: string;
  className: string;
  championAvatar: TeamChampionAvatarViewModel;
  loadout: ReactNode;
  rank: MatchTeamDetailsPlayerRankViewModel;
  streamerBadge?: MatchTeamDetailsPlayerStreamerBadgeViewModel;
  riotId: SearchableRiotIdViewModel;
  mobileKda: MatchTeamDetailsPlayerKdaViewModel;
  itemBuild: ReactNode;
  kda: MatchTeamDetailsPlayerKdaViewModel;
  stats: MatchTeamDetailsPlayerStatsViewModel;
};

export type MatchTeamDetailsPlayerRowProps = {
  kdaLabel: string;
  player: MatchTeamDetailsPlayerRowViewModel;
  onSearchRiotId: (riotId: string) => void;
};

export function MatchTeamDetailsPlayerRow({
  kdaLabel,
  player,
  onSearchRiotId
}: MatchTeamDetailsPlayerRowProps) {
  return (
    <article className={player.className}>
      <div className="public-team-player-main">
        <TeamChampionAvatar viewModel={player.championAvatar} />
        {player.loadout}
        <div className="public-team-player-copy">
          <div className="public-team-player-id-line">
            <span className={player.rank.className} title={player.rank.title}>
              {player.rank.label}
            </span>
            {player.streamerBadge ? (
              <span
                className="public-team-rank-badge streamer-tier-badge"
                title={player.streamerBadge.title}
                data-ko={player.streamerBadge.ko}
                data-ja={player.streamerBadge.ja}
              >
                {player.streamerBadge.label}
              </span>
            ) : null}
            <span className="public-team-player-id-stack">
              <SearchableRiotId viewModel={player.riotId} onSearch={onSearchRiotId} />
              <span className="public-team-mobile-kda" aria-label={kdaLabel}>
                <strong>{player.mobileKda.score}</strong>
                <span>{player.mobileKda.metric}</span>
              </span>
            </span>
          </div>
        </div>
      </div>
      {player.itemBuild}
      <div className="public-team-stat kda">
        <strong>{player.kda.score}</strong>
        <span>{player.kda.metric}</span>
      </div>
      <PublicTeamMetricStat viewModel={player.stats.damage} />
      <PublicTeamMetricStat viewModel={player.stats.cs} />
      <PublicTeamMetricStat viewModel={player.stats.vision} />
    </article>
  );
}

import type { ReactNode } from "react";
import { PublicTeamMetricStat, type PublicTeamMetricStatViewModel } from "./PublicTeamMetricStat";
import { SearchableRiotId, type SearchableRiotIdViewModel } from "./SearchableRiotId";
import { TeamChampionAvatar, type TeamChampionAvatarViewModel } from "./TeamChampionAvatar";
import { TwitchGlitchIcon } from "../../../shared/TwitchGlitchIcon";

export type MatchTeamDetailsPlayerRankViewModel = {
  className: string;
  title: string;
  label: ReactNode;
};

export type MatchTeamDetailsPlayerStreamerBadgeViewModel = {
  title: string;
  /* 방송 중일 때만 붉은 점을 그립니다 — 상태가 없으면 색도 없습니다(목업 §2-2). */
  live?: boolean;
};

export type MatchTeamDetailsPlayerKdaViewModel = {
  score: ReactNode;
  metric: ReactNode;
};

/* CS·시야는 채운 상자 대신 값 + 보조 줄 한 셀로 병합합니다(목업 §2-3). */
export type MatchTeamDetailsPlayerCsVisionViewModel = {
  value: string;
  sub: string;
};

/* 모바일 두 줄 카드의 아랫줄 — 피해량·CS·시야 텍스트와 2px 트랙(목업 모바일). */
export type MatchTeamDetailsPlayerMobileMetricsViewModel = {
  label: ReactNode;
  fillWidth: string;
};

export type MatchTeamDetailsPlayerStatsViewModel = {
  damage: PublicTeamMetricStatViewModel;
  csVision: MatchTeamDetailsPlayerCsVisionViewModel;
  mobileMetrics: MatchTeamDetailsPlayerMobileMetricsViewModel;
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

/* 행은 8열 표(티어 | 아바타 | 스펠 | 소환사 | KDA | 피해량 | CS·시야 | 아이템)로
   평탄화합니다 — 두 팀이 같은 격자를 공유해야 열이 세로로 맞습니다(목업 §2-4).
   티어 배지는 이름 옆이 아니라 행의 첫 열입니다. */
export function MatchTeamDetailsPlayerRow({
  kdaLabel,
  player,
  onSearchRiotId
}: MatchTeamDetailsPlayerRowProps) {
  return (
    <article className={player.className}>
      <span className={player.rank.className} title={player.rank.title}>
        {player.rank.label}
      </span>
      <TeamChampionAvatar viewModel={player.championAvatar} />
      {player.loadout}
      <div className="public-team-player-copy">
        <div className="public-team-player-id-line">
          <span className="public-team-player-id-stack">
            <SearchableRiotId viewModel={player.riotId} onSearch={onSearchRiotId} />
          </span>
          {player.streamerBadge ? (
            <span
              className={`public-team-rank-badge streamer-tier-badge${player.streamerBadge.live ? " is-live" : ""}`}
              title={player.streamerBadge.title}
            >
              <TwitchGlitchIcon />
              {player.streamerBadge.live ? <i className="streamer-live-dot" aria-hidden="true" /> : null}
            </span>
          ) : null}
          <span className="public-team-mobile-kda" aria-label={kdaLabel}>
            <strong>{player.mobileKda.score}</strong>
            <span>{player.mobileKda.metric}</span>
          </span>
        </div>
      </div>
      <div className="public-team-stat kda">
        <strong>{player.kda.score}</strong>
        <span>{player.kda.metric}</span>
      </div>
      <PublicTeamMetricStat viewModel={player.stats.damage} />
      <div className="public-team-stat cs-vision">
        <strong>{player.stats.csVision.value}</strong>
        <span>{player.stats.csVision.sub}</span>
      </div>
      <div className="public-team-mobile-metrics">
        <span className="public-team-mobile-metrics-label">{player.stats.mobileMetrics.label}</span>
        <span className="public-team-mobile-metrics-track" aria-hidden="true">
          <i style={{ width: player.stats.mobileMetrics.fillWidth }} />
        </span>
      </div>
      {player.itemBuild}
    </article>
  );
}

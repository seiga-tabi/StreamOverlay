import type { LolChampionSummary, LolRankedStats, SoloRankProfileUpdateMessage } from "@streamops/shared";

type SoloRankOverlayProps = {
  profile?: SoloRankProfileUpdateMessage;
};

const tierLabels: Record<string, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
  UNRANKED: "Unranked"
};

function rankLabel(stats: LolRankedStats | undefined): string {
  if (!stats || stats.tier === "UNRANKED") return "Unranked";
  const tier = tierLabels[stats.tier] ?? stats.tier;
  return stats.rank ? `${tier} ${stats.rank}` : tier;
}

function championImage(champion: LolChampionSummary | undefined): string | undefined {
  return champion?.splashUrl ?? champion?.loadingUrl ?? champion?.iconUrl;
}

function championAvatar(champion: LolChampionSummary | undefined): string | undefined {
  return champion?.iconUrl ?? champion?.loadingUrl ?? champion?.splashUrl;
}

export function SoloRankOverlay({ profile }: SoloRankOverlayProps) {
  if (!profile) return null;

  const streamer = profile.profile;
  const stats = streamer.rankedStats;
  const champion = streamer.topChampions?.[0];
  const background = championImage(champion);
  const displayName = streamer.displayName ?? "配信者";
  const riotTagLine = streamer.riotTagLine?.trim();
  const tagLabel = riotTagLine ? `#${riotTagLine.replace(/^#/u, "")}` : undefined;
  const recentMatches = (streamer.recentMatches ?? []).slice(0, 5);
  const tierIconUrl = stats?.tierIconUrl;

  return (
    <section className="solo-rank-overlay" aria-label="솔로랭크 전적">
      <div className={recentMatches.length > 0 ? "solo-rank-card has-history" : "solo-rank-card"}>
        {background ? <img className="solo-rank-bg" src={background} alt="" aria-hidden="true" /> : null}
        <div className="solo-rank-sheen" aria-hidden="true" />
        <div className="solo-rank-top">
          <div className="solo-rank-player">
            <div className="solo-rank-name-block">
              <span className="solo-rank-live-status" data-ko="라이브" data-ja="LIVE"><i aria-hidden="true" />LIVE</span>
              <div className="solo-rank-name-row">
                <h1>{displayName}</h1>
                {tagLabel ? <span className="solo-rank-tag">{tagLabel}</span> : null}
              </div>
            </div>
          </div>
          <div className="solo-rank-rank">
            <div className={tierIconUrl ? "solo-rank-emblem has-emblem-image" : "solo-rank-emblem"} data-tier={stats?.tier ?? "UNRANKED"} aria-hidden="true">
              {tierIconUrl ? <img src={tierIconUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : <span />}
            </div>
            <div className="solo-rank-rank-copy">
              <span>{profile.queueLabel ?? "Solo/Duo"}</span>
              <strong>{rankLabel(stats)}</strong>
              <em>{stats ? `${stats.leaguePoints} LP` : "-- LP"}</em>
              <p>{stats ? `${stats.wins}W ${stats.losses}L · ${stats.winRate}%` : "--W --L · --%"}</p>
            </div>
          </div>
        </div>
        {recentMatches.length > 0 ? (
          <div className="solo-rank-history">
            <span data-ko="최근 경기" data-ja="最近の試合">最近の試合</span>
            <div className="solo-rank-history-list">
              {recentMatches.map((match, index) => {
                const image = championAvatar(match);
                return (
                  <div className={match.won ? "solo-rank-match win" : "solo-rank-match loss"} key={`${match.championId}-${index}`}>
                    {image ? <img src={image} alt="" aria-hidden="true" /> : <strong>{match.nameJa ?? match.nameKo}</strong>}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

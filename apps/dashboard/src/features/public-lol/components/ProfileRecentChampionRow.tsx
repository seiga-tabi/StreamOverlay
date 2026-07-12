export type ProfileRecentChampionRowViewModel = {
  name: string;
  iconUrl?: string;
  fallbackLabel: string;
  recordLabel: string;
  score: string;
  scoreClassName: string;
  ratingLabel: string;
};

export type ProfileRecentChampionRowProps = {
  champion: ProfileRecentChampionRowViewModel;
};

export function ProfileRecentChampionRow({
  champion,
}: ProfileRecentChampionRowProps) {
  return (
    <div className="public-recent-champion-row">
      {champion.iconUrl ? (
        <img src={champion.iconUrl} alt="" loading="lazy" />
      ) : (
        <span className="public-recent-champion-fallback" aria-hidden="true">{champion.fallbackLabel}</span>
      )}
      <div className="public-recent-champion-main">
        <strong title={champion.name}>{champion.name}</strong>
        <small>{champion.recordLabel}</small>
      </div>
      <div className="public-recent-champion-score">
        <strong className={champion.scoreClassName}>{champion.score}</strong>
        <small>{champion.ratingLabel}</small>
      </div>
    </div>
  );
}

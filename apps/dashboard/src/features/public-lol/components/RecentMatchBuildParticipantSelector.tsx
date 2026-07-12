export type RecentMatchBuildParticipantOptionViewModel = {
  key: string;
  active: boolean;
  title: string;
  championIconUrl?: string;
  championFallback: string;
  score: number;
  scoreClassName: string;
};

export type RecentMatchBuildParticipantSelectorProps = {
  participants: RecentMatchBuildParticipantOptionViewModel[];
  onSelectParticipant: (key: string) => void;
  championAriaLabel: string;
};

export function RecentMatchBuildParticipantSelector({
  participants,
  onSelectParticipant,
  championAriaLabel
}: RecentMatchBuildParticipantSelectorProps) {
  return (
    <div className="public-match-build-picker" role="listbox" aria-label={championAriaLabel}>
      {participants.map((participant) => (
        <button
          type="button"
          className={participant.active ? "active" : ""}
          key={participant.key}
          onClick={() => onSelectParticipant(participant.key)}
          title={participant.title}
        >
          {participant.championIconUrl ? <img src={participant.championIconUrl} alt="" /> : <span>{participant.championFallback}</span>}
          <strong className={participant.scoreClassName}>{participant.score}</strong>
        </button>
      ))}
    </div>
  );
}

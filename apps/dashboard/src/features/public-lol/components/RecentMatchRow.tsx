import type { ReactNode } from "react";

export type RecentMatchRowLocalizedText = {
  label: ReactNode;
  ko: string;
  ja: string;
};

export type RecentMatchRowMediaItem = {
  key: string;
  className?: string;
  content: ReactNode;
};

export type RecentMatchRowProps = {
  result: string;
  highlightClass: string;
  expanded: boolean;
  resultLabel: ReactNode;
  queueLabel: ReactNode;
  startedAtLabel: ReactNode;
  resultDurationLabel: ReactNode;
  relativeLabel: ReactNode;
  championIconUrl?: string;
  championFallback: ReactNode;
  championName: ReactNode;
  championRoleLevel: ReactNode;
  spellItems: RecentMatchRowMediaItem[];
  summonerSpellsLabel: string;
  kdaScore: ReactNode;
  kdaMetric: ReactNode;
  badges: ReactNode;
  scoreClassName: string;
  aiScoreText: RecentMatchRowLocalizedText;
  aiScore: ReactNode;
  csLabel: ReactNode;
  csPerMinuteMetric: ReactNode;
  killParticipationMetric: ReactNode;
  itemSlots: RecentMatchRowMediaItem[];
  itemsLabel: string;
  expandAriaLabel: string;
  expandedPanel?: ReactNode;
  onToggleExpand: () => void;
};

export function RecentMatchRow({
  result,
  highlightClass,
  expanded,
  resultLabel,
  queueLabel,
  startedAtLabel,
  resultDurationLabel,
  relativeLabel,
  championIconUrl,
  championFallback,
  championName,
  championRoleLevel,
  spellItems,
  summonerSpellsLabel,
  kdaScore,
  kdaMetric,
  badges,
  scoreClassName,
  aiScoreText,
  aiScore,
  csLabel,
  csPerMinuteMetric,
  killParticipationMetric,
  itemSlots,
  itemsLabel,
  expandAriaLabel,
  expandedPanel,
  onToggleExpand
}: RecentMatchRowProps) {
  return (
    <article className={`public-match-row ${result} ${highlightClass} ${expanded ? "expanded" : ""}`}>
      <div className="public-match-summary">
        <div className="public-result">
          <b className={`public-match-result-pill ${result}`}>{resultLabel}</b>
          <strong>{queueLabel}</strong>
          <span className="public-match-started">{startedAtLabel}</span>
          <small>{resultDurationLabel}</small>
          <em className="public-match-relative">{relativeLabel}</em>
        </div>
        <div className={`public-champion-cell ${highlightClass}`}>
          {championIconUrl ? <img src={championIconUrl} alt="" /> : <span>{championFallback}</span>}
          {spellItems.length > 0 ? (
            <div className="public-match-mobile-spells" aria-label={summonerSpellsLabel}>
              {spellItems.map((spell) => (
                <span key={spell.key}>
                  {spell.content}
                </span>
              ))}
            </div>
          ) : null}
          <div>
            <strong>{championName}</strong>
            <small>{championRoleLevel}</small>
          </div>
        </div>
        <div className="public-kda">
          <strong>{kdaScore}</strong>
          <span>{kdaMetric}</span>
          {badges}
        </div>
        <div className={`public-match-score ${scoreClassName}`}>
          <span data-ko={aiScoreText.ko} data-ja={aiScoreText.ja}>{aiScoreText.label}</span>
          <strong>{aiScore}</strong>
        </div>
        <div className="public-match-meta">
          <span>{csLabel}</span>
          <span>{csPerMinuteMetric}</span>
          <span>{killParticipationMetric}</span>
        </div>
        <div className="public-match-inline-items" aria-label={itemsLabel}>
          {itemSlots.map((item) => (
            <span className={item.className ?? ""} key={item.key}>
              {item.content}
            </span>
          ))}
        </div>
        <div className={`public-match-impact ${result} ${scoreClassName}`}>
          <strong>{aiScore}</strong>
          <span>{aiScoreText.label}</span>
        </div>
        <button
          type="button"
          className="public-match-expand"
          aria-expanded={expanded}
          aria-label={expandAriaLabel}
          onClick={onToggleExpand}
        >
          <span aria-hidden="true" />
        </button>
      </div>

      {expanded ? expandedPanel : null}
    </article>
  );
}

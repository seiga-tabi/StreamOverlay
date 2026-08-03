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
  matchAriaLabel: string;
  result: string;
  highlightClass: string;
  expanded: boolean;
  resultLabel: ReactNode;
  queueLabel: ReactNode;
  startedAtLabel: ReactNode;
  startedAtTimeLabel: ReactNode;
  resultDurationLabel: ReactNode;
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
  scoreAriaLabel: string;
  csLabel: ReactNode;
  csPerMinuteMetric: ReactNode;
  killParticipationMetric: ReactNode;
  averageTierMetric: ReactNode;
  itemSlots: RecentMatchRowMediaItem[];
  itemsLabel: string;
  expandAriaLabel: string;
  expandedPanel?: ReactNode;
  onToggleExpand: () => void;
};

export function RecentMatchRow({
  matchAriaLabel,
  result,
  highlightClass,
  expanded,
  resultLabel,
  queueLabel,
  startedAtLabel,
  startedAtTimeLabel,
  resultDurationLabel,
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
  scoreAriaLabel,
  csLabel,
  csPerMinuteMetric,
  killParticipationMetric,
  averageTierMetric,
  itemSlots,
  itemsLabel,
  expandAriaLabel,
  expandedPanel,
  onToggleExpand
}: RecentMatchRowProps) {
  return (
    <article
      aria-label={matchAriaLabel}
      className={`public-match-row ${result} ${highlightClass} ${expanded ? "expanded" : ""}`}
    >
      <div className="public-match-summary">
        <div className="public-result">
          <b className={`public-match-result-pill ${result}`}>{resultLabel}</b>
          <strong>{queueLabel}</strong>
          <span className="public-match-started">
            <span>{startedAtLabel}</span>
            <span>{startedAtTimeLabel}</span>
          </span>
          <small>{resultDurationLabel}</small>
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
          <div className="public-kda-summary">
            <span>{kdaMetric}</span>
            {badges}
          </div>
        </div>
        <div aria-label={scoreAriaLabel} className={`public-match-score ${scoreClassName}`}>
          <span data-ko={aiScoreText.ko} data-ja={aiScoreText.ja}>{aiScoreText.label}</span>
          <strong>{aiScore}</strong>
        </div>
        <div className="public-match-meta">
          <span>{killParticipationMetric}</span>
          <span className="public-match-cs-metric">{csLabel}<small>{csPerMinuteMetric}</small></span>
          <span>{averageTierMetric}</span>
        </div>
        <div className="public-match-inline-items" aria-label={itemsLabel}>
          {itemSlots.map((item) => (
            <span className={item.className ?? ""} key={item.key}>
              {item.content}
            </span>
          ))}
        </div>
        <div aria-label={scoreAriaLabel} className={`public-match-impact ${result} ${scoreClassName}`}>
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

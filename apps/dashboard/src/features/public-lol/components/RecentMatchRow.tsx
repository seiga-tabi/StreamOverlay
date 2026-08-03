import type { ReactNode } from "react";

export type RecentMatchRowLocalizedText = {
  label: ReactNode;
  ko: string;
  ja: string;
};

export type RecentMatchRowMediaItem = {
  key: string;
  className?: string;
  label?: string;
  content: ReactNode;
};

export type RecentMatchRowMetric = {
  key: string;
  label: ReactNode;
  value: ReactNode;
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
  aiScore: number;
  scoreAriaLabel: string;
  metrics: RecentMatchRowMetric[];
  itemSlots: RecentMatchRowMediaItem[];
  itemsLabel: string;
  expandAriaLabel: string;
  expandedPanel?: ReactNode;
  onToggleExpand: () => void;
};

function scoreGrade(score: number): string {
  if (score >= 90) return "S+";
  if (score >= 85) return "S";
  if (score >= 75) return "A+";
  if (score >= 65) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  return "D";
}

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
  metrics,
  itemSlots,
  itemsLabel,
  expandAriaLabel,
  expandedPanel,
  onToggleExpand
}: RecentMatchRowProps) {
  const grade = scoreGrade(aiScore);

  return (
    <article
      aria-label={matchAriaLabel}
      className={`public-match-row ${result} ${highlightClass} ${expanded ? "expanded" : ""}`}
    >
      <div className="public-match-summary">
        <div className="public-match-outcome">
          <b className={`public-match-result-pill ${result}`}>{resultLabel}</b>
          <strong>{queueLabel}</strong>
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
          <div className="public-champion-copy">
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
        <div className="public-match-inline-items" aria-label={itemsLabel}>
          {itemSlots.map((item) => (
            <span
              aria-label={item.label}
              className={item.className ?? ""}
              data-tooltip={item.label}
              key={item.key}
              title={item.label}
            >
              {item.content}
            </span>
          ))}
        </div>
        <div aria-label={scoreAriaLabel} className={`public-match-score ${scoreClassName}`}>
          <strong>{aiScore}</strong>
          <b>{grade}</b>
          <small data-ko={aiScoreText.ko} data-ja={aiScoreText.ja}>{aiScoreText.label}</small>
        </div>
        <div className="public-match-meta">
          {metrics.map((metric) => (
            <span key={metric.key}>
              <strong>{metric.value}</strong>
              <small>{metric.label}</small>
            </span>
          ))}
        </div>
        <div className="public-match-time">
          <span>{startedAtLabel}</span>
          <span>{startedAtTimeLabel}</span>
          <small>{resultDurationLabel}</small>
        </div>
        <button
          type="button"
          className="public-match-expand"
          aria-expanded={expanded}
          aria-label={expandAriaLabel}
          onClick={onToggleExpand}
        >
          <span aria-hidden="true" />
          <span className="public-match-expand-label" role="tooltip">{expandAriaLabel}</span>
        </button>
      </div>

      {expanded ? expandedPanel : null}
    </article>
  );
}

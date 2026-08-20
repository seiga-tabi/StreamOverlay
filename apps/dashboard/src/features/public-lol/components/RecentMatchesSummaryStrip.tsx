import type { ReactNode } from "react";

export type RecentMatchesSummaryChampion = {
  key: string;
  name: string;
  iconUrl?: string;
  fallbackLabel: string;
  metaLabel: string;
  /* 칩 안 승률만 전용색(목업 §3-2). 50% 이상 청자, 미만 홍옥. */
  winRateLabel?: string;
  winRateTone?: "win" | "loss";
};

export type RecentMatchesSummaryStripText = {
  winRateLabel: string;
  winsLabel: string;
  lossesLabel: string;
  averageKdaLabel: string;
  topChampionsLabel: string;
};

export type RecentMatchesSummaryStripProps = {
  wins: number;
  losses: number;
  winRatePercent: number;
  winRateCaption: string;
  averageKdaLabel: ReactNode;
  champions: RecentMatchesSummaryChampion[];
  text: RecentMatchesSummaryStripText;
  actions?: ReactNode;
};

const DONUT_RADIUS = 26;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function RecentMatchesSummaryStrip({
  wins,
  losses,
  winRatePercent,
  winRateCaption,
  averageKdaLabel,
  champions,
  text,
  actions
}: RecentMatchesSummaryStripProps) {
  const safeRate = Math.max(0, Math.min(100, winRatePercent));
  const winArc = (DONUT_CIRCUMFERENCE * safeRate) / 100;

  return (
    <section className="public-match-summary-strip" aria-label={text.winRateLabel}>
      <div className="public-match-summary-rate">
        <span className="public-match-summary-donut">
          <svg viewBox="0 0 56 56" aria-hidden="true" focusable="false">
            <circle className="track" cx="28" cy="28" r={DONUT_RADIUS} fill="none" strokeWidth="5" />
            <circle
              className="value"
              cx="28"
              cy="28"
              r={DONUT_RADIUS}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${winArc.toFixed(1)} ${DONUT_CIRCUMFERENCE.toFixed(1)}`}
            />
          </svg>
          <b>{safeRate}%</b>
        </span>
        <span className="public-match-summary-rate-copy">
          <strong>
            <em>{wins}{text.winsLabel}</em>
            {" "}
            <i>{losses}{text.lossesLabel}</i>
          </strong>
          <span>{winRateCaption}</span>
        </span>
      </div>

      <span className="public-match-summary-divider" aria-hidden="true" />

      <div className="public-match-summary-kda">
        <b>{averageKdaLabel}</b>
        <span>{text.averageKdaLabel}</span>
      </div>

      {champions.length > 0 ? (
        <>
          <span className="public-match-summary-divider" aria-hidden="true" />
          <div className="public-match-summary-champions">
            <span>{text.topChampionsLabel}</span>
            <div className="public-match-summary-champion-list">
              {champions.map((champion) => (
                <span className="public-match-summary-champion" key={champion.key}>
                  {champion.iconUrl
                    ? <img src={champion.iconUrl} alt="" />
                    : <i aria-hidden="true">{champion.fallbackLabel}</i>}
                  <b>{champion.name}</b>
                  <small>{champion.metaLabel}</small>
                  {champion.winRateLabel
                    ? <em className={champion.winRateTone === "loss" ? "is-loss" : "is-win"}>{champion.winRateLabel}</em>
                    : null}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {actions ? <div className="public-match-summary-actions">{actions}</div> : null}
    </section>
  );
}

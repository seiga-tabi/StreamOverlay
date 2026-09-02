import { useState } from "react";
import { t } from "../i18n/public-lol-i18n";
import type { PublicLolProfile } from "../types/public-lol";
import { rankTrendLine, type PublicLolRankQueueId } from "../utils/rank";

export type RankTrendChartProps = {
  profile: PublicLolProfile;
  queueId: PublicLolRankQueueId;
  compact?: boolean;
};

export function LpTrendLineChart({ profile, queueId, compact = false }: RankTrendChartProps) {
  const [activePointKey, setActivePointKey] = useState<string>();
  const trend = rankTrendLine(profile, queueId);
  if (!trend) return <p className="public-empty">{t().noData}</p>;
  const latestPoint = trend.points[trend.points.length - 1];
  const activePoint = trend.points.find((point) => point.key === activePointKey);
  const changeTone = trend.change > 0 ? "positive" : trend.change < 0 ? "negative" : "neutral";
  const changeLabel = trend.change === 0
    ? t().lpNoChange
    : `${trend.change > 0 ? "+" : ""}${trend.change} LP`;
  const tooltipWidth = 142;
  const tooltipX = activePoint
    ? Math.max(54, Math.min(308 - tooltipWidth, activePoint.x - (tooltipWidth / 2)))
    : 0;
  const tooltipY = activePoint
    ? activePoint.y < 42 ? activePoint.y + 10 : activePoint.y - 32
    : 0;

  return (
    <>
      {compact ? null : (
        <div className="public-lp-chart-summary">
          <span><small>{t().lpCurrent}</small><strong>{trend.latestLabel}</strong></span>
          <span><small>{t().lpPeriodChange}</small><strong className={changeTone}>{changeLabel}</strong></span>
          <span className="records">{trend.sampleCount}{t().lpRecords}</span>
        </div>
      )}
      <svg className={`public-lp-line ${compact ? "compact" : ""}`} viewBox="0 0 320 152" role="img" aria-label={t().lpTrend}>
        <g className="public-lp-tier-bands" aria-hidden="true">
          {trend.tierBands.map((band) => (
            <g key={band.key}>
              <rect
                className={`public-lp-tier-band ${band.className}`}
                x={band.x}
                y={band.y}
                width={band.width}
                height={band.height}
              />
            </g>
          ))}
        </g>
        <g className="public-lp-axis-ticks" aria-hidden="true">
          {trend.axisTicks.map((tick) => (
            <g key={tick.key}>
              <line className="public-lp-axis-grid" x1={tick.x1} x2={tick.x2} y1={tick.y} y2={tick.y} />
              {compact ? null : (
                <text className="public-lp-axis-label" x="4" y={tick.y} dominantBaseline="middle">
                  {tick.label}
                </text>
              )}
            </g>
          ))}
        </g>
        <path className="public-lp-line-area" d={trend.areaPath} />
        <polyline className="public-lp-line-stroke" points={trend.linePoints} />
        {trend.points.map((point) => (
          <g
            aria-label={point.label}
            className={`public-lp-line-point ${point.result} ${point.key === latestPoint?.key ? "latest" : ""}`}
            key={point.key}
            onBlur={() => setActivePointKey(undefined)}
            onFocus={() => setActivePointKey(point.key)}
            onMouseEnter={() => setActivePointKey(point.key)}
            onMouseLeave={() => setActivePointKey(undefined)}
            role="img"
            tabIndex={compact ? undefined : 0}
          >
            <circle cx={point.x} cy={point.y} r="4" />
            <title>{point.label}</title>
          </g>
        ))}
        {compact || !activePoint ? null : (
          <g className="public-lp-point-tooltip" aria-hidden="true" pointerEvents="none">
            <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height="24" rx="6" />
            <text x={tooltipX + (tooltipWidth / 2)} y={tooltipY + 12} dominantBaseline="middle" textAnchor="middle">
              {activePoint.label}
            </text>
          </g>
        )}
      </svg>
      {compact ? null : <div className="public-lp-chart-axis" aria-hidden="true">
        <span>{trend.startLabel}</span>
        <span>{trend.middleLabel}</span>
        <span>{trend.endLabel}</span>
      </div>}
    </>
  );
}

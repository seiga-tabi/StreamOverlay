import { t } from "../i18n/public-lol-i18n";
import type { PublicLolProfile } from "../types/public-lol";
import { rankTrendLine } from "../utils/rank";

export type RankTrendChartProps = {
  profile: PublicLolProfile;
  compact?: boolean;
};

export function LpTrendLineChart({ profile, compact = false }: RankTrendChartProps) {
  const trend = rankTrendLine(profile);
  if (!trend) return <p className="public-empty">{t().noData}</p>;
  const latestPoint = trend.points[trend.points.length - 1];

  return (
    <>
      <svg className={`public-lp-line ${compact ? "compact" : ""}`} viewBox="0 0 320 168" role="img" aria-label={t().lpTrend}>
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
              {compact ? null : (
                <text
                  className={`public-lp-tier-band-label ${band.className}`}
                  x={band.x + 10}
                  y={band.y + (band.height / 2)}
                  dominantBaseline="middle"
                >
                  {band.label}
                </text>
              )}
            </g>
          ))}
        </g>
        <g className="public-lp-tier-boundaries" aria-hidden="true">
          {trend.tierBoundaries.map((boundary) => (
            <line
              className="public-lp-tier-boundary"
              key={boundary.key}
              x1={boundary.x1}
              x2={boundary.x2}
              y1={boundary.y}
              y2={boundary.y}
            />
          ))}
        </g>
        <path className="public-lp-line-area" d={trend.areaPath} />
        <polyline className="public-lp-line-stroke" points={trend.linePoints} />
        {trend.points.map((point) => (
          <g className={`public-lp-line-point ${point.result} ${point.key === latestPoint?.key ? "latest" : ""}`} key={point.key}>
            <circle cx={point.x} cy={point.y} r="4" />
            <title>{point.label}</title>
          </g>
        ))}
      </svg>
      {compact ? null : <div className="public-lp-chart-axis" aria-hidden="true">
        <span>{trend.startLabel}</span>
        <span>{trend.middleLabel}</span>
        <span>{trend.endLabel}</span>
      </div>}
    </>
  );
}

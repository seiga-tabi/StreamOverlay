import type { ReactNode } from "react";

/* 전적 상세 — 라인 1:1 비교.
 *
 * 기존 .public-team-card / .public-team-detail 계열은 legacy 에서 !important 로
 * 잠겨 있어(각각 49건·1건) pages layer 로는 이길 수 없습니다. 새 이름만 씁니다.
 */

export type LaneSideView = {
  name: string;
  championName: string;
  championIcon?: ReactNode;
  kdaLabel: string;
  /** "Challenger I" 처럼 조립된 티어 문구. 티어가 없으면 비워 둡니다. */
  rankLabel?: string;
  /** "C1" 같은 축약. 좁은 폭에서 이 값을 씁니다. */
  rankShortLabel?: string;
  /** 소문자 티어 키. 색을 고르는 데 씁니다. */
  rankTier?: string;
  /** 최종 아이템. 넓은 폭에서 KDA 옆 남는 공간에만 그립니다. */
  items?: Array<{ key: string; iconUrl?: string; label?: string }>;
  isTarget?: boolean;
  onSearch?: () => void;
};

export type LaneRowView = {
  key: string;
  positionLabel: string;
  ally?: LaneSideView;
  enemy?: LaneSideView;
  damageShare: { ally: number; enemy: number };
  goldShare: { ally: number; enemy: number };
};

export type MatchGapCard = { key: string; label: string; value: string; tone?: "up" | "down" | "flat" };

export type MatchLaneCompareText = {
  ariaLabel: string;
  damageLabel: string;
  goldLabel: string;
  emptySlotLabel: string;
  itemsLabel: string;
};

function LaneSide({ side, align, text }: { side: LaneSideView | undefined; align: "start" | "end"; text: MatchLaneCompareText }) {
  if (!side) {
    return <span className={`public-md-lane-side is-${align} is-empty`}>{text.emptySlotLabel}</span>;
  }

  const name = (
    <span className="public-md-lane-name">
      <b>{side.name}</b>
      <small>{side.championName}</small>
    </span>
  );

  /* 티어는 색만으로 구분하지 않고 글자를 함께 둡니다.
     좁은 폭에서는 축약(C1), 넓어지면 전체(Challenger I)를 보여 줍니다. */
  const rank = (
    <span
      className="public-md-lane-rank"
      data-tier={side.rankTier ?? "unranked"}
      title={side.rankLabel ?? undefined}
    >
      <b>{side.rankShortLabel ?? "-"}</b>
      {side.rankLabel ? <i>{side.rankLabel}</i> : null}
    </span>
  );

  /* 데스크톱에서 각 편 블록이 배정 폭의 1/3만 쓰고 나머지가 비어 있었습니다.
     남는 공간에 최종 아이템을 그립니다. 좁은 폭에서는 CSS 가 숨깁니다. */
  const items = side.items?.length ? (
    <span aria-label={text.itemsLabel} className="public-md-lane-items">
      {side.items.map((item) => (
        item.iconUrl
          ? <img alt="" key={item.key} src={item.iconUrl} title={item.label} />
          : <i aria-hidden="true" key={item.key} />
      ))}
    </span>
  ) : null;

  return (
    <span className={`public-md-lane-side is-${align} ${side.isTarget ? "is-target" : ""}`}>
      <span className="public-md-lane-portrait">{side.championIcon}</span>
      {rank}
      {side.onSearch ? (
        <button className="public-md-lane-search" onClick={side.onSearch} type="button">{name}</button>
      ) : name}
      <span className="public-md-lane-kda">{side.kdaLabel}</span>
      {items}
    </span>
  );
}

export function MatchLaneCompare({
  rows,
  gapCards,
  text,
}: {
  rows: LaneRowView[];
  gapCards: MatchGapCard[];
  text: MatchLaneCompareText;
}) {
  return (
    <div className="public-md-record">
      {gapCards.length > 0 ? (
        <dl className="public-md-gap">
          {gapCards.map((card) => (
            <div key={card.key}>
              <dt>{card.label}</dt>
              <dd data-tone={card.tone ?? "flat"}>{card.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ol aria-label={text.ariaLabel} className="public-md-lanes">
        {rows.map((row) => (
          <li className={`public-md-lane ${row.ally?.isTarget ? "is-mine" : ""}`} key={row.key}>
            <span className="public-md-lane-pos">{row.positionLabel}</span>
            <LaneSide align="start" side={row.ally} text={text} />

            {/* 팀 전체 합이 아니라 이 두 사람의 비율입니다. "내가 이겼나"를 바로 읽게 합니다. */}
            <span className="public-md-lane-bars">
              <span className="public-md-lane-bar">
                <i className="is-ally" style={{ width: `${row.damageShare.ally}%` }} />
              </span>
              <em>{text.damageLabel}</em>
              <span className="public-md-lane-bar is-right">
                <i className="is-enemy" style={{ width: `${row.damageShare.enemy}%` }} />
              </span>

              <span className="public-md-lane-bar">
                <i className="is-ally is-gold" style={{ width: `${row.goldShare.ally}%` }} />
              </span>
              <em>{text.goldLabel}</em>
              <span className="public-md-lane-bar is-right">
                <i className="is-enemy is-gold" style={{ width: `${row.goldShare.enemy}%` }} />
              </span>
            </span>

            <LaneSide align="end" side={row.enemy} text={text} />
          </li>
        ))}
      </ol>
    </div>
  );
}

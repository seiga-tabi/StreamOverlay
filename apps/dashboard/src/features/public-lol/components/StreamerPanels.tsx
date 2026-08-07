import type { ReactNode } from "react";

/* 스트리머 목록 조각.
 *
 * 기존 .public-twitch-followed-* / .public-streamers-shared-* 는 legacy 에서
 * 카드 높이를 64px 로 고정하고 overflow: hidden 을 걸어 두어, 랭크·Riot ID·버튼이
 * 렌더링되고도 잘려 나갑니다(실측 scrollHeight 178px). 그 선택자를 쓰지 않는
 * 새 이름으로만 구성합니다.
 */

export type StreamerChannelView = {
  key: string;
  displayName: string;
  login: string;
  avatar?: ReactNode;
  isLive: boolean;
  /** "Challenger I" 처럼 이미 조립된 티어 문구. 없으면 미연결로 봅니다. */
  rankLabel?: string;
  /** rankBadgeClass() 결과. 티어 색을 입힙니다. */
  rankClassName?: string;
  riotId?: string;
  /** 오프라인 행의 보조 문구(팔로우 날짜 등). */
  subLabel?: string;
  title?: string;
  viewersLabel?: string;
  uptimeLabel?: string;
  previewUrl?: string;
  channelUrl?: string;
  onOpenProfile?: () => void;
};

export type StreamerCardText = {
  liveLabel: string;
  watchLabel: string;
  profileLabel: string;
  noRankLabel: string;
};

/* ── LIVE 썸네일 카드 ──────────────────────────────────────── */

export function StreamerLiveCard({ channel, text }: { channel: StreamerChannelView; text: StreamerCardText }) {
  return (
    <article className="public-streamer-live">
      <span className="public-streamer-live-thumb">
        {channel.previewUrl ? <img alt="" loading="lazy" src={channel.previewUrl} /> : null}
        <span className="public-streamer-live-badges">
          <span className="public-streamer-tag" data-tone="live"><i aria-hidden="true" />{text.liveLabel}</span>
          <span className={`public-streamer-rank ${channel.rankClassName ?? ""}`} data-linked={channel.rankLabel ? "true" : "false"}>
            {channel.rankLabel ?? text.noRankLabel}
          </span>
        </span>
        {channel.viewersLabel ? <span className="public-streamer-live-viewers">{channel.viewersLabel}</span> : null}
      </span>

      <div className="public-streamer-live-body">
        <span className="public-streamer-avatar is-live">{channel.avatar}</span>
        <span className="public-streamer-who">
          <b>{channel.displayName}</b>
          {/* 좁은 폭에서는 썸네일이 접히면서 그 위에 있던 랭크·시청자 수도 함께 사라집니다.
              두 줄 중 하나만 display 로 노출되므로 중복 낭독되지 않습니다. */}
          <span className="public-streamer-live-sub">
            @{channel.login}{channel.uptimeLabel ? ` · ${channel.uptimeLabel}` : ""}
          </span>
          <span className="public-streamer-live-sub-compact">
            <span className={`public-streamer-rank ${channel.rankClassName ?? ""}`} data-linked={channel.rankLabel ? "true" : "false"}>
              {channel.rankLabel ?? text.noRankLabel}
            </span>
            {channel.viewersLabel ? <small>{channel.viewersLabel}</small> : null}
          </span>
        </span>
        {channel.title ? <p className="public-streamer-live-title">{channel.title}</p> : null}
        <span className="public-streamer-live-actions">
          {channel.channelUrl ? (
            <a className="public-streamer-button is-twitch" href={channel.channelUrl} rel="noreferrer noopener" target="_blank">
              {text.watchLabel}
            </a>
          ) : null}
          {channel.onOpenProfile ? (
            <button className="public-streamer-button" onClick={channel.onOpenProfile} type="button">
              {text.profileLabel}
            </button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

/* ── 목록 행 ───────────────────────────────────────────────── */

export function StreamerRow({ channel, text }: { channel: StreamerChannelView; text: StreamerCardText }) {
  return (
    <li className={`public-streamer-row ${channel.isLive ? "is-live" : ""}`}>
      <span className={`public-streamer-avatar ${channel.isLive ? "is-live" : ""}`}>{channel.avatar}</span>

      <span className="public-streamer-who">
        <b>{channel.displayName}</b>
      </span>

      <span className="public-streamer-row-meta">
        {channel.isLive ? <span className="public-streamer-tag" data-tone="live"><i aria-hidden="true" />{text.liveLabel}</span> : null}
        <span className={`public-streamer-rank ${channel.rankClassName ?? ""}`} data-linked={channel.rankLabel ? "true" : "false"}>
          {channel.rankLabel ?? text.noRankLabel}
        </span>
        <small>{channel.isLive ? channel.viewersLabel ?? "" : channel.riotId ?? channel.subLabel ?? ""}</small>
      </span>

      <span className="public-streamer-row-actions">
        {channel.onOpenProfile ? (
          <button className="public-streamer-button" onClick={channel.onOpenProfile} type="button">
            {text.profileLabel}
          </button>
        ) : channel.channelUrl ? (
          <a className="public-streamer-button is-twitch" href={channel.channelUrl} rel="noreferrer noopener" target="_blank">
            {text.watchLabel}
          </a>
        ) : null}
      </span>
    </li>
  );
}

/* ── 필터 바 ───────────────────────────────────────────────── */

export type StreamerFilterOption = { id: string; label: string; live?: boolean };

export function StreamerFilterBar({
  options,
  selectedId,
  sortByRank,
  sortLabel,
  onSelect,
  onToggleSort,
}: {
  options: StreamerFilterOption[];
  selectedId: string;
  sortByRank: boolean;
  sortLabel: string;
  onSelect: (id: string) => void;
  onToggleSort: () => void;
}) {
  return (
    <div className="public-streamer-filters" role="group">
      {options.map((option) => (
        <button
          aria-pressed={option.id === selectedId}
          className={`public-streamer-chip ${option.id === selectedId ? "is-active" : ""}`}
          key={option.id}
          onClick={() => onSelect(option.id)}
          type="button"
        >
          {option.live ? <i aria-hidden="true" className="public-streamer-dot" /> : null}
          {option.label}
        </button>
      ))}
      <button
        aria-pressed={sortByRank}
        className={`public-streamer-chip is-sort ${sortByRank ? "is-active" : ""}`}
        onClick={onToggleSort}
        type="button"
      >
        {sortLabel}
      </button>
    </div>
  );
}

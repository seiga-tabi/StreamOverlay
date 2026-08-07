import { Fragment, type ReactNode } from "react";

export type ProfileStreamerCastLink = {
  id?: string;
  url: string;
  label: string;
  platform?: string;
};

export type ProfileStreamerCastText = {
  /** "방송 중" / "최근 방송" */
  liveHeading: string;
  offlineHeading: string;
  liveBadge: string;
  offlineLabel: string;
  /** Twitch 버튼은 좁은 폭에서도 넘치지 않도록 짧은 라벨을 씁니다. */
  watchLabel: string;
  watchAriaLabel: string;
  participationLabel: string;
  ingameLabel: string;
  ingameNotice: string;
  thumbnailLabel: string;
};

export type ProfileStreamerCastProps = {
  isLive: boolean;
  /** 이미 안전 검증(safeTwitchStreamPreviewUrl)을 통과한 URL 만 넘깁니다. */
  previewUrl?: string;
  title?: string;
  gameName?: string;
  /** "1시간 30분째" 또는 오프라인일 때 "2일 전 방송" */
  uptimeLabel?: string;
  viewersLabel?: string;
  channelUrl?: string;
  isInGame: boolean;
  participationOpen: boolean;
  links?: ProfileStreamerCastLink[];
  text: ProfileStreamerCastText;
  renderLinkIcon?: (link: ProfileStreamerCastLink) => ReactNode;
  onOpenParticipation?: () => void;
  onOpenIngame?: () => void;
};

function ViewersIcon() {
  return (
    <svg aria-hidden="true" focusable="false" height="12" viewBox="0 0 24 24" width="12" fill="currentColor">
      <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 1.6c-3 0-6 1.5-6 3.6V19h12v-2.8c0-2.1-3-3.6-6-3.6zM17 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1.6c-.6 0-1.2.1-1.7.2 1.3.9 2.2 2 2.2 3.4V19h5v-2.8c0-2.1-2.7-3.6-5.5-3.6z" />
    </svg>
  );
}

function TwitchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" height="13" viewBox="0 0 24 24" width="13" fill="currentColor">
      <path d="M4 2 2.5 6v14H7v2h3l2-2h3.5L21 16V2zm2 2h13v11l-3 3h-4l-2 2v-2H6zm5 3v6h2V7zm5 0v6h2V7z" />
    </svg>
  );
}

export function ProfileStreamerCast({
  isLive,
  previewUrl,
  title,
  gameName,
  uptimeLabel,
  viewersLabel,
  channelUrl,
  isInGame,
  participationOpen,
  links,
  text,
  renderLinkIcon,
  onOpenParticipation,
  onOpenIngame,
}: ProfileStreamerCastProps) {
  const meta = [gameName, uptimeLabel].filter(Boolean);

  return (
    <section className={`public-profile-hero-cast ${isLive ? "is-live" : "is-offline"}`} aria-live="polite">
      <div className="public-profile-hero-cast-head">
        <span>{isLive ? text.liveHeading : text.offlineHeading}</span>
        <span className="public-profile-hero-cast-viewers">
          <ViewersIcon />
          {isLive && viewersLabel ? viewersLabel : text.offlineLabel}
        </span>
      </div>

      <div className="public-profile-hero-cast-media">
        <span className={`public-profile-hero-cast-thumb ${isLive ? "" : "is-offline"}`}>
          {previewUrl ? <img src={previewUrl} alt="" /> : null}
          {isLive ? <i aria-hidden="true">{text.liveBadge}</i> : null}
          <span className="yoro-u-sr-only">{text.thumbnailLabel}</span>
        </span>
        <span className="public-profile-hero-cast-copy">
          {title ? <span className="public-profile-hero-cast-title">{title}</span> : null}
          {meta.length > 0 ? (
            <span className="public-profile-hero-cast-meta">
              {meta.map((entry, index) => (
                <Fragment key={`${entry}:${index}`}>
                  {index > 0 ? <b aria-hidden="true">·</b> : null}
                  <span>{entry}</span>
                </Fragment>
              ))}
            </span>
          ) : null}
        </span>
      </div>

      {/* 인게임은 방송 중일 때만, 그리고 실제로 게임 중일 때만 한 줄로 나타납니다. */}
      {isInGame ? (
        <div className="public-profile-hero-cast-ingame">
          <i aria-hidden="true" />
          <b>{text.ingameLabel}</b>
          <span>{text.ingameNotice}</span>
          {onOpenIngame ? (
            <button className="public-profile-hero-cast-ghost" type="button" onClick={onOpenIngame}>
              {text.ingameLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="public-profile-hero-cast-actions">
        {onOpenParticipation ? (
          <button
            className={`public-profile-hero-cast-action${participationOpen ? " is-primary" : ""}`}
            onClick={onOpenParticipation}
            type="button"
          >
            {text.participationLabel}
          </button>
        ) : null}
        {channelUrl ? (
          <a
            aria-label={text.watchAriaLabel}
            className={`public-profile-hero-cast-action is-twitch${participationOpen ? "" : " is-primary"}`}
            href={channelUrl}
            rel="noreferrer"
            target="_blank"
          >
            <TwitchIcon />
            {text.watchLabel}
          </a>
        ) : null}
        {links?.length && renderLinkIcon ? (
          <span className="public-profile-hero-cast-links">
            {links.map((link, index) => (
              <span key={`${link.id ?? link.url}:${index}`}>{renderLinkIcon(link)}</span>
            ))}
          </span>
        ) : null}
      </div>
    </section>
  );
}

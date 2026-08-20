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
  /** 액션 3번째 버튼 라벨(목업 "인게임 보기"). 없으면 ingameLabel 로 대체합니다. */
  ingameViewLabel?: string;
  /** 상태줄의 "참여 대기열 열림". participationOpen 일 때만 씁니다. */
  participationOpenLabel?: string;
  thumbnailLabel: string;
  /** previewUrl 이 없을 때(오프라인 채널 대부분) 썸네일 안에 보이는 캡션. */
  previewUnavailableLabel: string;
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

function VideoOffIcon() {
  return (
    <svg aria-hidden="true" focusable="false" height="18" viewBox="0 0 24 24" width="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 5H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2.5" />
      <path d="M16 9.5V8a1 1 0 0 1 1-1h.5l4-2.5v11l-4-2.5" />
      <path d="M2 2l20 20" />
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
          {previewUrl ? (
            <img alt="" src={previewUrl} />
          ) : (
            /* 오프라인 채널은 Twitch가 미리보기 URL을 주지 않아 거의 항상 이 분기입니다.
               빈 배경색만 남기는 대신 "왜 비어 있는지"를 아이콘+캡션으로 설명합니다. */
            <span aria-hidden="true" className="public-profile-hero-cast-thumb-empty">
              <VideoOffIcon />
              <span>{text.previewUnavailableLabel}</span>
            </span>
          )}
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

      {/* 상태줄(목업 §D) — 승색 점 + "게임 중 · 참여 대기열 열림". 데이터 있을 때만. */}
      {isInGame || participationOpen ? (
        <div className="public-profile-hero-cast-status">
          <i aria-hidden="true" />
          <span>
            {[isInGame ? text.ingameNotice : null, participationOpen ? text.participationOpenLabel : null]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
      ) : null}

      {/* 목업 §D 액션 3종 — Twitch 보기(스트로크 강조) · 참여 대기열 · 인게임 보기. */}
      <div className="public-profile-hero-cast-actions">
        {channelUrl ? (
          <a
            aria-label={text.watchAriaLabel}
            className="public-profile-hero-cast-action is-twitch is-primary"
            href={channelUrl}
            rel="noreferrer"
            target="_blank"
          >
            <TwitchIcon />
            {text.watchLabel}
          </a>
        ) : null}
        {onOpenParticipation ? (
          <button
            className="public-profile-hero-cast-action"
            onClick={onOpenParticipation}
            type="button"
          >
            {text.participationLabel}
          </button>
        ) : null}
        {onOpenIngame ? (
          <button className="public-profile-hero-cast-action" onClick={onOpenIngame} type="button">
            {text.ingameViewLabel ?? text.ingameLabel}
          </button>
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

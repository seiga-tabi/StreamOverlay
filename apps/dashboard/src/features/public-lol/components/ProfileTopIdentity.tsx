import type { ReactElement, ReactNode } from "react";

export type ProfileTopIdentitySeasonBadgesRenderer = () => ReactElement | null;

export type ProfileTopIdentityChampion = {
  key: string;
  name: string;
  iconUrl?: string;
  fallbackLabel: string;
};

export type ProfileTopIdentityViewModel = {
  gameName: string;
  tagLine: string;
  displayName?: string;
  displayTagLabel?: string;
  /* 이름 줄 오른쪽 서버 칩(목업: "KR") — 없으면 그리지 않습니다. */
  serverChipLabel?: string;
  /* 이름 아래 "최근 갱신 N분 전" 한 줄(목업 프로필 헤드). */
  fetchedAtText?: string;
  profileMetaLabel?: string;
  profileIconUrl?: string;
  avatarFallbackLabel: string;
  /** "Lv.421" 처럼 이미 조립된 라벨입니다. 값이 없으면 배지를 그리지 않습니다. */
  summonerLevelLabel?: string;
  summonerLevelAriaLabel?: string;
  mainRoleLabel?: string;
  /** 등록 스트리머의 Twitch 채널. 소환사 이름 옆에 붙여 같은 사람임을 한 줄에서 보입니다. */
  channelName?: string;
  channelUrl?: string;
  channelAriaLabel?: string;
  topChampions?: ProfileTopIdentityChampion[];
  topChampionsLabel?: string;
  streamerStatus?: "live" | "offline";
  streamerStatusLabel?: string;
  /** 이름 아래 최근 폼 줄(목업 스트리머 변형) — 최신 경기부터 W/L 순서. */
  recentFormResults?: ReadonlyArray<"win" | "loss">;
  recentFormLabel?: string;
};

export type ProfileTopIdentityProps = {
  identity: ProfileTopIdentityViewModel;
  renderActions: () => ReactElement | null;
  renderSeasonBadges: ProfileTopIdentitySeasonBadgesRenderer;
};

function TwitchIcon(): ReactNode {
  return (
    <svg aria-hidden="true" focusable="false" height="12" viewBox="0 0 24 24" width="12" fill="currentColor">
      <path d="M4 2 2.5 6v14H7v2h3l2-2h3.5L21 16V2zm2 2h13v11l-3 3h-4l-2 2v-2H6zm5 3v6h2V7zm5 0v6h2V7z" />
    </svg>
  );
}

function RoleIcon(): ReactNode {
  return (
    <svg aria-hidden="true" focusable="false" height="12" viewBox="0 0 24 24" width="12" fill="currentColor">
      <path d="M3 21 21 3v5L8 21z" />
    </svg>
  );
}

export function ProfileTopIdentity({
  identity,
  renderActions,
  renderSeasonBadges,
}: ProfileTopIdentityProps) {
  const titleName = identity.displayName ?? identity.gameName;
  const titleTag = identity.displayTagLabel ?? `#${identity.tagLine}`;
  const seasonBadges = renderSeasonBadges();
  const champions = identity.topChampions ?? [];

  return (
    <div className="public-profile-hero-identity">
      <span
        className={`public-profile-hero-avatar${identity.streamerStatus ? ` is-streamer is-${identity.streamerStatus}` : ""}`}
      >
        {identity.profileIconUrl
          ? <img src={identity.profileIconUrl} alt="" />
          : <b aria-hidden="true">{identity.avatarFallbackLabel}</b>}
        {identity.summonerLevelLabel ? (
          <span className="public-profile-hero-level" title={identity.summonerLevelAriaLabel}>
            {identity.summonerLevelLabel}
          </span>
        ) : null}
        {identity.streamerStatusLabel ? <span className="yoro-u-sr-only">{identity.streamerStatusLabel}</span> : null}
      </span>

      <div className="public-profile-hero-copy">
        <h1 className="public-profile-hero-name">
          <span className="public-riot-name">{titleName}</span>
          <span className="public-riot-tag">{titleTag}</span>
          {identity.streamerStatus === "live" ? (
            <span className="public-profile-hero-live-flag">
              <i aria-hidden="true" />
              LIVE
            </span>
          ) : null}
          {identity.serverChipLabel ? (
            <span className="public-profile-hero-server">{identity.serverChipLabel}</span>
          ) : null}
          {identity.channelName ? (
            identity.channelUrl ? (
              <a
                aria-label={identity.channelAriaLabel}
                className="public-profile-hero-channel"
                href={identity.channelUrl}
                rel="noreferrer"
                target="_blank"
              >
                <TwitchIcon />
                {identity.channelName}
              </a>
            ) : (
              <span className="public-profile-hero-channel">
                <TwitchIcon />
                {identity.channelName}
              </span>
            )
          ) : null}
        </h1>
        {identity.fetchedAtText ? (
          <div className="public-profile-hero-fetched-line">{identity.fetchedAtText}</div>
        ) : null}
        {identity.recentFormResults && identity.recentFormResults.length > 0 ? (
          <div className="public-profile-hero-form">
            {identity.recentFormLabel ? (
              <span className="public-profile-hero-form-label">{identity.recentFormLabel}</span>
            ) : null}
            {identity.recentFormResults.map((result, index) => (
              <i key={index} className={`is-${result}`} aria-hidden="true">
                {result === "win" ? "W" : "L"}
              </i>
            ))}
          </div>
        ) : null}
        <div className="public-profile-hero-traits">
          {identity.mainRoleLabel ? (
            <span className="public-profile-hero-trait">
              <RoleIcon />
              {identity.mainRoleLabel}
            </span>
          ) : null}
          {champions.length > 0 ? (
            <span className="public-profile-hero-trait">
              {identity.topChampionsLabel}
              <span className="public-profile-hero-trait-champions">
                {champions.map((champion) => (
                  <span key={champion.key} title={champion.name}>
                    {champion.iconUrl
                      ? <img src={champion.iconUrl} alt="" />
                      : <i aria-hidden="true">{champion.fallbackLabel}</i>}
                  </span>
                ))}
              </span>
            </span>
          ) : null}
          {identity.profileMetaLabel ? (
            <span className="public-profile-hero-trait public-profile-meta-riot-id">{identity.profileMetaLabel}</span>
          ) : null}
          {seasonBadges}
        </div>
      </div>

      {renderActions()}
    </div>
  );
}

import { type ReactNode } from "react";
import { ProfileLinkIcon, profileLinkPlatformClass } from "../../../components/ProfileLinkIcon";

export type ProfileTopActionLink = {
  id?: string;
  url: string;
  label: string;
  platform?: string;
};

export type ProfileTopActionsViewModel = {
  profileLinks: ProfileTopActionLink[];
  loading: boolean;
  refreshDisabled: boolean;
  refreshCoolingDown: boolean;
  refreshCooldownLabel: string;
  refreshTitle: string;
  refreshButtonLabel: string;
  refreshLoadingLabel: string;
  fetchedAtText: string;
  profileLinksLabel: string;
  favoriteActive: boolean;
  favoriteAriaLabel: string;
  favoriteActionLabel: string;
  /** 등록 스트리머일 때만 있습니다. LIVE 여부와 시청자 수를 한 덩어리로 보입니다. */
  liveStatus?: { isLive: boolean; label: string };
};

export type ProfileTopActionsProps = {
  actions: ProfileTopActionsViewModel;
  onRefresh: () => void;
  onToggleFavorite: () => void;
  shareAction?: ReactNode;
};

function StarIcon() {
  return (
    <svg aria-hidden="true" focusable="false" height="14" viewBox="0 0 24 24" width="14"
      fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.4l6.1-.9z" />
    </svg>
  );
}

export function ProfileTopActions({
  actions,
  onRefresh,
  onToggleFavorite,
  shareAction,
}: ProfileTopActionsProps) {
  return (
    <div className="public-profile-hero-actions">
      <div className="public-profile-hero-action-row">
        {actions.liveStatus ? (
          <span
            aria-live="polite"
            className={`public-profile-hero-live-pill${actions.liveStatus.isLive ? "" : " is-offline"}`}
          >
            <i aria-hidden="true" />
            {actions.liveStatus.label}
          </span>
        ) : null}
        <button
          className={`public-profile-hero-refresh${actions.refreshCoolingDown ? " is-cooldown" : ""}`}
          disabled={actions.refreshDisabled}
          onClick={onRefresh}
          title={actions.refreshTitle}
          type="button"
        >
          <svg aria-hidden="true" focusable="false" height="14" viewBox="0 0 24 24" width="14"
            fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 11A8 8 0 0 0 6.3 6.3L3 9" /><path d="M3 4v5h5" />
            <path d="M4 13a8 8 0 0 0 13.7 4.7L21 15" /><path d="M21 20v-5h-5" />
          </svg>
          <strong>
            {actions.refreshCoolingDown
              ? actions.refreshCooldownLabel
              : actions.loading ? actions.refreshLoadingLabel : actions.refreshButtonLabel}
          </strong>
        </button>

        {shareAction}

        <button
          aria-label={actions.favoriteAriaLabel}
          aria-pressed={actions.favoriteActive}
          className="public-profile-hero-icon-button"
          onClick={onToggleFavorite}
          title={actions.favoriteActionLabel}
          type="button"
        >
          <StarIcon />
        </button>

        {actions.profileLinks.length ? (
          <span className="public-profile-hero-links" aria-label={actions.profileLinksLabel}>
            {actions.profileLinks.map((link, index) => (
              <ProfileLinkIcon
                href={link.url}
                key={`${link.id ?? link.url}:${index}`}
                label={link.label}
                platform={profileLinkPlatformClass(link.platform, link.url)}
                url={link.url}
              />
            ))}
          </span>
        ) : null}
      </div>
      {/* 지금 보는 데이터가 언제 것인지 모른 채 갱신을 누르지 않도록 버튼 바로 아래 둡니다. */}
      <span className="public-profile-hero-fetched">{actions.fetchedAtText}</span>
    </div>
  );
}

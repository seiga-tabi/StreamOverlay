import { Button } from "../../../shared/ui/Button";
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
};

export type ProfileTopActionsProps = {
  actions: ProfileTopActionsViewModel;
  onRefresh: () => void;
  onToggleFavorite: () => void;
};

export function ProfileTopActions({
  actions,
  onRefresh,
  onToggleFavorite,
}: ProfileTopActionsProps) {
  return (
    <div className="public-profile-actions">
      <div className="public-refresh-stack">
        {actions.profileLinks.length ? (
          <span className="public-profile-link-icons" aria-label={actions.profileLinksLabel}>
            {actions.profileLinks.map((link, index) => {
              const platform = profileLinkPlatformClass(link.platform, link.url);
              return (
                <ProfileLinkIcon
                  platform={platform}
                  url={link.url}
                  label={link.label}
                  href={link.url}
                  key={`${link.id ?? link.url}:${index}`}
                />
              );
            })}
          </span>
        ) : null}
        <Button
          type="button"
          className={`public-refresh-button ${actions.refreshCoolingDown ? "cooldown" : ""}`}
          onClick={onRefresh}
          disabled={actions.refreshDisabled}
          loading={actions.loading && !actions.refreshCoolingDown}
          loadingLabel={actions.loading && !actions.refreshCoolingDown ? actions.refreshLoadingLabel : undefined}
          size="md"
          title={actions.refreshTitle}
          variant={actions.refreshCoolingDown ? "tertiary" : "primary"}
        >
          {actions.refreshCoolingDown ? (
            <strong>{actions.refreshCooldownLabel}</strong>
          ) : (
            <>
              <span aria-hidden="true">↻</span>
              <strong>{actions.refreshButtonLabel}</strong>
            </>
          )}
        </Button>
      </div>
      <Button type="button" className="public-secondary-action" onClick={onToggleFavorite} size="md" variant="tertiary">
        {actions.favoriteActionLabel}
      </Button>
    </div>
  );
}

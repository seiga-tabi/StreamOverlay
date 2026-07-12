import type { ReactElement } from "react";
import { PageHeader, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../../../shared/ui/PageHeader";
import { StatusPill, type StatusTone } from "../../../shared/ui/Status";

export type ProfileTopIdentitySeasonBadgesRenderer = () => ReactElement | null;

export type ProfileTopIdentityViewModel = {
  gameName: string;
  tagLine: string;
  displayName?: string;
  displayTagLabel?: string;
  profileMetaLabel?: string;
  profileIconUrl?: string;
  avatarFallbackLabel: string;
  fetchedAtText: string;
  primaryRankLabel: string;
  primaryRankClassName?: string;
  primaryRankTone: StatusTone;
};

export type ProfileTopIdentityProps = {
  identity: ProfileTopIdentityViewModel;
  renderActions: () => ReactElement | null;
  renderSeasonBadges: ProfileTopIdentitySeasonBadgesRenderer;
};

export function ProfileTopIdentity({
  identity,
  renderActions,
  renderSeasonBadges,
}: ProfileTopIdentityProps) {
  const titleName = identity.displayName ?? identity.gameName;
  const titleTag = identity.displayTagLabel ?? `#${identity.tagLine}`;
  const seasonBadges = renderSeasonBadges();

  return (
    <div className="public-profile-top-content">
      <div className="public-avatar square">
        {identity.profileIconUrl ? <img src={identity.profileIconUrl} alt="" /> : <span>{identity.avatarFallbackLabel}</span>}
      </div>
      <div className="public-profile-top-copy">
        <PageHeader className="public-profile-shared-page-header" layout="compact">
          <PageHeaderEyebrow>
            <StatusPill
              className={["public-profile-primary-rank", identity.primaryRankClassName].filter(Boolean).join(" ")}
              size="sm"
              tone={identity.primaryRankTone}
            >
              {identity.primaryRankLabel}
            </StatusPill>
          </PageHeaderEyebrow>
          <PageHeaderTitle as="h1" className="public-profile-title-row">
            <span className="public-riot-name">{titleName}</span>
            <span className="public-riot-tag">{titleTag}</span>
          </PageHeaderTitle>
          {identity.profileMetaLabel ? (
            <PageHeaderDescription>
              <span className="public-profile-meta-riot-id">{identity.profileMetaLabel}</span>
            </PageHeaderDescription>
          ) : null}
          {seasonBadges ? <PageHeaderStatus>{seasonBadges}</PageHeaderStatus> : null}
        </PageHeader>
        {renderActions()}
      </div>
    </div>
  );
}

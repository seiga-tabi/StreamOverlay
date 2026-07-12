import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Card } from "../../../shared/ui/Card";
import { type StatusTone } from "../../../shared/ui/Status";
import { ProfileTopActions, type ProfileTopActionLink } from "./ProfileTopActions";
import { ProfileTopIdentity, type ProfileTopIdentitySeasonBadgesRenderer } from "./ProfileTopIdentity";
import { ProfileTopSearchToolbar, type ProfileTopSearchToolbarSearchRenderer } from "./ProfileTopSearchToolbar";

export type ProfileTopPanelLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type ProfileTopPanelText = {
  ranking: string;
  cachedRanking: ProfileTopPanelLocalizedText;
  liveDataNotice: ProfileTopPanelLocalizedText;
  profileLinksLabel?: ProfileTopPanelLocalizedText;
  serverLabel: string;
  searching: string;
};

export type ProfileTopPanelProps = {
  gameName: string;
  tagLine: string;
  displayName?: string;
  displayTagLabel?: string;
  profileMetaLabel?: string;
  profileIconUrl?: string;
  masteryChampionArt?: string;
  fetchedAtText: string;
  primaryRankLabel: string;
  primaryRankClassName?: string;
  primaryRankTone: StatusTone;
  seasonBadges: ReactNode;
  profileLinks: ReactNode;
  loading: boolean;
  refreshDisabled: boolean;
  refreshCoolingDown: boolean;
  refreshCooldownLabel: string;
  refreshTitle: string;
  refreshButtonLabel: string;
  favoriteActive: boolean;
  favoriteAriaLabel: string;
  favoriteActionLabel: string;
  metricStrip: ReactNode;
  searchForm: ReactNode;
  text: ProfileTopPanelText;
  onRefresh: () => void;
  onToggleFavorite: () => void;
};

type ProfileTopPanelLinkSource = {
  id?: unknown;
  url?: unknown;
  label?: unknown;
  platform?: unknown;
};

function profileTopActionLinksFromNode(profileLinks: ReactNode): ProfileTopActionLink[] {
  if (!isValidElement<{ links?: unknown }>(profileLinks)) return [];
  if (!Array.isArray(profileLinks.props.links)) return [];

  return profileLinks.props.links.flatMap((link): ProfileTopActionLink[] => {
    if (!link || typeof link !== "object") return [];
    const candidate = link as ProfileTopPanelLinkSource;
    if (typeof candidate.url !== "string" || !candidate.url) return [];
    return [{
      id: typeof candidate.id === "string" ? candidate.id : undefined,
      label: typeof candidate.label === "string" ? candidate.label : "Link",
      platform: typeof candidate.platform === "string" ? candidate.platform : undefined,
      url: candidate.url,
    }];
  });
}

function profileTopSeasonBadgesRendererFromNode(seasonBadges: ReactNode): ProfileTopIdentitySeasonBadgesRenderer {
  if (!isValidElement(seasonBadges)) return () => null;
  const seasonBadgesElement = seasonBadges as ReactElement;
  return () => seasonBadgesElement;
}

function profileTopSearchRendererFromNode(searchForm: ReactNode): ProfileTopSearchToolbarSearchRenderer {
  if (!isValidElement(searchForm)) return () => null;
  const searchFormElement = searchForm as ReactElement;
  return () => searchFormElement;
}

function defaultProfileLinksLabel(): string {
  const lang = typeof document === "undefined" ? "" : document.documentElement.lang || navigator.language || "";
  return lang.toLocaleLowerCase().startsWith("ja") ? "プロフィールリンク" : "프로필 링크";
}

export function ProfileTopPanel({
  favoriteActionLabel,
  favoriteActive,
  favoriteAriaLabel,
  fetchedAtText,
  gameName,
  displayName,
  displayTagLabel,
  loading,
  masteryChampionArt,
  metricStrip,
  onRefresh,
  onToggleFavorite,
  primaryRankLabel,
  primaryRankClassName,
  primaryRankTone,
  profileMetaLabel,
  profileIconUrl,
  profileLinks,
  refreshButtonLabel,
  refreshCooldownLabel,
  refreshCoolingDown,
  refreshDisabled,
  refreshTitle,
  searchForm,
  seasonBadges,
  tagLine,
  text,
}: ProfileTopPanelProps) {
  const actionProfileLinks = profileTopActionLinksFromNode(profileLinks);
  const renderSeasonBadges = profileTopSeasonBadgesRendererFromNode(seasonBadges);
  const renderSearchForm = profileTopSearchRendererFromNode(searchForm);
  const renderActions = () => (
    <ProfileTopActions
      actions={{
        favoriteActionLabel,
        favoriteActive,
        favoriteAriaLabel,
        fetchedAtText,
        loading,
        profileLinks: actionProfileLinks,
        profileLinksLabel: text.profileLinksLabel?.label ?? defaultProfileLinksLabel(),
        refreshButtonLabel,
        refreshCooldownLabel,
        refreshCoolingDown,
        refreshDisabled,
        refreshLoadingLabel: text.searching,
        refreshTitle,
      }}
      onRefresh={onRefresh}
      onToggleFavorite={onToggleFavorite}
    />
  );

  return (
    <Card as="section" id="public-ranking" className={`public-profile-top-grid public-profile-shared-top ${masteryChampionArt ? "has-mastery-art" : ""}`} padding="none" variant="glass">
      {masteryChampionArt ? <img className="public-profile-mastery-art" src={masteryChampionArt} alt="" aria-hidden="true" /> : null}
      <div className="public-profile-top-main">
        <ProfileTopIdentity
          identity={{
            avatarFallbackLabel: gameName.slice(0, 1).toUpperCase(),
            displayName,
            displayTagLabel,
            fetchedAtText,
            gameName,
            primaryRankClassName,
            primaryRankLabel,
            primaryRankTone,
            profileMetaLabel,
            profileIconUrl,
            tagLine,
          }}
          renderActions={renderActions}
          renderSeasonBadges={renderSeasonBadges}
        />
        <ProfileTopSearchToolbar
          toolbar={{
            ariaLabel: text.ranking,
            cachedRanking: text.cachedRanking,
            liveDataNotice: text.liveDataNotice,
            renderSearchForm,
            serverLabel: text.serverLabel,
          }}
        />
      </div>
      {metricStrip}
    </Card>
  );
}

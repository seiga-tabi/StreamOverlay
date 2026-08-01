import { isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
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
  showDetails: ProfileTopPanelLocalizedText;
  hideDetails: ProfileTopPanelLocalizedText;
  recentMatches: ProfileTopPanelLocalizedText;
};

export type ProfileTopStreamerSpotlight = {
  isLive: boolean;
  eyebrow: string;
  displayName: string;
  statusLabel: string;
  title?: string;
  viewerLabel?: string;
  channelUrl?: string;
  channelActionLabel: string;
  participationActionLabel: string;
  metrics?: Array<{
    id: string;
    label: string;
    value: string;
    tone?: "live" | "accent" | "neutral";
  }>;
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
  streamerSpotlight?: ProfileTopStreamerSpotlight;
  text: ProfileTopPanelText;
  onRefresh: () => void;
  onOpenParticipation?: () => void;
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
  onOpenParticipation,
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
  streamerSpotlight,
  tagLine,
  text,
}: ProfileTopPanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    <Card as="section" id="public-ranking" className={`public-profile-top-grid public-profile-shared-top ${detailsOpen ? "details-open" : "details-collapsed"} ${masteryChampionArt ? "has-mastery-art" : ""}`} padding="none" variant="glass">
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
        {streamerSpotlight ? (
          <aside className={`public-profile-streamer-spotlight ${streamerSpotlight.isLive ? "is-live" : "is-offline"}`}>
            <div className="public-profile-streamer-spotlight__status">
              <span className="public-profile-streamer-spotlight__eyebrow">
                <i aria-hidden="true" />
                {streamerSpotlight.eyebrow}
              </span>
              <strong>{streamerSpotlight.displayName}</strong>
              <span>{streamerSpotlight.statusLabel}</span>
            </div>
            <div className="public-profile-streamer-spotlight__copy">
              {streamerSpotlight.title ? <strong>{streamerSpotlight.title}</strong> : null}
              {streamerSpotlight.viewerLabel ? <span>{streamerSpotlight.viewerLabel}</span> : null}
            </div>
            {streamerSpotlight.metrics?.length ? (
              <dl className="public-profile-streamer-spotlight__metrics">
                {streamerSpotlight.metrics.map((metric) => (
                  <div className={metric.tone ? `is-${metric.tone}` : undefined} key={metric.id}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="public-profile-streamer-spotlight__actions">
              {streamerSpotlight.channelUrl ? (
                <a href={streamerSpotlight.channelUrl} target="_blank" rel="noreferrer">
                  {streamerSpotlight.channelActionLabel}
                </a>
              ) : null}
              {onOpenParticipation ? (
                <button type="button" onClick={onOpenParticipation}>
                  {streamerSpotlight.participationActionLabel}
                </button>
              ) : null}
            </div>
          </aside>
        ) : null}
        <div className="public-profile-summary-controls">
          <Button type="button" size="sm" variant="tertiary" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
            <span  >
              {detailsOpen ? text.hideDetails.label : text.showDetails.label}
            </span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => document.getElementById("public-recent-matches")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            <span  >{text.recentMatches.label}</span>
          </Button>
        </div>
      </div>
      {detailsOpen ? metricStrip : null}
    </Card>
  );
}

import { isValidElement, type ReactElement, type ReactNode } from "react";
import { ProfileTopActions, type ProfileTopActionLink } from "./ProfileTopActions";
import { ProfileTopIdentity, type ProfileTopIdentityChampion, type ProfileTopIdentitySeasonBadgesRenderer } from "./ProfileTopIdentity";

export type ProfileTopPanelLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type ProfileTopPanelText = {
  profileLinksLabel?: ProfileTopPanelLocalizedText;
  searching: string;
  recentMatches: ProfileTopPanelLocalizedText;
  topChampionsLabel?: string;
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
  supportingLinks?: ProfileTopActionLink[];
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
  summonerLevelLabel?: string;
  summonerLevelAriaLabel?: string;
  mainRoleLabel?: string;
  topChampions?: ProfileTopIdentityChampion[];
  fetchedAtText: string;
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
  streamerSpotlight?: ProfileTopStreamerSpotlight;
  shareAction?: ReactNode;
  /** 큐 세그먼트 + 티어 상세. 랭크 정보를 히어로가 단독으로 소유합니다. */
  rankSection?: ReactNode;
  /** 등록 스트리머의 방송 카드. 랭크와 같은 행에 놓여 히어로 높이를 늘리지 않습니다. */
  streamerCast?: ReactNode;
  channelName?: string;
  channelUrl?: string;
  channelAriaLabel?: string;
  liveStatus?: { isLive: boolean; label: string };
  /** 히어로 하단에 붙는 프로필 탭. */
  tabs?: ReactNode;
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
  mainRoleLabel,
  masteryChampionArt,
  onRefresh,
  onOpenParticipation,
  onToggleFavorite,
  profileMetaLabel,
  profileIconUrl,
  profileLinks,
  rankSection,
  refreshButtonLabel,
  refreshCooldownLabel,
  refreshCoolingDown,
  refreshDisabled,
  refreshTitle,
  channelAriaLabel,
  channelName,
  channelUrl,
  liveStatus,
  seasonBadges,
  shareAction,
  streamerCast,
  streamerSpotlight,
  summonerLevelAriaLabel,
  summonerLevelLabel,
  tabs,
  tagLine,
  text,
  topChampions,
}: ProfileTopPanelProps) {
  const actionProfileLinks = profileTopActionLinksFromNode(profileLinks);
  const renderSeasonBadges = profileTopSeasonBadgesRendererFromNode(seasonBadges);
  const renderActions = () => (
    <ProfileTopActions
      actions={{
        favoriteActionLabel,
        favoriteActive,
        favoriteAriaLabel,
        fetchedAtText,
        liveStatus,
        loading,
        profileLinks: streamerSpotlight ? [] : actionProfileLinks,
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
      shareAction={shareAction}
    />
  );

  return (
    <section
      className={[
        "public-profile-hero",
        masteryChampionArt ? "has-mastery-art" : "",
        streamerSpotlight ? "has-streamer" : "",
        streamerSpotlight?.isLive ? "is-live" : "",
      ].filter(Boolean).join(" ")}
      id="public-ranking"
    >
      {/* 챔피언 일러스트는 정보 뒤로 물러나고 오른쪽 끝에서만 드러납니다. */}
      {masteryChampionArt ? (
        <img aria-hidden="true" alt="" className="public-profile-hero-art" src={masteryChampionArt} />
      ) : null}

      <ProfileTopIdentity
        identity={{
          avatarFallbackLabel: gameName.slice(0, 1).toUpperCase(),
          channelAriaLabel,
          channelName,
          channelUrl,
          displayName,
          displayTagLabel,
          gameName,
          mainRoleLabel,
          profileIconUrl,
          profileMetaLabel,
          streamerStatus: streamerSpotlight ? (streamerSpotlight.isLive ? "live" : "offline") : undefined,
          streamerStatusLabel: streamerSpotlight?.statusLabel,
          summonerLevelAriaLabel,
          summonerLevelLabel,
          tagLine,
          topChampions,
          topChampionsLabel: text.topChampionsLabel,
        }}
        renderActions={renderActions}
        renderSeasonBadges={renderSeasonBadges}
      />

      {rankSection || streamerCast ? (
        <>
          <span aria-hidden="true" className="public-profile-hero-rule" />
          {/* 방송 카드는 랭크와 같은 행에 놓입니다. 행을 늘리지 않아야 히어로가 커지지 않습니다. */}
          <div className={`public-profile-hero-body${streamerCast ? " has-cast" : ""}`}>
            {rankSection}
            {streamerCast}
          </div>
        </>
      ) : null}

      {tabs}
    </section>
  );
}

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
  /* 이름 줄 서버 칩(목업 프로필 헤드) — 예: "KR". */
  serverChipLabel?: string;
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
  /** 랭크 탭 옆(일반) 또는 아래(스트리머)에 붙는 퍼포먼스 지표 패널.
      랭크 카드 3개가 탭 1개로 줄면서 생긴 자리를 씁니다(목업 §4·§5). */
  performanceSection?: ReactNode;
  /** 랭크 격자 아래 전폭으로 붙는 최근 20경기 요약 바(목업 §B). */
  summaryBar?: ReactNode;
  /** 등록 스트리머의 방송 카드 — 목업 격자(1.25fr 1.05fr .85fr)의 첫 칸입니다. */
  streamerCast?: ReactNode;
  channelName?: string;
  channelUrl?: string;
  channelAriaLabel?: string;
  liveStatus?: { isLive: boolean; label: string };
  /** 이름 아래 최근 폼 줄(목업 스트리머 변형) — 최신 경기부터 W/L 순서. */
  recentFormResults?: ReadonlyArray<"win" | "loss">;
  recentFormLabel?: string;
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
  serverChipLabel,
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
  performanceSection,
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
  recentFormLabel,
  recentFormResults,
  seasonBadges,
  shareAction,
  summaryBar,
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
        /* 갱신 중(이미 본 프로필) — 화면을 비우지 않고 엠블럼·랭크 카드는 그대로,
           새로 오는 값(요약 바)만 흐립니다(목업 "갱신 중 — 이미 본 프로필"). */
        loading ? "is-refreshing" : "",
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
          serverChipLabel,
          fetchedAtText,
          recentFormLabel,
          recentFormResults,
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
          {/* 목업 상단 격자: 스트리머면 [방송 1.3fr | (랭크 탭 · 숙련도) / 퍼포먼스 2fr],
             아니면 [랭크 탭 1fr | 퍼포먼스 1.5fr]. 요약 바는 격자 밖 전폭. */}
          <div className="public-profile-hero-body">
            <div className={`public-profile-hero-top${streamerCast ? " has-cast" : ""}${performanceSection ? " has-performance" : ""}`}>
              {streamerCast}
              {rankSection}
              {performanceSection}
            </div>
            {summaryBar}
          </div>
        </>
      ) : null}

      {tabs}
    </section>
  );
}

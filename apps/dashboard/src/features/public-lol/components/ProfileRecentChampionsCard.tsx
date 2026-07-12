import type { ReactNode } from "react";
import { Card, CardHeader } from "../../../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { StatusPill, type StatusTone } from "../../../shared/ui/Status";
import { ProfileRecentChampionRow, type ProfileRecentChampionRowViewModel } from "./ProfileRecentChampionRow";

export type ProfileRecentChampionsCardLocalizedText = {
  label: ReactNode;
  ko: string;
  ja: string;
};

export type ProfileRecentChampionItem = ProfileRecentChampionRowViewModel & {
  key: string | number;
};

export type ProfileRecentChampionsCardText = {
  title: ProfileRecentChampionsCardLocalizedText;
  period: ReactNode;
  emptyTitle: ProfileRecentChampionsCardLocalizedText;
  emptyDescription: ProfileRecentChampionsCardLocalizedText;
};

export type ProfileRecentChampionsStreamStatus = {
  label: ReactNode;
  ko: string;
  ja: string;
  tone: StatusTone;
  title?: string;
};

export type ProfileRecentChampionsStreamInfo = {
  isLive: boolean;
  displayName: string;
  login?: string;
  avatarUrl?: string;
  avatarFallback: string;
  title?: string;
  gameName?: string;
  viewerLabel?: string;
  status: ProfileRecentChampionsStreamStatus;
};

export type ProfileRecentChampionsCardProps = {
  champions: ProfileRecentChampionItem[];
  streamInfo?: ProfileRecentChampionsStreamInfo;
  streamStatus?: ProfileRecentChampionsStreamStatus;
  text: ProfileRecentChampionsCardText;
};

export function ProfileRecentChampionsCard({
  champions,
  streamInfo,
  streamStatus,
  text,
}: ProfileRecentChampionsCardProps) {
  return (
    <Card as="article" className={`public-profile-metric-card blue public-recent-champions-card public-profile-shared-card${streamInfo ? " is-streamer" : ""}`} padding="md" variant="elevated">
      <CardHeader className="public-profile-metric-head">
        <span className="public-profile-metric-icon" aria-hidden="true">◇</span>
        <span className="public-profile-metric-label">
          <span data-ko={text.title.ko} data-ja={text.title.ja}>{text.title.label}</span>
          {streamStatus ? (
            <StatusPill className="public-profile-stream-status" data-ko={streamStatus.ko} data-ja={streamStatus.ja} size="sm" title={streamStatus.title} tone={streamStatus.tone}>
              {streamStatus.label}
            </StatusPill>
          ) : (
            <small>{text.period}</small>
          )}
        </span>
      </CardHeader>
      {streamInfo ? (
        <div className={`public-profile-stream-summary ${streamInfo.isLive ? "is-live" : "is-offline"}`}>
          <span className="public-profile-stream-summary-avatar" aria-hidden="true">
            {streamInfo.avatarUrl ? (
              <img src={streamInfo.avatarUrl} alt="" />
            ) : (
              <span>{streamInfo.avatarFallback}</span>
            )}
          </span>
          <span className="public-profile-stream-summary-body">
            <strong>{streamInfo.displayName}</strong>
            {streamInfo.login ? <small>@{streamInfo.login}</small> : null}
            <span className="public-profile-stream-summary-meta">
              <StatusPill className="public-profile-stream-summary-status" data-ko={streamInfo.status.ko} data-ja={streamInfo.status.ja} size="md" title={streamInfo.status.title} tone={streamInfo.status.tone}>
                {streamInfo.status.label}
              </StatusPill>
              {streamInfo.viewerLabel ? <em>{streamInfo.viewerLabel}</em> : null}
            </span>
            {streamInfo.title ? <span className="public-profile-stream-summary-title">{streamInfo.title}</span> : null}
            {streamInfo.gameName ? <span className="public-profile-stream-summary-game">{streamInfo.gameName}</span> : null}
          </span>
        </div>
      ) : champions.length > 0 ? (
        <div className="public-recent-champion-list">
          {champions.map((item) => (
            <ProfileRecentChampionRow champion={item} key={item.key} />
          ))}
        </div>
      ) : (
        <EmptyState className="public-profile-shared-empty-inline" variant="search">
          <EmptyStateIcon>?</EmptyStateIcon>
          <EmptyStateTitle as="h3" data-ko={text.emptyTitle.ko} data-ja={text.emptyTitle.ja}>{text.emptyTitle.label}</EmptyStateTitle>
          <EmptyStateDescription data-ko={text.emptyDescription.ko} data-ja={text.emptyDescription.ja}>
            {text.emptyDescription.label}
          </EmptyStateDescription>
        </EmptyState>
      )}
    </Card>
  );
}

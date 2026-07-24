import type {
  PublicTwitchFollowedLolChannel,
  PublicTwitchViewerStatus,
} from "../../public-lol/types/public-lol";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/Card";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { SkeletonAvatar, SkeletonCard, SkeletonText } from "../../../shared/ui/Skeleton";
import { Badge, StatusPill } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { sortedFollowedTwitchChannels, twitchChannelUrl } from "../utils/streamers";

export function PalworldStreamersPage({
  channels,
  error,
  loading,
  locale,
  onLogin,
  onRefresh,
  status,
  total,
}: {
  channels: readonly PublicTwitchFollowedLolChannel[];
  error: boolean;
  loading: boolean;
  locale: PalworldLocale;
  onLogin: () => void;
  onRefresh: () => void;
  status: PublicTwitchViewerStatus;
  total?: number;
}) {
  const text = palworldI18n[locale];
  const visibleChannels = sortedFollowedTwitchChannels(channels);
  const liveCount = visibleChannels.filter((channel) => channel.isLive).length;
  const followedCount = typeof total === "number" && Number.isInteger(total) && total >= 0
    ? total
    : visibleChannels.length;
  const numberFormat = new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "ko-KR");

  return (
    <section className="palworld-page-section palworld-streamers-page" aria-labelledby="palworld-streamers-title">
      <header className="palworld-page-heading palworld-streamers-heading">
        <div>
          <span data-ko={palworldI18n.ko.streamersKicker} data-ja={palworldI18n.ja.streamersKicker}>{text.streamersKicker}</span>
          <h1 id="palworld-streamers-title" data-ko={palworldI18n.ko.streamersTitle} data-ja={palworldI18n.ja.streamersTitle}>{text.streamersTitle}</h1>
          <p data-ko={palworldI18n.ko.streamersDescription} data-ja={palworldI18n.ja.streamersDescription}>{text.streamersDescription}</p>
        </div>
        <div className="palworld-streamers-heading-actions">
          {status.connected ? (
            <StatusPill size="sm" tone="success" data-ko={`${palworldI18n.ko.connectedAs}: ${status.user?.displayName ?? status.user?.login ?? "Twitch"}`} data-ja={`${palworldI18n.ja.connectedAs}: ${status.user?.displayName ?? status.user?.login ?? "Twitch"}`}>
              {text.connectedAs}: {status.user?.displayName ?? status.user?.login ?? "Twitch"}
            </StatusPill>
          ) : null}
          <Badge size="sm" tone="info" data-ko={palworldI18n.ko.followedChannels} data-ja={palworldI18n.ja.followedChannels}>
            {text.followedChannels} {numberFormat.format(followedCount)}
          </Badge>
          <Button size="sm" variant="secondary" disabled={loading || !status.connected} loading={loading} loadingLabel={text.loadingStreamers} onClick={onRefresh} data-ko={palworldI18n.ko.refresh} data-ja={palworldI18n.ja.refresh}>
            {text.refresh}
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="palworld-streamer-grid" aria-busy="true" aria-label={text.loadingStreamers} role="status">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonCard key={index} loadingLabel={text.loadingStreamers} size="md">
              <SkeletonAvatar size="md" />
              <SkeletonText lines={4} size="sm" />
            </SkeletonCard>
          ))}
        </div>
      ) : error ? (
        <EmptyState role="alert" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle data-ko={palworldI18n.ko.twitchErrorTitle} data-ja={palworldI18n.ja.twitchErrorTitle}>{text.twitchErrorTitle}</EmptyStateTitle>
          <EmptyStateDescription data-ko={palworldI18n.ko.twitchErrorDescription} data-ja={palworldI18n.ja.twitchErrorDescription}>{text.twitchErrorDescription}</EmptyStateDescription>
          <EmptyStateActions><Button variant="secondary" onClick={onRefresh} data-ko={palworldI18n.ko.retryTwitch} data-ja={palworldI18n.ja.retryTwitch}>{text.retryTwitch}</Button></EmptyStateActions>
        </EmptyState>
      ) : !status.configured ? (
        <EmptyState variant="streamer">
          <EmptyStateIcon>T</EmptyStateIcon>
          <EmptyStateTitle data-ko={palworldI18n.ko.twitchNotConfiguredTitle} data-ja={palworldI18n.ja.twitchNotConfiguredTitle}>{text.twitchNotConfiguredTitle}</EmptyStateTitle>
          <EmptyStateDescription data-ko={palworldI18n.ko.twitchNotConfiguredDescription} data-ja={palworldI18n.ja.twitchNotConfiguredDescription}>{text.twitchNotConfiguredDescription}</EmptyStateDescription>
        </EmptyState>
      ) : !status.connected ? (
        <EmptyState variant="streamer">
          <EmptyStateIcon>T</EmptyStateIcon>
          <EmptyStateTitle data-ko={palworldI18n.ko.twitchLoginTitle} data-ja={palworldI18n.ja.twitchLoginTitle}>{text.twitchLoginTitle}</EmptyStateTitle>
          <EmptyStateDescription data-ko={palworldI18n.ko.twitchLoginDescription} data-ja={palworldI18n.ja.twitchLoginDescription}>{text.twitchLoginDescription}</EmptyStateDescription>
          <EmptyStateActions><Button onClick={onLogin} data-ko={palworldI18n.ko.twitchLogin} data-ja={palworldI18n.ja.twitchLogin}>{text.twitchLogin}</Button></EmptyStateActions>
        </EmptyState>
      ) : visibleChannels.length === 0 ? (
        <EmptyState variant="streamer">
          <EmptyStateIcon>?</EmptyStateIcon>
          <EmptyStateTitle data-ko={palworldI18n.ko.noFollowedChannels} data-ja={palworldI18n.ja.noFollowedChannels}>{text.noFollowedChannels}</EmptyStateTitle>
          <EmptyStateDescription data-ko={palworldI18n.ko.noFollowedChannelsDescription} data-ja={palworldI18n.ja.noFollowedChannelsDescription}>{text.noFollowedChannelsDescription}</EmptyStateDescription>
        </EmptyState>
      ) : (
        <>
          {liveCount === 0 ? (
            <p className="palworld-streamers-live-empty" role="status" data-ko={palworldI18n.ko.noLiveStreamers} data-ja={palworldI18n.ja.noLiveStreamers}>{text.noLiveStreamers}</p>
          ) : null}
          <div className="palworld-streamer-grid" data-testid="palworld-streamer-list">
            {visibleChannels.map((channel) => {
              const channelUrl = twitchChannelUrl(channel);
              return (
                <Card as="article" className="palworld-streamer-card" key={channel.twitchUserId} padding="md">
                  <CardHeader>
                    <div className="palworld-streamer-identity">
                      <span className="palworld-streamer-avatar">
                        {channel.profileImageUrl ? <img src={channel.profileImageUrl} alt="" /> : <span aria-hidden="true">{channel.twitchDisplayName.slice(0, 1).toUpperCase() || "T"}</span>}
                      </span>
                      <div>
                        <CardTitle as="h2" title={channel.twitchDisplayName}>{channel.twitchDisplayName}</CardTitle>
                        <small title={`@${channel.twitchLogin}`}>@{channel.twitchLogin}</small>
                      </div>
                    </div>
                    <StatusPill size="sm" tone={channel.isLive ? "live" : "neutral"} data-ko={channel.isLive ? palworldI18n.ko.live : palworldI18n.ko.offline} data-ja={channel.isLive ? palworldI18n.ja.live : palworldI18n.ja.offline}>
                      {channel.isLive ? text.live : text.offline}
                    </StatusPill>
                  </CardHeader>
                  <CardContent>
                    {channel.gameName ? <p><strong data-ko={palworldI18n.ko.currentGame} data-ja={palworldI18n.ja.currentGame}>{text.currentGame}</strong><span title={channel.gameName}>{channel.gameName}</span></p> : null}
                    {channel.title ? <p><strong data-ko={palworldI18n.ko.streamTitle} data-ja={palworldI18n.ja.streamTitle}>{text.streamTitle}</strong><span title={channel.title}>{channel.title}</span></p> : null}
                    {channel.viewerCount !== undefined ? <p><strong data-ko={palworldI18n.ko.viewers} data-ja={palworldI18n.ja.viewers}>{text.viewers}</strong><span>{numberFormat.format(channel.viewerCount)}</span></p> : null}
                    {channelUrl ? <Button as="a" href={channelUrl} target="_blank" rel="noopener noreferrer" size="sm" fullWidth data-ko={palworldI18n.ko.watchStream} data-ja={palworldI18n.ja.watchStream}>{text.watchStream}</Button> : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

import { Button } from "./ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "./ui/EmptyState";
import { Skeleton, SkeletonButton, SkeletonCard, SkeletonText } from "./ui/Skeleton";
import { StatusPill } from "./ui/Status";

export type PublicLiveRailText = {
  label: string;
  ko: string;
  ja: string;
};

export type PublicLiveStreamerCard = {
  id: string;
  name: string;
  nameJa?: string;
  login?: string;
  primaryMeta?: string;
  primaryMetaJa?: string;
  secondaryMeta?: string;
  secondaryMetaJa?: string;
  server?: string;
  avatarLabel: string;
  avatarUrl?: string;
  channelUrl?: string;
  statusLabel: string;
  statusKo?: string;
  statusJa?: string;
};

export type PublicLiveStreamerRailState = "ready" | "login-required" | "not-configured" | "error";

export function PublicLiveStreamerRail({
  emptyDescription,
  emptyTitle,
  errorDescription,
  loading,
  loadingLabel,
  loginAction,
  loginDescription,
  loginTitle,
  notConfiguredDescription,
  notConfiguredTitle,
  onLogin,
  onRetry,
  onViewAll,
  retryAction,
  state = "ready",
  streamers,
  title,
  viewAll,
  watch,
}: {
  emptyDescription: PublicLiveRailText;
  emptyTitle: PublicLiveRailText;
  errorDescription?: PublicLiveRailText;
  loading: boolean;
  loadingLabel: PublicLiveRailText;
  loginAction?: PublicLiveRailText;
  loginDescription?: PublicLiveRailText;
  loginTitle?: PublicLiveRailText;
  notConfiguredDescription?: PublicLiveRailText;
  notConfiguredTitle?: PublicLiveRailText;
  onLogin?: () => void;
  onRetry?: () => void;
  onViewAll?: () => void;
  retryAction?: PublicLiveRailText;
  state?: PublicLiveStreamerRailState;
  streamers: PublicLiveStreamerCard[];
  title: PublicLiveRailText;
  viewAll: PublicLiveRailText;
  watch: PublicLiveRailText;
}) {
  const showPagination = streamers.length > 5;
  const unavailableTitle = state === "not-configured"
    ? notConfiguredTitle ?? loginTitle ?? emptyTitle
    : loginTitle ?? emptyTitle;
  const unavailableDescription = state === "not-configured"
    ? notConfiguredDescription ?? loginDescription ?? emptyDescription
    : loginDescription ?? emptyDescription;

  return (
    <section className="public-home-live-section" aria-labelledby="public-home-live-title">
      <div className="public-home-live-head">
        <h2 id="public-home-live-title" data-ko={title.ko} data-ja={title.ja}>{title.label}</h2>
        {onViewAll ? (
          <button type="button" onClick={onViewAll} data-ko={viewAll.ko} data-ja={viewAll.ja}>
            {viewAll.label}
            <span aria-hidden="true">›</span>
          </button>
        ) : null}
      </div>
      <div
        className="public-home-live-rail"
        aria-busy={loading || undefined}
        aria-label={title.label}
        data-testid="public-live-streamer-rail"
      >
        {loading ? (
          Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard className="public-home-live-card public-home-live-skeleton" key={index} loadingLabel={loadingLabel.label} size="md">
              <Skeleton rounded size="md" />
              <SkeletonText lines={3} size="sm" />
              <SkeletonButton size="sm" />
            </SkeletonCard>
          ))
        ) : state === "error" ? (
          <EmptyState className="public-home-live-empty" role="alert" variant="error">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle as="h3" data-ko={emptyTitle.ko} data-ja={emptyTitle.ja}>{emptyTitle.label}</EmptyStateTitle>
            {errorDescription ? <EmptyStateDescription data-ko={errorDescription.ko} data-ja={errorDescription.ja}>{errorDescription.label}</EmptyStateDescription> : null}
            {onRetry && retryAction ? <EmptyStateActions><Button size="sm" variant="secondary" onClick={onRetry} data-ko={retryAction.ko} data-ja={retryAction.ja}>{retryAction.label}</Button></EmptyStateActions> : null}
          </EmptyState>
        ) : state === "login-required" || state === "not-configured" ? (
          <EmptyState className="public-home-live-empty" variant="streamer">
            <EmptyStateIcon>T</EmptyStateIcon>
            <EmptyStateTitle as="h3" data-ko={unavailableTitle.ko} data-ja={unavailableTitle.ja}>{unavailableTitle.label}</EmptyStateTitle>
            <EmptyStateDescription data-ko={unavailableDescription.ko} data-ja={unavailableDescription.ja}>{unavailableDescription.label}</EmptyStateDescription>
            {state === "login-required" && onLogin && loginAction ? <EmptyStateActions><Button size="sm" onClick={onLogin} data-ko={loginAction.ko} data-ja={loginAction.ja}>{loginAction.label}</Button></EmptyStateActions> : null}
          </EmptyState>
        ) : streamers.length > 0 ? streamers.map((streamer) => (
          <article className="public-home-live-card" key={streamer.id} tabIndex={0}>
            <StatusPill className="public-home-live-pill" size="sm" tone="live">{streamer.statusLabel}</StatusPill>
            <span className="public-home-live-avatar">
              {streamer.avatarUrl ? <img src={streamer.avatarUrl} alt="" /> : <span aria-hidden="true">{streamer.avatarLabel}</span>}
            </span>
            <strong title={streamer.name}>{streamer.name}</strong>
            {streamer.login ? <small title={`@${streamer.login}`}>@{streamer.login}</small> : null}
            {streamer.primaryMeta ? <small title={streamer.primaryMeta}>{streamer.primaryMeta}</small> : null}
            {streamer.secondaryMeta ? <small title={streamer.secondaryMeta}>{streamer.secondaryMeta}</small> : null}
            {streamer.server ? <em title={streamer.server}>{streamer.server}</em> : null}
            {streamer.channelUrl ? (
              <a className="public-home-live-action" href={streamer.channelUrl} target="_blank" rel="noopener noreferrer" data-ko={watch.ko} data-ja={watch.ja}>
                {watch.label}
              </a>
            ) : onViewAll ? (
              <button className="public-home-live-action" type="button" onClick={onViewAll} data-ko={watch.ko} data-ja={watch.ja}>
                {watch.label}
              </button>
            ) : null}
          </article>
        )) : (
          <EmptyState className="public-home-live-empty" variant="streamer">
            <EmptyStateIcon>?</EmptyStateIcon>
            <EmptyStateTitle as="h3" data-ko={emptyTitle.ko} data-ja={emptyTitle.ja}>{emptyTitle.label}</EmptyStateTitle>
            <EmptyStateDescription data-ko={emptyDescription.ko} data-ja={emptyDescription.ja}>{emptyDescription.label}</EmptyStateDescription>
          </EmptyState>
        )}
      </div>
      {showPagination ? <div className="public-home-live-pagination" aria-hidden="true"><span className="active" /><span /><span /><span /><span /></div> : null}
    </section>
  );
}

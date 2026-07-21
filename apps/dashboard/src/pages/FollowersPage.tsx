import { useEffect, useState } from "react";
import type { FollowerManagementResponse, FollowerOAuthStatus } from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";
import { dashboardLocale, uiText } from "../i18n";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  SkeletonCard,
  SkeletonText,
  StatusPill,
} from "../shared/ui";

type FollowerRecord = FollowerManagementResponse["followers"][number];

const TWITCH_OAUTH_HOST = "id.twitch.tv";
const FOLLOWER_SCOPE = "moderator:read:followers";

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(dashboardLocale === "ja" ? "ja-JP" : "ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function mainGenre(record: FollowerRecord): string {
  const [first] = Object.entries(record.activity.genres).sort((a, b) => b[1] - a[1]);
  return first ? `${localizedGenre(first[0])} ${first[1]}` : "-";
}

function localizedGenre(name: string): string {
  const genres = uiText.followersPage.genres;
  if (name === "채팅 참여") return genres.chat;
  if (name === "League of Legends 시참") return genres.participation;
  return name;
}

function statusClass(status: FollowerRecord["status"]): string {
  return status === "following" ? "good" : "bad";
}

function followerInitial(record: FollowerRecord): string {
  return (record.userName || record.userLogin || record.userId).slice(0, 1).toUpperCase();
}

function followerRiotId(record: FollowerRecord): string | undefined {
  if (!record.riotGameName || !record.riotTagLine) return undefined;
  return `${record.riotGameName}#${record.riotTagLine}`;
}

export function safeFollowerOAuthUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== TWITCH_OAUTH_HOST ||
      url.port !== "" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/oauth2/authorize"
    ) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function FollowerAvatar({ record }: { record: FollowerRecord }) {
  return (
    <span className="follower-avatar" aria-hidden="true">
      {record.profileImageUrl ? <img src={record.profileImageUrl} alt="" loading="lazy" /> : followerInitial(record)}
    </span>
  );
}

function FollowerIdentity({ record }: { record: FollowerRecord }) {
  return (
    <div className="follower-identity">
      <FollowerAvatar record={record} />
      <div className="queue-user">
        <strong>{record.userName}</strong>
        <span>{record.userLogin ? `@${record.userLogin}` : record.userId}</span>
      </div>
    </div>
  );
}

export function FollowerEmptyState({ text }: { text: string }) {
  return (
    <EmptyState as="div" className="followers-inline-empty" variant="default">
      <EmptyStateIcon>0</EmptyStateIcon>
      <EmptyStateTitle as="h3">{text}</EmptyStateTitle>
    </EmptyState>
  );
}

function FollowerMiniList({ items, empty }: { items: FollowerRecord[]; empty: string }) {
  const t = uiText.followersPage;
  if (items.length === 0) return <FollowerEmptyState text={empty} />;
  return (
    <div className="follower-mini-list">
      {items.map((item) => (
        <div className="follower-mini-row" key={`${item.userId}-${item.status}`}>
          <FollowerIdentity record={item} />
          <span className={`queue-status ${statusClass(item.status)}`}>
            {t.statuses[item.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

function oauthStatusLabel(state: FollowerOAuthStatus["state"]): string {
  const t = uiText.followersPage.oauth;
  if (state === "connected") return t.connected;
  if (state === "missing_scopes") return t.missingScopesTitle;
  if (state === "token_expired") return t.tokenExpiredTitle;
  return t.disconnectedTitle;
}

function oauthStatusTone(state: FollowerOAuthStatus["state"]): "success" | "warning" | "danger" {
  if (state === "connected") return "success";
  if (state === "missing_scopes" || state === "token_expired") return "warning";
  return "danger";
}

export function FollowerOAuthNotice({
  connecting,
  oauth,
  onConnect,
}: {
  connecting: boolean;
  oauth: FollowerOAuthStatus;
  onConnect: () => void;
}) {
  const t = uiText.followersPage.oauth;
  if (oauth.state === "connected") return null;

  const title = oauth.state === "missing_scopes"
    ? t.missingScopesTitle
    : oauth.state === "token_expired"
      ? t.tokenExpiredTitle
      : t.disconnectedTitle;
  const description = oauth.state === "missing_scopes"
    ? t.missingScopesDescription
    : oauth.state === "token_expired"
      ? t.tokenExpiredDescription
      : t.disconnectedDescription;
  const action = oauth.state === "missing_scopes"
    ? t.reauthorize
    : oauth.state === "token_expired"
      ? t.reconnect
      : t.connect;
  const missingScopes = oauth.missingScopes.length > 0 ? oauth.missingScopes : [FOLLOWER_SCOPE];

  return (
    <EmptyState
      className="followers-oauth-state"
      data-oauth-state={oauth.state}
      role="status"
      variant={oauth.state === "token_expired" ? "error" : "streamer"}
    >
      <EmptyStateIcon>!</EmptyStateIcon>
      <EmptyStateTitle>{title}</EmptyStateTitle>
      <EmptyStateDescription>{description}</EmptyStateDescription>
      {oauth.state === "missing_scopes" ? (
        <div className="followers-oauth-scopes" aria-label={t.requiredScope}>
          {missingScopes.map((scope) => (
            <Badge key={scope} size="sm" tone="warning">{scope}</Badge>
          ))}
        </div>
      ) : null}
      <EmptyStateActions>
        <Button loading={connecting} loadingLabel={t.connecting} onClick={onConnect}>
          {action}
        </Button>
      </EmptyStateActions>
    </EmptyState>
  );
}

export function FollowersPage() {
  const t = uiText.followersPage;
  const [state, setState] = useState<FollowerManagementResponse>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string }>();

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      setState(await apiGet<FollowerManagementResponse>("/api/followers"));
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (state?.oauth.state !== "connected") return;
    setRefreshing(true);
    setMessage(undefined);
    try {
      setState(await apiPost<FollowerManagementResponse>("/api/followers/refresh?limit=5000", {}));
      setMessage({ tone: "success", text: t.refreshDone });
    } catch {
      setMessage({ tone: "danger", text: t.refreshFailed });
      void load();
    } finally {
      setRefreshing(false);
    }
  }

  async function connectFollowerOAuth() {
    setConnecting(true);
    setMessage(undefined);
    try {
      const result = await apiPost<{ url: string }>("/api/followers/oauth/start", {});
      const destination = safeFollowerOAuthUrl(result.url);
      if (!destination) throw new Error("invalid Twitch OAuth URL");
      window.location.assign(destination);
    } catch {
      setConnecting(false);
      setMessage({ tone: "danger", text: t.oauth.connectFailed });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const metrics = state ? [
    { label: t.metrics.activeFollowers, value: state.summary.activeFollowers },
    { label: t.metrics.knownFollowers, value: state.summary.knownFollowers },
    { label: t.metrics.unfollowed, value: state.summary.unfollowed },
    { label: t.metrics.newFollowers7d, value: state.summary.newFollowers7d },
    { label: t.metrics.observedGenreFollowers, value: state.summary.observedGenreFollowers }
  ] : [];
  const oauthConnected = state?.oauth.state === "connected";

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
        <div className="button-row">
          {state ? (
            <StatusPill size="sm" tone={oauthStatusTone(state.oauth.state)}>
              {oauthStatusLabel(state.oauth.state)}
            </StatusPill>
          ) : null}
          <Button
            disabled={!oauthConnected || loading || connecting}
            loading={refreshing}
            loadingLabel={t.refreshing}
            onClick={() => void refresh()}
          >
            {t.refresh}
          </Button>
        </div>
      </header>

      {loading && !state ? (
        <SkeletonCard className="followers-loading" loadingLabel={t.loading} size="lg">
          <SkeletonText lines={5} size="lg" />
        </SkeletonCard>
      ) : null}

      {!loading && loadFailed && !state ? (
        <EmptyState className="followers-load-error" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle>{t.loadFailed}</EmptyStateTitle>
          <EmptyStateDescription>{t.description}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={() => void load()}>{t.retry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {state ? (
        <>
          <FollowerOAuthNotice
            connecting={connecting}
            oauth={state.oauth}
            onConnect={() => void connectFollowerOAuth()}
          />

          <Card as="aside" className="scope-warning" padding="md" variant="warning">
            <CardDescription>{t.scopeHint}</CardDescription>
            <CardDescription className="hint">{t.dataLimit}</CardDescription>
          </Card>

          {message ? (
            <StatusPill className="form-message" role={message.tone === "danger" ? "alert" : "status"} tone={message.tone}>
              {message.text}
            </StatusPill>
          ) : null}

          <section className="participation-summary">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </section>

          <section className="grid two">
            <div className="card">
              <div className="card-title-row">
                <h2>{t.sections.recentFollowers}</h2>
                <span className="count-badge">{state.recentFollowers.length}</span>
              </div>
              <FollowerMiniList items={state.recentFollowers} empty={t.empty.followers} />
            </div>

            <div className="card">
              <div className="card-title-row">
                <h2>{t.sections.recentUnfollowers}</h2>
                <span className="count-badge">{state.recentUnfollowers.length}</span>
              </div>
              <FollowerMiniList items={state.recentUnfollowers} empty={t.empty.unfollowers} />
            </div>
          </section>

          <section className="grid two">
            <div className="card">
              <div className="card-title-row">
                <h2>{t.sections.topGenres}</h2>
                <span className="count-badge">{state.topObservedGenres.length}</span>
              </div>
              {state.topObservedGenres.length === 0 ? (
                <FollowerEmptyState text={t.empty.genres} />
              ) : (
                <div className="genre-bar-list">
                  {state.topObservedGenres.map((genre) => (
                    <div className="genre-bar-row" key={genre.name}>
                      <span>{localizedGenre(genre.name)}</span>
                      <strong>{genre.count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2>{t.sections.notes}</h2>
              <div className="ops-note">
                <span>{t.snapshot}: {formatDate(state.lastSnapshotAt)}</span>
                <span>{t.total}: {state.lastSnapshotTotal ?? "-"}</span>
                <span>
                  {t.truncated}: {state.lastSnapshotTruncated === undefined
                    ? "-"
                    : state.lastSnapshotTruncated ? t.yes : t.no}
                </span>
                <ul>
                  {t.dataNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-title-row">
              <h2>{t.sections.allFollowers}</h2>
              <span className="count-badge">{state.followers.length}</span>
            </div>
            {state.followers.length === 0 ? (
              <FollowerEmptyState text={t.empty.followers} />
            ) : (
              <div className="follower-table">
                <div className="follower-row follower-head">
                  <span>{t.columns.user}</span>
                  <span>{t.columns.riotId}</span>
                  <span>{t.columns.status}</span>
                  <span>{t.columns.followedAt}</span>
                  <span>{t.columns.activity}</span>
                  <span>{t.columns.genre}</span>
                </div>
                {state.followers.map((follower) => (
                  <div className="follower-row" key={follower.userId}>
                    <FollowerIdentity record={follower} />
                    <span className="follower-riot-id">{followerRiotId(follower) ?? t.riotIdMissing}</span>
                    <span className={`queue-status ${statusClass(follower.status)}`}>{t.statuses[follower.status]}</span>
                    <span>{formatDate(follower.followedAt ?? follower.firstSeenAt)}</span>
                    <span>{follower.activity.total}</span>
                    <span>{mainGenre(follower)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

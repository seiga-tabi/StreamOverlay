import { useEffect, useState } from "react";
import type { FollowerManagementResponse, FollowerOAuthStatus } from "@streamops/shared";
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

export type FollowersDataSource = {
  load: () => Promise<FollowerManagementResponse>;
  refresh: () => Promise<FollowerManagementResponse>;
  startOAuth: () => Promise<{ url: string }>;
};

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

export const FOLLOWER_DIRECTORY_PAGE_SIZE = 20;

type FollowerDirectoryStatusFilter = "all" | FollowerRecord["status"];
type FollowerDirectorySortKey = "followedAt" | "activity";
type FollowerDirectorySort = { key: FollowerDirectorySortKey; dir: "asc" | "desc" };

export function matchesFollowerQuery(record: FollowerRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const riotId = followerRiotId(record) ?? "";
  return record.userName.toLowerCase().includes(q)
    || (record.userLogin ?? "").toLowerCase().includes(q)
    || riotId.toLowerCase().includes(q);
}

export function filterFollowerDirectory(
  records: FollowerRecord[],
  query: string,
  status: FollowerDirectoryStatusFilter
): FollowerRecord[] {
  return records.filter((record) => (
    (status === "all" || record.status === status) && matchesFollowerQuery(record, query)
  ));
}

export function sortFollowerDirectory(records: FollowerRecord[], sort: FollowerDirectorySort): FollowerRecord[] {
  return [...records].sort((a, b) => {
    const av = sort.key === "activity" ? a.activity.total : new Date(a.followedAt ?? a.firstSeenAt).getTime();
    const bv = sort.key === "activity" ? b.activity.total : new Date(b.followedAt ?? b.firstSeenAt).getTime();
    return sort.dir === "asc" ? av - bv : bv - av;
  });
}

export function genreBarPercent(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((count / max) * 100)));
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

export function FollowersPage({ dataSource }: { dataSource?: FollowersDataSource }) {
  const t = uiText.followersPage;
  const [state, setState] = useState<FollowerManagementResponse>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string }>();
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [directoryStatus, setDirectoryStatus] = useState<FollowerDirectoryStatusFilter>("all");
  const [directorySort, setDirectorySort] = useState<FollowerDirectorySort>({ key: "followedAt", dir: "desc" });
  const [directoryPage, setDirectoryPage] = useState(1);

  function toggleDirectorySort(key: FollowerDirectorySortKey) {
    setDirectorySort((current) => (
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    ));
    setDirectoryPage(1);
  }

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      if (!dataSource) throw new Error("followers_data_source_missing");
      setState(await dataSource.load());
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
      if (!dataSource) throw new Error("followers_data_source_missing");
      setState(await dataSource.refresh());
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
      if (!dataSource) throw new Error("followers_data_source_missing");
      const result = await dataSource.startOAuth();
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
  }, [dataSource]);

  const metrics = state ? [
    { label: t.metrics.activeFollowers, value: state.summary.activeFollowers },
    { label: t.metrics.knownFollowers, value: state.summary.knownFollowers },
    { label: t.metrics.unfollowed, value: state.summary.unfollowed },
    { label: t.metrics.newFollowers7d, value: state.summary.newFollowers7d },
    { label: t.metrics.observedGenreFollowers, value: state.summary.observedGenreFollowers }
  ] : [];
  const oauthConnected = state?.oauth.state === "connected";

  const maxGenreCount = state ? Math.max(1, ...state.topObservedGenres.map((genre) => genre.count)) : 1;

  const filteredDirectoryFollowers = filterFollowerDirectory(state?.followers ?? [], directoryQuery, directoryStatus);
  const sortedDirectoryFollowers = sortFollowerDirectory(filteredDirectoryFollowers, directorySort);
  const directoryPageCount = Math.max(1, Math.ceil(sortedDirectoryFollowers.length / FOLLOWER_DIRECTORY_PAGE_SIZE));
  const currentDirectoryPage = Math.min(directoryPage, directoryPageCount);
  const directoryPageStart = (currentDirectoryPage - 1) * FOLLOWER_DIRECTORY_PAGE_SIZE;
  const directoryRangeEnd = Math.min(directoryPageStart + FOLLOWER_DIRECTORY_PAGE_SIZE, sortedDirectoryFollowers.length);
  const pagedDirectoryFollowers = sortedDirectoryFollowers.slice(directoryPageStart, directoryPageStart + FOLLOWER_DIRECTORY_PAGE_SIZE);

  return (
    <section className="followers-page" aria-labelledby="followers-page-title">
      <header className="page-header followers-page-header">
        <div>
          <h1 id="followers-page-title">{t.title}</h1>
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

          <section className="participation-summary followers-metrics" aria-label={t.title}>
            {metrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </article>
            ))}
          </section>

          <section className="grid two followers-grid">
            <div className="card followers-card">
              <div className="card-title-row">
                <h2>{t.sections.recentFollowers}</h2>
                <span className="count-badge">{state.recentFollowers.length}</span>
              </div>
              <FollowerMiniList items={state.recentFollowers} empty={t.empty.followers} />
            </div>

            <div className="card followers-card">
              <div className="card-title-row">
                <h2>{t.sections.recentUnfollowers}</h2>
                <span className="count-badge">{state.recentUnfollowers.length}</span>
              </div>
              <FollowerMiniList items={state.recentUnfollowers} empty={t.empty.unfollowers} />
            </div>
          </section>

          <section className="grid two followers-grid">
            <div className="card followers-card">
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
                      <div className="genre-bar-row-label">
                        <span>{localizedGenre(genre.name)}</span>
                        <strong>{genre.count}</strong>
                      </div>
                      <div className="genre-bar-track">
                        <div
                          className="genre-bar-fill"
                          style={{ width: `${genreBarPercent(genre.count, maxGenreCount)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card followers-card">
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

          <section className="card followers-card followers-directory">
            <div className="card-title-row">
              <h2>{t.sections.allFollowers}</h2>
              <span className="count-badge">{state.followers.length}</span>
            </div>
            {state.followers.length === 0 ? (
              <FollowerEmptyState text={t.empty.followers} />
            ) : (
              <>
                <div className="follower-directory-toolbar">
                  <label className="follower-directory-search">
                    <span className="yoro-u-sr-only">{t.directory.searchLabel}</span>
                    <input
                      onChange={(event) => { setDirectoryQuery(event.target.value); setDirectoryPage(1); }}
                      placeholder={t.directory.searchPlaceholder}
                      type="search"
                      value={directoryQuery}
                    />
                  </label>
                  <div className="follower-status-filter" role="group" aria-label={t.columns.status}>
                    {(["all", "following", "unfollowed"] as const).map((option) => (
                      <button
                        aria-pressed={directoryStatus === option}
                        key={option}
                        onClick={() => { setDirectoryStatus(option); setDirectoryPage(1); }}
                        type="button"
                      >
                        {option === "all" ? t.directory.filterAll : t.statuses[option]}
                      </button>
                    ))}
                  </div>
                  <span className="follower-directory-count">
                    {sortedDirectoryFollowers.length}{t.directory.resultUnit}
                  </span>
                </div>

                {pagedDirectoryFollowers.length === 0 ? (
                  <FollowerEmptyState text={t.directory.noResults} />
                ) : (
                  <div className="follower-table">
                    <div className="follower-row follower-head">
                      <span>{t.columns.user}</span>
                      <span>{t.columns.riotId}</span>
                      <span>{t.columns.status}</span>
                      <span>
                        <button
                          aria-sort={directorySort.key === "followedAt" ? (directorySort.dir === "asc" ? "ascending" : "descending") : undefined}
                          onClick={() => toggleDirectorySort("followedAt")}
                          type="button"
                        >
                          {t.columns.followedAt}
                          {directorySort.key === "followedAt" ? (directorySort.dir === "asc" ? " ▲" : " ▼") : ""}
                        </button>
                      </span>
                      <span>
                        <button
                          aria-sort={directorySort.key === "activity" ? (directorySort.dir === "asc" ? "ascending" : "descending") : undefined}
                          onClick={() => toggleDirectorySort("activity")}
                          type="button"
                        >
                          {t.columns.activity}
                          {directorySort.key === "activity" ? (directorySort.dir === "asc" ? " ▲" : " ▼") : ""}
                        </button>
                      </span>
                      <span>{t.columns.genre}</span>
                    </div>
                    {pagedDirectoryFollowers.map((follower) => (
                      <div className="follower-row" key={follower.userId}>
                        <FollowerIdentity record={follower} />
                        <span className="follower-riot-id" data-label={t.columns.riotId}>
                          {followerRiotId(follower) ?? t.riotIdMissing}
                        </span>
                        <span className={`queue-status ${statusClass(follower.status)}`}>
                          {t.statuses[follower.status]}
                        </span>
                        <span data-label={t.columns.followedAt}>{formatDate(follower.followedAt ?? follower.firstSeenAt)}</span>
                        <span data-label={t.columns.activity}>{follower.activity.total}</span>
                        <span data-label={t.columns.genre}>{mainGenre(follower)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {directoryPageCount > 1 ? (
                  <div className="follower-directory-pagination">
                    <span className="follower-directory-range">
                      {directoryPageStart + 1}-{directoryRangeEnd} / {sortedDirectoryFollowers.length}
                    </span>
                    <div className="follower-pager">
                      <button
                        aria-label={t.directory.pagePrev}
                        disabled={currentDirectoryPage <= 1}
                        onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))}
                        type="button"
                      >
                        ‹
                      </button>
                      <span className="follower-pager-indicator">{currentDirectoryPage} / {directoryPageCount}</span>
                      <button
                        aria-label={t.directory.pageNext}
                        disabled={currentDirectoryPage >= directoryPageCount}
                        onClick={() => setDirectoryPage((page) => Math.min(directoryPageCount, page + 1))}
                        type="button"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

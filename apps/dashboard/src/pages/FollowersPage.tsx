import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client";
import { uiText } from "../i18n";

type FollowerRecord = {
  userId: string;
  userLogin?: string;
  userName: string;
  followedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: "following" | "unfollowed";
  unfollowedAt?: string;
  activity: {
    chatMessages: number;
    participationEntries: number;
    total: number;
    genres: Record<string, number>;
    lastActivityAt?: string;
  };
};

type FollowerState = {
  summary: {
    knownFollowers: number;
    activeFollowers: number;
    unfollowed: number;
    newFollowers7d: number;
    observedGenreFollowers: number;
  };
  followers: FollowerRecord[];
  recentFollowers: FollowerRecord[];
  recentUnfollowers: FollowerRecord[];
  topObservedGenres: Array<{ name: string; count: number }>;
  lastSnapshotAt?: string;
  lastSnapshotTotal?: number;
  lastSnapshotTruncated?: boolean;
  dataNotes: string[];
};

const emptyState: FollowerState = {
  summary: {
    knownFollowers: 0,
    activeFollowers: 0,
    unfollowed: 0,
    newFollowers7d: 0,
    observedGenreFollowers: 0
  },
  followers: [],
  recentFollowers: [],
  recentUnfollowers: [],
  topObservedGenres: [],
  dataNotes: []
};

const t = uiText.followersPage;

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function mainGenre(record: FollowerRecord): string {
  const [first] = Object.entries(record.activity.genres).sort((a, b) => b[1] - a[1]);
  return first ? `${first[0]} ${first[1]}` : "-";
}

function statusClass(status: FollowerRecord["status"]): string {
  return status === "following" ? "good" : "bad";
}

function FollowerMiniList({ items, empty }: { items: FollowerRecord[]; empty: string }) {
  if (items.length === 0) return <p className="empty-state">{empty}</p>;
  return (
    <div className="follower-mini-list">
      {items.map((item) => (
        <div className="follower-mini-row" key={`${item.userId}-${item.status}`}>
          <div>
            <strong>{item.userName}</strong>
            <span>{item.userLogin ? `@${item.userLogin}` : item.userId}</span>
          </div>
          <span className={`queue-status ${statusClass(item.status)}`}>
            {t.statuses[item.status]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FollowersPage() {
  const [state, setState] = useState<FollowerState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const next = await apiGet<FollowerState>("/api/followers");
    setState(next);
  }

  async function refresh() {
    setRefreshing(true);
    setMessage("");
    try {
      const next = await apiPost<FollowerState>("/api/followers/refresh?limit=5000", {});
      setState(next);
      setMessage(t.refreshDone);
    } catch (error) {
      setMessage(`${t.refreshFailed}: ${String(error)}`);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load()
      .catch((error) => setMessage(String(error)))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => [
    { label: t.metrics.activeFollowers, value: state.summary.activeFollowers },
    { label: t.metrics.knownFollowers, value: state.summary.knownFollowers },
    { label: t.metrics.unfollowed, value: state.summary.unfollowed },
    { label: t.metrics.newFollowers7d, value: state.summary.newFollowers7d },
    { label: t.metrics.observedGenreFollowers, value: state.summary.observedGenreFollowers }
  ], [state.summary]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
        <div className="button-row">
          <button onClick={() => void refresh()} disabled={refreshing}>
            {refreshing ? t.refreshing : t.refresh}
          </button>
        </div>
      </header>

      <div className="scope-warning">
        <div>{t.scopeHint}</div>
        <div className="hint">{t.dataLimit}</div>
      </div>

      {message ? <p className="form-message">{message}</p> : null}

      <section className="participation-summary">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{loading ? "-" : metric.value}</strong>
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
            <p className="empty-state">{t.empty.genres}</p>
          ) : (
            <div className="genre-bar-list">
              {state.topObservedGenres.map((genre) => (
                <div className="genre-bar-row" key={genre.name}>
                  <span>{genre.name}</span>
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
            <span>{t.truncated}: {state.lastSnapshotTruncated ? "true" : "false"}</span>
            <ul>
              {state.dataNotes.map((note) => <li key={note}>{note}</li>)}
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
          <p className="empty-state">{t.empty.followers}</p>
        ) : (
          <div className="follower-table">
            <div className="follower-row follower-head">
              <span>{t.columns.user}</span>
              <span>{t.columns.status}</span>
              <span>{t.columns.followedAt}</span>
              <span>{t.columns.activity}</span>
              <span>{t.columns.genre}</span>
            </div>
            {state.followers.map((follower) => (
              <div className="follower-row" key={follower.userId}>
                <div className="queue-user">
                  <strong>{follower.userName}</strong>
                  <span>{follower.userLogin ? `@${follower.userLogin}` : follower.userId}</span>
                </div>
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
  );
}

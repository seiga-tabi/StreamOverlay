import { useEffect, useMemo, useRef, useState } from "react";
import { fetchStreamerPosts } from "../api/streamers";
import { formatStreamersText, type StreamersText } from "../i18n/streamers-i18n";
import type { StreamerPlatform, StreamerPostList } from "../types/streamer-post";
import { STREAMER_PLATFORMS } from "../types/streamer-post";
import { setStreamersUrl, streamersPathForPage, type StreamerScope } from "../utils/routes";
import { StreamerPostCard } from "./StreamerPostCard";

type LoadState = "loading" | "ready" | "error";

const PLATFORM_LABEL_KEYS: Record<StreamerPlatform, keyof StreamersText> = {
  twitch: "filterTwitch",
  chzzk: "filterChzzk",
  youtube: "filterYoutube",
};

/* 목록 안에서 찾는 수단 — 검색 · LIVE · 플랫폼 · 정렬.
 * 게임 범위는 헤더 nav 가 담당하므로 여기서 중복해 두지 않습니다. */
export function StreamerListPage({
  canPost,
  onLogin,
  scope,
  text,
}: {
  canPost: boolean;
  onLogin: () => void;
  scope: StreamerScope;
  text: StreamersText;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [list, setList] = useState<StreamerPostList | undefined>();
  const [search, setSearch] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);
  const [platforms, setPlatforms] = useState<readonly StreamerPlatform[]>([]);
  const [sort, setSort] = useState<"votes" | "recent">("votes");
  const [reloadToken, setReloadToken] = useState(0);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    /* 입력 중 매 글자마다 부르지 않습니다. */
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchStreamerPosts({
            scope,
            search: searchRef.current,
            liveOnly,
            platforms,
            sort,
          }, controller.signal);
          if (controller.signal.aborted) return;
          if (!result) {
            setState("error");
            return;
          }
          setList(result);
          setState("ready");
        } catch {
          /* abort 는 다음 요청이 이어받습니다. */
        }
      })();
    }, search ? 260 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [liveOnly, platforms, reloadToken, scope, search, sort]);

  const togglePlatform = (platform: StreamerPlatform) => {
    setPlatforms((current) => current.includes(platform)
      ? current.filter((item) => item !== platform)
      : [...current, platform]);
  };

  const posts = useMemo(() => list?.posts ?? [], [list]);

  return (
    <div className="streamers-page">
      <header className="streamers-page__head">
        <div>
          <h1>{text.brand}</h1>
          <p>{text.lead}</p>
        </div>
        {canPost ? (
          <button
            className="streamers-primary-action"
            onClick={() => setStreamersUrl(streamersPathForPage("compose"))}
            type="button"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {text.compose}
          </button>
        ) : (
          <span className="streamers-primary-action" data-locked="true">
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" viewBox="0 0 24 24">
              <rect height="9.5" rx="2" width="15" x="4.5" y="10.5" />
              <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
            </svg>
            {text.compose}
          </span>
        )}
      </header>

      <div className="streamers-filters">
        <label className="streamers-search">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder={text.searchPlaceholder}
            type="search"
            value={search}
          />
        </label>
        <div className="streamers-filters__row">
          <div className="streamers-filters__toggles">
            <button
              aria-pressed={liveOnly}
              className="streamers-toggle"
              data-live="true"
              onClick={() => setLiveOnly((value) => !value)}
              type="button"
            >
              <i aria-hidden="true" />
              {text.filterLiveOnly}
            </button>
            {STREAMER_PLATFORMS.map((platform) => (
              <button
                aria-pressed={platforms.includes(platform)}
                className="streamers-toggle"
                key={platform}
                onClick={() => togglePlatform(platform)}
                type="button"
              >
                {text[PLATFORM_LABEL_KEYS[platform]]}
              </button>
            ))}
          </div>
          <div className="streamers-filters__meta">
            {list ? (
              <>
                <span>{formatStreamersText(text.totalCount, { count: list.total })}</span>
                {list.liveCount > 0 ? <span>{formatStreamersText(text.liveCount, { count: list.liveCount })}</span> : null}
              </>
            ) : null}
            <label className="streamers-sort">
              <span>{text.sortLabel}</span>
              <select onChange={(event) => setSort(event.target.value === "recent" ? "recent" : "votes")} value={sort}>
                <option value="votes">{text.sortVotes}</option>
                <option value="recent">{text.sortRecent}</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {!canPost ? (
        <p className="streamers-login-banner">
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" viewBox="0 0 24 24">
            <rect height="9.5" rx="2" width="15" x="4.5" y="10.5" />
            <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
          </svg>
          <span>{text.composeLocked}</span>
          <button onClick={onLogin} type="button">{text.loginWithTwitch}</button>
        </p>
      ) : null}

      {state === "loading" ? <p className="streamers-state" role="status">{text.listLoading}</p> : null}

      {state === "error" ? (
        <div className="streamers-state streamers-state--error" role="alert">
          <strong>{text.listError}</strong>
          <p>{text.listErrorBody}</p>
          <button onClick={() => setReloadToken((token) => token + 1)} type="button">{text.retry}</button>
        </div>
      ) : null}

      {state === "ready" && posts.length === 0 ? (
        <div className="streamers-state">
          <strong>{text.listEmpty}</strong>
          <p>{text.listEmptyBody}</p>
        </div>
      ) : null}

      {state === "ready" && posts.length > 0 ? (
        <div className="streamers-list">
          {posts.map((post) => <StreamerPostCard key={post.id} post={post} text={text} />)}
        </div>
      ) : null}
    </div>
  );
}

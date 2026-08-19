import { useEffect, useState } from "react";
import {
  createStreamerComment,
  fetchStreamerPost,
  reportStreamerComment,
  voteStreamerPost,
  type StreamerReportReason,
} from "../api/streamers";
import { formatStreamersText, type StreamersText } from "../i18n/streamers-i18n";
import type { StreamerGame, StreamerPostDetail } from "../types/streamer-post";
import { setStreamersUrl, streamerPostPath, streamersHref, streamersPathForPage } from "../utils/routes";
import { StreamerAvatar } from "./StreamerAvatar";

type LoadState = "loading" | "ready" | "error";

const GAME_LABEL_KEYS: Record<StreamerGame, keyof StreamersText> = {
  lol: "scopeLol",
  valorant: "scopeValorant",
  palworld: "scopePalworld",
  minecraft: "scopeMinecraft",
};

const REPORT_REASONS: Array<{ value: StreamerReportReason; key: keyof StreamersText }> = [
  { value: "spam", key: "reportReasonSpam" },
  { value: "abuse", key: "reportReasonAbuse" },
  { value: "off_topic", key: "reportReasonOffTopic" },
  { value: "other", key: "reportReasonOther" },
];

export function StreamerDetailPage({
  canPost,
  onLogin,
  onTitle,
  postId,
  text,
}: {
  canPost: boolean;
  onLogin: () => void;
  onTitle: (title: string | undefined) => void;
  postId: string;
  text: StreamersText;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<StreamerPostDetail | undefined>();
  const [reloadToken, setReloadToken] = useState(0);
  const [commentBody, setCommentBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [reportTarget, setReportTarget] = useState<string | undefined>();
  const [reportReason, setReportReason] = useState<StreamerReportReason>("spam");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void (async () => {
      try {
        const result = await fetchStreamerPost(postId, controller.signal);
        if (controller.signal.aborted) return;
        if (!result.ok) {
          setState("error");
          onTitle(undefined);
          return;
        }
        setDetail(result.detail);
        setState("ready");
        onTitle(result.detail.post.streamerName);
      } catch {
        /* abort */
      }
    })();
    return () => controller.abort();
  }, [onTitle, postId, reloadToken]);

  const reload = () => setReloadToken((token) => token + 1);

  const submitComment = async () => {
    const body = commentBody.trim();
    if (!body) return;
    const result = await createStreamerComment(postId, { body, anonymous });
    if (result.ok) {
      setCommentBody("");
      reload();
      return;
    }
    setNotice(result.reason === "login_required" ? text.commentsLoginRequired : text.listErrorBody);
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    const result = await reportStreamerComment(postId, reportTarget, reportReason);
    setReportTarget(undefined);
    setNotice(result.ok
      ? text.reportOnce
      : result.reason === "login_required" ? text.commentsLoginRequired : text.listErrorBody);
  };

  /* X 로 나가는 주소 — 받는 사람은 이 링크만 보고 들어옵니다. 일본어 화면에서
     공유했으면 일본어 페이지로 열려야 하고, 크롤러가 읽는 OG 도 그 로케일입니다. */
  const shareUrl = new URL(streamersHref(streamerPostPath(postId)), window.location.origin).href;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareNotice(text.shareCopied);
    } catch {
      setShareNotice(text.listErrorBody);
    }
  };

  if (state === "loading") return <p className="streamers-state" role="status">{text.listLoading}</p>;

  if (state === "error" || !detail) {
    return (
      <div className="streamers-state streamers-state--error" role="alert">
        <strong>{text.notFound}</strong>
        <p>{text.notFoundBody}</p>
        <button onClick={() => setStreamersUrl(streamersPathForPage("list"))} type="button">{text.backToList}</button>
      </div>
    );
  }

  const { post, comments } = detail;
  const lol = post.lolProfile;

  return (
    <div className="streamers-page streamers-detail">
      <nav aria-label={text.mainMenu} className="streamers-detail__crumbs">
        <button onClick={() => setStreamersUrl(streamersPathForPage("list"))} type="button">{text.brand}</button>
        <span aria-hidden="true">›</span>
        <span>{post.streamerName}</span>
      </nav>

      <article className="streamers-detail__post">
        <header>
          <StreamerAvatar
            platform={post.platform}
            size={72}
            streamerName={post.streamerName}
            {...(post.profileImageUrl ? { profileImageUrl: post.profileImageUrl } : {})}
          />
          <div>
            <h1>{post.streamerName}</h1>
            <div className="streamers-card__chips">
              {post.games.map((game) => (
                <span className="streamers-chip" data-game={game} key={game}><i aria-hidden="true" />{text[GAME_LABEL_KEYS[game]]}</span>
              ))}
              {post.tags.map((tag) => <span className="streamers-chip" key={tag}>{tag}</span>)}
            </div>
          </div>
          {post.channelUrl ? (
            <a className="streamers-primary-action" href={post.channelUrl} rel="noreferrer noopener nofollow" target="_blank">
              {text.detailOpenChannel}
            </a>
          ) : (
            <button className="streamers-primary-action" onClick={onLogin} type="button">{text.loginWithTwitch}</button>
          )}
        </header>

        {lol ? (
          <section className="streamers-detail__profile">
            <div className="streamers-detail__profile-head">
              <h2>{text.detailProfile}</h2>
              <span>{`${lol.riotId} · ${text.soloRank}`}</span>
            </div>
            <div className="streamers-detail__profile-body">
              <span className="streamers-rank-tier" data-large="true">{lol.tier}</span>
              <div className="streamers-detail__rate">
                <strong>{`${lol.winRate.toFixed(1)}%`}</strong>
                <span>{formatStreamersText(text.winsLosses, { wins: lol.wins, losses: lol.losses })}</span>
                <span className="streamers-detail__bar">
                  <i style={{ width: `${lol.winRate}%` }} />
                </span>
              </div>
              {lol.recentResults.length > 0 ? (
                <span aria-label={formatStreamersText(text.recentGames, { count: lol.recentResults.length })} className="streamers-rank-form" data-large="true">
                  {lol.recentResults.map((result, index) => <i data-result={result} key={`${result}-${index}`} />)}
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        <footer className="streamers-detail__actions">
          <button
            aria-pressed={post.voted}
            className="streamers-vote"
            /* 추천은 계정당 1회입니다 — 이미 누른 글은 다시 부르지 않습니다. */
            disabled={post.voted}
            onClick={() => void voteStreamerPost(post.id).then((result) => {
              if (result.ok) reload();
              else setNotice(result.reason === "login_required" ? text.commentsLoginRequired : text.listErrorBody);
            })}
            type="button"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
              <polyline points="6 14 12 8 18 14" />
            </svg>
            {`${text.votes} ${post.votes}`}
          </button>
          <button className="streamers-ghost" onClick={() => setShareOpen((open) => !open)} type="button">{text.share}</button>
          <span className="streamers-detail__author">{post.authorName}</span>
        </footer>

        {shareOpen ? (
          <div className="streamers-share">
            <strong>{text.shareTitle}</strong>
            <div className="streamers-share__rows">
              <a
                className="streamers-share__row"
                data-primary="true"
                href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.streamerName)}`}
                rel="noreferrer noopener"
                target="_blank"
              >
                <span>{text.shareToX}</span>
                <small>{text.shareToXBody}</small>
              </a>
              <button className="streamers-share__row" onClick={() => void copyLink()} type="button">
                <span>{text.shareCopyLink}</span>
                <small>{shareUrl.replace(/^https?:\/\//u, "")}</small>
              </button>
            </div>
            <p>{text.shareNote}</p>
            {shareNotice ? <p role="status">{shareNotice}</p> : null}
          </div>
        ) : null}
      </article>

      <section className="streamers-comments">
        <h2>{formatStreamersText(text.commentsTitle, { count: comments.length })}</h2>

        {canPost ? (
          <div className="streamers-comments__composer">
            <label className="sr-only" htmlFor="streamers-comment-body">{text.commentPlaceholder}</label>
            <textarea
              id="streamers-comment-body"
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder={text.commentPlaceholder}
              rows={3}
              value={commentBody}
            />
            <div className="streamers-comments__composer-actions">
              <label className="streamers-checkbox">
                <input checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} type="checkbox" />
                {text.commentAnonymous}
              </label>
              <button disabled={!commentBody.trim()} onClick={() => void submitComment()} type="button">{text.commentSubmit}</button>
            </div>
          </div>
        ) : (
          <p className="streamers-login-banner">
            <span>{text.commentsLoginRequired}</span>
            <button onClick={onLogin} type="button">{text.loginWithTwitch}</button>
          </p>
        )}

        {notice ? <p className="streamers-state" role="status">{notice}</p> : null}

        <ul className="streamers-comments__list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <div className="streamers-comments__meta">
                <strong>{comment.anonymous ? text.commentAnonymousName : comment.authorName}</strong>
                {comment.anonymous ? <span className="streamers-tag">{text.commentAnonymousName}</span> : null}
                {canPost ? (
                  <button className="streamers-report" onClick={() => setReportTarget(comment.id)} type="button">{text.report}</button>
                ) : null}
              </div>
              <p>{comment.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {reportTarget ? (
        <div aria-label={text.reportTitle} className="streamers-report-dialog" role="dialog">
          <strong>{text.reportTitle}</strong>
          <div className="streamers-report-dialog__reasons">
            {REPORT_REASONS.map((reason) => (
              <label key={reason.value}>
                <input
                  checked={reportReason === reason.value}
                  name="streamers-report-reason"
                  onChange={() => setReportReason(reason.value)}
                  type="radio"
                />
                {text[reason.key]}
              </label>
            ))}
          </div>
          <p>{text.reportOnce}</p>
          <div className="streamers-report-dialog__actions">
            <button onClick={() => setReportTarget(undefined)} type="button">{text.cancel}</button>
            <button data-danger="true" onClick={() => void submitReport()} type="button">{text.reportSubmit}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

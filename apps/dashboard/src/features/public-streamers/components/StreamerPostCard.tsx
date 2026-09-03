import { formatStreamersText, type StreamersText } from "../i18n/streamers-i18n";
import type { StreamerPost } from "../types/streamer-post";
import { setStreamersUrl, streamerOfficialProfilePath, streamerPostPath, streamersHref } from "../utils/routes";
import { StreamerAvatar } from "./StreamerAvatar";
import { GAME_LABEL_KEYS, StreamerCardMedia } from "./StreamerCardMedia";

const PLATFORM_LABEL_KEYS: Record<StreamerPost["platform"], keyof StreamersText> = {
  twitch: "filterTwitch",
  chzzk: "filterChzzk",
  youtube: "filterYoutube",
};

/** 채널 주소는 로그인 뒤에만 옵니다 — 없으면 잠금 줄로 닫습니다(빈 자리 금지). */
export function StreamerPostCard({ post, text }: { post: StreamerPost; text: StreamersText }) {
  const lol = post.lolProfile;
  const riotSeparator = lol?.riotId.lastIndexOf("#") ?? -1;
  const riotName = lol && riotSeparator > 0 ? lol.riotId.slice(0, riotSeparator) : lol?.riotId;
  const riotTag = lol && riotSeparator > 0 ? lol.riotId.slice(riotSeparator) : undefined;
  const record = lol
    ? formatStreamersText(text.winsLosses, { wins: lol.wins, losses: lol.losses }).split(/\s+/u)
    : [];
  const detailPath = post.officialProfile
    ? streamerOfficialProfilePath(post.platform, post.officialProfile.seoSlug)
    : streamerPostPath(post.id);
  return (
    <article className="streamers-card v2b-card">
      <div className="v2b-card__top">
        {/* 기존 계약대로 표시 전용입니다. 추천 API 동작은 이 변경에서 추가하지 않습니다. */}
        <div className="v2-vote" data-voted={post.voted ? "true" : undefined}>
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24">
            <path d="M12 19V6M6 12l6-6 6 6" />
          </svg>
          <strong>{post.votes}</strong>
          <span>{text.votes}</span>
        </div>

        <div className="v2-avatar v2b-avatar" data-live={post.live ? "true" : undefined}>
          <StreamerAvatar
            platform={post.platform}
            streamerName={post.streamerName}
            {...(post.profileImageUrl ? { profileImageUrl: post.profileImageUrl } : {})}
          />
          {post.live ? <span className="v2-live"><i aria-hidden="true" />{text.live}</span> : null}
        </div>

        <div className="v2b-card__id">
          <div className="v2b-card__idline">
            <h2 className="v2-name">
              <a
                href={streamersHref(detailPath)}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                  event.preventDefault();
                  setStreamersUrl(detailPath);
                }}
              >
                {post.streamerName}
              </a>
            </h2>
            <span className="v2-badge" data-platform={post.platform}>
              <i aria-hidden="true" />{text[PLATFORM_LABEL_KEYS[post.platform]]}
            </span>
            {post.registeredByAdmin ? (
              <span className="v2-badge" data-official="true">
                <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24">
                  <path d="M4 12.5l5.5 5.5L20 7" />
                </svg>
                {text.officialBadge}
              </span>
            ) : null}
          </div>

          <div className="v2b-card__idline">
            {lol ? <span className="v2b-card__riot">{riotName}{riotTag ? <span>{riotTag}</span> : null}</span> : null}
            {post.games.map((game) => (
              <span className="v2-badge" data-game={game} key={game}>
                <i aria-hidden="true" />{text[GAME_LABEL_KEYS[game]]}
              </span>
            ))}
            {post.tags.map((tag) => <span className="v2-badge" key={tag}>{tag}</span>)}
            {post.channelUrl ? (
              <a className="v2-handle" href={post.channelUrl} rel="noreferrer noopener nofollow" target="_blank">
                {post.channelUrl.replace(/^https:\/\//u, "")}
              </a>
            ) : (
              <span className="v2-handle v2-handle--locked">
                <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" viewBox="0 0 24 24">
                  <rect height="9.5" rx="2" width="15" x="4.5" y="10.5" />
                  <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
                </svg>
                {text.channelLocked}
              </span>
            )}
          </div>
        </div>

        <StreamerCardMedia post={post} text={text} />
      </div>

      <div className="v2b-card__strip">
        {lol ? (
          <>
            <span className="v2-meter">
              <span className="v2-meter__label">{text.soloRank}</span>
              <span
                aria-label={formatStreamersText(text.winRateAria, {
                  rate: Math.round(lol.winRate),
                  wins: lol.wins,
                  losses: lol.losses,
                })}
                className="v2-meter__bar"
                role="img"
              >
                <i style={{ width: `${Math.round(lol.winRate)}%` }} />
              </span>
              <span className="v2-meter__pct">{`${Math.round(lol.winRate)}%`}</span>
              <span className="v2-meter__record">
                <b>{record[0]}</b>{record.length > 1 ? <> <em>{record.slice(1).join(" ")}</em></> : null}
              </span>
            </span>
            {lol.recentResults.length > 0 ? (
              <span className="v2-form">
                <span className="v2-form__label">{formatStreamersText(text.recentForm, { count: lol.recentResults.length })}</span>
                <span aria-label={formatStreamersText(text.recentGames, { count: lol.recentResults.length })} className="v2-form__dots" role="img">
                  {lol.recentResults.map((result, index) => (
                    <i data-r={result === "win" ? "w" : undefined} key={`${result}-${index}`} />
                  ))}
                </span>
              </span>
            ) : (
              <span className="v2b-card__strip--empty streamers-rank-empty">{text.noRecentGames}</span>
            )}
          </>
        ) : null}
        <span className="v2-meta">
          <span>{post.authorName}</span>
          <span aria-hidden="true" className="v2-meta__dot" />
          <span><b>{`${text.comments} ${post.commentCount}`}</b></span>
        </span>
      </div>
    </article>
  );
}

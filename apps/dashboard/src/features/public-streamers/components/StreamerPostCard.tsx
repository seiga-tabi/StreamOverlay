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
  const detailPath = post.officialProfile
    ? streamerOfficialProfilePath(post.platform, post.officialProfile.seoSlug)
    : streamerPostPath(post.id);
  return (
    <article className="streamers-card">
      <div className="streamers-card__votes">
        <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
          <polyline points="6 14 12 8 18 14" />
        </svg>
        <strong>{post.votes}</strong>
        <span>{text.votes}</span>
      </div>
      <StreamerAvatar
        platform={post.platform}
        streamerName={post.streamerName}
        {...(post.profileImageUrl ? { profileImageUrl: post.profileImageUrl } : {})}
      />
      <div className="streamers-card__body">
        <div className="streamers-card__title">
          <h2>
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
          <span className="streamers-tag" data-platform={post.platform}>{text[PLATFORM_LABEL_KEYS[post.platform]]}</span>
          {post.registeredByAdmin ? <span className="streamers-tag" data-official="true">{text.officialBadge}</span> : null}
          {post.live ? <span className="streamers-tag" data-live="true">{text.live}</span> : null}
        </div>

        <div className="streamers-card__chips">
          {post.games.map((game) => (
            <span className="streamers-chip" data-game={game} key={game}>
              <i aria-hidden="true" />
              {text[GAME_LABEL_KEYS[game]]}
            </span>
          ))}
          {post.tags.map((tag) => <span className="streamers-chip" key={tag}>{tag}</span>)}
          {post.channelUrl ? (
            <a className="streamers-chip streamers-chip--link" href={post.channelUrl} rel="noreferrer noopener nofollow" target="_blank">
              <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
                <path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5" />
                <path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.6 2.6a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" />
              </svg>
              {post.channelUrl.replace(/^https:\/\//u, "")}
            </a>
          ) : null}
        </div>

        {!post.channelUrl ? (
          <p className="streamers-card__locked">
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.75" viewBox="0 0 24 24">
              <rect height="9.5" rx="2" width="15" x="4.5" y="10.5" />
              <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
            </svg>
            {text.channelLocked}
          </p>
        ) : null}

        {/* 전적 줄은 리그 오브 레전드 글에만 붙습니다 — 다른 게임은 게임 표기까지입니다.
            티어 표기는 우측 비주얼 슬롯으로 옮겼고 이 자리는 승률 게이지가 씁니다. */}
        {lol ? (
          <div className="streamers-card__rank">
            <strong>{lol.riotId}</strong>
            <span className="streamers-rank-meter">
              <small>{text.soloRank}</small>
              {/* 서버 winRate 는 정수입니다 — 소수 자리를 만들어 붙이지 않습니다. */}
              <span
                aria-label={formatStreamersText(text.winRateAria, {
                  rate: Math.round(lol.winRate),
                  wins: lol.wins,
                  losses: lol.losses,
                })}
                className="streamers-rank-bar"
                role="img"
              >
                <i style={{ width: `${Math.round(lol.winRate)}%` }} />
              </span>
              <b>{`${Math.round(lol.winRate)}%`}</b>
              <span className="streamers-rank-record">
                {formatStreamersText(text.winsLosses, { wins: lol.wins, losses: lol.losses })}
              </span>
            </span>
            {/* 최근 경기 결과는 서버가 아직 싣지 않습니다 — 빈 자리 대신 이유를 적습니다. */}
            {lol.recentResults.length > 0 ? (
              <span aria-label={formatStreamersText(text.recentGames, { count: lol.recentResults.length })} className="streamers-rank-form">
                {lol.recentResults.map((result, index) => (
                  <i data-result={result} key={`${result}-${index}`} />
                ))}
              </span>
            ) : (
              <span className="streamers-rank-empty">{text.noRecentGames}</span>
            )}
          </div>
        ) : null}
      </div>
      <StreamerCardMedia post={post} text={text} />
      <div className="streamers-card__meta">
        <span>{post.authorName}</span>
        <span>{`${text.comments} ${post.commentCount}`}</span>
      </div>
    </article>
  );
}

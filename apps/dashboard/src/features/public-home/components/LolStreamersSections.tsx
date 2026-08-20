import { useMemo, useState } from "react";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import type { PublicTwitchFollowedLolChannel, PublicTwitchFollowedLolResponse } from "../../public-lol/types/public-lol";
import { formatNumber } from "../../public-lol/utils/format";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import { rankTierLabel } from "../../public-lol/utils/rank";
import { publicSummonerPath } from "../../public-lol/utils/riot-id";
import { streamerBuckets, type StreamerFilter } from "../../public-lol/utils/streamers";
import { safeTwitchStreamPreviewUrl } from "../../public-twitch/stream-preview";
import type { HomeText } from "../i18n/home-i18n";
import type { LolStreamersText } from "../i18n/lol-streamers-i18n";
import { NorigaeMark, SleepingTiger } from "./HomeMarks";

/* LoL 스트리머(/follow) 전용 섹션 — 목업 캔버스 page-3 구현.
 * 데이터·상태 흐름은 기존 화면(PublicLolPage의 subscriptions 뷰)과 같은 계약:
 * usePublicViewerTwitchSession 의 팔로우 채널 + streamerBuckets 분류.
 * 새 endpoint 나 mock 데이터를 만들지 않습니다. */

const OFFLINE_PREVIEW = 5;

function fill(template: string, value: string): string {
  return template.replace("{count}", value).replace("{date}", value);
}

/* 팔로우 날짜 — 기존 화면과 같은 정보를 로케일 날짜 형식으로. */
function followedDate(iso: string, locale: PublicLocale): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const tag = locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "ko-KR";
  return new Intl.DateTimeFormat(tag, { year: "numeric", month: "long", day: "numeric" }).format(time);
}

/* 프로필 링크는 기본 플랫폼 관례를 따릅니다(기존 화면·대시보드와 동일 —
   채널에는 플랫폼 정보가 없어 publicSummonerPath 의 기본값을 씁니다). */
function statsHref(riotId: string): string {
  return localizedPublicUrlForCurrentLocale(publicSummonerPath(riotId));
}

function rankBadge(channel: PublicTwitchFollowedLolChannel): string | undefined {
  const ranked = channel.rankedStats;
  if (!ranked || ranked.tier === "UNRANKED") return undefined;
  return rankTierLabel(ranked);
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="13">
      <path d="M13.5 8 A 5.5 5.5 0 1 1 8 2.5" />
      <path d="M8 0.5 L 11 2.5 L 8 4.5" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="12" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="12">
      <path d="M4 3 v10 M4 13 L 2 10.5 M4 13 L 6 10.5" />
      <path d="M9 4 h5 M9 8 h4 M9 12 h3" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg aria-hidden="true" className="yoro-home-thumb-glyph" fill="none" height="30" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 30 30" width="30">
      <circle cx="15" cy="15" r="11" />
      <path d="M12.5 10.5 L 20 15 L 12.5 19.5 Z" />
    </svg>
  );
}

function ExpandCaret() {
  return (
    <svg aria-hidden="true" fill="none" height="5" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="8">
      <path d="M1 1 L 4 4 L 7 1" />
    </svg>
  );
}

/* ── 페이지 헤드: 노리개 + 제목 + 인원 + 새로고침 ─────────── */

export function StreamersPageHead({ text, count, loading, onRefresh }: {
  text: LolStreamersText;
  count?: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="yoro-home-section yoro-streamers-headwrap">
      <div className="yoro-home-section-head yoro-streamers-head">
        <NorigaeMark className="yoro-home-section-norigae" height={30} width={15} />
        <h1 className="yoro-streamers-title">{text.pageTitle}</h1>
        {count !== undefined ? (
          <span className="yoro-home-section-count">{fill(text.countUnit, formatNumber(count))}</span>
        ) : null}
        <button
          className="yoro-home-outline-button yoro-streamers-refresh"
          disabled={loading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshIcon />
          {text.refresh}
        </button>
      </div>
      <p className="yoro-streamers-sub">{text.pageSub}</p>
    </div>
  );
}

/* ── 카드·행 ──────────────────────────────────────────────── */

function ChannelActions({ text, channel }: {
  text: LolStreamersText;
  channel: PublicTwitchFollowedLolChannel;
}) {
  const channelUrl = channel.channelUrl ?? (channel.twitchLogin ? `https://www.twitch.tv/${channel.twitchLogin}` : undefined);
  if (!channel.riotId && !channelUrl) return null;
  return (
    <div className="yoro-streamers-actions">
      {channel.riotId ? (
        <a className="yoro-streamers-action" href={statsHref(channel.riotId)}>
          {text.viewStats}
        </a>
      ) : null}
      {channelUrl ? (
        <a
          className="yoro-streamers-action"
          href={channelUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          Twitch <span aria-hidden="true" className="yoro-streamers-ext">&#8599;</span>
        </a>
      ) : null}
    </div>
  );
}

function LiveStreamerCard({ text, viewersTemplate, channel }: {
  text: LolStreamersText;
  /* "{count}명 시청" — 홈 카드와 같은 카피(home-i18n liveViewers)를 재사용합니다. */
  viewersTemplate: string;
  channel: PublicTwitchFollowedLolChannel;
}) {
  const preview = safeTwitchStreamPreviewUrl(channel.thumbnailUrl);
  const badge = rankBadge(channel);
  return (
    <div className="yoro-home-live-card yoro-streamers-card">
      <div className="yoro-home-live-thumb">
        {preview ? <img alt="" loading="lazy" src={preview} /> : <PlayGlyph />}
        <span className="yoro-home-live-badge"><span aria-hidden="true" className="yoro-home-live-dot" />LIVE</span>
        {channel.viewerCount !== undefined ? (
          <span className="yoro-home-live-viewers">{fill(viewersTemplate, formatNumber(channel.viewerCount))}</span>
        ) : null}
      </div>
      <div className="yoro-home-live-body">
        <div className="yoro-home-live-who">
          <span className="yoro-home-live-avatar">
            {channel.profileImageUrl ? <img alt="" loading="lazy" src={channel.profileImageUrl} /> : channel.twitchDisplayName.slice(0, 1)}
          </span>
          <span className="yoro-home-live-names">
            <span className="yoro-home-live-name">{channel.twitchDisplayName}</span>
            {channel.title ? <span className="yoro-home-live-game">{channel.title}</span> : null}
          </span>
          {badge ? <span className="yoro-streamers-rank-badge">{badge}</span> : null}
        </div>
        <ChannelActions channel={channel} text={text} />
      </div>
    </div>
  );
}

function OfflineRow({ text, channel, locale }: {
  text: LolStreamersText;
  channel: PublicTwitchFollowedLolChannel;
  locale: PublicLocale;
}) {
  const badge = rankBadge(channel);
  const date = followedDate(channel.followedAt, locale);
  const name = <span className="yoro-streamers-row-name">{channel.twitchDisplayName}</span>;
  return (
    <li className="yoro-streamers-row">
      <span className="yoro-home-live-avatar">
        {channel.profileImageUrl ? <img alt="" loading="lazy" src={channel.profileImageUrl} /> : channel.twitchDisplayName.slice(0, 1)}
      </span>
      <span className="yoro-streamers-row-body">
        {/* 모바일에선 액션 칩을 접으므로(목업), 이름 자체가 전적으로 가는 링크입니다. */}
        {channel.riotId ? <a className="yoro-streamers-row-link" href={statsHref(channel.riotId)}>{name}</a> : name}
        {date ? <span className="yoro-streamers-row-meta">{fill(text.followedOn, date)}</span> : null}
      </span>
      {badge
        ? <span className="yoro-streamers-rank-badge">{badge}</span>
        : <span className="yoro-streamers-unlinked">{text.statsNotLinked}</span>}
      {/* 오프라인 행 액션은 "전적 보기"뿐입니다(목업 §④ — Twitch 이동은
          방송 카드 전용, 오프라인 채널로의 이동 가치는 낮습니다). */}
      {channel.riotId ? (
        <div className="yoro-streamers-actions">
          <a className="yoro-streamers-action" href={statsHref(channel.riotId)}>
            {text.viewStats}
          </a>
        </div>
      ) : null}
    </li>
  );
}

/* ── 본문: 필터 + 방송 중 + 오프라인 (+상태들) ────────────── */

function StreamersEmptyBlock({ title, description, action }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="yoro-home-live-empty">
      <SleepingTiger className="yoro-home-live-empty-tiger" />
      <p className="yoro-home-live-empty-title">{title}</p>
      {description ? <p className="yoro-home-live-empty-sub">{description}</p> : null}
      {action}
    </div>
  );
}

export function StreamersBody({ text, homeText, locale, connected, configured, followed, loading, error, onLoginOpen, onRetry }: {
  text: LolStreamersText;
  homeText: HomeText;
  locale: PublicLocale;
  connected: boolean;
  configured: boolean;
  followed: PublicTwitchFollowedLolResponse | null;
  loading: boolean;
  error: boolean;
  onLoginOpen: () => void;
  onRetry: () => void;
}) {
  const [filter, setFilter] = useState<StreamerFilter>("all");
  const [sortByRank, setSortByRank] = useState(false);
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  const channels = useMemo(() => followed?.channels ?? [], [followed]);
  const buckets = useMemo(
    () => streamerBuckets(channels, filter, sortByRank),
    [channels, filter, sortByRank]
  );

  if (!configured && !loading) {
    return (
      <section className="yoro-home-section">
        <StreamersEmptyBlock title={text.notConfigured} />
      </section>
    );
  }

  if (!connected) {
    return (
      <section className="yoro-home-section">
        <StreamersEmptyBlock
          action={(
            <button className="yoro-home-outline-button" onClick={onLoginOpen} type="button">
              {text.loginCta}
            </button>
          )}
          description={text.loginRequiredDescription}
          title={text.loginRequiredTitle}
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="yoro-home-section">
        <StreamersEmptyBlock
          action={(
            <button className="yoro-home-outline-button" onClick={onRetry} type="button">
              {text.retry}
            </button>
          )}
          title={text.errorTitle}
        />
      </section>
    );
  }

  if (!followed) {
    return (
      <section aria-busy="true" className="yoro-home-section">
        <p aria-live="polite" className="yoro-streamers-loading">{text.loadingLabel}&#8230;</p>
      </section>
    );
  }

  if (buckets.counts.all === 0) {
    return (
      <section className="yoro-home-section">
        <StreamersEmptyBlock description={text.emptyDescription} title={text.emptyTitle} />
      </section>
    );
  }

  const visibleOffline = offlineExpanded ? buckets.offline : buckets.offline.slice(0, OFFLINE_PREVIEW);
  const hiddenOffline = Math.max(0, buckets.offline.length - visibleOffline.length);
  const filters: Array<{ id: StreamerFilter; label: string; count: number; live?: boolean }> = [
    { id: "live", label: text.filterLive, count: buckets.counts.live, live: true },
    { id: "all", label: text.filterAll, count: buckets.counts.all },
    { id: "linked", label: text.filterLinked, count: buckets.counts.linked }
  ];

  return (
    <>
      <section className="yoro-home-section yoro-streamers-filterwrap">
        <div className="yoro-streamers-filters">
          {filters.map((option) => (
            <button
              aria-pressed={filter === option.id}
              className={`yoro-streamers-filter${filter === option.id ? " is-active" : ""}`}
              key={option.id}
              onClick={() => setFilter(option.id)}
              type="button"
            >
              {option.live ? <span aria-hidden="true" className="yoro-streamers-live-dot" /> : null}
              {option.label} <span className="yoro-streamers-filter-count">{formatNumber(option.count)}</span>
            </button>
          ))}
          <button
            aria-pressed={sortByRank}
            className={`yoro-streamers-filter yoro-streamers-sort${sortByRank ? " is-active" : ""}`}
            onClick={() => setSortByRank((current) => !current)}
            type="button"
          >
            <SortIcon />
            {text.sortByRank}
          </button>
        </div>
      </section>

      {buckets.live.length > 0 ? (
        <section className="yoro-home-section">
          <div className="yoro-home-section-head">
            <h2 className="yoro-home-section-title">{text.liveNow}</h2>
            <span className="yoro-home-live-badge yoro-streamers-live-count">
              <span aria-hidden="true" className="yoro-home-live-dot" />{formatNumber(buckets.live.length)}
            </span>
          </div>
          <div className="yoro-streamers-live-grid">
            {buckets.live.map((channel) => (
              <LiveStreamerCard
                channel={channel}
                key={channel.twitchUserId || channel.twitchLogin}
                text={text}
                viewersTemplate={homeText.liveViewers}
              />
            ))}
          </div>
        </section>
      ) : null}

      {buckets.offline.length > 0 ? (
        <section className="yoro-home-section">
          <div className="yoro-home-section-head yoro-streamers-offline-head">
            <h2 className="yoro-home-section-title">{text.offline}</h2>
            <span className="yoro-home-section-count">{fill(text.countUnit, formatNumber(buckets.offline.length))}</span>
          </div>
          <ol className="yoro-streamers-rows">
            {visibleOffline.map((channel) => (
              <OfflineRow channel={channel} key={channel.twitchUserId || channel.twitchLogin} locale={locale} text={text} />
            ))}
          </ol>
          {hiddenOffline > 0 || offlineExpanded ? (
            <div className="yoro-streamers-more-wrap">
              <button
                aria-expanded={offlineExpanded}
                className="yoro-streamers-more"
                onClick={() => setOfflineExpanded((current) => !current)}
                type="button"
              >
                {offlineExpanded ? text.showLess : fill(text.showMore, formatNumber(hiddenOffline))}
                <ExpandCaret />
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

import type { PublicTwitchFollowedLolChannel } from "../types/public-lol";
import { rankScore } from "./rank";

/* 스트리머 목록의 분류·정렬·집계.
 *
 * 화면은 "지금 방송 중"과 "오프라인"을 나눠 보여 주고, 방송 중인 사람이 항상
 * 위에 옵니다. 팔로우한 순서대로 나열하면 방송 중인 채널이 목록 곳곳에 흩어져
 * 찾기 어렵습니다(실측: 12명 중 4명이 1·4·7·8번째).
 */

export type StreamerFilter = "live" | "all" | "linked";

export type StreamerBuckets = {
  live: PublicTwitchFollowedLolChannel[];
  offline: PublicTwitchFollowedLolChannel[];
  counts: { live: number; all: number; linked: number };
};

function hasRank(channel: PublicTwitchFollowedLolChannel): boolean {
  return Boolean(channel.rankedStats && channel.rankedStats.tier !== "UNRANKED");
}

/** 시청자 수가 많은 순. 값이 없으면 뒤로 보냅니다. */
function byViewers(a: PublicTwitchFollowedLolChannel, b: PublicTwitchFollowedLolChannel): number {
  return (b.viewerCount ?? -1) - (a.viewerCount ?? -1);
}

/** 랭크가 높은 순. 언랭크·미연결은 뒤로 보냅니다. */
function byRank(a: PublicTwitchFollowedLolChannel, b: PublicTwitchFollowedLolChannel): number {
  return rankScore(b.rankedStats) - rankScore(a.rankedStats);
}

/** 최근에 팔로우한 순. 날짜가 깨져 있으면 뒤로 보냅니다. */
function byFollowedAt(a: PublicTwitchFollowedLolChannel, b: PublicTwitchFollowedLolChannel): number {
  const left = Date.parse(a.followedAt);
  const right = Date.parse(b.followedAt);
  return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
}

export function streamerBuckets(
  channels: PublicTwitchFollowedLolChannel[],
  filter: StreamerFilter = "all",
  sortByRank = false
): StreamerBuckets {
  const counts = {
    all: channels.length,
    live: channels.filter((channel) => channel.isLive).length,
    linked: channels.filter(hasRank).length,
  };

  const visible = filter === "live"
    ? channels.filter((channel) => channel.isLive)
    : filter === "linked"
      ? channels.filter(hasRank)
      : channels;

  // 방송 중은 시청자 수 우선, 오프라인은 랭크순 또는 최근 팔로우순입니다.
  const live = visible.filter((channel) => channel.isLive).sort(sortByRank ? byRank : byViewers);
  const offline = visible.filter((channel) => !channel.isLive).sort(sortByRank ? byRank : byFollowedAt);
  return { live, offline, counts };
}

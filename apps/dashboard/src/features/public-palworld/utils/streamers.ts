import type {
  PublicTwitchFollowedLolChannel,
} from "../../public-lol/types/public-lol";
import type { PublicLiveStreamerCard } from "../../../shared/PublicLiveStreamerRail";
import type { PalworldLocale } from "../i18n/palworld-i18n";

function safeTwitchChannelUrl(channel: PublicTwitchFollowedLolChannel): string | undefined {
  if (channel.channelUrl) {
    try {
      const parsed = new URL(channel.channelUrl);
      if (
        parsed.protocol === "https:"
        && (parsed.hostname === "twitch.tv" || parsed.hostname === "www.twitch.tv")
        && !parsed.username
        && !parsed.password
      ) return parsed.toString();
    } catch {
      // 검증에 실패한 API URL은 Twitch login 기반 주소로 대체합니다.
    }
  }
  return /^[a-z0-9_]{1,25}$/iu.test(channel.twitchLogin)
    ? `https://www.twitch.tv/${channel.twitchLogin}`
    : undefined;
}

export function uniqueFollowedTwitchChannels(
  channels: readonly PublicTwitchFollowedLolChannel[],
): PublicTwitchFollowedLolChannel[] {
  const unique = new Map<string, PublicTwitchFollowedLolChannel>();
  for (const channel of channels) {
    const id = channel.twitchUserId.trim();
    if (!id || unique.has(id)) continue;
    unique.set(id, channel);
  }
  return [...unique.values()];
}

export function sortedFollowedTwitchChannels(
  channels: readonly PublicTwitchFollowedLolChannel[],
): PublicTwitchFollowedLolChannel[] {
  return uniqueFollowedTwitchChannels(channels).sort((left, right) => {
    if (left.isLive !== right.isLive) return left.isLive ? -1 : 1;
    return left.twitchDisplayName.localeCompare(right.twitchDisplayName);
  });
}

export function palworldHomeLiveStreamerCards(
  channels: readonly PublicTwitchFollowedLolChannel[],
  locale: PalworldLocale,
): PublicLiveStreamerCard[] {
  const numberFormat = new Intl.NumberFormat(locale === "ja" ? "ja-JP" : "ko-KR");
  return uniqueFollowedTwitchChannels(channels)
    .filter((channel) => channel.isLive)
    .slice(0, 12)
    .map((channel) => {
      const viewerText = channel.viewerCount === undefined
        ? undefined
        : locale === "ja"
          ? `${numberFormat.format(channel.viewerCount)}人視聴`
          : `${numberFormat.format(channel.viewerCount)}명 시청`;
      const secondaryMeta = [channel.title, viewerText].filter(Boolean).join(" · ");
      return {
        id: channel.twitchUserId,
        name: channel.twitchDisplayName,
        login: channel.twitchLogin,
        primaryMeta: channel.gameName,
        secondaryMeta: secondaryMeta || undefined,
        avatarLabel: channel.twitchDisplayName.slice(0, 1).toUpperCase() || "T",
        avatarUrl: channel.profileImageUrl,
        channelUrl: safeTwitchChannelUrl(channel),
        statusLabel: "LIVE",
      };
    });
}

export function twitchChannelUrl(channel: PublicTwitchFollowedLolChannel): string | undefined {
  return safeTwitchChannelUrl(channel);
}

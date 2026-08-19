import type { StreamerPlatform } from "../types/streamer-post";

/* 프로필 이미지 규칙 — docs/mockups/streamer-board 의 "프로필 이미지" 메모.
 *
 * Twitch 는 채널 프로필 사진을 가져올 수 있습니다(서버가 Helix 로 받아 캐시).
 * 치지직·YouTube 는 연동이 없어 플랫폼 마크를 그 자리에 넣습니다. 사진이 아직
 * 없거나 불러오지 못한 Twitch 글도 같은 규칙으로 마크가 아니라 사람 실루엣으로
 * 닫습니다 — 빈 원을 남기지 않습니다.
 */
export function StreamerAvatar({
  platform,
  profileImageUrl,
  size = 56,
  streamerName,
}: {
  platform: StreamerPlatform;
  profileImageUrl?: string;
  size?: number;
  streamerName: string;
}) {
  const style = { "--streamer-avatar-size": `${size}px` } as React.CSSProperties;

  if (platform === "twitch" && profileImageUrl) {
    return (
      <img
        alt={streamerName}
        className="streamers-avatar"
        data-platform="twitch"
        height={size}
        loading="lazy"
        src={profileImageUrl}
        style={style}
        width={size}
      />
    );
  }

  return (
    <span aria-hidden="true" className="streamers-avatar" data-platform={platform} style={style}>
      {platform === "twitch" ? (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24">
          <circle cx="12" cy="8.6" r="3.7" />
          <path d="M4.8 20c0-3.8 3.2-6 7.2-6s7.2 2.2 7.2 6" />
        </svg>
      ) : platform === "chzzk" ? (
        <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.1" viewBox="0 0 24 24">
          <path d="M7.5 9v6M12 6.5v11M16.5 9v6" />
        </svg>
      ) : (
        <svg fill="currentColor" viewBox="0 0 24 24">
          <path d="M9.5 7.8v8.4L16.6 12z" />
        </svg>
      )}
    </span>
  );
}

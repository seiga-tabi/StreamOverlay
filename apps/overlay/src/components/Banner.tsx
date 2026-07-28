import { useEffect, useState } from "react";
import type { OverlayBannerMessage } from "@streamops/shared";

const DEFAULT_BANNER_DURATION_MS = 4000;
const BANNER_COMPLETE_GRACE_MS = 300;

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isImageAlert(banner: OverlayBannerMessage): boolean {
  const kind = banner.eventKind ?? "custom";
  if (kind === "follow" || kind === "cheer" || kind === "subscription" || kind === "subscription_message") return true;
  return typeof banner.source === "string" && banner.source.includes("donation");
}

function alertMessageParts(message: string): { accent?: string; rest: string } {
  const sanIndex = message.indexOf("さん");
  if (sanIndex > 0) {
    return {
      accent: message.slice(0, sanIndex),
      rest: message.slice(sanIndex)
    };
  }
  const firstWord = message.match(/^([A-Za-z0-9_가-힣ぁ-んァ-ヶ一-龯]+)(\s+.+)$/);
  if (firstWord?.[1] && firstWord[2]) {
    return {
      accent: firstWord[1],
      rest: firstWord[2]
    };
  }
  return { rest: message };
}

function bannerDurationMs(banner: OverlayBannerMessage): number {
  return banner.durationMs ?? DEFAULT_BANNER_DURATION_MS;
}

export function Banner({
  banner,
  onComplete
}: {
  banner: OverlayBannerMessage;
  onComplete?: (banner: OverlayBannerMessage) => void;
}) {
  const variant = banner.variant ?? "info";
  const eventKind = banner.eventKind ?? "custom";
  const imageAlert = isImageAlert(banner);
  const messageParts = imageAlert ? alertMessageParts(banner.message) : undefined;
  const mediaUrl = hasText(banner.mediaUrl) ? banner.mediaUrl : undefined;
  const soundUrl = hasText(banner.soundUrl) ? banner.soundUrl : undefined;
  const [mediaFailed, setMediaFailed] = useState(false);
  const [displayElapsed, setDisplayElapsed] = useState(false);

  useEffect(() => {
    setMediaFailed(false);
  }, [mediaUrl]);

  useEffect(() => {
    setDisplayElapsed(false);
    const timer = window.setTimeout(() => {
      setDisplayElapsed(true);
    }, bannerDurationMs(banner));
    return () => {
      window.clearTimeout(timer);
    };
  }, [banner]);

  useEffect(() => {
    if (!displayElapsed) return;
    const timer = window.setTimeout(() => {
      onComplete?.(banner);
    }, BANNER_COMPLETE_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [banner, displayElapsed, onComplete]);

  useEffect(() => {
    if (!soundUrl) return;
    const audio = new Audio(soundUrl);
    audio.volume = banner.soundVolume ?? 0.65;
    audio.play().catch(() => {
      // OBS/브라우저 정책으로 재생이 막힌 경우 화면은 계속 표시합니다.
    });
    return () => {
      audio.pause();
    };
  }, [banner.soundVolume, soundUrl]);

  return (
    <div className={`banner ${variant} event-${eventKind}${imageAlert ? " image-alert" : ""}`}>
      <div className="banner-hanok-line" aria-hidden="true" />
      {mediaUrl && !mediaFailed ? (
        <div className="banner-media" aria-hidden={!banner.mediaAlt}>
          <img src={mediaUrl} alt={banner.mediaAlt ?? ""} onError={() => setMediaFailed(true)} />
        </div>
      ) : (
        <div className="banner-mark" aria-hidden="true" />
      )}
      <div className="banner-copy">
        {banner.title ? <div className="banner-title">{banner.title}</div> : null}
        {banner.subtitle ? <div className="banner-subtitle">{banner.subtitle}</div> : null}
        <div className="banner-message">
          {messageParts?.accent ? <span className="banner-message-accent">{messageParts.accent}</span> : null}
          {messageParts?.accent ? messageParts.rest : banner.message}
        </div>
      </div>
    </div>
  );
}

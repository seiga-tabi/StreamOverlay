import { useEffect, useState } from "react";
import type { OverlayBannerMessage } from "@streamops/shared";

const activeSpeechAudios = new Set<HTMLAudioElement>();
const DEFAULT_BANNER_DURATION_MS = 4000;
const SPEECH_START_DELAY_MS = 250;
const SPEECH_COMPLETE_GRACE_MS = 300;
const SPEECH_START_FAILSAFE_MS = 3500;
const SPEECH_FAILSAFE_MS = 45_000;

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function speechContent(banner: OverlayBannerMessage): string | undefined {
  if (banner.speechEnabled !== true) return undefined;
  if (hasText(banner.speechText)) return banner.speechText.trim();
  const text = [banner.title, banner.message].filter(hasText).join("。");
  return hasText(text) ? text : undefined;
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
  const speechAudioUrl = hasText(banner.speechAudioUrl) ? banner.speechAudioUrl : undefined;
  const speechText = speechAudioUrl ? undefined : speechContent(banner);
  const hasSpeech = Boolean(speechAudioUrl || speechText);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [displayElapsed, setDisplayElapsed] = useState(false);
  const [speechFinished, setSpeechFinished] = useState(!hasSpeech);

  useEffect(() => {
    setMediaFailed(false);
  }, [mediaUrl]);

  useEffect(() => {
    setDisplayElapsed(false);
    setSpeechFinished(!hasSpeech);
    const timer = window.setTimeout(() => {
      setDisplayElapsed(true);
    }, bannerDurationMs(banner));
    return () => {
      window.clearTimeout(timer);
    };
  }, [banner, hasSpeech]);

  useEffect(() => {
    if (!displayElapsed || !speechFinished) return;
    const timer = window.setTimeout(() => {
      onComplete?.(banner);
    }, SPEECH_COMPLETE_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [banner, displayElapsed, onComplete, speechFinished]);

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

  useEffect(() => {
    if (!speechAudioUrl || typeof window === "undefined") return;
    const audio = new Audio(speechAudioUrl);
    audio.volume = banner.speechVolume ?? 0.9;
    let active = true;
    let released = false;
    let playbackStarted = false;
    let startFailSafeTimer: number | undefined;
    let failSafeTimer: number | undefined;
    const clearTimers = () => {
      if (startFailSafeTimer !== undefined) window.clearTimeout(startFailSafeTimer);
      if (failSafeTimer !== undefined) window.clearTimeout(failSafeTimer);
      startFailSafeTimer = undefined;
      failSafeTimer = undefined;
    };
    const markStarted = () => {
      playbackStarted = true;
      if (startFailSafeTimer !== undefined) {
        window.clearTimeout(startFailSafeTimer);
        startFailSafeTimer = undefined;
      }
    };
    const release = () => {
      if (released) return;
      released = true;
      clearTimers();
      activeSpeechAudios.delete(audio);
      if (active) setSpeechFinished(true);
    };
    const releaseIfNotStarted = () => {
      if (!playbackStarted) release();
    };
    audio.addEventListener("play", markStarted);
    audio.addEventListener("playing", markStarted);
    audio.addEventListener("ended", release);
    audio.addEventListener("error", release);
    const timer = window.setTimeout(() => {
      activeSpeechAudios.add(audio);
      startFailSafeTimer = window.setTimeout(releaseIfNotStarted, SPEECH_START_FAILSAFE_MS);
      failSafeTimer = window.setTimeout(release, SPEECH_FAILSAFE_MS);
      audio.play().then(markStarted).catch(() => {
        release();
        // 로컬 TTS 음성 재생이 막혀도 배너와 효과음은 계속 표시합니다.
      });
    }, SPEECH_START_DELAY_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
      clearTimers();
      audio.removeEventListener("play", markStarted);
      audio.removeEventListener("playing", markStarted);
      audio.removeEventListener("ended", release);
      audio.removeEventListener("error", release);
      audio.pause();
      activeSpeechAudios.delete(audio);
    };
  }, [banner.speechVolume, speechAudioUrl]);

  useEffect(() => {
    if (!speechText || typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) {
      setSpeechFinished(true);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speechText);
    let active = true;
    let started = false;
    let startFailSafeTimer: number | undefined;
    const failSafeTimer = window.setTimeout(() => {
      if (active) setSpeechFinished(true);
    }, SPEECH_FAILSAFE_MS);
    const clearStartFailSafe = () => {
      if (startFailSafeTimer !== undefined) {
        window.clearTimeout(startFailSafeTimer);
        startFailSafeTimer = undefined;
      }
    };
    const finish = () => {
      clearStartFailSafe();
      window.clearTimeout(failSafeTimer);
      if (active) setSpeechFinished(true);
    };
    const handleStart = () => {
      started = true;
      clearStartFailSafe();
    };
    utterance.lang = banner.speechLanguage ?? "ja-JP";
    utterance.rate = banner.speechRate ?? 1;
    utterance.pitch = banner.speechPitch ?? 1;
    utterance.volume = banner.speechVolume ?? 0.9;
    utterance.onstart = handleStart;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    startFailSafeTimer = window.setTimeout(() => {
      if (!started) finish();
    }, SPEECH_START_FAILSAFE_MS);
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
    return () => {
      active = false;
      clearStartFailSafe();
      window.clearTimeout(failSafeTimer);
    };
  }, [banner.speechLanguage, banner.speechPitch, banner.speechRate, banner.speechVolume, speechText]);

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

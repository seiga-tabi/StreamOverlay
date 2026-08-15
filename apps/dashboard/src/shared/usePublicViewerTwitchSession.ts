import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PublicTwitchFollowedLolResponse,
  PublicTwitchViewerStatus,
} from "../features/public-lol/types/public-lol";
import {
  getPublicTwitchFollowedChannels,
  getPublicTwitchStatus,
  logoutPublicTwitch,
  peekPublicTwitchFollowedChannels,
  peekPublicTwitchStatus,
  publicTwitchLoginUrl,
} from "../features/public-twitch/api";
import { useViewerTwitchOAuthReturn } from "./useViewerTwitchOAuthReturn";

/* 뷰어 Twitch 세션의 단일 원본 훅 — 팰월드 페이지가 소유하던 배선을 그대로 옮겼습니다.
 *
 * 담당 범위: status 조회(중복 요청 병합·abort), 팔로우 채널 조회, OAuth 복귀 settling
 * (쿼리 정리 → 캐시 무효화 → 재조회 → 350ms 후 확정 재조회), 로그인 시작, 해제, 재시도.
 * 페이지는 이 훅의 반환값만 소비합니다 — 게임별로 다른 것은 팔로우 채널이 필요한
 * 화면 조건(needsFollowedChannels)과 로그인 복귀 경로(loginReturnTo)뿐입니다. */

const EMPTY_TWITCH_STATUS: PublicTwitchViewerStatus = {
  connected: false,
  configured: false,
  requiredScopes: [],
  missingScopes: [],
};

export function usePublicViewerTwitchSession({ loginReturnTo, needsFollowedChannels }: {
  /* 팔로우 채널 목록이 실제로 쓰이는 화면에서만 true — 불필요한 조회를 막습니다. */
  needsFollowedChannels: boolean;
  /* 뷰어 OAuth 로그인 후 돌아올 경로(게임별 allowlist 규칙은 호출부 소유). */
  loginReturnTo: () => string;
}) {
  const [twitchStatus, setTwitchStatus] = useState<PublicTwitchViewerStatus>(
    () => peekPublicTwitchStatus() ?? EMPTY_TWITCH_STATUS,
  );
  const [followedChannels, setFollowedChannels] = useState<PublicTwitchFollowedLolResponse | null>(
    () => peekPublicTwitchFollowedChannels() ?? null,
  );
  const [twitchStatusLoading, setTwitchStatusLoading] = useState(
    () => peekPublicTwitchStatus() === undefined,
  );
  const [followedLoading, setFollowedLoading] = useState(false);
  const [twitchStatusError, setTwitchStatusError] = useState(false);
  const [followedError, setFollowedError] = useState(false);
  const twitchStatusRef = useRef<PublicTwitchViewerStatus>(twitchStatus);
  const statusRequestRef = useRef<Promise<void> | null>(null);
  const statusAbortRef = useRef<AbortController | null>(null);
  const followedRequestRef = useRef<Promise<void> | null>(null);
  const followedAbortRef = useRef<AbortController | null>(null);
  const logoutInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const needsFollowedChannelsOnOAuthReturnRef = useRef(needsFollowedChannels);

  const refreshTwitchStatus = useCallback(async (force = false): Promise<void> => {
    if (logoutInFlightRef.current) return;
    if (statusRequestRef.current) return statusRequestRef.current;
    const controller = new AbortController();
    statusAbortRef.current?.abort();
    statusAbortRef.current = controller;
    setTwitchStatusLoading(true);
    setTwitchStatusError(false);
    const request = (async () => {
      try {
        const status = await getPublicTwitchStatus(controller.signal, { force });
        if (!mountedRef.current || controller.signal.aborted) return;
        twitchStatusRef.current = status;
        setTwitchStatus(status);
        if (!status.connected) {
          followedAbortRef.current?.abort();
          followedAbortRef.current = null;
          followedRequestRef.current = null;
          setFollowedChannels(null);
          setFollowedLoading(false);
          setFollowedError(false);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (mountedRef.current && !controller.signal.aborted) setTwitchStatusError(true);
      } finally {
        if (mountedRef.current && statusAbortRef.current === controller) setTwitchStatusLoading(false);
      }
    })();
    statusRequestRef.current = request;
    try {
      await request;
    } finally {
      if (statusRequestRef.current === request) statusRequestRef.current = null;
      if (statusAbortRef.current === controller) statusAbortRef.current = null;
    }
  }, []);

  const refreshFollowedChannels = useCallback(async (): Promise<void> => {
    if (logoutInFlightRef.current) return;
    if (!twitchStatusRef.current.connected) return;
    if (followedRequestRef.current) return followedRequestRef.current;
    const controller = new AbortController();
    followedAbortRef.current?.abort();
    followedAbortRef.current = controller;
    setFollowedLoading(true);
    setFollowedError(false);
    const request = (async () => {
      try {
        const followed = await getPublicTwitchFollowedChannels(controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        setFollowedChannels(followed);
        if (!followed.connected) {
          const disconnected = { ...twitchStatusRef.current, connected: false, user: undefined };
          twitchStatusRef.current = disconnected;
          setTwitchStatus(disconnected);
        }
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        if (mountedRef.current && !controller.signal.aborted) setFollowedError(true);
      } finally {
        if (mountedRef.current && followedAbortRef.current === controller) setFollowedLoading(false);
      }
    })();
    followedRequestRef.current = request;
    try {
      await request;
    } finally {
      if (followedRequestRef.current === request) followedRequestRef.current = null;
      if (followedAbortRef.current === controller) followedAbortRef.current = null;
    }
  }, []);

  /* OAuth 복귀 감지·마커 정리·초기/확정 재조회·settling 은 공용 헬퍼가 담당합니다.
     확정 단계(confirm)에서만 팔로우 채널을 이어 받습니다 — 원래 시퀀스 보존. */
  const { settling: twitchOAuthSettling } = useViewerTwitchOAuthReturn({
    refresh: async (force, confirm) => {
      await refreshTwitchStatus(force);
      if (
        confirm
        && needsFollowedChannelsOnOAuthReturnRef.current
        && twitchStatusRef.current.connected
      ) {
        await refreshFollowedChannels();
      }
    },
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      statusAbortRef.current?.abort();
      followedAbortRef.current?.abort();
      statusAbortRef.current = null;
      followedAbortRef.current = null;
      statusRequestRef.current = null;
      followedRequestRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!needsFollowedChannels) {
      followedAbortRef.current?.abort();
      followedAbortRef.current = null;
      followedRequestRef.current = null;
      setFollowedLoading(false);
      return;
    }
    if (twitchStatus.connected && !followedChannels && !followedError) void refreshFollowedChannels();
  }, [followedChannels, followedError, needsFollowedChannels, refreshFollowedChannels, twitchStatus.connected]);

  /* loginReturnTo 는 렌더마다 새 함수여도 무방 — ref 로 최신 것을 들고 클릭 시점에만 호출. */
  const loginReturnToRef = useRef(loginReturnTo);
  loginReturnToRef.current = loginReturnTo;
  const startTwitchLogin = useCallback(() => {
    window.location.href = publicTwitchLoginUrl(loginReturnToRef.current());
  }, []);

  const disconnectTwitch = useCallback(async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    try {
      statusAbortRef.current?.abort();
      followedAbortRef.current?.abort();
      statusRequestRef.current = null;
      followedRequestRef.current = null;
      await logoutPublicTwitch();
      if (!mountedRef.current) return;
      const disconnected = {
        connected: false,
        configured: twitchStatusRef.current.configured,
        requiredScopes: twitchStatusRef.current.requiredScopes,
        missingScopes: twitchStatusRef.current.requiredScopes,
      };
      twitchStatusRef.current = disconnected;
      setTwitchStatus(disconnected);
      setFollowedChannels(null);
      setTwitchStatusLoading(false);
      setFollowedLoading(false);
      setTwitchStatusError(false);
      setFollowedError(false);
    } catch {
      if (mountedRef.current) setTwitchStatusError(true);
    } finally {
      logoutInFlightRef.current = false;
    }
  }, []);

  const twitchLoading = twitchStatusLoading
    || (needsFollowedChannels && twitchStatus.connected && !followedChannels && !followedError)
    || followedLoading
    || twitchOAuthSettling;
  const twitchError = !twitchOAuthSettling && (twitchStatusError || followedError);
  const retryTwitch = useCallback(() => {
    if (twitchStatusError || !twitchStatusRef.current.connected) return refreshTwitchStatus();
    return refreshFollowedChannels();
  }, [refreshFollowedChannels, refreshTwitchStatus, twitchStatusError]);

  return {
    disconnectTwitch,
    followedChannels,
    retryTwitch,
    startTwitchLogin,
    twitchError,
    twitchLoading,
    twitchStatus,
  };
}

import { useCallback, useEffect, useState } from "react";
import {
  getPublicTwitchStatus,
  invalidatePublicTwitchClientCache,
  logoutPublicTwitch,
} from "../../public-twitch/api";
import type { PublicTwitchViewerStatus } from "../../public-lol/types/public-lol";

/* 공개 페이지에는 로그인 상태가 두 가지입니다 — YORO 계정 세션과 공개 Twitch
 * 뷰어 세션. LoL 화면은 둘을 합쳐서 보는데(PublicAppHeader), 이 섹션이 계정
 * 세션만 보면 LoL 쪽에서 로그인한 사람이 "로그인이 필요합니다" 를 만납니다.
 * 그래서 뷰어 세션도 함께 읽어 usePublicAccountLogin 에 넘깁니다.
 */
export function usePublicViewerTwitch() {
  const [status, setStatus] = useState<PublicTwitchViewerStatus>({
    configured: false,
    connected: false,
    requiredScopes: [],
    missingScopes: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await getPublicTwitchStatus(controller.signal);
        if (!controller.signal.aborted) setStatus(next);
      } catch {
        /* 공개 Twitch subsystem 이 꺼진 배포에서는 계정 세션만으로 판단합니다. */
      }
    })();
    return () => controller.abort();
  }, []);

  const disconnect = useCallback(() => {
    void (async () => {
      try {
        await logoutPublicTwitch();
      } catch {
        /* 실패하면 연결 표시를 유지해 다시 시도할 수 있게 합니다. */
      }
      invalidatePublicTwitchClientCache();
      setStatus((previous) => ({ ...previous, connected: false }));
    })();
  }, []);

  return { status, disconnect };
}

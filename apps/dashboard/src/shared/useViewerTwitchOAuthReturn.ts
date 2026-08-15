import { useEffect, useRef, useState } from "react";
import { invalidatePublicTwitchClientCache } from "../features/public-twitch/api";
import { isTwitchAccountOAuthReturn } from "../features/yoro-account/api";
import { notifyPublicRouteChange } from "../features/public-lol/utils/public-locale-path";

/* 뷰어 Twitch OAuth 복귀 처리의 단일 원본 — 팰월드 세션 훅과 LoL 페이지가 공유합니다.
 *
 * 복귀 감지 시: 캐시 무효화 → 마커 쿼리 정리 → 초기 재조회 → 350ms 후 확정 재조회
 * (세션 쿠키 전파가 status 캐시보다 늦는 경합의 완충) → settling 해제.
 *
 * 마커 정리는 마운트 커밋이 끝난 뒤(timeout 0) 최신 URL 기준으로 합니다 — 같은 커밋의
 * locale·canonical 재작성 effect 가 이 훅보다 뒤에 등록되면 이전 쿼리 스냅샷으로
 * 마커를 되살리므로, 동기 제거는 effect 등록 순서에 따라 무효화됩니다. 제거 후에는
 * 라우트 변경을 알려 라우터의 파라미터 스냅샷도 함께 갱신합니다. */

export function isViewerTwitchOAuthReturn(search: string): boolean {
  return isTwitchAccountOAuthReturn(search)
    || new URLSearchParams(search).get("viewer_twitch") === "connected";
}

export function useViewerTwitchOAuthReturn({ refresh }: {
  /* force=복귀 여부, confirm=350ms 후 확정 재조회 단계 여부. 호출부가 소유한
     status·팔로우 로더를 감싸 넘깁니다(렌더마다 새 함수여도 무방 — ref 로 최신 유지). */
  refresh: (force: boolean, confirm: boolean) => Promise<void>;
}) {
  const returningRef = useRef(isViewerTwitchOAuthReturn(window.location.search));
  const [settling, setSettling] = useState(returningRef.current);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;
    let markerCleanupTimer: number | undefined;
    const returning = returningRef.current;
    if (returning) {
      invalidatePublicTwitchClientCache();
      markerCleanupTimer = window.setTimeout(() => {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("viewer_twitch") && !url.searchParams.has("account")) return;
        url.searchParams.delete("viewer_twitch");
        url.searchParams.delete("account");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
        notifyPublicRouteChange();
      }, 0);
    }
    void refreshRef.current(returning, false).finally(() => {
      if (returning && !disposed) {
        retryTimer = window.setTimeout(() => {
          void refreshRef.current(true, true).finally(() => {
            if (!disposed) setSettling(false);
          });
        }, 350);
      }
    });
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (markerCleanupTimer !== undefined) window.clearTimeout(markerCleanupTimer);
    };
  }, []);

  return { settling };
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { MinecraftCatalogMetadata, MinecraftCatalogResponse, MinecraftPagination } from "@streamops/shared";
import { MinecraftApiError } from "../api/minecraft";

export type MinecraftCatalogStatus =
  | "loading"
  | "ready"
  | "empty"
  | "data_unavailable"
  | "error";

type CatalogState<T> = {
  status: MinecraftCatalogStatus;
  entries: readonly T[];
  pagination: MinecraftPagination | null;
  metadata: MinecraftCatalogMetadata | null;
  loadMoreLoading: boolean;
  loadMoreError: boolean;
};

const INITIAL_STATE = {
  status: "loading" as const,
  entries: [] as never[],
  pagination: null,
  metadata: null,
  loadMoreLoading: false,
  loadMoreError: false,
};

/* 카탈로그 3화면이 공유하는 로딩·검색·누적 페이지네이션 상태.
 * fetcher 는 (page, signal) 로 한 페이지를 가져오며, queryKey 가 바뀌면 처음부터 다시 요청합니다. */
export function useMinecraftCatalog<T extends { id: string }>(
  fetcher: (page: number, signal: AbortSignal) => Promise<MinecraftCatalogResponse<T>>,
  queryKey: string,
) {
  const [state, setState] = useState<CatalogState<T>>(INITIAL_STATE);
  const [revision, setRevision] = useState(0);
  const requestIdRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setState({ ...INITIAL_STATE });
    void fetcher(1, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        if (response.state === "data_unavailable") {
          setState({ ...INITIAL_STATE, status: "data_unavailable" });
          return;
        }
        setState({
          status: response.items.length === 0 ? "empty" : "ready",
          entries: response.items,
          pagination: response.pagination,
          metadata: response.metadata,
          loadMoreLoading: false,
          loadMoreError: false,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted || requestIdRef.current !== requestId) return;
        setState({
          ...INITIAL_STATE,
          status: error instanceof MinecraftApiError && error.status === 503
            ? "data_unavailable"
            : "error",
        });
      });
    return () => {
      controller.abort();
      /* 진행 중인 loadMore 도 함께 중단 — 해제·queryKey 변경 후 응답이 남지 않게. */
      loadMoreControllerRef.current?.abort();
      loadMoreControllerRef.current = null;
    };
    /* deps 는 fetcher 대신 queryKey — fetcher 는 렌더마다 새 참조라 queryKey 가 입력을 대표합니다. */
  }, [queryKey, revision]);

  const loadMore = useCallback(async (): Promise<void> => {
    const current = stateRef.current;
    if (current.status !== "ready" || !current.pagination?.hasNextPage || current.loadMoreLoading) {
      return;
    }
    const requestId = requestIdRef.current;
    const nextPage = current.pagination.page + 1;
    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setState((previous) => ({ ...previous, loadMoreLoading: true, loadMoreError: false }));
    try {
      const response = await fetcher(nextPage, controller.signal);
      if (requestIdRef.current !== requestId || controller.signal.aborted) return;
      if (response.state !== "ready" || response.pagination.page !== nextPage) {
        setState((previous) => ({ ...previous, loadMoreLoading: false, loadMoreError: true }));
        return;
      }
      if (current.metadata && response.metadata.sourceRevision !== current.metadata.sourceRevision) {
        /* 배포로 데이터 세대가 바뀜 — 서로 다른 세대를 병합하지 않고 처음부터 다시 불러옵니다. */
        setRevision((value) => value + 1);
        return;
      }
      setState((previous) => {
        const known = new Set(previous.entries.map((entry) => entry.id));
        return {
          ...previous,
          entries: [...previous.entries, ...response.items.filter((entry) => !known.has(entry.id))],
          pagination: response.pagination,
          loadMoreLoading: false,
        };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestIdRef.current !== requestId) return;
      setState((previous) => ({ ...previous, loadMoreLoading: false, loadMoreError: true }));
    }
  }, [fetcher]);

  const retry = useCallback(() => setRevision((value) => value + 1), []);

  return { ...state, loadMore, retry };
}

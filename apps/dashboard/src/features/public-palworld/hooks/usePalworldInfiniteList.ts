import { useCallback, useEffect, useRef, useState } from "react";
import type { PalworldPagination } from "@streamops/shared";

type PalworldInfinitePage<T> = {
  items: T[];
  pagination: PalworldPagination;
  metadata?: unknown;
};

type UsePalworldInfiniteListOptions<T, TResponse extends PalworldInfinitePage<T>> = {
  enabled?: boolean;
  initialPage: string | number;
  itemKey: (item: T) => string;
  loadPage: (page: string | number, signal: AbortSignal) => Promise<TResponse>;
  queryKey: string;
};

type RuntimeMetadata = {
  gameVersion?: unknown;
  sourceChecksum?: unknown;
  sourceRevision?: unknown;
};

export class PalworldInfiniteListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PalworldInfiniteListError";
  }
}

function metadataFingerprint(response: PalworldInfinitePage<unknown>): string | undefined {
  if (!response.metadata || typeof response.metadata !== "object") return undefined;
  const metadata = response.metadata as RuntimeMetadata;
  if (typeof metadata.gameVersion !== "string" || typeof metadata.sourceRevision !== "string") {
    return undefined;
  }
  return JSON.stringify([
    metadata.gameVersion,
    metadata.sourceRevision,
    typeof metadata.sourceChecksum === "string" ? metadata.sourceChecksum : "",
  ]);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * 기존 page/limit API를 유지하면서 다음 페이지만 안전하게 누적한다.
 * queryKey 또는 시작 page가 바뀌면 이전 요청과 누적 결과를 함께 폐기한다.
 */
export function usePalworldInfiniteList<T, TResponse extends PalworldInfinitePage<T>>({
  enabled = true,
  initialPage,
  itemKey,
  loadPage,
  queryKey,
}: UsePalworldInfiniteListOptions<T, TResponse>) {
  const [response, setResponse] = useState<TResponse | null>(null);
  const [initialError, setInitialError] = useState<unknown>(null);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  const [initialLoading, setInitialLoading] = useState(enabled);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const responseRef = useRef<TResponse | null>(null);
  const loadPageRef = useRef(loadPage);
  const itemKeyRef = useRef(itemKey);
  const enabledRef = useRef(enabled);
  const generationRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const loadMoreInFlightRef = useRef(false);

  loadPageRef.current = loadPage;
  itemKeyRef.current = itemKey;
  enabledRef.current = enabled;

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    loadMoreInFlightRef.current = false;
    responseRef.current = null;
    setResponse(null);
    setInitialError(null);
    setLoadMoreError(null);
    setLoadMoreLoading(false);

    if (!enabled) {
      setInitialLoading(false);
      return () => controller.abort();
    }

    setInitialLoading(true);
    void loadPageRef.current(initialPage, controller.signal)
      .then((nextResponse) => {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        responseRef.current = nextResponse;
        setResponse(nextResponse);
        setInitialLoading(false);
      })
      .catch((error) => {
        if (controller.signal.aborted || generationRef.current !== generation || isAbortError(error)) return;
        setInitialError(error);
        setInitialLoading(false);
      });

    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [enabled, initialPage, queryKey, revision]);

  const loadMore = useCallback(async (): Promise<void> => {
    const current = responseRef.current;
    if (
      !enabledRef.current
      || !current
      || !current.pagination.hasNextPage
      || loadMoreInFlightRef.current
    ) {
      return;
    }

    const requestedPage = current.pagination.page + 1;
    const generation = generationRef.current;
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = controller;
    loadMoreInFlightRef.current = true;
    setLoadMoreError(null);
    setLoadMoreLoading(true);

    try {
      const nextResponse = await loadPageRef.current(requestedPage, controller.signal);
      if (controller.signal.aborted || generationRef.current !== generation) return;
      if (nextResponse.pagination.page !== requestedPage) {
        throw new PalworldInfiniteListError("요청한 다음 페이지와 응답 페이지가 일치하지 않습니다.");
      }
      if (
        nextResponse.pagination.total !== current.pagination.total
        || nextResponse.pagination.pageSize !== current.pagination.pageSize
      ) {
        throw new PalworldInfiniteListError("목록을 불러오는 동안 페이지 기준이 변경되었습니다.");
      }
      const currentFingerprint = metadataFingerprint(current);
      const nextFingerprint = metadataFingerprint(nextResponse);
      if (currentFingerprint && nextFingerprint && currentFingerprint !== nextFingerprint) {
        throw new PalworldInfiniteListError("서로 다른 Palworld 데이터 버전의 목록은 합칠 수 없습니다.");
      }

      const knownIds = new Set(current.items.map((item) => itemKeyRef.current(item)));
      for (const item of nextResponse.items) {
        const id = itemKeyRef.current(item);
        if (knownIds.has(id)) {
          throw new PalworldInfiniteListError("페이지 경계에서 중복된 목록 항목이 확인되었습니다.");
        }
        knownIds.add(id);
      }

      const merged = {
        ...current,
        ...nextResponse,
        items: [...current.items, ...nextResponse.items],
        pagination: nextResponse.pagination,
      } as TResponse;
      responseRef.current = merged;
      setResponse(merged);
    } catch (error) {
      if (controller.signal.aborted || generationRef.current !== generation || isAbortError(error)) return;
      setLoadMoreError(error);
    } finally {
      if (generationRef.current === generation && !controller.signal.aborted) {
        loadMoreInFlightRef.current = false;
        setLoadMoreLoading(false);
      }
    }
  }, []);

  return {
    initialError,
    initialLoading,
    loadMore,
    loadMoreError,
    loadMoreLoading,
    response,
    retryInitial: () => setRevision((value) => value + 1),
    retryLoadMore: loadMore,
  };
}

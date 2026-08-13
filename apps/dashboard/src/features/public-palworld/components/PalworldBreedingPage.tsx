import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PalworldBreedingPair,
  PalworldBreedingPartnersResponse,
  PalworldBreedingParentsResponse,
  PalworldBreedingResultResponse,
  PalworldBreedingGender,
  PalworldBreedingPairType,
  PalworldPalReference,
  PalworldPalSummary,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import {
  getPalworldBreeding,
  getPalworldBreedingPartners,
  getPalworldBreedingParents,
  getPalworldPal,
  PalworldApiError,
} from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import {
  breedingPairGendersForParents,
  clearPalworldBreedingParams,
  palworldBreedingParams,
  parsePalworldBreedingQuery,
  samePalworldBreedingPalId,
  swapBreedingParents,
  type PalworldBreedingQueryState,
} from "../utils/breeding";
import { resolvePalworldName } from "../utils/localization";
import { palworldUrl, setPalworldUrl } from "../utils/routes";
import { PalworldInfiniteListError, usePalworldInfiniteList } from "../hooks/usePalworldInfiniteList";
import { BreedingGenderControls } from "./PalworldBreedingControls";
import {
  BreedingCombinationList,
  BreedingCombinationListSkeleton,
  BreedingEmptyGuide,
  BreedingGenderAlternativeCard,
  BreedingRequestStatus,
  DirectBreedingResult,
  ReverseBreedingTargetSummary,
} from "./PalworldBreedingResults";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldPalPicker } from "./PalworldPalPicker";
import { PalworldAutoLoadControl } from "./PalworldAutoLoadControl";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";
import { formatPalNumber } from "../utils/search";

type PickerPal = PalworldPalReference | PalworldPalSummary;
type RequestStatus = "idle" | "loading" | "success" | "empty" | "error" | "data_unavailable" | "requires_gender";
type RequestState<T> = { status: RequestStatus; data: T | null; error: unknown | null };
type DirectResponse = PalworldBreedingResultResponse;
type ReverseResponse = PalworldBreedingParentsResponse;
type CopyFeedback = "success" | "error" | null;

const IDLE_REQUEST = { status: "idle", data: null, error: null } as const;

function unavailableError(error: unknown): boolean {
  return error instanceof PalworldApiError
    && (error.status === 503 || error.code === "PALWORLD_DATA_UNAVAILABLE");
}

function formatCountMessage(template: string, count: number): string {
  return template.replace("{count}", count.toLocaleString());
}

export function PalworldBreedingPage({
  locale,
  onOpenPal,
  params,
}: {
  locale: PalworldLocale;
  onOpenPal: (id: string) => void;
  params: URLSearchParams;
}) {
  const paramsKey = params.toString();
  const parsedQuery = useMemo(() => parsePalworldBreedingQuery(new URLSearchParams(paramsKey)), [paramsKey]);
  const query = parsedQuery.state;
  const [parentA, setParentA] = useState<PickerPal | null>(null);
  const [parentB, setParentB] = useState<PickerPal | null>(null);
  const [target, setTarget] = useState<PickerPal | null>(null);
  const [direct, setDirect] = useState<RequestState<DirectResponse>>(IDLE_REQUEST);
  const [reverse, setReverse] = useState<RequestState<ReverseResponse>>(IDLE_REQUEST);
  const [genderExpanded, setGenderExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null);
  const [directRevision, setDirectRevision] = useState(0);
  const [reverseRevision, setReverseRevision] = useState(0);
  const [reverseLoadMoreError, setReverseLoadMoreError] = useState<unknown>(null);
  const [reverseLoadMoreLoading, setReverseLoadMoreLoading] = useState(false);
  const [reverseRetryBlocked, setReverseRetryBlocked] = useState(false);
  const paramsKeyRef = useRef(paramsKey);
  const queryRef = useRef(query);
  const directRequestIdRef = useRef(0);
  const reverseRequestIdRef = useRef(0);
  const referenceRequestIdRef = useRef(0);
  const reverseLoadMoreControllerRef = useRef<AbortController | null>(null);
  const reverseLoadMoreInFlightRef = useRef(false);
  const reverseRetryBlockedRef = useRef(false);
  const reverseRetryTimerRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const text = palworldI18n[locale];
  const detailModalOpen = Boolean(params.get("pal") || params.get("item") || params.get("skill"));
  const bothParents = parsedQuery.ok && Boolean(query.parentA && query.parentB);
  const boardEmpty = parsedQuery.ok && !query.parentA && !query.parentB && !query.child;
  const singleParentId = parsedQuery.ok && !query.child
    ? query.parentA && !query.parentB
      ? query.parentA
      : query.parentB && !query.parentA
        ? query.parentB
        : undefined
    : undefined;
  const narrowParentId = parsedQuery.ok && query.child
    ? query.parentA ?? query.parentB
    : undefined;
  const loadPartnerPage = useCallback((page: string | number, signal: AbortSignal) => {
    if (!singleParentId) {
      return Promise.reject(new TypeError("선택한 부모 Pal이 없습니다."));
    }
    return getPalworldBreedingPartners(singleParentId, Number(page), 12, signal);
  }, [singleParentId]);
  const {
    initialError: partnerInitialError,
    initialLoading: partnerInitialLoading,
    loadMore: loadMorePartners,
    loadMoreError: partnerLoadMoreError,
    loadMoreLoading: partnerLoadMoreLoading,
    loadMoreRetryBlocked: partnerLoadMoreRetryBlocked,
    response: partnerResponse,
    retryInitial: retryPartners,
    retryLoadMore: retryLoadMorePartners,
  } = usePalworldInfiniteList<PalworldBreedingPair, PalworldBreedingPartnersResponse>({
    enabled: singleParentId !== undefined,
    initialPage: 1,
    itemKey: (pair) => pair.id,
    loadPage: loadPartnerPage,
    paused: detailModalOpen,
    queryKey: `breeding-partners:${singleParentId ?? "none"}`,
  });
  const currentPartnerResponse = samePalworldBreedingPalId(
    partnerResponse?.parent.id,
    singleParentId,
  )
    ? partnerResponse
    : null;
  paramsKeyRef.current = paramsKey;
  queryRef.current = query;

  const navigate = useCallback((next: PalworldBreedingQueryState, replace = false) => {
    const nextParams = palworldBreedingParams(new URLSearchParams(paramsKeyRef.current), next);
    setPalworldUrl(palworldUrl("breeding", nextParams), replace);
  }, []);

  /* 이전 형식(mode=…) 링크는 같은 슬롯 상태의 표준 URL로 바꿔 공유 호환을 유지합니다. */
  useEffect(() => {
    if (parsedQuery.ok && parsedQuery.legacy) navigate(parsedQuery.state, true);
  }, [navigate, parsedQuery]);

  useEffect(() => {
    if (!parsedQuery.ok) {
      setParentA(null);
      setParentB(null);
      setTarget(null);
      setDirect(IDLE_REQUEST);
      setReverse(IDLE_REQUEST);
      reverseLoadMoreControllerRef.current?.abort();
      reverseLoadMoreInFlightRef.current = false;
      setReverseLoadMoreError(null);
      setReverseLoadMoreLoading(false);
      reverseRetryBlockedRef.current = false;
      setReverseRetryBlocked(false);
      setGenderExpanded(false);
      return;
    }
    setParentA((current) => samePalworldBreedingPalId(current?.id, query.parentA) ? current : null);
    setParentB((current) => samePalworldBreedingPalId(current?.id, query.parentB) ? current : null);
    setTarget((current) => samePalworldBreedingPalId(current?.id, query.child) ? current : null);
    if (!query.parentA || !query.parentB) {
      setDirect(IDLE_REQUEST);
      setGenderExpanded(false);
    }
    if (!query.child) {
      setReverse(IDLE_REQUEST);
      reverseLoadMoreControllerRef.current?.abort();
      reverseLoadMoreInFlightRef.current = false;
      setReverseLoadMoreError(null);
      setReverseLoadMoreLoading(false);
      reverseRetryBlockedRef.current = false;
      setReverseRetryBlocked(false);
    }
    setCopyFeedback(null);
  }, [paramsKey, parsedQuery.ok, query.child, query.parentA, query.parentB]);

  useEffect(() => {
    if (!parsedQuery.ok) return undefined;
    const controller = new AbortController();
    const requestId = ++referenceRequestIdRef.current;
    const hydrate = (
      id: string | undefined,
      currentId: string | undefined,
      setter: (pal: PalworldPalReference) => void,
    ): void => {
      if (!id || samePalworldBreedingPalId(id, currentId)) return;
      void getPalworldPal(id, controller.signal)
        .then((pal) => {
          if (controller.signal.aborted || referenceRequestIdRef.current !== requestId) return;
          setter(pal);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
        });
    };
    hydrate(query.parentA, parentA?.id, setParentA);
    hydrate(query.parentB, parentB?.id, setParentB);
    hydrate(query.child, target?.id, setTarget);
    return () => controller.abort();
  }, [
    parentA?.id,
    parentB?.id,
    parsedQuery.ok,
    query.child,
    query.parentA,
    query.parentB,
    target?.id,
  ]);

  useEffect(() => {
    if (!parsedQuery.ok || !query.parentA || !query.parentB) {
      setDirect(IDLE_REQUEST);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++directRequestIdRef.current;
    setDirect({ status: "loading", data: null, error: null });
    void getPalworldBreeding(query.parentA, query.parentB, {
      parentAGender: query.parentAGender,
      parentBGender: query.parentBGender,
    }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || directRequestIdRef.current !== requestId) return;
        setParentA(response.parentA);
        setParentB(response.parentB);
        if (response.state === "data_unavailable") {
          setDirect({ status: "data_unavailable", data: response, error: null });
        } else if (response.state === "requires_gender") {
          setDirect({ status: "requires_gender", data: response, error: null });
        } else if (response.state === "not_found" || !response.result) {
          setDirect({ status: "empty", data: response, error: null });
        } else {
          setDirect({ status: "success", data: response, error: null });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted || directRequestIdRef.current !== requestId) return;
        setDirect({
          status: unavailableError(error) ? "data_unavailable" : "error",
          data: null,
          error,
        });
      });
    return () => controller.abort();
  }, [
    directRevision,
    parsedQuery.ok,
    query.parentA,
    query.parentAGender,
    query.parentB,
    query.parentBGender,
  ]);

  useEffect(() => {
    if (!parsedQuery.ok || !query.child) {
      setReverse(IDLE_REQUEST);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++reverseRequestIdRef.current;
    reverseLoadMoreControllerRef.current?.abort();
    reverseLoadMoreControllerRef.current = null;
    reverseLoadMoreInFlightRef.current = false;
    setReverseLoadMoreError(null);
    setReverseLoadMoreLoading(false);
    reverseRetryBlockedRef.current = false;
    setReverseRetryBlocked(false);
    setReverse({ status: "loading", data: null, error: null });
    void getPalworldBreedingParents(query.child, query.page, 12, controller.signal, query.type ?? "all", narrowParentId)
      .then((response) => {
        if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
        setTarget(response.child);
        if (response.pagination.page !== query.page) {
          navigate({ ...queryRef.current, page: response.pagination.page }, true);
        }
        if (response.state === "data_unavailable") {
          setReverse({ status: "data_unavailable", data: response, error: null });
        } else if (response.state === "not_found" || response.items.length === 0) {
          setReverse({ status: "empty", data: response, error: null });
        } else {
          setReverse({ status: "success", data: response, error: null });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
        setReverse({
          status: unavailableError(error) ? "data_unavailable" : "error",
          data: null,
          error,
        });
      });
    return () => {
      controller.abort();
      reverseLoadMoreControllerRef.current?.abort();
    };
  }, [narrowParentId, navigate, parsedQuery.ok, query.child, query.page, query.type, reverseRevision]);

  useEffect(() => {
    if (!detailModalOpen) return;
    reverseLoadMoreControllerRef.current?.abort();
    reverseLoadMoreControllerRef.current = null;
    reverseLoadMoreInFlightRef.current = false;
    setReverseLoadMoreLoading(false);
  }, [detailModalOpen]);

  useEffect(() => () => {
    if (reverseRetryTimerRef.current !== null) window.clearTimeout(reverseRetryTimerRef.current);
  }, []);

  useEffect(() => {
    if (
      bothParents
      && (query.parentAGender !== undefined
        || query.parentBGender !== undefined
        || direct.status === "requires_gender")
    ) {
      setGenderExpanded(true);
    }
  }, [bothParents, direct.status, query.parentAGender, query.parentBGender]);

  useEffect(() => {
    if (!copyFeedback) return undefined;
    const timeout = window.setTimeout(() => setCopyFeedback(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  function resetAll(): void {
    setParentA(null);
    setParentB(null);
    setTarget(null);
    setDirect(IDLE_REQUEST);
    setReverse(IDLE_REQUEST);
    setGenderExpanded(false);
    setCopyFeedback(null);
    const nextParams = clearPalworldBreedingParams(new URLSearchParams(paramsKey));
    setPalworldUrl(palworldUrl("breeding", nextParams));
  }

  function changeParent(position: "parentA" | "parentB", pal: PickerPal | null): void {
    if (!parsedQuery.ok) return;
    if (position === "parentA") setParentA(pal);
    else setParentB(pal);
    const next: PalworldBreedingQueryState = {
      ...query,
      [position]: pal?.id,
      ...(position === "parentA" && !pal ? { parentAGender: undefined } : {}),
      ...(position === "parentB" && !pal ? { parentBGender: undefined } : {}),
      page: 1,
    };
    /* 부모 두 마리가 채워지면 결과 슬롯은 계산 결과 자리가 되므로 목표 지정을 비웁니다. */
    if (next.parentA && next.parentB && next.child) {
      next.child = undefined;
      next.type = undefined;
      setTarget(null);
    }
    navigate(next);
  }

  function changeChild(pal: PickerPal | null): void {
    if (!parsedQuery.ok) return;
    setTarget(pal);
    const next: PalworldBreedingQueryState = {
      ...query,
      child: pal?.id,
      ...(pal ? {} : { type: undefined }),
      page: 1,
    };
    if (next.child && next.parentA && next.parentB) {
      next.parentB = undefined;
      next.parentBGender = undefined;
      setParentB(null);
    }
    navigate(next);
  }

  function changeGender(position: "parentAGender" | "parentBGender", value: string): void {
    if (!bothParents) return;
    navigate({
      ...query,
      [position]: value === "any" ? undefined : value as PalworldBreedingGender,
    });
  }

  /* 결과 행의 조합을 보드에 채워 direct 계산으로 이어갑니다. 성별 조건이 명시된 조합은 조건까지 복원합니다. */
  function usePairOnBoard(pair: PalworldBreedingPair): void {
    if (!parsedQuery.ok) return;
    setParentA(pair.parentA);
    setParentB(pair.parentB);
    setTarget(null);
    const explicitGenders = pair.genderCondition
      && pair.genderCondition.parentA !== "any"
      && pair.genderCondition.parentB !== "any"
      ? { parentAGender: pair.genderCondition.parentA, parentBGender: pair.genderCondition.parentB }
      : {};
    navigate({
      parentA: pair.parentA.id,
      parentB: pair.parentB.id,
      ...explicitGenders,
      page: 1,
    });
    boardRef.current?.scrollIntoView({ block: "start" });
  }

  function applyGenderCondition(pair: PalworldBreedingPair): void {
    if (!parsedQuery.ok || !query.parentA || !query.parentB) return;
    const genders = breedingPairGendersForParents(pair, query.parentA, query.parentB);
    if (!genders) return;
    setGenderExpanded(true);
    navigate({ ...query, ...genders });
  }

  async function loadMoreReversePairs(): Promise<void> {
    const current = reverse.data;
    if (
      reverse.status !== "success"
      || !current
      || !current.pagination.hasNextPage
      || reverseLoadMoreInFlightRef.current
      || reverseRetryBlockedRef.current
      || detailModalOpen
      || !parsedQuery.ok
      || !query.child
    ) {
      return;
    }

    const requestedPage = current.pagination.page + 1;
    const requestId = reverseRequestIdRef.current;
    const controller = new AbortController();
    reverseLoadMoreControllerRef.current?.abort();
    reverseLoadMoreControllerRef.current = controller;
    reverseLoadMoreInFlightRef.current = true;
    setReverseLoadMoreError(null);
    setReverseLoadMoreLoading(true);

    try {
      const nextResponse = await getPalworldBreedingParents(
        query.child,
        requestedPage,
        12,
        controller.signal,
        query.type ?? "all",
        narrowParentId,
      );
      if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
      if (
        nextResponse.state !== current.state
        || nextResponse.child.id !== current.child.id
        || nextResponse.pagination.page !== requestedPage
        || nextResponse.pagination.total !== current.pagination.total
        || nextResponse.pagination.pageSize !== current.pagination.pageSize
        || nextResponse.metadata.gameVersion !== current.metadata.gameVersion
        || nextResponse.metadata.sourceRevision !== current.metadata.sourceRevision
      ) {
        throw new PalworldInfiniteListError("교배 조합의 다음 페이지 기준이 기존 결과와 일치하지 않습니다.");
      }
      const knownIds = new Set(current.items.map((pair) => pair.id));
      for (const pair of nextResponse.items) {
        if (knownIds.has(pair.id)) {
          throw new PalworldInfiniteListError("페이지 경계에서 중복된 교배 조합이 확인되었습니다.");
        }
        knownIds.add(pair.id);
      }
      setReverse({
        status: "success",
        data: {
          ...current,
          ...nextResponse,
          items: [...current.items, ...nextResponse.items],
          pagination: nextResponse.pagination,
        },
        error: null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
      setReverseLoadMoreError(error);
      if (error instanceof PalworldApiError && error.status === 429) {
        const delay = Math.min(60_000, Math.max(1_000, (error.retryAfterSeconds ?? 5) * 1_000));
        reverseRetryBlockedRef.current = true;
        setReverseRetryBlocked(true);
        if (reverseRetryTimerRef.current !== null) window.clearTimeout(reverseRetryTimerRef.current);
        reverseRetryTimerRef.current = window.setTimeout(() => {
          reverseRetryBlockedRef.current = false;
          setReverseRetryBlocked(false);
          reverseRetryTimerRef.current = null;
        }, delay);
      }
    } finally {
      if (reverseRequestIdRef.current === requestId && !controller.signal.aborted) {
        reverseLoadMoreInFlightRef.current = false;
        setReverseLoadMoreLoading(false);
      }
    }
  }

  async function copyCurrentLink(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) throw new TypeError("clipboard unavailable");
      const canonicalParams = palworldBreedingParams(new URLSearchParams(), query);
      const url = new URL(palworldUrl("breeding", canonicalParams), window.location.origin);
      await navigator.clipboard.writeText(url.toString());
      setCopyFeedback("success");
    } catch {
      setCopyFeedback("error");
    }
  }

  const directAnnouncement = direct.status === "loading"
    ? text.calculatingStatus
    : direct.status === "success"
      ? text.directResultStatus
      : direct.status === "requires_gender"
        ? text.genderSelectionStatus
        : direct.status === "empty"
          ? text.noDirectResultStatus
        : "";
  const reverseAnnouncement = reverse.status === "loading"
    ? text.calculatingStatus
    : reverse.status === "success" && reverse.data
      ? formatCountMessage(text.parentPairsStatus, reverse.data.pagination.total)
      : reverse.status === "empty"
        ? text.noParentPairsStatus
      : "";
  const partnerAnnouncement = partnerInitialLoading
    ? text.calculatingStatus
    : currentPartnerResponse?.state === "resolved"
      ? formatCountMessage(text.partnerPairsStatus, currentPartnerResponse.pagination.total)
      : currentPartnerResponse?.state === "not_found"
        ? text.noParentPairsStatus
        : "";
  const directLoading = direct.status === "loading";
  const reverseLoading = reverse.status === "loading";
  const directResultPair = direct.status === "success" ? direct.data?.result ?? null : null;
  const narrowParentName = narrowParentId
    ? (() => {
      const pal = samePalworldBreedingPalId(parentA?.id, narrowParentId)
        ? parentA
        : samePalworldBreedingPalId(parentB?.id, narrowParentId)
          ? parentB
          : null;
      return pal ? resolvePalworldName(pal, locale).text : narrowParentId;
    })()
    : undefined;

  const childSlot = bothParents
    ? <div className="palworld-picker" data-testid="breeding-target">
      <span className="palworld-picker-label">{text.resultPal}</span>
      {directResultPair
        ? <div className="palworld-selected-pal is-computed">
          <button
            className="palworld-selected-pal-button"
            type="button"
            aria-label={`${text.resultPalDetails}: ${resolvePalworldName(directResultPair.child, locale).text}`}
            onClick={() => onOpenPal(directResultPair.child.id)}
          >
            <span className="palworld-selected-media">
              <PalworldMedia kind="pal" imageUrl={directResultPair.child.imageUrl} alt={resolvePalworldName(directResultPair.child, locale).text} locale={locale} />
            </span>
            <span>
              <strong>{resolvePalworldName(directResultPair.child, locale).text}</strong>
              <small>{formatPalNumber(directResultPair.child.number, locale)}</small>
            </span>
          </button>
          <Badge className="palworld-breeding-auto-tag" size="sm" tone="success">{text.computedResultBadge}</Badge>
        </div>
        : <p className="palworld-breeding-input-hint" role="status">
          {direct.status === "requires_gender"
            ? text.genderRequired
            : direct.status === "empty"
              ? text.noBreedingResult
              : direct.status === "error" || direct.status === "data_unavailable"
                ? text.breedingDataUnavailable
                : text.calculatingStatus}
        </p>}
    </div>
    : <PalworldPalPicker
      label={text.targetPal}
      locale={locale}
      selected={target}
      onChange={changeChild}
      onOpenPal={onOpenPal}
      testId="breeding-target"
    />;

  return <section aria-labelledby="palworld-breeding-title" className="palworld-page-section">
    <h1 className="yoro-u-sr-only" data-ko={palworldI18n.ko.breeding} data-ja={palworldI18n.ja.breeding} id="palworld-breeding-title">{text.breeding}</h1>
    {!parsedQuery.ok ? (
      <PalworldError
        description={text.invalidBreedingQueryDescription}
        descriptionJa={palworldI18n.ja.invalidBreedingQueryDescription}
        descriptionKo={palworldI18n.ko.invalidBreedingQueryDescription}
        locale={locale}
        onRetry={resetAll}
        title={text.invalidBreedingQuery}
        titleJa={palworldI18n.ja.invalidBreedingQuery}
        titleKo={palworldI18n.ko.invalidBreedingQuery}
      />
    ) : <>
      <div ref={boardRef}><Card className="palworld-breeding-input-card"><CardContent>
        <p className="palworld-breeding-input-hint">{text.autoCalculateHint}</p>
        <div className="palworld-breeding-pickers is-board">
          <PalworldPalPicker label={text.parentA} locale={locale} selected={parentA} onChange={(pal) => changeParent("parentA", pal)} onOpenPal={onOpenPal} testId="breeding-parent-a" />
          <span aria-hidden="true" className="palworld-breeding-eq">×</span>
          <PalworldPalPicker label={text.parentB} locale={locale} selected={parentB} onChange={(pal) => changeParent("parentB", pal)} onOpenPal={onOpenPal} testId="breeding-parent-b" />
          <span aria-hidden="true" className="palworld-breeding-eq">=</span>
          {childSlot}
        </div>
        {bothParents ? <BreedingGenderControls
          expanded={genderExpanded}
          locale={locale}
          onGender={changeGender}
          onToggle={() => setGenderExpanded((value) => !value)}
          parentAGender={query.parentAGender}
          parentBGender={query.parentBGender}
        /> : null}
        <div className="palworld-breeding-actions">
          <Button variant="secondary" aria-label={text.swapParents} data-testid="breeding-swap" disabled={!query.parentA && !query.parentB} onClick={() => {
            const [nextA, nextB] = swapBreedingParents(parentA, parentB);
            setParentA(nextA);
            setParentB(nextB);
            navigate({
              ...query,
              parentA: query.parentB,
              parentB: query.parentA,
              parentAGender: query.parentBGender,
              parentBGender: query.parentAGender,
            });
          }}><span aria-hidden="true">⇄</span> {text.swapParents}</Button>
          <Button variant="ghost" onClick={resetAll}>{text.reset}</Button>
        </div>
      </CardContent></Card></div>
      {!boardEmpty ? <div className="palworld-breeding-summary-bar" data-testid="breeding-summary-bar">
        <span className="palworld-breeding-summary-formula">
          {(parentA ? resolvePalworldName(parentA, locale).text : "?")
            + " × "
            + (parentB ? resolvePalworldName(parentB, locale).text : "?")
            + " = "
            + (directResultPair
              ? resolvePalworldName(directResultPair.child, locale).text
              : target ? resolvePalworldName(target, locale).text : "?")}
        </span>
        <Button size="sm" variant="secondary" onClick={() => boardRef.current?.scrollIntoView({ block: "start" })}>{text.editConditions}</Button>
      </div> : null}
      <section className="palworld-breeding-result" data-testid="breeding-result" aria-busy={directLoading || partnerInitialLoading || reverseLoading || reverseLoadMoreLoading}>
        <BreedingRequestStatus message={directAnnouncement} />
        <BreedingRequestStatus message={partnerAnnouncement} />
        <BreedingRequestStatus message={reverseAnnouncement} />
        <h2 className="yoro-u-sr-only">{text.breedingResult}</h2>
        {boardEmpty ? <BreedingEmptyGuide locale={locale} /> : null}
        {singleParentId ? <section className="palworld-breeding-result" data-testid="breeding-partner-results">
          <h3
            className="yoro-u-sr-only"
            data-ko={palworldI18n.ko.partnerPairSuggestions}
            data-ja={palworldI18n.ja.partnerPairSuggestions}
            id="palworld-breeding-partner-list-title"
          >
            {text.partnerPairSuggestions}
          </h3>
          {partnerInitialLoading ? <BreedingCombinationListSkeleton locale={locale} variant="partner-results" /> : null}
          {partnerInitialError ? <PalworldError error={partnerInitialError} locale={locale} onRetry={retryPartners} /> : null}
          {currentPartnerResponse?.state === "data_unavailable" ? <PalworldError
            description={text.breedingDataUnavailableDescription}
            descriptionJa={palworldI18n.ja.breedingDataUnavailableDescription}
            descriptionKo={palworldI18n.ko.breedingDataUnavailableDescription}
            locale={locale}
            onRetry={retryPartners}
            title={text.breedingDataUnavailable}
            titleJa={palworldI18n.ja.breedingDataUnavailable}
            titleKo={palworldI18n.ko.breedingDataUnavailable}
          /> : null}
          {currentPartnerResponse?.state === "not_found" ? <PalworldEmpty includeDefaultDescription={false} locale={locale} title={text.noPartnerPairs} /> : null}
          {currentPartnerResponse?.state === "resolved" && currentPartnerResponse.items.length ? <>
            <div
              aria-labelledby="palworld-breeding-partner-list-title"
              className="palworld-breeding-combination-scroll"
              data-testid="breeding-partner-scroll"
              role="region"
              tabIndex={0}
            >
              <BreedingCombinationList
                labelledBy="palworld-breeding-partner-list-title"
                loading={partnerLoadMoreLoading}
                locale={locale}
                onOpenPal={onOpenPal}
                onUsePair={usePairOnBoard}
                pairs={currentPartnerResponse.items}
                selectedParentId={singleParentId}
                total={currentPartnerResponse.pagination.total}
                variant="partner-results"
              />
              <PalworldAutoLoadControl
                error={partnerLoadMoreError}
                hasMore={currentPartnerResponse.pagination.hasNextPage}
                loadedCount={currentPartnerResponse.items.length}
                loading={partnerLoadMoreLoading}
                locale={locale}
                onLoadMore={() => { void loadMorePartners(); }}
                onRetry={() => { void retryLoadMorePartners(); }}
                paused={detailModalOpen}
                retryBlocked={partnerLoadMoreRetryBlocked}
                total={currentPartnerResponse.pagination.total}
              />
            </div>
          </> : null}
        </section> : null}
        {bothParents ? <>
          {directLoading ? <div className="palworld-breeding-result-skeleton"><PalworldLoading locale={locale} count={1} /></div> : null}
          {direct.status === "error" ? <PalworldError error={direct.error} locale={locale} onRetry={() => setDirectRevision((value) => value + 1)} /> : null}
          {direct.status === "data_unavailable" ? <PalworldError description={text.breedingDataUnavailableDescription} descriptionJa={palworldI18n.ja.breedingDataUnavailableDescription} descriptionKo={palworldI18n.ko.breedingDataUnavailableDescription} error={direct.error} locale={locale} onRetry={() => setDirectRevision((value) => value + 1)} title={text.breedingDataUnavailable} titleJa={palworldI18n.ja.breedingDataUnavailable} titleKo={palworldI18n.ko.breedingDataUnavailable} /> : null}
          {direct.status === "empty" ? <PalworldEmpty includeDefaultDescription={false} locale={locale} title={text.noBreedingResult} /> : null}
          {direct.status === "requires_gender" ? <>
            <div className="palworld-breeding-gender-notice"><strong>{text.genderRequired}</strong><p>{text.genderRequiredDescription}</p></div>
            {direct.data?.alternatives.length ? <div className="palworld-gender-alternative-list">{direct.data.alternatives.map((pair) => <BreedingGenderAlternativeCard pair={pair} locale={locale} onApply={applyGenderCondition} onOpenPal={onOpenPal} key={pair.id} />)}</div> : null}
          </> : null}
          {direct.status === "success" && direct.data?.result ? <DirectBreedingResult
            locale={locale}
            onCopy={() => { void copyCurrentLink(); }}
            onOpenPal={onOpenPal}
            onViewParents={(child) => navigate({ child, page: 1 })}
            pair={direct.data.result}
          /> : null}
          {copyFeedback ? <p className="palworld-copy-feedback" role={copyFeedback === "error" ? "alert" : "status"}>{copyFeedback === "success" ? text.linkCopied : text.linkCopyFailed}</p> : null}
        </> : null}
        {query.child ? <section className="palworld-breeding-result" data-testid="breeding-parent-results" aria-busy={reverseLoading || reverseLoadMoreLoading}>
          <div className="palworld-section-title">
            <h2 id="palworld-breeding-reverse-list-title">{text.childToParents}</h2>
            <label className="palworld-breeding-type-filter">
              <span>{text.breedingTypeFilter}</span>
              <select value={query.type ?? "all"} onChange={(event) => navigate({
                ...query,
                type: event.target.value === "all" ? undefined : event.target.value as PalworldBreedingPairType,
                page: 1,
              })}>
                <option value="all">{text.allBreedingTypes}</option>
                <option value="normal">{text.normalBreedingOnly}</option>
                <option value="special">{text.specialBreedingOnly}</option>
              </select>
            </label>
          </div>
          {narrowParentId ? <div className="palworld-breeding-gender-disclosure-heading" data-testid="breeding-narrow-note">
            <span className="palworld-picker-label" role="note">
              {text.narrowedNotice.replace("{parent}", narrowParentName ?? narrowParentId)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => navigate({
              child: query.child,
              type: query.type,
              page: 1,
            })}>{text.showAllPairs}</Button>
          </div> : null}
          {reverseLoading ? <BreedingCombinationListSkeleton locale={locale} variant="reverse-results" /> : null}
          {query.child && target ? <ReverseBreedingTargetSummary child={target} loadedCount={reverse.data?.items.length} locale={locale} onOpenPal={onOpenPal} pagination={reverse.data?.pagination} /> : null}
          {reverse.status === "error" ? <PalworldError error={reverse.error} locale={locale} onRetry={() => setReverseRevision((value) => value + 1)} /> : null}
          {reverse.status === "data_unavailable" ? <PalworldError description={text.breedingDataUnavailableDescription} descriptionJa={palworldI18n.ja.breedingDataUnavailableDescription} descriptionKo={palworldI18n.ko.breedingDataUnavailableDescription} error={reverse.error} locale={locale} onRetry={() => setReverseRevision((value) => value + 1)} title={text.breedingDataUnavailable} titleJa={palworldI18n.ja.breedingDataUnavailable} titleKo={palworldI18n.ko.breedingDataUnavailable} /> : null}
          {reverse.status === "empty" ? <PalworldEmpty includeDefaultDescription={false} locale={locale} title={text.noParentPairs} /> : null}
          {reverse.status === "success" && reverse.data?.items.length ? (
            <div
              aria-labelledby="palworld-breeding-reverse-list-title"
              className="palworld-breeding-combination-scroll"
              data-testid="breeding-reverse-scroll"
              role="region"
              tabIndex={0}
            >
              <BreedingCombinationList
                labelledBy="palworld-breeding-reverse-list-title"
                loading={reverseLoadMoreLoading}
                locale={locale}
                onOpenPal={onOpenPal}
                onUsePair={usePairOnBoard}
                pairs={reverse.data.items}
                total={reverse.data.pagination.total}
                variant="reverse-results"
              />
              <PalworldAutoLoadControl
                error={reverseLoadMoreError}
                hasMore={reverse.data.pagination.hasNextPage}
                loadedCount={reverse.data.items.length}
                loading={reverseLoadMoreLoading}
                locale={locale}
                onLoadMore={() => { void loadMoreReversePairs(); }}
                onRetry={() => { void loadMoreReversePairs(); }}
                paused={detailModalOpen}
                retryBlocked={reverseRetryBlocked}
                total={reverse.data.pagination.total}
              />
            </div>
          ) : null}
        </section> : null}
      </section>
    </>}
  </section>;
}

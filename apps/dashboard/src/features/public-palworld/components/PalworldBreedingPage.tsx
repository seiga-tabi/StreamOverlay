import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PalworldBreedingPair,
  PalworldBreedingParentsResponse,
  PalworldBreedingResultResponse,
  PalworldBreedingGender,
  PalworldBreedingPairType,
  PalworldPalReference,
  PalworldPalSummary,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent } from "../../../shared/ui/Card";
import {
  getPalworldBreeding,
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
  swapBreedingParents,
  type PalworldBreedingQueryState,
} from "../utils/breeding";
import { palworldUrl, setPalworldUrl } from "../utils/routes";
import { BreedingGenderControls, BreedingModeTabs } from "./PalworldBreedingControls";
import {
  BreedingGenderAlternativeCard,
  BreedingRequestStatus,
  DirectBreedingResult,
  ReverseBreedingPairCard,
  ReverseBreedingTargetSummary,
} from "./PalworldBreedingResults";
import { PalworldPalPicker } from "./PalworldPalPicker";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";
import { Pagination } from "./Pagination";

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
  const directRequestIdRef = useRef(0);
  const reverseRequestIdRef = useRef(0);
  const referenceRequestIdRef = useRef(0);
  const text = palworldI18n[locale];

  const navigate = useCallback((next: PalworldBreedingQueryState, replace = false) => {
    const nextParams = palworldBreedingParams(new URLSearchParams(paramsKey), next);
    setPalworldUrl(palworldUrl("breeding", nextParams), replace);
  }, [paramsKey]);

  useEffect(() => {
    if (!parsedQuery.ok) {
      setParentA(null);
      setParentB(null);
      setTarget(null);
      setDirect(IDLE_REQUEST);
      setReverse(IDLE_REQUEST);
      setGenderExpanded(false);
      return;
    }
    if (query.mode === "parents") {
      setParentA((current) => current?.id === query.parentA ? current : null);
      setParentB((current) => current?.id === query.parentB ? current : null);
      setTarget(null);
      setReverse(IDLE_REQUEST);
    } else {
      setTarget((current) => current?.id === query.child ? current : null);
      setParentA(null);
      setParentB(null);
      setDirect(IDLE_REQUEST);
      setGenderExpanded(false);
    }
    setCopyFeedback(null);
  }, [paramsKey, parsedQuery.ok, query.child, query.mode, query.parentA, query.parentB]);

  useEffect(() => {
    if (!parsedQuery.ok) return undefined;
    const controller = new AbortController();
    const requestId = ++referenceRequestIdRef.current;
    const hydrate = (
      id: string | undefined,
      currentId: string | undefined,
      setter: (pal: PalworldPalReference) => void,
    ): void => {
      if (!id || id === currentId) return;
      void getPalworldPal(id, controller.signal)
        .then((pal) => {
          if (controller.signal.aborted || referenceRequestIdRef.current !== requestId) return;
          setter(pal);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
        });
    };
    if (query.mode === "parents") {
      hydrate(query.parentA, parentA?.id, setParentA);
      hydrate(query.parentB, parentB?.id, setParentB);
    } else {
      hydrate(query.child, target?.id, setTarget);
    }
    return () => controller.abort();
  }, [
    parentA?.id,
    parentB?.id,
    parsedQuery.ok,
    query.child,
    query.mode,
    query.parentA,
    query.parentB,
    target?.id,
  ]);

  useEffect(() => {
    if (!parsedQuery.ok || query.mode !== "parents" || !query.parentA || !query.parentB) {
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
    query.mode,
    query.parentA,
    query.parentAGender,
    query.parentB,
    query.parentBGender,
  ]);

  useEffect(() => {
    if (!parsedQuery.ok || query.mode !== "child" || !query.child) {
      setReverse(IDLE_REQUEST);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++reverseRequestIdRef.current;
    setReverse({ status: "loading", data: null, error: null });
    void getPalworldBreedingParents(query.child, query.page, 12, controller.signal, query.type ?? "all")
      .then((response) => {
        if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
        setTarget(response.child);
        if (response.pagination.page !== query.page) {
          navigate({
            mode: "child",
            child: query.child,
            type: query.type,
            page: response.pagination.page,
          }, true);
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
    return () => controller.abort();
  }, [navigate, parsedQuery.ok, query.child, query.mode, query.page, query.type, reverseRevision]);

  useEffect(() => {
    if (
      query.mode === "parents"
      && (query.parentAGender !== undefined
        || query.parentBGender !== undefined
        || direct.status === "requires_gender")
    ) {
      setGenderExpanded(true);
    }
  }, [direct.status, query.mode, query.parentAGender, query.parentBGender]);

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

  function changeParent(position: "parentA" | "parentB", pal: PalworldPalSummary | null): void {
    const current = query.mode === "parents" ? query : { mode: "parents" as const, page: 1 };
    if (position === "parentA") setParentA(pal);
    else setParentB(pal);
    navigate({
      ...current,
      [position]: pal?.id,
      ...(position === "parentA" && !pal ? { parentAGender: undefined } : {}),
      ...(position === "parentB" && !pal ? { parentBGender: undefined } : {}),
    });
  }

  function changeGender(position: "parentAGender" | "parentBGender", value: string): void {
    if (query.mode !== "parents") return;
    navigate({
      ...query,
      [position]: value === "any" ? undefined : value as PalworldBreedingGender,
    });
  }

  function applyGenderCondition(pair: PalworldBreedingPair): void {
    if (query.mode !== "parents" || !query.parentA || !query.parentB) return;
    const genders = breedingPairGendersForParents(pair, query.parentA, query.parentB);
    if (!genders) return;
    setGenderExpanded(true);
    navigate({ ...query, ...genders });
  }

  function usePairInCalculator(pair: PalworldBreedingPair): void {
    const genders = breedingPairGendersForParents(pair, pair.parentA.id, pair.parentB.id);
    setParentA(pair.parentA);
    setParentB(pair.parentB);
    setTarget(null);
    setGenderExpanded(Boolean(genders));
    navigate({
      mode: "parents",
      parentA: pair.parentA.id,
      parentB: pair.parentB.id,
      ...genders,
      page: 1,
    });
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
  const directLoading = direct.status === "loading";
  const reverseLoading = reverse.status === "loading";

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">{text.breedingKicker}</span><h1 data-ko={palworldI18n.ko.breeding} data-ja={palworldI18n.ja.breeding}>{text.breeding}</h1><p data-ko={palworldI18n.ko.breedingDescription} data-ja={palworldI18n.ja.breedingDescription}>{text.breedingDescription}</p></div></header>
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
      <BreedingModeTabs locale={locale} mode={query.mode} onMode={(mode) => navigate({ mode, page: 1 })} />
      {query.mode === "parents"
        ? <div id="palworld-breeding-child-panel" role="tabpanel" aria-labelledby="palworld-breeding-child-tab" hidden />
        : <div id="palworld-breeding-parents-panel" role="tabpanel" aria-labelledby="palworld-breeding-parents-tab" hidden />}
      {query.mode === "parents" ? <div id="palworld-breeding-parents-panel" role="tabpanel" aria-labelledby="palworld-breeding-parents-tab">
        <Card className="palworld-breeding-input-card"><CardContent>
          <p className="palworld-breeding-input-hint">{text.autoCalculateHint}</p>
          <div className="palworld-breeding-pickers">
            <PalworldPalPicker label={text.parentA} locale={locale} selected={parentA} onChange={(pal) => changeParent("parentA", pal)} onOpenPal={onOpenPal} testId="breeding-parent-a" />
            <Button className="palworld-swap-button" variant="secondary" aria-label={text.swapParents} data-testid="breeding-swap" disabled={!query.parentA && !query.parentB} onClick={() => {
              const [nextA, nextB] = swapBreedingParents(parentA, parentB);
              setParentA(nextA);
              setParentB(nextB);
              navigate({
                mode: "parents",
                parentA: query.parentB,
                parentB: query.parentA,
                parentAGender: query.parentBGender,
                parentBGender: query.parentAGender,
                page: 1,
              });
            }}><span aria-hidden="true">⇄</span></Button>
            <PalworldPalPicker label={text.parentB} locale={locale} selected={parentB} onChange={(pal) => changeParent("parentB", pal)} onOpenPal={onOpenPal} testId="breeding-parent-b" />
          </div>
          {query.parentA && query.parentB ? <BreedingGenderControls
            expanded={genderExpanded}
            locale={locale}
            onGender={changeGender}
            onToggle={() => setGenderExpanded((value) => !value)}
            parentAGender={query.parentAGender}
            parentBGender={query.parentBGender}
          /> : null}
          <div className="palworld-breeding-actions"><Button variant="ghost" onClick={resetAll}>{text.reset}</Button></div>
        </CardContent></Card>
        <section className="palworld-breeding-result" data-testid="breeding-result" aria-busy={directLoading}>
          <BreedingRequestStatus message={directAnnouncement} />
          <div className="palworld-section-title"><h2>{text.breedingResult}</h2></div>
          {!query.parentA || !query.parentB ? <PalworldEmpty description={text.autoCalculateHint} includeDefaultDescription={false} locale={locale} title={text.selectBothParents} /> : null}
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
            onViewParents={(child) => navigate({ mode: "child", child, page: 1 })}
            pair={direct.data.result}
          /> : null}
          {copyFeedback ? <p className="palworld-copy-feedback" role={copyFeedback === "error" ? "alert" : "status"}>{copyFeedback === "success" ? text.linkCopied : text.linkCopyFailed}</p> : null}
        </section>
      </div> : <div id="palworld-breeding-child-panel" role="tabpanel" aria-labelledby="palworld-breeding-child-tab">
        <Card className="palworld-breeding-input-card"><CardContent>
          <div className="palworld-breeding-reverse-controls">
            {query.child ? <div className="palworld-breeding-target-change" data-testid="breeding-target">
              <span className="palworld-picker-label">{text.targetPalSummary}</span>
              <Button variant="secondary" onClick={() => {
                setTarget(null);
                navigate({ mode: "child", page: 1 });
              }}>{text.changeTargetPal}</Button>
            </div> : <PalworldPalPicker label={text.targetPal} locale={locale} selected={null} onChange={(pal) => {
              setTarget(pal);
              navigate({ mode: "child", child: pal?.id, page: 1 });
            }} onOpenPal={onOpenPal} testId="breeding-target" />}
            <label className="palworld-breeding-type-filter">
              <span>{text.breedingTypeFilter}</span>
              <select value={query.type ?? "all"} onChange={(event) => navigate({
                mode: "child",
                child: query.child,
                type: event.target.value as PalworldBreedingPairType,
                page: 1,
              })}>
                <option value="all">{text.allBreedingTypes}</option>
                <option value="normal">{text.normalBreedingOnly}</option>
                <option value="special">{text.specialBreedingOnly}</option>
              </select>
            </label>
          </div>
          <div className="palworld-breeding-actions"><Button variant="ghost" onClick={resetAll}>{text.reset}</Button></div>
        </CardContent></Card>
        <section className="palworld-breeding-result" data-testid="breeding-parent-results" aria-busy={reverseLoading}>
          <BreedingRequestStatus message={reverseAnnouncement} />
          <div className="palworld-section-title"><h2>{text.childToParents}</h2></div>
          {!query.child ? <PalworldEmpty includeDefaultDescription={false} locale={locale} title={text.selectTarget} /> : null}
          {reverseLoading ? <div className="palworld-breeding-result-skeleton"><PalworldLoading locale={locale} count={1} /></div> : null}
          {query.child && target ? <ReverseBreedingTargetSummary child={target} locale={locale} onOpenPal={onOpenPal} pagination={reverse.data?.pagination} /> : null}
          {reverse.status === "error" ? <PalworldError error={reverse.error} locale={locale} onRetry={() => setReverseRevision((value) => value + 1)} /> : null}
          {reverse.status === "data_unavailable" ? <PalworldError description={text.breedingDataUnavailableDescription} descriptionJa={palworldI18n.ja.breedingDataUnavailableDescription} descriptionKo={palworldI18n.ko.breedingDataUnavailableDescription} error={reverse.error} locale={locale} onRetry={() => setReverseRevision((value) => value + 1)} title={text.breedingDataUnavailable} titleJa={palworldI18n.ja.breedingDataUnavailable} titleKo={palworldI18n.ko.breedingDataUnavailable} /> : null}
          {reverse.status === "empty" ? <PalworldEmpty includeDefaultDescription={false} locale={locale} title={text.noParentPairs} /> : null}
          {reverse.status === "success" && reverse.data?.items.length ? <div className="palworld-parent-pair-list">{reverse.data.items.map((pair) => <ReverseBreedingPairCard pair={pair} locale={locale} onOpenPal={onOpenPal} onUsePair={usePairInCalculator} key={pair.id} />)}</div> : null}
          {reverse.status === "success" && reverse.data ? <Pagination locale={locale} pagination={reverse.data.pagination} onPage={(page) => navigate({ mode: "child", child: query.child, type: query.type, page })} /> : null}
        </section>
      </div>}
    </>}
  </section>;
}

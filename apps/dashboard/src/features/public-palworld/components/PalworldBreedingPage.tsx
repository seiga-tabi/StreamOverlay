import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type {
  PalworldBreedingPair,
  PalworldBreedingParentsResponse,
  PalworldBreedingResultResponse,
  PalworldBreedingGender,
  PalworldPalReference,
  PalworldPalSummary,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import {
  getPalworldBreeding,
  getPalworldBreedingParents,
  getPalworldPal,
  PalworldApiError,
} from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { genderLabel } from "../utils/labels";
import { resolvePalworldName } from "../utils/localization";
import { formatPalNumber } from "../utils/search";
import {
  clearPalworldBreedingParams,
  palworldBreedingParams,
  parsePalworldBreedingQuery,
  swapBreedingParents,
  type PalworldBreedingQueryState,
} from "../utils/breeding";
import { palworldUrl, setPalworldUrl } from "../utils/routes";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldElementBadge } from "./PalworldElementBadge";
import { PalworldPalPicker } from "./PalworldPalPicker";
import { PalworldDomainCoverageNotice, usePalworldDomainCoverage } from "./PalworldCoverageNotice";
import { PalworldEmpty, PalworldError, PalworldLoading } from "./PalworldStates";
import { Pagination } from "./Pagination";
import { PalworldTranslationBadge } from "./PalworldTranslationBadge";

type PickerPal = PalworldPalReference | PalworldPalSummary;
type RequestStatus = "idle" | "loading" | "success" | "empty" | "error" | "data_unavailable" | "requires_gender";
type RequestState<T> = { status: RequestStatus; data: T | null };
type DirectResponse = PalworldBreedingResultResponse;
type ReverseResponse = PalworldBreedingParentsResponse;

const IDLE_REQUEST = { status: "idle", data: null } as const;

function unavailableError(error: unknown): boolean {
  return error instanceof PalworldApiError
    && (error.status === 503 || error.code === "PALWORLD_DATA_UNAVAILABLE");
}

function PairPal({ locale, pal, role }: { locale: PalworldLocale; pal: PalworldPalReference; role: string }) {
  const name = resolvePalworldName(pal, locale);
  return <div className="palworld-breeding-pal"><span><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={name.text} locale={locale} /></span><div><small>{role} · {formatPalNumber(pal.number)}</small><strong>{name.text}</strong><PalworldTranslationBadge locale={locale} status={name.status} /><div className="palworld-badge-row">{pal.elements.map((element) => <PalworldElementBadge element={element} locale={locale} key={element} />)}</div></div></div>;
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
  const [directRevision, setDirectRevision] = useState(0);
  const [reverseRevision, setReverseRevision] = useState(0);
  const directRequestIdRef = useRef(0);
  const reverseRequestIdRef = useRef(0);
  const referenceRequestIdRef = useRef(0);
  const coverage = usePalworldDomainCoverage("breeding");
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
    }
  }, [paramsKey, parsedQuery.ok, query.child, query.mode, query.parentA, query.parentB]);

  useEffect(() => {
    if (
      !parsedQuery.ok
      || query.mode !== "parents"
      || (query.parentA && query.parentB)
      || (!query.parentA && !query.parentB)
    ) {
      return undefined;
    }
    const missingId = query.parentA ?? query.parentB;
    if (!missingId || (query.parentA ? parentA?.id === missingId : parentB?.id === missingId)) return undefined;
    const controller = new AbortController();
    const requestId = ++referenceRequestIdRef.current;
    void getPalworldPal(missingId, controller.signal)
      .then((pal) => {
        if (controller.signal.aborted || referenceRequestIdRef.current !== requestId) return;
        if (query.parentA) setParentA(pal);
        else setParentB(pal);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted || referenceRequestIdRef.current !== requestId) return;
        setDirect({ status: unavailableError(error) ? "data_unavailable" : "error", data: null });
      });
    return () => controller.abort();
  }, [parentA?.id, parentB?.id, parsedQuery.ok, query.mode, query.parentA, query.parentB]);

  useEffect(() => {
    if (!parsedQuery.ok || query.mode !== "parents" || !query.parentA || !query.parentB) {
      setDirect(IDLE_REQUEST);
      return undefined;
    }
    const controller = new AbortController();
    const requestId = ++directRequestIdRef.current;
    setDirect({ status: "loading", data: null });
    void getPalworldBreeding(query.parentA, query.parentB, {
      parentAGender: query.parentAGender,
      parentBGender: query.parentBGender,
    }, controller.signal)
      .then((responseValue) => {
        if (controller.signal.aborted || directRequestIdRef.current !== requestId) return;
        const response = responseValue;
        setParentA(response.parentA);
        setParentB(response.parentB);
        if (response.state === "data_unavailable") {
          setDirect({ status: "data_unavailable", data: response });
        } else if (response.state === "requires_gender") {
          setDirect({ status: "requires_gender", data: response });
        } else if (response.state === "not_found" || !response.result) {
          setDirect({ status: "empty", data: response });
        } else {
          setDirect({ status: "success", data: response });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted || directRequestIdRef.current !== requestId) return;
        setDirect({ status: unavailableError(error) ? "data_unavailable" : "error", data: null });
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
    setReverse({ status: "loading", data: null });
    void getPalworldBreedingParents(query.child, query.page, 12, controller.signal)
      .then((responseValue) => {
        if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
        const response = responseValue;
        setTarget(response.child);
        if (response.state === "data_unavailable") {
          setReverse({ status: "data_unavailable", data: response });
        } else if (response.state === "not_found" || response.items.length === 0) {
          setReverse({ status: "empty", data: response });
        } else {
          setReverse({ status: "success", data: response });
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (controller.signal.aborted || reverseRequestIdRef.current !== requestId) return;
        setReverse({ status: unavailableError(error) ? "data_unavailable" : "error", data: null });
      });
    return () => controller.abort();
  }, [parsedQuery.ok, query.child, query.mode, query.page, reverseRevision]);

  function resetAll() {
    setParentA(null);
    setParentB(null);
    setTarget(null);
    setDirect(IDLE_REQUEST);
    setReverse(IDLE_REQUEST);
    const nextParams = clearPalworldBreedingParams(new URLSearchParams(paramsKey));
    setPalworldUrl(palworldUrl("breeding", nextParams));
  }

  function changeParent(position: "parentA" | "parentB", pal: PalworldPalSummary | null) {
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

  function changeGender(position: "parentAGender" | "parentBGender", value: string) {
    if (query.mode !== "parents") return;
    navigate({
      ...query,
      [position]: value === "any" ? undefined : value as PalworldBreedingGender,
    });
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, mode: "parents" | "child") {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "ArrowLeft" || event.key === "Home"
      ? "parents"
      : event.key === "ArrowRight" || event.key === "End"
        ? "child"
        : mode;
    navigate({ mode: nextMode, page: 1 });
    window.requestAnimationFrame(() => {
      document.getElementById(`palworld-breeding-${nextMode}-tab`)?.focus();
    });
  }

  const directLoading = direct.status === "loading";
  const reverseLoading = reverse.status === "loading";

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">BREEDING</span><h1 data-ko={palworldI18n.ko.breeding} data-ja={palworldI18n.ja.breeding}>{text.breeding}</h1><p data-ko={palworldI18n.ko.breedingDescription} data-ja={palworldI18n.ja.breedingDescription}>{text.breedingDescription}</p></div></header>
    <PalworldDomainCoverageNotice coverage={coverage} domain="breeding" locale={locale} />
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
      <div className="palworld-tabs" role="tablist">
        <button id="palworld-breeding-parents-tab" className={query.mode === "parents" ? "active" : ""} role="tab" aria-controls="palworld-breeding-parents-panel" aria-selected={query.mode === "parents"} tabIndex={query.mode === "parents" ? 0 : -1} onKeyDown={(event) => moveTab(event, "parents")} onClick={() => navigate({ mode: "parents", page: 1 })}>{text.parentsToChild}</button>
        <button id="palworld-breeding-child-tab" className={query.mode === "child" ? "active" : ""} role="tab" aria-controls="palworld-breeding-child-panel" aria-selected={query.mode === "child"} tabIndex={query.mode === "child" ? 0 : -1} onKeyDown={(event) => moveTab(event, "child")} onClick={() => navigate({ mode: "child", page: 1 })}>{text.childToParents}</button>
      </div>
      {query.mode === "parents" ? <div id="palworld-breeding-parents-panel" role="tabpanel" aria-labelledby="palworld-breeding-parents-tab">
        <Card className="palworld-breeding-input-card"><CardContent>
          <div className="palworld-breeding-pickers">
            <div>
              <PalworldPalPicker label={text.parentA} locale={locale} selected={parentA} onChange={(pal) => changeParent("parentA", pal)} testId="breeding-parent-a" />
              {query.parentA ? <label className="palworld-gender-field"><span>{text.parentAGender}</span><select value={query.parentAGender ?? "any"} onChange={(event) => changeGender("parentAGender", event.target.value)}><option value="any">{genderLabel("any", locale)}</option><option value="male">{genderLabel("male", locale)}</option><option value="female">{genderLabel("female", locale)}</option></select></label> : null}
            </div>
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
            }}>⇄</Button>
            <div>
              <PalworldPalPicker label={text.parentB} locale={locale} selected={parentB} onChange={(pal) => changeParent("parentB", pal)} testId="breeding-parent-b" />
              {query.parentB ? <label className="palworld-gender-field"><span>{text.parentBGender}</span><select value={query.parentBGender ?? "any"} onChange={(event) => changeGender("parentBGender", event.target.value)}><option value="any">{genderLabel("any", locale)}</option><option value="male">{genderLabel("male", locale)}</option><option value="female">{genderLabel("female", locale)}</option></select></label> : null}
            </div>
          </div>
          <div className="palworld-breeding-actions"><Button variant="ghost" onClick={resetAll}>{text.reset}</Button></div>
        </CardContent></Card>
        <section className="palworld-breeding-result" data-testid="breeding-result" aria-busy={directLoading} aria-live="polite">
          <div className="palworld-section-title"><h2>{text.breedingResult}</h2></div>
          {!query.parentA || !query.parentB ? <PalworldEmpty locale={locale} title={text.selectBothParents} /> : null}
          {directLoading ? <PalworldLoading locale={locale} count={1} /> : null}
          {direct.status === "error" ? <PalworldError locale={locale} onRetry={() => setDirectRevision((value) => value + 1)} /> : null}
          {direct.status === "data_unavailable" ? <PalworldError description={text.breedingDataUnavailableDescription} descriptionJa={palworldI18n.ja.breedingDataUnavailableDescription} descriptionKo={palworldI18n.ko.breedingDataUnavailableDescription} locale={locale} onRetry={() => setDirectRevision((value) => value + 1)} title={text.breedingDataUnavailable} titleJa={palworldI18n.ja.breedingDataUnavailable} titleKo={palworldI18n.ko.breedingDataUnavailable} /> : null}
          {direct.status === "empty" ? <PalworldEmpty locale={locale} title={text.noBreedingResult} /> : null}
          {direct.status === "requires_gender" ? <>
            <div className="palworld-breeding-gender-notice" role="status"><strong>{text.genderRequired}</strong><p>{text.genderRequiredDescription}</p></div>
            {direct.data?.alternatives.length ? <div className="palworld-parent-pair-list">{direct.data.alternatives.map((pair) => <BreedingResultCard pair={pair} locale={locale} onOpenPal={onOpenPal} compact key={pair.id} />)}</div> : null}
          </> : null}
          {direct.status === "success" && direct.data?.result ? <BreedingResultCard pair={direct.data.result} locale={locale} onOpenPal={onOpenPal} /> : null}
        </section>
      </div> : <div id="palworld-breeding-child-panel" role="tabpanel" aria-labelledby="palworld-breeding-child-tab">
        <Card className="palworld-breeding-input-card"><CardContent><PalworldPalPicker label={text.targetPal} locale={locale} selected={target} onChange={(pal) => {
          setTarget(pal);
          navigate({ mode: "child", child: pal?.id, page: 1 });
        }} testId="breeding-target" /><div className="palworld-breeding-actions"><Button variant="ghost" onClick={resetAll}>{text.reset}</Button></div></CardContent></Card>
        <section className="palworld-breeding-result" data-testid="breeding-parent-results" aria-busy={reverseLoading} aria-live="polite">
          <div className="palworld-section-title"><h2>{text.childToParents}</h2></div>
          {!query.child ? <PalworldEmpty locale={locale} title={text.selectTarget} /> : null}
          {reverseLoading ? <PalworldLoading locale={locale} count={1} /> : null}
          {reverse.status === "error" ? <PalworldError locale={locale} onRetry={() => setReverseRevision((value) => value + 1)} /> : null}
          {reverse.status === "data_unavailable" ? <PalworldError description={text.breedingDataUnavailableDescription} descriptionJa={palworldI18n.ja.breedingDataUnavailableDescription} descriptionKo={palworldI18n.ko.breedingDataUnavailableDescription} locale={locale} onRetry={() => setReverseRevision((value) => value + 1)} title={text.breedingDataUnavailable} titleJa={palworldI18n.ja.breedingDataUnavailable} titleKo={palworldI18n.ko.breedingDataUnavailable} /> : null}
          {reverse.status === "empty" ? <PalworldEmpty locale={locale} title={text.noParentPairs} /> : null}
          {reverse.status === "success" && reverse.data?.items.length ? <div className="palworld-parent-pair-list">{reverse.data.items.map((pair) => <BreedingResultCard pair={pair} locale={locale} onOpenPal={onOpenPal} compact key={pair.id} />)}</div> : null}
          {reverse.status === "success" && reverse.data ? <Pagination locale={locale} pagination={reverse.data.pagination} onPage={(page) => navigate({ mode: "child", child: query.child, page })} /> : null}
        </section>
      </div>}
    </>}
  </section>;
}

function BreedingResultCard({ compact = false, locale, onOpenPal, pair }: { compact?: boolean; locale: PalworldLocale; onOpenPal: (id: string) => void; pair: PalworldBreedingPair }) {
  const text = palworldI18n[locale];
  return <Card className={`palworld-pair-card${compact ? " is-compact" : ""}`}><CardHeader><CardTitle>{pair.isSpecial ? text.specialBreeding : text.normalBreeding}</CardTitle>{pair.genderCondition ? <Badge tone="warning">{text.genderCondition}: {genderLabel(pair.genderCondition.parentA, locale)} / {genderLabel(pair.genderCondition.parentB, locale)}</Badge> : null}</CardHeader><CardContent><div className="palworld-pair-flow"><PairPal pal={pair.parentA} role={text.parentRoleA} locale={locale} /><span aria-hidden="true">＋</span><PairPal pal={pair.parentB} role={text.parentRoleB} locale={locale} /><span aria-hidden="true">＝</span><button className="palworld-result-pal-button" type="button" onClick={() => onOpenPal(pair.child.id)}><PairPal pal={pair.child} role={text.resultPal} locale={locale} /></button></div></CardContent></Card>;
}

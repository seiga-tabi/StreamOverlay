import { useEffect, useState } from "react";
import type { PalworldBreedingPair, PalworldBreedingParentsResponse, PalworldBreedingResultResponse, PalworldPalReference, PalworldPalSummary } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import { getPalworldBreeding, getPalworldBreedingParents } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { elementLabel } from "../utils/labels";
import { genderLabel } from "../utils/labels";
import { formatPalNumber } from "../utils/search";
import { swapBreedingParents } from "../utils/breeding";
import { PalworldMedia } from "./PalworldMedia";
import { PalworldPalPicker } from "./PalworldPalPicker";
import { PalworldDomainCoverageNotice, usePalworldDomainCoverage } from "./PalworldCoverageNotice";
import { PalworldEmpty, PalworldError } from "./PalworldStates";
import { Pagination } from "./Pagination";

type PickerPal = PalworldPalReference | PalworldPalSummary;
type BreedingTab = "parents" | "child";

function PairPal({ locale, pal, role }: { locale: PalworldLocale; pal: PalworldPalReference; role: string }) {
  const name = locale === "ja" ? pal.nameJa : pal.nameKo;
  return <div className="palworld-breeding-pal"><span><PalworldMedia kind="pal" imageUrl={pal.imageUrl} alt={name} locale={locale} /></span><div><small>{role} · {formatPalNumber(pal.number)}</small><strong>{name}</strong><div className="palworld-badge-row">{pal.elements.map((element) => <Badge size="sm" tone="info" key={element}>{elementLabel(element, locale)}</Badge>)}</div></div></div>;
}

export function PalworldBreedingPage({ locale, onOpenPal }: { locale: PalworldLocale; onOpenPal: (id: string) => void }) {
  const [tab, setTab] = useState<BreedingTab>("parents");
  const [parentA, setParentA] = useState<PickerPal | null>(null);
  const [parentB, setParentB] = useState<PickerPal | null>(null);
  const [target, setTarget] = useState<PickerPal | null>(null);
  const [result, setResult] = useState<PalworldBreedingResultResponse | null>(null);
  const [parents, setParents] = useState<PalworldBreedingParentsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const coverage = usePalworldDomainCoverage("breeding");
  const text = palworldI18n[locale];

  useEffect(() => {
    if (!parentA || !parentB || tab !== "parents") {
      setResult(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void getPalworldBreeding(parentA.id, parentB.id, controller.signal).then(setResult).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [parentA?.id, parentB?.id, revision, tab]);

  useEffect(() => {
    if (!target || tab !== "child") {
      setParents(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    void getPalworldBreedingParents(target.id, page, 12, controller.signal).then(setParents).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [target?.id, page, revision, tab]);

  function resetAll() {
    setParentA(null); setParentB(null); setTarget(null); setResult(null); setParents(null); setPage(1); setError(false);
  }

  return <section className="palworld-page-section">
    <header className="palworld-page-heading"><div><span aria-hidden="true">BREEDING</span><h1 data-ko={palworldI18n.ko.breeding} data-ja={palworldI18n.ja.breeding}>{text.breeding}</h1><p data-ko={palworldI18n.ko.breedingDescription} data-ja={palworldI18n.ja.breedingDescription}>{text.breedingDescription}</p></div></header>
    <PalworldDomainCoverageNotice coverage={coverage} domain="breeding" locale={locale} />
    <div className="palworld-tabs" role="tablist"><button className={tab === "parents" ? "active" : ""} role="tab" aria-selected={tab === "parents"} onClick={() => setTab("parents")}>{text.parentsToChild}</button><button className={tab === "child" ? "active" : ""} role="tab" aria-selected={tab === "child"} onClick={() => setTab("child")}>{text.childToParents}</button></div>
    {tab === "parents" ? <>
      <Card className="palworld-breeding-input-card"><CardContent><div className="palworld-breeding-pickers"><PalworldPalPicker label={text.parentA} locale={locale} selected={parentA} onChange={setParentA} testId="breeding-parent-a" /><Button className="palworld-swap-button" variant="secondary" aria-label={text.swapParents} data-testid="breeding-swap" disabled={!parentA && !parentB} onClick={() => { const [nextA, nextB] = swapBreedingParents(parentA, parentB); setParentA(nextA); setParentB(nextB); }}>⇄</Button><PalworldPalPicker label={text.parentB} locale={locale} selected={parentB} onChange={setParentB} testId="breeding-parent-b" /></div><div className="palworld-breeding-actions"><Button variant="ghost" onClick={resetAll}>{text.reset}</Button></div></CardContent></Card>
      <section className="palworld-breeding-result" data-testid="breeding-result"><div className="palworld-section-title"><h2>{text.breedingResult}</h2>{loading ? <span>{text.loading}</span> : null}</div>
        {!parentA || !parentB ? <PalworldEmpty locale={locale} title={text.selectBothParents} /> : null}
        {error ? <PalworldError locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {!loading && result && !result.result ? <PalworldEmpty locale={locale} title={text.noBreedingResult} /> : null}
        {result?.result ? <BreedingResultCard pair={result.result} locale={locale} onOpenPal={onOpenPal} /> : null}
      </section>
    </> : <>
      <Card className="palworld-breeding-input-card"><CardContent><PalworldPalPicker label={text.targetPal} locale={locale} selected={target} onChange={(pal) => { setTarget(pal); setPage(1); }} testId="breeding-target" /><div className="palworld-breeding-actions"><Button variant="ghost" onClick={resetAll}>{text.reset}</Button></div></CardContent></Card>
      <section className="palworld-breeding-result"><div className="palworld-section-title"><h2>{text.childToParents}</h2>{loading ? <span>{text.loading}</span> : null}</div>
        {!target ? <PalworldEmpty locale={locale} title={text.selectTarget} /> : null}
        {error ? <PalworldError locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
        {parents?.items.length === 0 ? <PalworldEmpty locale={locale} title={text.noParentPairs} /> : null}
        {parents?.items.length ? <div className="palworld-parent-pair-list">{parents.items.map((pair) => <BreedingResultCard pair={pair} locale={locale} onOpenPal={onOpenPal} compact key={pair.id} />)}</div> : null}
        {parents ? <Pagination locale={locale} pagination={parents.pagination} onPage={setPage} /> : null}
      </section>
    </>}
  </section>;
}

function BreedingResultCard({ compact = false, locale, onOpenPal, pair }: { compact?: boolean; locale: PalworldLocale; onOpenPal: (id: string) => void; pair: PalworldBreedingPair }) {
  const text = palworldI18n[locale];
  return <Card className={`palworld-pair-card${compact ? " is-compact" : ""}`}><CardHeader><CardTitle>{pair.isSpecial ? text.specialBreeding : text.normalBreeding}</CardTitle>{pair.genderCondition ? <Badge tone="warning">{text.genderCondition}: {genderLabel(pair.genderCondition.parentA, locale)} / {genderLabel(pair.genderCondition.parentB, locale)}</Badge> : null}</CardHeader><CardContent><div className="palworld-pair-flow"><PairPal pal={pair.parentA} role={text.parentA} locale={locale} /><span aria-hidden="true">＋</span><PairPal pal={pair.parentB} role={text.parentB} locale={locale} /><span aria-hidden="true">＝</span><button className="palworld-result-pal-button" type="button" onClick={() => onOpenPal(pair.child.id)}><PairPal pal={pair.child} role={text.resultPal} locale={locale} /></button></div></CardContent></Card>;
}

import { useEffect, useState } from "react";
import type { PalworldMetaResponse } from "@streamops/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { Metric } from "../../../shared/ui/Status";
import { getPalworldMeta } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl } from "../utils/routes";
import { PalworldError, PalworldLoading } from "./PalworldStates";
import { PalworldSearchForm } from "./PalworldSearchForm";

const shortcuts = [
  { page: "pals" as const, symbol: "P", titleKey: "pals" as const, descriptionKey: "palsDescription" as const },
  { page: "breeding" as const, symbol: "∞", titleKey: "breeding" as const, descriptionKey: "breedingDescription" as const },
  { page: "items" as const, symbol: "◇", titleKey: "items" as const, descriptionKey: "itemsDescription" as const },
];

export function PalworldHome({
  locale,
  onOpenItem,
  onOpenPal,
  onSearch,
}: {
  locale: PalworldLocale;
  onOpenItem: (id: string) => void;
  onOpenPal: (id: string) => void;
  onSearch: (query: string) => void;
}) {
  const [meta, setMeta] = useState<PalworldMetaResponse | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const text = palworldI18n[locale];

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void getPalworldMeta(controller.signal).then(setMeta).catch((requestError) => {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(true);
    });
    return () => controller.abort();
  }, [revision]);

  const verifiedAt = meta ? new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium" }).format(new Date(meta.metadata.verifiedAt)) : "-";

  return <>
    <section className="palworld-hero" aria-labelledby="palworld-home-title">
      <span className="palworld-hero-mark" aria-hidden="true">PALWORLD</span>
      <h1 id="palworld-home-title" data-ko={palworldI18n.ko.brand} data-ja={palworldI18n.ja.brand}>{text.brand}</h1>
      <p data-ko={palworldI18n.ko.description} data-ja={palworldI18n.ja.description}>{text.description}</p>
      <PalworldSearchForm locale={locale} variant="hero" onSearch={onSearch} onPal={(pal) => onOpenPal(pal.id)} onItem={(item) => onOpenItem(item.id)} />
      <div className="palworld-hero-meta"><span>{text.gameVersion}: <strong>{meta?.metadata.gameVersion ?? "-"}</strong></span><span>{text.updatedAt}: <strong>{verifiedAt}</strong></span></div>
    </section>
    <section className="palworld-shortcuts" aria-label={text.browse}>
      {shortcuts.map((shortcut) => <Card variant="interactive" onClick={() => setPalworldUrl(palworldPathForPage(shortcut.page))} key={shortcut.page}>
        <CardHeader><span className="palworld-shortcut-icon" aria-hidden="true">{shortcut.symbol}</span><CardTitle data-ko={palworldI18n.ko[shortcut.titleKey]} data-ja={palworldI18n.ja[shortcut.titleKey]}>{text[shortcut.titleKey]}</CardTitle></CardHeader>
        <CardContent><CardDescription data-ko={palworldI18n.ko[shortcut.descriptionKey]} data-ja={palworldI18n.ja[shortcut.descriptionKey]}>{text[shortcut.descriptionKey]}</CardDescription><strong className="palworld-shortcut-link">{text.browse} →</strong></CardContent>
      </Card>)}
    </section>
    <section className="palworld-summary" aria-label={text.dataVersion}>
      {error ? <PalworldError locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
      {!meta && !error ? <PalworldLoading locale={locale} count={4} /> : null}
      {meta ? <>
        <Metric label={text.registeredPals} value={meta.counts.pals.toLocaleString()} tone="success" />
        <Metric label={text.registeredItems} value={meta.counts.items.toLocaleString()} tone="info" />
        <Metric label={text.breedingPairs} value={meta.counts.breedingPairs.toLocaleString()} tone="warning" />
        <Metric label={text.dataVersion} value={meta.metadata.gameVersion} description={`${meta.metadata.sourceName} · ${meta.metadata.sourceRevision}`} />
      </> : null}
    </section>
  </>;
}

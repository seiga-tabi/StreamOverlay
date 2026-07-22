import { useEffect, useState } from "react";
import type { PalworldImageAssetStatus, PalworldImagePolicyStatus, PalworldMetaResponse } from "@streamops/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { Badge, Metric } from "../../../shared/ui/Status";
import { getPalworldMeta } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, setPalworldUrl } from "../utils/routes";
import { PalworldError, PalworldLoading } from "./PalworldStates";
import { PalworldSearchForm } from "./PalworldSearchForm";
import { domainCoverage, PalworldDomainStatusBadge } from "./PalworldCoverageNotice";

const shortcuts = [
  { page: "pals" as const, symbol: "P", titleKey: "pals" as const, descriptionKey: "palsDescription" as const },
  { page: "breeding" as const, symbol: "∞", titleKey: "breeding" as const, descriptionKey: "breedingDescription" as const },
  { page: "items" as const, symbol: "◇", titleKey: "items" as const, descriptionKey: "itemsDescription" as const },
];

function imageStatusLabel(status: PalworldImageAssetStatus, locale: PalworldLocale): string {
  const text = palworldI18n[locale];
  if (status === "blocked_by_license") return text.blockedByLicense;
  if (status === "operator_acknowledged") return text.operatorAcknowledged;
  if (status === "partial") return text.partiallyReady;
  return text.rightsVerified;
}

function imagePolicyLabel(status: PalworldImagePolicyStatus, locale: PalworldLocale): string {
  const text = palworldI18n[locale];
  if (status === "blocked_by_license") return text.blockedByLicense;
  if (status === "operator_acknowledged") return text.operatorAcknowledged;
  if (status === "rights_verified") return text.rightsVerified;
  return text.imagePolicyMissing;
}

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
        <CardHeader><span className="palworld-shortcut-icon" aria-hidden="true">{shortcut.symbol}</span><CardTitle data-ko={palworldI18n.ko[shortcut.titleKey]} data-ja={palworldI18n.ja[shortcut.titleKey]}>{text[shortcut.titleKey]}</CardTitle><PalworldDomainStatusBadge coverage={domainCoverage(meta, shortcut.page)} locale={locale} /></CardHeader>
        <CardContent><CardDescription data-ko={palworldI18n.ko[shortcut.descriptionKey]} data-ja={palworldI18n.ja[shortcut.descriptionKey]}>{text[shortcut.descriptionKey]}</CardDescription><strong className="palworld-shortcut-link">{text.browse} →</strong></CardContent>
      </Card>)}
    </section>
    <section className="palworld-summary" aria-label={text.dataVersion}>
      {error ? <PalworldError locale={locale} onRetry={() => setRevision((value) => value + 1)} /> : null}
      {!meta && !error ? <PalworldLoading locale={locale} count={4} /> : null}
      {meta ? <>
        <Metric
          label={<span data-ko={palworldI18n.ko.registeredPals} data-ja={palworldI18n.ja.registeredPals}>{text.registeredPals}</span>}
          value={meta.domains.pals.recordCount.toLocaleString()}
          description={`${meta.domains.pals.metadata.gameVersion} · ${meta.domains.pals.metadata.sourceName} · ${meta.domains.pals.metadata.sourceRevision}`}
          status={<PalworldDomainStatusBadge coverage={meta.domains.pals} locale={locale} />}
          tone="success"
        />
        <Metric
          label={<span data-ko={palworldI18n.ko.registeredItems} data-ja={palworldI18n.ja.registeredItems}>{text.registeredItems}</span>}
          value={meta.domains.items.recordCount.toLocaleString()}
          description={`${meta.domains.items.metadata.gameVersion} · ${meta.domains.items.metadata.sourceName} · ${meta.domains.items.metadata.sourceRevision}`}
          status={<PalworldDomainStatusBadge coverage={meta.domains.items} locale={locale} />}
          tone="warning"
        />
        <Metric
          label={<span data-ko={palworldI18n.ko.breedingPairs} data-ja={palworldI18n.ja.breedingPairs}>{text.breedingPairs}</span>}
          value={meta.domains.breeding.recordCount.toLocaleString()}
          description={`${meta.domains.breeding.metadata.gameVersion} · ${meta.domains.breeding.metadata.sourceName} · ${meta.domains.breeding.metadata.sourceRevision}`}
          status={<PalworldDomainStatusBadge coverage={meta.domains.breeding} locale={locale} />}
          tone="warning"
        />
        <Metric
          label={<span data-ko={palworldI18n.ko.imageCoverage} data-ja={palworldI18n.ja.imageCoverage}>{text.imageCoverage}</span>}
          value={meta.gates.imageAssets.readyImages.toLocaleString()}
          description={(
            <span className="palworld-image-gate-details">
              <span data-ko={palworldI18n.ko.readyImages} data-ja={palworldI18n.ja.readyImages}>{text.readyImages}: {meta.gates.imageAssets.readyImages.toLocaleString()}</span>
              <span data-ko={palworldI18n.ko.fallbackPals} data-ja={palworldI18n.ja.fallbackPals}>{text.fallbackPals}: {meta.gates.imageAssets.fallbackPals.toLocaleString()}</span>
              <span data-ko={imagePolicyLabel(meta.gates.imageAssets.policyStatus, "ko")} data-ja={imagePolicyLabel(meta.gates.imageAssets.policyStatus, "ja")}>{imagePolicyLabel(meta.gates.imageAssets.policyStatus, locale)}</span>
              <span data-ko={meta.gates.imageAssets.technicalPassed ? palworldI18n.ko.imageTechnicalPassed : palworldI18n.ko.imageTechnicalPending} data-ja={meta.gates.imageAssets.technicalPassed ? palworldI18n.ja.imageTechnicalPassed : palworldI18n.ja.imageTechnicalPending}>{meta.gates.imageAssets.technicalPassed ? text.imageTechnicalPassed : text.imageTechnicalPending}</span>
              <span data-ko={meta.gates.imageAssets.publicActivationAllowed ? palworldI18n.ko.publicDisplayEnabled : palworldI18n.ko.publicDisplayDisabled} data-ja={meta.gates.imageAssets.publicActivationAllowed ? palworldI18n.ja.publicDisplayEnabled : palworldI18n.ja.publicDisplayDisabled}>{meta.gates.imageAssets.publicActivationAllowed ? text.publicDisplayEnabled : text.publicDisplayDisabled}</span>
              <span data-ko={meta.gates.imageAssets.rightsVerified ? palworldI18n.ko.rightsVerified : palworldI18n.ko.rightsNotVerified} data-ja={meta.gates.imageAssets.rightsVerified ? palworldI18n.ja.rightsVerified : palworldI18n.ja.rightsNotVerified}>{meta.gates.imageAssets.rightsVerified ? text.rightsVerified : text.rightsNotVerified}</span>
            </span>
          )}
          status={(
            <Badge
              data-ko={imageStatusLabel(meta.gates.imageAssets.status, "ko")}
              data-ja={imageStatusLabel(meta.gates.imageAssets.status, "ja")}
              size="sm"
              tone={meta.gates.imageAssets.status === "ready" ? "success" : "warning"}
            >
              {imageStatusLabel(meta.gates.imageAssets.status, locale)}
            </Badge>
          )}
          tone={meta.gates.imageAssets.status === "ready" ? "success" : "warning"}
        />
      </> : null}
    </section>
  </>;
}

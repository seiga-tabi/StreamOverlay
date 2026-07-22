import { useEffect, useState } from "react";
import type { PalworldDomainCoverage, PalworldDomainStatus, PalworldMetaResponse } from "@streamops/shared";
import { Badge } from "../../../shared/ui/Status";
import { getPalworldMeta } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export type PalworldSampleDomain = "items" | "breeding";

function statusLabel(status: PalworldDomainStatus | undefined, locale: PalworldLocale): string {
  const text = palworldI18n[locale];
  if (status === "ready") return text.ready;
  if (status === "sample") return text.sample;
  if (status === "incomplete") return text.incomplete;
  return text.coverageUnknown;
}

function statusLabels(status: PalworldDomainStatus | undefined): { ko: string; ja: string } {
  return {
    ko: statusLabel(status, "ko"),
    ja: statusLabel(status, "ja"),
  };
}

export function PalworldDomainStatusBadge({
  coverage,
  locale,
}: {
  coverage?: PalworldDomainCoverage;
  locale: PalworldLocale;
}) {
  const labels = statusLabels(coverage?.status);
  return (
    <Badge
      data-ko={labels.ko}
      data-ja={labels.ja}
      data-testid="palworld-domain-status"
      size="sm"
      tone={coverage?.status === "ready" ? "success" : "warning"}
    >
      {locale === "ja" ? labels.ja : labels.ko}
    </Badge>
  );
}

export function usePalworldDomainCoverage(domain: PalworldSampleDomain): PalworldDomainCoverage | undefined {
  const [coverage, setCoverage] = useState<PalworldDomainCoverage>();

  useEffect(() => {
    const controller = new AbortController();
    setCoverage(undefined);
    void getPalworldMeta(controller.signal)
      .then((meta) => setCoverage(meta.domains[domain]))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCoverage(undefined);
      });
    return () => controller.abort();
  }, [domain]);

  return coverage;
}

export function PalworldDomainCoverageNotice({
  coverage,
  domain,
  locale,
}: {
  coverage?: PalworldDomainCoverage;
  domain: PalworldSampleDomain;
  locale: PalworldLocale;
}) {
  if (coverage?.status === "ready") return null;

  const text = palworldI18n[locale];
  const noticeKo = domain === "items" ? palworldI18n.ko.itemsCoverageNotice : palworldI18n.ko.breedingCoverageNotice;
  const noticeJa = domain === "items" ? palworldI18n.ja.itemsCoverageNotice : palworldI18n.ja.breedingCoverageNotice;
  const notice = coverage ? (locale === "ja" ? noticeJa : noticeKo) : text.coverageUnavailable;

  return (
    <aside
      className="palworld-coverage-notice"
      data-testid={`palworld-${domain}-coverage`}
      role="note"
    >
      <div className="palworld-coverage-heading">
        <strong data-ko={palworldI18n.ko.coverage} data-ja={palworldI18n.ja.coverage}>{text.coverage}</strong>
        <PalworldDomainStatusBadge coverage={coverage} locale={locale} />
      </div>
      <p
        data-ko={coverage ? noticeKo : palworldI18n.ko.coverageUnavailable}
        data-ja={coverage ? noticeJa : palworldI18n.ja.coverageUnavailable}
      >
        {notice}
      </p>
      {coverage ? (
        <small>
          <span data-ko={palworldI18n.ko.source} data-ja={palworldI18n.ja.source}>{text.source}</span>
          {`: ${coverage.metadata.sourceName} · ${coverage.metadata.sourceRevision}`}
        </small>
      ) : null}
    </aside>
  );
}

export function domainCoverage(meta: PalworldMetaResponse | null, domain: keyof PalworldMetaResponse["domains"]): PalworldDomainCoverage | undefined {
  return meta?.domains[domain];
}

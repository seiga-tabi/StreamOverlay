import type {
  PalworldTranslationDisplayStatus,
  PalworldTranslationSourceIntegrityStatus,
} from "@streamops/shared";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { uniquePalworldTranslationStatuses } from "../utils/localization";

export function PalworldTranslationBadge({
  showMachineAssisted = true,
  locale,
  status,
}: {
  showMachineAssisted?: boolean;
  locale: PalworldLocale;
  status: PalworldTranslationDisplayStatus;
}) {
  if (status === "machine_assisted" && showMachineAssisted) {
    return <Badge
      size="sm"
      tone="warning"
      data-ko={palworldI18n.ko.translationReviewPending}
      data-ja={palworldI18n.ja.translationReviewPending}
      data-translation-status={status}
    >{palworldI18n[locale].translationReviewPending}</Badge>;
  }
  if (status === "source_language_fallback") {
    return <Badge
      size="sm"
      tone="neutral"
      data-ko={palworldI18n.ko.englishOriginal}
      data-ja={palworldI18n.ja.englishOriginal}
      data-translation-status={status}
    >{palworldI18n[locale].englishOriginal}</Badge>;
  }
  if (status === "missing_source") {
    return <Badge
      size="sm"
      tone="neutral"
      data-ko={palworldI18n.ko.translationSourceMissing}
      data-ja={palworldI18n.ja.translationSourceMissing}
      data-translation-status={status}
    >{palworldI18n[locale].translationSourceMissing}</Badge>;
  }
  return null;
}

export function PalworldTranslationBadges({
  showMachineAssisted = true,
  locale,
  sourceIntegrities = [],
  statuses,
}: {
  showMachineAssisted?: boolean;
  locale: PalworldLocale;
  sourceIntegrities?: readonly (PalworldTranslationSourceIntegrityStatus | undefined)[];
  statuses: readonly PalworldTranslationDisplayStatus[];
}) {
  const visibleStatuses = uniquePalworldTranslationStatuses(statuses)
    .filter((status) => showMachineAssisted || status !== "machine_assisted");
  const visibleSourceIntegrities = [...new Set(
    sourceIntegrities.filter((status): status is PalworldTranslationSourceIntegrityStatus => (
      status !== undefined && status !== "intact"
    )),
  )].filter((status) => (
    status !== "missing_source" || !visibleStatuses.includes("missing_source")
  ));
  if (!visibleStatuses.length && !visibleSourceIntegrities.length) return null;
  return <div className="palworld-badge-row palworld-translation-badges">
    {visibleStatuses.map((status) => (
      <PalworldTranslationBadge
        locale={locale}
        showMachineAssisted={showMachineAssisted}
        status={status}
        key={status}
      />
    ))}
    {visibleSourceIntegrities.map((status) => (
      <PalworldSourceIntegrityBadge locale={locale} status={status} key={`source-${status}`} />
    ))}
  </div>;
}

export function PalworldSourceIntegrityBadge({
  locale,
  status,
}: {
  locale: PalworldLocale;
  status: PalworldTranslationSourceIntegrityStatus;
}) {
  if (status === "source_anomaly") {
    return (
      <Badge
        data-ja={palworldI18n.ja.translationSourceAnomaly}
        data-ko={palworldI18n.ko.translationSourceAnomaly}
        data-source-integrity={status}
        size="sm"
        tone="warning"
      >
        {palworldI18n[locale].translationSourceAnomaly}
      </Badge>
    );
  }
  if (status === "missing_source") {
    return (
      <Badge
        data-ja={palworldI18n.ja.translationSourceMissing}
        data-ko={palworldI18n.ko.translationSourceMissing}
        data-source-integrity={status}
        size="sm"
        tone="neutral"
      >
        {palworldI18n[locale].translationSourceMissing}
      </Badge>
    );
  }
  return null;
}

export function PalworldTranslationReviewNotice({
  id,
  locale,
}: {
  id?: string;
  locale: PalworldLocale;
}) {
  const text = palworldI18n[locale];
  return (
    <aside
      className="palworld-translation-review-notice"
      data-ja={palworldI18n.ja.translationReviewDescription}
      data-ko={palworldI18n.ko.translationReviewDescription}
      id={id}
    >
      <PalworldTranslationBadge locale={locale} status="machine_assisted" />
      <p>{text.translationReviewDescription}</p>
    </aside>
  );
}

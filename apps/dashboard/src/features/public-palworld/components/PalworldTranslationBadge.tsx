import type { PalworldTranslationDisplayStatus } from "@streamops/shared";
import { Badge } from "../../../shared/ui/Status";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { uniquePalworldTranslationStatuses } from "../utils/localization";

export function PalworldTranslationBadge({
  locale,
  status,
}: {
  locale: PalworldLocale;
  status: PalworldTranslationDisplayStatus;
}) {
  if (status === "machine_assisted") {
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
  return null;
}

export function PalworldTranslationBadges({
  locale,
  statuses,
}: {
  locale: PalworldLocale;
  statuses: readonly PalworldTranslationDisplayStatus[];
}) {
  const visibleStatuses = uniquePalworldTranslationStatuses(statuses);
  if (!visibleStatuses.length) return null;
  return <div className="palworld-badge-row palworld-translation-badges">
    {visibleStatuses.map((status) => <PalworldTranslationBadge locale={locale} status={status} key={status} />)}
  </div>;
}

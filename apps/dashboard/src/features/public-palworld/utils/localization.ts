import type {
  PalworldLocalizationFallback,
  PalworldTranslationDisplayState,
  PalworldTranslationDisplayStatus,
  PalworldTranslationSourceIntegrityStatus,
} from "@streamops/shared";
import type { PalworldLocale } from "../i18n/palworld-i18n";

export type PalworldTranslatableField = "name" | "description" | "passiveAbility" | "label" | "location";

export type PalworldTranslationCarrier = {
  localization?: PalworldLocalizationFallback;
  translation?: PalworldTranslationDisplayState;
};

export type PalworldLocalizedText = {
  text: string;
  status: PalworldTranslationDisplayStatus;
  sourceIntegrity?: PalworldTranslationSourceIntegrityStatus;
};

function explicitTranslationStatus(
  value: PalworldTranslationCarrier,
  field: PalworldTranslatableField,
  locale: PalworldLocale,
): PalworldTranslationDisplayStatus | undefined {
  return value.translation?.[field]?.[locale];
}

function explicitSourceIntegrity(
  value: PalworldTranslationCarrier,
  field: PalworldTranslatableField,
  locale: PalworldLocale,
): PalworldTranslationSourceIntegrityStatus | undefined {
  return value.translation?.[field]?.sourceIntegrity?.[locale];
}

/**
 * 새 번역 snapshot 상태를 우선 사용하되 기존 localization-only 응답도 안전하게 표시합니다.
 * 실제 현지어 값이 존재하는 경우에만 번역 완료 상태로 처리합니다.
 */
export function resolvePalworldLocalizedText(
  value: PalworldTranslationCarrier,
  field: PalworldTranslatableField,
  locale: PalworldLocale,
  localizedValue: string | undefined,
  englishValue: string | undefined,
): PalworldLocalizedText {
  const localized = localizedValue?.trim();
  const english = englishValue?.trim();
  const explicitStatus = explicitTranslationStatus(value, field, locale);
  const sourceIntegrity = explicitSourceIntegrity(value, field, locale);

  // 서버가 의미 품질 gate에서 이름을 영문 fallback으로 내린 경우 stale locale
  // 문자열이 응답 객체에 남아 있어도 이를 다시 공개하지 않는다.
  if (explicitStatus === "source_language_fallback") {
    return english
      ? { text: english, status: "source_language_fallback", ...(sourceIntegrity ? { sourceIntegrity } : {}) }
      : { text: "", status: "missing_source", ...(sourceIntegrity ? { sourceIntegrity } : {}) };
  }
  if (explicitStatus === "missing_source") {
    return { text: "", status: "missing_source", ...(sourceIntegrity ? { sourceIntegrity } : {}) };
  }

  if (localized) {
    return {
      text: localized,
      status: explicitStatus === "source_provided"
        || explicitStatus === "machine_assisted"
        || explicitStatus === "human_reviewed"
        ? explicitStatus
        : "human_reviewed",
      ...(sourceIntegrity ? { sourceIntegrity } : {}),
    };
  }

  if (english) {
    return {
      text: english,
      status: "source_language_fallback",
      ...(sourceIntegrity ? { sourceIntegrity } : {}),
    };
  }

  return { text: "", status: "missing_source", ...(sourceIntegrity ? { sourceIntegrity } : {}) };
}

export function resolvePalworldName(
  value: PalworldTranslationCarrier & {
    id: string;
    nameKo?: string;
    nameJa?: string;
    nameEn?: string;
  },
  locale: PalworldLocale,
): PalworldLocalizedText {
  const sourceFallback = value.nameEn
    ?? (locale === "ja" ? value.nameKo : value.nameJa);
  return resolvePalworldLocalizedText(
    value,
    "name",
    locale,
    locale === "ja" ? value.nameJa : value.nameKo,
    sourceFallback,
  );
}

export function resolvePalworldDescription(
  value: PalworldTranslationCarrier & { descriptionKo?: string; descriptionJa?: string; descriptionEn?: string },
  locale: PalworldLocale,
): PalworldLocalizedText {
  return resolvePalworldLocalizedText(
    value,
    "description",
    locale,
    locale === "ja" ? value.descriptionJa : value.descriptionKo,
    value.descriptionEn,
  );
}

export function uniquePalworldTranslationStatuses(
  statuses: readonly PalworldTranslationDisplayStatus[],
): PalworldTranslationDisplayStatus[] {
  const visible = statuses.filter((status) => (
    status === "machine_assisted"
    || status === "source_language_fallback"
    || status === "missing_source"
  ));
  return [...new Set(visible)];
}

export function hasMachineAssistedTranslation(
  statuses: readonly PalworldTranslationDisplayStatus[],
): boolean {
  return statuses.includes("machine_assisted");
}

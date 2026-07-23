import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { PalworldApiError } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export function PalworldLoading({ locale, count = 6 }: { locale: PalworldLocale; count?: number }) {
  const text = palworldI18n[locale];
  return <div className="palworld-skeleton-grid" role="status" aria-label={text.loading}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} loadingLabel={index === 0 ? text.loading : undefined} />)}</div>;
}

export function PalworldError({
  description,
  descriptionJa,
  descriptionKo,
  error,
  locale,
  onRetry,
  title,
  titleJa,
  titleKo,
}: {
  description?: string;
  descriptionJa?: string;
  descriptionKo?: string;
  error?: unknown;
  locale: PalworldLocale;
  onRetry: () => void;
  title?: string;
  titleJa?: string;
  titleKo?: string;
}) {
  const text = palworldI18n[locale];
  const errorKey = error instanceof PalworldApiError
    ? error.status === 503
      ? "palDataUnavailable"
      : error.code === "PALWORLD_REQUEST_TIMEOUT"
        ? "apiTimeout"
        : error.code === "PALWORLD_RESPONSE_INVALID"
          ? "apiInvalidResponse"
          : error.code === "PALWORLD_NETWORK_ERROR"
            ? "apiNetworkError"
            : "apiHttpError"
    : undefined;
  const safeDescriptionKo = descriptionKo ?? (errorKey ? palworldI18n.ko[errorKey] : palworldI18n.ko.retry);
  const safeDescriptionJa = descriptionJa ?? (errorKey ? palworldI18n.ja[errorKey] : palworldI18n.ja.retry);
  const safeDescription = description ?? (locale === "ja" ? safeDescriptionJa : safeDescriptionKo);
  return <EmptyState role="alert" variant="error"><EmptyStateIcon>!</EmptyStateIcon><EmptyStateTitle data-ko={titleKo ?? palworldI18n.ko.apiError} data-ja={titleJa ?? palworldI18n.ja.apiError}>{title ?? text.apiError}</EmptyStateTitle><EmptyStateDescription data-ko={safeDescriptionKo} data-ja={safeDescriptionJa}>{safeDescription}</EmptyStateDescription><EmptyStateActions><Button variant="secondary" onClick={onRetry}>{text.retry}</Button></EmptyStateActions></EmptyState>;
}

export function PalworldEmpty({ description, locale, title }: { description?: string; locale: PalworldLocale; title: string }) {
  const text = palworldI18n[locale];
  return <EmptyState variant="search"><EmptyStateIcon>⌕</EmptyStateIcon><EmptyStateTitle>{title}</EmptyStateTitle>{description ? <EmptyStateDescription>{description}</EmptyStateDescription> : null}<EmptyStateDescription>{text.noResultsDescription}</EmptyStateDescription></EmptyState>;
}

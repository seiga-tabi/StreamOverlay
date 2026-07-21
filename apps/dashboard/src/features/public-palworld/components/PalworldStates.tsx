import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export function PalworldLoading({ locale, count = 6 }: { locale: PalworldLocale; count?: number }) {
  const text = palworldI18n[locale];
  return <div className="palworld-skeleton-grid" role="status" aria-label={text.loading}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} loadingLabel={index === 0 ? text.loading : undefined} />)}</div>;
}

export function PalworldError({ locale, onRetry }: { locale: PalworldLocale; onRetry: () => void }) {
  const text = palworldI18n[locale];
  return <EmptyState variant="error"><EmptyStateIcon>!</EmptyStateIcon><EmptyStateTitle data-ko={palworldI18n.ko.apiError} data-ja={palworldI18n.ja.apiError}>{text.apiError}</EmptyStateTitle><EmptyStateDescription>{text.retry}</EmptyStateDescription><EmptyStateActions><Button variant="secondary" onClick={onRetry}>{text.retry}</Button></EmptyStateActions></EmptyState>;
}

export function PalworldEmpty({ description, locale, title }: { description?: string; locale: PalworldLocale; title: string }) {
  const text = palworldI18n[locale];
  return <EmptyState variant="search"><EmptyStateIcon>⌕</EmptyStateIcon><EmptyStateTitle>{title}</EmptyStateTitle>{description ? <EmptyStateDescription>{description}</EmptyStateDescription> : null}<EmptyStateDescription>{text.noResultsDescription}</EmptyStateDescription></EmptyState>;
}

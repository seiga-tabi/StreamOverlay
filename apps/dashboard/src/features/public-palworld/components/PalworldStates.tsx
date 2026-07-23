import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export function PalworldLoading({ locale, count = 6 }: { locale: PalworldLocale; count?: number }) {
  const text = palworldI18n[locale];
  return <div className="palworld-skeleton-grid" role="status" aria-label={text.loading}>{Array.from({ length: count }, (_, index) => <SkeletonCard key={index} loadingLabel={index === 0 ? text.loading : undefined} />)}</div>;
}

export function PalworldError({
  description,
  descriptionJa,
  descriptionKo,
  locale,
  onRetry,
  title,
  titleJa,
  titleKo,
}: {
  description?: string;
  descriptionJa?: string;
  descriptionKo?: string;
  locale: PalworldLocale;
  onRetry: () => void;
  title?: string;
  titleJa?: string;
  titleKo?: string;
}) {
  const text = palworldI18n[locale];
  return <EmptyState role="alert" variant="error"><EmptyStateIcon>!</EmptyStateIcon><EmptyStateTitle data-ko={titleKo ?? palworldI18n.ko.apiError} data-ja={titleJa ?? palworldI18n.ja.apiError}>{title ?? text.apiError}</EmptyStateTitle><EmptyStateDescription data-ko={descriptionKo ?? palworldI18n.ko.retry} data-ja={descriptionJa ?? palworldI18n.ja.retry}>{description ?? text.retry}</EmptyStateDescription><EmptyStateActions><Button variant="secondary" onClick={onRetry}>{text.retry}</Button></EmptyStateActions></EmptyState>;
}

export function PalworldEmpty({ description, locale, title }: { description?: string; locale: PalworldLocale; title: string }) {
  const text = palworldI18n[locale];
  return <EmptyState variant="search"><EmptyStateIcon>⌕</EmptyStateIcon><EmptyStateTitle>{title}</EmptyStateTitle>{description ? <EmptyStateDescription>{description}</EmptyStateDescription> : null}<EmptyStateDescription>{text.noResultsDescription}</EmptyStateDescription></EmptyState>;
}

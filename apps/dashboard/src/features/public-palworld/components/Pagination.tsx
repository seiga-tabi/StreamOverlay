import type { PalworldPagination } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

export function Pagination({ locale, onPage, pagination }: { locale: PalworldLocale; onPage: (page: number) => void; pagination: PalworldPagination }) {
  const text = palworldI18n[locale];
  if (pagination.totalPages <= 1) return null;
  return <nav className="palworld-pagination" aria-label={text.page}>
    <Button variant="secondary" size="sm" disabled={!pagination.hasPreviousPage} onClick={() => onPage(pagination.page - 1)}>{text.previous}</Button>
    <span>{text.page} {pagination.page} / {pagination.totalPages}</span>
    <Button variant="secondary" size="sm" disabled={!pagination.hasNextPage} onClick={() => onPage(pagination.page + 1)}>{text.next}</Button>
  </nav>;
}

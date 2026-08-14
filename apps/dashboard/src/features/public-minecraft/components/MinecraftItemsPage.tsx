import { useMemo, useCallback, useEffect, useState } from "react";
import type { MinecraftEnchant, MinecraftItem } from "@streamops/shared";
import { getMinecraftEnchants, getMinecraftItems } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { useMinecraftCatalog } from "../hooks/useMinecraftCatalog";
import { useMinecraftRoute } from "../hooks/useMinecraftRoute";
import { minecraftSearchQueryFromUrl, setMinecraftSearchUrl } from "../utils/routes";
import { resolveMinecraftName } from "../utils/names";
import { formatMinecraftTemplate, MinecraftCatalogShell, MinecraftName } from "./MinecraftCatalogShell";
import { MinecraftItemImage } from "./MinecraftItemImage";

function ItemRow({ enchants, item, locale }: {
  enchants: readonly MinecraftEnchant[];
  item: MinecraftItem;
  locale: MinecraftLocale;
}) {
  const text = minecraftI18n[locale];
  const name = resolveMinecraftName(item.name, locale);
  return (
    <li className="minecraft-item-row" data-testid="minecraft-item-row">
      <span className="minecraft-item-row__slot">
        <MinecraftItemImage decorative fallbackText={name.text} id={item.id} label={name.text} />
      </span>
      <MinecraftName fallback={name.fallback} locale={locale} text={name.text} />
      {/* ID 는 보조 위계 — 이름을 지배하던 전폭 막대 결함의 수정점(내용 폭 모노스페이스) */}
      <code className="minecraft-item-row__id">{item.id}</code>
      <span className="minecraft-item-row__facts">
        <span>{formatMinecraftTemplate(text.itemStackSize, { count: item.stackSize })}</span>
        {item.maxDurability !== undefined ? (
          <span>{formatMinecraftTemplate(text.itemDurability, { count: item.maxDurability.toLocaleString() })}</span>
        ) : null}
      </span>
      {enchants.length > 0 ? (
        <details className="minecraft-item-row__enchants">
          <summary>{formatMinecraftTemplate(text.itemEnchants, { count: enchants.length })}</summary>
          <span className="minecraft-item-row__enchant-chips">
            {enchants.map((enchant) => (
              <span className="minecraft-chip" key={enchant.id}>
                {resolveMinecraftName(enchant.name, locale).text}
              </span>
            ))}
          </span>
        </details>
      ) : null}
    </li>
  );
}

export function MinecraftItemsPage({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  /* 검색어의 단일 원본은 URL 의 ?q= — 공유·새로고침·뒤로가기·nav 재클릭이 전부 일관됩니다. */
  const { locationRevision } = useMinecraftRoute();
  const search = useMemo(() => minecraftSearchQueryFromUrl(), [locationRevision]);
  const submitSearch = useCallback((value: string) => setMinecraftSearchUrl("items", value), []);
  const fetcher = useCallback(
    (page: number, signal: AbortSignal) => getMinecraftItems({ q: search, page }, signal),
    [search],
  );
  const catalog = useMinecraftCatalog(fetcher, `items:${search}`);

  /* 목업 도구 상세의 "적용 가능 인챈트" 칩 — enchantCategoryIds × 인챈트 카탈로그 교차 참조.
   * 인챈트는 43종(1 페이지)이라 limit=100 한 번으로 전부 확보하고, 실패하면 칩만 조용히 생략합니다. */
  const [enchantsByCategory, setEnchantsByCategory] = useState<ReadonlyMap<string, readonly MinecraftEnchant[]>>(new Map());
  useEffect(() => {
    const controller = new AbortController();
    void getMinecraftEnchants({ limit: 100 }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || response.state !== "ready") return;
        const grouped = new Map<string, MinecraftEnchant[]>();
        for (const enchant of response.items) {
          const bucket = grouped.get(enchant.categoryId) ?? [];
          bucket.push(enchant);
          grouped.set(enchant.categoryId, bucket);
        }
        setEnchantsByCategory(grouped);
      })
      .catch(() => {
        /* 인챈트 칩은 부가 정보 — 실패 시 목록 자체는 그대로 제공합니다. */
      });
    return () => controller.abort();
  }, []);

  const enchantsFor = useCallback((item: MinecraftItem): readonly MinecraftEnchant[] => {
    if (item.enchantCategoryIds.length === 0 || enchantsByCategory.size === 0) return [];
    return item.enchantCategoryIds.flatMap((categoryId) => enchantsByCategory.get(categoryId) ?? []);
  }, [enchantsByCategory]);

  return (
    <MinecraftCatalogShell
      loadMore={() => { void catalog.loadMore(); }}
      loadMoreError={catalog.loadMoreError}
      loadMoreLoading={catalog.loadMoreLoading}
      locale={locale}
      metadata={catalog.metadata}
      onSearch={submitSearch}
      pagination={catalog.pagination}
      retry={catalog.retry}
      search={search}
      status={catalog.status}
      title={text.items}
      titleId="minecraft-items-title"
    >
      <ul className="minecraft-item-list">
        {catalog.entries.map((entry) => (
          <ItemRow enchants={enchantsFor(entry)} item={entry} key={entry.id} locale={locale} />
        ))}
      </ul>
    </MinecraftCatalogShell>
  );
}

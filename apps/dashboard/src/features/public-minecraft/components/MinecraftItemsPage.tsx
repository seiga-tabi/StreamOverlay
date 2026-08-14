import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { MinecraftEnchant, MinecraftItem } from "@streamops/shared";
import { getMinecraftEnchants, getMinecraftItems } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { useMinecraftCatalog } from "../hooks/useMinecraftCatalog";
import { minecraftTileHue, resolveMinecraftName } from "../utils/names";
import { formatMinecraftTemplate, MinecraftCatalogShell, MinecraftName } from "./MinecraftCatalogShell";

function ItemRow({ enchants, item, locale }: {
  enchants: readonly MinecraftEnchant[];
  item: MinecraftItem;
  locale: MinecraftLocale;
}) {
  const text = minecraftI18n[locale];
  const name = resolveMinecraftName(item.name, locale);
  return (
    <li className="minecraft-item-row" data-testid="minecraft-item-row">
      <span
        aria-hidden="true"
        className="minecraft-item-swatch"
        style={{ "--minecraft-tile-hue": minecraftTileHue(item.id) } as CSSProperties}
      >
        {name.text.slice(0, 2)}
      </span>
      <span className="minecraft-item-row__copy">
        <MinecraftName fallback={name.fallback} locale={locale} text={name.text} />
        <code>{item.id}</code>
      </span>
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
  const [search, setSearch] = useState("");
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
      onSearch={setSearch}
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

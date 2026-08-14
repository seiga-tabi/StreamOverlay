import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { MinecraftEnchant, MinecraftLocalizedName } from "@streamops/shared";
import { getMinecraftEnchants } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { useMinecraftCatalog } from "../hooks/useMinecraftCatalog";
import { minecraftNameFromId, minecraftTileHue, resolveMinecraftName } from "../utils/names";
import { formatMinecraftTemplate, MinecraftCatalogShell, MinecraftName } from "./MinecraftCatalogShell";

function EnchantCard({ enchant, locale, namesById }: {
  enchant: MinecraftEnchant;
  locale: MinecraftLocale;
  namesById: ReadonlyMap<string, MinecraftLocalizedName>;
}) {
  const text = minecraftI18n[locale];
  const name = resolveMinecraftName(enchant.name, locale);
  const incompatibleNames = enchant.incompatibleIds.map((id) => {
    const known = namesById.get(id);
    return known ? resolveMinecraftName(known, locale).text : minecraftNameFromId(id);
  });
  return (
    <article className="minecraft-enchant-card" data-testid="minecraft-enchant-card">
      <h2 className="minecraft-enchant-card__title">
        <span
          aria-hidden="true"
          className="minecraft-item-swatch"
          style={{ "--minecraft-tile-hue": minecraftTileHue(enchant.id) } as CSSProperties}
        >
          {name.text.slice(0, 2)}
        </span>
        <MinecraftName fallback={name.fallback} locale={locale} text={name.text} />
        <span className="minecraft-pill">
          {formatMinecraftTemplate(text.enchantMaxLevel, { count: enchant.maxLevel })}
        </span>
      </h2>
      <div className="minecraft-enchant-card__chips">
        {enchant.curse ? <span className="minecraft-chip is-warning">{text.enchantCurse}</span> : null}
        {enchant.treasureOnly ? <span className="minecraft-chip">{text.enchantTreasure}</span> : null}
        {enchant.discoverable ? <span className="minecraft-chip">{text.enchantFromTable}</span> : null}
        {enchant.tradeable
          ? <span className="minecraft-chip">{text.enchantFromTrade}</span>
          : <span className="minecraft-chip">{text.enchantNotTradeable}</span>}
      </div>
      <dl className="minecraft-recipe-card__facts">
        <dt>{text.enchantCategory}</dt>
        <dd><code>{enchant.categoryId}</code></dd>
        {incompatibleNames.length > 0 ? (
          <>
            <dt>{text.enchantIncompatibleLabel}</dt>
            <dd>{incompatibleNames.join(" · ")}</dd>
          </>
        ) : null}
      </dl>
    </article>
  );
}

export function MinecraftEnchantsPage({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  const [search, setSearch] = useState("");
  const fetcher = useCallback(
    (page: number, signal: AbortSignal) => getMinecraftEnchants({ q: search, page }, signal),
    [search],
  );
  const catalog = useMinecraftCatalog(fetcher, `enchants:${search}`);

  /* 상충 ID → 명칭 해석용 누적 캐시 — 검색으로 목록이 좁아져도 이미 본 명칭은 유지되고,
     한 번도 못 본 ID 는 minecraftNameFromId 로 표기합니다. */
  const [namesById, setNamesById] = useState<ReadonlyMap<string, MinecraftLocalizedName>>(new Map());
  useEffect(() => {
    if (catalog.entries.length === 0) return;
    setNamesById((previous) => {
      const next = new Map(previous);
      for (const entry of catalog.entries) next.set(entry.id, entry.name);
      return next;
    });
  }, [catalog.entries]);

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
      title={text.enchants}
      titleId="minecraft-enchants-title"
    >
      <div className="minecraft-enchant-list">
        {catalog.entries.map((entry) => (
          <EnchantCard enchant={entry} key={entry.id} locale={locale} namesById={namesById} />
        ))}
      </div>
    </MinecraftCatalogShell>
  );
}

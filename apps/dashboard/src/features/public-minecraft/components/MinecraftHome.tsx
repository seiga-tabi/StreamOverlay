import { useEffect, useState, type MouseEvent } from "react";
import type { MinecraftCatalogMetadata } from "@streamops/shared";
import { getMinecraftItems, MINECRAFT_SEARCH_MAX_LENGTH } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { setMinecraftUrl, setMinecraftSearchUrl, minecraftPathForPage, type MinecraftPage } from "../utils/routes";
import { formatMinecraftTemplate } from "./MinecraftCatalogShell";
import { MinecraftItemImage } from "./MinecraftItemImage";

type MinecraftSearchScope = Extract<MinecraftPage, "recipes" | "items" | "enchants">;

const SCOPES: readonly MinecraftSearchScope[] = ["recipes", "items", "enchants"];

/* 마인크래프트 위키 홈 — 히어로가 곧 검색입니다(docs/mockups/minecraft-home-redesign.html).
 *
 * 검색은 신규 API 없이 카탈로그 페이지의 ?q= 로 이동만 하고, 수치는
 * /api/minecraft/items?limit=1 한 번의 metadata.coverage 를 코어 카드에 배분합니다.
 * 실패·data_unavailable 이면 수치 없이 카드만 남습니다(가짜 수치 금지).
 */
export function MinecraftHome({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  const [metadata, setMetadata] = useState<MinecraftCatalogMetadata | null>(null);
  const [scope, setScope] = useState<MinecraftSearchScope>("recipes");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void getMinecraftItems({ limit: 1 }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || response.state !== "ready") return;
        setMetadata(response.metadata);
      })
      .catch(() => {
        /* 준비 중 문구 유지 — 홈에서는 오류 상태를 별도로 그리지 않습니다. */
      });
    return () => controller.abort();
  }, []);

  const scopeLabels: Record<MinecraftSearchScope, string> = {
    recipes: text.recipes,
    items: text.items,
    enchants: text.enchants,
  };

  const coreCards: Array<{
    page: MinecraftSearchScope;
    textureId: string;
    title: string;
    description: string;
    count: number | undefined;
    countTemplate: string;
  }> = [
    {
      page: "recipes",
      textureId: "crafting_table",
      title: text.catRecipesTitle,
      description: text.catRecipesDescription,
      count: metadata?.coverage.recipes,
      countTemplate: text.homeCountRecipes,
    },
    {
      page: "items",
      textureId: "diamond_pickaxe",
      title: text.catItemsTitle,
      description: text.catItemsDescription,
      count: metadata?.coverage.items,
      countTemplate: text.homeCountItems,
    },
    {
      page: "enchants",
      textureId: "enchanted_book",
      title: text.catEnchantsTitle,
      description: text.catEnchantsDescription,
      count: metadata?.coverage.enchants,
      countTemplate: text.homeCountEnchants,
    },
  ];

  const cardClick = (page: MinecraftPage) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setMinecraftUrl(minecraftPathForPage(page));
  };

  return (
    <div className="minecraft-home">
      <section aria-labelledby="minecraft-hero-title" className="minecraft-hero minecraft-grass-top">
        <span aria-hidden="true" className="minecraft-hero__kicker">{text.heroKicker}</span>
        <h1
          className="minecraft-hero__title"
          data-ja={minecraftI18n.ja.heroTitle}
          data-ko={minecraftI18n.ko.heroTitle}
          id="minecraft-hero-title"
        >
          {text.heroTitle}
        </h1>
        <p data-ja={minecraftI18n.ja.heroDescription} data-ko={minecraftI18n.ko.heroDescription}>
          {text.heroDescription}
        </p>
        <form
          aria-label={text.searchLabel}
          className="minecraft-hero__search"
          onSubmit={(event) => {
            event.preventDefault();
            setMinecraftSearchUrl(scope, query);
          }}
          role="search"
        >
          <input
            aria-label={text.searchLabel}
            maxLength={MINECRAFT_SEARCH_MAX_LENGTH}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.homeSearchPlaceholder}
            type="search"
            value={query}
          />
          <button type="submit">{text.homeSearchSubmit}</button>
        </form>
        <div aria-label={text.homeScopeLabel} className="minecraft-hero__scope" role="group">
          {SCOPES.map((candidate) => (
            <button
              aria-pressed={scope === candidate}
              key={candidate}
              onClick={() => setScope(candidate)}
              type="button"
            >
              {scopeLabels[candidate]}
            </button>
          ))}
        </div>
        {metadata ? (
          <p className="minecraft-hero__statline" data-testid="minecraft-home-stats">
            {formatMinecraftTemplate(text.homeVersionLine, { version: metadata.gameVersion })}
          </p>
        ) : (
          <span
            className="minecraft-hero__status"
            data-ja={minecraftI18n.ja.heroStatus}
            data-ko={minecraftI18n.ko.heroStatus}
          >
            {text.heroStatus}
          </span>
        )}
      </section>

      <nav aria-label={text.homeCoreLabel} className="minecraft-core">
        {coreCards.map((card) => (
          <a
            className="minecraft-core-card"
            href={minecraftPathForPage(card.page)}
            key={card.page}
            onClick={cardClick(card.page)}
          >
            <span aria-hidden="true" className="minecraft-core-card__arrow">→</span>
            <span className="minecraft-core-card__head">
              <MinecraftItemImage decorative fallbackText={card.title} id={card.textureId} label={card.title} />
              <h3>{card.title}</h3>
            </span>
            {card.count !== undefined ? (
              <span className="minecraft-core-card__count">
                {card.count.toLocaleString()}
                <small>{card.countTemplate.replace("{count}", "").trim()}</small>
              </span>
            ) : null}
            <p>{card.description}</p>
          </a>
        ))}
      </nav>

      <div className="minecraft-aux">
        <a className="minecraft-aux-card" href={minecraftPathForPage("library")} onClick={cardClick("library")}>
          <span className="minecraft-aux-card__copy">
            <strong>{text.catLibraryTitle}</strong>
            <p>{text.catLibraryDescription}</p>
          </span>
          <span className="minecraft-aux-card__badge">{text.comingSoonBadge}</span>
        </a>
        <a className="minecraft-aux-card" href={minecraftPathForPage("patchNotes")} onClick={cardClick("patchNotes")}>
          <span className="minecraft-aux-card__copy">
            <strong>{text.catPatchTitle}</strong>
            <p>{text.catPatchDescription}</p>
          </span>
          <span className="minecraft-aux-card__badge">{text.comingSoonBadge}</span>
        </a>
        <article className="minecraft-aux-card is-dim">
          <span className="minecraft-aux-card__copy">
            <strong>{text.catMobsTitle}</strong>
            <p>{text.catMobsDescription}</p>
          </span>
          <span className="minecraft-aux-card__badge is-next">{text.catMobsPhase}</span>
        </article>
      </div>

      <footer className="minecraft-home__foot">
        {metadata ? (
          <p className="minecraft-unofficial-note">
            {formatMinecraftTemplate(text.dataSourceNote, { version: metadata.gameVersion })}
          </p>
        ) : null}
        <p className="minecraft-unofficial-note" data-ja={minecraftI18n.ja.unofficialNotice} data-ko={minecraftI18n.ko.unofficialNotice}>
          {text.unofficialNotice}
        </p>
      </footer>
    </div>
  );
}

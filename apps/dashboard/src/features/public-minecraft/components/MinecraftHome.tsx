import { useEffect, useState } from "react";
import type { MinecraftCatalogMetadata } from "@streamops/shared";
import { getMinecraftItems } from "../api/minecraft";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { setMinecraftUrl, minecraftPathForPage, type MinecraftPage } from "../utils/routes";
import { formatMinecraftTemplate } from "./MinecraftCatalogShell";

/* 마인크래프트 위키 홈 — 카탈로그 metadata 로 실제 수치를 소개합니다.
 *
 * 수치는 /api/minecraft/items?limit=1 한 번으로 얻는 metadata.coverage 이며,
 * 실패하거나 data_unavailable 이면 기존 "준비 중" 문구를 그대로 유지합니다(가짜 수치 금지).
 * 근거: docs/mockups/minecraft-vertical.html §02·§09 (라이선스·자체 작성 원칙)
 */
export function MinecraftHome({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  const [metadata, setMetadata] = useState<MinecraftCatalogMetadata | null>(null);

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

  const categories: Array<{
    key: string;
    page?: MinecraftPage;
    title: string;
    description: string;
    phase?: string;
  }> = [
    { key: "recipes", page: "recipes", title: text.catRecipesTitle, description: text.catRecipesDescription },
    { key: "items", page: "items", title: text.catItemsTitle, description: text.catItemsDescription },
    { key: "enchants", page: "enchants", title: text.catEnchantsTitle, description: text.catEnchantsDescription },
    { key: "mobs", title: text.catMobsTitle, description: text.catMobsDescription, phase: text.catMobsPhase },
    { key: "library", page: "library", title: text.catLibraryTitle, description: text.catLibraryDescription },
    { key: "patch", page: "patchNotes", title: text.catPatchTitle, description: text.catPatchDescription },
  ];

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
        {metadata ? (
          <span className="minecraft-hero__status is-ready" data-testid="minecraft-home-stats">
            {formatMinecraftTemplate(text.homeStatsReady, {
              version: metadata.gameVersion,
              items: metadata.coverage.items.toLocaleString(),
              recipes: metadata.coverage.recipes.toLocaleString(),
              enchants: metadata.coverage.enchants.toLocaleString(),
            })}
          </span>
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

      <section aria-labelledby="minecraft-category-title" className="minecraft-categories">
        <h2 data-ja={minecraftI18n.ja.categoryTitle} data-ko={minecraftI18n.ko.categoryTitle} id="minecraft-category-title">
          {text.categoryTitle}
        </h2>
        <div className="minecraft-categories__grid">
          {categories.map((category) => (
            category.page ? (
              <a
                className="minecraft-category-card is-link"
                href={minecraftPathForPage(category.page)}
                key={category.key}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  setMinecraftUrl(minecraftPathForPage(category.page!));
                }}
              >
                <h3>{category.title}</h3>
                <p>{category.description}</p>
              </a>
            ) : (
              <article className="minecraft-category-card" key={category.key}>
                <h3>
                  {category.title}
                  {category.phase
                    ? <span className="minecraft-category-card__phase">{category.phase}</span>
                    : null}
                </h3>
                <p>{category.description}</p>
              </article>
            )
          ))}
        </div>
        <p className="minecraft-unofficial-note" data-ja={minecraftI18n.ja.unofficialNotice} data-ko={minecraftI18n.ko.unofficialNotice}>
          {text.unofficialNotice}
        </p>
      </section>
    </div>
  );
}

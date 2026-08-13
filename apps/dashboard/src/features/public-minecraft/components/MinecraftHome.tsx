import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";

/* 마인크래프트 위키 홈 — 준비 단계의 정직한 소개 화면.
 *
 * 카탈로그 파이프라인(/api/minecraft/* contract, Codex handoff)이 연결되기 전이라
 * 검색 입력·가짜 수치를 두지 않고, 위키의 실제 구성과 원칙만 소개합니다.
 * 근거: docs/mockups/minecraft-vertical.html §02·§09 (라이선스·자체 작성 원칙)
 */
export function MinecraftHome({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  const categories = [
    { key: "recipes", title: text.catRecipesTitle, description: text.catRecipesDescription },
    { key: "items", title: text.catItemsTitle, description: text.catItemsDescription },
    { key: "enchants", title: text.catEnchantsTitle, description: text.catEnchantsDescription },
    { key: "mobs", title: text.catMobsTitle, description: text.catMobsDescription, phase: text.catMobsPhase },
    { key: "library", title: text.catLibraryTitle, description: text.catLibraryDescription },
    { key: "patch", title: text.catPatchTitle, description: text.catPatchDescription },
  ] as const;

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
        <span
          className="minecraft-hero__status"
          data-ja={minecraftI18n.ja.heroStatus}
          data-ko={minecraftI18n.ko.heroStatus}
        >
          {text.heroStatus}
        </span>
      </section>

      <section aria-labelledby="minecraft-category-title" className="minecraft-categories">
        <h2 data-ja={minecraftI18n.ja.categoryTitle} data-ko={minecraftI18n.ko.categoryTitle} id="minecraft-category-title">
          {text.categoryTitle}
        </h2>
        <div className="minecraft-categories__grid">
          {categories.map((category) => (
            <article className="minecraft-category-card" key={category.key}>
              <h3>
                {category.title}
                {"phase" in category && category.phase
                  ? <span className="minecraft-category-card__phase">{category.phase}</span>
                  : null}
              </h3>
              <p>{category.description}</p>
            </article>
          ))}
        </div>
        <p className="minecraft-unofficial-note" data-ja={minecraftI18n.ja.unofficialNotice} data-ko={minecraftI18n.ko.unofficialNotice}>
          {text.unofficialNotice}
        </p>
      </section>
    </div>
  );
}

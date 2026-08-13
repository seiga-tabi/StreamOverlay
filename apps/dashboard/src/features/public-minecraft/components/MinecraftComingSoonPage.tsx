import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { setMinecraftUrl, type MinecraftPage } from "../utils/routes";

type ComingSoonPage = Exclude<MinecraftPage, "home">;

/* 데이터 화면의 정직한 준비 중 상태 — 가짜 표본으로 채우지 않습니다.
   실데이터 연결은 /api/minecraft/* 카탈로그 contract(Codex handoff) 이후입니다. */
export function MinecraftComingSoonPage({ locale, page }: {
  locale: MinecraftLocale;
  page: ComingSoonPage;
}) {
  const text = minecraftI18n[locale];
  const keys: Record<ComingSoonPage, { title: "recipesComingSoonTitle" | "itemsComingSoonTitle" | "enchantsComingSoonTitle" | "libraryComingSoonTitle" | "patchNotesComingSoonTitle"; description: "recipesComingSoonDescription" | "itemsComingSoonDescription" | "enchantsComingSoonDescription" | "libraryComingSoonDescription" | "patchNotesComingSoonDescription" }> = {
    recipes: { title: "recipesComingSoonTitle", description: "recipesComingSoonDescription" },
    items: { title: "itemsComingSoonTitle", description: "itemsComingSoonDescription" },
    enchants: { title: "enchantsComingSoonTitle", description: "enchantsComingSoonDescription" },
    library: { title: "libraryComingSoonTitle", description: "libraryComingSoonDescription" },
    patchNotes: { title: "patchNotesComingSoonTitle", description: "patchNotesComingSoonDescription" },
  };
  const selected = keys[page];

  return (
    <EmptyState aria-labelledby={`minecraft-${page}-coming-soon`} className="minecraft-coming-soon">
      <EmptyStateIcon>{text.comingSoonBadge}</EmptyStateIcon>
      <EmptyStateTitle
        data-ja={minecraftI18n.ja[selected.title]}
        data-ko={minecraftI18n.ko[selected.title]}
        id={`minecraft-${page}-coming-soon`}
      >
        {text[selected.title]}
      </EmptyStateTitle>
      <EmptyStateDescription
        data-ja={minecraftI18n.ja[selected.description]}
        data-ko={minecraftI18n.ko[selected.description]}
      >
        {text[selected.description]}
      </EmptyStateDescription>
      <EmptyStateActions>
        <Button
          data-ja={minecraftI18n.ja.backHome}
          data-ko={minecraftI18n.ko.backHome}
          onClick={() => setMinecraftUrl("/minecraft")}
          variant="secondary"
        >
          {text.backHome}
        </Button>
      </EmptyStateActions>
    </EmptyState>
  );
}

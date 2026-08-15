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

type ComingSoonPage = Extract<MinecraftPage, "library">;

/* 자료실·패치 노트의 정직한 준비 중 상태 — 가짜 표본으로 채우지 않습니다.
   조합법·아이템·인챈트는 2단계에서 실데이터 페이지로 전환되었고,
   남은 두 화면은 3단계 handoff(피드 수집·큐레이션 계약) 이후 연결합니다. */
export function MinecraftComingSoonPage({ locale, page }: {
  locale: MinecraftLocale;
  page: ComingSoonPage;
}) {
  const text = minecraftI18n[locale];
  const keys: Record<ComingSoonPage, { title: "libraryComingSoonTitle"; description: "libraryComingSoonDescription" }> = {
    library: { title: "libraryComingSoonTitle", description: "libraryComingSoonDescription" },
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

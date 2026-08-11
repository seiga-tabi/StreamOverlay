import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";
import { setValorantUrl, type ValorantPage } from "../utils/routes";

type ComingSoonPage = Exclude<ValorantPage, "home">;

/* 데이터 화면의 정직한 준비 중 상태 — 가짜 표본으로 채우지 않습니다.
   실데이터 연결은 /api/valorant/* contract(Codex handoff) 이후입니다. */
export function ValorantComingSoonPage({ locale, page }: {
  locale: ValorantLocale;
  page: ComingSoonPage;
}) {
  const text = valorantI18n[locale];
  const copy: Record<ComingSoonPage, { title: string; titleKo: string; titleJa: string; description: string; descriptionKo: string; descriptionJa: string }> = {
    agents: {
      title: text.agentsComingSoonTitle,
      titleKo: valorantI18n.ko.agentsComingSoonTitle,
      titleJa: valorantI18n.ja.agentsComingSoonTitle,
      description: text.agentsComingSoonDescription,
      descriptionKo: valorantI18n.ko.agentsComingSoonDescription,
      descriptionJa: valorantI18n.ja.agentsComingSoonDescription,
    },
    weapons: {
      title: text.weaponsComingSoonTitle,
      titleKo: valorantI18n.ko.weaponsComingSoonTitle,
      titleJa: valorantI18n.ja.weaponsComingSoonTitle,
      description: text.weaponsComingSoonDescription,
      descriptionKo: valorantI18n.ko.weaponsComingSoonDescription,
      descriptionJa: valorantI18n.ja.weaponsComingSoonDescription,
    },
    maps: {
      title: text.mapsComingSoonTitle,
      titleKo: valorantI18n.ko.mapsComingSoonTitle,
      titleJa: valorantI18n.ja.mapsComingSoonTitle,
      description: text.mapsComingSoonDescription,
      descriptionKo: valorantI18n.ko.mapsComingSoonDescription,
      descriptionJa: valorantI18n.ja.mapsComingSoonDescription,
    },
    ranked: {
      title: text.rankedComingSoonTitle,
      titleKo: valorantI18n.ko.rankedComingSoonTitle,
      titleJa: valorantI18n.ja.rankedComingSoonTitle,
      description: text.rankedComingSoonDescription,
      descriptionKo: valorantI18n.ko.rankedComingSoonDescription,
      descriptionJa: valorantI18n.ja.rankedComingSoonDescription,
    },
  };
  const selected = copy[page];

  return (
    <EmptyState aria-labelledby={`valorant-${page}-coming-soon`} className="valorant-coming-soon">
      <EmptyStateIcon aria-hidden="true">…</EmptyStateIcon>
      <EmptyStateTitle
        data-ja={selected.titleJa}
        data-ko={selected.titleKo}
        id={`valorant-${page}-coming-soon`}
      >
        {selected.title}
      </EmptyStateTitle>
      <EmptyStateDescription data-ja={selected.descriptionJa} data-ko={selected.descriptionKo}>
        {selected.description}
      </EmptyStateDescription>
      <EmptyStateActions>
        <Button
          data-ja={valorantI18n.ja.backHome}
          data-ko={valorantI18n.ko.backHome}
          onClick={() => setValorantUrl("/valorant")}
          variant="secondary"
        >
          {text.backHome}
        </Button>
      </EmptyStateActions>
    </EmptyState>
  );
}

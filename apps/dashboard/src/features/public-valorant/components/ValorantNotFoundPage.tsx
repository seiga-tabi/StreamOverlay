import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";
import { setValorantUrl } from "../utils/routes";

export function ValorantNotFoundPage({ locale }: { locale: ValorantLocale }) {
  const text = valorantI18n[locale];
  return (
    <EmptyState aria-labelledby="valorant-not-found-title" variant="error">
      <EmptyStateIcon>404</EmptyStateIcon>
      <EmptyStateTitle
        data-ja={valorantI18n.ja.notFoundTitle}
        data-ko={valorantI18n.ko.notFoundTitle}
        id="valorant-not-found-title"
      >
        {text.notFoundTitle}
      </EmptyStateTitle>
      <EmptyStateDescription data-ja={valorantI18n.ja.notFoundDescription} data-ko={valorantI18n.ko.notFoundDescription}>
        {text.notFoundDescription}
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

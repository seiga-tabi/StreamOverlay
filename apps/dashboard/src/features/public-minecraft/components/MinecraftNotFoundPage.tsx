import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { setMinecraftUrl } from "../utils/routes";

export function MinecraftNotFoundPage({ locale }: { locale: MinecraftLocale }) {
  const text = minecraftI18n[locale];
  return (
    <EmptyState aria-labelledby="minecraft-not-found-title" variant="error">
      <EmptyStateIcon>404</EmptyStateIcon>
      <EmptyStateTitle
        data-ja={minecraftI18n.ja.notFoundTitle}
        data-ko={minecraftI18n.ko.notFoundTitle}
        id="minecraft-not-found-title"
      >
        {text.notFoundTitle}
      </EmptyStateTitle>
      <EmptyStateDescription data-ja={minecraftI18n.ja.notFoundDescription} data-ko={minecraftI18n.ko.notFoundDescription}>
        {text.notFoundDescription}
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

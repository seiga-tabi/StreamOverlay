import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { minecraftI18n } from "../i18n/minecraft-i18n";

export class MinecraftPageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: true } {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // 브라우저에는 원문 오류나 stack을 노출하지 않습니다.
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const locale = typeof document !== "undefined" && document.documentElement.lang.startsWith("ja")
      ? "ja"
      : "ko";
    const text = minecraftI18n[locale];
    return (
      <main className="public-lol-shell public-dashboard-shell minecraft-shell" id="minecraft-main">
        <EmptyState variant="error" role="alert">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle data-ja={minecraftI18n.ja.errorTitle} data-ko={minecraftI18n.ko.errorTitle}>
            {text.errorTitle}
          </EmptyStateTitle>
          <EmptyStateDescription data-ja={minecraftI18n.ja.errorDescription} data-ko={minecraftI18n.ko.errorDescription}>
            {text.errorDescription}
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button
              data-ja={minecraftI18n.ja.errorReload}
              data-ko={minecraftI18n.ko.errorReload}
              onClick={() => window.location.reload()}
              variant="secondary"
            >
              {text.errorReload}
            </Button>
          </EmptyStateActions>
        </EmptyState>
      </main>
    );
  }
}

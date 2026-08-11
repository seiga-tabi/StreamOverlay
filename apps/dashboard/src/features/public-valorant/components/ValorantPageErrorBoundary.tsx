import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../../../shared/ui/EmptyState";
import { valorantI18n } from "../i18n/valorant-i18n";

export class ValorantPageErrorBoundary extends Component<
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
    const text = valorantI18n[locale];
    return (
      <main className="public-lol-shell public-dashboard-shell valorant-shell" id="valorant-main">
        <EmptyState variant="error" role="alert">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle data-ja={valorantI18n.ja.errorTitle} data-ko={valorantI18n.ko.errorTitle}>
            {text.errorTitle}
          </EmptyStateTitle>
          <EmptyStateDescription data-ja={valorantI18n.ja.errorDescription} data-ko={valorantI18n.ko.errorDescription}>
            {text.errorDescription}
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button
              data-ja={valorantI18n.ja.errorReload}
              data-ko={valorantI18n.ko.errorReload}
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

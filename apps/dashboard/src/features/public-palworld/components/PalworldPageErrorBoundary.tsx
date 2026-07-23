import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../../../shared/ui/Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle
} from "../../../shared/ui/EmptyState";

const text = {
  ko: {
    title: "Palworld 페이지를 표시할 수 없습니다.",
    description: "페이지 파일을 불러오거나 화면을 구성하는 중 문제가 발생했습니다. 다시 시도해 주세요.",
    retry: "다시 시도",
    reload: "페이지 새로고침",
    home: "Palworld 홈"
  },
  ja: {
    title: "Palworld ページを表示できません。",
    description: "ページファイルの読み込み、または画面の表示中に問題が発生しました。もう一度お試しください。",
    retry: "もう一度試す",
    reload: "ページを再読み込み",
    home: "Palworld ホーム"
  }
} as const;

export class PalworldPageErrorBoundary extends Component<
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
    const localized = text[locale];
    return (
      <main className="public-lol-shell public-dashboard-shell palworld-shell" id="palworld-main">
        <EmptyState variant="error" role="alert">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle data-ko={text.ko.title} data-ja={text.ja.title}>
            {localized.title}
          </EmptyStateTitle>
          <EmptyStateDescription data-ko={text.ko.description} data-ja={text.ja.description}>
            {localized.description}
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button
              variant="secondary"
              onClick={() => this.setState({ failed: false })}
              data-ko={text.ko.retry}
              data-ja={text.ja.retry}
            >
              {localized.retry}
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
              data-ko={text.ko.reload}
              data-ja={text.ja.reload}
            >
              {localized.reload}
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.location.assign("/palworld")}
              data-ko={text.ko.home}
              data-ja={text.ja.home}
            >
              {localized.home}
            </Button>
          </EmptyStateActions>
        </EmptyState>
      </main>
    );
  }
}

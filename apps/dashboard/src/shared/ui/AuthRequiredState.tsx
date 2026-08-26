import type { DashboardLocale } from "../../i18n";
import { Button } from "./Button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle
} from "./EmptyState";
import "./AuthRequiredState.css";

type LocalizedAuthRequiredText = Readonly<Record<DashboardLocale, string>>;

export type AuthRequiredStateProps = {
  locale: DashboardLocale;
  title: LocalizedAuthRequiredText;
  description: LocalizedAuthRequiredText;
  loginLabel: LocalizedAuthRequiredText;
  loginHref: string;
};

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width="24"
    >
      <rect height="10" rx="2" width="15" x="4.5" y="10" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </svg>
  );
}

export function AuthRequiredState({
  locale,
  title,
  description,
  loginLabel,
  loginHref
}: AuthRequiredStateProps) {
  return (
    <main className="yoro-auth-required-state">
      <div className="yoro-auth-required-state__container">
        <EmptyState className="yoro-auth-required-state__card">
          <EmptyStateIcon>
            <LockIcon />
          </EmptyStateIcon>
          <EmptyStateTitle data-ja={title.ja} data-ko={title.ko}>
            {title[locale]}
          </EmptyStateTitle>
          <EmptyStateDescription data-ja={description.ja} data-ko={description.ko}>
            {description[locale]}
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button
              as="a"
              data-ja={loginLabel.ja}
              data-ko={loginLabel.ko}
              href={loginHref}
              size="lg"
            >
              {loginLabel[locale]}
            </Button>
          </EmptyStateActions>
        </EmptyState>
      </div>
    </main>
  );
}

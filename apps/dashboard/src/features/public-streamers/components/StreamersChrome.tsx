import type { MouseEvent } from "react";
import { AppShellHeader } from "../../../shared/ui/AppShell";
import { HomeHeader } from "../../public-home/components/HomeHeader";
import { TailUnderline } from "../../public-home/components/HomeMarks";
import { homeI18n } from "../../public-home/i18n/home-i18n";
import { streamersI18n, type StreamersLocale } from "../i18n/streamers-i18n";
import {
  setStreamersUrl,
  streamersHref,
  streamersScopePath,
  type StreamerScope,
} from "../utils/routes";

/* 스트리머 게시판 상단바 한 벌 — 메인 홈과 같은 1행(HomeHeader) +
 * 게시판 고유 게임 범위 2행 메뉴. 형제 게임 크롬과 같은 조립 문법과
 * 공용 .yoro-lol-subnav 클래스를 그대로 재사용합니다. */

export const streamerScopeItems: Array<{
  scope: StreamerScope;
  ko: string;
  ja: string;
  en: string;
}> = [
  { scope: "all", ko: streamersI18n.ko.scopeAll, ja: streamersI18n.ja.scopeAll, en: streamersI18n.en.scopeAll },
  { scope: "lol", ko: streamersI18n.ko.scopeLol, ja: streamersI18n.ja.scopeLol, en: streamersI18n.en.scopeLol },
  { scope: "valorant", ko: streamersI18n.ko.scopeValorant, ja: streamersI18n.ja.scopeValorant, en: streamersI18n.en.scopeValorant },
  { scope: "palworld", ko: streamersI18n.ko.scopePalworld, ja: streamersI18n.ja.scopePalworld, en: streamersI18n.en.scopePalworld },
  { scope: "minecraft", ko: streamersI18n.ko.scopeMinecraft, ja: streamersI18n.ja.scopeMinecraft, en: streamersI18n.en.scopeMinecraft },
];

const SUBNAV_TAIL_WIDTH: Record<StreamerScope, number> = {
  all: 30,
  lol: 56,
  valorant: 44,
  palworld: 36,
  minecraft: 48,
};

export function StreamerScopeIcon({ scope }: { scope: StreamerScope }) {
  const commonProps = {
    "aria-hidden": true,
    fill: "none",
    height: 16,
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
    viewBox: "0 0 24 24",
    width: 16,
  };
  if (scope === "all") {
    return (
      <svg {...commonProps}>
        <rect height="12" rx="2.5" width="14" x="3" y="6" />
        <path d="M17 11l4-2.6v9.2L17 15" />
      </svg>
    );
  }
  return (
    <svg {...commonProps}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function StreamersSubnav({ locale, scope }: {
  locale: StreamersLocale;
  scope: StreamerScope;
}) {
  return (
    <nav
      aria-label={streamersI18n[locale].mainMenu}
      className="yoro-lol-subnav"
      data-testid="streamers-secondary-nav"
    >
      {streamerScopeItems.map((item) => {
        const active = item.scope === scope;
        const path = streamersScopePath(item.scope);
        return (
          <a
            aria-current={active ? "page" : undefined}
            className={`yoro-lol-subnav-item${active ? " is-active" : ""}`}
            data-en={item.en}
            data-ja={item.ja}
            data-ko={item.ko}
            href={streamersHref(path)}
            key={item.scope}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              setStreamersUrl(path);
            }}
          >
            <StreamerScopeIcon scope={item.scope} /> {item[locale]}
            {active ? (
              <TailUnderline
                className="yoro-lol-subnav-tail"
                height={6}
                width={SUBNAV_TAIL_WIDTH[item.scope]}
              />
            ) : null}
          </a>
        );
      })}
    </nav>
  );
}

export function StreamersChrome({
  locale,
  scope,
  accountName,
  connected,
  isStreamerAdmin,
  onStreamerAdmin,
  onLocale,
  onLoginOpen,
  onLogout,
  onToggleTheme,
}: {
  locale: StreamersLocale;
  scope: StreamerScope;
  accountName?: string;
  connected: boolean;
  isStreamerAdmin?: boolean;
  onStreamerAdmin?: () => void;
  onLocale: (locale: StreamersLocale) => void;
  onLoginOpen: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <AppShellHeader as="div" className="yoro-home-chrome streamers-chrome">
      <HomeHeader
        accountName={accountName}
        activeGame="streamers"
        connected={connected}
        isStreamerAdmin={isStreamerAdmin}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={onLocale}
        onLoginOpen={onLoginOpen}
        onLogout={onLogout}
        onStreamerAdmin={onStreamerAdmin}
        onToggleTheme={onToggleTheme}
        text={homeI18n[locale]}
      />
      <StreamersSubnav locale={locale} scope={scope} />
    </AppShellHeader>
  );
}

import type { ReactNode } from "react";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import type { PublicMainPage } from "../../public-lol/types/public-lol";
import { AppShellHeader } from "../../../shared/ui/AppShell";
import { homeI18n } from "../i18n/home-i18n";
import { lolHomeI18n } from "../i18n/lol-home-i18n";
import { HomeHeader } from "./HomeHeader";
import { LolSubnav, type LolSubnavItem } from "./LolHomeSections";

/* LoL 상단바 한 벌 — 1행(HomeHeader) + 2행(LolSubnav)을 항상 같이 렌더하는
 * 단일 조립 지점입니다(2026-08-21 통합 프롬프트 §2-1). 다섯 화면(/lol·/follow·
 * /participation·/lol/aram·/patch-notes)과 전적 상세·검색 랜딩·스트리머 등록이
 * 전부 이 컴포넌트를 씁니다. 1행의 값 규격은
 * docs/handoffs/2026-08-21-app-header-shared-prompt.md 가 단일 원본입니다.
 * 화면별로 달라도 되는 것은 active·accountName·connected·searchSlot 뿐 —
 * 그 밖의 화면별 차이가 필요해 보이면 표류이므로 여기에 prop 을 더하지 말고
 * 규격 문서와 먼저 맞춥니다. */

/** activeMainPage → 2행 활성 항목. 다섯 화면의 활성 규칙은 이 함수 하나가 정한다.
 * `/lol`(LolHome)·`/follow`(Streamers) 는 별도 페이지 파일이라 PublicMainPage 를
 * 거치지 않고 리터럴("home"/"streamers")을 넘긴다 — 그 둘 밖의 활성은 전부 여기. */
export function lolSubnavActive(page: PublicMainPage): LolSubnavItem | "none" {
  switch (page) {
    case "subscriptions": return "streamers";
    case "followJoin": return "participation";
    case "aram": return "aram";
    case "champions": return "champions";
    case "patchNotes": return "patchNotes";
    default: return "none";
  }
}

export function LolChrome({
  active,
  locale,
  accountName,
  connected,
  isStreamerAdmin,
  onStreamerAdmin,
  searchSlot,
  onLocale,
  onLoginOpen,
  onLogout,
  onToggleTheme,
  className,
  children
}: {
  active: LolSubnavItem | "none";
  locale: PublicLocale;
  accountName?: string;
  connected: boolean;
  isStreamerAdmin?: boolean;
  onStreamerAdmin?: () => void;
  /* 전적 상세·메뉴 페이지의 컴팩트 검색바 — HomeHeader searchSlot 로 그대로 전달. */
  searchSlot?: ReactNode;
  onLocale: (locale: PublicLocale) => void;
  onLoginOpen: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  /* wrapper 에 덧붙일 화면별 클래스(예: public-standard-header-frame). */
  className?: string;
  /* 2행 아래 크롬 안에 붙는 화면 전용 조각(전적 상세의 진행 헤어라인). */
  children?: ReactNode;
}) {
  return (
    <AppShellHeader as="div" className={`yoro-home-chrome${className ? ` ${className}` : ""}`}>
      <HomeHeader
        accountName={accountName}
        activeGame="lol"
        connected={connected}
        isStreamerAdmin={isStreamerAdmin}
        locale={locale}
        onDashboard={() => window.location.assign("/dashboard")}
        onLocale={onLocale}
        onLoginOpen={onLoginOpen}
        onLogout={onLogout}
        onStreamerAdmin={onStreamerAdmin}
        onToggleTheme={onToggleTheme}
        searchSlot={searchSlot}
        text={homeI18n[locale]}
      />
      <LolSubnav active={active} text={lolHomeI18n[locale]} />
      {children}
    </AppShellHeader>
  );
}

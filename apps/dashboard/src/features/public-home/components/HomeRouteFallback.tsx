import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import { homeI18n } from "../i18n/home-i18n";
import { HomeBottomTabBar } from "./HomeTabBar";
import { HomeHeader } from "./HomeHeader";
import { HomeHero } from "./HomeHero";
import {
  GameCard,
  HomeBotSection,
  HomeBreedingSection,
  HomeChartSkeleton,
  HomeFooter,
  HomeLiveCardSkeleton,
  LolCardIcon,
  PalCardIcon,
  SectionHead
} from "./HomeStaticSections";

/* 메인 홈 라우트 폴백 — 목업 「홈 로딩」 4장(다크/라이트 × 데스크톱/모바일).
 *
 * 흰 SkeletonCard 널판(#root 전폭) 대신, 완성 화면과 같은 크롬·히어로를 실물로
 * 먼저 그립니다. 홈은 데이터를 거의 기다리지 않습니다 — 히어로의 게임 카테고리
 * 타일은 평범한 <a href> 라 청크 도착 전에도 완전히 동작합니다(키아트 2장은
 * eager 로 바로 요청). 스켈레톤은 데이터가 들어올 자리(방송 카드·차트)에만 둡니다.
 *
 * 테마: 부트 스크립트(index.html)가 첫 페인트 전에 붙인 data-public-theme 을
 * 읽습니다 — 홈 계열 기본 다크(useHomeTheme 과 같은 규칙). 로그인 상태는 아직
 * 모르므로 connected=false, 콜백은 전부 no-op 입니다. */

const noop = () => undefined;

function documentTheme(): "dark" | "light" {
  return document.documentElement.dataset.publicTheme === "light" ? "light" : "dark";
}

export function HomeRouteFallback({ locale = "ko" }: { locale?: PublicLocale }) {
  const text = homeI18n[locale];
  const theme = documentTheme();

  return (
    <div aria-busy="true" aria-live="polite" className={`yoro-home-shell theme-${theme}`} role="status">
      <HomeHeader
        connected={false}
        locale={locale}
        onDashboard={noop}
        onLocale={noop}
        onLoginOpen={noop}
        onLogout={noop}
        onToggleTheme={noop}
        text={text}
      />
      <main className="yoro-home-main">
        <HomeHero text={text} />

        {/* 지금 방송 중 — 머리(제목·전체 보기)는 실물, 개수는 아직 모르므로 생략,
            카드 4장은 스켈레톤. */}
        <section className="yoro-home-section">
          <SectionHead
            title={text.liveTitle}
            viewAllHref={localizedPublicUrlForCurrentLocale("/follow")}
            viewAllLabel={text.liveViewAll}
          />
          <div aria-hidden="true" className="yoro-home-live-grid">
            {[0, 1, 2, 3].map((index) => <HomeLiveCardSkeleton key={index} />)}
          </div>
        </section>

        {/* 게임별 데이터 — 카드·아이콘·링크 행 실물, 차트 자리만 스켈레톤(127px 예약). */}
        <section className="yoro-home-section">
          <SectionHead title={text.gamesTitle} />
          <div className="yoro-home-game-cards">
            <GameCard
              chart={<HomeChartSkeleton />}
              icon={<LolCardIcon />}
              name={text.lolCardName}
              rows={[
                { href: localizedPublicUrlForCurrentLocale("/lol"), label: text.rowLolSearch },
                { href: localizedPublicUrlForCurrentLocale("/lol/aram"), label: text.rowLolAram },
                { href: localizedPublicUrlForCurrentLocale("/patch-notes"), label: text.rowLolPatchNotes }
              ]}
              wide
            />
            <GameCard
              chart={<HomeChartSkeleton />}
              icon={<PalCardIcon />}
              name={text.palCardName}
              rows={[
                { href: localizedPublicUrlForCurrentLocale("/palworld/pals"), label: text.rowPalDex },
                { href: localizedPublicUrlForCurrentLocale("/palworld/items"), label: text.rowPalItems },
                { href: localizedPublicUrlForCurrentLocale("/palworld/breeding"), label: text.rowPalBreeding }
              ]}
            />
          </div>
        </section>

        <HomeBreedingSection text={text} />
        <HomeBotSection text={text} />

        <p className="yoro-home-fallback-status">{text.loading}</p>
      </main>
      <HomeFooter locale={locale} onLocale={noop} text={text} />
      <HomeBottomTabBar connected={false} onLoginOpen={noop} text={text} />
    </div>
  );
}

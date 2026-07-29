import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell, AppShellHeader, AppShellMain } from "../../shared/ui/AppShell";
import { BottomSheet } from "../../shared/ui/BottomSheet";
import {
  PublicGameFooterFrame,
  PublicGameHeaderFrame,
  PublicHorizontalNav,
} from "../../shared/PublicGameChrome";
import { PublicGameSelector } from "../public-lol/components/PublicGameSelector";
import {
  PublicLocaleOptions,
  PublicLocaleSelector,
} from "../public-lol/components/PublicLocaleSelector";
import { usePublicLocale } from "../public-lol/hooks/usePublicLocale";
import {
  publicI18n,
  setActivePublicLocale,
  type PublicLocale,
} from "../public-lol/i18n/public-lol-i18n";
import type { PublicMainPage } from "../public-lol/types/public-lol";
import { setPublicPath } from "../public-lol/utils/routes";

const noLocalePreference = async (): Promise<PublicLocale | undefined> => undefined;

const botText = {
  ko: {
    skip: "본문으로 이동",
    home: "YORO Bot 홈",
    menu: "메뉴",
    openMenu: "메뉴 열기",
    closeMenu: "메뉴 닫기",
    game: "서비스 선택",
    language: "언어",
    navOverview: "소개",
    navFeatures: "기능",
    navFlow: "연결 과정",
    navSecurity: "보안",
    eyebrow: "DISCORD SERVER COMPANION",
    title: "게임 서버 운영을 Discord에서 더 간단하게",
    pageTitle: "YORO Bot | Discord 게임 서버 도우미",
    description: "YORO Bot은 Organization과 Discord 서버를 안전하게 연결하고, 향후 게임 서버 상태와 알림을 한곳에서 관리하도록 설계된 도우미입니다.",
    foundationReady: "Discord 연결 기반 준비됨",
    gatewayPending: "설정 명령 구현됨 · 운영 활성화 필요",
    explore: "기능 살펴보기",
    setupGuide: "연결 과정 확인",
    addBot: "Discord 서버에 YORO Bot 추가",
    dashboardLogin: "Dashboard 로그인",
    currentTitle: "현재 사용할 수 있는 기반",
    currentDescription: "OAuth 로그인, Organization 관리, Palworld 서버 등록과 10분 Agent 설치 토큰 발급 기반이 준비되어 있습니다.",
    featureOrganization: "Organization 관리",
    featureOrganizationDescription: "여러 설정을 Discord Guild 소유권과 분리된 Organization 단위로 안전하게 관리합니다.",
    featureOAuth: "안전한 Discord 연결",
    featureOAuthDescription: "최소 OAuth scope와 PKCE, 일회용 설정 링크, 서버 측 Guild 권한 재검증을 사용합니다.",
    featureStatus: "게임 서버 상태",
    featureStatusDescription: "Palworld 서버 등록, Agent daemon과 상태 Ingestion 기반이 구현되어 있으며 staging 활성화를 준비하고 있습니다.",
    featureNotification: "상태 알림",
    featureNotificationDescription: "중복 방지와 tenant 격리를 적용한 알림 Worker를 후속 단계에서 연결합니다.",
    available: "기반 완료",
    planned: "준비 중",
    flowTitle: "연결 과정",
    flowDescription: "Bot을 추가한 뒤 웹 Dashboard에서 다음 순서로 Discord 서버를 Organization에 연결합니다.",
    flowIssue: "YORO Bot 추가",
    flowIssueDescription: "최소 권한으로 YORO Bot과 slash command를 Discord 서버에 추가합니다.",
    flowLogin: "Discord 로그인",
    flowLoginDescription: "`identify`, `guilds` 최소 권한으로 로그인하고 OAuth session을 확인합니다.",
    flowGuild: "관리 서버 선택",
    flowGuildDescription: "소유자, 관리자 또는 서버 관리 권한이 있는 Guild만 선택할 수 있습니다.",
    flowComplete: "Organization 연결",
    flowCompleteDescription: "권한을 다시 확인한 뒤 Organization과 Guild를 하나의 transaction으로 연결합니다.",
    setupNotice: "웹 Dashboard가 기본 연결 경로이며 `/yoro setup`은 복구용 일회성 링크로 유지됩니다. 운영 command 등록과 feature flag 활성화는 별도 단계입니다.",
    securityTitle: "연결 정보는 짧게, 권한은 정확하게",
    securityDescription: "OAuth token은 AES-256-GCM으로 암호화하고 연결 완료 또는 만료 시 폐기합니다. 다른 Organization의 Guild 정보는 조회하거나 변경할 수 없습니다.",
    securityToken: "OAuth token 평문 미저장",
    securityTenant: "Organization tenant 격리",
    securityPermission: "Guild 권한 서버 재검증",
    securitySession: "10분 만료·일회용 설정 session",
    nextTitle: "다음 구현 단계",
    nextDescription: "Agent daemon과 상태 Ingestion 기반은 구현됐으며 staging 실연동 후 알림 Worker와 Discord 상태 Embed를 연결합니다.",
    privacy: "개인정보 처리방침",
    terms: "이용약관",
    contact: "문의",
    disclaimer: "Agent daemon과 상태 Ingestion 기반은 구현됐지만 staging 실연동과 운영 활성화, Discord 상태 알림은 아직 준비 중입니다.",
    copyright: "Copyright © 2026 YORO.gg",
  },
  ja: {
    skip: "本文へ移動",
    home: "YORO Bot ホーム",
    menu: "メニュー",
    openMenu: "メニューを開く",
    closeMenu: "メニューを閉じる",
    game: "サービス選択",
    language: "言語",
    navOverview: "概要",
    navFeatures: "機能",
    navFlow: "連携手順",
    navSecurity: "セキュリティ",
    eyebrow: "DISCORD SERVER COMPANION",
    title: "ゲームサーバー運用を Discord でもっとシンプルに",
    pageTitle: "YORO Bot | Discordゲームサーバーアシスタント",
    description: "YORO Bot は Organization と Discord サーバーを安全に連携し、今後ゲームサーバーの状態と通知を一か所で管理するためのアシスタントです。",
    foundationReady: "Discord連携基盤の準備完了",
    gatewayPending: "設定コマンド実装済み・運用有効化が必要",
    explore: "機能を見る",
    setupGuide: "連携手順を確認",
    addBot: "DiscordサーバーにYORO Botを追加",
    dashboardLogin: "Dashboardにログイン",
    currentTitle: "現在利用できる基盤",
    currentDescription: "OAuthログイン、Organization管理、Palworldサーバー登録、10分間のAgent導入トークン発行基盤が準備されています。",
    featureOrganization: "Organization管理",
    featureOrganizationDescription: "各種設定をDiscord Guildの所有権から分離し、Organization単位で安全に管理します。",
    featureOAuth: "安全なDiscord連携",
    featureOAuthDescription: "最小OAuth scope、PKCE、ワンタイム設定リンク、サーバー側のGuild権限再検証を使用します。",
    featureStatus: "ゲームサーバー状態",
    featureStatusDescription: "Palworldサーバー登録、Agent daemon、状態Ingestion基盤を実装済みで、stagingでの有効化を準備しています。",
    featureNotification: "状態通知",
    featureNotificationDescription: "重複防止とtenant分離を適用した通知Workerを後続段階で連携します。",
    available: "基盤完了",
    planned: "準備中",
    flowTitle: "連携手順",
    flowDescription: "Botを追加した後、Web Dashboardから次の順序でDiscordサーバーをOrganizationに連携します。",
    flowIssue: "YORO Botを追加",
    flowIssueDescription: "最小権限でYORO Botとslash commandをDiscordサーバーに追加します。",
    flowLogin: "Discordログイン",
    flowLoginDescription: "`identify`、`guilds`の最小権限でログインし、OAuth sessionを確認します。",
    flowGuild: "管理サーバー選択",
    flowGuildDescription: "所有者、管理者、またはサーバー管理権限を持つGuildのみ選択できます。",
    flowComplete: "Organization連携",
    flowCompleteDescription: "権限を再確認した後、OrganizationとGuildを一つのtransactionで連携します。",
    setupNotice: "Web Dashboardが基本の連携経路で、`/yoro setup` は復旧用ワンタイムリンクとして維持されます。運用command登録とfeature flag有効化は別の段階です。",
    securityTitle: "連携情報は短く、権限は正確に",
    securityDescription: "OAuth tokenはAES-256-GCMで暗号化し、連携完了または期限切れ時に破棄します。他のOrganizationのGuild情報は参照・変更できません。",
    securityToken: "OAuth tokenを平文保存しない",
    securityTenant: "Organization tenant分離",
    securityPermission: "Guild権限をサーバーで再検証",
    securitySession: "10分期限・ワンタイム設定session",
    nextTitle: "次の実装段階",
    nextDescription: "Agent daemonと状態Ingestion基盤は実装済みで、staging実連携後に通知WorkerとDiscord状態Embedを連携します。",
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    contact: "お問い合わせ",
    disclaimer: "Agent daemonと状態Ingestion基盤は実装済みですが、staging実連携、運用有効化、Discord状態通知は準備中です。",
    copyright: "Copyright © 2026 YORO.gg",
  },
} as const;

function BotFeatureIcon({ kind }: { kind: "organization" | "oauth" | "status" | "notification" }) {
  const paths = {
    organization: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3.5 19c.6-3.2 2.4-5 5.5-5s5 1.8 5.5 5M15 14c2.8 0 4.4 1.5 5 4" /></>,
    oauth: <><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
    status: <><path d="M4 18h16M6 15l3-4 3 2 5-7 2 3" /><circle cx="6" cy="15" r="1" /></>,
    notification: <><path d="M6 17h12l-2-3V9a4 4 0 0 0-8 0v5l-2 3Zm4 3h4" /></>,
  };
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
      {paths[kind]}
    </svg>
  );
}

function navigateGame(page: PublicMainPage): void {
  if (page === "palworld") {
    setPublicPath("/palworld");
    return;
  }
  if (page === "bot") {
    setPublicPath("/bot");
    return;
  }
  setPublicPath("/");
}

export function PublicBotPage() {
  const { locale, changeLocale } = usePublicLocale(noLocalePreference);
  const text = botText[locale];
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  setActivePublicLocale(locale);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previousDescription = description?.content;
    const previousCanonical = canonical?.href;

    document.title = text.pageTitle;
    description?.setAttribute("content", text.description);
    canonical?.setAttribute("href", new URL("/bot", window.location.origin).href);

    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.setAttribute("content", previousDescription);
      }
      if (canonical && previousCanonical !== undefined) {
        canonical.setAttribute("href", previousCanonical);
      }
    };
  }, [text]);

  const closeMenus = useCallback(() => {
    setGameSelectorOpen(false);
    setLocaleMenuOpen(false);
    setMobileMenuOpen(false);
  }, []);

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.menu} testId="bot-secondary-nav">
      {[
        ["#bot-overview", text.navOverview],
        ["#bot-features", text.navFeatures],
        ["#bot-flow", text.navFlow],
        ["#bot-security", text.navSecurity],
      ].map(([href, label], index) => (
        <a aria-current={index === 0 ? "page" : undefined} className={index === 0 ? "active" : ""} href={href} key={href}>
          <strong>{label}</strong>
        </a>
      ))}
    </PublicHorizontalNav>
  );

  return (
    <AppShell
      className="public-dashboard-shell public-bot-shell"
      mainId="bot-main"
      skipLinkLabel={text.skip}
      variant="public"
    >
      <AppShellHeader as="div" className="public-standard-header-frame">
        <PublicGameHeaderFrame
          accountTools={(
            <>
              <span className="public-bot-header-status">{text.gatewayPending}</span>
              <PublicLocaleSelector
                locale={locale}
                onLocale={changeLocale}
                open={localeMenuOpen}
                onOpenChange={(open) => {
                  setLocaleMenuOpen(open);
                  if (open) setGameSelectorOpen(false);
                }}
              />
            </>
          )}
          brand={(
            <button className="public-game-header__brand" type="button" onClick={() => setPublicPath("/bot")} aria-label={text.home}>
              <img className="public-game-header__brand-logo" src="/images/yorogg-home-logo.webp" alt="YORO.gg" />
            </button>
          )}
          className="public-bot-header"
          gameSelector={(
            <PublicGameSelector
              activePage="bot"
              onPage={(page) => {
                closeMenus();
                navigateGame(page);
              }}
              open={gameSelectorOpen}
              onOpenChange={(open) => {
                setGameSelectorOpen(open);
                if (open) setLocaleMenuOpen(false);
              }}
            />
          )}
          home
          mobileMenuToggle={(
            <button
              aria-controls="bot-mobile-menu"
              aria-expanded={mobileMenuOpen}
              aria-haspopup="dialog"
              aria-label={mobileMenuOpen ? text.closeMenu : text.openMenu}
              className="public-game-header__menu-button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              ref={mobileMenuTriggerRef}
              type="button"
            >
              <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <strong>{text.menu}</strong>
            </button>
          )}
          mobileMenu={(
            <BottomSheet
              className="public-bottom-sheet--bot"
              closeLabel={text.closeMenu}
              id="bot-mobile-menu"
              onClose={() => setMobileMenuOpen(false)}
              open={mobileMenuOpen}
              returnFocusRef={mobileMenuTriggerRef}
              title={text.menu}
            >
              <div className="public-mobile-menu">
                <section className="public-mobile-menu__section">
                  <h3>{text.game}</h3>
                  <PublicGameSelector
                    activePage="bot"
                    mode="tray"
                    onPage={(page) => {
                      setMobileMenuOpen(false);
                      navigateGame(page);
                    }}
                  />
                </section>
                <section className="public-mobile-menu__section">
                  <h3>{text.language}</h3>
                  <PublicLocaleOptions ariaLabel={text.language} locale={locale} onLocale={changeLocale} />
                </section>
              </div>
            </BottomSheet>
          )}
          navigation={navigation}
        />
      </AppShellHeader>

      <AppShellMain className="public-bot-main" id="bot-main">
        <section className="public-bot-hero" id="bot-overview">
          <div className="public-bot-hero__copy">
            <span className="public-bot-eyebrow">{text.eyebrow}</span>
            <h1>{text.title}</h1>
            <p>{text.description}</p>
            <div className="public-bot-status-row" aria-label={text.currentTitle}>
              <span className="is-ready"><span aria-hidden="true" />{text.foundationReady}</span>
              <span className="is-pending"><span aria-hidden="true" />{text.gatewayPending}</span>
            </div>
            <div className="public-bot-actions">
              <a className="public-bot-button is-primary" href="/api/discord/bot/install">{text.addBot}</a>
              <a className="public-bot-button" href="/bot/manage">{text.dashboardLogin}</a>
            </div>
          </div>
          <div className="public-bot-hero__visual" aria-hidden="true">
            <div className="public-bot-orbit is-outer" />
            <div className="public-bot-orbit is-inner" />
            <div className="public-bot-core">Y</div>
            <span className="public-bot-node is-discord">D</span>
            <span className="public-bot-node is-server">S</span>
            <span className="public-bot-node is-alert">!</span>
          </div>
        </section>

        <section className="public-bot-section" id="bot-features">
          <div className="public-bot-section__heading">
            <span>{text.available}</span>
            <h2>{text.currentTitle}</h2>
            <p>{text.currentDescription}</p>
          </div>
          <div className="public-bot-feature-grid">
            {([
              ["organization", text.featureOrganization, text.featureOrganizationDescription, text.available, true],
              ["oauth", text.featureOAuth, text.featureOAuthDescription, text.available, true],
              ["status", text.featureStatus, text.featureStatusDescription, text.planned, false],
              ["notification", text.featureNotification, text.featureNotificationDescription, text.planned, false],
            ] as const).map(([kind, title, description, status, ready]) => (
              <article className={`public-bot-feature${ready ? " is-ready" : ""}`} key={kind}>
                <div className="public-bot-feature__icon"><BotFeatureIcon kind={kind} /></div>
                <span className="public-bot-feature__status">{status}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-bot-section public-bot-flow" id="bot-flow">
          <div className="public-bot-section__heading">
            <span>ONBOARDING</span>
            <h2>{text.flowTitle}</h2>
            <p>{text.flowDescription}</p>
          </div>
          <ol className="public-bot-flow__list">
            {[
              [text.flowIssue, text.flowIssueDescription],
              [text.flowLogin, text.flowLoginDescription],
              [text.flowGuild, text.flowGuildDescription],
              [text.flowComplete, text.flowCompleteDescription],
            ].map(([title, description], index) => (
              <li key={title}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </li>
            ))}
          </ol>
          <p className="public-bot-notice" role="note">{text.setupNotice}</p>
        </section>

        <section className="public-bot-security" id="bot-security">
          <div>
            <span className="public-bot-eyebrow">SECURITY BY DEFAULT</span>
            <h2>{text.securityTitle}</h2>
            <p>{text.securityDescription}</p>
          </div>
          <ul>
            {[text.securityToken, text.securityTenant, text.securityPermission, text.securitySession].map((item) => (
              <li key={item}><span aria-hidden="true">✓</span>{item}</li>
            ))}
          </ul>
        </section>

        <section className="public-bot-next" id="bot-roadmap">
          <span>{text.planned}</span>
          <h2>{text.nextTitle}</h2>
          <p>{text.nextDescription}</p>
        </section>
      </AppShellMain>

      <PublicGameFooterFrame
        brand="YORO.gg"
        className="public-site-footer public-bot-footer"
        legalNavigation={(
          <nav aria-label={`${text.privacy} · ${text.terms} · ${text.contact}`}>
            <a href="/privacy">{text.privacy}</a>
            <a href="/terms">{text.terms}</a>
            <a href="/contact">{text.contact}</a>
          </nav>
        )}
        disclaimer={<p>{text.disclaimer}</p>}
        copyright={<strong>{text.copyright}</strong>}
      />
    </AppShell>
  );
}

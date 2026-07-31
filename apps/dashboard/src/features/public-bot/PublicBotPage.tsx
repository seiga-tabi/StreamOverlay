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
import {
  localizedPublicUrl,
  stripPublicLocalePrefix,
} from "../public-lol/utils/public-locale-path";
import { botInstallUrl } from "../bot-management/api";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import {
  PublicTwitchAccountChip,
  PublicTwitchAccountPanel,
  type PublicTwitchAccountUser,
} from "../../shared/PublicTwitchAccountChip";
import { accountOAuthUrl, openYoroDashboard } from "../yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession,
} from "../yoro-account/useYoroAccountSession";
import { PalworldDedicatedServerSettings } from "./PalworldDedicatedServerSettings";
import { DISCORD_BOT_PREFIX_COMMAND_MANIFEST } from "@streamops/shared";

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
    navGettingStarted: "사용방법",
    navCommands: "명령어 목록",
    navGameFiles: "게임파일",
    eyebrow: "DISCORD SERVER COMPANION",
    title: "게임 서버 운영을 Discord에서 더 간단하게",
    pageTitle: "YORO Bot | Discord 게임 서버 도우미",
    gettingStartedPageTitle: "사용방법 | YORO Bot",
    commandsPageTitle: "명령어 목록 | YORO Bot",
    gameFilesPageTitle: "Palworld 게임파일 | YORO Bot",
    gameFilesPageDescription: "검증된 PalWorldSettings.ini 설정을 브라우저에서 만들고 안전하게 설치하는 방법을 안내합니다.",
    description: "YORO Bot은 Palworld REST API를 읽기 전용으로 조회해 Discord에 서버 상태를 보여주며, 개인정보와 AdminPassword를 Discord에 노출하지 않습니다.",
    foundationReady: "Discord 연결 기반 준비됨",
    gatewayPending: "설정 명령 구현됨 · 운영 활성화 필요",
    explore: "기능 살펴보기",
    setupGuide: "연결 과정 확인",
    addBot: "Discord 서버에 YORO Bot 추가",
    addBotNewTab: "Discord 서버에 YORO Bot 추가 (새 탭에서 열림)",
    dashboardLogin: "Dashboard 로그인",
    dashboardOpen: "YORO Dashboard",
    currentTitle: "현재 사용할 수 있는 기반",
    currentDescription: "OAuth 로그인, Organization 관리와 Palworld REST 직접 연결 기반이 준비되어 있습니다.",
    featureOrganization: "Organization 관리",
    featureOrganizationDescription: "여러 설정을 Discord Guild 소유권과 분리된 Organization 단위로 안전하게 관리합니다.",
    featureOAuth: "안전한 Discord 연결",
    featureOAuthDescription: "최소 OAuth scope와 PKCE, 일회용 설정 링크, 서버 측 Guild 권한 재검증을 사용합니다.",
    featureStatus: "게임 서버 상태",
    featureStatusDescription: "Palworld 서버 등록과 REST 인증·상태 조회 기반이 구현되어 있으며 운영 연결을 준비하고 있습니다.",
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
    flowRest: "Palworld REST 등록",
    flowRestDescription: "Dashboard에서 REST 주소와 AdminPassword를 검증하고 암호화 저장합니다. 비밀번호는 Discord 응답에 표시하지 않습니다.",
    flowControl: "Discord Bot 제어",
    flowControlDescription: "공개 명령과 상태·플레이어·가이드 명령의 활성화 여부를 Dashboard에서 선택합니다.",
    flowUse: "명령어 사용",
    flowUseDescription: "일반 사용자는 !yoro 명령을, 작성자와 관리자는 필요한 /yoro 명령을 사용합니다.",
    commandsTitle: "Discord 명령어 목록",
    commandsDescription: "명령어 입력 언어가 응답 언어보다 우선하며, Dashboard에서 비활성화한 명령은 실행과 도움말에서 모두 제외됩니다.",
    publicCommands: "일반 사용자 · 공개 응답",
    slashCommands: "작성자 전용 · 비공개 응답",
    adminCommands: "관리자 전용",
    aliases: "별칭",
    condition: "활성화 조건",
    publicCondition: "Organization 연결 · 공개 명령 활성화 · 해당 명령 활성화",
    slashDescription: "/yoro status, /yoro player, /yoro guide는 실행자에게만 보이는 응답을 사용합니다.",
    adminDescription: "/yoro setup은 서버 소유자·Administrator·Manage Guild 권한이 있는 사용자만 사용할 수 있으며, /yoro dashboard는 고정 Dashboard 링크를 비공개로 제공합니다.",
    playerMatchNotice: "플레이어 프로필은 닉네임 완전 일치일 때만 확정합니다. 부분 일치와 제한된 오타는 연관 검색어로만 표시합니다.",
    setupNotice: "웹 Dashboard가 기본 연결 경로이며 `/yoro setup`은 복구용 일회성 링크로 유지됩니다. 운영 command 등록과 feature flag 활성화는 별도 단계입니다.",
    securityTitle: "연결 정보는 짧게, 권한은 정확하게",
    securityDescription: "OAuth token은 AES-256-GCM으로 암호화하고 연결 완료 또는 만료 시 폐기합니다. 다른 Organization의 Guild 정보는 조회하거나 변경할 수 없습니다.",
    securityToken: "OAuth token 평문 미저장",
    securityTenant: "Organization tenant 격리",
    securityPermission: "Guild 권한 서버 재검증",
    securitySession: "10분 만료·일회용 설정 session",
    nextTitle: "다음 구현 단계",
    nextDescription: "Palworld REST 직접 연결 기반은 구현됐으며 실연동 검증 후 알림 Worker와 Discord 상태 Embed를 연결합니다.",
    privacy: "개인정보 처리방침",
    terms: "이용약관",
    contact: "문의",
    disclaimer: "Palworld REST 직접 연결 기반은 구현됐지만 운영 실연동과 Discord 상태 알림은 아직 준비 중입니다.",
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
    navOverview: "紹介",
    navGettingStarted: "使い方",
    navCommands: "コマンド一覧",
    navGameFiles: "ゲームファイル",
    eyebrow: "DISCORD SERVER COMPANION",
    title: "ゲームサーバー運用を Discord でもっとシンプルに",
    pageTitle: "YORO Bot | Discordゲームサーバーアシスタント",
    gettingStartedPageTitle: "使い方 | YORO Bot",
    commandsPageTitle: "コマンド一覧 | YORO Bot",
    gameFilesPageTitle: "Palworldゲームファイル | YORO Bot",
    gameFilesPageDescription: "検証済みのPalWorldSettings.iniをブラウザで作成し、安全に設置する方法を案内します。",
    description: "YORO BotはPalworld REST APIを読み取り専用で参照してDiscordにサーバー状態を表示し、個人情報やAdminPasswordをDiscordへ公開しません。",
    foundationReady: "Discord連携基盤の準備完了",
    gatewayPending: "設定コマンド実装済み・運用有効化が必要",
    explore: "機能を見る",
    setupGuide: "連携手順を確認",
    addBot: "DiscordサーバーにYORO Botを追加",
    addBotNewTab: "DiscordサーバーにYORO Botを追加（新しいタブで開きます）",
    dashboardLogin: "Dashboardにログイン",
    dashboardOpen: "YORO Dashboard",
    currentTitle: "現在利用できる基盤",
    currentDescription: "OAuthログイン、Organization管理、Palworld REST直接接続基盤が準備されています。",
    featureOrganization: "Organization管理",
    featureOrganizationDescription: "各種設定をDiscord Guildの所有権から分離し、Organization単位で安全に管理します。",
    featureOAuth: "安全なDiscord連携",
    featureOAuthDescription: "最小OAuth scope、PKCE、ワンタイム設定リンク、サーバー側のGuild権限再検証を使用します。",
    featureStatus: "ゲームサーバー状態",
    featureStatusDescription: "Palworldサーバー登録とREST認証・状態取得基盤を実装済みで、運用接続を準備しています。",
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
    flowRest: "Palworld REST登録",
    flowRestDescription: "DashboardでRESTアドレスとAdminPasswordを検証し、暗号化して保存します。パスワードはDiscord応答に表示しません。",
    flowControl: "Discord Bot制御",
    flowControlDescription: "公開コマンドと状態・プレイヤー・ガイドの有効化をDashboardで選択します。",
    flowUse: "コマンド利用",
    flowUseDescription: "一般ユーザーは!yoro、実行者と管理者は必要な/yoroコマンドを利用します。",
    commandsTitle: "Discordコマンド一覧",
    commandsDescription: "入力したコマンドの言語を応答言語より優先し、Dashboardで無効にしたコマンドは実行とヘルプの両方から除外します。",
    publicCommands: "一般ユーザー・公開応答",
    slashCommands: "実行者のみ・非公開応答",
    adminCommands: "管理者専用",
    aliases: "別名",
    condition: "有効化条件",
    publicCondition: "Organization連携・公開コマンド有効・該当コマンド有効",
    slashDescription: "/yoro status、/yoro player、/yoro guideは実行者だけに表示される応答を使用します。",
    adminDescription: "/yoro setupはサーバー所有者・Administrator・Manage Guild権限を持つユーザーだけが利用でき、/yoro dashboardは固定Dashboardリンクを非公開で提供します。",
    playerMatchNotice: "プレイヤープロフィールはニックネームが完全一致した場合のみ確定します。部分一致と限定的な入力ミスは関連候補としてのみ表示します。",
    setupNotice: "Web Dashboardが基本の連携経路で、`/yoro setup` は復旧用ワンタイムリンクとして維持されます。運用command登録とfeature flag有効化は別の段階です。",
    securityTitle: "連携情報は短く、権限は正確に",
    securityDescription: "OAuth tokenはAES-256-GCMで暗号化し、連携完了または期限切れ時に破棄します。他のOrganizationのGuild情報は参照・変更できません。",
    securityToken: "OAuth tokenを平文保存しない",
    securityTenant: "Organization tenant分離",
    securityPermission: "Guild権限をサーバーで再検証",
    securitySession: "10分期限・ワンタイム設定session",
    nextTitle: "次の実装段階",
    nextDescription: "Palworld REST直接接続基盤は実装済みで、実連携検証後に通知WorkerとDiscord状態Embedを連携します。",
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    contact: "お問い合わせ",
    disclaimer: "Palworld REST直接接続基盤は実装済みですが、運用実連携とDiscord状態通知は準備中です。",
    copyright: "Copyright © 2026 YORO.gg",
  },
} as const;

export type PublicBotSection = "overview" | "gettingStarted" | "commands" | "gameFiles";

export function publicBotSectionFromPath(pathname: string): PublicBotSection {
  pathname = stripPublicLocalePrefix(pathname);
  const normalized = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  if (normalized === "/bot/getting-started" || normalized === "/bot/connect") {
    return "gettingStarted";
  }
  if (normalized === "/bot/commands" || normalized === "/bot/features") {
    return "commands";
  }
  if (normalized === "/bot/game-files" || normalized === "/bot/dedicated-server") {
    return "gameFiles";
  }
  return "overview";
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
  const activeSection = publicBotSectionFromPath(window.location.pathname);
  const pageMetadata = activeSection === "commands"
    ? { title: text.commandsPageTitle, description: text.commandsDescription, path: "/bot/commands" }
    : activeSection === "gettingStarted"
      ? { title: text.gettingStartedPageTitle, description: text.flowDescription, path: "/bot/getting-started" }
      : activeSection === "gameFiles"
        ? {
          title: text.gameFilesPageTitle,
          description: text.gameFilesPageDescription,
          path: "/bot/game-files",
        }
      : { title: text.pageTitle, description: text.description, path: "/bot" };
  const [gameSelectorOpen, setGameSelectorOpen] = useState(false);
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const yoroAccount = useYoroAccountSession();
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const accountIdentity = authenticatedYoroIdentity(yoroAccount.session);
  const accountConnected = yoroAccount.session?.authenticated === true;
  const accountUser: PublicTwitchAccountUser | undefined = accountIdentity
    ? {
      displayName: accountIdentity.displayName,
      provider: accountIdentity.provider,
      linkedProviders: yoroAccount.session?.authenticated
        ? yoroAccount.session.identities.map((identity) => identity.provider)
        : [accountIdentity.provider],
      ...(accountIdentity.avatarUrl ? { profileImageUrl: accountIdentity.avatarUrl } : {}),
    }
    : undefined;
  setActivePublicLocale(locale);

  useEffect(() => {
    const unprefixed = stripPublicLocalePrefix(window.location.pathname);
    const normalized = unprefixed.length > 1 && unprefixed.endsWith("/")
      ? unprefixed.slice(0, -1)
      : unprefixed;
    if (!["/bot/features", "/bot/connect", "/bot/dedicated-server"].includes(normalized)) {
      return;
    }
    const suffix = `${window.location.search}${window.location.hash}`;
    const target = localizedPublicUrl(`${pageMetadata.path}${suffix}`, locale);
    window.history.replaceState({}, "", target);
  }, [locale, pageMetadata.path]);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const socialTags = [
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]'),
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]'),
      document.querySelector<HTMLMetaElement>('meta[property="og:url"]'),
      document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]'),
      document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]'),
    ];
    const previousDescription = description?.content;
    const previousCanonical = canonical?.href;
    const previousSocialContent = socialTags.map((tag) => tag?.content);
    const canonicalUrl = new URL(
      localizedPublicUrl(pageMetadata.path, locale),
      window.location.origin,
    ).href;

    document.title = pageMetadata.title;
    description?.setAttribute("content", pageMetadata.description);
    canonical?.setAttribute("href", canonicalUrl);
    socialTags[0]?.setAttribute("content", pageMetadata.title);
    socialTags[1]?.setAttribute("content", pageMetadata.description);
    socialTags[2]?.setAttribute("content", canonicalUrl);
    socialTags[3]?.setAttribute("content", pageMetadata.title);
    socialTags[4]?.setAttribute("content", pageMetadata.description);

    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.setAttribute("content", previousDescription);
      }
      if (canonical && previousCanonical !== undefined) {
        canonical.setAttribute("href", previousCanonical);
      }
      socialTags.forEach((tag, index) => {
        const content = previousSocialContent[index];
        if (tag && content !== undefined) tag.setAttribute("content", content);
      });
    };
  }, [locale, pageMetadata.description, pageMetadata.path, pageMetadata.title]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const activeLink = document.querySelector<HTMLElement>(
        '[data-testid="bot-secondary-nav"] [aria-current="page"]',
      );
      const scroller = activeLink?.closest<HTMLElement>(".public-horizontal-nav");
      if (!activeLink || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
      scroller.scrollLeft = Math.max(
        0,
        activeLink.offsetLeft - ((scroller.clientWidth - activeLink.clientWidth) / 2),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection]);

  const closeMenus = useCallback(() => {
    setGameSelectorOpen(false);
    setLocaleMenuOpen(false);
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  }, []);

  const startAccountLogin = (provider: "discord" | "twitch") => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    window.location.assign(accountOAuthUrl(provider, "login", returnPath));
  };
  const logoutAccount = () => {
    void yoroAccount.logout().catch(() => {
      // 로그아웃 실패 시 연결 상태를 유지해 사용자가 다시 시도할 수 있게 합니다.
    });
  };

  const navigation = (
    <PublicHorizontalNav ariaLabel={text.menu} testId="bot-secondary-nav">
      {([
        ["/bot", text.navOverview, "overview"],
        ["/bot/getting-started", text.navGettingStarted, "gettingStarted"],
        ["/bot/commands", text.navCommands, "commands"],
        ["/bot/game-files", text.navGameFiles, "gameFiles"],
      ] as const).map(([href, label, section]) => (
        <a
          aria-current={activeSection === section ? "page" : undefined}
          className={activeSection === section ? "active" : ""}
          href={localizedPublicUrl(href, locale)}
          key={href}
          onClick={(event) => {
            event.preventDefault();
            setPublicPath(href);
          }}
        >
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
              <PublicLocaleSelector
                locale={locale}
                onLocale={changeLocale}
                open={localeMenuOpen}
                onOpenChange={(open) => {
                  setLocaleMenuOpen(open);
                  if (open) {
                    setGameSelectorOpen(false);
                    setAccountMenuOpen(false);
                  }
                }}
              />
              <PublicTwitchAccountChip
                configured
                connected={accountConnected}
                dashboardLabel={text.dashboardOpen}
                dashboardLabelJa={botText.ja.dashboardOpen}
                dashboardLabelKo={botText.ko.dashboardOpen}
                discordLoginLabel={publicI18n[locale].discordLogin}
                loginLabel={publicI18n[locale].accountLogin}
                loginLabelJa={publicI18n.ja.accountLogin}
                loginLabelKo={publicI18n.ko.accountLogin}
                loginMenuLabel={publicI18n[locale].accountLoginMenu}
                loginTitle={publicI18n[locale].accountLoginTitle}
                logoutLabel={publicI18n[locale].accountLogout}
                menuLabel={publicI18n[locale].accountMenu}
                onDashboard={openYoroDashboard}
                onDiscordLogin={() => startAccountLogin("discord")}
                onLogin={() => startAccountLogin("twitch")}
                onLogout={logoutAccount}
                onOpenChange={(open) => {
                  setAccountMenuOpen(open);
                  if (open) {
                    setGameSelectorOpen(false);
                    setLocaleMenuOpen(false);
                    setMobileMenuOpen(false);
                  }
                }}
                open={accountMenuOpen}
                twitchLoginLabel={publicI18n[locale].twitchLoginChoice}
                user={accountUser}
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
                if (open) {
                  setLocaleMenuOpen(false);
                  setAccountMenuOpen(false);
                }
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
              onClick={() => {
                setMobileMenuOpen((open) => !open);
                setGameSelectorOpen(false);
                setLocaleMenuOpen(false);
                setAccountMenuOpen(false);
              }}
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
                <section className="public-mobile-menu__section">
                  <h3>{publicI18n[locale].account}</h3>
                  <PublicTwitchAccountPanel
                    configured
                    connected={accountConnected}
                    dashboardLabel={text.dashboardOpen}
                    dashboardLabelJa={botText.ja.dashboardOpen}
                    dashboardLabelKo={botText.ko.dashboardOpen}
                    discordLoginLabel={publicI18n[locale].discordLogin}
                    loginLabel={publicI18n[locale].accountLogin}
                    loginLoadingLabel={publicI18n[locale].twitchLoginLoading}
                    logoutLabel={publicI18n[locale].accountLogout}
                    onAction={() => setMobileMenuOpen(false)}
                    onDashboard={openYoroDashboard}
                    onDiscordLogin={() => startAccountLogin("discord")}
                    onLogin={() => startAccountLogin("twitch")}
                    onLogout={logoutAccount}
                    twitchLoginLabel={publicI18n[locale].twitchLoginChoice}
                    unavailableLabel={publicI18n[locale].twitchNotConfigured}
                    user={accountUser}
                  />
                </section>
              </div>
            </BottomSheet>
          )}
          navigation={navigation}
        />
      </AppShellHeader>

      <AppShellMain className="public-bot-main" id="bot-main">
        {activeSection === "overview" ? (
          <>
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
                  <a
                    aria-label={text.addBotNewTab}
                    className="public-bot-button is-primary"
                    href={botInstallUrl()}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {text.addBot}
                  </a>
                  <a className="public-bot-button" href="/dashboard">
                    {text.dashboardLogin}
                  </a>
                </div>
              </div>
              <div className="public-bot-hero__visual" aria-hidden="true">
                <div className="public-bot-orbit is-outer" />
                <div className="public-bot-orbit is-inner" />
                <div className="public-bot-core">Y</div>
                <span className="public-bot-node is-discord">
                  <DiscordSymbolIcon />
                </span>
                <span className="public-bot-node is-server">S</span>
                <span className="public-bot-node is-alert">!</span>
              </div>
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
          </>
        ) : null}

        {activeSection === "gettingStarted" ? (
          <section className="public-bot-section public-bot-flow public-bot-page-section" id="bot-flow">
            <div className="public-bot-section__heading">
              <span>ONBOARDING</span>
              <h1>{text.flowTitle}</h1>
              <p>{text.flowDescription}</p>
            </div>
            <ol className="public-bot-flow__list">
              {[
                [text.flowIssue, text.flowIssueDescription],
                [text.flowComplete, text.flowCompleteDescription],
                [text.flowRest, text.flowRestDescription],
                [text.flowControl, text.flowControlDescription],
                [text.flowUse, text.flowUseDescription],
              ].map(([title, description], index) => (
                <li key={title}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              ))}
            </ol>
            <p className="public-bot-notice" role="note">{text.setupNotice}</p>
          </section>
        ) : null}

        {activeSection === "commands" ? (
          <section className="public-bot-section public-bot-page-section" id="bot-commands">
            <div className="public-bot-section__heading">
              <span>COMMAND MANIFEST</span>
              <h1>{text.commandsTitle}</h1>
              <p>{text.commandsDescription}</p>
            </div>
            <section aria-labelledby="bot-public-commands">
              <h2 id="bot-public-commands">{text.publicCommands}</h2>
              <div className="public-bot-feature-grid public-bot-command-grid">
                {DISCORD_BOT_PREFIX_COMMAND_MANIFEST.map((definition) => {
                  const aliases = (["ko", "ja", "en"] as const).flatMap((aliasLocale) =>
                    definition.aliases[aliasLocale].map((alias) => ({
                      command: alias ? `!yoro ${alias}` : "!yoro",
                      locale: aliasLocale,
                    })),
                  );
                  return (
                    <article className="public-bot-feature is-ready" key={definition.command}>
                      <span className="public-bot-feature__status">{definition.command}</span>
                      <h3><code>{aliases[0]?.command}</code></h3>
                      <p>
                        <strong>{text.aliases}:</strong>{" "}
                        {aliases.map((alias) => `${alias.locale.toUpperCase()} ${alias.command}`).join(" · ")}
                      </p>
                      {definition.acceptsNickname ? <p><code>{`${aliases[0]?.command} {nickname}`}</code></p> : null}
                      <p><strong>{text.condition}:</strong> {text.publicCondition}</p>
                    </article>
                  );
                })}
              </div>
              <p className="public-bot-notice" role="note">{text.playerMatchNotice}</p>
            </section>
            <div className="public-bot-feature-grid public-bot-command-access-grid">
              <section className="public-bot-feature is-ready">
                <h2>{text.slashCommands}</h2>
                <p>{text.slashDescription}</p>
              </section>
              <section className="public-bot-feature is-ready">
                <h2>{text.adminCommands}</h2>
                <p>{text.adminDescription}</p>
              </section>
            </div>
          </section>
        ) : null}

        {activeSection === "gameFiles" ? (
          <PalworldDedicatedServerSettings locale={locale} />
        ) : null}
      </AppShellMain>

      <PublicGameFooterFrame
        brand="YORO.gg"
        className="public-site-footer public-bot-footer"
        legalNavigation={(
          <nav aria-label={`${text.privacy} · ${text.terms} · ${text.contact}`}>
            <a href={localizedPublicUrl("/privacy", locale)}>{text.privacy}</a>
            <a href={localizedPublicUrl("/terms", locale)}>{text.terms}</a>
            <a href={localizedPublicUrl("/contact", locale)}>{text.contact}</a>
          </nav>
        )}
        disclaimer={<p>{text.disclaimer}</p>}
        copyright={<strong>{text.copyright}</strong>}
      />
    </AppShell>
  );
}

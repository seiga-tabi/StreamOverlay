import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../styles/pages/bot/bot-route.css";
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
} from "../../shared/PublicTwitchAccountChip";
import { usePublicAccountLogin } from "../../shared/public-account-login";
import { openYoroDashboard } from "../yoro-account/api";
import { PalworldDedicatedServerSettings } from "./PalworldDedicatedServerSettings";
import { PublicBotFaq } from "./PublicBotFaq";
import { DISCORD_BOT_PREFIX_COMMAND_MANIFEST } from "@streamops/shared";
import { trackGoogleAnalyticsEvent } from "../../analytics/google-analytics";

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
    title: "Discord 안에서 게임 서버 운영을 더 간단하게",
    heroLead: "Discord 안에서",
    heroAccent: "게임 서버 운영을",
    heroTail: "더 간단하게",
    heroDescription: "Palworld 서버 상태와 플레이어 정보를 Discord에서 확인하고, Organization과 Bot 설정을 웹 Dashboard에서 관리하세요.",
    heroTagStatus: "서버 상태 조회",
    heroTagPlayer: "플레이어 조회",
    heroTagDashboard: "웹 Dashboard",
    trustFree: "무료로 시작",
    trustPermission: "Bot 추가 시 관리자 권한 요청 없음",
    trustSetup: "Dashboard에서 간편 설정",
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
    dashboardView: "대시보드 보기",
    coreEyebrow: "CORE FEATURES",
    coreTitle: "YORO Bot으로 할 수 있는 것",
    coreDescription: "Discord에서 필요한 서버 정보는 빠르게 확인하고, 민감한 설정은 웹 Dashboard에서 분리해 관리합니다.",
    featureRealtime: "서버 상태 조회",
    featureRealtimeDescription: "현재 접속 인원, 게임 버전, 응답 시간과 온라인 상태를 Discord 명령으로 확인합니다.",
    featurePlayers: "플레이어 조회",
    featurePlayersDescription: "접속자 목록과 정확히 일치하는 닉네임의 공개 게임 프로필을 안전하게 조회합니다.",
    featureDashboard: "웹 Dashboard",
    featureDashboardDescription: "Guild, Organization, Palworld REST 연결과 공개 명령 활성화 여부를 한곳에서 관리합니다.",
    previewEyebrow: "DISCORD MESSAGE PREVIEW",
    previewSectionTitle: "Discord에서 보이는 화면",
    previewSectionDescription: "서버 상태를 읽기 쉬운 Embed로 정리합니다. 아래 값은 레이아웃을 설명하기 위한 예시 데이터입니다.",
    previewChannel: "server-status",
    previewExample: "예시 데이터",
    previewBotName: "YORO Bot",
    previewTime: "오늘 16:42",
    previewServerTitle: "YORO Palworld 서버",
    previewServerDescription: "서버가 정상적으로 운영 중입니다.",
    previewStatus: "상태",
    previewOnline: "온라인",
    previewPlayers: "접속 인원",
    previewLatency: "응답 시간",
    previewVersion: "서버 버전",
    previewDashboard: "대시보드 열기",
    previewRefresh: "새로고침",
    previewDisclaimer: "실제 값은 등록된 서버의 REST 응답에 따라 달라집니다.",
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
    flowDescription: "Bot 추가부터 첫 상태 확인까지, 다음에 해야 할 작업과 완료 결과를 순서대로 안내합니다.",
    flowProgressLabel: "YORO Bot 5단계 연결 순서",
    flowStep: "STEP",
    flowResult: "완료 결과",
    flowIssue: "YORO Bot 추가",
    flowIssueDescription: "YORO Bot을 관리할 Discord 서버에 초대합니다.",
    flowIssuePoints: ["Bot 초대 승인", "요청 권한 확인"],
    flowIssueResult: "Bot과 slash command가 Discord 서버에 추가됩니다.",
    flowLogin: "Discord 로그인",
    flowLoginDescription: "`identify`, `guilds` 최소 권한으로 로그인하고 OAuth session을 확인합니다.",
    flowGuild: "관리 서버 선택",
    flowGuildDescription: "소유자, 관리자 또는 서버 관리 권한이 있는 Guild만 선택할 수 있습니다.",
    flowComplete: "로그인 및 Organization 연결",
    flowCompleteDescription: "Discord로 로그인하고 관리할 서버를 Organization에 연결합니다.",
    flowCompletePoints: ["Discord OAuth 로그인", "관리 서버 선택", "Organization 연결"],
    flowCompleteResult: "Guild 권한이 재검증되고 Organization 관리가 시작됩니다.",
    flowRest: "Palworld REST 연결",
    flowRestDescription: "Dashboard에서 게임 서버의 읽기 전용 REST 연결을 확인합니다.",
    flowRestPoints: ["REST 주소 입력", "AdminPassword 검증", "암호화 저장"],
    flowRestResult: "서버 상태와 접속 플레이어를 안전하게 조회할 수 있습니다.",
    flowControl: "사용할 명령 활성화",
    flowControlDescription: "Discord Bot 제어에서 서버 구성원에게 제공할 명령을 선택합니다.",
    flowControlPoints: ["Status 상태 조회", "Player 플레이어 조회", "Guide 연결 안내"],
    flowControlResult: "활성화한 명령만 실행과 도움말 목록에 표시됩니다.",
    flowUse: "Discord에서 사용 시작",
    flowUseDescription: "영어 명령을 입력해 첫 서버 상태를 확인합니다.",
    flowUsePoints: ["!yoro status 공개 조회", "/yoro status 비공개 조회"],
    flowUseResult: "Discord에서 온라인 상태, 인원, 버전과 응답 시간을 확인합니다.",
    flowAddBotAction: "Bot 추가",
    flowLoginAction: "Discord 로그인",
    flowDashboardAction: "Dashboard 열기",
    flowCommandsAction: "명령어 보기",
    flowPreviewEyebrow: "COMPLETE",
    flowPreviewTitle: "연결이 끝나면 이렇게 보입니다",
    flowPreviewDescription: "등록된 Palworld 서버의 실제 REST 응답이 Discord Embed에 표시됩니다.",
    commandsTitle: "Discord 명령어 목록",
    commandsDescription: "모든 명령은 영어로 입력하며, Dashboard에서 비활성화한 명령은 실행과 도움말에서 모두 제외됩니다. 응답 문구는 서버의 표시 언어를 따릅니다.",
    publicCommands: "일반 사용자 · 공개 응답",
    slashCommands: "작성자 전용 · 비공개 응답",
    adminCommands: "관리자 전용",
    aliases: "별칭",
    condition: "활성화 조건",
    publicCondition: "Organization 연결 · 공개 명령 활성화 · 해당 명령 활성화",
    slashDescription: "/yoro status, /yoro player, /yoro guide는 실행자에게만 보이는 응답을 사용합니다.",
    adminDescription: "/yoro setup과 /yoro language는 서버 소유자·Administrator·Manage Guild 권한이 있는 사용자만 사용할 수 있으며, 언어 변경은 연결된 Organization의 owner·manager만 저장할 수 있습니다. /yoro dashboard는 고정 Dashboard 링크를 비공개로 제공합니다.",
    playerMatchNotice: "플레이어 프로필은 닉네임 완전 일치일 때만 확정합니다. 부분 일치와 제한된 오타는 연관 검색어로만 표시합니다.",
    setupNotice: "웹 Dashboard가 기본 연결 경로이며 `/yoro setup`은 복구용 일회성 링크로 유지됩니다. 운영 command 등록과 feature flag 활성화는 별도 단계입니다.",
    securityEyebrow: "SECURITY BY DEFAULT",
    securityTitle: "보안 중심 설계",
    securityDescription: "OAuth token은 AES-256-GCM으로 암호화하고 연결 완료 또는 만료 시 폐기합니다. 다른 Organization의 Guild 정보는 조회하거나 변경할 수 없습니다.",
    securityToken: "OAuth token 평문 미저장",
    securityTokenDescription: "Discord OAuth token과 민감한 연결 정보는 암호화해 저장합니다.",
    securityTenant: "Organization tenant 격리",
    securityTenantDescription: "Organization 경계를 기준으로 Guild와 게임 서버 데이터 접근을 분리합니다.",
    securityPermission: "Guild 권한 서버 재검증",
    securityPermissionDescription: "연결 직전에 소유자·Administrator·Manage Guild 권한을 다시 확인합니다.",
    securitySession: "10분 만료·일회용 설정 session",
    securitySessionDescription: "설정 session은 짧게 유지하고 사용 완료 또는 만료 시 재사용할 수 없습니다.",
    installEyebrow: "GETTING STARTED",
    installTitle: "Discord에서 서버를 확인하는 방법",
    installDescription: "Bot 추가부터 첫 상태 확인까지 Dashboard가 단계별로 안내합니다.",
    roadmapEyebrow: "SERVICE STATUS",
    nextTitle: "현재 제공하는 기능과 준비 중인 기능",
    nextDescription: "구현 상태를 명확히 구분해 아직 제공하지 않는 기능을 완료된 것처럼 안내하지 않습니다.",
    roadmapCurrent: "현재 제공",
    roadmapPlanned: "준비 중",
    roadmapCurrentItems: ["Discord 서버 연결", "Palworld REST 상태·플레이어 조회", "Dashboard Bot 제어"],
    roadmapPlannedItems: ["장애·복구 자동 알림", "고정 상태 패널", "Minecraft 서버 연동"],
    commandPreviewEyebrow: "COMMAND PREVIEW",
    commandPreviewTitle: "설치 후 바로 사용할 명령어",
    commandPreviewDescription: "명령 입력은 영어로 통일하며, 응답 안내는 서버의 한국어·일본어·영어 설정을 따릅니다.",
    commandPreviewLink: "모든 명령어 보기",
    finalCtaTitle: "게임 서버 운영을 Discord와 연결하세요",
    finalCtaDescription: "최소 권한으로 Bot을 추가하고 YORO Dashboard에서 연결을 마무리할 수 있습니다.",
    finalCtaGuide: "설정 가이드 보기",
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
    title: "Discordでゲームサーバー運用をもっとシンプルに",
    heroLead: "Discordで",
    heroAccent: "ゲームサーバー運用を",
    heroTail: "もっとシンプルに",
    heroDescription: "Palworldサーバーの状態とプレイヤー情報をDiscordで確認し、OrganizationとBot設定をWeb Dashboardで管理できます。",
    heroTagStatus: "サーバー状態確認",
    heroTagPlayer: "プレイヤー確認",
    heroTagDashboard: "Web Dashboard",
    trustFree: "無料で開始",
    trustPermission: "Bot追加時に管理者権限を要求しない",
    trustSetup: "Dashboardで簡単設定",
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
    dashboardView: "Dashboardを見る",
    coreEyebrow: "CORE FEATURES",
    coreTitle: "YORO Botでできること",
    coreDescription: "Discordで必要なサーバー情報を素早く確認し、機密設定はWeb Dashboardに分離して管理します。",
    featureRealtime: "サーバー状態確認",
    featureRealtimeDescription: "現在の接続人数、ゲームバージョン、応答時間、オンライン状態をDiscordコマンドで確認します。",
    featurePlayers: "プレイヤー確認",
    featurePlayersDescription: "接続者一覧と、完全一致したニックネームの公開ゲームプロフィールを安全に確認します。",
    featureDashboard: "Web Dashboard",
    featureDashboardDescription: "Guild、Organization、Palworld REST接続、公開コマンドの有効化を一か所で管理します。",
    previewEyebrow: "DISCORD MESSAGE PREVIEW",
    previewSectionTitle: "Discordでの表示",
    previewSectionDescription: "サーバー状態を読みやすいEmbedに整理します。以下の値はレイアウト説明用のサンプルデータです。",
    previewChannel: "server-status",
    previewExample: "サンプルデータ",
    previewBotName: "YORO Bot",
    previewTime: "今日 16:42",
    previewServerTitle: "YORO Palworldサーバー",
    previewServerDescription: "サーバーは正常に稼働しています。",
    previewStatus: "状態",
    previewOnline: "オンライン",
    previewPlayers: "接続人数",
    previewLatency: "応答時間",
    previewVersion: "サーバーバージョン",
    previewDashboard: "Dashboardを開く",
    previewRefresh: "更新",
    previewDisclaimer: "実際の値は登録済みサーバーのREST応答によって異なります。",
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
    flowDescription: "Bot追加から最初の状態確認まで、次に行う作業と完了結果を順番に案内します。",
    flowProgressLabel: "YORO Bot 5ステップ連携手順",
    flowStep: "STEP",
    flowResult: "完了結果",
    flowIssue: "YORO Botを追加",
    flowIssueDescription: "YORO Botを管理するDiscordサーバーへ招待します。",
    flowIssuePoints: ["Bot招待を承認", "リクエスト権限を確認"],
    flowIssueResult: "Botとslash commandがDiscordサーバーに追加されます。",
    flowLogin: "Discordログイン",
    flowLoginDescription: "`identify`、`guilds`の最小権限でログインし、OAuth sessionを確認します。",
    flowGuild: "管理サーバー選択",
    flowGuildDescription: "所有者、管理者、またはサーバー管理権限を持つGuildのみ選択できます。",
    flowComplete: "ログインとOrganization連携",
    flowCompleteDescription: "Discordでログインし、管理するサーバーをOrganizationへ連携します。",
    flowCompletePoints: ["Discord OAuthログイン", "管理サーバーを選択", "Organization連携"],
    flowCompleteResult: "Guild権限が再検証され、Organization管理を開始できます。",
    flowRest: "Palworld REST連携",
    flowRestDescription: "Dashboardでゲームサーバーの読み取り専用REST接続を確認します。",
    flowRestPoints: ["RESTアドレスを入力", "AdminPasswordを検証", "暗号化して保存"],
    flowRestResult: "サーバー状態と接続プレイヤーを安全に取得できます。",
    flowControl: "利用コマンドを有効化",
    flowControlDescription: "Discord Bot制御からサーバーメンバーに提供するコマンドを選択します。",
    flowControlPoints: ["Status 状態確認", "Player プレイヤー確認", "Guide 連携ガイド"],
    flowControlResult: "有効にしたコマンドだけが実行とヘルプ一覧に表示されます。",
    flowUse: "Discordで利用開始",
    flowUseDescription: "英語コマンドを入力して最初のサーバー状態を確認します。",
    flowUsePoints: ["!yoro status 公開確認", "/yoro status 非公開確認"],
    flowUseResult: "Discordでオンライン状態、人数、バージョン、応答時間を確認できます。",
    flowAddBotAction: "Botを追加",
    flowLoginAction: "Discordでログイン",
    flowDashboardAction: "Dashboardを開く",
    flowCommandsAction: "コマンドを見る",
    flowPreviewEyebrow: "COMPLETE",
    flowPreviewTitle: "連携完了後はこのように表示されます",
    flowPreviewDescription: "登録済みPalworldサーバーの実際のREST応答がDiscord Embedに表示されます。",
    commandsTitle: "Discordコマンド一覧",
    commandsDescription: "すべてのコマンドは英語で入力します。Dashboardで無効にしたコマンドは実行とヘルプの両方から除外され、応答文はサーバーの表示言語に従います。",
    publicCommands: "一般ユーザー・公開応答",
    slashCommands: "実行者のみ・非公開応答",
    adminCommands: "管理者専用",
    aliases: "別名",
    condition: "有効化条件",
    publicCondition: "Organization連携・公開コマンド有効・該当コマンド有効",
    slashDescription: "/yoro status、/yoro player、/yoro guideは実行者だけに表示される応答を使用します。",
    adminDescription: "/yoro setupと/yoro languageはサーバー所有者・Administrator・Manage Guild権限を持つユーザーだけが利用でき、言語変更は連携済みOrganizationのowner・managerだけが保存できます。/yoro dashboardは固定Dashboardリンクを非公開で提供します。",
    playerMatchNotice: "プレイヤープロフィールはニックネームが完全一致した場合のみ確定します。部分一致と限定的な入力ミスは関連候補としてのみ表示します。",
    setupNotice: "Web Dashboardが基本の連携経路で、`/yoro setup` は復旧用ワンタイムリンクとして維持されます。運用command登録とfeature flag有効化は別の段階です。",
    securityEyebrow: "SECURITY BY DEFAULT",
    securityTitle: "セキュリティ中心設計",
    securityDescription: "OAuth tokenはAES-256-GCMで暗号化し、連携完了または期限切れ時に破棄します。他のOrganizationのGuild情報は参照・変更できません。",
    securityToken: "OAuth tokenを平文保存しない",
    securityTokenDescription: "Discord OAuth tokenと機密接続情報を暗号化して保存します。",
    securityTenant: "Organization tenant分離",
    securityTenantDescription: "Organization境界を基準にGuildとゲームサーバーデータへのアクセスを分離します。",
    securityPermission: "Guild権限をサーバーで再検証",
    securityPermissionDescription: "連携直前に所有者・Administrator・Manage Guild権限を再確認します。",
    securitySession: "10分期限・ワンタイム設定session",
    securitySessionDescription: "設定sessionを短期間だけ保持し、利用完了または期限切れ後は再利用できません。",
    installEyebrow: "GETTING STARTED",
    installTitle: "Discordでサーバーを確認する方法",
    installDescription: "Bot追加から最初の状態確認までDashboardが段階的に案内します。",
    roadmapEyebrow: "SERVICE STATUS",
    nextTitle: "現在提供中の機能と準備中の機能",
    nextDescription: "実装状態を明確に分け、未提供の機能を完了済みのように案内しません。",
    roadmapCurrent: "現在提供",
    roadmapPlanned: "準備中",
    roadmapCurrentItems: ["Discordサーバー連携", "Palworld REST状態・プレイヤー確認", "Dashboard Bot制御"],
    roadmapPlannedItems: ["障害・復旧の自動通知", "固定ステータスパネル", "Minecraftサーバー連携"],
    commandPreviewEyebrow: "COMMAND PREVIEW",
    commandPreviewTitle: "導入後すぐに使えるコマンド",
    commandPreviewDescription: "コマンド入力は英語に統一し、応答案内はサーバーの韓国語・日本語・英語設定に従います。",
    commandPreviewLink: "すべてのコマンドを見る",
    finalCtaTitle: "ゲームサーバー運用をDiscordと連携しましょう",
    finalCtaDescription: "最小権限でBotを追加し、YORO Dashboardから連携を完了できます。",
    finalCtaGuide: "設定ガイドを見る",
    privacy: "プライバシーポリシー",
    terms: "利用規約",
    contact: "お問い合わせ",
    disclaimer: "Palworld REST直接接続基盤は実装済みですが、運用実連携とDiscord状態通知は準備中です。",
    copyright: "Copyright © 2026 YORO.gg",
  },
} as const;

export type PublicBotSection = "overview" | "gettingStarted" | "commands" | "gameFiles";

type BotText = (typeof botText)[PublicLocale];

const commandPageText = {
  ko: {
    eyebrow: "COMMAND GUIDE",
    title: "Discord 명령어",
    description: "YORO Bot에서 실제로 사용할 수 있는 명령을 권한과 응답 방식까지 한 화면에서 확인하세요.",
    addBot: "Discord에 YORO Bot 추가",
    syntaxNotice: "명령은 영어로만 입력합니다. 응답 문구는 Dashboard 또는 Discord Guild의 표시 언어를 따릅니다.",
    commandGroupLabel: "명령어 대상",
    userTab: "유저 명령어",
    adminTab: "관리자 명령어",
    userTabDescription: "모든 서버 구성원이 사용할 수 있는 조회·안내 명령입니다.",
    adminTabDescription: "서버 연결과 Bot 설정을 변경하는 관리 권한 명령입니다.",
    commandList: "명령 목록",
    detailEyebrow: "COMMAND DETAIL",
    publicResponse: "채널 공개 응답",
    privateResponse: "실행자 전용 응답",
    adminOnly: "관리 권한 필요",
    publicAlternative: "공개 명령",
    privateAlternative: "비공개 명령",
    example: "사용 예시",
    permission: "필요 권한",
    activation: "활성화 조건",
    response: "응답에 포함되는 정보",
    aliases: "지원하는 공개 명령",
    aliasesSummary: "지원 명령과 세부 조건 보기",
    previewTitle: "Discord 응답 미리보기",
    previewExample: "예시 화면",
    previewNotice: "표시 값은 문서용 예시이며 실제 서버의 REST 응답에 따라 달라집니다.",
    previewPrivate: "나에게만 표시됩니다.",
    statusTitle: "서버 상태 확인",
    statusDescription: "Palworld 서버의 온라인 상태와 핵심 지표를 확인합니다.",
    statusPermission: "모든 서버 구성원",
    statusActivation: "Organization 연결 · 공개 명령 및 상태 명령 활성화 · Palworld REST 연결",
    statusResponses: ["온라인 상태", "현재·최대 접속 인원", "서버 버전", "REST 응답 시간"],
    playerTitle: "플레이어 확인",
    playerDescription: "현재 접속자 목록을 보거나 게임 내 닉네임으로 공개 프로필을 검색합니다.",
    playerPermission: "모든 서버 구성원",
    playerActivation: "Organization 연결 · 공개 명령 및 플레이어 명령 활성화 · Palworld REST 연결",
    playerResponses: ["현재 접속 인원", "접속자 목록", "완전 일치 프로필", "부분 일치 연관 검색어"],
    guideTitle: "서버 연결 가이드",
    guideDescription: "Palworld 전용 서버의 REST 설정과 YORO 연결 순서를 확인합니다.",
    guidePermission: "모든 서버 구성원",
    guideActivation: "Organization 연결 · 공개 명령 및 가이드 명령 활성화",
    guideResponses: ["REST 활성화 안내", "Dashboard 연결 순서", "AdminPassword 보안 안내"],
    setupTitle: "Organization 연결 시작",
    setupDescription: "Discord 서버와 YORO Organization을 연결하는 일회용 설정 흐름을 시작합니다.",
    setupPermission: "서버 소유자 · Administrator · Manage Guild",
    setupActivation: "Slash command 등록 · Discord 관리 기능 활성화",
    setupResponses: ["10분 만료 설정 링크", "현재 Guild 권한 재검증", "실행자 전용 안내"],
    languageTitle: "응답 언어 설정",
    languageDescription: "이 Discord 서버에서 YORO Bot이 전송하는 메시지 언어를 변경합니다.",
    languagePermission: "서버 소유자 · Administrator · Manage Guild 및 Organization 관리자",
    languageActivation: "Organization 연결 · Discord 관리 기능 활성화",
    languageResponses: ["자동·한국어·일본어·영어 선택", "Guild별 설정 저장", "다음 응답부터 즉시 적용"],
    dashboardTitle: "Dashboard 열기",
    dashboardDescription: "고정된 YORO Dashboard 주소를 실행자에게만 제공합니다.",
    dashboardPermission: "모든 서버 구성원",
    dashboardActivation: "Slash command 등록",
    dashboardResponses: ["고정 Dashboard 링크", "URL에 token 미포함", "실행자 전용 응답"],
    helpTitle: "사용 가능한 명령 보기",
    helpDescription: "현재 Dashboard에서 활성화된 명령만 언어에 맞춰 보여줍니다.",
    helpPermission: "모든 서버 구성원",
    helpActivation: "Organization 연결 · 공개 명령 활성화",
    helpResponses: ["활성 명령 목록", "입력 언어 우선 안내", "안전한 사용 예시"],
    previewStatusBody: "서버가 정상적으로 운영 중입니다.",
    previewPlayerBody: "현재 접속 중인 플레이어를 확인했습니다.",
    previewGuideBody: "Palworld REST 연결은 Dashboard에서 안전하게 완료하세요.",
    previewSetupBody: "Guild 권한 확인 후 일회용 설정 링크를 발급했습니다.",
    previewLanguageBody: "이 서버에서 전송되는 YORO Bot 메시지 언어를 변경했습니다.",
    previewDashboardBody: "YORO Dashboard에서 Organization과 Bot 설정을 관리하세요.",
    previewHelpBody: "현재 사용할 수 있는 명령만 표시합니다.",
  },
  ja: {
    eyebrow: "COMMAND GUIDE",
    title: "Discordコマンド",
    description: "YORO Botで実際に利用できるコマンドを、権限と応答方式まで一つの画面で確認できます。",
    addBot: "DiscordにYORO Botを追加",
    syntaxNotice: "コマンドは英語のみで入力します。応答文はDashboardまたはDiscord Guildの表示言語に従います。",
    commandGroupLabel: "コマンド対象",
    userTab: "ユーザーコマンド",
    adminTab: "管理者コマンド",
    userTabDescription: "すべてのサーバーメンバーが利用できる照会・ガイドコマンドです。",
    adminTabDescription: "サーバー連携とBot設定を変更する管理権限コマンドです。",
    commandList: "コマンド一覧",
    detailEyebrow: "COMMAND DETAIL",
    publicResponse: "チャンネル公開応答",
    privateResponse: "実行者のみの応答",
    adminOnly: "管理権限が必要",
    publicAlternative: "公開コマンド",
    privateAlternative: "非公開コマンド",
    example: "使用例",
    permission: "必要権限",
    activation: "有効化条件",
    response: "応答に含まれる情報",
    aliases: "対応する公開コマンド",
    aliasesSummary: "対応コマンドと詳細条件を見る",
    previewTitle: "Discord応答プレビュー",
    previewExample: "サンプル画面",
    previewNotice: "表示値はドキュメント用の例で、実際のサーバーREST応答により変わります。",
    previewPrivate: "自分だけに表示されます。",
    statusTitle: "サーバー状態を確認",
    statusDescription: "Palworldサーバーのオンライン状態と主要指標を確認します。",
    statusPermission: "すべてのサーバーメンバー",
    statusActivation: "Organization連携・公開コマンドと状態コマンド有効・Palworld REST連携",
    statusResponses: ["オンライン状態", "現在・最大接続人数", "サーバーバージョン", "REST応答時間"],
    playerTitle: "プレイヤーを確認",
    playerDescription: "現在の接続者一覧を確認し、ゲーム内ニックネームから公開プロフィールを検索します。",
    playerPermission: "すべてのサーバーメンバー",
    playerActivation: "Organization連携・公開コマンドとプレイヤーコマンド有効・Palworld REST連携",
    playerResponses: ["現在の接続人数", "接続者一覧", "完全一致プロフィール", "部分一致の関連候補"],
    guideTitle: "サーバー連携ガイド",
    guideDescription: "Palworld専用サーバーのREST設定とYORO連携手順を確認します。",
    guidePermission: "すべてのサーバーメンバー",
    guideActivation: "Organization連携・公開コマンドとガイドコマンド有効",
    guideResponses: ["REST有効化案内", "Dashboard連携手順", "AdminPasswordの安全案内"],
    setupTitle: "Organization連携を開始",
    setupDescription: "DiscordサーバーとYORO Organizationを連携するワンタイム設定を開始します。",
    setupPermission: "サーバー所有者・Administrator・Manage Guild",
    setupActivation: "Slash command登録・Discord管理機能有効",
    setupResponses: ["10分期限の設定リンク", "現在のGuild権限再検証", "実行者のみの案内"],
    languageTitle: "応答言語を設定",
    languageDescription: "このDiscordサーバーでYORO Botが送信するメッセージ言語を変更します。",
    languagePermission: "サーバー所有者・Administrator・Manage GuildおよびOrganization管理者",
    languageActivation: "Organization連携・Discord管理機能有効",
    languageResponses: ["自動・韓国語・日本語・英語を選択", "Guildごとに設定を保存", "次の応答から即時適用"],
    dashboardTitle: "Dashboardを開く",
    dashboardDescription: "固定されたYORO Dashboardアドレスを実行者だけに提供します。",
    dashboardPermission: "すべてのサーバーメンバー",
    dashboardActivation: "Slash command登録",
    dashboardResponses: ["固定Dashboardリンク", "URLにtokenを含まない", "実行者のみの応答"],
    helpTitle: "利用可能なコマンドを見る",
    helpDescription: "Dashboardで現在有効なコマンドだけを言語に合わせて表示します。",
    helpPermission: "すべてのサーバーメンバー",
    helpActivation: "Organization連携・公開コマンド有効",
    helpResponses: ["有効なコマンド一覧", "入力言語を優先する案内", "安全な使用例"],
    previewStatusBody: "サーバーは正常に稼働しています。",
    previewPlayerBody: "現在接続中のプレイヤーを確認しました。",
    previewGuideBody: "Palworld REST連携はDashboardから安全に完了してください。",
    previewSetupBody: "Guild権限を確認し、ワンタイム設定リンクを発行しました。",
    previewLanguageBody: "このサーバーで送信されるYORO Botメッセージの言語を変更しました。",
    previewDashboardBody: "YORO DashboardでOrganizationとBot設定を管理してください。",
    previewHelpBody: "現在利用できるコマンドだけを表示します。",
  },
} as const;

type CommandPageText = (typeof commandPageText)[PublicLocale];

type CommandAudience = "public" | "private" | "admin";
type CommandTab = "user" | "admin";
type CommandDocId = "status" | "player" | "guide" | "setup" | "language" | "dashboard" | "help";

export const publicBotCommandIdsByTab: Readonly<Record<CommandTab, readonly CommandDocId[]>> = Object.freeze({
  user: ["status", "player", "guide", "dashboard", "help"],
  admin: ["setup", "language"],
});

type CommandDoc = Readonly<{
  id: CommandDocId;
  primaryCommand: string;
  alternativeCommand?: string;
  audiences: readonly CommandAudience[];
  title: string;
  description: string;
  permission: string;
  activation: string;
  responses: readonly string[];
  aliases: readonly string[];
}>;

function BotFeatureIcon({ kind }: Readonly<{ kind: "status" | "player" | "dashboard" | "lock" | "tenant" | "permission" | "session" }>) {
  const paths = {
    status: <><path d="M4 16l4-5 4 3 6-8 2 2" /><path d="M4 20h16" /></>,
    player: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.7-4 2.5-6 5.5-6s4.8 2 5.5 6" /><path d="M16 7h5M18.5 4.5v5" /></>,
    dashboard: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3M12 14v2" /></>,
    tenant: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 20c.6-4 2.4-6 5.5-6s4.9 2 5.5 6M14 14c3.7-.6 6 1.4 6.8 5" /></>,
    permission: <><path d="M12 3l8 3v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6l8-3z" /><path d="M9 12l2 2 4-5" /></>,
    session: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  } as const;
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      {paths[kind]}
    </svg>
  );
}

function DiscordStatusPreview({ compact, text }: Readonly<{ compact?: boolean; text: BotText }>) {
  return (
    <figure className={`public-bot-discord-preview${compact ? " is-compact" : ""}`}>
      <div className="public-bot-discord-preview__channel">
        <span aria-hidden="true">#</span>
        <strong>{text.previewChannel}</strong>
        <span>{text.previewExample}</span>
      </div>
      <div className="public-bot-discord-preview__message">
        <span className="public-bot-discord-preview__avatar" aria-hidden="true"><DiscordSymbolIcon /></span>
        <div className="public-bot-discord-preview__body">
          <div className="public-bot-discord-preview__meta">
            <strong>{text.previewBotName}</strong>
            <span>BOT</span>
            <small>{text.previewTime}</small>
          </div>
          <div className="public-bot-discord-embed">
            <div className="public-bot-discord-embed__title">
              <span aria-hidden="true" />
              <strong>{text.previewServerTitle}</strong>
            </div>
            <p>{text.previewServerDescription}</p>
            <dl>
              <div><dt>{text.previewStatus}</dt><dd className="is-online">{text.previewOnline}</dd></div>
              <div><dt>{text.previewPlayers}</dt><dd>4 / 32</dd></div>
              <div><dt>{text.previewLatency}</dt><dd>42ms</dd></div>
              <div><dt>{text.previewVersion}</dt><dd>v1.0.2</dd></div>
            </dl>
            <div className="public-bot-discord-embed__actions" aria-hidden="true">
              <span>{text.previewDashboard}</span>
              <span>{text.previewRefresh}</span>
            </div>
          </div>
        </div>
      </div>
      <figcaption>{text.previewDisclaimer}</figcaption>
    </figure>
  );
}

function DiscordCommandPreview({
  command,
  privateResponse,
  text,
}: Readonly<{
  command: CommandDoc;
  privateResponse: boolean;
  text: CommandPageText;
}>) {
  const bodyByCommand: Readonly<Record<CommandDocId, string>> = {
    status: text.previewStatusBody,
    player: text.previewPlayerBody,
    guide: text.previewGuideBody,
    setup: text.previewSetupBody,
    language: text.previewLanguageBody,
    dashboard: text.previewDashboardBody,
    help: text.previewHelpBody,
  };
  return (
    <figure className="public-bot-command-response-preview">
      <div className="public-bot-command-response-preview__header">
        <strong>{text.previewTitle}</strong>
        <span>{text.previewExample}</span>
      </div>
      {privateResponse ? (
        <p className="public-bot-command-response-preview__private">
          <span aria-hidden="true">◉</span> {text.previewPrivate}
        </p>
      ) : null}
      <div className="public-bot-command-response-preview__message">
        <span className="public-bot-command-response-preview__avatar" aria-hidden="true">
          <DiscordSymbolIcon />
        </span>
        <div>
          <p className="public-bot-command-response-preview__meta">
            <strong>YORO Bot</strong><span>BOT</span><small>16:42</small>
          </p>
          <div className="public-bot-command-response-preview__embed">
            <strong>{command.title}</strong>
            <p>{bodyByCommand[command.id]}</p>
            <ul>
              {command.responses.slice(0, 4).map((response) => <li key={response}>{response}</li>)}
            </ul>
          </div>
        </div>
      </div>
      <figcaption>{text.previewNotice}</figcaption>
    </figure>
  );
}

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
  if (page === "valorant") {
    setPublicPath("/valorant");
    return;
  }
  if (page === "minecraft") {
    setPublicPath("/minecraft");
    return;
  }
  if (page === "bot") {
    setPublicPath("/bot");
    return;
  }
  setPublicPath("/");
}

function openTrackedYoroDashboard(): void {
  trackGoogleAnalyticsEvent("bot_dashboard", { link_context: "public_bot" });
  openYoroDashboard();
}

export function PublicBotPage() {
  const { locale, changeLocale } = usePublicLocale(noLocalePreference);
  const text = botText[locale];
  const commandText = commandPageText[locale];
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
  const [commandTab, setCommandTab] = useState<CommandTab>("user");
  const [selectedCommandId, setSelectedCommandId] = useState<CommandDocId>("status");
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  /* 계정 세션·핸들러의 단일 원본 — shared/public-account-login.ts.
     Bot 은 GA link_context 만 화면 전용 값으로 오버라이드합니다. */
  const {
    accountConnected,
    accountUser,
    loginWithDiscord,
    loginWithTwitch,
    logout: logoutAccount,
  } = usePublicAccountLogin({ tracking: { linkContext: "public_bot_account" } });
  const commandDocs = useMemo<readonly CommandDoc[]>(() => {
    const prefixAliases = (command: "help" | "status" | "player" | "guide") => {
      const definition = DISCORD_BOT_PREFIX_COMMAND_MANIFEST.find((entry) => entry.command === command);
      if (!definition) return [];
      return definition.aliases.map((alias) => alias ? `!yoro ${alias}` : "!yoro");
    };
    const prefixCommand = (command: string) => `!yoro ${command}`;

    return [
      {
        id: "status",
        primaryCommand: "/yoro status",
        alternativeCommand: prefixCommand("status"),
        audiences: ["public", "private"],
        title: commandText.statusTitle,
        description: commandText.statusDescription,
        permission: commandText.statusPermission,
        activation: commandText.statusActivation,
        responses: commandText.statusResponses,
        aliases: prefixAliases("status"),
      },
      {
        id: "player",
        primaryCommand: "/yoro player",
        alternativeCommand: prefixCommand("player {nickname}"),
        audiences: ["public", "private"],
        title: commandText.playerTitle,
        description: commandText.playerDescription,
        permission: commandText.playerPermission,
        activation: commandText.playerActivation,
        responses: commandText.playerResponses,
        aliases: prefixAliases("player"),
      },
      {
        id: "guide",
        primaryCommand: "/yoro guide",
        alternativeCommand: prefixCommand("guide"),
        audiences: ["public", "private"],
        title: commandText.guideTitle,
        description: commandText.guideDescription,
        permission: commandText.guidePermission,
        activation: commandText.guideActivation,
        responses: commandText.guideResponses,
        aliases: prefixAliases("guide"),
      },
      {
        id: "setup",
        primaryCommand: "/yoro setup",
        audiences: ["admin"],
        title: commandText.setupTitle,
        description: commandText.setupDescription,
        permission: commandText.setupPermission,
        activation: commandText.setupActivation,
        responses: commandText.setupResponses,
        aliases: [],
      },
      {
        id: "language",
        primaryCommand: "/yoro language locale:<auto|ko|ja|en>",
        audiences: ["admin"],
        title: commandText.languageTitle,
        description: commandText.languageDescription,
        permission: commandText.languagePermission,
        activation: commandText.languageActivation,
        responses: commandText.languageResponses,
        aliases: [],
      },
      {
        id: "dashboard",
        primaryCommand: "/yoro dashboard",
        audiences: ["private"],
        title: commandText.dashboardTitle,
        description: commandText.dashboardDescription,
        permission: commandText.dashboardPermission,
        activation: commandText.dashboardActivation,
        responses: commandText.dashboardResponses,
        aliases: [],
      },
      {
        id: "help",
        primaryCommand: "/yoro help",
        alternativeCommand: "!yoro",
        audiences: ["public", "private"],
        title: commandText.helpTitle,
        description: commandText.helpDescription,
        permission: commandText.helpPermission,
        activation: commandText.helpActivation,
        responses: commandText.helpResponses,
        aliases: prefixAliases("help"),
      },
    ];
  }, [commandText]);
  const filteredCommandDocs = useMemo(() => {
    const commandIds = publicBotCommandIdsByTab[commandTab];
    return commandDocs.filter((command) => commandIds.includes(command.id));
  }, [commandDocs, commandTab]);
  const selectedCommand = filteredCommandDocs.find((command) => command.id === selectedCommandId)
    ?? filteredCommandDocs[0];
  const selectedCommandSyntax = selectedCommand?.primaryCommand;
  const selectedAlternativeSyntax = selectedCommand?.alternativeCommand
    ? selectedCommandSyntax === selectedCommand.primaryCommand
      ? selectedCommand.alternativeCommand
      : selectedCommand.primaryCommand
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
              <a
                aria-label={text.addBotNewTab}
                className="public-bot-header-cta"
                href={botInstallUrl()}
                rel="noopener noreferrer"
                target="_blank"
              >
                <DiscordSymbolIcon />
                <strong>{text.addBot}</strong>
              </a>
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
                onDashboard={openTrackedYoroDashboard}
                onDiscordLogin={loginWithDiscord}
                onLogin={loginWithTwitch}
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
                    onDashboard={openTrackedYoroDashboard}
                    onDiscordLogin={loginWithDiscord}
                    onLogin={loginWithTwitch}
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
                <h1 className={locale === "ja" ? "is-ja" : undefined}>
                  <span>{text.heroLead}</span>
                  <strong>{text.heroAccent}</strong>
                  <span>{text.heroTail}</span>
                </h1>
                <p>{text.heroDescription}</p>
                <div className="public-bot-capabilities" aria-label={text.coreTitle}>
                  {[text.heroTagStatus, text.heroTagPlayer, text.heroTagDashboard].map((item) => (
                    <span key={item}><span aria-hidden="true">✓</span>{item}</span>
                  ))}
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
                  <a className="public-bot-button is-secondary" href="/dashboard">
                    {text.dashboardView}<span aria-hidden="true">→</span>
                  </a>
                </div>
                <div className="public-bot-trust-row">
                  {[text.trustFree, text.trustPermission, text.trustSetup].map((item) => (
                    <span key={item}><span aria-hidden="true">✓</span>{item}</span>
                  ))}
                </div>
              </div>
              <div className="public-bot-hero__visual">
                <DiscordStatusPreview compact text={text} />
                <div className="public-bot-connection-map" aria-hidden="true">
                  <span>PALWORLD</span><strong>Y</strong><span>DASHBOARD</span>
                </div>
              </div>
            </section>

            <section className="public-bot-section public-bot-overview-section" id="bot-features">
              <div className="public-bot-section__heading">
                <span>{text.coreEyebrow}</span>
                <h2>{text.coreTitle}</h2>
                <p>{text.coreDescription}</p>
              </div>
              <div className="public-bot-feature-grid public-bot-core-feature-grid">
                {([
                  ["status", text.featureRealtime, text.featureRealtimeDescription],
                  ["player", text.featurePlayers, text.featurePlayersDescription],
                  ["dashboard", text.featureDashboard, text.featureDashboardDescription],
                ] as const).map(([icon, title, description]) => (
                  <article className="public-bot-feature is-ready" key={title}>
                    <span className="public-bot-feature__icon"><BotFeatureIcon kind={icon} /></span>
                    <span className="public-bot-feature__status">{text.available}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="public-bot-message-showcase" id="bot-message-preview">
              <div className="public-bot-message-showcase__copy">
                <span className="public-bot-eyebrow">{text.previewEyebrow}</span>
                <h2>{text.previewSectionTitle}</h2>
                <p>{text.previewSectionDescription}</p>
                <a className="public-bot-text-link" href={localizedPublicUrl("/bot/commands", locale)} onClick={(event) => { event.preventDefault(); setPublicPath("/bot/commands"); }}>
                  {text.commandPreviewLink}<span aria-hidden="true">→</span>
                </a>
              </div>
              <DiscordStatusPreview text={text} />
            </section>

            <section className="public-bot-section public-bot-security" id="bot-security">
              <div className="public-bot-section__heading">
                <span>{text.securityEyebrow}</span>
                <h2>{text.securityTitle}</h2>
                <p>{text.securityDescription}</p>
              </div>
              <div className="public-bot-security__grid">
                {([
                  ["lock", text.securityToken, text.securityTokenDescription],
                  ["tenant", text.securityTenant, text.securityTenantDescription],
                  ["permission", text.securityPermission, text.securityPermissionDescription],
                  ["session", text.securitySession, text.securitySessionDescription],
                ] as const).map(([icon, title, description]) => (
                  <article key={title}>
                    <span><BotFeatureIcon kind={icon} /></span>
                    <div><h3>{title}</h3><p>{description}</p></div>
                  </article>
                ))}
              </div>
            </section>

            <section className="public-bot-section public-bot-install" id="bot-install">
              <div className="public-bot-section__heading">
                <span>{text.installEyebrow}</span>
                <h2>{text.installTitle}</h2>
                <p>{text.installDescription}</p>
              </div>
              <ol>
                {[
                  text.flowIssue,
                  text.flowLogin,
                  text.flowComplete,
                  text.flowRest,
                  text.flowUse,
                ].map((title, index) => (
                  <li key={title}><span>{index + 1}</span><strong>{title}</strong></li>
                ))}
              </ol>
              <a className="public-bot-text-link" href={localizedPublicUrl("/bot/getting-started", locale)} onClick={(event) => { event.preventDefault(); setPublicPath("/bot/getting-started"); }}>
                {text.setupGuide}<span aria-hidden="true">→</span>
              </a>
            </section>

            <section className="public-bot-section public-bot-command-preview" id="bot-command-preview">
              <div className="public-bot-command-preview__copy">
                <span className="public-bot-eyebrow">{text.commandPreviewEyebrow}</span>
                <h2>{text.commandPreviewTitle}</h2>
                <p>{text.commandPreviewDescription}</p>
                <a className="public-bot-text-link" href={localizedPublicUrl("/bot/commands", locale)} onClick={(event) => { event.preventDefault(); setPublicPath("/bot/commands"); }}>
                  {text.commandPreviewLink}<span aria-hidden="true">→</span>
                </a>
              </div>
              <div className="public-bot-command-preview__list">
                {["!yoro status", "!yoro player", "!yoro guide", "/yoro setup", "/yoro language", "/yoro dashboard", "/yoro help"].map((command) => (
                  <code key={command}>{command}</code>
                ))}
              </div>
            </section>

            <section className="public-bot-next" id="bot-roadmap">
              <div className="public-bot-section__heading">
                <span>{text.roadmapEyebrow}</span>
                <h2>{text.nextTitle}</h2>
                <p>{text.nextDescription}</p>
              </div>
              <div className="public-bot-roadmap-grid">
                <article className="is-current">
                  <h3>{text.roadmapCurrent}</h3>
                  <ul>{text.roadmapCurrentItems.map((item) => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
                </article>
                <article>
                  <h3>{text.roadmapPlanned}</h3>
                  <ul>{text.roadmapPlannedItems.map((item) => <li key={item}><span aria-hidden="true">○</span>{item}</li>)}</ul>
                </article>
              </div>
            </section>

            <section className="public-bot-final-cta">
              <div><h2>{text.finalCtaTitle}</h2><p>{text.finalCtaDescription}</p></div>
              <div>
                <a aria-label={text.addBotNewTab} className="public-bot-button is-primary" href={botInstallUrl()} rel="noopener noreferrer" target="_blank">
                  <DiscordSymbolIcon />{text.addBot}
                </a>
                <a className="public-bot-button is-secondary" href={localizedPublicUrl("/bot/getting-started", locale)} onClick={(event) => { event.preventDefault(); setPublicPath("/bot/getting-started"); }}>
                  {text.finalCtaGuide}<span aria-hidden="true">→</span>
                </a>
              </div>
            </section>
          </>
        ) : null}

        {activeSection === "gettingStarted" ? (() => {
          const steps = [
            {
              action: "install",
              description: text.flowIssueDescription,
              icon: "discord",
              points: text.flowIssuePoints,
              result: text.flowIssueResult,
              title: text.flowIssue,
            },
            {
              action: "login",
              description: text.flowCompleteDescription,
              icon: "permission",
              points: text.flowCompletePoints,
              result: text.flowCompleteResult,
              title: text.flowComplete,
            },
            {
              action: "dashboard",
              description: text.flowRestDescription,
              icon: "status",
              points: text.flowRestPoints,
              result: text.flowRestResult,
              title: text.flowRest,
            },
            {
              action: "dashboard",
              description: text.flowControlDescription,
              icon: "dashboard",
              points: text.flowControlPoints,
              result: text.flowControlResult,
              title: text.flowControl,
            },
            {
              action: "commands",
              description: text.flowUseDescription,
              icon: "session",
              points: text.flowUsePoints,
              result: text.flowUseResult,
              title: text.flowUse,
            },
          ] as const;
          return (
            <section className="public-bot-onboarding public-bot-page-section" id="bot-flow">
              <nav aria-label={text.flowProgressLabel} className="public-bot-onboarding__progress">
                <ol>
                  {steps.map((step, index) => (
                    <li key={step.title}>
                      <span>{index + 1}</span>
                      <strong>{step.title}</strong>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className="public-bot-onboarding__layout">
                <ol className="public-bot-onboarding__timeline">
                  {steps.map((step, index) => (
                    <li key={step.title}>
                      <span className="public-bot-onboarding__marker" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <article>
                        <div className="public-bot-onboarding__step-icon" aria-hidden="true">
                          {step.icon === "discord"
                            ? <DiscordSymbolIcon />
                            : <BotFeatureIcon kind={step.icon} />}
                        </div>
                        <div className="public-bot-onboarding__step-copy">
                          <span>{text.flowStep} {index + 1}</span>
                          <h2>{step.title}</h2>
                          <p>{step.description}</p>
                          <ul>
                            {step.points.map((point) => (
                              <li key={point}><span aria-hidden="true">✓</span>{point}</li>
                            ))}
                          </ul>
                          <div className="public-bot-onboarding__result">
                            <span>{text.flowResult}</span>
                            <strong>{step.result}</strong>
                          </div>
                          {step.action === "install" ? (
                            <a
                              aria-label={text.addBotNewTab}
                              className="public-bot-button is-primary"
                              href={botInstallUrl()}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <DiscordSymbolIcon />
                              {text.flowAddBotAction}
                            </a>
                          ) : step.action === "login" ? (
                            <button
                              className="public-bot-button is-secondary"
                              onClick={loginWithDiscord}
                              type="button"
                            >
                              <DiscordSymbolIcon />
                              {text.flowLoginAction}
                            </button>
                          ) : step.action === "dashboard" ? (
                            <button
                              className="public-bot-button is-secondary"
                              onClick={openTrackedYoroDashboard}
                              type="button"
                            >
                              <BotFeatureIcon kind="dashboard" />
                              {text.flowDashboardAction}
                            </button>
                          ) : (
                            <a
                              className="public-bot-button is-secondary"
                              href={localizedPublicUrl("/bot/commands", locale)}
                              onClick={(event) => {
                                event.preventDefault();
                                setPublicPath("/bot/commands");
                              }}
                            >
                              {text.flowCommandsAction}
                              <span aria-hidden="true">→</span>
                            </a>
                          )}
                        </div>
                      </article>
                    </li>
                  ))}
                </ol>

                <aside className="public-bot-onboarding__preview">
                  <span>{text.flowPreviewEyebrow}</span>
                  <h2>{text.flowPreviewTitle}</h2>
                  <p>{text.flowPreviewDescription}</p>
                  <DiscordStatusPreview compact text={text} />
                  <a
                    className="public-bot-button is-secondary"
                    href={localizedPublicUrl("/bot/commands", locale)}
                    onClick={(event) => {
                      event.preventDefault();
                      setPublicPath("/bot/commands");
                    }}
                  >
                    {text.flowCommandsAction}
                    <span aria-hidden="true">→</span>
                  </a>
                </aside>
              </div>
              <p className="public-bot-notice" role="note">{text.setupNotice}</p>
            </section>
          );
        })() : null}
        {activeSection === "gettingStarted" ? <PublicBotFaq locale={locale} page="gettingStarted" /> : null}

        {activeSection === "commands" ? (
          <section className="public-bot-command-docs public-bot-page-section" id="bot-commands">
            <header className="public-bot-command-docs__hero">
              <div>
                <span>{commandText.eyebrow}</span>
                <h1>{commandText.title}</h1>
                <p>{commandText.description}</p>
                <small>{commandText.syntaxNotice}</small>
              </div>
              <a
                className="public-bot-button is-primary"
                href={botInstallUrl()}
                rel="noopener noreferrer"
                target="_blank"
              >
                <DiscordSymbolIcon />
                {commandText.addBot}
              </a>
            </header>

            <div className="public-bot-command-docs__tools">
              <div
                aria-label={commandText.commandGroupLabel}
                className="public-bot-command-tabs"
                role="tablist"
              >
                {([
                  ["user", commandText.userTab],
                  ["admin", commandText.adminTab],
                ] as const).map(([value, label]) => (
                  <button
                    aria-controls={`bot-command-panel-${value}`}
                    aria-selected={commandTab === value}
                    id={`bot-command-tab-${value}`}
                    key={value}
                    onClick={() => {
                      setCommandTab(value);
                      setSelectedCommandId(value === "admin" ? "setup" : "status");
                    }}
                    role="tab"
                    tabIndex={commandTab === value ? 0 : -1}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p>{commandTab === "admin"
                ? commandText.adminTabDescription
                : commandText.userTabDescription}</p>
            </div>

            <div
              aria-labelledby={`bot-command-tab-${commandTab}`}
              className="public-bot-command-docs__layout"
              id={`bot-command-panel-${commandTab}`}
              role="tabpanel"
            >
              <nav className="public-bot-command-index" aria-label={commandText.commandList}>
                <h2>{commandText.commandList}</h2>
                {filteredCommandDocs.length > 0 ? (
                  <ul>
                    {filteredCommandDocs.map((command) => (
                      <li key={command.id}>
                        <button
                          aria-current={selectedCommand?.id === command.id ? "true" : undefined}
                          onClick={() => setSelectedCommandId(command.id)}
                          type="button"
                        >
                          <code>{command.primaryCommand}</code>
                          <span>{command.title}</span>
                          <small>
                            {command.audiences.includes("admin")
                              ? commandText.adminOnly
                              : command.primaryCommand.startsWith("/")
                                ? commandText.privateResponse
                                : commandText.publicResponse}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </nav>

              {selectedCommand ? (
                <article className="public-bot-command-detail" id="bot-command-detail">
                  <div className="public-bot-command-detail__copy">
                    <span className="public-bot-command-detail__eyebrow">{commandText.detailEyebrow}</span>
                    <div className="public-bot-command-detail__badges">
                      {selectedCommand.audiences.includes("public") ? <span>{commandText.publicResponse}</span> : null}
                      {selectedCommand.audiences.includes("private") ? <span>{commandText.privateResponse}</span> : null}
                      {selectedCommand.audiences.includes("admin") ? <span className="is-admin">{commandText.adminOnly}</span> : null}
                    </div>
                    <code className="public-bot-command-detail__command">{selectedCommandSyntax}</code>
                    <h2>{selectedCommand.title}</h2>
                    <p className="public-bot-command-detail__description">{selectedCommand.description}</p>
                    {selectedAlternativeSyntax ? (
                      <div className="public-bot-command-detail__alternative">
                        <span>{selectedAlternativeSyntax.startsWith("!")
                          ? commandText.publicAlternative
                          : commandText.privateAlternative}</span>
                        <code>{selectedAlternativeSyntax}</code>
                      </div>
                    ) : null}
                    <section className="public-bot-command-detail__example" aria-labelledby="command-example-title">
                      <h3 id="command-example-title">{commandText.example}</h3>
                      <code>{selectedCommandSyntax}</code>
                    </section>
                    <dl className="public-bot-command-detail__facts">
                      <div><dt>{commandText.permission}</dt><dd>{selectedCommand.permission}</dd></div>
                      <div><dt>{commandText.activation}</dt><dd>{selectedCommand.activation}</dd></div>
                    </dl>
                    <section className="public-bot-command-detail__response" aria-labelledby="command-response-title">
                      <h3 id="command-response-title">{commandText.response}</h3>
                      <ul>{selectedCommand.responses.map((response) => <li key={response}>{response}</li>)}</ul>
                    </section>
                    <details className="public-bot-command-detail__more">
                      <summary>{commandText.aliasesSummary}</summary>
                      {selectedCommand.aliases.length > 0 ? (
                        <div>
                          <strong>{commandText.aliases}</strong>
                          <p>{selectedCommand.aliases.join(" · ")}</p>
                        </div>
                      ) : null}
                      <div>
                        <strong>{commandText.activation}</strong>
                        <p>{selectedCommand.activation}</p>
                      </div>
                      {selectedCommand.id === "player" ? <p>{text.playerMatchNotice}</p> : null}
                    </details>
                  </div>
                  <DiscordCommandPreview
                    command={selectedCommand}
                    privateResponse={selectedCommandSyntax?.startsWith("/") ?? false}
                    text={commandText}
                  />
                </article>
              ) : null}
            </div>
          </section>
        ) : null}
        {activeSection === "commands" ? <PublicBotFaq locale={locale} page="commands" /> : null}

        {activeSection === "gameFiles" ? (
          <>
            <PalworldDedicatedServerSettings locale={locale} />
            <PublicBotFaq locale={locale} page="gameFiles" />
          </>
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

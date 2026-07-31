import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BotManagementGameServer,
  BotManagementOrganization,
  PalworldServerDashboardResponse,
  PalworldServerStatus,
  PalworldServerRegion
} from "@streamops/shared";
import { detectDashboardLocale, type DashboardLocale } from "../../i18n";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  EmptyStateDescription,
  EmptyStateTitle,
  SkeletonCard,
  StatusPill,
  type StatusTone
} from "../../shared/ui";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import {
  BotManagementApiError,
  botInstallUrl,
  claimManagementGuild,
  createManagementGameServer,
  deleteManagementGameServer,
  getManagementConnectSession,
  getManagementPalworldRestConnection,
  getManagementSession,
  listManagementGameServers,
  managementConnectUrl,
  managementLoginUrl,
  managementSessionNeedsGuildConnection,
  refreshManagementPalworldRestConnection,
  removeManagementPalworldRestConnection,
  saveManagementPalworldRestConnection,
  testManagementPalworldRestConnection,
  type BotManagementConnectSession,
  type BotManagementSession
} from "./api";
import { BotControlCard } from "./BotControlCard";

const copy = {
  ko: {
    eyebrow: "YORO BOT MANAGEMENT",
    overviewTitle: "Organization 개요",
    overviewDescription: "연결된 Organization을 선택하고 Discord Bot과 Palworld 서버 관리 화면으로 이동합니다.",
    botTitle: "Discord Bot 제어",
    botDescription: "공개 명령, 응답 언어와 Palworld 상태 모듈을 Organization별로 관리합니다.",
    serversTitle: "Palworld 서버 관리",
    serversDescription: "Palworld REST 서버 등록, 인증과 연결 상태를 관리합니다.",
    botDestination: "Discord Bot 설정",
    botDestinationDescription: "일반 사용자 명령, Palworld 모듈과 Discord 응답 표시 항목을 설정합니다.",
    botDestinationAction: "Bot 제어 열기",
    serverDestination: "Palworld 서버",
    serverDestinationDescription: "REST 주소와 AdminPassword를 검증하고 서버 연결 상태를 확인합니다.",
    serverDestinationAction: "서버 관리 열기",
    loginTitle: "Discord 관리 로그인이 필요합니다.",
    loginDescription: "Discord OAuth는 사용자 확인에만 사용하고, 로그인 후 즉시 폐기합니다.",
    login: "Discord로 관리 로그인",
    organization: "Organization 선택",
    noOrganization: "연결된 Organization이 없습니다.",
    noOrganizationDescription: "Discord로 로그인하여 Bot이 설치된 서버를 연결해 주세요.",
    connectTitle: "Discord 서버 연결",
    connectDescription: "관리 권한이 있고 YORO Bot이 설치된 서버만 연결할 수 있습니다.",
    connectLogin: "Discord로 로그인하고 서버 선택",
    existingLogin: "기존 Organization 로그인",
    organizationField: "관리할 Organization",
    installBot: "Discord 서버에 YORO Bot 추가",
    installBotHint: "Bot 추가 화면은 새 탭에서 열립니다. 설치 후 이 탭으로 돌아오면 상태를 자동으로 확인합니다.",
    installedGuilds: "연결 가능한 Discord 서버",
    missingGuilds: "Bot 설치가 필요한 서버",
    installationPending: "Bot 설치 확인 중",
    installationConfirmed: "Bot 설치 확인됨",
    gatewayUnavailable: "Bot Gateway가 비활성 상태라 설치 여부를 확인할 수 없습니다.",
    refreshInstallation: "설치 여부 다시 확인",
    noManageableGuilds: "관리 가능한 Discord 서버가 없습니다.",
    createNewOrganization: "선택한 서버로 새 Organization 생성",
    claim: "선택한 Discord 서버 연결",
    claiming: "연결 중",
    claimCompleted: "Discord 서버 연결이 완료되었습니다.",
    alreadyConnected: "이 Discord 서버는 이미 다른 Organization에 연결되어 있습니다.",
    guildPermissionRequired: "이 Discord 서버를 관리할 권한이 없습니다.",
    setupExpired: "Discord 연결 session이 만료되었습니다. 다시 로그인해 주세요.",
    servers: "Palworld 게임 서버",
    noServers: "등록된 게임 서버가 없습니다.",
    createTitle: "Palworld REST 서버 등록",
    createDescription: "Dashboard에서 구분할 표시 이름과 지역으로 REST 연결 항목을 만듭니다.",
    serverName: "서버 표시 이름",
    serverNameHint: "주소나 포트 입력란이 아닙니다. 알아보기 쉬운 이름을 입력하세요.",
    region: "지역",
    create: "서버 등록",
    creating: "등록 중",
    deleting: "삭제 중",
    createCompleted: "서버 항목을 등록했습니다. 아래에서 REST 주소와 AdminPassword로 연결을 확인해 주세요.",
    deleteServer: "서버 삭제",
    deleteConfirm: "이 서버 설정을 삭제할까요? 저장된 REST 연결도 함께 삭제됩니다.",
    deleteCancel: "취소",
    deleteAction: "삭제 확인",
    deleteCompleted: "Palworld 게임 서버를 삭제했습니다.",
    credentialTitle: "REST 직접 연결 안내",
    credentialDescription: "브라우저가 Palworld 서버로 직접 요청하지 않습니다. YORO Server가 고정된 REST endpoint만 검증하며, AdminPassword는 공통 암호화 저장소에 암호화해 보관합니다.",
    connectionStatus: "REST 연결 상태",
    connectionRefreshing: "연결 상태 확인 중",
    connectionNotConfigured: "REST 미설정",
    connectionNotConfiguredDescription: "REST 주소와 AdminPassword가 아직 저장되지 않았습니다.",
    connectionPending: "연결 확인 중",
    connectionPendingDescription: "YORO Server가 Palworld REST 연결을 확인하고 있습니다.",
    connectionReady: "REST 연결됨",
    connectionReadyDescription: "Palworld REST 인증과 서버 정보 조회가 정상입니다.",
    connectionDegraded: "REST 일부 연결됨",
    connectionDegradedDescription: "서버 인증과 기본 정보는 확인됐지만 상태 지표 조회가 완료되지 않았습니다.",
    connectionUnavailable: "REST 연결 불가",
    connectionUnavailableDescription: "REST 주소, AdminPassword 또는 Palworld REST 설정을 확인하세요.",
    connectionRevoked: "비활성화됨",
    connectionRevokedDescription: "이 서버 항목이 비활성화되었습니다.",
    lastStatusReceived: "최근 연결 확인",
    restSettings: "REST 연결 설정",
    restBaseUrl: "Palworld REST API 주소",
    restBaseUrlHint: "게임 접속 포트가 아니라 REST 주소입니다. 공개 자가 등록은 유효한 인증서가 있는 HTTPS 443 주소만 지원합니다.",
    restPassword: "Palworld AdminPassword",
    restPasswordHint: "Palworld 전용 서버 설정의 AdminPassword입니다. YORO 또는 Discord 비밀번호가 아닙니다. 저장된 연결은 비워 두면 기존 값을 사용합니다.",
    restPolicyPublic: "공개 HTTPS 443 주소는 직접 등록할 수 있습니다.",
    restPolicyPrivate: "LAN, VPN, 사설 IP, HTTP 또는 별도 포트는 운영자의 접속 정책 승인이 필요합니다.",
    restOpen: "REST 설정",
    restClose: "설정 닫기",
    restTest: "연결 테스트",
    restSave: "확인 후 저장",
    restRefresh: "상태 새로고침",
    restRemove: "REST 연결 삭제",
    restTesting: "REST 연결 확인 중",
    restSaved: "REST 연결과 인증을 확인하고 안전하게 저장했습니다.",
    restTestPassed: "REST 연결과 인증이 정상입니다. 저장하려면 확인 후 저장을 선택하세요.",
    restRemoved: "REST 연결을 삭제했습니다.",
    restAuthFailed: "Palworld AdminPassword 인증에 실패했습니다. 전용 서버 설정 값을 확인해 주세요.",
    restTlsFailed: "HTTPS 인증서 또는 hostname 검증에 실패했습니다.",
    restMetricsTimeout: "서버 인증과 기본 정보는 확인됐지만 상태 지표 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
    restMetricsInvalid: "서버 인증과 기본 정보는 확인됐지만 상태 지표 응답 형식이 호환되지 않습니다.",
    restMetricsStatus: "서버 인증과 기본 정보는 확인됐지만 상태 지표 endpoint가 정상 HTTP 상태를 반환하지 않았습니다.",
    restMetricsUnavailable: "서버 인증과 기본 정보는 확인됐지만 상태 지표를 가져오지 못했습니다.",
    restConnectionFailed: "Palworld REST 서버에 연결할 수 없습니다. REST 활성화와 외부 접속 경로를 확인해 주세요.",
    restServerInfo: "서버 정보",
    restPlayers: "접속 인원",
    restLatency: "응답 시간",
    restFeatureDisabledTitle: "Palworld 상태 조회가 비활성화되어 있습니다.",
    restFeatureDisabledDescription: "서비스 운영 설정에서 Palworld 상태 조회를 활성화한 뒤 다시 확인해 주세요.",
    restStorageUnavailableTitle: "YORO의 자격 증명 저장소가 준비되지 않았습니다.",
    restStorageUnavailableDescription: "입력한 Palworld AdminPassword의 문제가 아닙니다. 서비스 운영자가 공통 암호화 저장소를 준비한 뒤 직접 등록할 수 있습니다.",
    entitlement: "Organization마다 Palworld 게임 서버는 1개만 등록할 수 있습니다.",
    permission: "이 작업을 수행할 Organization 권한이 없습니다.",
    unavailable: "관리 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    retry: "다시 시도",
    loading: "Organization 관리 정보를 불러오는 중입니다.",
    owner: "소유자",
    manager: "관리자",
    viewer: "조회자",
    regionAsia: "아시아",
    regionNorthAmerica: "북아메리카",
    regionSouthAmerica: "남아메리카",
    regionEurope: "유럽",
    regionOceania: "오세아니아"
  },
  ja: {
    eyebrow: "YORO BOT MANAGEMENT",
    overviewTitle: "Organization概要",
    overviewDescription: "連携済みOrganizationを選択し、Discord BotとPalworldサーバーの管理画面へ移動します。",
    botTitle: "Discord Bot コントロール",
    botDescription: "公開コマンド、応答言語、Palworld状態モジュールをOrganizationごとに管理します。",
    serversTitle: "Palworldサーバー管理",
    serversDescription: "Palworld RESTサーバーの登録、認証、接続状態を管理します。",
    botDestination: "Discord Bot設定",
    botDestinationDescription: "一般ユーザーコマンド、Palworldモジュール、Discord応答の表示項目を設定します。",
    botDestinationAction: "Botコントロールを開く",
    serverDestination: "Palworldサーバー",
    serverDestinationDescription: "RESTアドレスとAdminPasswordを検証し、サーバー接続状態を確認します。",
    serverDestinationAction: "サーバー管理を開く",
    loginTitle: "Discord管理ログインが必要です。",
    loginDescription: "Discord OAuthは本人確認のみに使用し、ログイン完了後すぐに破棄します。",
    login: "Discordで管理ログイン",
    organization: "Organizationを選択",
    noOrganization: "連携済みのOrganizationがありません。",
    noOrganizationDescription: "Discordでログインし、Botが導入済みのサーバーを連携してください。",
    connectTitle: "Discordサーバー連携",
    connectDescription: "管理権限があり、YORO Botが導入済みのサーバーのみ連携できます。",
    connectLogin: "Discordでログインしてサーバーを選択",
    existingLogin: "既存Organizationにログイン",
    organizationField: "管理するOrganization",
    installBot: "DiscordサーバーにYORO Botを追加",
    installBotHint: "Bot追加画面は新しいタブで開きます。導入後にこのタブへ戻ると、状態を自動で確認します。",
    installedGuilds: "連携可能なDiscordサーバー",
    missingGuilds: "Botの導入が必要なサーバー",
    installationPending: "Botの導入を確認中",
    installationConfirmed: "Botの導入を確認済み",
    gatewayUnavailable: "Bot Gatewayが無効なため、導入状態を確認できません。",
    refreshInstallation: "導入状態を再確認",
    noManageableGuilds: "管理可能なDiscordサーバーがありません。",
    createNewOrganization: "選択したサーバーで新しいOrganizationを作成",
    claim: "選択したDiscordサーバーを連携",
    claiming: "連携中",
    claimCompleted: "Discordサーバーの連携が完了しました。",
    alreadyConnected: "このDiscordサーバーは別のOrganizationに連携済みです。",
    guildPermissionRequired: "このDiscordサーバーを管理する権限がありません。",
    setupExpired: "Discord連携sessionの有効期限が切れました。もう一度ログインしてください。",
    servers: "Palworldゲームサーバー",
    noServers: "登録済みゲームサーバーはありません。",
    createTitle: "Palworld RESTサーバー登録",
    createDescription: "Dashboardで識別する表示名と地域でREST接続項目を作成します。",
    serverName: "サーバー表示名",
    serverNameHint: "アドレスやポートの入力欄ではありません。識別しやすい名前を入力してください。",
    region: "地域",
    create: "サーバー登録",
    creating: "登録中",
    deleting: "削除中",
    createCompleted: "サーバー項目を登録しました。下でRESTアドレスとAdminPasswordを使用して接続を確認してください。",
    deleteServer: "サーバーを削除",
    deleteConfirm: "このサーバー設定を削除しますか？保存済みREST連携も削除されます。",
    deleteCancel: "キャンセル",
    deleteAction: "削除を確認",
    deleteCompleted: "Palworldゲームサーバーを削除しました。",
    credentialTitle: "REST直接接続のご案内",
    credentialDescription: "ブラウザからPalworldサーバーへ直接リクエストしません。YORO Serverが固定REST endpointのみを検証し、AdminPasswordは共通暗号化ストレージへ暗号化して保存します。",
    connectionStatus: "REST接続状態",
    connectionRefreshing: "接続状態を確認中",
    connectionNotConfigured: "REST未設定",
    connectionNotConfiguredDescription: "RESTアドレスとAdminPasswordはまだ保存されていません。",
    connectionPending: "接続確認中",
    connectionPendingDescription: "YORO ServerがPalworld REST接続を確認しています。",
    connectionReady: "REST接続済み",
    connectionReadyDescription: "Palworld REST認証とサーバー情報の取得が正常です。",
    connectionDegraded: "REST一部接続済み",
    connectionDegradedDescription: "サーバー認証と基本情報は確認できましたが、状態指標の取得が完了していません。",
    connectionUnavailable: "REST接続不可",
    connectionUnavailableDescription: "RESTアドレス、AdminPassword、またはPalworld REST設定を確認してください。",
    connectionRevoked: "無効化済み",
    connectionRevokedDescription: "このサーバー項目は無効化されています。",
    lastStatusReceived: "最新の接続確認",
    restSettings: "REST接続設定",
    restBaseUrl: "Palworld REST APIアドレス",
    restBaseUrlHint: "ゲーム接続ポートではなくRESTアドレスです。公開セルフ登録は有効な証明書を持つHTTPS 443アドレスのみ対応します。",
    restPassword: "Palworld AdminPassword",
    restPasswordHint: "Palworld専用サーバー設定のAdminPasswordです。YOROやDiscordのパスワードではありません。保存済み接続では空欄のまま既存値を使用できます。",
    restPolicyPublic: "公開HTTPS 443アドレスは直接登録できます。",
    restPolicyPrivate: "LAN、VPN、プライベートIP、HTTP、別ポートは運営者による接続ポリシーの承認が必要です。",
    restOpen: "REST設定",
    restClose: "設定を閉じる",
    restTest: "接続テスト",
    restSave: "確認して保存",
    restRefresh: "状態を更新",
    restRemove: "REST接続を削除",
    restTesting: "REST接続を確認中",
    restSaved: "REST接続と認証を確認し、安全に保存しました。",
    restTestPassed: "REST接続と認証は正常です。保存するには「確認して保存」を選択してください。",
    restRemoved: "REST接続を削除しました。",
    restAuthFailed: "Palworld AdminPassword認証に失敗しました。専用サーバー設定の値を確認してください。",
    restTlsFailed: "HTTPS証明書またはhostnameの検証に失敗しました。",
    restMetricsTimeout: "サーバー認証と基本情報は確認できましたが、状態指標の応答がタイムアウトしました。しばらくしてからもう一度お試しください。",
    restMetricsInvalid: "サーバー認証と基本情報は確認できましたが、状態指標の応答形式に互換性がありません。",
    restMetricsStatus: "サーバー認証と基本情報は確認できましたが、状態指標endpointが正常なHTTP状態を返しませんでした。",
    restMetricsUnavailable: "サーバー認証と基本情報は確認できましたが、状態指標を取得できませんでした。",
    restConnectionFailed: "Palworld RESTサーバーに接続できません。RESTの有効化と外部接続経路を確認してください。",
    restServerInfo: "サーバー情報",
    restPlayers: "接続人数",
    restLatency: "応答時間",
    restFeatureDisabledTitle: "Palworld状態取得が無効化されています。",
    restFeatureDisabledDescription: "サービスの運用設定でPalworld状態取得を有効化してから、もう一度確認してください。",
    restStorageUnavailableTitle: "YOROの認証情報ストレージが準備されていません。",
    restStorageUnavailableDescription: "入力したPalworld AdminPasswordの問題ではありません。サービス運営者が共通暗号化ストレージを準備した後、ご自身で登録できます。",
    entitlement: "OrganizationごとにPalworldゲームサーバーは1台のみ登録できます。",
    permission: "この操作に必要なOrganization権限がありません。",
    unavailable: "管理機能を利用できません。しばらくしてからもう一度お試しください。",
    retry: "再試行",
    loading: "Organization管理情報を読み込んでいます。",
    owner: "所有者",
    manager: "管理者",
    viewer: "閲覧者",
    regionAsia: "アジア",
    regionNorthAmerica: "北米",
    regionSouthAmerica: "南米",
    regionEurope: "ヨーロッパ",
    regionOceania: "オセアニア"
  }
} as const;

const regions: readonly PalworldServerRegion[] = [
  "asia",
  "north_america",
  "south_america",
  "europe",
  "oceania"
];

export function botManagementConnectionStatusPresentation(
  status: BotManagementGameServer["connectionStatus"],
  locale: DashboardLocale
): Readonly<{ label: string; description: string; tone: StatusTone }> {
  const text = copy[locale];
  if (status === "ready") {
    return {
      label: text.connectionReady,
      description: text.connectionReadyDescription,
      tone: "success"
    };
  }
  if (status === "pending") {
    return {
      label: text.connectionPending,
      description: text.connectionPendingDescription,
      tone: "warning"
    };
  }
  if (status === "unavailable") {
    return {
      label: text.connectionUnavailable,
      description: text.connectionUnavailableDescription,
      tone: "danger"
    };
  }
  if (status === "revoked") {
    return {
      label: text.connectionRevoked,
      description: text.connectionRevokedDescription,
      tone: "neutral"
    };
  }
  return {
    label: text.connectionNotConfigured,
    description: text.connectionNotConfiguredDescription,
    tone: "info"
  };
}

export function restConnectionStatusPresentation(
  response: PalworldServerDashboardResponse | undefined,
  locale: DashboardLocale
): Readonly<{ label: string; description: string; tone: StatusTone }> {
  const text = copy[locale];
  if (response && !response.enabled) {
    return {
      label: text.restFeatureDisabledTitle,
      description: text.restFeatureDisabledDescription,
      tone: "warning"
    };
  }
  if (
    response
    && (
      response.status.errorCode === "key_missing"
      || response.status.errorCode === "key_invalid"
      || response.status.errorCode === "key_permission_denied"
      || response.status.errorCode === "key_mismatch"
      || response.status.errorCode === "state_damaged"
    )
  ) {
    return {
      label: text.restStorageUnavailableTitle,
      description: text.restStorageUnavailableDescription,
      tone: "danger"
    };
  }
  const state = response?.status.state;
  if (state === "online") {
    return {
      label: text.connectionReady,
      description: text.connectionReadyDescription,
      tone: "success"
    };
  }
  if (state === "checking") {
    return {
      label: text.connectionPending,
      description: text.connectionPendingDescription,
      tone: "warning"
    };
  }
  if (state === "degraded") {
    return {
      label: text.connectionDegraded,
      description: text.connectionDegradedDescription,
      tone: "warning"
    };
  }
  if (state && state !== "not_configured") {
    return {
      label: text.connectionUnavailable,
      description: text.connectionUnavailableDescription,
      tone: "danger"
    };
  }
  return {
    label: text.connectionNotConfigured,
    description: text.connectionNotConfiguredDescription,
    tone: "info"
  };
}

function messageFor(error: unknown, locale: DashboardLocale): string {
  const text = copy[locale];
  if (!(error instanceof BotManagementApiError)) return text.unavailable;
  if (error.code === "entitlement_exceeded") return text.entitlement;
  if (error.code === "permission_required") return text.permission;
  if (error.code === "guild_already_connected") return text.alreadyConnected;
  if (
    error.code === "guild_permission_required"
    || error.code === "organization_permission_required"
    || error.code === "permission_required"
  ) return text.guildPermissionRequired;
  if (
    error.code === "setup_session_expired"
    || error.code === "setup_session_consumed"
    || error.code === "discord_session_unavailable"
  ) return text.setupExpired;
  if (error.code === "bot_installation_required") return text.installationPending;
  if (error.code === "bot_gateway_unavailable") return text.gatewayUnavailable;
  if (
    error.code === "key_missing"
    || error.code === "key_invalid"
    || error.code === "key_permission_denied"
    || error.code === "key_mismatch"
    || error.code === "state_damaged"
  ) return `${text.restStorageUnavailableTitle} ${text.restStorageUnavailableDescription}`;
  if (
    error.code === "invalid_url"
    || error.code === "origin_not_allowed"
    || error.code === "address_blocked"
  ) return text.restPolicyPrivate;
  return text.unavailable;
}

export function restResultMessage(
  status: PalworldServerStatus,
  locale: DashboardLocale,
  successMessage: string
): string {
  const text = copy[locale];
  if (status.state === "online") return successMessage;
  if (status.state === "auth_failed" || status.errorCode === "auth_failed") {
    return text.restAuthFailed;
  }
  if (
    status.state === "blocked_by_policy"
    || status.errorCode === "origin_not_allowed"
    || status.errorCode === "address_blocked"
  ) return text.restPolicyPrivate;
  if (status.state === "tls_failed" || status.errorCode === "tls_failed") {
    return text.restTlsFailed;
  }
  if (status.info && status.state === "degraded") {
    if (status.errorCode === "request_timeout") return text.restMetricsTimeout;
    if (
      status.errorCode === "invalid_content_type"
      || status.errorCode === "invalid_json"
      || status.errorCode === "invalid_schema"
    ) return text.restMetricsInvalid;
    if (
      status.errorCode === "unexpected_status"
      || status.errorCode === "redirect_blocked"
    ) return text.restMetricsStatus;
    return text.restMetricsUnavailable;
  }
  return text.restConnectionFailed;
}

export function registeredManagementServers(
  servers: readonly BotManagementGameServer[]
): readonly BotManagementGameServer[] {
  return servers.filter((server) => server.isEnabled).slice(0, 1);
}

export type BotManagementView = "overview" | "bot" | "servers";

export function botManagementViewRequiresServerData(
  view: BotManagementView
): boolean {
  return view === "servers";
}

export function botManagementViewShowsOrganizationSelector(
  view: BotManagementView
): boolean {
  return view === "overview";
}

export function organizationIdFromSearch(search: string): string {
  const value = new URLSearchParams(search).get("organization") ?? "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
    ? value
    : "";
}

export function organizationManagementHref(
  view: Exclude<BotManagementView, "overview">,
  organizationId: string
): string {
  const path = view === "bot"
    ? "/dashboard/organizations/bot"
    : "/dashboard/organizations/servers";
  return organizationId
    ? `${path}?organization=${encodeURIComponent(organizationId)}`
    : path;
}

function replaceOrganizationSearch(organizationId: string): void {
  if (typeof window === "undefined" || !organizationId) return;
  const query = `?organization=${encodeURIComponent(organizationId)}`;
  if (window.location.search === query) return;
  window.history.replaceState({}, "", `${window.location.pathname}${query}`);
}

export function BotManagementPage({
  embedded = false,
  view = "overview"
}: {
  embedded?: boolean;
  view?: BotManagementView;
}) {
  const [locale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const text = copy[locale];
  const [session, setSession] = useState<BotManagementSession>();
  const [connectSession, setConnectSession] = useState<BotManagementConnectSession>();
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [claimOrganizationId, setClaimOrganizationId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [servers, setServers] = useState<readonly BotManagementGameServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [region, setRegion] = useState<PalworldServerRegion>("asia");
  const [restServerId, setRestServerId] = useState("");
  const [restBaseUrl, setRestBaseUrl] = useState("");
  const [restPassword, setRestPassword] = useState("");
  const [restResponses, setRestResponses] = useState<
    Readonly<Record<string, PalworldServerDashboardResponse>>
  >({});
  const [restBusy, setRestBusy] = useState(false);
  const [restFeedback, setRestFeedback] = useState("");
  const [deleteServerId, setDeleteServerId] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const installRefreshInFlightRef = useRef(false);
  const Root = embedded ? "div" : "main";
  const missingBotGuildCount = connectSession?.authenticated
    ? connectSession.missingBotGuilds.length
    : 0;

  const selectedOrganization = useMemo(
    () => session?.authenticated
      ? session.organizations.find((organization) => organization.id === organizationId)
      : undefined,
    [organizationId, session]
  );

  const pageHeading = view === "bot"
    ? { title: text.botTitle, description: text.botDescription }
    : view === "servers"
      ? { title: text.serversTitle, description: text.serversDescription }
      : { title: text.overviewTitle, description: text.overviewDescription };

  async function loadServersForOrganization(
    id: string,
    signal?: AbortSignal
  ): Promise<void> {
    const nextServers = registeredManagementServers(
      await listManagementGameServers(id, signal)
    );
    setServers(nextServers);
    const firstServer = nextServers.find((server) => server.isEnabled);
    if (!firstServer) return;
    setRestServerId(firstServer.id);
    const response = await getManagementPalworldRestConnection(
      id,
      firstServer.id,
      signal
    );
    setRestResponses({ [firstServer.id]: response });
    setRestBaseUrl(response.connection.baseUrl ?? "");
  }

  async function loadSession(signal?: AbortSignal): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const next = await getManagementSession(signal);
      setSession(next);
      if (next.authenticated) {
        const requestedOrganization = organizationIdFromSearch(window.location.search);
        const nextOrganization = next.organizations.some(
          (organization) => organization.id === requestedOrganization
        )
          ? requestedOrganization
          : next.organizations[0]?.id ?? "";
        setOrganizationId(nextOrganization);
        if (nextOrganization) {
          replaceOrganizationSearch(nextOrganization);
          setConnectSession(undefined);
          if (botManagementViewRequiresServerData(view)) {
            await loadServersForOrganization(nextOrganization, signal);
          }
        } else {
          const connecting = await getManagementConnectSession(signal);
          setConnectSession(connecting);
          if (connecting.authenticated) {
            setSelectedGuildId(connecting.installedGuilds[0]?.id ?? "");
          }
        }
      } else {
        const connecting = await getManagementConnectSession(signal);
        setConnectSession(connecting);
        if (connecting.authenticated) {
          setSelectedGuildId(connecting.installedGuilds[0]?.id ?? "");
        }
      }
    } catch (loadError) {
      setError(messageFor(loadError, locale));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadSession(controller.signal);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (
      !connectSession?.authenticated
      || connectSession.installedGuilds.length > 0
      || missingBotGuildCount === 0
    ) return undefined;
    let attempt = 0;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      attempt += 1;
      void getManagementConnectSession(controller.signal)
        .then((next) => {
          setConnectSession(next);
          if (next.authenticated && next.installedGuilds.length > 0) {
            setSelectedGuildId(next.installedGuilds[0]?.id ?? "");
            window.clearInterval(timer);
          }
        })
        .catch(() => undefined);
      if (attempt >= 5) window.clearInterval(timer);
    }, 2_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [connectSession]);

  useEffect(() => {
    if (
      !connectSession?.authenticated
      || connectSession.missingBotGuilds.length === 0
    ) return undefined;

    const controller = new AbortController();
    let disposed = false;
    const refreshAfterInstall = () => {
      if (
        document.visibilityState !== "visible"
        || installRefreshInFlightRef.current
      ) return;

      installRefreshInFlightRef.current = true;
      void getManagementConnectSession(controller.signal)
        .then((next) => {
          if (disposed) return;
          setConnectSession(next);
          if (next.authenticated && next.installedGuilds.length > 0) {
            setSelectedGuildId(next.installedGuilds[0]?.id ?? "");
            setAnnouncement(text.installationConfirmed);
          }
        })
        .catch((refreshError) => {
          if (!disposed && !(refreshError instanceof DOMException && refreshError.name === "AbortError")) {
            setError(messageFor(refreshError, locale));
          }
        })
        .finally(() => {
          installRefreshInFlightRef.current = false;
        });
    };

    window.addEventListener("focus", refreshAfterInstall);
    document.addEventListener("visibilitychange", refreshAfterInstall);
    return () => {
      disposed = true;
      controller.abort();
      installRefreshInFlightRef.current = false;
      window.removeEventListener("focus", refreshAfterInstall);
      document.removeEventListener("visibilitychange", refreshAfterInstall);
    };
  }, [connectSession?.authenticated, missingBotGuildCount, locale, text.installationConfirmed]);

  async function refreshGuilds(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const next = await getManagementConnectSession();
      setConnectSession(next);
      if (next.authenticated) {
        setSelectedGuildId(next.installedGuilds[0]?.id ?? "");
      }
    } catch (refreshError) {
      setError(messageFor(refreshError, locale));
    } finally {
      setLoading(false);
    }
  }

  async function claimGuild(): Promise<void> {
    if (
      !connectSession?.authenticated
      || !selectedGuildId
      || submitting
    ) return;
    setSubmitting(true);
    setError("");
    try {
      await claimManagementGuild({
        guildId: selectedGuildId,
        ...(claimOrganizationId ? { organizationId: claimOrganizationId } : {}),
        csrfToken: connectSession.csrfToken
      });
      setAnnouncement(text.claimCompleted);
      await loadSession();
      headingRef.current?.focus();
    } catch (claimError) {
      setError(messageFor(claimError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  async function selectOrganization(id: string): Promise<void> {
    setOrganizationId(id);
    replaceOrganizationSearch(id);
    setDeleteServerId("");
    setRestServerId("");
    setRestBaseUrl("");
    setRestPassword("");
    setRestResponses({});
    setRestFeedback("");
    if (!botManagementViewRequiresServerData(view)) return;
    setLoading(true);
    setError("");
    try {
      await loadServersForOrganization(id);
    } catch (loadError) {
      setError(messageFor(loadError, locale));
    } finally {
      setLoading(false);
    }
  }

  async function createServer(): Promise<void> {
    if (!session?.authenticated || !organizationId || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const server = await createManagementGameServer({
        organizationId,
        csrfToken: session.csrfToken,
        value: { displayName, region }
      });
      setServers([server]);
      setRestServerId(server.id);
      setRestBaseUrl("");
      setRestPassword("");
      setRestFeedback("");
      setDisplayName("");
      setAnnouncement(text.createCompleted);
    } catch (createError) {
      setError(messageFor(createError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  async function openRestSettings(server: BotManagementGameServer): Promise<void> {
    if (!organizationId || restBusy) return;
    if (restServerId === server.id) {
      setRestServerId("");
      setRestBaseUrl("");
      setRestPassword("");
      setRestFeedback("");
      return;
    }
    setRestServerId(server.id);
    setRestBaseUrl("");
    setRestPassword("");
    setRestFeedback("");
    setRestBusy(true);
    setError("");
    try {
      const response = await getManagementPalworldRestConnection(
        organizationId,
        server.id
      );
      setRestResponses((current) => ({ ...current, [server.id]: response }));
      setRestBaseUrl(response.connection.baseUrl ?? "");
    } catch (restError) {
      setError(messageFor(restError, locale));
    } finally {
      setRestBusy(false);
    }
  }

  async function submitRestConnection(
    server: BotManagementGameServer,
    mode: "test" | "save"
  ): Promise<void> {
    if (!session?.authenticated || restBusy || !restBaseUrl.trim()) return;
    setRestBusy(true);
    setError("");
    setRestFeedback("");
    try {
      const value = {
        baseUrl: restBaseUrl.trim(),
        ...(restPassword ? { adminPassword: restPassword } : {})
      };
      if (mode === "test") {
        const response = await testManagementPalworldRestConnection({
          organizationId,
          gameServerId: server.id,
          csrfToken: session.csrfToken,
          value
        });
        const feedback = restResultMessage(
          response.status,
          locale,
          text.restTestPassed
        );
        setRestFeedback(feedback);
        setAnnouncement(feedback);
        return;
      }
      const response = await saveManagementPalworldRestConnection({
        organizationId,
        gameServerId: server.id,
        csrfToken: session.csrfToken,
        value
      });
      setRestResponses((current) => ({ ...current, [server.id]: response }));
      const feedback = restResultMessage(response.status, locale, text.restSaved);
      setRestFeedback(feedback);
      setAnnouncement(feedback);
    } catch (restError) {
      setError(messageFor(restError, locale));
    } finally {
      setRestPassword("");
      setRestBusy(false);
    }
  }

  async function refreshRestConnection(server: BotManagementGameServer): Promise<void> {
    if (!session?.authenticated || restBusy) return;
    setRestBusy(true);
    setError("");
    setRestFeedback("");
    try {
      const response = await refreshManagementPalworldRestConnection({
        organizationId,
        gameServerId: server.id,
        csrfToken: session.csrfToken
      });
      setRestResponses((current) => ({ ...current, [server.id]: response }));
    } catch (restError) {
      setError(messageFor(restError, locale));
    } finally {
      setRestBusy(false);
    }
  }

  async function removeRestConnection(server: BotManagementGameServer): Promise<void> {
    if (!session?.authenticated || restBusy) return;
    setRestBusy(true);
    setError("");
    try {
      const response = await removeManagementPalworldRestConnection({
        organizationId,
        gameServerId: server.id,
        csrfToken: session.csrfToken
      });
      setRestResponses((current) => ({ ...current, [server.id]: response }));
      setRestBaseUrl("");
      setRestPassword("");
      setRestFeedback(text.restRemoved);
      setAnnouncement(text.restRemoved);
    } catch (restError) {
      setError(messageFor(restError, locale));
    } finally {
      setRestBusy(false);
    }
  }

  async function deleteServer(server: BotManagementGameServer): Promise<void> {
    if (!session?.authenticated || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await deleteManagementGameServer({
        organizationId,
        gameServerId: server.id,
        csrfToken: session.csrfToken
      });
      setServers([]);
      setDeleteServerId("");
      setRestServerId("");
      setRestBaseUrl("");
      setRestPassword("");
      setRestResponses({});
      setRestFeedback("");
      setAnnouncement(text.deleteCompleted);
    } catch (deleteError) {
      setError(messageFor(deleteError, locale));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Root
      className={`bot-management-page ${embedded ? "is-embedded" : ""}`}
      aria-busy={loading}
    >
      <header className="bot-management-header">
        <span className="eyebrow">{text.eyebrow}</span>
        <h1 ref={headingRef} tabIndex={-1}>{pageHeading.title}</h1>
        <p>{pageHeading.description}</p>
      </header>
      {loading && !session ? <SkeletonCard role="status" loadingLabel={text.loading} /> : null}
      {!loading && session && !session.authenticated && !connectSession?.authenticated ? (
        <EmptyState>
          <EmptyStateTitle>{text.loginTitle}</EmptyStateTitle>
          <EmptyStateDescription>{text.loginDescription}</EmptyStateDescription>
          <div className="bot-management-actions">
            <Button type="button" onClick={() => window.location.assign(managementConnectUrl())}>
              {text.connectLogin}
            </Button>
            <Button
              aria-label={`${text.installBot} — ${text.installBotHint}`}
              as="a"
              href={botInstallUrl()}
              rel="noopener noreferrer"
              target="_blank"
              title={text.installBotHint}
              variant="secondary"
            >
              {text.installBot}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.location.assign(managementLoginUrl())}
            >
              {text.existingLogin}
            </Button>
          </div>
        </EmptyState>
      ) : null}
      {connectSession?.authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{text.connectTitle}</CardTitle>
            <CardDescription>{text.connectDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {connectSession.installedGuilds.length > 0 ? (
              <>
                <fieldset className="discord-guild-list">
                  <legend>{text.installedGuilds}</legend>
                  {connectSession.installedGuilds.map((guild) => (
                    <label className="discord-guild-option" key={guild.id} title={guild.name}>
                      <input
                        checked={selectedGuildId === guild.id}
                        name="management-discord-guild"
                        onChange={() => setSelectedGuildId(guild.id)}
                        type="radio"
                        value={guild.id}
                      />
                      {guild.iconUrl
                        ? <img alt="" height="40" src={guild.iconUrl} width="40" />
                        : (
                            <span aria-hidden="true" className="discord-guild-fallback">
                              <DiscordSymbolIcon />
                            </span>
                          )}
                      <span className="bot-management-guild-summary">
                        <span className="discord-guild-name">{guild.name}</span>
                        <strong>{text.installationConfirmed}</strong>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="bot-management-field">
                  <span>{text.organization}</span>
                  <select
                    value={claimOrganizationId}
                    onChange={(event) => setClaimOrganizationId(event.target.value)}
                  >
                    <option value="">{text.createNewOrganization}</option>
                    {connectSession.organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  disabled={!selectedGuildId}
                  loading={submitting}
                  loadingLabel={text.claiming}
                  onClick={() => void claimGuild()}
                  type="button"
                >
                  {text.claim}
                </Button>
              </>
            ) : null}
            {connectSession.missingBotGuilds.length > 0 ? (
              <section aria-busy={loading}>
                <h3>{text.missingGuilds}</h3>
                <ul>
                  {connectSession.missingBotGuilds.map((guild) => (
                    <li key={guild.id} title={guild.name}>{guild.name}</li>
                  ))}
                </ul>
                <p role="status">{text.installationPending}</p>
                <p>{text.installBotHint}</p>
                <div className="bot-management-actions">
                  <Button
                    aria-label={`${text.installBot} — ${text.installBotHint}`}
                    as="a"
                    href={botInstallUrl()}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={text.installBotHint}
                    variant="secondary"
                  >
                    {text.installBot}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void refreshGuilds()}>
                    {text.refreshInstallation}
                  </Button>
                </div>
              </section>
            ) : null}
            {connectSession.installedGuilds.length === 0
              && connectSession.missingBotGuilds.length === 0 ? (
                <EmptyState>
                  <EmptyStateTitle>{text.noManageableGuilds}</EmptyStateTitle>
                </EmptyState>
              ) : null}
          </CardContent>
        </Card>
      ) : null}
      {session
        && managementSessionNeedsGuildConnection(session)
        && !connectSession?.authenticated ? (
        <EmptyState>
          <EmptyStateTitle>{text.noOrganization}</EmptyStateTitle>
          <EmptyStateDescription>{text.noOrganizationDescription}</EmptyStateDescription>
          <div className="bot-management-actions">
            <Button type="button" onClick={() => window.location.assign(managementConnectUrl())}>
              {text.connectLogin}
            </Button>
            <Button
              aria-label={`${text.installBot} — ${text.installBotHint}`}
              as="a"
              href={botInstallUrl()}
              rel="noopener noreferrer"
              target="_blank"
              title={text.installBotHint}
              variant="secondary"
            >
              {text.installBot}
            </Button>
          </div>
        </EmptyState>
      ) : null}
      {session?.authenticated && session.organizations.length > 0 ? (
        <>
          {botManagementViewShowsOrganizationSelector(view) ? (
            <Card className="bot-management-organization-card">
              <CardHeader>
                <div>
                  <CardTitle as="h2">{text.organization}</CardTitle>
                  {selectedOrganization ? (
                    <CardDescription>{selectedOrganization.displayName}</CardDescription>
                  ) : null}
                </div>
                {selectedOrganization ? (
                  <Badge>{text[selectedOrganization.role]}</Badge>
                ) : null}
              </CardHeader>
              <CardContent className="bot-management-organization-content">
                <label className="bot-management-field">
                  <span>{text.organizationField}</span>
                  <select
                    value={organizationId}
                    onChange={(event) => void selectOrganization(event.target.value)}
                  >
                    {session.organizations.map((organization: BotManagementOrganization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              </CardContent>
            </Card>
          ) : null}

          {view === "overview" && selectedOrganization ? (
            <section
              aria-label={text.overviewTitle}
              className="bot-management-destinations"
            >
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{text.botDestination}</CardTitle>
                  <CardDescription>{text.botDestinationDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    as="a"
                    href={organizationManagementHref("bot", selectedOrganization.id)}
                  >
                    {text.botDestinationAction}
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle as="h2">{text.serverDestination}</CardTitle>
                  <CardDescription>{text.serverDestinationDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    as="a"
                    href={organizationManagementHref("servers", selectedOrganization.id)}
                  >
                    {text.serverDestinationAction}
                  </Button>
                </CardContent>
              </Card>
            </section>
          ) : null}

          {view === "bot" && selectedOrganization ? (
            <BotControlCard
              csrfToken={session.csrfToken}
              organizationId={selectedOrganization.id}
              role={selectedOrganization.role}
            />
          ) : null}

          {view === "servers" ? (
            <>
              {!loading
                && selectedOrganization?.role !== "viewer"
                && servers.length === 0 ? (
                <Card className="bot-management-create-card">
              <CardHeader>
                <CardTitle as="h2">{text.createTitle}</CardTitle>
                <CardDescription>{text.createDescription} {text.entitlement}</CardDescription>
              </CardHeader>
              <CardContent className="bot-management-create">
                <label className="bot-management-field">
                  <span>{text.serverName}</span>
                  <input
                    aria-describedby="bot-management-server-name-hint"
                    maxLength={120}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                  />
                  <small id="bot-management-server-name-hint">{text.serverNameHint}</small>
                </label>
                <label className="bot-management-field">
                  <span>{text.region}</span>
                  <select
                    value={region}
                    onChange={(event) => setRegion(event.target.value as PalworldServerRegion)}
                  >
                    {regions.map((value) => (
                      <option key={value} value={value}>
                        {text[`region${value.split("_").map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join("")}` as keyof typeof text]}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  disabled={!displayName.trim()}
                  loading={submitting}
                  loadingLabel={text.creating}
                  onClick={() => void createServer()}
                >
                  {text.create}
                </Button>
                <aside className="bot-management-credential-notice">
                  <strong>{text.credentialTitle}</strong>
                  <p>{text.credentialDescription}</p>
                </aside>
              </CardContent>
                </Card>
              ) : null}

              <section className="bot-management-servers" aria-labelledby="bot-management-servers-title">
            <div className="bot-management-section-heading">
              <h2 id="bot-management-servers-title">{text.servers}</h2>
              {servers[0] && selectedOrganization?.role !== "viewer" ? (
                <Button
                  disabled={restBusy}
                  loading={restBusy}
                  loadingLabel={text.connectionRefreshing}
                  onClick={() => void refreshRestConnection(servers[0]!)}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {text.restRefresh}
                </Button>
              ) : null}
            </div>
            {!loading
              && servers.length === 0
              && selectedOrganization?.role === "viewer" ? (
              <EmptyState>
                <EmptyStateTitle>{text.noServers}</EmptyStateTitle>
              </EmptyState>
            ) : null}
            {servers.map((server) => {
              const restResponse = restResponses[server.id];
              const connection = restConnectionStatusPresentation(restResponse, locale);
              const restOpen = restServerId === server.id;
              return (
                <Card className="bot-management-server-card" key={server.id}>
                  <CardHeader>
                    <div className="bot-management-server-heading">
                      <CardTitle>{server.displayName}</CardTitle>
                      <CardDescription>{text[`region${server.region.split("_").map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join("")}` as keyof typeof text]}</CardDescription>
                    </div>
                    <StatusPill
                      aria-label={`${text.connectionStatus}: ${connection.label}`}
                      tone={connection.tone}
                    >
                      {connection.label}
                    </StatusPill>
                  </CardHeader>
                  <CardContent>
                    <p className="bot-management-connection-description">
                      {connection.description}
                    </p>
                    {restResponse?.status.checkedAt ? (
                      <p className="bot-management-last-seen">
                        {text.lastStatusReceived}:{" "}
                        <time dateTime={restResponse.status.checkedAt}>
                          {new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
                            dateStyle: "medium",
                            timeStyle: "short"
                          }).format(new Date(restResponse.status.checkedAt))}
                        </time>
                      </p>
                    ) : null}
                    <div className="bot-management-actions">
                    {selectedOrganization?.role !== "viewer" && !deleteServerId ? (
                      <Button
                        aria-expanded={restOpen}
                        type="button"
                        variant="secondary"
                        onClick={() => void openRestSettings(server)}
                      >
                        {restOpen ? text.restClose : text.restOpen}
                      </Button>
                    ) : null}
                    {selectedOrganization?.role === "owner" && !deleteServerId ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => {
                          setDeleteServerId(server.id);
                          setRestServerId("");
                          setRestPassword("");
                          setRestFeedback("");
                        }}
                      >
                        {text.deleteServer}
                      </Button>
                    ) : null}
                  </div>
                  {deleteServerId === server.id ? (
                    <div className="bot-management-delete-confirmation" role="alert">
                      <p>{text.deleteConfirm}</p>
                      <div className="bot-management-actions">
                        <Button
                          disabled={submitting}
                          type="button"
                          variant="secondary"
                          onClick={() => setDeleteServerId("")}
                        >
                          {text.deleteCancel}
                        </Button>
                        <Button
                          loading={submitting}
                          loadingLabel={text.deleting}
                          type="button"
                          variant="danger"
                          onClick={() => void deleteServer(server)}
                        >
                          {text.deleteAction}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {restOpen
                    && deleteServerId !== server.id
                    && selectedOrganization?.role !== "viewer" ? (
                    <section
                      aria-busy={restBusy}
                      aria-labelledby={`rest-${server.id}`}
                      className="bot-management-rest"
                    >
                      <h3 id={`rest-${server.id}`}>{text.restSettings}</h3>
                      <p>{text.credentialDescription}</p>
                      <ul className="bot-management-rest-policy">
                        <li>{text.restPolicyPublic}</li>
                        <li>{text.restPolicyPrivate}</li>
                      </ul>
                      <div className="bot-management-rest-fields">
                        <label className="bot-management-field">
                          <span>{text.restBaseUrl}</span>
                          <input
                            aria-describedby={`rest-url-hint-${server.id}`}
                            autoCapitalize="none"
                            autoComplete="url"
                            inputMode="url"
                            maxLength={2048}
                            placeholder="https://pal.example.com"
                            spellCheck={false}
                            type="url"
                            value={restBaseUrl}
                            onChange={(event) => setRestBaseUrl(event.target.value)}
                          />
                          <small id={`rest-url-hint-${server.id}`}>
                            {text.restBaseUrlHint}
                          </small>
                        </label>
                        <label className="bot-management-field">
                          <span>{text.restPassword}</span>
                          <input
                            aria-describedby={`rest-password-hint-${server.id}`}
                            autoComplete="new-password"
                            maxLength={256}
                            type="password"
                            value={restPassword}
                            onChange={(event) => setRestPassword(event.target.value)}
                          />
                          <small id={`rest-password-hint-${server.id}`}>
                            {text.restPasswordHint}
                          </small>
                        </label>
                      </div>
                      {restResponse?.status.info ? (
                        <dl className="bot-management-rest-summary">
                          <div>
                            <dt>{text.restServerInfo}</dt>
                            <dd>
                              {restResponse.status.info.serverName} ·{" "}
                              {restResponse.status.info.version}
                            </dd>
                          </div>
                          {restResponse.status.metrics ? (
                            <div>
                              <dt>{text.restPlayers}</dt>
                              <dd>
                                {restResponse.status.metrics.currentPlayers}
                                /{restResponse.status.metrics.maxPlayers}
                              </dd>
                            </div>
                          ) : null}
                          {restResponse.status.latencyMs !== undefined ? (
                            <div>
                              <dt>{text.restLatency}</dt>
                              <dd>{restResponse.status.latencyMs}ms</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                      {restFeedback ? (
                        <p className="bot-management-rest-feedback" role="status">
                          {restFeedback}
                        </p>
                      ) : null}
                      <div className="bot-management-actions">
                        <Button
                          disabled={!restBaseUrl.trim()}
                          loading={restBusy}
                          loadingLabel={text.restTesting}
                          type="button"
                          variant="secondary"
                          onClick={() => void submitRestConnection(server, "test")}
                        >
                          {text.restTest}
                        </Button>
                        <Button
                          disabled={!restBaseUrl.trim()}
                          loading={restBusy}
                          loadingLabel={text.restTesting}
                          type="button"
                          onClick={() => void submitRestConnection(server, "save")}
                        >
                          {text.restSave}
                        </Button>
                        {restResponse?.connection.configured ? (
                          <>
                            <Button
                              disabled={restBusy}
                              type="button"
                              variant="danger"
                              onClick={() => void removeRestConnection(server)}
                            >
                              {text.restRemove}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                  </CardContent>
                </Card>
              );
            })}
              </section>
            </>
          ) : null}
        </>
      ) : null}
      {error ? <p className="bot-management-error" role="alert">{error}</p> : null}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </Root>
  );
}

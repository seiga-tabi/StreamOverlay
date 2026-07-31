import type {
  DiscordBotCommandCapabilities,
  DiscordBotControlCommand
} from "./discord-bot-control.js";

export type DiscordBotMessageLocale = "ko" | "ja";

export const DISCORD_BOT_MESSAGES = {
  ko: {
    slash: {
      dmDenied: "이 명령은 Discord 서버 안에서만 사용할 수 있습니다.",
      permissionDenied: "서버 소유자 또는 서버 관리 권한이 있는 사용자만 실행할 수 있습니다.",
      setupTitle: "YORO Bot 설정은 웹 Dashboard에서 진행할 수 있습니다.",
      setupBody: "아래 링크에서 Discord 서버 연결을 완료해 주세요. 링크는 10분 후 만료되며 한 번만 사용할 수 있습니다.",
      setupButton: "웹에서 서버 연결하기",
      dashboardTitle: "YORO Bot 관리 화면",
      dashboardButton: "Dashboard 열기",
      setupUnavailable: "설정 링크를 발급할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      setupActive: "이미 진행 중인 설정 링크가 있습니다. 기존 링크가 만료된 뒤 다시 시도해 주세요.",
      help: [
        "**/yoro setup**",
        "웹 Dashboard에서 Discord 서버와 YORO.gg 연결을 시작하거나 복구합니다.",
        "",
        "**/yoro help**",
        "현재 사용할 수 있는 명령을 확인합니다.",
        "",
        "**/yoro dashboard**",
        "YORO Bot 관리 화면을 엽니다."
      ].join("\n"),
      privateHelpTitle: "**작성자에게만 보이는 명령**",
      privateCommands: {
        status: "`/yoro status` Palworld 서버 상태 확인",
        player: "`/yoro player` 접속 닉네임 목록 · `nickname` 입력 시 게임 내 프로필 검색",
        guide: "`/yoro guide` Palworld 전용 서버 설정 안내"
      },
      playerSearchHint: "`/yoro player`에서 `nickname`을 입력해 검색할 수 있습니다.",
      prefixHelpTitle: "**일반 사용자 명령**",
      unknown: "지원하지 않는 YORO Bot 명령입니다."
    },
    prefix: {
      helpTitle: "YORO Bot 일반 사용자 명령",
      commands: {
        help: "`!yoro 도움말` 현재 사용할 수 있는 명령 확인",
        status: "`!yoro 상태` Palworld 서버 상태 확인",
        player: "`!yoro 플레이어` 접속 중인 닉네임 목록 · `!yoro 플레이어 {닉네임}` 게임 내 프로필 검색",
        guide: "`!yoro 가이드` Palworld 전용 서버 설정 안내"
      },
      guideTitle: "Palworld 전용 서버 설정",
      guideBody: "YORO와 연결할 Palworld 전용 서버 설정 방법을 확인할 수 있습니다.",
      guideButton: "설정 가이드 열기",
      dashboardButton: "Dashboard 열기",
      statusTitle: "YORO Palworld 서버",
      playerListTitle: "현재 접속 중인 Palworld 플레이어",
      playerProfileTitle: "Palworld 게임 내 프로필",
      playerEmpty: "현재 접속 중인 플레이어가 없습니다.",
      playerListTruncated: "전체 {total}명 중 {shown}명만 표시합니다.",
      playerNotFound: "일치하는 닉네임을 찾지 못했습니다.",
      playerSuggestions: "비슷한 닉네임",
      playerSearchHint: "`!yoro 플레이어 {닉네임}` 형식으로 검색해 주세요.",
      playerFields: {
        nickname: "닉네임",
        level: "레벨",
        buildingCount: "건축물 수"
      },
      playerUnavailable: {
        server_not_configured: "아직 Palworld 게임 서버가 등록되지 않았습니다.",
        rest_not_configured: "Palworld REST 연결 설정이 완료되지 않았습니다.",
        rest_auth_failed: "Palworld REST 인증에 실패했습니다. Dashboard에서 AdminPassword를 다시 확인해 주세요.",
        rest_timeout: "Palworld 플레이어 조회 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
        rest_invalid_response: "Palworld 서버의 플레이어 응답 형식을 확인할 수 없습니다. 서비스 운영자에게 문의해 주세요.",
        rest_unreachable: "Palworld REST 플레이어 endpoint에 연결할 수 없습니다. 서버와 중계 설정을 확인해 주세요.",
        upstream_unavailable: "현재 Palworld 플레이어 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      },
      guildNotConnected: "이 Discord 서버가 YORO Organization과 연결되지 않았습니다.",
      serverNotConfigured: "아직 Palworld 게임 서버가 등록되지 않았습니다.",
      unavailable: "현재 서버 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.",
      internalFailure: {
        authentication_failed: "YORO Bot과 서버의 내부 연결 인증을 확인해야 합니다. 서비스 운영자에게 문의해 주세요.",
        unavailable: "현재 YORO 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        rejected: "현재 서버 상태 요청을 처리할 수 없습니다. 서비스 운영자에게 문의해 주세요.",
        invalid_response: "서버 상태 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.",
        unexpected: "현재 서버 상태를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요."
      },
      policyDenied: {
        installation_inactive: "이 Discord 서버는 YORO Organization과 연결되어 있지 않습니다.",
        module_disabled: "이 서버에서는 Palworld 상태 기능을 사용하지 않도록 설정했습니다.",
        command_disabled: "이 명령은 서버 관리자가 비활성화했습니다."
      },
      fields: {
        status: "상태",
        notice: "안내",
        players: "접속 인원",
        version: "게임 버전",
        latency: "응답 시간",
        observedAt: "마지막 확인"
      },
      charts: {
        occupancy: "서버 정원 사용률",
        responseQuality: "연결 응답 품질",
        excellent: "매우 빠름",
        good: "양호",
        delayed: "지연됨",
        slow: "느림",
        footer: "YORO · Palworld 안전한 읽기 전용 상태",
        playerFooter: "YORO · Palworld 접속 플레이어 조회"
      },
      states: {
        not_configured: "상태 연결 필요",
        checking: "첫 상태 확인 중",
        online: "온라인",
        degraded: "일부 상태만 확인됨",
        offline: "오프라인",
        stale: "마지막 상태가 오래됨",
        auth_failed: "서버 인증 설정 확인 필요",
        blocked_by_policy: "연결 정책 확인 필요",
        unavailable: "현재 상태 확인 불가"
      },
      reasons: {
        status_not_configured: "서버는 등록되어 있지만 REST 상태 연결이 완료되지 않았습니다.",
        status_feature_disabled: "Palworld 상태 조회가 현재 운영 설정에서 비활성화되어 있습니다.",
        credentials_unavailable: "서비스 운영자가 상태 연결용 자격 증명 저장소를 확인해야 합니다.",
        auth_failed: "Palworld 서버 인증 설정을 확인해야 합니다.",
        network_policy_blocked: "등록된 REST 주소를 현재 연결 정책에서 사용할 수 없습니다.",
        upstream_unavailable: "현재 Palworld 서버 상태를 확인할 수 없습니다.",
        stale_data: "표시된 상태가 최신 정보가 아닐 수 있습니다.",
        partial_data: "서버 기본 정보는 확인했지만 일부 상태를 가져오지 못했습니다."
      }
    }
  },
  ja: {
    slash: {
      dmDenied: "このコマンドはDiscordサーバー内でのみ使用できます。",
      permissionDenied: "サーバー所有者またはサーバー管理権限を持つユーザーのみ実行できます。",
      setupTitle: "YORO Botの設定はWeb Dashboardから行えます。",
      setupBody: "以下のリンクからDiscordサーバー連携を完了してください。リンクは10分後に期限切れとなり、一度だけ使用できます。",
      setupButton: "Webでサーバーを連携",
      dashboardTitle: "YORO Bot管理画面",
      dashboardButton: "Dashboardを開く",
      setupUnavailable: "設定リンクを発行できません。しばらくしてからもう一度お試しください。",
      setupActive: "進行中の設定リンクがあります。既存リンクの期限切れ後にもう一度お試しください。",
      help: [
        "**/yoro setup**",
        "Web DashboardでDiscordサーバーとYORO.ggの連携を開始または復旧します。",
        "",
        "**/yoro help**",
        "現在利用できるコマンドを確認します。",
        "",
        "**/yoro dashboard**",
        "YORO Bot管理画面を開きます。"
      ].join("\n"),
      privateHelpTitle: "**実行者だけに表示されるコマンド**",
      privateCommands: {
        status: "`/yoro status` Palworldサーバー状態を確認",
        player: "`/yoro player` 接続中のニックネーム一覧 · `nickname`入力時はゲーム内プロフィールを検索",
        guide: "`/yoro guide` Palworld専用サーバー設定ガイド"
      },
      playerSearchHint: "`/yoro player`で`nickname`を入力して検索できます。",
      prefixHelpTitle: "**一般ユーザーコマンド**",
      unknown: "未対応のYORO Botコマンドです。"
    },
    prefix: {
      helpTitle: "YORO Bot一般ユーザーコマンド",
      commands: {
        help: "`!yoro ヘルプ` 利用可能なコマンドを確認",
        status: "`!yoro ステータス` Palworldサーバー状態を確認",
        player: "`!yoro プレイヤー` 接続中のニックネーム一覧 · `!yoro プレイヤー {ニックネーム}` ゲーム内プロフィール検索",
        guide: "`!yoro ガイド` Palworld専用サーバー設定ガイド"
      },
      guideTitle: "Palworld専用サーバー設定",
      guideBody: "YOROと連携するPalworld専用サーバーの設定方法を確認できます。",
      guideButton: "設定ガイドを開く",
      dashboardButton: "Dashboardを開く",
      statusTitle: "YORO Palworldサーバー",
      playerListTitle: "現在接続中のPalworldプレイヤー",
      playerProfileTitle: "Palworldゲーム内プロフィール",
      playerEmpty: "現在接続中のプレイヤーはいません。",
      playerListTruncated: "全{total}名のうち{shown}名のみ表示しています。",
      playerNotFound: "一致するニックネームが見つかりませんでした。",
      playerSuggestions: "類似するニックネーム",
      playerSearchHint: "`!yoro プレイヤー {ニックネーム}`の形式で検索してください。",
      playerFields: {
        nickname: "ニックネーム",
        level: "レベル",
        buildingCount: "建築物数"
      },
      playerUnavailable: {
        server_not_configured: "Palworldゲームサーバーはまだ登録されていません。",
        rest_not_configured: "Palworld REST連携設定が完了していません。",
        rest_auth_failed: "Palworld REST認証に失敗しました。DashboardでAdminPasswordをもう一度確認してください。",
        rest_timeout: "Palworldプレイヤー取得がタイムアウトしました。しばらくしてからもう一度お試しください。",
        rest_invalid_response: "Palworldサーバーのプレイヤー応答形式を確認できません。サービス運営者へお問い合わせください。",
        rest_unreachable: "Palworld RESTのプレイヤーendpointへ接続できません。サーバーと中継設定を確認してください。",
        upstream_unavailable: "現在Palworldプレイヤー一覧を取得できません。しばらくしてからお試しください。"
      },
      guildNotConnected: "このDiscordサーバーはYORO Organizationと連携されていません。",
      serverNotConfigured: "Palworldゲームサーバーはまだ登録されていません。",
      unavailable: "現在サーバー状態を取得できません。しばらくしてからお試しください。",
      internalFailure: {
        authentication_failed: "YORO Botとサーバー間の内部接続認証を確認する必要があります。サービス運営者へお問い合わせください。",
        unavailable: "現在YOROサーバーへ接続できません。しばらくしてからもう一度お試しください。",
        rejected: "現在サーバー状態リクエストを処理できません。サービス運営者へお問い合わせください。",
        invalid_response: "サーバー状態の応答を確認できません。しばらくしてからもう一度お試しください。",
        unexpected: "現在サーバー状態を取得できません。しばらくしてからお試しください。"
      },
      policyDenied: {
        installation_inactive: "このDiscordサーバーはYORO Organizationと連携されていません。",
        module_disabled: "このサーバーではPalworld状態機能が無効に設定されています。",
        command_disabled: "このコマンドはサーバー管理者によって無効化されています。"
      },
      fields: {
        status: "状態",
        notice: "案内",
        players: "接続人数",
        version: "ゲームバージョン",
        latency: "応答時間",
        observedAt: "最終確認"
      },
      charts: {
        occupancy: "サーバー定員使用率",
        responseQuality: "接続応答品質",
        excellent: "非常に高速",
        good: "良好",
        delayed: "遅延あり",
        slow: "低速",
        footer: "YORO · Palworld安全な読み取り専用状態",
        playerFooter: "YORO · Palworld接続プレイヤー取得"
      },
      states: {
        not_configured: "状態連携が必要",
        checking: "初回状態を確認中",
        online: "オンライン",
        degraded: "一部の状態のみ確認済み",
        offline: "オフライン",
        stale: "最終状態が古くなっています",
        auth_failed: "サーバー認証設定の確認が必要",
        blocked_by_policy: "接続ポリシーの確認が必要",
        unavailable: "現在状態を確認できません"
      },
      reasons: {
        status_not_configured: "サーバーは登録されていますが、REST状態連携が完了していません。",
        status_feature_disabled: "Palworld状態取得は現在の運用設定で無効化されています。",
        credentials_unavailable: "サービス運営者が状態連携用の認証情報ストレージを確認する必要があります。",
        auth_failed: "Palworldサーバーの認証設定を確認してください。",
        network_policy_blocked: "登録されたRESTアドレスは現在の接続ポリシーでは使用できません。",
        upstream_unavailable: "現在Palworldサーバー状態を確認できません。",
        stale_data: "表示中の状態は最新情報ではない可能性があります。",
        partial_data: "サーバー基本情報は確認できましたが、一部の状態を取得できませんでした。"
      }
    }
  }
} as const;

export function discordBotMessageLocale(
  value: string | undefined
): DiscordBotMessageLocale {
  return value?.toLowerCase().startsWith("ja") ? "ja" : "ko";
}

export function discordBotHelpBody(
  locale: DiscordBotMessageLocale,
  commands: DiscordBotCommandCapabilities
): string {
  const copy = DISCORD_BOT_MESSAGES[locale].prefix.commands;
  return (["status", "player", "guide", "help"] as const satisfies readonly DiscordBotControlCommand[])
    .filter((command) => commands[command])
    .map((command) => copy[command])
    .join("\n");
}

export function discordBotPrivateHelpBody(
  locale: DiscordBotMessageLocale,
  commands: DiscordBotCommandCapabilities
): string {
  const copy = DISCORD_BOT_MESSAGES[locale].slash.privateCommands;
  return (["status", "player", "guide"] as const)
    .filter((command) => commands[command])
    .map((command) => copy[command])
    .join("\n");
}

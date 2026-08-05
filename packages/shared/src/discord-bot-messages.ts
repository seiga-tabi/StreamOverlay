import type {
  DiscordBotCommandCapabilities,
  DiscordBotControlCommand
} from "./discord-bot-control.js";

export type DiscordBotMessageLocale = "ko" | "ja" | "en";

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
      participationTitle: "YORO 시청자 참여",
      participationBody: "현재 모집 중인 방송과 내 참여 상태는 YORO.gg에서 안전하게 확인할 수 있습니다.",
      participationButton: "참여 방송 확인하기",
      setupUnavailable: "설정 링크를 발급할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      setupActive: "이미 진행 중인 설정 링크가 있습니다. 기존 링크가 만료된 뒤 다시 시도해 주세요.",
      languageUpdated: "YORO Bot 메시지 언어를 한국어로 변경했습니다.",
      languageAutoUpdated: "YORO Bot 메시지 언어를 Discord 서버 언어 자동 감지로 변경했습니다.",
      languageUnavailable: "메시지 언어를 변경할 수 없습니다. YORO 계정과 Organization 관리 권한을 확인해 주세요.",
      help: [
        "**/yoro setup**",
        "웹 Dashboard에서 Discord 서버와 YORO.gg 연결을 시작하거나 복구합니다.",
        "",
        "**/yoro help**",
        "현재 사용할 수 있는 명령을 확인합니다.",
        "",
        "**/yoro dashboard**",
        "YORO Bot 관리 화면을 엽니다.",
        "",
        "**/yoro participation**",
        "현재 모집 중인 시청자 참여 방송을 확인합니다.",
        "",
        "**/yoro language**",
        "서버 관리자가 YORO Bot 메시지 언어를 변경합니다."
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
        help: "`!yoro help` 현재 사용할 수 있는 명령 확인",
        status: "`!yoro status` Palworld 서버 상태 확인",
        player: "`!yoro player` 접속 중인 닉네임 목록 · `!yoro player {nickname}` 게임 내 프로필 검색",
        guide: "`!yoro guide` Palworld 전용 서버 설정 안내"
      },
      guideTitle: "Palworld 전용 서버 설정",
      guideBody: "YORO와 연결할 Palworld 전용 서버 설정 방법을 확인할 수 있습니다.",
      guideButton: "설정 가이드 열기",
      palworldHomeButton: "Palworld 홈 열기",
      statusTitle: "YORO Palworld 서버",
      playerListTitle: "현재 접속 중인 Palworld 플레이어",
      playerProfileTitle: "Palworld 게임 내 프로필",
      playerCardTitle: "YORO 플레이어 카드",
      playerCardSubtitle: "현재 접속 중인 Palworld 플레이어",
      playerEmpty: "현재 접속 중인 플레이어가 없습니다.",
      playerListTruncated: "전체 {total}명 중 {shown}명만 표시합니다.",
      playerNotFound: "일치하는 닉네임을 찾지 못했습니다.",
      playerSuggestions: "연관 검색어",
      playerSearchHint: "`!yoro player {nickname}` 형식으로 검색해 주세요.",
      playerFields: {
        nickname: "닉네임",
        level: "레벨",
        buildingCount: "건축물 수",
        server: "게임 서버",
        status: "접속 상태"
      },
      playerOnline: "온라인",
      playerShareButton: "X에 공유",
      playerPalworldButton: "YORO.GG Palworld",
      playerShareText: "{nickname} · Palworld Lv.{level} 플레이어 카드를 확인해 보세요.",
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
      participationTitle: "YORO 視聴者参加",
      participationBody: "現在募集中の配信と自分の参加状況はYORO.ggで安全に確認できます。",
      participationButton: "参加配信を確認する",
      setupUnavailable: "設定リンクを発行できません。しばらくしてからもう一度お試しください。",
      setupActive: "進行中の設定リンクがあります。既存リンクの期限切れ後にもう一度お試しください。",
      languageUpdated: "YORO Botのメッセージ言語を日本語に変更しました。",
      languageAutoUpdated: "YORO Botのメッセージ言語をDiscordサーバー言語の自動検出に変更しました。",
      languageUnavailable: "メッセージ言語を変更できません。YOROアカウントとOrganization管理権限を確認してください。",
      help: [
        "**/yoro setup**",
        "Web DashboardでDiscordサーバーとYORO.ggの連携を開始または復旧します。",
        "",
        "**/yoro help**",
        "現在利用できるコマンドを確認します。",
        "",
        "**/yoro dashboard**",
        "YORO Bot管理画面を開きます。",
        "",
        "**/yoro participation**",
        "現在募集中の視聴者参加配信を確認します。",
        "",
        "**/yoro language**",
        "サーバー管理者がYORO Botのメッセージ言語を変更します。"
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
        help: "`!yoro help` 利用可能なコマンドを確認",
        status: "`!yoro status` Palworldサーバー状態を確認",
        player: "`!yoro player` 接続中のニックネーム一覧 · `!yoro player {nickname}` ゲーム内プロフィール検索",
        guide: "`!yoro guide` Palworld専用サーバー設定ガイド"
      },
      guideTitle: "Palworld専用サーバー設定",
      guideBody: "YOROと連携するPalworld専用サーバーの設定方法を確認できます。",
      guideButton: "設定ガイドを開く",
      palworldHomeButton: "Palworldホームを開く",
      statusTitle: "YORO Palworldサーバー",
      playerListTitle: "現在接続中のPalworldプレイヤー",
      playerProfileTitle: "Palworldゲーム内プロフィール",
      playerCardTitle: "YOROプレイヤーカード",
      playerCardSubtitle: "現在接続中のPalworldプレイヤー",
      playerEmpty: "現在接続中のプレイヤーはいません。",
      playerListTruncated: "全{total}名のうち{shown}名のみ表示しています。",
      playerNotFound: "一致するニックネームが見つかりませんでした。",
      playerSuggestions: "関連する検索候補",
      playerSearchHint: "`!yoro player {nickname}`の形式で検索してください。",
      playerFields: {
        nickname: "ニックネーム",
        level: "レベル",
        buildingCount: "建築物数",
        server: "ゲームサーバー",
        status: "接続状態"
      },
      playerOnline: "オンライン",
      playerShareButton: "Xで共有",
      playerPalworldButton: "YORO.GG Palworld",
      playerShareText: "{nickname} · Palworld Lv.{level}のプレイヤーカードをチェックしてください。",
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
  },
  en: {
    slash: {
      dmDenied: "This command can only be used in a Discord server.",
      permissionDenied: "Only the server owner or a member with server management permission can run this command.",
      setupTitle: "You can configure YORO Bot in the web Dashboard.",
      setupBody: "Use the link below to connect this Discord server. The link expires in 10 minutes and can only be used once.",
      setupButton: "Connect server on the web",
      dashboardTitle: "YORO Bot management",
      dashboardButton: "Open Dashboard",
      participationTitle: "YORO viewer participation",
      participationBody: "Open YORO.gg to safely check current recruitment and your participation status.",
      participationButton: "View participation",
      setupUnavailable: "A setup link could not be created. Please try again later.",
      setupActive: "A setup link is already active. Try again after the existing link expires.",
      languageUpdated: "YORO Bot message language has been changed to English.",
      languageAutoUpdated: "YORO Bot message language now follows the Discord server locale automatically.",
      languageUnavailable: "The message language could not be changed. Check your YORO account and Organization management permission.",
      help: [
        "**/yoro setup**",
        "Start or recover the connection between this Discord server and YORO.gg in the web Dashboard.",
        "",
        "**/yoro help**",
        "Show the commands that are currently available.",
        "",
        "**/yoro dashboard**",
        "Open YORO Bot management.",
        "",
        "**/yoro participation**",
        "View streams currently recruiting participants.",
        "",
        "**/yoro language**",
        "Let a server manager change the language used in YORO Bot messages."
      ].join("\n"),
      privateHelpTitle: "**Commands visible only to you**",
      privateCommands: {
        status: "`/yoro status` Check the Palworld server status",
        player: "`/yoro player` List connected nicknames · enter `nickname` to search an in-game profile",
        guide: "`/yoro guide` Open the Palworld dedicated server guide"
      },
      playerSearchHint: "Enter `nickname` in `/yoro player` to search.",
      prefixHelpTitle: "**Public user commands**",
      unknown: "This YORO Bot command is not supported."
    },
    prefix: {
      helpTitle: "YORO Bot public commands",
      commands: {
        help: "`!yoro help` Show available commands",
        status: "`!yoro status` Check the Palworld server status",
        player: "`!yoro player` List connected nicknames · `!yoro player {nickname}` search an in-game profile",
        guide: "`!yoro guide` Open the Palworld dedicated server guide"
      },
      guideTitle: "Palworld dedicated server setup",
      guideBody: "Learn how to configure a Palworld dedicated server for YORO.",
      guideButton: "Open setup guide",
      palworldHomeButton: "Open Palworld home",
      statusTitle: "YORO Palworld Server",
      playerListTitle: "Players currently connected to Palworld",
      playerProfileTitle: "Palworld in-game profile",
      playerCardTitle: "YORO Player Card",
      playerCardSubtitle: "Currently connected Palworld player",
      playerEmpty: "No players are currently connected.",
      playerListTruncated: "Showing {shown} of {total} players.",
      playerNotFound: "No exact nickname match was found.",
      playerSuggestions: "Related searches",
      playerSearchHint: "Search with `!yoro player {nickname}`.",
      playerFields: {
        nickname: "Nickname",
        level: "Level",
        buildingCount: "Buildings",
        server: "Game server",
        status: "Connection status"
      },
      playerOnline: "Online",
      playerShareButton: "Share on X",
      playerPalworldButton: "YORO.GG Palworld",
      playerShareText: "Check out {nickname}'s Palworld Lv.{level} player card.",
      playerUnavailable: {
        server_not_configured: "A Palworld game server has not been registered yet.",
        rest_not_configured: "The Palworld REST connection is not configured.",
        rest_auth_failed: "Palworld REST authentication failed. Check the AdminPassword in the Dashboard.",
        rest_timeout: "The Palworld player request timed out. Please try again later.",
        rest_invalid_response: "The Palworld player response format could not be verified. Contact the service operator.",
        rest_unreachable: "The Palworld REST player endpoint could not be reached. Check the server and proxy configuration.",
        upstream_unavailable: "The Palworld player list is currently unavailable. Please try again later."
      },
      guildNotConnected: "This Discord server is not connected to a YORO Organization.",
      serverNotConfigured: "A Palworld game server has not been registered yet.",
      unavailable: "The server status is currently unavailable. Please try again later.",
      internalFailure: {
        authentication_failed: "The internal connection between YORO Bot and the server requires attention. Contact the service operator.",
        unavailable: "The YORO server is currently unavailable. Please try again later.",
        rejected: "The server status request could not be processed. Contact the service operator.",
        invalid_response: "The server status response could not be verified. Please try again later.",
        unexpected: "The server status is currently unavailable. Please try again later."
      },
      policyDenied: {
        installation_inactive: "This Discord server is not connected to a YORO Organization.",
        module_disabled: "The Palworld status module is disabled for this server.",
        command_disabled: "This command has been disabled by a server manager."
      },
      fields: {
        status: "Status",
        notice: "Notice",
        players: "Players",
        version: "Game version",
        latency: "Response time",
        observedAt: "Last checked"
      },
      charts: {
        occupancy: "Server capacity",
        responseQuality: "Connection quality",
        excellent: "Excellent",
        good: "Good",
        delayed: "Delayed",
        slow: "Slow",
        footer: "YORO · Safe read-only Palworld status",
        playerFooter: "YORO · Palworld connected player lookup"
      },
      states: {
        not_configured: "Status connection required",
        checking: "Running the first status check",
        online: "Online",
        degraded: "Partially available",
        offline: "Offline",
        stale: "Last status is stale",
        auth_failed: "Server authentication requires attention",
        blocked_by_policy: "Connection policy requires attention",
        unavailable: "Status unavailable"
      },
      reasons: {
        status_not_configured: "The server is registered, but its REST status connection is not configured.",
        status_feature_disabled: "Palworld status checks are disabled in the current service configuration.",
        credentials_unavailable: "The service operator must check the credential store used for status connections.",
        auth_failed: "Check the Palworld server authentication settings.",
        network_policy_blocked: "The registered REST address is not permitted by the current connection policy.",
        upstream_unavailable: "The Palworld server status is currently unavailable.",
        stale_data: "The displayed status may no longer be current.",
        partial_data: "Basic server information was verified, but some status data could not be loaded."
      }
    }
  }
} as const;

export function discordBotMessageLocale(
  value: string | undefined
): DiscordBotMessageLocale {
  const normalized = value?.toLowerCase();
  if (normalized?.startsWith("ja")) return "ja";
  if (normalized?.startsWith("ko")) return "ko";
  return "en";
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

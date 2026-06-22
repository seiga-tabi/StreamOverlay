export const dashboardI18n = {
  ko: {
    app: {
      brandSubtitle: "방송 자동화 콘솔",
      navTitle: "메뉴",
      navLabel: "대시보드 메뉴",
      liveSafety: "라이브 안전 모드",
      currentView: "현재 화면",
      quickSettings: "설정",
      logout: "로그아웃",
      workspaceKicker: "Streamer Profile",
      workspaceLabel: "방송 운영 허브",
      workspaceDescription: "Twitch 연결, 커뮤니티 반응, OBS overlay를 한 흐름에서 관리합니다.",
      navGroups: {
        operations: "운영",
        overlay: "Overlay",
        community: "커뮤니티",
        system: "시스템"
      },
      loading: "화면을 불러오는 중입니다."
    },
    authPage: {
      eyebrow: "관리자 로그인",
      title: "StreamOps 접근 인증",
      description: "서버에 설정된 dashboard token을 입력해야 방송 운영 화면에 접근할 수 있습니다.",
      tokenLabel: "Dashboard token",
      placeholder: "DASHBOARD_AUTH_TOKEN",
      login: "로그인",
      checking: "확인 중",
      invalid: "토큰이 올바르지 않습니다.",
      unavailable: "인증 상태를 확인하지 못했습니다. 서버 연결을 확인해주세요.",
      notConfigured: "서버에 DASHBOARD_AUTH_TOKEN이 설정되지 않아 로그인이 잠겨 있습니다.",
      hint: "서버 환경 변수 DASHBOARD_AUTH_TOKEN에 설정한 값과 동일해야 합니다."
    },
    pages: {
      dashboard: { label: "운영 현황", short: "대시보드" },
      twitch: { label: "Twitch 연결", short: "Twitch" },
      overlayStatus: { label: "Overlay 연결", short: "연결" },
      overlayTest: { label: "Overlay 테스트", short: "테스트" },
      overlayRewards: { label: "Reward 매핑", short: "Reward" },
      followers: { label: "팔로워 관리", short: "팔로워" },
      events: { label: "이벤트 로그", short: "이벤트" },
      questions: { label: "질문 큐", short: "질문" },
      participation: { label: "시참 관리", short: "시참" },
      settings: { label: "시스템 설정", short: "설정" }
    },
    dashboard: {
      eyebrow: "실시간 모니터링",
      title: "방송 운영 대시보드",
      description: "Twitch, OBS, 브리지, 시참 상태를 한 화면에서 확인합니다.",
      websocket: "WebSocket 상태",
      connected: "연결됨",
      offline: "모의/오프라인",
      statusLabels: {
        server: "서버",
        twitch: "Twitch",
        stream: "방송",
        bridge: "브리지",
        obs: "OBS",
        participation: "시참"
      }
    },
    statusValues: {
      online: "온라인",
      offline: "오프라인",
      connected: "연결됨",
      disconnected: "연결 끊김",
      disabled: "비활성",
      unknown: "알 수 없음",
      open: "모집 중",
      closed: "모집 종료"
    },
    eventLog: {
      title: "최근 이벤트",
      empty: "이벤트가 없습니다.",
      count: "건"
    },
    questionQueue: {
      title: "질문 큐",
      empty: "등록된 질문이 없습니다."
    },
    actionTester: {
      title: "안전한 액션 테스트",
      description: "허용된 action만 버튼으로 노출합니다. 임의 action 입력은 제공하지 않습니다.",
      sent: "테스트 action 전송 완료",
      failPrefix: "실패",
      actions: {
        banner: "오버레이 배너 테스트",
        subtitle: "자막 테스트",
        question: "질문 테스트",
        participation: "시참 대기열 테스트",
        mission: "미션 테스트",
        replay: "리플레이 버퍼 저장",
        scene: "메인 씬 전환"
      },
      bannerMessage: "Dashboard 테스트 배너입니다."
    },
    eventsPage: {
      title: "이벤트 로그",
      description: "수신 이벤트와 실행된 action 결과를 시간순으로 점검합니다.",
      recentActions: "최근 액션",
      emptyActions: "실행된 액션이 없습니다."
    },
    twitchPage: {
      title: "Twitch 연결 운영",
      description: "OAuth 계정 연결, token 상태, EventSub subscription을 방송 전에 점검합니다."
    },
    overlayOpsPage: {
      views: {
        status: {
          title: "Overlay 연결 관리",
          description: "OBS Browser Source URL, mode별 연결 client, 최근 overlay 메시지를 확인합니다."
        },
        test: {
          title: "Overlay 테스트",
          description: "방송 전에 이벤트 배너, 자막, 질문, 미션, 시참 overlay를 안전 payload로 점검합니다."
        },
        rewards: {
          title: "Reward 매핑",
          description: "Channel point reward가 어떤 overlay action으로 이어지는지 read-only로 확인합니다."
        }
      }
    },
    followersPage: {
      title: "팔로워 관리",
      description: "새 팔로워, 팔로우 취소 추정, StreamOps 관측 활동을 한눈에 확인합니다.",
      refresh: "팔로워 목록 새로고침",
      refreshing: "새로고침 중",
      refreshDone: "팔로워 목록을 갱신했습니다.",
      refreshFailed: "팔로워 목록 갱신 실패",
      scopeHint: "전체 목록과 팔로우 취소 추정에는 Twitch OAuth scope moderator:read:followers가 필요합니다.",
      dataLimit: "Twitch는 시청자의 장르별 시청 이력을 제공하지 않습니다. 장르는 StreamOps가 관측한 채팅/시참 활동 기준입니다.",
      metrics: {
        activeFollowers: "현재 팔로워",
        knownFollowers: "기록된 사용자",
        unfollowed: "팔로우 취소 추정",
        newFollowers7d: "최근 7일 신규",
        observedGenreFollowers: "관측 장르 보유"
      },
      sections: {
        recentFollowers: "새 팔로워",
        recentUnfollowers: "팔로우 취소 추정",
        topGenres: "관측 장르",
        allFollowers: "팔로워 목록",
        notes: "데이터 기준"
      },
      empty: {
        followers: "아직 기록된 팔로워가 없습니다.",
        unfollowers: "팔로우 취소로 추정된 사용자가 없습니다.",
        genres: "관측된 장르 활동이 없습니다."
      },
      columns: {
        user: "사용자",
        status: "상태",
        followedAt: "팔로우 시각",
        activity: "관측 활동",
        genre: "주요 관측 장르"
      },
      statuses: {
        following: "팔로우 중",
        unfollowed: "취소 추정"
      },
      snapshot: "마지막 목록 확인",
      total: "Twitch total",
      truncated: "일부만 조회됨"
    },
    questionsPage: {
      title: "질문 큐",
      description: "방송 중 접수된 질문과 번역 상태를 빠르게 확인합니다."
    },
    settingsPage: {
      title: "설정 / OBS URL",
      description: "OBS Browser Source와 서버 API 연결 정보를 확인합니다.",
      riotApi: {
        title: "Riot API Key",
        description: "시참 Riot ID 검증, 랭크 조회, 게임 감지를 위해 서버에 Riot API key를 저장합니다.",
        configured: "설정됨",
        notConfigured: "미설정",
        source: "저장 위치",
        maskedKey: "현재 key",
        accountRegion: "계정 region",
        lolPlatform: "LoL platform 라우팅",
        updatedAt: "마지막 저장",
        inputLabel: "새 Riot API key",
        placeholder: "RGAPI-...",
        save: "저장",
        saving: "저장 중",
        clear: "웹 저장 key 삭제",
        clearing: "삭제 중",
        saved: "Riot API key를 저장했습니다.",
        cleared: "웹 저장 Riot API key를 삭제했습니다.",
        loadFailed: "Riot API 설정 조회 실패",
        saveFailed: "Riot API key 저장 실패",
        clearFailed: "Riot API key 삭제 실패",
        sources: {
          runtime: "웹 저장",
          env: ".env",
          none: "없음"
        },
        notes: [
          "key 원문은 dashboard에 다시 표시하지 않고 마스킹된 값만 보여줍니다.",
          ".env의 RIOT_API_KEY가 있어도 웹에서 저장한 key가 우선 사용됩니다.",
          "Riot 개발용 key는 만료될 수 있으므로 만료 시 다시 저장해야 합니다."
        ]
      },
      browserSource: "OBS Browser Source",
      overlayUrl: "개발 환경 overlay URL",
      serverApi: "서버 API",
      overlayUrls: "Overlay URLs",
      copy: "복사",
      copied: "복사했습니다.",
      overlayClients: "Overlay 연결",
      recentOverlayMessages: "최근 overlay 메시지",
      noOverlayMessages: "최근 overlay 메시지가 없습니다.",
      overlayModes: {
        events: "이벤트 배너",
        subtitles: "한일 자막",
        questions: "질문",
        mission: "미션",
        participation: "시참",
        all: "전체"
      },
      safetyTitle: "안전 경고",
      warnings: [
        "OBS WebSocket을 인터넷에 직접 노출하지 마세요.",
        "stream key 변경 action을 허용하지 마세요.",
        "viewer input을 shell/file/URL에 직접 연결하지 마세요."
      ]
    }
  },
  ja: {
    app: {
      brandSubtitle: "配信自動化コンソール",
      navTitle: "メニュー",
      navLabel: "ダッシュボードメニュー",
      liveSafety: "ライブ安全モード",
      currentView: "現在の画面",
      quickSettings: "設定",
      logout: "ログアウト",
      workspaceKicker: "Streamer Profile",
      workspaceLabel: "配信運用ハブ",
      workspaceDescription: "Twitch 接続、コミュニティ反応、OBS overlay を一つの流れで管理します。",
      navGroups: {
        operations: "運用",
        overlay: "Overlay",
        community: "コミュニティ",
        system: "システム"
      },
      loading: "画面を読み込んでいます。"
    },
    authPage: {
      eyebrow: "管理者ログイン",
      title: "StreamOps アクセス認証",
      description: "サーバーに設定された dashboard token を入力すると配信運用画面にアクセスできます。",
      tokenLabel: "Dashboard token",
      placeholder: "DASHBOARD_AUTH_TOKEN",
      login: "ログイン",
      checking: "確認中",
      invalid: "token が正しくありません。",
      unavailable: "認証状態を確認できませんでした。サーバー接続を確認してください。",
      notConfigured: "サーバーに DASHBOARD_AUTH_TOKEN が設定されていないためログインはロックされています。",
      hint: "サーバー環境変数 DASHBOARD_AUTH_TOKEN に設定した値と同じである必要があります。"
    },
    pages: {
      dashboard: { label: "運用状況", short: "ダッシュボード" },
      twitch: { label: "Twitch 接続", short: "Twitch" },
      overlayStatus: { label: "Overlay 接続", short: "接続" },
      overlayTest: { label: "Overlay テスト", short: "テスト" },
      overlayRewards: { label: "Reward マッピング", short: "Reward" },
      followers: { label: "フォロワー管理", short: "フォロワー" },
      events: { label: "イベントログ", short: "イベント" },
      questions: { label: "質問キュー", short: "質問" },
      participation: { label: "参加管理", short: "参加" },
      settings: { label: "システム設定", short: "設定" }
    },
    dashboard: {
      eyebrow: "リアルタイム監視",
      title: "配信運用ダッシュボード",
      description: "Twitch、OBS、ブリッジ、参加状態を一画面で確認します。",
      websocket: "WebSocket 状態",
      connected: "接続済み",
      offline: "モック/オフライン",
      statusLabels: {
        server: "サーバー",
        twitch: "Twitch",
        stream: "配信",
        bridge: "ブリッジ",
        obs: "OBS",
        participation: "参加"
      }
    },
    statusValues: {
      online: "オンライン",
      offline: "オフライン",
      connected: "接続済み",
      disconnected: "切断",
      disabled: "無効",
      unknown: "不明",
      open: "募集中",
      closed: "募集終了"
    },
    eventLog: {
      title: "最近のイベント",
      empty: "イベントはありません。",
      count: "件"
    },
    questionQueue: {
      title: "質問キュー",
      empty: "登録された質問はありません。"
    },
    actionTester: {
      title: "安全なアクションテスト",
      description: "許可された action だけをボタンで表示します。任意 action 入力は提供しません。",
      sent: "テスト action を送信しました",
      failPrefix: "失敗",
      actions: {
        banner: "オーバーレイバナーテスト",
        subtitle: "字幕テスト",
        question: "質問テスト",
        participation: "参加待機列テスト",
        mission: "ミッションテスト",
        replay: "リプレイバッファ保存",
        scene: "メインシーン切り替え"
      },
      bannerMessage: "Dashboard テストバナーです。"
    },
    eventsPage: {
      title: "イベントログ",
      description: "受信イベントと実行された action 結果を時系列で確認します。",
      recentActions: "最近のアクション",
      emptyActions: "実行されたアクションはありません。"
    },
    twitchPage: {
      title: "Twitch 接続運用",
      description: "OAuth アカウント接続、token 状態、EventSub subscription を配信前に確認します。"
    },
    overlayOpsPage: {
      views: {
        status: {
          title: "Overlay 接続管理",
          description: "OBS Browser Source URL、mode 別の接続 client、最近の overlay メッセージを確認します。"
        },
        test: {
          title: "Overlay テスト",
          description: "配信前にイベントバナー、字幕、質問、ミッション、参加 overlay を安全な payload で確認します。"
        },
        rewards: {
          title: "Reward マッピング",
          description: "Channel point reward がどの overlay action につながるかを read-only で確認します。"
        }
      }
    },
    followersPage: {
      title: "フォロワー管理",
      description: "新規フォロワー、フォロー解除推定、StreamOps が観測した活動を一覧で確認します。",
      refresh: "フォロワー一覧を更新",
      refreshing: "更新中",
      refreshDone: "フォロワー一覧を更新しました。",
      refreshFailed: "フォロワー一覧の更新に失敗しました",
      scopeHint: "全体一覧とフォロー解除推定には Twitch OAuth scope moderator:read:followers が必要です。",
      dataLimit: "Twitch は視聴者のジャンル別視聴履歴を提供しません。ジャンルは StreamOps が観測したチャット/参加活動基準です。",
      metrics: {
        activeFollowers: "現在のフォロワー",
        knownFollowers: "記録済みユーザー",
        unfollowed: "解除推定",
        newFollowers7d: "直近7日の新規",
        observedGenreFollowers: "観測ジャンルあり"
      },
      sections: {
        recentFollowers: "新規フォロワー",
        recentUnfollowers: "フォロー解除推定",
        topGenres: "観測ジャンル",
        allFollowers: "フォロワー一覧",
        notes: "データ基準"
      },
      empty: {
        followers: "記録されたフォロワーはまだありません。",
        unfollowers: "フォロー解除と推定されたユーザーはいません。",
        genres: "観測されたジャンル活動はありません。"
      },
      columns: {
        user: "ユーザー",
        status: "状態",
        followedAt: "フォロー日時",
        activity: "観測活動",
        genre: "主な観測ジャンル"
      },
      statuses: {
        following: "フォロー中",
        unfollowed: "解除推定"
      },
      snapshot: "最終一覧確認",
      total: "Twitch total",
      truncated: "一部のみ取得"
    },
    questionsPage: {
      title: "質問キュー",
      description: "配信中に受け付けた質問と翻訳状態をすばやく確認します。"
    },
    settingsPage: {
      title: "設定 / OBS URL",
      description: "OBS Browser Source とサーバー API の接続情報を確認します。",
      riotApi: {
        title: "Riot API Key",
        description: "参加 Riot ID 検証、ランク取得、ゲーム検知のためにサーバーへ Riot API key を保存します。",
        configured: "設定済み",
        notConfigured: "未設定",
        source: "保存先",
        maskedKey: "現在の key",
        accountRegion: "アカウント region",
        lolPlatform: "LoL platform ルーティング",
        updatedAt: "最終保存",
        inputLabel: "新しい Riot API key",
        placeholder: "RGAPI-...",
        save: "保存",
        saving: "保存中",
        clear: "Web 保存 key を削除",
        clearing: "削除中",
        saved: "Riot API key を保存しました。",
        cleared: "Web 保存 Riot API key を削除しました。",
        loadFailed: "Riot API 設定の取得に失敗しました",
        saveFailed: "Riot API key の保存に失敗しました",
        clearFailed: "Riot API key の削除に失敗しました",
        sources: {
          runtime: "Web 保存",
          env: ".env",
          none: "なし"
        },
        notes: [
          "key の原文は dashboard に再表示せず、マスクされた値だけを表示します。",
          ".env の RIOT_API_KEY があっても、Web で保存した key が優先されます。",
          "Riot 開発用 key は期限切れになるため、失効したら再保存してください。"
        ]
      },
      browserSource: "OBS Browser Source",
      overlayUrl: "開発環境 overlay URL",
      serverApi: "サーバー API",
      overlayUrls: "Overlay URLs",
      copy: "コピー",
      copied: "コピーしました。",
      overlayClients: "Overlay 接続",
      recentOverlayMessages: "最近の overlay メッセージ",
      noOverlayMessages: "最近の overlay メッセージはありません。",
      overlayModes: {
        events: "イベントバナー",
        subtitles: "日韓字幕",
        questions: "質問",
        mission: "ミッション",
        participation: "参加",
        all: "全体"
      },
      safetyTitle: "安全警告",
      warnings: [
        "OBS WebSocket をインターネットに直接公開しないでください。",
        "stream key 変更 action を許可しないでください。",
        "viewer input を shell/file/URL に直接接続しないでください。"
      ]
    }
  }
} as const;

export type DashboardLocale = keyof typeof dashboardI18n;

export const dashboardLocale: DashboardLocale = "ko";
export const uiText = dashboardI18n[dashboardLocale];

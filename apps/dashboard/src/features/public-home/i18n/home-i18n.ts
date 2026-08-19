import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";

/* yoro.gg 루트 홈(백자·수묵 리디자인) 전용 카피 — 목업 docs 캔버스 "YORO 홈 리디자인"
 * v8 의 단일 원본입니다. 시각 규칙(팔레트·서체·시그니처 요소)은
 * styles/pages/home/01-public-home.css 상단 주석을 따릅니다. */

export type HomeLocale = PublicLocale;

export type HomeText = {
  skipToContent: string;
  navHome: string;
  navGames: string;
  navBot: string;
  navLogin: string;
  navDashboard: string;
  navLogout: string;
  langMenuLabel: string;
  themeToggleLabel: string;
  gameMenuLabel: string;
  closeLabel: string;
  gameLolName: string;
  gameLolSub: string;
  gamePalName: string;
  gamePalSub: string;
  gameValorantName: string;
  gameValorantSub: string;
  gameMinecraftName: string;
  gameMinecraftSub: string;
  heroTitle: string;
  heroSub: string;
  tabLol: string;
  tabPal: string;
  searchPlaceholderLol: string;
  searchPlaceholderPal: string;
  searchLabel: string;
  serverLabel: string;
  chipBreeding: string;
  chipAram: string;
  chipPatchNotes: string;
  liveTitle: string;
  liveViewAll: string;
  liveCountSuffix: string;
  liveViewers: string;
  liveTodayRecord: string;
  liveWins: string;
  liveLosses: string;
  liveEmptyTitle: string;
  liveEmptyDescription: string;
  liveEmptyCta: string;
  liveLoginDescription: string;
  liveLoginCta: string;
  liveWatch: string;
  gamesTitle: string;
  lolCardName: string;
  palCardName: string;
  chartLolTitle: string;
  raritySilver: string;
  rarityGold: string;
  rarityPrismatic: string;
  rarityLegend: string;
  chartPalTitle: string;
  rowLolSearch: string;
  rowLolAram: string;
  rowLolPatchNotes: string;
  rowPalDex: string;
  rowPalItems: string;
  rowPalBreeding: string;
  breedingTitle: string;
  breedingSub: string;
  breedingPickerPlaceholder: string;
  breedingCta: string;
  botName: string;
  botDescription: string;
  botCta: string;
  footerLegal: string;
  footerTerms: string;
  footerPrivacy: string;
  footerContact: string;
  loginTitle: string;
  loginDescription: string;
  loginTwitchCta: string;
  loginFinePrint: string;
  seoTitle: string;
  seoDescription: string;
};

export const homeI18n: Record<HomeLocale, HomeText> = {
  ko: {
    skipToContent: "본문으로 건너뛰기",
    navHome: "홈",
    navGames: "게임",
    navBot: "YORO Bot",
    navLogin: "로그인",
    navDashboard: "대시보드",
    navLogout: "로그아웃",
    langMenuLabel: "언어 선택",
    themeToggleLabel: "라이트/다크 테마 전환",
    gameMenuLabel: "게임 메뉴",
    closeLabel: "닫기",
    gameLolName: "리그 오브 레전드",
    gameLolSub: "전적 · 증강 칼바람 · 패치노트",
    gamePalName: "팰월드",
    gamePalSub: "팰 도감 · 아이템 · 교배 계산",
    gameValorantName: "발로란트",
    gameValorantSub: "스트리머 전적 · 요원 데이터",
    gameMinecraftName: "마인크래프트",
    gameMinecraftSub: "위키 · 자료실",
    heroTitle: "게임 데이터, 검색 한 번",
    heroSub: "방송 중인 스트리머의 판을 보고, 시청자로 직접 참여합니다.",
    tabLol: "LoL 소환사",
    tabPal: "팰 도감",
    searchPlaceholderLol: "소환사명#태그",
    searchPlaceholderPal: "팰 이름",
    searchLabel: "검색",
    serverLabel: "서버 선택",
    chipBreeding: "팰 교배 계산",
    chipAram: "증강 칼바람",
    chipPatchNotes: "패치노트",
    liveTitle: "지금 방송 중",
    liveViewAll: "전체 보기",
    liveCountSuffix: "명",
    liveViewers: "{count}명 시청",
    liveTodayRecord: "오늘",
    liveWins: "{count}승",
    liveLosses: "{count}패",
    liveEmptyTitle: "지금은 방송 중인 스트리머가 없습니다",
    liveEmptyDescription: "팔로우한 스트리머가 방송을 켜면 이 자리에 먼저 표시됩니다.",
    liveEmptyCta: "스트리머 둘러보기",
    liveLoginDescription: "Twitch로 로그인하면 팔로우한 스트리머의 방송이 여기에 표시됩니다.",
    liveLoginCta: "Twitch로 로그인",
    liveWatch: "방송 보기",
    gamesTitle: "게임별 데이터",
    lolCardName: "리그 오브 레전드",
    palCardName: "팰월드",
    chartLolTitle: "증강 희귀도 분포",
    raritySilver: "실버",
    rarityGold: "골드",
    rarityPrismatic: "프리즘",
    rarityLegend: "전설",
    chartPalTitle: "속성별 팰 수 TOP 5",
    rowLolSearch: "전적 검색",
    rowLolAram: "증강 칼바람 도감",
    rowLolPatchNotes: "패치노트",
    rowPalDex: "팰 도감",
    rowPalItems: "아이템 · 스킬",
    rowPalBreeding: "교배 조합 계산",
    breedingTitle: "교배 조합, 바로 계산",
    breedingSub: "부모 팰 두 마리를 고르면 결과 페이지로 이동합니다.",
    breedingPickerPlaceholder: "부모 팰 선택",
    breedingCta: "교배 결과 보기",
    botName: "YORO Bot",
    botDescription: "모집 공지, 방송 알림, 시청자 참여 대기열 — 디스코드 서버 운영을 맡습니다.",
    botCta: "Discord에 초대하기",
    footerLegal: "yoro.gg는 Riot Games의 공식 파트너가 아니며, Riot Games는 본 서비스를 보증하지 않습니다. League of Legends는 Riot Games, Inc.의 상표입니다. Palworld는 Pocketpair, Inc.의 상표입니다.",
    footerTerms: "이용약관",
    footerPrivacy: "개인정보처리방침",
    footerContact: "문의",
    loginTitle: "로그인",
    loginDescription: "Twitch 계정으로 yoro.gg에 로그인합니다. 팔로우한 스트리머의 방송 상태와 시청자 참여 기능이 연결됩니다.",
    loginTwitchCta: "Twitch로 계속하기",
    loginFinePrint: "로그인하면 이용약관과 개인정보처리방침에 동의하는 것으로 간주됩니다. 방송인 기능은 로그인 후 방송인 등록에서 활성화합니다.",
    seoTitle: "YORO.gg — 게임 데이터, 검색 한 번",
    seoDescription: "LoL 전적과 증강 칼바람, 팰월드 도감과 교배 계산까지 검색창 하나로. 방송 중인 스트리머의 판을 보고 시청자로 직접 참여하세요."
  },
  ja: {
    skipToContent: "本文へスキップ",
    navHome: "ホーム",
    navGames: "ゲーム",
    navBot: "YORO Bot",
    navLogin: "ログイン",
    navDashboard: "ダッシュボード",
    navLogout: "ログアウト",
    langMenuLabel: "言語を選択",
    themeToggleLabel: "ライト/ダークテーマ切り替え",
    gameMenuLabel: "ゲームメニュー",
    closeLabel: "閉じる",
    gameLolName: "リーグ・オブ・レジェンド",
    gameLolSub: "戦績・オーグメントARAM・パッチノート",
    gamePalName: "パルワールド",
    gamePalSub: "パル図鑑・アイテム・配合計算",
    gameValorantName: "ヴァロラント",
    gameValorantSub: "配信者の戦績・エージェントデータ",
    gameMinecraftName: "マインクラフト",
    gameMinecraftSub: "Wiki・資料室",
    heroTitle: "ゲームデータ、検索ひとつで",
    heroSub: "配信中のストリーマーの試合を見て、視聴者として参加できます。",
    tabLol: "LoLサモナー",
    tabPal: "パル図鑑",
    searchPlaceholderLol: "サモナー名#タグ",
    searchPlaceholderPal: "パルの名前",
    searchLabel: "検索",
    serverLabel: "サーバーを選択",
    chipBreeding: "パル配合計算",
    chipAram: "オーグメントARAM",
    chipPatchNotes: "パッチノート",
    liveTitle: "現在配信中",
    liveViewAll: "すべて見る",
    liveCountSuffix: "人",
    liveViewers: "{count}人視聴中",
    liveTodayRecord: "本日",
    liveWins: "{count}勝",
    liveLosses: "{count}敗",
    liveEmptyTitle: "現在配信中のストリーマーはいません",
    liveEmptyDescription: "フォロー中のストリーマーが配信を始めると、ここに表示されます。",
    liveEmptyCta: "ストリーマーを見る",
    liveLoginDescription: "Twitchでログインすると、フォロー中のストリーマーの配信がここに表示されます。",
    liveLoginCta: "Twitchでログイン",
    liveWatch: "配信を見る",
    gamesTitle: "ゲーム別データ",
    lolCardName: "リーグ・オブ・レジェンド",
    palCardName: "パルワールド",
    chartLolTitle: "オーグメントレアリティ分布",
    raritySilver: "シルバー",
    rarityGold: "ゴールド",
    rarityPrismatic: "プリズム",
    rarityLegend: "レジェンド",
    chartPalTitle: "属性別パル数 TOP 5",
    rowLolSearch: "戦績検索",
    rowLolAram: "オーグメントARAM図鑑",
    rowLolPatchNotes: "パッチノート",
    rowPalDex: "パル図鑑",
    rowPalItems: "アイテム・スキル",
    rowPalBreeding: "配合計算",
    breedingTitle: "配合の組み合わせをすぐ計算",
    breedingSub: "親パル2体を選ぶと結果ページへ移動します。",
    breedingPickerPlaceholder: "親パルを選択",
    breedingCta: "配合結果を見る",
    botName: "YORO Bot",
    botDescription: "募集告知・配信通知・視聴者参加キュー — Discordサーバーの運営を任せられます。",
    botCta: "Discordに招待",
    footerLegal: "yoro.ggはRiot Gamesの公式パートナーではなく、Riot Gamesは本サービスを保証していません。League of LegendsはRiot Games, Inc.の商標です。PalworldはPocketpair, Inc.の商標です。",
    footerTerms: "利用規約",
    footerPrivacy: "プライバシーポリシー",
    footerContact: "お問い合わせ",
    loginTitle: "ログイン",
    loginDescription: "Twitchアカウントでyoro.ggにログインします。フォロー中のストリーマーの配信状況と視聴者参加機能が連携されます。",
    loginTwitchCta: "Twitchで続ける",
    loginFinePrint: "ログインすると利用規約とプライバシーポリシーに同意したものとみなされます。配信者機能はログイン後、配信者登録から有効化します。",
    seoTitle: "YORO.gg — ゲームデータ、検索ひとつで",
    seoDescription: "LoLの戦績とオーグメントARAM、パルワールドの図鑑と配合計算まで検索ひとつで。配信中のストリーマーの試合を見て、視聴者として参加しましょう。"
  },
  en: {
    skipToContent: "Skip to content",
    navHome: "Home",
    navGames: "Games",
    navBot: "YORO Bot",
    navLogin: "Log in",
    navDashboard: "Dashboard",
    navLogout: "Log out",
    langMenuLabel: "Select language",
    themeToggleLabel: "Toggle light/dark theme",
    gameMenuLabel: "Game menu",
    closeLabel: "Close",
    gameLolName: "League of Legends",
    gameLolSub: "Matches · ARAM augments · patch notes",
    gamePalName: "Palworld",
    gamePalSub: "Paldeck · items · breeding calculator",
    gameValorantName: "VALORANT",
    gameValorantSub: "Streamer matches · agent data",
    gameMinecraftName: "Minecraft",
    gameMinecraftSub: "Wiki · library",
    heroTitle: "Game data. One search.",
    heroSub: "Watch live streamers and join their games as a viewer.",
    tabLol: "LoL Summoner",
    tabPal: "Paldeck",
    searchPlaceholderLol: "GameName#Tag",
    searchPlaceholderPal: "Pal name",
    searchLabel: "Search",
    serverLabel: "Select server",
    chipBreeding: "Pal breeding calc",
    chipAram: "ARAM augments",
    chipPatchNotes: "Patch notes",
    liveTitle: "Live now",
    liveViewAll: "View all",
    liveCountSuffix: "",
    liveViewers: "{count} watching",
    liveTodayRecord: "Today",
    liveWins: "{count}W",
    liveLosses: "{count}L",
    liveEmptyTitle: "No streamers are live right now",
    liveEmptyDescription: "When streamers you follow go live, they show up here first.",
    liveEmptyCta: "Browse streamers",
    liveLoginDescription: "Log in with Twitch to see live streams from streamers you follow.",
    liveLoginCta: "Log in with Twitch",
    liveWatch: "Watch stream",
    gamesTitle: "Game data",
    lolCardName: "League of Legends",
    palCardName: "Palworld",
    chartLolTitle: "Augment rarity distribution",
    raritySilver: "Silver",
    rarityGold: "Gold",
    rarityPrismatic: "Prismatic",
    rarityLegend: "Legend",
    chartPalTitle: "Pals by element, top 5",
    rowLolSearch: "Match history",
    rowLolAram: "ARAM augment dex",
    rowLolPatchNotes: "Patch notes",
    rowPalDex: "Paldeck",
    rowPalItems: "Items & skills",
    rowPalBreeding: "Breeding calculator",
    breedingTitle: "Breeding combos, instantly",
    breedingSub: "Pick two parent pals to jump to the result page.",
    breedingPickerPlaceholder: "Choose a parent pal",
    breedingCta: "See breeding result",
    botName: "YORO Bot",
    botDescription: "Recruit posts, live alerts, viewer queues — YORO Bot runs your Discord server.",
    botCta: "Invite to Discord",
    footerLegal: "yoro.gg isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games. League of Legends is a trademark of Riot Games, Inc. Palworld is a trademark of Pocketpair, Inc.",
    footerTerms: "Terms",
    footerPrivacy: "Privacy",
    footerContact: "Contact",
    loginTitle: "Log in",
    loginDescription: "Log in to yoro.gg with your Twitch account to connect live status and viewer participation for streamers you follow.",
    loginTwitchCta: "Continue with Twitch",
    loginFinePrint: "By logging in you agree to the Terms and Privacy Policy. Streamer features are enabled from streamer registration after login.",
    seoTitle: "YORO.gg — Game data, one search",
    seoDescription: "LoL match history, ARAM augments, the Palworld Paldeck and breeding calculator — one search box. Watch live streamers and join their games as a viewer."
  }
};

import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";

export type MinecraftLocale = PublicLocale;

const ko = {
  brand: "마인크래프트",
  description: "조합법·아이템·도구·인챈트를 다루는 마인크래프트 위키와 모드·셰이더 자료실, Java·Bedrock 패치 노트를 준비하고 있습니다.",

  /* nav — 상단 nav 와 하단 탭바가 공유하는 라벨 */
  home: "위키",
  recipes: "조합법",
  items: "아이템",
  enchants: "인챈트",
  library: "자료실",
  patchNotes: "패치 노트",
  mainMenu: "마인크래프트 메뉴",

  /* 위키 홈 히어로 */
  heroKicker: "MINECRAFT WIKI // YORO.GG",
  heroTitle: "무엇이든 찾는 마인크래프트 위키",
  heroDescription: "3×3 조합 그리드로 보는 조합법, 도구 스탯과 용도, 인챈트의 효과·배타 관계까지 — 한국어·일본어 위키를 준비하고 있습니다.",
  heroStatus: "준비 중 — 카탈로그 파이프라인 연결 단계",

  /* 카테고리 타일 — 위키의 실제 구성 소개 */
  categoryTitle: "위키는 이렇게 구성됩니다",
  catRecipesTitle: "조합법",
  catRecipesDescription: "제작·제련·양조·대장장이 유형별 레시피를 그리드로 시각화합니다.",
  catItemsTitle: "아이템 · 도구",
  catItemsDescription: "스탯·내구도·용도와 티어 비교를 한 페이지에서 봅니다.",
  catEnchantsTitle: "인챈트",
  catEnchantsDescription: "효과 공식·최대 레벨·배타 관계·획득처를 정리합니다.",
  catMobsTitle: "몹",
  catMobsDescription: "드롭·스폰 정보는 위키 코어 이후 2차로 확장합니다.",
  catMobsPhase: "2차",
  catLibraryTitle: "자료실",
  catLibraryDescription: "모드·플러그인·셰이더를 큐레이션합니다 — 다운로드는 공식 출처로만 이동합니다.",
  catPatchTitle: "패치 노트",
  catPatchDescription: "Java·Bedrock 패치 노트를 에디션 탭으로 제공합니다.",

  /* 데이터 화면 준비 중 상태 */
  comingSoonBadge: "준비 중",
  recipesComingSoonTitle: "조합법 위키를 준비하고 있습니다",
  recipesComingSoonDescription: "제작·제련·양조·대장장이 유형별 레시피를 그리드로 제공할 예정입니다.",
  itemsComingSoonTitle: "아이템·도구 위키를 준비하고 있습니다",
  itemsComingSoonDescription: "아이템 스탯·내구도·용도와 도구 티어 비교를 제공할 예정입니다.",
  enchantsComingSoonTitle: "인챈트 위키를 준비하고 있습니다",
  enchantsComingSoonDescription: "효과 공식·최대 레벨·배타 관계·획득처를 제공할 예정입니다.",
  libraryComingSoonTitle: "자료실을 준비하고 있습니다",
  libraryComingSoonDescription: "모드·플러그인·셰이더 큐레이션을 제공할 예정입니다. 파일은 호스팅하지 않고 공식 출처로만 안내합니다.",
  patchNotesComingSoonTitle: "패치 노트를 준비하고 있습니다",
  patchNotesComingSoonDescription: "Mojang 공식 피드 기반 Java·Bedrock 패치 노트를 제공할 예정입니다.",
  backHome: "위키 홈으로",

  /* 비공식 고지 */
  unofficialNotice: "YORO.gg 는 Mojang·Microsoft 와 관련이 없는 비공식 팬 서비스입니다. Minecraft 는 Mojang Synergies AB 의 상표입니다.",

  /* 404 · 오류 */
  notFoundTitle: "페이지를 찾을 수 없습니다.",
  notFoundDescription: "요청한 마인크래프트 공개 경로가 존재하지 않습니다.",
  errorTitle: "화면을 그리지 못했습니다.",
  errorDescription: "새로고침하면 다시 시도합니다.",
  errorReload: "새로고침",

  /* 헤더 공통(공용 chrome 라벨) */
  gameMenu: "게임 선택",
  mobileMenu: "메뉴",
  openMobileMenu: "메뉴 열기",
  closeMobileMenu: "메뉴 닫기",
  languageSection: "언어",
  account: "계정",
  accountLogin: "로그인",
  accountLoginMenu: "로그인 방법 선택",
  accountLoginTitle: "YORO 계정으로 로그인",
  accountLogout: "로그아웃",
  accountMenu: "계정 메뉴",
  discordLogin: "Discord로 로그인",
  twitchLoginChoice: "Twitch로 로그인",
  twitchLoginLoading: "로그인 확인 중…",
  twitchNotConfiguredDescription: "Twitch 로그인은 현재 사용할 수 없습니다.",
  yoroDashboardOpen: "내 대시보드",
  skipToContent: "본문으로 이동",
  loading: "불러오는 중…",
} as const;

const ja: Record<keyof typeof ko, string> = {
  brand: "マインクラフト",
  description: "レシピ・アイテム・道具・エンチャントを扱うマインクラフト Wiki と MOD・シェーダー資料室、Java・Bedrock パッチノートを準備しています。",

  home: "Wiki",
  recipes: "レシピ",
  items: "アイテム",
  enchants: "エンチャント",
  library: "資料室",
  patchNotes: "パッチノート",
  mainMenu: "マインクラフト メニュー",

  heroKicker: "MINECRAFT WIKI // YORO.GG",
  heroTitle: "なんでも探せるマインクラフト Wiki",
  heroDescription: "3×3 クラフトグリッドで見るレシピ、道具のステータスと用途、エンチャントの効果・排他関係まで — 韓国語・日本語の Wiki を準備しています。",
  heroStatus: "準備中 — カタログパイプライン接続段階",

  categoryTitle: "Wiki の構成",
  catRecipesTitle: "レシピ",
  catRecipesDescription: "作業台・かまど・醸造・鍛冶の種類別レシピをグリッドで可視化します。",
  catItemsTitle: "アイテム・道具",
  catItemsDescription: "ステータス・耐久値・用途とティア比較を 1 ページで見られます。",
  catEnchantsTitle: "エンチャント",
  catEnchantsDescription: "効果の計算式・最大レベル・排他関係・入手先を整理します。",
  catMobsTitle: "モブ",
  catMobsDescription: "ドロップ・スポーン情報は Wiki コア後の第 2 段階で拡張します。",
  catMobsPhase: "第2段階",
  catLibraryTitle: "資料室",
  catLibraryDescription: "MOD・プラグイン・シェーダーをキュレーションします — ダウンロードは公式ページへの移動のみです。",
  catPatchTitle: "パッチノート",
  catPatchDescription: "Java・Bedrock のパッチノートをエディションタブで提供します。",

  comingSoonBadge: "準備中",
  recipesComingSoonTitle: "レシピ Wiki を準備しています",
  recipesComingSoonDescription: "作業台・かまど・醸造・鍛冶の種類別レシピをグリッドで提供する予定です。",
  itemsComingSoonTitle: "アイテム・道具 Wiki を準備しています",
  itemsComingSoonDescription: "アイテムのステータス・耐久値・用途と道具のティア比較を提供する予定です。",
  enchantsComingSoonTitle: "エンチャント Wiki を準備しています",
  enchantsComingSoonDescription: "効果の計算式・最大レベル・排他関係・入手先を提供する予定です。",
  libraryComingSoonTitle: "資料室を準備しています",
  libraryComingSoonDescription: "MOD・プラグイン・シェーダーのキュレーションを提供する予定です。ファイルはホスティングせず、公式ページのみ案内します。",
  patchNotesComingSoonTitle: "パッチノートを準備しています",
  patchNotesComingSoonDescription: "Mojang 公式フィードに基づく Java・Bedrock のパッチノートを提供する予定です。",
  backHome: "Wiki ホームへ",

  unofficialNotice: "YORO.gg は Mojang・Microsoft と関係のない非公式ファンサービスです。Minecraft は Mojang Synergies AB の商標です。",

  notFoundTitle: "ページが見つかりません。",
  notFoundDescription: "指定されたマインクラフト公開ページは存在しません。",
  errorTitle: "画面を描画できませんでした。",
  errorDescription: "再読み込みすると再試行します。",
  errorReload: "再読み込み",

  gameMenu: "ゲーム選択",
  mobileMenu: "メニュー",
  openMobileMenu: "メニューを開く",
  closeMobileMenu: "メニューを閉じる",
  languageSection: "言語",
  account: "アカウント",
  accountLogin: "ログイン",
  accountLoginMenu: "ログイン方法を選択",
  accountLoginTitle: "YORO アカウントでログイン",
  accountLogout: "ログアウト",
  accountMenu: "アカウントメニュー",
  discordLogin: "Discord でログイン",
  twitchLoginChoice: "Twitch でログイン",
  twitchLoginLoading: "ログイン確認中…",
  twitchNotConfiguredDescription: "Twitch ログインは現在利用できません。",
  yoroDashboardOpen: "マイダッシュボード",
  skipToContent: "本文へ移動",
  loading: "読み込み中…",
};

export const minecraftI18n = { ko, ja } as const;

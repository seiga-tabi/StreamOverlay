import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";

/* en 콘텐츠가 아직 없는 섹션 — PublicLocale(en 포함)이 아니라 ko·ja 로 고정하고,
 * 페이지 진입부에서 publicContentLocale 로 축소해 받습니다(팰월드 우선 단계). */
export type ValorantLocale = "ko" | "ja";

const ko = {
  brand: "발로란트",
  description: "전적을 공개한 스트리머의 매치 기록, 경쟁전 리더보드, 요원 데이터를 준비하고 있습니다.",

  /* nav — 상단 nav 와 하단 탭바가 공유하는 라벨 */
  home: "홈",
  agents: "요원",
  weapons: "무기",
  maps: "맵",
  ranked: "랭킹",
  mainMenu: "발로란트 메뉴",

  /* 홈 히어로 */
  heroKicker: "VALORANT // YORO.GG",
  heroTitle: "스트리머 전적부터 요원 데이터까지",
  heroDescription: "전적을 공개한 스트리머의 매치 기록, 경쟁전 리더보드, 그리고 내 전적을 Riot 로그인으로 확인할 수 있게 준비하고 있습니다.",
  heroStatus: "준비 중 — Riot 프로덕션 승인 진행 단계",

  /* 전적 3단 모델 소개 — 정책을 그대로 설명하는 실제 콘텐츠 */
  modelTitle: "발로란트 전적은 이렇게 제공됩니다",
  modelStreamerTitle: "스트리머 전적",
  modelStreamerBadge: "본인 동의 공개",
  modelStreamerDescription: "YORO 에 등록한 스트리머가 본인 동의(RSO)로 전적 공개에 동의하면, 그 스트리머의 매치 기록을 공개 프로필로 볼 수 있습니다.",
  modelMineTitle: "내 전적",
  modelMineBadge: "Riot 로그인 필요",
  modelMineDescription: "Riot 계정으로 로그인하면 내 매치 기록을 직접 확인할 수 있습니다. 로그인한 본인에게만 보입니다.",
  modelLeaderboardTitle: "경쟁전 리더보드",
  modelLeaderboardBadge: "로그인 불필요",
  modelLeaderboardDescription: "액트별 상위 랭커는 Riot 이 공개하는 데이터라 로그인 없이 누구나 볼 수 있습니다.",
  policyNote: "Riot 정책상 본인이 동의(RSO)한 계정의 전적만 공개할 수 있습니다. 동의하지 않은 플레이어의 전적 검색은 제공되지 않습니다.",

  /* 홈 FAQ — 확정된 사실만 문답으로 정리(가짜 일정·기능 약속 금지) */
  faqTitle: "자주 묻는 질문",
  faqReleaseQuestion: "언제 이용할 수 있나요?",
  faqReleaseAnswer: "Riot 프로덕션 API 승인이 완료되는 대로 요원·무기·맵·랭킹 데이터부터 순차 공개합니다. 확정된 일정이 생기면 이 페이지에서 안내합니다.",
  faqSearchQuestion: "아무 플레이어나 검색할 수 있나요?",
  faqSearchAnswer: "아니요. Riot 정책상 본인 동의(RSO)를 마친 계정만 공개 대상이라, 동의한 스트리머와 본인 전적만 제공됩니다.",
  faqPrivacyQuestion: "내 전적은 누구에게 보이나요?",
  faqPrivacyAnswer: "Riot 계정으로 로그인한 본인에게만 보입니다. 공개를 원하는 스트리머는 별도의 동의 절차를 거쳐야 합니다.",

  /* 데이터 화면 준비 중 상태 */
  comingSoonBadge: "준비 중",
  agentsComingSoonTitle: "요원 도감을 준비하고 있습니다",
  agentsComingSoonDescription: "요원별 역할과 스킬 정보를 한국어·일본어로 제공할 예정입니다.",
  weaponsComingSoonTitle: "무기 정보를 준비하고 있습니다",
  weaponsComingSoonDescription: "무기 유형과 구매 가격 정보를 제공할 예정입니다.",
  mapsComingSoonTitle: "맵 정보를 준비하고 있습니다",
  mapsComingSoonDescription: "맵별 사이트 구성 정보를 제공할 예정입니다.",
  rankedComingSoonTitle: "경쟁전 리더보드를 준비하고 있습니다",
  rankedComingSoonDescription: "Riot 프로덕션 승인 후 액트별 상위 랭커를 공개합니다. 이름 공개를 원치 않는 플레이어는 Riot 설정에 따라 익명으로 표시됩니다.",
  backHome: "발로란트 홈으로",

  /* 404 · 오류 */
  notFoundTitle: "페이지를 찾을 수 없습니다.",
  notFoundDescription: "요청한 발로란트 공개 경로가 존재하지 않습니다.",
  errorTitle: "화면을 그리지 못했습니다.",
  errorDescription: "새로고침하면 다시 시도합니다.",
  errorReload: "새로고침",

  /* 헤더 공통(공용 chrome 라벨) */
  gameMenu: "게임 선택",
  mobileMenu: "메뉴",
  openMobileMenu: "메뉴 열기",
  closeMobileMenu: "메뉴 닫기",
  languageSection: "언어",
  skipToContent: "본문으로 이동",
  loading: "불러오는 중…",
} as const;

const ja: Record<keyof typeof ko, string> = {
  brand: "ヴァロラント",
  description: "戦績を公開した配信者のマッチ記録、コンペのリーダーボード、エージェントデータを準備しています。",

  home: "ホーム",
  agents: "エージェント",
  weapons: "武器",
  maps: "マップ",
  ranked: "ランキング",
  mainMenu: "VALORANT メニュー",

  heroKicker: "VALORANT // YORO.GG",
  heroTitle: "配信者の戦績からエージェントデータまで",
  heroDescription: "戦績を公開した配信者のマッチ記録、コンペのリーダーボード、そして自分の戦績を Riot ログインで確認できるよう準備しています。",
  heroStatus: "準備中 — Riot プロダクション承認の進行段階",

  modelTitle: "VALORANT の戦績はこのように提供されます",
  modelStreamerTitle: "配信者の戦績",
  modelStreamerBadge: "本人同意で公開",
  modelStreamerDescription: "YORO に登録した配信者が本人同意(RSO)で戦績公開に同意すると、その配信者のマッチ記録を公開プロフィールで見られます。",
  modelMineTitle: "自分の戦績",
  modelMineBadge: "Riot ログイン必要",
  modelMineDescription: "Riot アカウントでログインすると自分のマッチ記録を直接確認できます。ログインした本人にのみ表示されます。",
  modelLeaderboardTitle: "コンペ リーダーボード",
  modelLeaderboardBadge: "ログイン不要",
  modelLeaderboardDescription: "アクトごとの上位ランカーは Riot が公開するデータのため、ログインなしで誰でも見られます。",
  policyNote: "Riot のポリシー上、本人が同意(RSO)したアカウントの戦績のみ公開できます。同意していないプレイヤーの戦績検索は提供されません。",

  faqTitle: "よくある質問",
  faqReleaseQuestion: "いつ利用できますか?",
  faqReleaseAnswer: "Riot プロダクション API の承認が完了し次第、エージェント・武器・マップ・ランキングのデータから順次公開します。確定した予定ができたらこのページでお知らせします。",
  faqSearchQuestion: "どのプレイヤーでも検索できますか?",
  faqSearchAnswer: "いいえ。Riot のポリシー上、本人同意(RSO)を済ませたアカウントのみ公開対象のため、同意した配信者と自分の戦績のみ提供されます。",
  faqPrivacyQuestion: "自分の戦績は誰に見えますか?",
  faqPrivacyAnswer: "Riot アカウントでログインした本人にのみ表示されます。公開を希望する配信者は別途の同意手続きが必要です。",

  comingSoonBadge: "準備中",
  agentsComingSoonTitle: "エージェント図鑑を準備しています",
  agentsComingSoonDescription: "エージェントごとの役割とスキル情報を韓国語・日本語で提供する予定です。",
  weaponsComingSoonTitle: "武器情報を準備しています",
  weaponsComingSoonDescription: "武器の種類と購入価格の情報を提供する予定です。",
  mapsComingSoonTitle: "マップ情報を準備しています",
  mapsComingSoonDescription: "マップごとのサイト構成情報を提供する予定です。",
  rankedComingSoonTitle: "コンペのリーダーボードを準備しています",
  rankedComingSoonDescription: "Riot プロダクション承認後、アクトごとの上位ランカーを公開します。名前の公開を望まないプレイヤーは Riot の設定により匿名で表示されます。",
  backHome: "VALORANT ホームへ",

  notFoundTitle: "ページが見つかりません。",
  notFoundDescription: "指定された VALORANT 公開ページは存在しません。",
  errorTitle: "画面を描画できませんでした。",
  errorDescription: "再読み込みすると再試行します。",
  errorReload: "再読み込み",

  gameMenu: "ゲーム選択",
  mobileMenu: "メニュー",
  openMobileMenu: "メニューを開く",
  closeMobileMenu: "メニューを閉じる",
  languageSection: "言語",
  skipToContent: "本文へ移動",
  loading: "読み込み中…",
};

export const valorantI18n = { ko, ja } as const;

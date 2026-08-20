import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";

/* LoL 스트리머(/follow) 리디자인 전용 카피 — 목업 캔버스 "YORO 홈 리디자인"
 * page-3(LoL 스트리머)의 단일 원본입니다. 헤더·푸터·탭바·로그인 팝업 카피는
 * home-i18n.ts / lol-home-i18n.ts 를 재사용합니다.
 * 랭크 배지는 실서비스 관례(rankTierLabel, 영문 티어명)라 번역하지 않습니다. */

export type LolStreamersText = {
  pageTitle: string;
  pageSub: string;
  countUnit: string;
  refresh: string;
  filterLive: string;
  filterAll: string;
  filterLinked: string;
  sortByRank: string;
  liveNow: string;
  offline: string;
  showMore: string;
  showLess: string;
  viewStats: string;
  statsNotLinked: string;
  followedOn: string;
  loadingLabel: string;
  loginRequiredTitle: string;
  loginRequiredDescription: string;
  loginCta: string;
  emptyTitle: string;
  emptyDescription: string;
  notConfigured: string;
  errorTitle: string;
  retry: string;
  seoTitle: string;
  seoDescription: string;
};

export const lolStreamersI18n: Record<PublicLocale, LolStreamersText> = {
  ko: {
    pageTitle: "스트리머",
    pageSub: "Twitch에서 팔로우한 LoL 스트리머의 방송 상태와 전적을 한 곳에서 봅니다.",
    countUnit: "{count}명",
    refresh: "새로고침",
    filterLive: "방송 중",
    filterAll: "전체",
    filterLinked: "전적 연동",
    sortByRank: "랭크순",
    liveNow: "지금 방송 중",
    offline: "오프라인",
    showMore: "{count}명 더 보기",
    showLess: "접기",
    viewStats: "전적 보기",
    statsNotLinked: "전적 미연동",
    followedOn: "{date} 팔로우",
    loadingLabel: "팔로우한 스트리머를 불러오는 중",
    loginRequiredTitle: "팔로우한 스트리머를 보려면 로그인이 필요합니다",
    loginRequiredDescription: "Twitch로 로그인하면 팔로우한 LoL 스트리머의 방송 상태와 전적이 여기에 표시됩니다.",
    loginCta: "Twitch로 로그인",
    emptyTitle: "팔로우한 LoL 스트리머가 없습니다",
    emptyDescription: "Twitch에서 LoL 스트리머를 팔로우하면 이 목록에 표시됩니다.",
    notConfigured: "Twitch 연동이 아직 준비되지 않았습니다. 잠시 후 다시 확인해 주세요.",
    errorTitle: "목록을 불러오지 못했습니다",
    retry: "다시 시도",
    seoTitle: "YORO.gg — 팔로우한 LoL 스트리머",
    seoDescription: "Twitch에서 팔로우한 LoL 스트리머의 방송 상태와 전적을 한 화면에서 확인하세요."
  },
  ja: {
    pageTitle: "ストリーマー",
    pageSub: "Twitchでフォローしたストリーマーの配信状況と戦績をひとつの場所で。",
    countUnit: "{count}人",
    refresh: "更新",
    filterLive: "配信中",
    filterAll: "すべて",
    filterLinked: "戦績連携",
    sortByRank: "ランク順",
    liveNow: "現在配信中",
    offline: "オフライン",
    showMore: "あと{count}人を表示",
    showLess: "折りたたむ",
    viewStats: "戦績を見る",
    statsNotLinked: "戦績未連携",
    followedOn: "{date} フォロー",
    loadingLabel: "フォロー中のストリーマーを読み込み中",
    loginRequiredTitle: "フォロー中のストリーマーを見るにはログインが必要です",
    loginRequiredDescription: "Twitchでログインすると、フォロー中のLoLストリーマーの配信状況と戦績がここに表示されます。",
    loginCta: "Twitchでログイン",
    emptyTitle: "フォロー中のLoLストリーマーがいません",
    emptyDescription: "TwitchでLoLストリーマーをフォローすると、この一覧に表示されます。",
    notConfigured: "Twitch連携の準備がまだ整っていません。しばらくしてからもう一度お試しください。",
    errorTitle: "一覧を読み込めませんでした",
    retry: "もう一度試す",
    seoTitle: "YORO.gg — フォロー中のLoLストリーマー",
    seoDescription: "TwitchでフォローしたLoLストリーマーの配信状況と戦績をひとつの画面で確認できます。"
  },
  en: {
    pageTitle: "Streamers",
    pageSub: "Live status and match history for the LoL streamers you follow on Twitch.",
    countUnit: "{count}",
    refresh: "Refresh",
    filterLive: "Live",
    filterAll: "All",
    filterLinked: "Stats linked",
    sortByRank: "By rank",
    liveNow: "Live now",
    offline: "Offline",
    showMore: "Show {count} more",
    showLess: "Show less",
    viewStats: "View stats",
    statsNotLinked: "Stats not linked",
    followedOn: "Followed {date}",
    loadingLabel: "Loading followed streamers",
    loginRequiredTitle: "Log in to see the streamers you follow",
    loginRequiredDescription: "Log in with Twitch to see live status and match history for the LoL streamers you follow.",
    loginCta: "Log in with Twitch",
    emptyTitle: "You don't follow any LoL streamers yet",
    emptyDescription: "Follow LoL streamers on Twitch and they will show up in this list.",
    notConfigured: "Twitch integration isn't set up yet. Please check back later.",
    errorTitle: "Couldn't load the list",
    retry: "Try again",
    seoTitle: "YORO.gg — Followed LoL streamers",
    seoDescription: "Live status and match history for the LoL streamers you follow on Twitch, all in one place."
  }
};

import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";

/* LoL 홈(/lol) 리디자인 전용 카피 — 목업 캔버스 "YORO 홈 리디자인" page-2(LoL 홈)의
 * 단일 원본입니다. 헤더·푸터·방송 카드·로그인 팝업 등 공통 컴포넌트 카피는
 * home-i18n.ts(HomeText)를 그대로 재사용합니다.
 *
 * 목업의 "커뮤니티" 메뉴는 실서비스에서 nav 를 내린 상태라(PublicHeaderMenu 주석 참조)
 * 실제 항목 5개(홈·스트리머·참여·칼바람·패치노트)로 구성합니다. */

export type LolHomeText = {
  subnavLabel: string;
  tabHome: string;
  tabStreamers: string;
  tabParticipation: string;
  tabAram: string;
  tabPatchNotes: string;
  /* 모바일 하단 탭 축약 라벨 — 실서비스 탭바(참여·칼바람)와 같은 축약 관례. */
  tabParticipationShort: string;
  tabAramShort: string;
  heroTitle: string;
  heroSub: string;
  recentLabel: string;
  favoritesLabel: string;
  chipAram: string;
  chipPatchNotes: string;
  chipParticipation: string;
  dataTitle: string;
  aramCardName: string;
  aramPatchBadge: string;
  aramChartTitle: string;
  aramViewAll: string;
  patchCardName: string;
  patchRow: string;
  patchViewAll: string;
  participationTitle: string;
  participationDescription: string;
  participationCta: string;
  seoTitle: string;
  seoDescription: string;
};

export const lolHomeI18n: Record<PublicLocale, LolHomeText> = {
  ko: {
    subnavLabel: "LoL 메뉴",
    tabHome: "홈",
    tabStreamers: "스트리머",
    tabParticipation: "시청자 참여",
    tabAram: "증강 칼바람",
    tabPatchNotes: "패치노트",
    tabParticipationShort: "참여",
    tabAramShort: "칼바람",
    heroTitle: "LoL 전적, 검색 한 번",
    heroSub: "전적을 보고, 방송 중인 스트리머의 판에 시청자로 참여합니다.",
    recentLabel: "최근 검색",
    favoritesLabel: "즐겨찾기",
    chipAram: "증강 칼바람",
    chipPatchNotes: "패치노트",
    chipParticipation: "시청자 참여",
    dataTitle: "LoL 데이터",
    aramCardName: "증강 칼바람",
    aramPatchBadge: "패치 {patch}",
    aramChartTitle: "증강 희귀도 분포",
    aramViewAll: "증강 도감 전체 보기",
    patchCardName: "패치노트",
    patchRow: "{patch} 패치노트",
    patchViewAll: "전체 패치노트",
    participationTitle: "시청자 참여",
    participationDescription: "방송 중인 스트리머의 대기열에 등록하고, 순서가 오면 같은 판에서 플레이합니다.",
    participationCta: "참여 페이지로",
    seoTitle: "YORO.gg — LoL 전적, 검색 한 번",
    seoDescription: "Riot ID로 League of Legends 소환사의 랭크와 최근 경기, 챔피언 숙련도와 포지션 성향을 확인하세요. 증강 칼바람 도감과 패치 노트를 함께 살펴보고, 방송 중인 LoL 스트리머와 시청자 참여 기회도 찾을 수 있습니다."
  },
  ja: {
    subnavLabel: "LoLメニュー",
    tabHome: "ホーム",
    tabStreamers: "ストリーマー",
    tabParticipation: "視聴者参加",
    tabAram: "オーグメントARAM",
    tabPatchNotes: "パッチノート",
    tabParticipationShort: "参加",
    tabAramShort: "ARAM",
    heroTitle: "LoL戦績、検索ひとつで",
    heroSub: "戦績を確認し、配信中のストリーマーの試合に視聴者として参加できます。",
    recentLabel: "最近の検索",
    favoritesLabel: "お気に入り",
    chipAram: "オーグメントARAM",
    chipPatchNotes: "パッチノート",
    chipParticipation: "視聴者参加",
    dataTitle: "LoLデータ",
    aramCardName: "オーグメントARAM",
    aramPatchBadge: "パッチ {patch}",
    aramChartTitle: "オーグメントレアリティ分布",
    aramViewAll: "オーグメント図鑑を見る",
    patchCardName: "パッチノート",
    patchRow: "{patch} パッチノート",
    patchViewAll: "すべてのパッチノート",
    participationTitle: "視聴者参加",
    participationDescription: "配信中のストリーマーのキューに登録し、順番が来たら同じ試合でプレイします。",
    participationCta: "参加ページへ",
    seoTitle: "YORO.gg — LoL戦績、検索ひとつで",
    seoDescription: "Riot IDからLeague of Legendsサモナーのランク、最近の試合、チャンピオン熟練度、ロール傾向を確認できます。オーグメントARAM図鑑とパッチノートもあわせて閲覧し、配信中のLoLストリーマーや視聴者参加の機会を探せます。"
  },
  en: {
    subnavLabel: "LoL menu",
    tabHome: "Home",
    tabStreamers: "Streamers",
    tabParticipation: "Viewer games",
    tabAram: "ARAM augments",
    tabPatchNotes: "Patch notes",
    tabParticipationShort: "Join",
    tabAramShort: "ARAM",
    heroTitle: "LoL stats. One search.",
    heroSub: "Check stats and join live streamers' games as a viewer.",
    recentLabel: "Recent",
    favoritesLabel: "Favorites",
    chipAram: "ARAM augments",
    chipPatchNotes: "Patch notes",
    chipParticipation: "Viewer games",
    dataTitle: "LoL data",
    aramCardName: "ARAM augments",
    aramPatchBadge: "Patch {patch}",
    aramChartTitle: "Augment rarity distribution",
    aramViewAll: "Browse the augment dex",
    patchCardName: "Patch notes",
    patchRow: "Patch {patch} notes",
    patchViewAll: "All patch notes",
    participationTitle: "Viewer games",
    participationDescription: "Join a live streamer's queue and play in the same game when your turn comes.",
    participationCta: "Go to participation",
    seoTitle: "YORO.gg — LoL stats, one search",
    seoDescription: "LoL match history, the ARAM augment dex and patch notes in one place. Watch live streamers and join their games as a viewer."
  }
};

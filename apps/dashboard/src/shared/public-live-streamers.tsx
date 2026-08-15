import {
  PublicLiveStreamerRail,
  type PublicLiveRailText,
  type PublicLiveStreamerCard,
  type PublicLiveStreamerRailState,
} from "./PublicLiveStreamerRail";

/* 공개 게임 홈 LIVE 스트리머 레일의 공용 문구·상태 산출·컴포지션.
 *
 * 레일 UI(PublicLiveStreamerRail)는 이미 공용이지만 문구는 게임마다
 * i18n 키 한 벌씩 복제되어 있었습니다(팰월드 ~15키, LoL 인라인 객체).
 * 여기가 문구의 단일 원본입니다 — 데이터 소스가 다른 두 변형을 구분합니다:
 *   followed  : 뷰어 Twitch 세션의 팔로우 채널(로그인 필요) — 팰월드 홈
 *   registered: YORO 등록 스트리머(로그인 불필요) — LoL 홈
 */
const ko = {
  followedTitle: "팔로우 중인 LIVE 스트리머",
  registeredTitle: "현재 LIVE 스트리머",
  previous: "이전 LIVE 스트리머 보기",
  next: "다음 LIVE 스트리머 보기",
  viewAll: "전체 보기",
  watch: "방송 보기",
  followedLoading: "팔로우 중인 Twitch 채널을 불러오는 중입니다.",
  followedEmptyTitle: "현재 LIVE 방송이 없습니다.",
  followedEmptyDescription: "팔로우 중인 스트리머가 방송을 시작하면 여기에 표시됩니다.",
  registeredEmptyTitle: "현재 등록된 LIVE 스트리머가 없습니다.",
  registeredEmptyDescription: "등록된 스트리머가 LIVE 방송을 시작하면 여기에 표시됩니다.",
  loginTitle: "Twitch 로그인이 필요합니다.",
  loginDescription: "Twitch 로그인 후 팔로우 중인 스트리머의 방송 상태를 확인할 수 있습니다.",
  loginAction: "Twitch 로그인",
  notConfiguredTitle: "Twitch 기능이 설정되지 않았습니다.",
  notConfiguredDescription: "현재 Twitch 로그인과 팔로우 채널 조회를 사용할 수 없습니다.",
  errorTitle: "Twitch 방송 상태를 불러오지 못했습니다.",
  errorDescription: "Pal·아이템 검색은 계속 사용할 수 있습니다. 잠시 후 다시 시도해 주세요.",
  retry: "다시 시도",
} as const;

const ja: Record<keyof typeof ko, string> = {
  followedTitle: "フォロー中のLIVE配信者",
  registeredTitle: "現在LIVE配信者",
  previous: "前のLIVE配信者を見る",
  next: "次のLIVE配信者を見る",
  viewAll: "すべて見る",
  watch: "配信を見る",
  followedLoading: "フォロー中のTwitchチャンネルを読み込んでいます。",
  followedEmptyTitle: "現在LIVE配信はありません。",
  followedEmptyDescription: "フォロー中の配信者が配信を開始すると、ここに表示されます。",
  registeredEmptyTitle: "現在登録済みのLIVE配信者はいません。",
  registeredEmptyDescription: "登録済みの配信者がLIVE配信を開始すると、ここに表示されます。",
  loginTitle: "Twitch ログインが必要です。",
  loginDescription: "Twitch にログインすると、フォロー中の配信者の配信状況を確認できます。",
  loginAction: "Twitch ログイン",
  notConfiguredTitle: "Twitch 機能が設定されていません。",
  notConfiguredDescription: "現在、Twitch ログインとフォローチャンネルの取得を利用できません。",
  errorTitle: "Twitch 配信状況を読み込めませんでした。",
  errorDescription: "パル・アイテム検索は引き続き利用できます。しばらくしてからもう一度お試しください。",
  retry: "再試行",
};

export const publicLiveI18n = { ko, ja } as const;

export type PublicLiveLocale = keyof typeof publicLiveI18n;
export type PublicLiveTextKey = keyof typeof ko;

/* 레일이 요구하는 {label, ko, ja} 3중 형태로 변환합니다(label = 활성 언어). */
export function publicLiveText(locale: PublicLiveLocale, key: PublicLiveTextKey): PublicLiveRailText {
  return { label: publicLiveI18n[locale][key], ko: ko[key], ja: ja[key] };
}

export function publicLiveRailState({ configured, connected, error }: {
  configured: boolean;
  connected: boolean;
  error: boolean;
}): PublicLiveStreamerRailState {
  if (error) return "error";
  if (!configured) return "not-configured";
  if (!connected) return "login-required";
  return "ready";
}

/* followed 변형 컴포지션 — 상태 산출과 문구 배선을 한 곳에서 끝냅니다.
 * 게임 페이지는 데이터(streamers·플래그)와 핸들러만 넘깁니다. */
export function PublicFollowedLiveRail({
  configured,
  connected,
  error,
  loading,
  locale,
  onLogin,
  onRetry,
  onViewAll,
  streamers,
}: {
  configured: boolean;
  connected: boolean;
  error: boolean;
  loading: boolean;
  locale: PublicLiveLocale;
  onLogin: () => void;
  onRetry: () => void;
  onViewAll?: () => void;
  streamers: PublicLiveStreamerCard[];
}) {
  const text = (key: PublicLiveTextKey) => publicLiveText(locale, key);
  return (
    <PublicLiveStreamerRail
      emptyDescription={text("followedEmptyDescription")}
      emptyTitle={text(error ? "errorTitle" : "followedEmptyTitle")}
      errorDescription={text("errorDescription")}
      loading={loading}
      loadingLabel={text("followedLoading")}
      loginAction={text("loginAction")}
      loginDescription={text("loginDescription")}
      loginTitle={text("loginTitle")}
      notConfiguredDescription={text("notConfiguredDescription")}
      notConfiguredTitle={text("notConfiguredTitle")}
      onLogin={onLogin}
      onRetry={onRetry}
      onViewAll={onViewAll}
      previous={text("previous")}
      retryAction={text("retry")}
      state={publicLiveRailState({ configured, connected, error })}
      streamers={streamers}
      title={text("followedTitle")}
      next={text("next")}
      viewAll={text("viewAll")}
      watch={text("watch")}
    />
  );
}

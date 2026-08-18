import { useEffect, useState } from "react";
import { trackGoogleAnalyticsEvent } from "../analytics/google-analytics";
import { getPublicTwitchStatus, peekPublicTwitchStatus } from "../features/public-twitch/api";
import { accountOAuthUrl, openYoroDashboard } from "../features/yoro-account/api";
import {
  authenticatedYoroIdentity,
  useYoroAccountSession,
} from "../features/yoro-account/useYoroAccountSession";
import type { PublicTwitchAccountUser } from "./PublicTwitchAccountChip";

/* 공개 페이지 계정 로그인의 단일 원본.
 *
 * 게임 헤더마다 복사되던 세션·Twitch 상태·핸들러 배선이 configured=false 복제 결함
 * (2026-08-15)을 만들었습니다 — 로그인 동작 수정은 이 파일 한 곳에서만 합니다.
 * 페이지 결합 동작이 있는 헤더(팰월드·LoL 의 뷰어 Twitch 연동, Bot 의 추적 플로)는
 * 반환값을 부분 오버라이드해 사용할 수 있습니다. */

export type PublicAccountLocale = "ko" | "ja" | "en";

const accountKo = {
  login: "로그인",
  loginMenu: "로그인 방법 선택",
  loginTitle: "YORO 계정으로 로그인",
  logout: "로그아웃",
  menu: "계정 메뉴",
  section: "계정",
  dashboard: "내 대시보드",
  discordLogin: "Discord로 로그인",
  twitchLogin: "Twitch로 로그인",
  twitchLoading: "로그인 확인 중…",
  twitchUnavailable: "Twitch 로그인은 현재 사용할 수 없습니다.",
} as const;

const accountJa: Record<keyof typeof accountKo, string> = {
  login: "ログイン",
  loginMenu: "ログイン方法を選択",
  loginTitle: "YORO アカウントでログイン",
  logout: "ログアウト",
  menu: "アカウントメニュー",
  section: "アカウント",
  dashboard: "マイダッシュボード",
  discordLogin: "Discord でログイン",
  twitchLogin: "Twitch でログイン",
  twitchLoading: "ログイン確認中…",
  twitchUnavailable: "Twitch ログインは現在利用できません。",
};

const accountEn: Record<keyof typeof accountKo, string> = {
  login: "Log in",
  loginMenu: "Choose a login method",
  loginTitle: "Log in with your YORO account",
  logout: "Log out",
  menu: "Account menu",
  section: "Account",
  dashboard: "My dashboard",
  discordLogin: "Log in with Discord",
  twitchLogin: "Log in with Twitch",
  twitchLoading: "Checking login…",
  twitchUnavailable: "Twitch login is currently unavailable.",
};

export const publicAccountI18n = { ko: accountKo, ja: accountJa, en: accountEn } as const;

/* 페이지가 소유한 뷰어 Twitch 세션(팔로우 채널·참가형과 공유)을 계정 UI 에 합성하는
   옵션 — 팰월드·LoL 처럼 계정 로그인과 뷰어 세션이 공존하는 화면이 사용합니다.
   합성 규칙: connected = 계정 ∨ 뷰어, accountUser = 계정 우선(트위치 계정이면
   뷰어 정보로 보강) → 뷰어 폴백, logout = 계정 로그아웃 후 뷰어 해제. */
export type PublicViewerTwitchLink = {
  connected: boolean;
  user?: { login: string; displayName: string; profileImageUrl?: string };
  onDisconnect?: () => void;
};

export function usePublicAccountLogin(options?: {
  viewerTwitch?: PublicViewerTwitchLink;
  /* GA 이벤트의 link_context 오버라이드 — Bot 처럼 화면별 추적 구분이 필요한 곳만 지정. */
  tracking?: { linkContext?: string };
}) {
  const viewerTwitch = options?.viewerTwitch;
  const linkContext = options?.tracking?.linkContext ?? "account_login";
  const yoroAccount = useYoroAccountSession();
  const yoroIdentity = authenticatedYoroIdentity(yoroAccount.session);
  const yoroConnected = yoroAccount.session?.authenticated === true;
  const accountUser: PublicTwitchAccountUser | undefined = yoroIdentity
    ? {
      displayName: yoroIdentity.displayName,
      provider: yoroIdentity.provider,
      linkedProviders: yoroAccount.session?.authenticated
        ? yoroAccount.session.identities.map((identity) => identity.provider)
        : [yoroIdentity.provider],
      ...(yoroIdentity.avatarUrl ? { profileImageUrl: yoroIdentity.avatarUrl } : {}),
      ...(yoroIdentity.provider === "twitch" && viewerTwitch?.user
        ? {
          login: viewerTwitch.user.login,
          ...(yoroIdentity.avatarUrl
            ? {}
            : viewerTwitch.user.profileImageUrl
              ? { profileImageUrl: viewerTwitch.user.profileImageUrl }
              : {}),
        }
        : {}),
    }
    : viewerTwitch?.user
      ? { ...viewerTwitch.user, linkedProviders: ["twitch"] }
      : undefined;

  /* Twitch 공개 로그인 가능 여부 — 캐시 공유 요청이라 실제 호출은 페이지당 1회.
     실패 시 비활성 유지(동작하지 않는 버튼을 활성처럼 보이지 않게). */
  const [twitchConfigured, setTwitchConfigured] = useState(
    () => peekPublicTwitchStatus()?.configured ?? false,
  );
  useEffect(() => {
    const controller = new AbortController();
    void getPublicTwitchStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) setTwitchConfigured(status.configured);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const loginWithDiscord = () => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    trackGoogleAnalyticsEvent("discord_click", { link_context: linkContext });
    window.location.assign(accountOAuthUrl("discord", "login", returnPath));
  };
  const loginWithTwitch = () => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    trackGoogleAnalyticsEvent("twitch_click", { link_context: linkContext });
    window.location.assign(accountOAuthUrl("twitch", "login", returnPath));
  };
  const logout = () => {
    void (async () => {
      try {
        if (yoroConnected) await yoroAccount.logout();
        if (viewerTwitch?.connected) viewerTwitch.onDisconnect?.();
      } catch {
        /* 로그아웃 실패 시 연결 표시를 유지해 다시 시도할 수 있게 합니다. */
      }
    })();
  };

  return {
    accountUser,
    /* 뷰어 세션이 있으면 칩의 connected 는 두 세션의 합성입니다. */
    accountConnected: yoroConnected || viewerTwitch?.connected === true,
    loginWithDiscord,
    loginWithTwitch,
    logout,
    openDashboard: openYoroDashboard,
    twitchConfigured,
    yoroConnected,
  };
}

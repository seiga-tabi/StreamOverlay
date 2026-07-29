import { useEffect, useState } from "react";
import { DiscordSymbolIcon } from "../../shared/DiscordSymbolIcon";
import { detectDashboardLocale, type DashboardLocale } from "../../i18n";
import { accountOAuthUrl, getAccountSession } from "./api";

const text = {
  ko: {
    eyebrow: "YORO ACCOUNT",
    title: "YORO.gg 로그인",
    description: "별도 비밀번호 없이 Discord 또는 Twitch 계정으로 안전하게 로그인합니다.",
    discord: "Discord로 계속하기",
    discordDescription: "YORO Bot, Organization과 게임 서버를 관리합니다.",
    twitch: "Twitch로 계속하기",
    twitchDescription: "방송·참여 기능에 사용할 Twitch identity를 연결합니다.",
    account: "연결된 계정 관리",
    back: "YORO.gg로 돌아가기",
    error: "로그인을 완료하지 못했습니다. 다시 시도해 주세요.",
    checking: "로그인 상태를 확인하고 있습니다.",
    language: "日本語"
  },
  ja: {
    eyebrow: "YORO ACCOUNT",
    title: "YORO.gg ログイン",
    description: "専用パスワードを作らず、Discord または Twitch アカウントで安全にログインします。",
    discord: "Discord で続行",
    discordDescription: "YORO Bot、Organization、ゲームサーバーを管理します。",
    twitch: "Twitch で続行",
    twitchDescription: "配信・参加機能で使用する Twitch identity を連携します。",
    account: "連携アカウントを管理",
    back: "YORO.gg に戻る",
    error: "ログインを完了できませんでした。もう一度お試しください。",
    checking: "ログイン状態を確認しています。",
    language: "한국어"
  }
} as const;

function requestedReturnPath(): string {
  const value = new URLSearchParams(window.location.search).get("return_to");
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/account/connections";
}

export function YoroLoginPage() {
  const [locale, setLocale] = useState<DashboardLocale>(() => detectDashboardLocale());
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const copy = text[locale];
  const hasError = new URLSearchParams(window.location.search).get("account") === "oauth_failed";

  useEffect(() => {
    const controller = new AbortController();
    void getAccountSession(controller.signal)
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
    return () => controller.abort();
  }, []);

  return (
    <main className="yoro-account-page">
      <a className="yoro-account-brand" href="/bot" aria-label="YORO.gg">YORO.gg</a>
      <section className="yoro-account-panel" aria-busy={checking}>
        <div className="yoro-account-panel__header">
          <span>{copy.eyebrow}</span>
          <h1 data-ko={text.ko.title} data-ja={text.ja.title}>{copy.title}</h1>
          <p data-ko={text.ko.description} data-ja={text.ja.description}>{copy.description}</p>
        </div>
        {checking ? <p role="status">{copy.checking}</p> : null}
        {hasError ? <p className="yoro-account-error" role="alert">{copy.error}</p> : null}
        {!checking && authenticated ? (
          <a className="yoro-account-primary-action" href="/account/connections">
            {copy.account}
          </a>
        ) : null}
        {!checking && !authenticated ? (
          <div className="yoro-login-options">
            <a
              className="yoro-login-option is-discord"
              href={accountOAuthUrl("discord", "login", requestedReturnPath())}
            >
              <span className="yoro-login-option__icon"><DiscordSymbolIcon /></span>
              <span><strong>{copy.discord}</strong><small>{copy.discordDescription}</small></span>
            </a>
            <a
              className="yoro-login-option is-twitch"
              href={accountOAuthUrl("twitch", "login", requestedReturnPath())}
            >
              <span className="yoro-login-option__icon" aria-hidden="true">T</span>
              <span><strong>{copy.twitch}</strong><small>{copy.twitchDescription}</small></span>
            </a>
          </div>
        ) : null}
        <div className="yoro-account-links">
          <a href="/">{copy.back}</a>
          <button type="button" onClick={() => setLocale(locale === "ko" ? "ja" : "ko")}>
            {copy.language}
          </button>
        </div>
      </section>
    </main>
  );
}

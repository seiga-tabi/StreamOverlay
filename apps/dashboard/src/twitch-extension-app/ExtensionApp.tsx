import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExtensionOverlayCollapsed,
  ExtensionViewerPanel,
  type ExtensionViewerData,
} from "../features/twitch-extension/ExtensionViewer";
import { extensionViewerI18n, type ExtensionLocale } from "../features/twitch-extension/extension-i18n";
import { cancelParticipation, EbsError, fetchViewer, joinParticipation } from "./ebs";
import {
  readStoredExtensionLocale,
  resolveExtensionLocale,
  shouldAutoExpand,
  shouldHideExtension,
  storeExtensionLocale,
  viewerDataFrom,
  type EbsViewerResponse,
} from "./logic";

const POLL_INTERVAL_MS = 15_000;

type TwitchAuth = { token: string; channelId: string };

/* Twitch Extension iframe 안에서 도는 Viewer 앱.
 *
 * - 인증: Twitch Helper 의 onAuthorized 가 단일 원본(자동 갱신 포함).
 * - 상태: EBS GET /viewer 를 15초 폴링 + 행동(참가/취소) 직후 응답으로 동기화.
 * - 신원 미공유 시 참가 버튼은 Twitch 의 requestIdShare 동의 UI 를 띄웁니다.
 * - 표시 설정·inactiveBehavior 는 스트리머가 대시보드에서 저장한 값(응답 포함)을 따릅니다.
 */
const LOCALE_NAMES: Record<ExtensionLocale, string> = { ja: "日本語", ko: "한국어" };

function LocaleSwitch({ label, locale, onLocale }: {
  label: string;
  locale: ExtensionLocale;
  onLocale: (locale: ExtensionLocale) => void;
}) {
  return (
    <div aria-label={label} className="twitch-ext-locale" role="group">
      {(Object.keys(LOCALE_NAMES) as ExtensionLocale[]).map((candidate) => (
        <button
          aria-pressed={locale === candidate}
          key={candidate}
          onClick={() => onLocale(candidate)}
          type="button"
        >
          {LOCALE_NAMES[candidate]}
        </button>
      ))}
    </div>
  );
}

export function ExtensionApp({ variant }: {
  /* component 는 Twitch 가 영상 위에 고정 박스를 주는 타입 — 컴팩트 카드를 상시 표시합니다. */
  variant: "panel" | "overlay" | "component";
}) {
  /* 언어: 시청자 선택(저장) > Twitch 언어 자동 > ja 기본. */
  const [locale, setLocale] = useState<ExtensionLocale>(() =>
    resolveExtensionLocale(window.location.search, readStoredExtensionLocale()));
  const changeLocale = useCallback((next: ExtensionLocale) => {
    setLocale(next);
    storeExtensionLocale(next);
    document.documentElement.lang = next;
  }, []);
  const authRef = useRef<TwitchAuth | null>(null);
  const [response, setResponse] = useState<EbsViewerResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [joining, setJoining] = useState(false);
  const [expanded, setExpanded] = useState(variant !== "overlay");
  const previousStatusRef = useRef<ExtensionViewerData["status"] | undefined>(undefined);

  const refresh = useCallback(async () => {
    const auth = authRef.current;
    if (!auth) return;
    try {
      const next = await fetchViewer(auth.token);
      setResponse(next);
      setFailed(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      /* 만료 토큰은 Helper 가 곧 onAuthorized 로 갱신하므로 오류 화면을 피합니다. */
      if (error instanceof EbsError && error.status === 401) return;
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    const helper = window.Twitch?.ext;
    if (!helper) {
      /* Helper 없이 열린 경우(직접 접근) — Twitch 밖에서는 동작하지 않습니다. */
      setFailed(true);
      return;
    }
    helper.onAuthorized((auth) => {
      authRef.current = { token: auth.token, channelId: auth.channelId };
      void refresh();
    });
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  /* NEXT 진입 순간에만 오버레이 자동 확장 — 시청자가 놓치면 안 되는 상태입니다. */
  useEffect(() => {
    if (!response) return;
    const nextStatus = response.viewer.status;
    if (variant === "overlay" && shouldAutoExpand(previousStatusRef.current, nextStatus)) {
      setExpanded(true);
    }
    previousStatusRef.current = nextStatus;
  }, [response, variant]);

  const join = useCallback(async () => {
    const auth = authRef.current;
    if (!auth || joining) return;
    if (response && !response.identityLinked) {
      /* Twitch 의 신원 공유 동의 UI — 동의하면 onAuthorized 가 새 토큰으로 다시 옵니다. */
      window.Twitch?.ext?.actions?.requestIdShare();
      return;
    }
    setJoining(true);
    try {
      setResponse(await joinParticipation(auth.token));
      setFailed(false);
    } catch (error) {
      /* 409(닫힘·만원·재참여 불가)는 최신 상태로 다시 그리는 것이 정답입니다. */
      if (error instanceof EbsError && error.status === 409) await refresh();
      else if (error instanceof EbsError && error.code === "IDENTITY_REQUIRED") {
        window.Twitch?.ext?.actions?.requestIdShare();
      } else setFailed(true);
    } finally {
      setJoining(false);
    }
  }, [joining, refresh, response]);

  const cancel = useCallback(async () => {
    const auth = authRef.current;
    if (!auth) return;
    try {
      setResponse(await cancelParticipation(auth.token));
      setFailed(false);
    } catch (error) {
      if (error instanceof EbsError && (error.status === 409 || error.status === 404)) await refresh();
      else setFailed(true);
    }
  }, [refresh]);

  const retry = useCallback(() => {
    setFailed(false);
    void refresh();
  }, [refresh]);

  const data: ExtensionViewerData = failed
    ? { status: "error" }
    : response
      ? viewerDataFrom(response, joining)
      : { status: "loading" };

  /* 모집 없음 + 숨기기 설정 — 아무것도 그리지 않습니다(패널·오버레이 공통). */
  if (!failed && response && shouldHideExtension(response)) return null;

  const localeSwitch = (
    <LocaleSwitch
      label={extensionViewerI18n[locale].localeSwitchLabel}
      locale={locale}
      onLocale={changeLocale}
    />
  );

  if (variant === "overlay" && !expanded) {
    return (
      <div className="twitch-ext-overlay-root">
        <span className="twitch-ext-overlay-widget">
          <ExtensionOverlayCollapsed data={data} locale={locale} onExpand={() => setExpanded(true)} />
        </span>
      </div>
    );
  }

  const panel = (
    <ExtensionViewerPanel
      data={data}
      display={response?.settings.display}
      locale={locale}
      onCancel={() => void cancel()}
      onJoin={() => void join()}
      onRetry={retry}
      variant={variant === "panel" ? "panel" : "overlay"}
      {...(variant === "overlay" ? { onClose: () => setExpanded(false) } : {})}
    />
  );

  if (variant === "overlay") {
    return (
      <div className="twitch-ext-overlay-root">
        <span className="twitch-ext-overlay-widget">{panel}{localeSwitch}</span>
      </div>
    );
  }
  if (variant === "component") return <div className="twitch-ext-component-root">{panel}{localeSwitch}</div>;
  return <div className="twitch-ext-panel-root">{panel}{localeSwitch}</div>;
}

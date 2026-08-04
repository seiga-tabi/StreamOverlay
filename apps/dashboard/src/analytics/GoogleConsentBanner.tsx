import { useEffect, useState } from "react";
import {
  GOOGLE_CONSENT_CHANGE_EVENT,
  isGoogleAnalyticsPublicPath,
  readGoogleConsentChoice,
  setGoogleConsentChoice,
  type GoogleConsentChoice
} from "./google-analytics";

type ConsentCopy = {
  accept: string;
  description: string;
  label: string;
  reject: string;
  title: string;
};

const COPY: Record<"ko" | "ja", ConsentCopy> = {
  ko: {
    accept: "모두 허용",
    description: "YORO.gg는 서비스 이용 통계와 광고 제공을 위해 Google Analytics 및 AdSense를 사용합니다. 허용하기 전에는 관련 저장 기능을 사용하지 않습니다.",
    label: "분석 및 광고 쿠키 설정",
    reject: "모두 거부",
    title: "분석 및 광고 쿠키 설정"
  },
  ja: {
    accept: "すべて許可",
    description: "YORO.gg は利用状況の分析と広告配信のために Google Analytics と AdSense を使用します。許可するまでは関連する保存機能を使用しません。",
    label: "分析・広告Cookie設定",
    reject: "すべて拒否",
    title: "分析・広告Cookie設定"
  }
};

function currentLocale(): "ko" | "ja" {
  if (typeof document === "undefined") return "ko";
  if (typeof window !== "undefined" && /^\/ja(?:\/|$)/u.test(window.location.pathname)) return "ja";
  if (typeof window !== "undefined" && /^\/ko(?:\/|$)/u.test(window.location.pathname)) return "ko";
  return document.documentElement.lang.toLowerCase().startsWith("ja") ? "ja" : "ko";
}

function shouldShowConsentBanner(): boolean {
  if (typeof window === "undefined") return false;
  return isGoogleAnalyticsPublicPath(window.location.pathname)
    && readGoogleConsentChoice() === undefined;
}

export function GoogleConsentBanner() {
  const [visible, setVisible] = useState(() => shouldShowConsentBanner());
  const [locale, setLocale] = useState<"ko" | "ja">(() => currentLocale());
  const text = COPY[locale];

  useEffect(() => {
    const sync = () => {
      setLocale(currentLocale());
      setVisible(shouldShowConsentBanner());
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("publicroutechange", sync);
    window.addEventListener("palworldroutechange", sync);
    window.addEventListener(GOOGLE_CONSENT_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("publicroutechange", sync);
      window.removeEventListener("palworldroutechange", sync);
      window.removeEventListener(GOOGLE_CONSENT_CHANGE_EVENT, sync);
    };
  }, []);

  if (!visible) return null;

  const choose = (choice: GoogleConsentChoice) => {
    setGoogleConsentChoice(choice);
    setVisible(false);
  };

  return (
    <section
      aria-label={text.label}
      className="google-consent-banner"
      data-ko="분석 및 광고 쿠키 설정"
      data-ja="分析・広告Cookie設定"
      role="region"
    >
      <div className="google-consent-banner__copy">
        <strong data-ko="분석 및 광고 쿠키 설정" data-ja="分析・広告Cookie設定">
          {text.title}
        </strong>
        <p
          data-ko="YORO.gg는 서비스 이용 통계와 광고 제공을 위해 Google Analytics 및 AdSense를 사용합니다. 허용하기 전에는 관련 저장 기능을 사용하지 않습니다."
          data-ja="YORO.gg は利用状況の分析と広告配信のために Google Analytics と AdSense を使用します。許可するまでは関連する保存機能を使用しません。"
        >
          {text.description}
        </p>
      </div>
      <div className="google-consent-banner__actions">
        <button
          className="google-consent-banner__button google-consent-banner__button--secondary"
          data-ko="모두 거부"
          data-ja="すべて拒否"
          onClick={() => choose("denied")}
          type="button"
        >
          {text.reject}
        </button>
        <button
          className="google-consent-banner__button google-consent-banner__button--primary"
          data-ko="모두 허용"
          data-ja="すべて許可"
          onClick={() => choose("granted")}
          type="button"
        >
          {text.accept}
        </button>
      </div>
    </section>
  );
}

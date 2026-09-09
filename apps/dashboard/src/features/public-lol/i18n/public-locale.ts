import type { PublicLocale } from "./public-lol-i18n";

// 번역 테이블 없이 공개 셸에서도 사용하는 로케일 상태와 유틸리티입니다.
export let activePublicLocale: PublicLocale = "ko";

/** 아직 en 콘텐츠가 없는 섹션(ko·ja 이중 테이블)용 축소 — en 은 ko 로 폴백합니다.
 * 팰월드 우선 단계(2026-08-18)의 의도된 동작이며, 해당 섹션을 영어로 열 때
 * 호출부를 실제 en 테이블로 바꾸면서 이 폴백을 제거합니다. */
export function publicContentLocale(locale: PublicLocale): "ko" | "ja" {
  return locale === "ja" ? "ja" : "ko";
}

export function setActivePublicLocale(locale: PublicLocale): void {
  activePublicLocale = locale;
}

/** Intl.* 포맷터에 넘길 BCP-47 로케일 — 날짜·숫자 표기가 화면 언어를 따라갑니다. */
export function publicIntlLocale(): "ko-KR" | "ja-JP" | "en-US" {
  return activePublicLocale === "ja" ? "ja-JP" : activePublicLocale === "en" ? "en-US" : "ko-KR";
}

/** 짧은 인라인 문구의 3로케일 선택 — i18n 키로 만들기엔 문맥 조립이 필요한 자리용. */
export function publicLocaleText(ko: string, ja: string, en: string): string {
  return activePublicLocale === "ja" ? ja : activePublicLocale === "en" ? en : ko;
}


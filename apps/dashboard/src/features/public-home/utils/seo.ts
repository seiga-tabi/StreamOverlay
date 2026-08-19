import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { homeI18n, type HomeLocale } from "../i18n/home-i18n";
import { lolHomeI18n } from "../i18n/lol-home-i18n";

const PUBLIC_ORIGIN = "https://yoro.gg";

/* 클라이언트 측 title·description·canonical 반영 — 미니게임(applyGamesSeo)과 같은
 * 분담입니다: 서버 렌더 메타(크롤러용)는 Codex handoff 항목이고, 여기 값과
 * 반드시 일치해야 합니다(docs/AI_HANDOFF_TEMPLATE.md 기록 참조). */
function applySeo(locale: HomeLocale, path: string, title: string, descriptionText: string): () => void {
  const canonicalUrl = new URL(localizedPublicUrl(path, locale), PUBLIC_ORIGIN).href;

  const previousTitle = document.title;
  document.title = title;

  const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
  const previousDescription = description?.content;
  if (description) description.content = descriptionText;

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const previousCanonical = canonical?.href;
  const createdCanonical = !canonical;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  const previousLang = document.documentElement.lang;
  document.documentElement.lang = locale;

  return () => {
    document.title = previousTitle;
    if (description && previousDescription !== undefined) description.content = previousDescription;
    if (canonical) {
      if (createdCanonical) canonical.remove();
      else if (previousCanonical !== undefined) canonical.href = previousCanonical;
    }
    document.documentElement.lang = previousLang;
  };
}

export function applyHomeSeo(locale: HomeLocale): () => void {
  const text = homeI18n[locale];
  return applySeo(locale, "/", text.seoTitle, text.seoDescription);
}

export function applyLolHomeSeo(locale: HomeLocale): () => void {
  const text = lolHomeI18n[locale];
  return applySeo(locale, "/lol", text.seoTitle, text.seoDescription);
}

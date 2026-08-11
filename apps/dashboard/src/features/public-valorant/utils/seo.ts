import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";
import { valorantPathForPage, type ValorantPage } from "./routes";

const PUBLIC_ORIGIN = "https://yoro.gg";

export type ValorantSeoMetadata = {
  canonicalUrl: string;
  description: string;
  title: string;
};

export function valorantSeoMetadata(page: ValorantPage, locale: ValorantLocale): ValorantSeoMetadata {
  const text = valorantI18n[locale];
  const titles: Record<ValorantPage, string> = {
    home: text.brand,
    agents: text.agents,
    weapons: text.weapons,
    maps: text.maps,
    ranked: text.ranked,
  };
  return {
    canonicalUrl: new URL(localizedPublicUrl(valorantPathForPage(page), locale), PUBLIC_ORIGIN).href,
    description: text.description,
    title: `${titles[page]} | YORO.gg`,
  };
}

/** 클라이언트 측 title·canonical 반영. 서버 라우트 메타는 Codex handoff 항목입니다. */
export function applyValorantSeo(page: ValorantPage, locale: ValorantLocale): () => void {
  const metadata = valorantSeoMetadata(page, locale);
  const previousTitle = document.title;
  document.title = metadata.title;
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const link = existing ?? document.createElement("link");
  const previousHref = link.getAttribute("href");
  if (!existing) {
    link.setAttribute("rel", "canonical");
    document.head.append(link);
  }
  link.setAttribute("href", metadata.canonicalUrl);
  return () => {
    document.title = previousTitle;
    if (!existing) link.remove();
    else if (previousHref !== null) link.setAttribute("href", previousHref);
  };
}

import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { gamesPathForPage, type GamesPage } from "./routes";

const PUBLIC_ORIGIN = "https://yoro.gg";

export type GamesSeoMetadata = {
  canonicalUrl: string;
  description: string;
  title: string;
};

export function gamesSeoMetadata(page: GamesPage, locale: GamesLocale): GamesSeoMetadata {
  const text = gamesI18n[locale];
  const titles: Record<GamesPage, string> = {
    hub: text.brand,
    reaction: text.navReaction,
  };
  return {
    canonicalUrl: new URL(localizedPublicUrl(gamesPathForPage(page), locale), PUBLIC_ORIGIN).href,
    description: text.description,
    title: `${titles[page]} | YORO.gg`,
  };
}

/** 클라이언트 측 title·canonical 반영. 서버 라우트 메타·OG 매핑은 Codex handoff 항목입니다. */
export function applyGamesSeo(page: GamesPage, locale: GamesLocale): () => void {
  const metadata = gamesSeoMetadata(page, locale);
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

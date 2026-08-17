import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { gamesPathForPage, type GamesPage } from "./routes";

const PUBLIC_ORIGIN = "https://yoro.gg";

export type GamesSeoMetadata = {
  canonicalUrl: string;
  description: string;
  title: string;
};

/* 검색 결과에 나가는 문구는 화면 라벨과 다릅니다 — 네비는 짧아야 하고(반응속도),
   제목은 구체적이어야 합니다(반응속도 테스트). 그래서 seo* 키를 따로 둡니다.
   이 값은 서버 렌더 메타(apps/server/src/routes/public-seo.ts)와 반드시 같아야
   합니다: 서버가 준 title 을 applyGamesSeo 가 덮어쓰므로, 다르면 크롤러가 받는
   값과 최종 값이 어긋납니다. */
export function gamesSeoMetadata(page: GamesPage, locale: GamesLocale): GamesSeoMetadata {
  const text = gamesI18n[locale];
  const titles: Record<GamesPage, string> = {
    hub: text.seoTitleHub,
    reaction: text.seoTitleReaction,
    ranking: `${text.seoTitleReaction} ${text.navRanking}`,
    /* 공유 페이지의 실제 크롤러 메타(기록 표시)는 서버 렌더가 담당(Codex handoff) —
       클라이언트 title 은 게임 제목으로 충분합니다. */
    share: text.seoTitleReaction,
  };
  const descriptions: Record<GamesPage, string> = {
    hub: text.seoDescriptionHub,
    reaction: text.seoDescriptionReaction,
    ranking: text.seoDescriptionReaction,
    share: text.seoDescriptionReaction,
  };
  return {
    canonicalUrl: new URL(localizedPublicUrl(gamesPathForPage(page), locale), PUBLIC_ORIGIN).href,
    description: descriptions[page],
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

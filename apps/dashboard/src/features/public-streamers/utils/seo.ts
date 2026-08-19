import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { streamersI18n, type StreamersLocale } from "../i18n/streamers-i18n";
import { streamerPostPath, streamersPathForPage, type StreamersPage } from "./routes";

const PUBLIC_ORIGIN = "https://yoro.gg";

export type StreamersSeoMetadata = {
  canonicalUrl: string;
  description: string;
  title: string;
};

/* 서버 렌더 메타(apps/server/src/routes/public-seo.ts)와 반드시 같은 문구여야
   합니다 — 서버가 준 title 을 applyStreamersSeo 가 덮어쓰므로, 다르면 크롤러가
   받는 값과 최종 값이 어긋납니다. 미니게임 선례와 같은 규칙입니다. */
export function streamersSeoMetadata(
  page: StreamersPage,
  locale: StreamersLocale,
  postTitle?: string,
  postId?: string,
): StreamersSeoMetadata {
  const text = streamersI18n[locale];
  const isCompose = page === "compose";
  /* 글 상세의 크롤러 메타(스트리머 이름·주력 게임)는 서버 렌더가 담당합니다 —
     클라이언트는 이미 받은 글 제목이 있으면 그것으로 title 만 맞춥니다. */
  const title = isCompose
    ? text.seoTitleCompose
    : postTitle
      ? `${postTitle} | ${text.seoTitleList}`
      : text.seoTitleList;
  /* canonical 은 그 화면의 주소여야 합니다. 글 상세가 목록을 가리키면 크롤러는
     모든 글을 목록의 중복으로 보고 색인에서 내립니다. */
  const path = page === "detail" && postId
    ? streamerPostPath(postId)
    : streamersPathForPage(isCompose ? "compose" : "list");
  return {
    canonicalUrl: new URL(localizedPublicUrl(path, locale), PUBLIC_ORIGIN).href,
    description: isCompose ? text.seoDescriptionCompose : text.seoDescriptionList,
    title: `${title} | YORO.gg`,
  };
}

/** 클라이언트 측 title·canonical 반영. 서버 라우트 메타·OG 매핑은 handoff 항목입니다. */
export function applyStreamersSeo(
  page: StreamersPage,
  locale: StreamersLocale,
  postTitle?: string,
  postId?: string,
): () => void {
  const metadata = streamersSeoMetadata(page, locale, postTitle, postId);
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

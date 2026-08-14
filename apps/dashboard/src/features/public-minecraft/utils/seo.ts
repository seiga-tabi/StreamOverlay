import { localizedPublicUrl } from "../../public-lol/utils/public-locale-path";
import { minecraftI18n, type MinecraftLocale } from "../i18n/minecraft-i18n";
import { minecraftPathForPage, type MinecraftPage } from "./routes";

const PUBLIC_ORIGIN = "https://yoro.gg";

export type MinecraftSeoMetadata = {
  canonicalUrl: string;
  description: string;
  title: string;
};

export function minecraftSeoMetadata(page: MinecraftPage, locale: MinecraftLocale): MinecraftSeoMetadata {
  const text = minecraftI18n[locale];
  const titles: Record<MinecraftPage, string> = {
    home: text.brand,
    recipes: text.recipes,
    items: text.items,
    enchants: text.enchants,
    library: text.library,
    patchNotes: text.patchNotes,
  };
  return {
    canonicalUrl: new URL(localizedPublicUrl(minecraftPathForPage(page), locale), PUBLIC_ORIGIN).href,
    description: text.description,
    title: `${titles[page]} | YORO.gg`,
  };
}

/** 클라이언트 측 title·canonical 반영. 서버 라우트 메타는 Codex handoff 항목입니다.
 *  page=null(404)은 홈 canonical 을 주장하지 않도록 404 타이틀 + canonical 제거로 처리합니다. */
export function applyMinecraftSeo(page: MinecraftPage | null, locale: MinecraftLocale): () => void {
  const text = minecraftI18n[locale];
  const previousTitle = document.title;
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const previousHref = existing?.getAttribute("href") ?? null;

  if (page === null) {
    document.title = `${text.notFoundTitle} | YORO.gg`;
    existing?.remove();
    return () => {
      document.title = previousTitle;
      if (existing && previousHref !== null) {
        existing.setAttribute("href", previousHref);
        document.head.append(existing);
      }
    };
  }

  const metadata = minecraftSeoMetadata(page, locale);
  document.title = metadata.title;
  const link = existing ?? document.createElement("link");
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

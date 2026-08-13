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

/** 클라이언트 측 title·canonical 반영. 서버 라우트 메타는 Codex handoff 항목입니다. */
export function applyMinecraftSeo(page: MinecraftPage, locale: MinecraftLocale): () => void {
  const metadata = minecraftSeoMetadata(page, locale);
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

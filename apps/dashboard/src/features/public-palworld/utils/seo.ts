import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { palworldPathForPage, type PalworldPage } from "./routes";

const PUBLIC_ORIGIN = "https://yoro.gg";

export type PalworldSeoMetadata = {
  canonicalUrl: string;
  description: string;
  title: string;
};

export function palworldSeoMetadata(page: PalworldPage, locale: PalworldLocale): PalworldSeoMetadata {
  const text = palworldI18n[locale];
  const route = page === "search" ? "search" : page;
  const values: Record<PalworldPage, { description: string; title: string }> = {
    home: { title: text.brand, description: text.description },
    streamers: { title: text.streamersTitle, description: text.streamersDescription },
    pals: { title: text.pals, description: text.palsDescription },
    breeding: { title: text.breeding, description: text.breedingDescription },
    items: { title: text.items, description: text.itemsDescription },
    skills: { title: text.skillsTitle, description: text.skillsDescription },
    map: { title: text.mapTitle, description: text.mapDescription },
    search: { title: text.searchResults, description: text.searchDescription },
  };
  const selected = values[route];
  return {
    canonicalUrl: new URL(palworldPathForPage(route), PUBLIC_ORIGIN).href,
    description: selected.description,
    title: `${selected.title} | YORO.gg`,
  };
}

type HeadTarget = {
  attribute: "content" | "href";
  create: () => HTMLElement;
  selector: string;
  value: string;
};

function updateHeadTarget(target: HeadTarget): () => void {
  const existing = document.head.querySelector<HTMLElement>(target.selector);
  const element = existing ?? target.create();
  const previous = element.getAttribute(target.attribute);
  if (!existing) document.head.append(element);
  element.setAttribute(target.attribute, target.value);
  return () => {
    if (!existing) {
      element.remove();
      return;
    }
    if (previous === null) element.removeAttribute(target.attribute);
    else element.setAttribute(target.attribute, previous);
  };
}

export function applyPalworldSeo(page: PalworldPage, locale: PalworldLocale): () => void {
  const metadata = palworldSeoMetadata(page, locale);
  const previousTitle = document.title;
  document.title = metadata.title;
  const targets: HeadTarget[] = [
    {
      selector: 'meta[name="description"]',
      attribute: "content",
      value: metadata.description,
      create: () => {
        const element = document.createElement("meta");
        element.setAttribute("name", "description");
        return element;
      },
    },
    {
      selector: 'link[rel="canonical"]',
      attribute: "href",
      value: metadata.canonicalUrl,
      create: () => {
        const element = document.createElement("link");
        element.setAttribute("rel", "canonical");
        return element;
      },
    },
    ...([
      ["og:title", metadata.title],
      ["og:description", metadata.description],
      ["og:url", metadata.canonicalUrl],
    ] as const).map(([property, value]): HeadTarget => ({
      selector: `meta[property="${property}"]`,
      attribute: "content",
      value,
      create: () => {
        const element = document.createElement("meta");
        element.setAttribute("property", property);
        return element;
      },
    })),
    ...([
      ["twitter:title", metadata.title],
      ["twitter:description", metadata.description],
    ] as const).map(([name, value]): HeadTarget => ({
      selector: `meta[name="${name}"]`,
      attribute: "content",
      value,
      create: () => {
        const element = document.createElement("meta");
        element.setAttribute("name", name);
        return element;
      },
    })),
  ];
  const restorers = targets.map(updateHeadTarget);
  return () => {
    document.title = previousTitle;
    for (const restore of restorers.reverse()) restore();
  };
}

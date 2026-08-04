const JAPANESE_FONT_STYLESHEET_ID = "yoro-noto-sans-jp";
const JAPANESE_FONT_STYLESHEET_PATH = "fonts/noto-sans-jp/wght.css";

export function japaneseFontStylesheetHref(baseUrl = import.meta.env.BASE_URL): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${JAPANESE_FONT_STYLESHEET_PATH}`;
}

export function initializeJapaneseFont(): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => undefined;
  }

  const root = document.documentElement;
  const loadWhenNeeded = () => {
    if (!root.lang.toLowerCase().startsWith("ja")) return;
    if (document.getElementById(JAPANESE_FONT_STYLESHEET_ID) !== null) return;

    const stylesheet = document.createElement("link");
    stylesheet.id = JAPANESE_FONT_STYLESHEET_ID;
    stylesheet.rel = "stylesheet";
    stylesheet.href = japaneseFontStylesheetHref();
    document.head.append(stylesheet);
  };

  loadWhenNeeded();
  const observer = new MutationObserver(loadWhenNeeded);
  observer.observe(root, { attributes: true, attributeFilter: ["lang"] });
  return () => observer.disconnect();
}

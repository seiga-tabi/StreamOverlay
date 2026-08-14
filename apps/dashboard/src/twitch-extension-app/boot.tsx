import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionApp } from "./ExtensionApp";
import { extensionLocaleFromSearch } from "./logic";
import "./extension-app.css";

/* panel.html / video_overlay.html 공용 부트스트랩. */
export function bootTwitchExtension(variant: "panel" | "overlay"): void {
  const container = document.getElementById("root");
  if (!container) return;
  const locale = extensionLocaleFromSearch(window.location.search);
  document.documentElement.lang = locale;
  createRoot(container).render(
    <StrictMode>
      <ExtensionApp locale={locale} variant={variant} />
    </StrictMode>,
  );
}

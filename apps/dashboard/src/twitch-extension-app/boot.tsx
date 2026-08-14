import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ExtensionApp } from "./ExtensionApp";
import { readStoredExtensionLocale, resolveExtensionLocale } from "./logic";
import "./extension-app.css";

/* panel.html / video_overlay.html 공용 부트스트랩. */
export function bootTwitchExtension(variant: "panel" | "overlay" | "component"): void {
  const container = document.getElementById("root");
  if (!container) return;
  document.documentElement.lang = resolveExtensionLocale(window.location.search, readStoredExtensionLocale());
  createRoot(container).render(
    <StrictMode>
      <ExtensionApp variant={variant} />
    </StrictMode>,
  );
}

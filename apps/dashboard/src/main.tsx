import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GoogleConsentBanner } from "./analytics/GoogleConsentBanner";
import { initializeGoogleAnalytics } from "./analytics/google-analytics";
import { initializeJapaneseFont } from "./fonts/japanese-font";
import "./styles/index.css";

initializeJapaneseFont();
initializeGoogleAnalytics({ debugMode: import.meta.env.DEV });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <GoogleConsentBanner />
  </React.StrictMode>
);

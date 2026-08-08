import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GoogleConsentBanner } from "./analytics/GoogleConsentBanner";
import { initializeGoogleAnalytics } from "./analytics/google-analytics";
import { initializeJapaneseFont } from "./fonts/japanese-font";
import "./styles/index.css";

initializeJapaneseFont();
initializeGoogleAnalytics({ debugMode: import.meta.env.DEV });

const container = document.getElementById("root")!;
// 서버는 crawler와 JS 실행 전 사용자를 위해 `#root` 안에 SEO fallback 본문을 넣습니다.
// createRoot의 container 정리 동작에 의존하지 않고 직접 제거해, React 구현이 바뀌어도
// fallback이 실제 화면 위에 남지 않도록 보장합니다.
container.querySelector("[data-seo-fallback]")?.remove();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
    <GoogleConsentBanner />
  </React.StrictMode>
);

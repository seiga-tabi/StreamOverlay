import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeGoogleAnalytics } from "./analytics/google-analytics";
import "./styles/index.css";

if (import.meta.env.PROD) {
  initializeGoogleAnalytics();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

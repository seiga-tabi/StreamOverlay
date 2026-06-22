type StreamOpsRuntimeConfig = {
  apiBase?: string;
  wsBase?: string;
  overlayBase?: string;
  dashboardAuthRequired?: boolean;
};

declare global {
  interface Window {
    __STREAMOPS_CONFIG__?: StreamOpsRuntimeConfig;
  }
}

export function runtimeConfig(): StreamOpsRuntimeConfig {
  return window.__STREAMOPS_CONFIG__ ?? {};
}

let dashboardCsrfToken = "";

export function getDashboardCsrfToken(): string {
  return dashboardCsrfToken;
}

export function setDashboardCsrfToken(token: string): void {
  dashboardCsrfToken = token;
}

export function clearDashboardCsrfToken(): void {
  dashboardCsrfToken = "";
}

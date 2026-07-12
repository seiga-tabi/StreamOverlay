export type PublicLegalRuntimeConfig = {
  operatorName: string;
  contactAddress: string;
  privacyOfficerName: string;
  contactEmail: string;
  contactPhone: string;
  effectiveDate: string;
  minimumAge: number;
  supportMailboxRetentionDays: number;
  governingLawKo: string;
  governingLawJa: string;
  disputeVenueKo: string;
  disputeVenueJa: string;
  processorsKo: string;
  processorsJa: string;
  crossBorderTransferKo: string;
  crossBorderTransferJa: string;
  configured: boolean;
};

type StreamOpsRuntimeConfig = {
  apiBase?: string;
  wsBase?: string;
  overlayBase?: string;
  dashboardAuthRequired?: boolean;
  legal?: Partial<PublicLegalRuntimeConfig>;
};

declare global {
  interface Window {
    __STREAMOPS_CONFIG__?: StreamOpsRuntimeConfig;
  }
}

export function runtimeConfig(): StreamOpsRuntimeConfig {
  return window.__STREAMOPS_CONFIG__ ?? {};
}

const EMPTY_PUBLIC_LEGAL_CONFIG: PublicLegalRuntimeConfig = {
  operatorName: "",
  contactAddress: "",
  privacyOfficerName: "",
  contactEmail: "support@yoro.gg",
  contactPhone: "",
  effectiveDate: "",
  minimumAge: 14,
  supportMailboxRetentionDays: 90,
  governingLawKo: "",
  governingLawJa: "",
  disputeVenueKo: "",
  disputeVenueJa: "",
  processorsKo: "",
  processorsJa: "",
  crossBorderTransferKo: "",
  crossBorderTransferJa: "",
  configured: false
};

export function publicLegalRuntimeConfig(): PublicLegalRuntimeConfig {
  const legal = runtimeConfig().legal;
  return {
    ...EMPTY_PUBLIC_LEGAL_CONFIG,
    ...legal,
    minimumAge: Number.isFinite(legal?.minimumAge) ? Math.max(14, Math.trunc(legal!.minimumAge!)) : 14,
    supportMailboxRetentionDays: Number.isFinite(legal?.supportMailboxRetentionDays)
      ? Math.max(1, Math.trunc(legal!.supportMailboxRetentionDays!))
      : 90,
    configured: legal?.configured === true
  };
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

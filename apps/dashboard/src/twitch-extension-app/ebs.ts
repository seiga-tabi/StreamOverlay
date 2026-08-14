import type { EbsViewerResponse } from "./logic";

/* EBS origin 은 빌드 시 고정됩니다 — Twitch CDN 에서 서빙되는 정적 번들이라
   런타임 config 주입 경로가 없습니다. */
const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const EBS_ORIGIN = metaEnv?.VITE_TWITCH_EXT_EBS_ORIGIN?.replace(/\/$/u, "") || "https://yoro.gg";

export class EbsError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "EbsError";
    this.status = status;
    this.code = code;
  }
}

async function ebsRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${EBS_ORIGIN}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new EbsError(0, "NETWORK_ERROR", "network");
  }
  let payload: unknown = undefined;
  try {
    payload = await response.json();
  } catch {
    /* 오류 응답에 본문이 없을 수 있습니다. */
  }
  if (!response.ok) {
    const body = payload as { code?: string; error?: string } | undefined;
    throw new EbsError(response.status, body?.code ?? "HTTP_ERROR", body?.error ?? `HTTP ${response.status}`);
  }
  return payload as T;
}

export function fetchViewer(token: string, signal?: AbortSignal): Promise<EbsViewerResponse> {
  return ebsRequest("/api/twitch-extension/viewer", token, { signal });
}

export async function joinParticipation(token: string): Promise<EbsViewerResponse> {
  const result = await ebsRequest<{ viewer: EbsViewerResponse }>(
    "/api/twitch-extension/join",
    token,
    { method: "POST", body: "{}" },
  );
  return result.viewer;
}

export async function cancelParticipation(token: string): Promise<EbsViewerResponse> {
  const result = await ebsRequest<{ viewer: EbsViewerResponse }>(
    "/api/twitch-extension/cancel",
    token,
    { method: "POST", body: "{}" },
  );
  return result.viewer;
}

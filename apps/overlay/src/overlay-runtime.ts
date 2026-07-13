import { normalizeOverlayChannel, type OverlayChannel } from "@streamops/shared";

export function overlayMode(search: string): OverlayChannel {
  return normalizeOverlayChannel(new URLSearchParams(search).get("mode"));
}

export function overlayMockMode(search: string, envMock = false): boolean {
  const value = new URLSearchParams(search).get("mock");
  return value === "1" || value === "true" || envMock;
}

export function overlayPreviewMode(search: string): boolean {
  const value = new URLSearchParams(search).get("preview");
  return value === "1" || value === "true";
}

export function shouldShowOverlay(mode: OverlayChannel, target: OverlayChannel): boolean {
  return mode === "all" || mode === target;
}

export function overlayDuration(message: { durationMs?: number } | undefined, fallback: number): number {
  return message?.durationMs ?? fallback;
}

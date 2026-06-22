import { redactSensitiveString } from "@streamops/shared";

const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;
const HTML_BRACKETS = /[<>]/g;

export function sanitizeOverlayText(input: unknown, maxLength: number): string {
  return redactSensitiveString(String(input ?? ""))
    .replace(CONTROL_CHARS, " ")
    .replace(HTML_BRACKETS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeDisplayName(input: unknown, fallback = "viewer"): string {
  return sanitizeOverlayText(input, 40) || fallback;
}

export function sanitizeViewerInput(input: unknown, maxLength = 300): string {
  return sanitizeOverlayText(input, maxLength);
}

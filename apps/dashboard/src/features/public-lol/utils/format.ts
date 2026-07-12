import type { PublicLolProfile } from "../types/public-lol";

export function formatNumber(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("ko-KR").format(value);
}

export function formatDecimal(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(digits);
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return "-";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.max(0, Math.floor(seconds % 60));
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function refreshRemainingMs(profile: PublicLolProfile | null, now: number): number {
  const availableAt = profile?.refreshAvailableAt ? Date.parse(profile.refreshAvailableAt) : 0;
  if (!Number.isFinite(availableAt)) return 0;
  return Math.max(0, availableAt - now);
}

export function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPercent(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

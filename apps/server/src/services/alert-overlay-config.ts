import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config.js";

export const ALERT_OVERLAY_KEYS = ["follow", "cheer", "subscription", "subscriptionMessage", "raid"] as const;
export type AlertOverlayKey = (typeof ALERT_OVERLAY_KEYS)[number];

export type AlertOverlayPreset = {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  message?: string;
  variant?: "info" | "success" | "warning" | "danger";
  durationMs?: number;
  mediaUrl?: string;
  mediaAlt?: string;
  soundUrl?: string;
  soundVolume?: number;
  speechEnabled?: boolean;
  speechText?: string;
  speechLanguage?: "ja-JP" | "ko-KR";
  speechRate?: number;
  speechPitch?: number;
  speechVolume?: number;
};

export type AlertOverlayConfig = {
  defaults?: AlertOverlayPreset;
} & Partial<Record<AlertOverlayKey, AlertOverlayPreset>>;

export type AlertGifAsset = {
  fileName: string;
  url: string;
  size: number;
  updatedAt: string;
};

export function alertAssetRoot(): string {
  return path.resolve(appConfig.paths.state, "alert-assets");
}

function baseConfigPath(): string {
  return path.join(appConfig.paths.config, "alert-overlays.json");
}

function runtimeConfigPath(): string {
  return path.resolve(appConfig.paths.state, "alert-overlays.runtime.json");
}

function readJsonFile<T>(filePath: string): T | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function mergeConfig(base: AlertOverlayConfig, runtime: AlertOverlayConfig): AlertOverlayConfig {
  const merged: AlertOverlayConfig = { ...base };
  if (base.defaults || runtime.defaults) merged.defaults = { ...base.defaults, ...runtime.defaults };
  for (const key of ALERT_OVERLAY_KEYS) {
    if (base[key] || runtime[key]) merged[key] = { ...base[key], ...runtime[key] };
  }
  return merged;
}

export function loadAlertOverlayConfig(): AlertOverlayConfig {
  const base = readJsonFile<AlertOverlayConfig>(baseConfigPath()) ?? {};
  const runtime = readJsonFile<AlertOverlayConfig>(runtimeConfigPath()) ?? {};
  return mergeConfig(base, runtime);
}

export async function saveAlertOverlayPreset(key: AlertOverlayKey, patch: AlertOverlayPreset): Promise<AlertOverlayConfig> {
  const current = readJsonFile<AlertOverlayConfig>(runtimeConfigPath()) ?? {};
  const next: AlertOverlayConfig = {
    ...current,
    [key]: {
      ...current[key],
      ...patch,
      enabled: patch.enabled ?? current[key]?.enabled ?? true
    }
  };
  await fsp.mkdir(appConfig.paths.state, { recursive: true });
  const target = runtimeConfigPath();
  const temp = `${target}.tmp`;
  await fsp.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(temp, target);
  return loadAlertOverlayConfig();
}

export function isAlertOverlayKey(value: string): value is AlertOverlayKey {
  return (ALERT_OVERLAY_KEYS as readonly string[]).includes(value);
}

export function isSafeAlertMediaUrl(value: string): boolean {
  if (value === "") return true;
  if (!value.startsWith("/alerts/")) return false;
  try {
    const decoded = decodeURIComponent(value);
    return !decoded.includes("..") && !decoded.includes("\\") && !decoded.includes("\0");
  } catch {
    return false;
  }
}

export async function listAlertGifAssets(): Promise<AlertGifAsset[]> {
  const root = alertAssetRoot();
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    const assets = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".gif"))
      .map(async (entry) => {
        const filePath = path.join(root, entry.name);
        const stat = await fsp.stat(filePath);
        return {
          fileName: entry.name,
          url: `/alerts/uploads/${entry.name}`,
          size: stat.size,
          updatedAt: stat.mtime.toISOString()
        };
      }));
    return assets.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

import "dotenv/config";
import fs from "node:fs";
import os from "node:os";

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function defaultBridgeName(): string {
  const hostName = os.hostname()
    .trim()
    .replace(/[^A-Za-z0-9._-]+/gu, "-")
    .slice(0, 64);
  return hostName || "main-streaming-pc";
}

function envOrFile(name: string, fallback = ""): string {
  const direct = process.env[name];
  const filePath = process.env[`${name}_FILE`];
  if (direct && filePath) {
    throw new Error(`${name}와 ${name}_FILE은 동시에 설정할 수 없습니다.`);
  }
  if (!filePath) return direct ?? fallback;
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    throw new Error(`${name}_FILE을 읽을 수 없습니다.`);
  }
}

export const bridgeConfig = {
  serverWsUrl: env("SERVER_WS_URL", "ws://localhost:3000/bridge"),
  bridgeName: optionalEnv("BRIDGE_NAME") ?? defaultBridgeName(),
  streamerId: optionalEnv("BRIDGE_STREAMER_ID"),
  sharedSecret: envOrFile("BRIDGE_SHARED_SECRET", "dev-secret-change-me"),
  obsUrl: env("OBS_WEBSOCKET_URL", "ws://127.0.0.1:4455"),
  obsPassword: env("OBS_WEBSOCKET_PASSWORD")
};

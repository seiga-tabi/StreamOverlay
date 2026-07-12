import fs from "node:fs";
import path from "node:path";
import { nowIso, redactSensitiveValue } from "@streamops/shared";

export class JsonlLogger {
  private readonly maxBytes: number;
  private readonly maxFiles: number;

  constructor(private readonly logsDir: string, options: { maxBytes?: number; maxFiles?: number } = {}) {
    this.maxBytes = Math.max(1, options.maxBytes ?? 10 * 1024 * 1024);
    this.maxFiles = Math.max(1, options.maxFiles ?? 5);
    fs.mkdirSync(logsDir, { recursive: true });
  }

  private rotate(filePath: string, incomingBytes: number): void {
    const currentBytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    if (currentBytes === 0 || currentBytes + incomingBytes <= this.maxBytes) return;
    for (let index = this.maxFiles; index >= 1; index -= 1) {
      const source = index === 1 ? filePath : `${filePath}.${index - 1}`;
      const destination = `${filePath}.${index}`;
      if (!fs.existsSync(source)) continue;
      if (fs.existsSync(destination)) fs.rmSync(destination, { force: true });
      fs.renameSync(source, destination);
    }
  }

  append(fileName: string, payload: Record<string, unknown>): void {
    const filePath = path.join(this.logsDir, fileName);
    const safePayload = redactSensitiveValue(payload) as Record<string, unknown>;
    const line = `${JSON.stringify({ ts: nowIso(), ...safePayload })}\n`;
    try {
      this.rotate(filePath, Buffer.byteLength(line));
      fs.appendFileSync(filePath, line, { encoding: "utf8", mode: 0o600 });
      fs.chmodSync(filePath, 0o600);
    } catch {
      console.error(`[logger] ${fileName} 기록에 실패했습니다.`);
    }
  }

  event(payload: Record<string, unknown>): void {
    this.append("events.jsonl", payload);
  }

  action(payload: Record<string, unknown>): void {
    this.append("actions.jsonl", payload);
  }

  error(payload: Record<string, unknown>): void {
    this.append("errors.jsonl", payload);
  }

  question(payload: Record<string, unknown>): void {
    this.append("questions.jsonl", payload);
  }

  highlight(payload: Record<string, unknown>): void {
    this.append("highlights.jsonl", payload);
  }

  translation(payload: Record<string, unknown>): void {
    this.append("translations.jsonl", payload);
  }
}

import fs from "node:fs";
import path from "node:path";
import { nowIso, redactSensitiveValue } from "@streamops/shared";

export class JsonlLogger {
  constructor(private readonly logsDir: string) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  append(fileName: string, payload: Record<string, unknown>): void {
    const filePath = path.join(this.logsDir, fileName);
    const safePayload = redactSensitiveValue(payload) as Record<string, unknown>;
    const line = JSON.stringify({ ts: nowIso(), ...safePayload });
    fs.appendFileSync(filePath, `${line}\n`, "utf8");
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

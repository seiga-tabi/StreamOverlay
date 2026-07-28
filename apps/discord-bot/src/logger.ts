import crypto from "node:crypto";

function safeHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function auditEvent(
  type: string,
  metadata: Readonly<Record<string, string | number | boolean | undefined>> = {}
): void {
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );
  process.stdout.write(`${JSON.stringify({ type, ...safe, at: new Date().toISOString() })}\n`);
}

export function safeReference(value: string): string {
  return safeHash(value);
}

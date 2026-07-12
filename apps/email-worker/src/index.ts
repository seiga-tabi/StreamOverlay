import PostalMime from "postal-mime";

interface Env {
  SUPPORT_MAILBOX_ADDRESS: string;
  SUPPORT_WEBHOOK_URL: string;
  SUPPORT_WEBHOOK_SECRET: string;
}

const MAX_RAW_EMAIL_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 100_000;
const MAX_ATTACHMENT_COUNT = 20;

function boundedText(value: string | null | undefined, maxLength: number): string {
  return (value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function contentByteLength(value: string | ArrayBuffer | Uint8Array): number {
  if (typeof value === "string") return new TextEncoder().encode(value).byteLength;
  return value.byteLength;
}

function bytesToHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  return bytesToHex(await crypto.subtle.digest("SHA-256", value));
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function requireEnv(env: Env, key: keyof Env): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key}가 설정되지 않았습니다.`);
  return value;
}

function requireHttpsUrl(env: Env, key: keyof Env): string {
  const value = requireEnv(env, key);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key}는 올바른 HTTPS URL이어야 합니다.`);
  }
  if (url.protocol !== "https:") throw new Error(`${key}는 HTTPS URL이어야 합니다.`);
  return url.toString();
}

export default {
  async email(message, env): Promise<void> {
    const mailboxAddress = requireEnv(env, "SUPPORT_MAILBOX_ADDRESS").toLowerCase();
    const webhookUrl = requireHttpsUrl(env, "SUPPORT_WEBHOOK_URL");
    const webhookSecret = requireEnv(env, "SUPPORT_WEBHOOK_SECRET");
    if (webhookSecret.length < 32) throw new Error("SUPPORT_WEBHOOK_SECRET은 32자 이상이어야 합니다.");

    if (message.to.trim().toLowerCase() !== mailboxAddress) {
      message.setReject("Recipient is not configured");
      return;
    }
    if (message.rawSize <= 0 || message.rawSize > MAX_RAW_EMAIL_BYTES) {
      message.setReject("Message is too large");
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);
    const fallbackMessageId = `sha256:${await sha256Hex(raw)}`;
    const providerMessageId = boundedText(
      parsed.messageId || message.headers.get("message-id") || fallbackMessageId,
      500
    );
    const body = JSON.stringify({
      version: 1,
      provider: "cloudflare",
      providerMessageId,
      envelopeFrom: boundedText(message.from, 320),
      envelopeTo: boundedText(message.to, 320).toLowerCase(),
      fromAddress: boundedText(parsed.from?.address || message.from, 320).toLowerCase(),
      fromName: boundedText(parsed.from?.name, 200) || undefined,
      replyTo: boundedText(parsed.replyTo?.[0]?.address, 320).toLowerCase() || undefined,
      subject: boundedText(parsed.subject || message.headers.get("subject") || "", 300),
      text: boundedText(parsed.text, MAX_TEXT_LENGTH),
      receivedAt: new Date().toISOString(),
      sizeBytes: message.rawSize,
      attachments: parsed.attachments.slice(0, MAX_ATTACHMENT_COUNT).map((attachment) => ({
        fileName: boundedText(attachment.filename, 240) || "attachment",
        mimeType: boundedText(attachment.mimeType, 120) || "application/octet-stream",
        sizeBytes: contentByteLength(attachment.content)
      }))
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = await hmacHex(webhookSecret, `${timestamp}.${body}`);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Yoro-Email-Timestamp": timestamp,
        "X-Yoro-Email-Signature": `sha256=${signature}`
      },
      body
    });
    if (!response.ok) {
      throw new Error(`Support mailbox webhook failed: ${response.status}`);
    }
  }
} satisfies ExportedHandler<Env>;

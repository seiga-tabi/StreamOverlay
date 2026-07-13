import crypto from "node:crypto";

const SIGNATURE_VERSION = "v1";
const DEFAULT_TIMEOUT_MS = 10_000;

export function validateAlertWebhookConfig(urlValue, secretValue) {
  let webhook;
  try {
    webhook = new URL(urlValue);
  } catch {
    return { ok: false, error: "OPS_ALERT_WEBHOOK_URL 형식이 올바르지 않습니다." };
  }

  if (webhook.protocol !== "https:") {
    return { ok: false, error: "alert webhook은 https:// URL이어야 합니다." };
  }
  if (typeof secretValue !== "string" || secretValue.length < 32) {
    return { ok: false, error: "OPS_ALERT_WEBHOOK_SECRET은 32자 이상이어야 합니다." };
  }

  return { ok: true, webhook };
}

export function signedAlertHeaders(body, secret, timestamp = String(Math.floor(Date.now() / 1000))) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Yoro-Alert-Timestamp": timestamp,
    "X-Yoro-Alert-Signature": `${SIGNATURE_VERSION}=${digest}`
  };
}

export async function sendAlertWebhook({
  url,
  secret,
  payload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  timestamp
}) {
  const validation = validateAlertWebhookConfig(url, secret);
  if (!validation.ok) return { ok: false, status: 0, error: validation.error };

  const body = JSON.stringify(payload);
  try {
    const response = await fetchImpl(validation.webhook, {
      method: "POST",
      headers: signedAlertHeaders(body, secret, timestamp),
      body,
      signal: AbortSignal.timeout(timeoutMs)
    });
    return {
      ok: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "alert 전송 실패"
    };
  }
}

export function buildAlertPayload({ ok, checkedAt, failures = [], test = false }) {
  const summary = test
    ? ok
      ? "YORO.gg 운영 정상 알림 테스트"
      : `YORO.gg 운영 실패 알림 테스트: ${failures.join(", ")}`
    : ok
      ? "YORO.gg 운영 상태가 정상으로 복구되었습니다."
      : `YORO.gg 운영 점검 실패: ${failures.join(", ")}`;

  return {
    text: summary,
    content: summary,
    service: "YORO.gg",
    ok,
    test,
    checkedAt,
    failures
  };
}

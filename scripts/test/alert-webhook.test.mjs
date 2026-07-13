import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlertPayload,
  sendAlertWebhook,
  validateAlertWebhookConfig
} from "../lib/alert-webhook.mjs";

const webhookUrl = "https://alerts.example.invalid/yoro";
const webhookSecret = "test-only-secret-with-at-least-32-characters";

test("운영 webhook은 HTTPS URL과 충분한 길이의 secret을 요구한다", () => {
  assert.equal(validateAlertWebhookConfig("http://alerts.example.invalid", webhookSecret).ok, false);
  assert.equal(validateAlertWebhookConfig(webhookUrl, "short").ok, false);
  assert.equal(validateAlertWebhookConfig(webhookUrl, webhookSecret).ok, true);
});

test("성공 알림은 본문과 HMAC 서명 헤더를 함께 전송한다", async () => {
  let captured;
  const result = await sendAlertWebhook({
    url: webhookUrl,
    secret: webhookSecret,
    payload: buildAlertPayload({ ok: true, checkedAt: "2026-07-13T00:00:00.000Z", test: true }),
    timestamp: "1783900800",
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(null, { status: 204 });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 204);
  assert.equal(captured.url, webhookUrl);
  assert.match(captured.init.headers["X-Yoro-Alert-Signature"], /^v1=[a-f0-9]{64}$/);
  assert.equal(captured.init.headers["X-Yoro-Alert-Timestamp"], "1783900800");
  assert.equal(captured.init.body.includes(webhookSecret), false);
});

test("실패 알림 payload는 실패 상태와 원인을 명시한다", async () => {
  let payload;
  const result = await sendAlertWebhook({
    url: webhookUrl,
    secret: webhookSecret,
    payload: buildAlertPayload({
      ok: false,
      checkedAt: "2026-07-13T00:00:00.000Z",
      failures: ["readiness", "backup freshness"],
      test: true
    }),
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(init.body);
      return new Response(null, { status: 202 });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(payload.ok, false);
  assert.deepEqual(payload.failures, ["readiness", "backup freshness"]);
  assert.match(payload.text, /운영 실패 알림 테스트/);
});

test("webhook이 오류 응답을 반환하면 실패로 판정한다", async () => {
  const result = await sendAlertWebhook({
    url: webhookUrl,
    secret: webhookSecret,
    payload: buildAlertPayload({ ok: false, checkedAt: new Date().toISOString(), test: true }),
    fetchImpl: async () => new Response(null, { status: 503 })
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.error, "HTTP 503");
});

test("network 오류는 secret을 노출하지 않고 실패로 반환한다", async () => {
  const result = await sendAlertWebhook({
    url: webhookUrl,
    secret: webhookSecret,
    payload: buildAlertPayload({ ok: false, checkedAt: new Date().toISOString(), test: true }),
    fetchImpl: async () => {
      throw new Error("receiver unavailable");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "receiver unavailable");
  assert.equal(JSON.stringify(result).includes(webhookSecret), false);
});

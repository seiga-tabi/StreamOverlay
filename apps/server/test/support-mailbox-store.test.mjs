import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { SupportMailboxStore } = await import("../dist/services/support-mailbox-store.js");

function payload(overrides = {}) {
  return {
    version: 1,
    provider: "cloudflare",
    providerMessageId: "message-1@example.test",
    envelopeFrom: "viewer@example.test",
    envelopeTo: "support@yoro.gg",
    fromAddress: "viewer@example.test",
    fromName: "Viewer",
    replyTo: "reply@example.test",
    subject: "YORO 문의",
    text: "문의 본문에는 외부에 노출되면 안 되는 내용이 있습니다.",
    receivedAt: "2026-07-10T04:00:00.000Z",
    sizeBytes: 2048,
    attachments: [{ fileName: "sample.txt", mimeType: "text/plain", sizeBytes: 24 }],
    ...overrides
  };
}

test("SupportMailboxStore는 메일을 암호화해 저장하고 읽음 상태와 중복 수신을 관리한다", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-support-mailbox-"));
  const filePath = path.join(dir, "support-mailbox.json.enc");
  const encryptionKey = Buffer.alloc(32, 7).toString("base64");
  try {
    const mailbox = new SupportMailboxStore({ filePath, encryptionKey, retentionDays: 365, maxMessages: 100 });
    const first = await mailbox.add(payload());
    assert.equal(first.deduplicated, false);
    assert.equal((await mailbox.counts()).unreadCount, 1);
    assert.equal((await mailbox.list("unread"))[0]?.subject, "YORO 문의");

    const encrypted = readFileSync(filePath, "utf8");
    assert.doesNotMatch(encrypted, /YORO 문의/);
    assert.doesNotMatch(encrypted, /viewer@example\.test/);
    assert.doesNotMatch(encrypted, /문의 본문/);

    const duplicate = await mailbox.add(payload());
    assert.equal(duplicate.deduplicated, true);
    assert.equal((await mailbox.counts()).totalCount, 1);

    const read = await mailbox.setRead(first.message.id, true);
    assert.ok(read?.readAt);
    assert.equal((await mailbox.list("unread")).length, 0);
    assert.equal((await mailbox.list("read")).length, 1);

    const restarted = new SupportMailboxStore({ filePath, encryptionKey, retentionDays: 365, maxMessages: 100 });
    assert.equal((await restarted.get(first.message.id))?.text, payload().text);
    assert.equal(await restarted.delete(first.message.id), true);
    assert.equal((await restarted.counts()).totalCount, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SupportMailboxStore는 다른 암호화 key로 기존 메일함을 열지 않는다", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-support-mailbox-key-"));
  const filePath = path.join(dir, "support-mailbox.json.enc");
  const encryptionKey = Buffer.alloc(32, 9).toString("base64");
  try {
    const mailbox = new SupportMailboxStore({ filePath, encryptionKey, retentionDays: 365, maxMessages: 100 });
    await mailbox.add(payload());
    assert.throws(
      () => new SupportMailboxStore({ filePath, encryptionKey: Buffer.alloc(32, 8).toString("base64"), retentionDays: 365, maxMessages: 100 })
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

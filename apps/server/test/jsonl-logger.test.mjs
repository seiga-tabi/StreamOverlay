import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const { JsonlLogger } = await import("../dist/logging/jsonl-logger.js");

test("JsonlLogger는 파일 크기를 제한하고 지정한 개수만 회전 보관한다", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "streamops-jsonl-rotation-"));
  try {
    const logger = new JsonlLogger(dir, { maxBytes: 120, maxFiles: 2 });
    for (let index = 0; index < 12; index += 1) {
      logger.error({ type: "fixture", index, token: "must-not-be-written" });
    }
    const files = readdirSync(dir).filter((file) => file.startsWith("errors.jsonl")).sort();
    assert.deepEqual(files, ["errors.jsonl", "errors.jsonl.1", "errors.jsonl.2"]);
    for (const file of files) {
      assert.doesNotMatch(readFileSync(path.join(dir, file), "utf8"), /must-not-be-written/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

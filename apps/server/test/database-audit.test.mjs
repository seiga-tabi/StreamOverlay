import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDatabaseAudit,
  DATABASE_AUDIT_QUERIES
} from "../dist/database/database-audit.js";

test("Database audit query는 읽기 전용 transaction에서만 실행된다", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      return { rows: [] };
    },
    release() {
      calls.push("RELEASE");
    }
  };
  const report = await collectDatabaseAudit({ async connect() { return client; } });
  assert.equal(calls[0], "BEGIN TRANSACTION READ ONLY");
  assert.equal(calls.at(-2), "ROLLBACK");
  assert.equal(calls.at(-1), "RELEASE");
  assert.equal(report.transaction, "read_only");
  for (const query of DATABASE_AUDIT_QUERIES) {
    assert.doesNotMatch(query.sql, /\b(?:DELETE|UPDATE|INSERT|ALTER|DROP|TRUNCATE|VACUUM|REINDEX)\b/iu);
  }
});

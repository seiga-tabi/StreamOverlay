import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  migrateLegacyTtsConfigFile,
  removeLegacyTtsFields
} from "../dist/scripts/migrate-remove-tts-config.js";

const sourceConfig = {
  defaults: {
    durationMs: 5000,
    soundVolume: 0.7,
    speechEnabled: true
  },
  follow: {
    title: "팔로우",
    soundUrl: "/alerts/follow.wav",
    legacy: {
      speechText: "로그에 출력하면 안 되는 음성 문장",
      keep: true
    },
    entries: [
      { speechVolume: 0.9, keep: "array-entry" }
    ]
  },
  unrelated: {
    speechText: "알림 preset 밖의 동명 필드는 보존",
    keep: true
  }
};

async function createFixture(t, contents = `${JSON.stringify(sourceConfig, null, 2)}\n`) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "streamops-tts-migration-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, "alert-overlays.runtime.json");
  await fs.writeFile(target, contents, { mode: 0o640 });
  return { directory, target };
}

test("TTS 설정 변환은 허용된 preset 내부 음성 필드만 재귀 제거하고 나머지 설정을 보존한다", () => {
  const result = removeLegacyTtsFields(sourceConfig);
  assert.equal(result.changedRecords, 2);
  assert.equal(result.removedFields, 3);
  assert.deepEqual(result.value, {
    defaults: {
      durationMs: 5000,
      soundVolume: 0.7
    },
    follow: {
      title: "팔로우",
      soundUrl: "/alerts/follow.wav",
      legacy: {
        keep: true
      },
      entries: [
        { keep: "array-entry" }
      ]
    },
    unrelated: {
      speechText: "알림 preset 밖의 동명 필드는 보존",
      keep: true
    }
  });

  const repeated = removeLegacyTtsFields(result.value);
  assert.equal(repeated.changedRecords, 0);
  assert.equal(repeated.removedFields, 0);
  assert.deepEqual(repeated.value, result.value);
});

test("dry-run은 변경 수만 반환하고 원본·backup을 만들거나 수정하지 않는다", async (t) => {
  const fixture = await createFixture(t);
  const original = await fs.readFile(fixture.target, "utf8");
  const result = await migrateLegacyTtsConfigFile(fixture.target);

  assert.equal(result.status, "dry_run");
  assert.equal(result.removedFields, 3);
  assert.equal(await fs.readFile(fixture.target, "utf8"), original);
  await assert.rejects(fs.access(`${fixture.target}.pre-tts-removal.bak`));
});

test("apply는 backup을 만들고 TTS 필드만 제거한 0600 파일로 원자 교체한다", async (t) => {
  const fixture = await createFixture(t);
  const original = await fs.readFile(fixture.target, "utf8");
  const result = await migrateLegacyTtsConfigFile(fixture.target, { apply: true });

  assert.equal(result.status, "applied");
  assert.equal(await fs.readFile(result.backup, "utf8"), original);
  assert.equal((await fs.stat(fixture.target)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(result.backup)).mode & 0o777, 0o600);

  const migrated = JSON.parse(await fs.readFile(fixture.target, "utf8"));
  assert.equal(removeLegacyTtsFields(migrated).removedFields, 0);
  assert.deepEqual(migrated.unrelated, sourceConfig.unrelated);

  const repeated = await migrateLegacyTtsConfigFile(fixture.target, { apply: true });
  assert.equal(repeated.status, "unchanged");
  assert.deepEqual(JSON.parse(await fs.readFile(fixture.target, "utf8")), migrated);
});

test("존재하지 않는 독립 runtime 설정은 안전한 not_found로 처리한다", async (t) => {
  const fixture = await createFixture(t);
  await fs.unlink(fixture.target);
  const result = await migrateLegacyTtsConfigFile(fixture.target, { apply: true });
  assert.equal(result.status, "not_found");
});

for (const [name, contents] of [
  ["빈 파일", ""],
  ["잘린 JSON", "{\"follow\":"],
  ["배열 최상위", "[]\n"],
  ["잘못된 preset schema", "{\"follow\":\"invalid\"}\n"]
]) {
  test(`${name}은 원본을 변경하지 않고 fail-closed 처리한다`, async (t) => {
    const fixture = await createFixture(t, contents);
    const original = await fs.readFile(fixture.target, "utf8");
    await assert.rejects(migrateLegacyTtsConfigFile(fixture.target, { apply: true }));
    assert.equal(await fs.readFile(fixture.target, "utf8"), original);
  });
}

test("symlink runtime 설정과 symlink 디렉터리를 거부한다", async (t) => {
  const fixture = await createFixture(t);
  const linkedTarget = path.join(fixture.directory, "linked.json");
  await fs.symlink(fixture.target, linkedTarget);
  await assert.rejects(
    migrateLegacyTtsConfigFile(linkedTarget, { apply: true }),
    /symlink가 아닌 일반 파일/u
  );

  const linkedDirectory = path.join(fixture.directory, "linked-directory");
  await fs.symlink(fixture.directory, linkedDirectory);
  await assert.rejects(
    migrateLegacyTtsConfigFile(path.join(linkedDirectory, path.basename(fixture.target)), { apply: true }),
    /실제 디렉터리/u
  );
});

test("쓰기 전 실패는 원본을 보존하고 temp 파일을 남기지 않는다", async (t) => {
  const fixture = await createFixture(t);
  const original = await fs.readFile(fixture.target, "utf8");
  await assert.rejects(
    migrateLegacyTtsConfigFile(fixture.target, {
      apply: true,
      hooks: {
        beforeWrite: () => {
          throw new Error("쓰기 실패 fixture");
        }
      }
    }),
    /쓰기 실패 fixture/u
  );
  assert.equal(await fs.readFile(fixture.target, "utf8"), original);
  assert.deepEqual((await fs.readdir(fixture.directory)).filter((entry) => entry.includes(".tmp")), []);
});

test("rename 실패는 원본과 검증된 backup을 보존하며 같은 원본으로 재시도할 수 있다", async (t) => {
  const fixture = await createFixture(t);
  const original = await fs.readFile(fixture.target, "utf8");
  await assert.rejects(
    migrateLegacyTtsConfigFile(fixture.target, {
      apply: true,
      hooks: {
        beforeRename: () => {
          throw new Error("rename 실패 fixture");
        }
      }
    }),
    /rename 실패 fixture/u
  );
  assert.equal(await fs.readFile(fixture.target, "utf8"), original);
  assert.equal(await fs.readFile(`${fixture.target}.pre-tts-removal.bak`, "utf8"), original);
  assert.deepEqual((await fs.readdir(fixture.directory)).filter((entry) => entry.includes(".tmp")), []);

  const retry = await migrateLegacyTtsConfigFile(fixture.target, { apply: true });
  assert.equal(retry.status, "applied");
});

test("기존 backup이 현재 원본과 다르면 적용을 중단하고 원본을 보존한다", async (t) => {
  const fixture = await createFixture(t);
  const original = await fs.readFile(fixture.target, "utf8");
  await fs.writeFile(`${fixture.target}.pre-tts-removal.bak`, "다른 backup", { mode: 0o600 });
  await assert.rejects(
    migrateLegacyTtsConfigFile(fixture.target, { apply: true }),
    /현재 원본과 일치하지 않습니다/u
  );
  assert.equal(await fs.readFile(fixture.target, "utf8"), original);
});

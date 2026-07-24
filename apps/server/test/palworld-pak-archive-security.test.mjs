import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const {
  PalworldPakPreflightError,
  withPalworldPakArchive,
  withPalworldPakArchiveOverlay
} = await import("../dist/data/palworld-pak-preflight.js");

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * 외부 ZIP 도구나 subprocess 없이 security 경계 fixture만 생성합니다.
 * payload를 실행하지 않으며 ZIP64·data descriptor는 의도적으로 지원하지 않습니다.
 */
function zipBytes(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data ?? "");
    const method = entry.method ?? 0;
    const compressedSize = entry.compressedSize ?? data.length;
    const uncompressedSize = entry.uncompressedSize ?? data.length;
    const checksum = entry.crc32 ?? crc32(data);
    const mode = entry.mode ?? 0o100644;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((mode << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function writeArchiveFixture(context, entries, prefix = "streamops-pak-security-") {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), prefix));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const archivePath = path.join(directory, "fixture.zip");
  const bytes = zipBytes(entries);
  await writeFile(archivePath, bytes);
  return {
    archivePath,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function isTypedPreflightError(error, messagePattern) {
  return error instanceof PalworldPakPreflightError
    && error.name === "PalworldPakPreflightError"
    && error.code === "PALWORLD_PAK_PREFLIGHT_FAILED"
    && messagePattern.test(error.message);
}

test("실제 ZIP fixture의 동일 경로 중복을 callback 전에 차단한다", async (context) => {
  const fixture = await writeArchiveFixture(context, [
    { name: "Pal/Data/Table.json", data: "{}" },
    { name: "Pal/Data/Table.json", data: "{}" }
  ]);
  let callbackCalled = false;

  await assert.rejects(
    withPalworldPakArchive(fixture.archivePath, { expectedSha256: fixture.sha256 }, async () => {
      callbackCalled = true;
    }),
    (error) => isTypedPreflightError(error, /중복되거나/u)
  );
  assert.equal(callbackCalled, false);
});

test("실제 ZIP fixture의 대소문자와 Unicode 정규화 경로 충돌을 차단한다", async (context) => {
  const fixtures = [
    [
      { name: "Pal/Data/Table.json", data: "{}" },
      { name: "pal/data/table.json", data: "{}" }
    ],
    [
      { name: "Pal/Data/Caf\u00e9.json", data: "{}" },
      { name: "Pal/Data/Cafe\u0301.json", data: "{}" }
    ]
  ];

  for (const entries of fixtures) {
    const fixture = await writeArchiveFixture(context, entries);
    await assert.rejects(
      withPalworldPakArchive(fixture.archivePath, { expectedSha256: fixture.sha256 }, async () => {
        assert.fail("충돌한 ZIP의 callback이 실행되면 안 됩니다.");
      }),
      (error) => isTypedPreflightError(error, /대소문자·Unicode 정규화 충돌/u)
    );
  }
});

test("Unix symlink와 특수 파일 ZIP entry를 regular file로 수용하지 않는다", async (context) => {
  for (const mode of [0o120777, 0o020666]) {
    const fixture = await writeArchiveFixture(context, [
      { name: "Pal/Data/unsafe.json", data: "target", mode }
    ]);
    await assert.rejects(
      withPalworldPakArchive(fixture.archivePath, { expectedSha256: fixture.sha256 }, async () => {
        assert.fail("특수 entry를 포함한 ZIP의 callback이 실행되면 안 됩니다.");
      }),
      (error) => isTypedPreflightError(
        error,
        mode === 0o120777 ? /symlink ZIP member/u : /일반 파일·디렉터리가 아닌/u
      )
    );
  }
});

test("JSON parse 오류와 ZIP CRC 변조를 빈 데이터로 처리하지 않는다", async (context) => {
  const invalidJson = await writeArchiveFixture(context, [
    { name: "Pal/Data/invalid.json", data: "{\"broken\":" }
  ]);
  await assert.rejects(
    withPalworldPakArchive(
      invalidJson.archivePath,
      { expectedSha256: invalidJson.sha256 },
      async (reader) => reader.readJson("Pal/Data/invalid.json")
    ),
    (error) => isTypedPreflightError(error, /JSON을 파싱할 수 없습니다/u)
  );

  const crcMismatch = await writeArchiveFixture(context, [
    { name: "Pal/Data/corrupt.json", data: "{}", crc32: 0 }
  ]);
  await assert.rejects(
    withPalworldPakArchive(
      crcMismatch.archivePath,
      { expectedSha256: crcMismatch.sha256 },
      async (reader) => reader.readBytes("Pal/Data/corrupt.json")
    ),
    (error) => isTypedPreflightError(error, /ZIP CRC가 일치하지 않습니다/u)
  );
});

test("고정 checksum 불일치는 typed error로 종료하고 archive handle을 정리한다", async (context) => {
  const fixture = await writeArchiveFixture(context, [
    { name: "Pal/Data/valid.json", data: "{}" }
  ]);
  let callbackCalled = false;

  await assert.rejects(
    withPalworldPakArchive(
      fixture.archivePath,
      { expectedSha256: "0".repeat(64) },
      async () => {
        callbackCalled = true;
      }
    ),
    (error) => isTypedPreflightError(error, /SHA-256이 고정 입력과 일치하지 않습니다/u)
  );
  assert.equal(callbackCalled, false);

  // Windows에서도 열린 handle이 남으면 삭제가 실패하므로 cleanup 회귀를 함께 검증합니다.
  await rm(fixture.archivePath);
  await assert.rejects(access(fixture.archivePath));
});

test("고정 asset overlay는 신규 member와 byte-identical 중복만 결합한다", async (context) => {
  const primary = await writeArchiveFixture(context, [
    { name: "Pal/Data/base.json", data: "{\"source\":\"same\"}" },
    { name: "Pal/Data/shared.json", data: "{\"value\":1}" }
  ]);
  const overlay = await writeArchiveFixture(context, [
    { name: "Pal/Data/shared.json", data: "{\"value\":1}" },
    { name: "Pal/Texture/new.png", data: "png-fixture" }
  ], "streamops-pak-overlay-");

  await withPalworldPakArchiveOverlay(
    {
      archivePath: primary.archivePath,
      expectedSha256: primary.sha256
    },
    [{
      archivePath: overlay.archivePath,
      expectedSha256: overlay.sha256
    }],
    async (reader) => {
      assert.equal(reader.archiveSha256, primary.sha256);
      assert.deepEqual(
        reader.sourceArchives.map(({ role, sha256 }) => ({ role, sha256 })),
        [
          { role: "primary", sha256: primary.sha256 },
          { role: "asset_overlay", sha256: overlay.sha256 }
        ]
      );
      assert.deepEqual(
        reader.members.map((member) => member.name),
        [
          "Pal/Data/base.json",
          "Pal/Data/shared.json",
          "Pal/Texture/new.png"
        ]
      );
      assert.equal(
        (await reader.readBytes("Pal/Texture/new.png")).toString("utf8"),
        "png-fixture"
      );
    }
  );
});

test("asset overlay가 기존 DataTable을 다른 bytes로 덮어쓰는 것을 차단한다", async (context) => {
  const primary = await writeArchiveFixture(context, [
    { name: "Pal/Data/shared.json", data: "{\"value\":1}" }
  ]);
  const overlay = await writeArchiveFixture(context, [
    { name: "Pal/Data/shared.json", data: "{\"value\":2}" }
  ], "streamops-pak-overlay-conflict-");
  let callbackCalled = false;

  await assert.rejects(
    withPalworldPakArchiveOverlay(
      {
        archivePath: primary.archivePath,
        expectedSha256: primary.sha256
      },
      [{
        archivePath: overlay.archivePath,
        expectedSha256: overlay.sha256
      }],
      async () => {
        callbackCalled = true;
      }
    ),
    (error) => isTypedPreflightError(error, /다른 내용으로 충돌/u)
  );
  assert.equal(callbackCalled, false);
});

test("대용량 asset profile은 고정 SHA-256 없이 사용할 수 없다", async (context) => {
  const fixture = await writeArchiveFixture(context, [
    { name: "Pal/Texture/icon.png", data: "png-fixture" }
  ]);
  await assert.rejects(
    withPalworldPakArchive(
      fixture.archivePath,
      { profile: "fixed_asset_overlay" },
      async () => assert.fail("고정 checksum 없이 callback을 실행하면 안 됩니다.")
    ),
    (error) => isTypedPreflightError(error, /고정 expectedSha256/u)
  );
});

test("개별 member의 비압축 크기 상한을 작은 central-directory fixture로 차단한다", async (context) => {
  const fixture = await writeArchiveFixture(context, [
    {
      name: "Pal/Data/oversize.json",
      data: Buffer.alloc(140_000),
      method: 8,
      compressedSize: 140_000,
      uncompressedSize: 64 * 1024 * 1024 + 1
    }
  ]);

  await assert.rejects(
    withPalworldPakArchive(fixture.archivePath, { expectedSha256: fixture.sha256 }, async () => {
      assert.fail("크기 상한을 넘은 ZIP의 callback이 실행되면 안 됩니다.");
    }),
    (error) => isTypedPreflightError(error, /ZIP member가 너무 큽니다/u)
  );
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const {
  PalworldPakPreflightError,
  assertPalworldPakExportMetadata,
  validatePalworldPakMemberName,
  withPalworldPakArchive
} = await import("../dist/data/palworld-pak-preflight.js");
const {
  isPalworldPakPlaceholder,
  officialLocaleLookup,
  readPalworldPakOfficialLocale
} = await import("../dist/data/palworld-pak-localization.js");
const {
  PalworldPakAssetError,
  importPalworldPakPngAsset,
  validatePalworldPakPngBytes
} = await import("../dist/data/palworld-pak-assets.js");
const {
  assertPalworldPakCandidateOutputDirectory,
  palworldPakSourcePalVisibility,
  parsePalworldPakPublicIdMap,
  parsePublicActiveSkillAllowlist,
  parseWorkAssetMap
} = await import("../dist/data/palworld-pak-import.js");

const ARCHIVE_SHA256 = "a".repeat(64);
const CANDIDATE_ID = `candidate-${ARCHIVE_SHA256.slice(0, 16)}`;
const KO_PAL_NAMES = "L10N/ko/Pal/DataTable/Text/DT_PalNameText_Common.json";
const JA_PAL_NAMES = "Pal/DataTable/Text/DT_PalNameText_Common.json";
const KO_SKILL_NAMES = "L10N/ko/Pal/DataTable/Text/DT_SkillNameText_Common.json";

function dataTableBytes(rows) {
  return Buffer.from(JSON.stringify([{ Type: "DataTable", Rows: rows }]), "utf8");
}

function localizedRow(text, extraTextData = {}) {
  return {
    TextData: {
      Namespace: "Pal",
      Key: "fixture",
      SourceString: text,
      LocalizedString: text,
      ...extraTextData
    }
  };
}

function archiveReader(members) {
  const buffers = new Map(Object.entries(members));
  return {
    archiveSha256: ARCHIVE_SHA256,
    archiveBytes: [...buffers.values()].reduce((total, bytes) => total + bytes.length, 0),
    members: [...buffers.entries()].map(([name, bytes]) => ({
      name,
      compressedBytes: bytes.length,
      uncompressedBytes: bytes.length
    })),
    has(memberName) {
      return buffers.has(memberName);
    },
    async readBytes(memberName) {
      const bytes = buffers.get(memberName);
      if (!bytes) throw new Error(`fixture member 없음: ${memberName}`);
      return Buffer.from(bytes);
    },
    async readJson(memberName) {
      return JSON.parse((await this.readBytes(memberName)).toString("utf8"));
    },
    async readDataTable(memberName) {
      const parsed = await this.readJson(memberName);
      return parsed.find((entry) => entry?.Rows)?.Rows ?? {};
    }
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
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

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

test("PAK ZIP member 경로는 traversal·absolute·backslash·제어문자 우회를 거부한다", () => {
  assert.equal(
    validatePalworldPakMemberName("Pal/DataTable/Character/DT_Pal.json"),
    "Pal/DataTable/Character/DT_Pal.json"
  );
  assert.equal(validatePalworldPakMemberName("Pal/"), "Pal/");

  for (const unsafe of [
    "../Pal.json",
    "Pal/../Pal.json",
    "/Pal.json",
    "\\Pal.json",
    "C:/Pal.json",
    "Pal\\DataTable.json",
    "Pal//DataTable.json",
    "Pal/\u0000DataTable.json"
  ]) {
    assert.throws(
      () => validatePalworldPakMemberName(unsafe),
      (error) =>
        error instanceof PalworldPakPreflightError
        && /안전하지 않습니다|traversal/u.test(error.message)
    );
  }
});

test("PAK archive checksum 불일치는 member callback을 실행하기 전에 차단한다", async (context) => {
  const directory = await mkdtemp(
    path.join(await realpath(tmpdir()), "streamops-pak-checksum-")
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  const archivePath = path.join(directory, "fixture.zip");
  // 중앙 디렉터리 항목이 없는 최소 유효 ZIP의 EOCD입니다.
  await writeFile(
    archivePath,
    Buffer.from("504b0506000000000000000000000000000000000000", "hex")
  );
  let callbackCalled = false;

  await assert.rejects(withPalworldPakArchive(
    archivePath,
    { expectedSha256: "0".repeat(64) },
    async () => {
      callbackCalled = true;
    }
  ));
  assert.equal(callbackCalled, false);
});

test("PAK export metadata는 exact schema와 고정 source 필드를 검증한다", () => {
  const metadata = {
    schemaVersion: 1,
    sourceType: "operator_pak_export",
    gameVersion: "0.7.2",
    steamBuildId: "24681012",
    fmodelVersion: "4.4.4.0",
    exportedAt: "2026-07-20T10:20:30.000Z",
    mappingsSha256: "b".repeat(64)
  };
  assert.deepEqual(assertPalworldPakExportMetadata(metadata), metadata);

  assert.throws(
    () => assertPalworldPakExportMetadata({ ...metadata, branch: "latest" }),
    /허용되지 않은 필드/u
  );
  assert.throws(
    () => assertPalworldPakExportMetadata({ ...metadata, mappingsSha256: "B".repeat(64) }),
    /소문자 64자리 SHA-256/u
  );
  assert.throws(
    () => assertPalworldPakExportMetadata({ ...metadata, schemaVersion: 2 }),
    /schemaVersion: 1/u
  );
  assert.throws(
    () => assertPalworldPakExportMetadata({ ...metadata, gameVersion: "0.7.2\u0000" }),
    /문자열이어야/u
  );
  assert.throws(
    () => assertPalworldPakExportMetadata({ ...metadata, gameVersion: "latest" }),
    /semantic version/u
  );
  assert.throws(
    () => assertPalworldPakExportMetadata({ ...metadata, fmodelVersion: "main" }),
    /숫자 기반 고정 버전/u
  );
});

test("PAK public ID extension은 legacy map을 수정하지 않고 exact sourceInternalId를 추가한다", () => {
  const legacy = {
    version: 1,
    release: "1.0.1",
    entries: [{ sourceInternalId: "Anubis", publicId: "anubis" }]
  };
  const extension = {
    schemaVersion: 1,
    candidateRelease: CANDIDATE_ID,
    sourceArchiveSha256: ARCHIVE_SHA256,
    entries: [{
      sourceInternalId: "WorldTreeDragon",
      publicId: "world-tree-dragon",
      reason: "PAK 신규 canonical Pal exact ID",
      reviewStatus: "approved"
    }]
  };
  const parsed = parsePalworldPakPublicIdMap(
    legacy,
    extension,
    ARCHIVE_SHA256,
    CANDIDATE_ID
  );
  assert.equal(parsed.entries.get("Anubis"), "anubis");
  assert.equal(parsed.entries.get("WorldTreeDragon"), "world-tree-dragon");
  assert.equal(legacy.entries.length, 1);

  assert.throws(
    () => parsePalworldPakPublicIdMap(
      legacy,
      {
        ...extension,
        entries: [{
          ...extension.entries[0],
          publicId: "anubis"
        }]
      },
      ARCHIVE_SHA256,
      CANDIDATE_ID
    ),
    /중복/u
  );
});

test("candidate output은 실행 CWD와 무관하게 실제 active runtime 경로를 거부한다", () => {
  const activeRuntime = fileURLToPath(
    new URL("../data/palworld/runtime", import.meta.url)
  );
  const serverRoot = fileURLToPath(new URL("../", import.meta.url));
  const previous = process.cwd();
  try {
    process.chdir(serverRoot);
    assert.throws(
      () => assertPalworldPakCandidateOutputDirectory(activeRuntime),
      /active runtime과 분리/u
    );
    assert.throws(
      () => assertPalworldPakCandidateOutputDirectory(
        path.join(activeRuntime, "nested")
      ),
      /active runtime과 분리/u
    );
  } finally {
    process.chdir(previous);
  }
});

test("PAK relation 대상은 도감 공개 여부를 exact source 필드로 분류한다", () => {
  assert.equal(
    palworldPakSourcePalVisibility({ IsPal: true, ZukanIndex: 1 }),
    "public"
  );
  assert.equal(
    palworldPakSourcePalVisibility({ IsPal: true, ZukanIndex: -1 }),
    "nonpublic"
  );
  assert.equal(
    palworldPakSourcePalVisibility({ IsPal: false, ZukanIndex: -1 }),
    "invalid"
  );
  assert.equal(palworldPakSourcePalVisibility(undefined), "missing");
  assert.equal(
    palworldPakSourcePalVisibility({ IsPal: true, ZukanIndex: Number.NaN }),
    "invalid"
  );
});

test("work icon mapping은 공개 작업 적성 전체와 제외 source를 exact 분류한다", () => {
  const candidateId = `candidate-${ARCHIVE_SHA256.slice(0, 16)}`;
  const sourceMember = (suffix) => `Pal/Texture/UI/InGame/T_icon_palwork_${suffix}.png`;
  const publicEntries = [
    ["kindling", "00"],
    ["watering", "01"],
    ["planting", "02"],
    ["generating_electricity", "03"],
    ["handiwork", "04"],
    ["gathering", "05"],
    ["lumbering", "06"],
    ["mining", "07"],
    ["medicine_production", "08"],
    ["cooling", "10"],
    ["transporting", "11"],
    ["farming", "12"]
  ].map(([id, suffix]) => ({ id, sourceMember: sourceMember(suffix) }));
  const exclusions = [
    {
      sourceMember: sourceMember("09"),
      reason: "source_only_oil_extraction_not_in_public_work_enum"
    },
    {
      sourceMember: sourceMember("13"),
      reason: "semantic_meaning_not_verified"
    },
    {
      sourceMember: sourceMember("90"),
      reason: "not_a_public_work_suitability_icon"
    }
  ];
  const mapping = (entries, excludedSourceMembers = [], status = "verified") => ({
    schemaVersion: 1,
    candidateRelease: candidateId,
    sourceArchiveSha256: ARCHIVE_SHA256,
    status,
    availableSourceMembers: [
      ...entries.map((entry) => entry.sourceMember),
      ...excludedSourceMembers.map((entry) => entry.sourceMember)
    ].sort(),
    entries,
    excludedSourceMembers
  });

  const parsed = parseWorkAssetMap(
    mapping(publicEntries, exclusions),
    ARCHIVE_SHA256,
    candidateId
  );
  assert.equal(parsed.entries.length, 12);
  assert.deepEqual(parsed.excludedSourceMembers, exclusions);

  assert.throws(
    () => parseWorkAssetMap(mapping([
      { id: "unknown_work", sourceMember: sourceMember("00") }
    ], [], "blocked_pending_semantic_mapping"), ARCHIVE_SHA256, candidateId),
    /허용된 work semantic ID/u
  );

  assert.throws(
    () => parseWorkAssetMap(mapping([
      { id: "mining", sourceMember: sourceMember("07") },
      { id: "mining", sourceMember: sourceMember("13") }
    ], [], "blocked_pending_semantic_mapping"), ARCHIVE_SHA256, candidateId),
    /ID 또는 source member가 중복/u
  );

  assert.throws(
    () => parseWorkAssetMap(
      {
        ...mapping(publicEntries, exclusions.slice(0, 2)),
        availableSourceMembers: [
          ...mapping(publicEntries, exclusions.slice(0, 2)).availableSourceMembers,
          sourceMember("90")
        ].sort()
      },
      ARCHIVE_SHA256,
      candidateId
    ),
    /공개 작업 적성 전체 mapping과 source 분류/u
  );
});

test("공개 active skill allowlist는 archive에 고정된 exact source 식별자만 허용한다", () => {
  const candidateId = `candidate-${ARCHIVE_SHA256.slice(0, 16)}`;
  const entry = {
    sourceRowId: "NewRow_1",
    sourceInternalId: "AquaJet",
    nameMessageKey: "ACTION_SKILL_AquaJet",
    reason: "canonical_pal_assignment_and_official_ko_ja_locale_verified",
    reviewStatus: "approved"
  };
  const mapping = (entries) => ({
    schemaVersion: 1,
    candidateRelease: candidateId,
    sourceArchiveSha256: ARCHIVE_SHA256,
    entries
  });

  assert.deepEqual(
    [...parsePublicActiveSkillAllowlist(
      mapping([entry]),
      ARCHIVE_SHA256,
      candidateId
    ).values()],
    [{
      sourceRowId: entry.sourceRowId,
      sourceInternalId: entry.sourceInternalId,
      nameMessageKey: entry.nameMessageKey,
      reason: entry.reason
    }]
  );
  assert.throws(
    () => parsePublicActiveSkillAllowlist(
      mapping([entry, { ...entry, sourceRowId: "NewRow_2" }]),
      ARCHIVE_SHA256,
      candidateId
    ),
    /중복/u
  );
  assert.throws(
    () => parsePublicActiveSkillAllowlist(
      mapping([{ ...entry, reviewStatus: "candidate" }]),
      ARCHIVE_SHA256,
      candidateId
    ),
    /approved/u
  );
  assert.throws(
    () => parsePublicActiveSkillAllowlist(
      { ...mapping([entry]), sourceArchiveSha256: "b".repeat(64) },
      ARCHIVE_SHA256,
      candidateId
    ),
    /checksum/u
  );
});

test("공식 locale importer는 placeholder를 제외하고 KO·JA source 언어를 검증한다", async () => {
  const koRows = {
    PAL_NAME_Lamball: localizedRow("도로롱"),
    EMPTY: localizedRow(""),
    DASH: localizedRow("-"),
    KO_PLACEHOLDER: localizedRow("ko_Text"),
    EN_PLACEHOLDER: localizedRow("en Text"),
    INVALID_SCHEMA: localizedRow("잘못된 스키마", { Unexpected: true })
  };
  const jaRows = {
    PAL_NAME_Lamball: localizedRow("モコロン"),
    PAL_NAME_Cattiva: localizedRow("ツッパニャン")
  };
  const reader = archiveReader({
    [KO_PAL_NAMES]: dataTableBytes(koRows),
    [JA_PAL_NAMES]: dataTableBytes(jaRows)
  });

  const ko = await readPalworldPakOfficialLocale(reader, "ko");
  assert.equal(ko.status, "source_provided");
  assert.equal(ko.languageVerified, true);
  assert.deepEqual(ko.coverage, {
    inputRows: 6,
    includedRows: 1,
    placeholderRows: 4,
    invalidRows: 1,
    duplicateMessageKeys: 0
  });
  assert.equal(ko.records[0].status, "source_provided");
  assert.equal(ko.records[0].sourceMember, KO_PAL_NAMES);
  assert.equal(ko.records[0].sourceMemberSha256, createHash("sha256")
    .update(dataTableBytes(koRows))
    .digest("hex"));
  assert.equal(ko.records[0].valueSha256, createHash("sha256")
    .update("도로롱", "utf8")
    .digest("hex"));
  assert.equal(officialLocaleLookup(ko, "pal_name").get("PAL_NAME_Lamball")?.text, "도로롱");

  const ja = await readPalworldPakOfficialLocale(reader, "ja");
  assert.equal(ja.status, "source_provided");
  assert.equal(ja.languageVerified, true);
  assert.equal(ja.records.length, 2);

  const en = await readPalworldPakOfficialLocale(reader, "en");
  assert.equal(en.status, "missing");
  assert.equal(en.languageVerified, false);
  assert.equal(en.records.length, 0);

  for (const placeholder of ["", " ", "-", "ko_Text", "ja_Text", "en Text", undefined]) {
    assert.equal(isPalworldPakPlaceholder(placeholder), true);
  }
  assert.equal(isPalworldPakPlaceholder("Lamball"), false);
});

test("partner skill의 '-' 공식 값은 번역이 아니라 missing source로 남긴다", async () => {
  const candidate = await readPalworldPakOfficialLocale(
    archiveReader({
      [KO_SKILL_NAMES]: dataTableBytes({
        PARTNERSKILL_WorldTreeDragon: localizedRow("-")
      })
    }),
    "ko"
  );
  assert.equal(candidate.status, "source_provided");
  assert.equal(candidate.coverage.inputRows, 1);
  assert.equal(candidate.coverage.includedRows, 0);
  assert.equal(candidate.coverage.placeholderRows, 1);
  assert.equal(
    officialLocaleLookup(candidate, "skill_name").has("PARTNERSKILL_WorldTreeDragon"),
    false
  );
});

test("공식 locale importer는 경로가 KO여도 실제 문자열이 다른 언어이면 검증 통과시키지 않는다", async () => {
  const rows = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      `PAL_NAME_${index}`,
      localizedRow(`English Pal ${index}`)
    ])
  );
  const candidate = await readPalworldPakOfficialLocale(
    archiveReader({ [KO_PAL_NAMES]: dataTableBytes(rows) }),
    "ko"
  );
  assert.equal(candidate.status, "source_provided");
  assert.equal(candidate.languageVerified, false);
  assert.equal(candidate.coverage.includedRows, 10);
});

test("PNG validator는 signature·CRC·dimension·animation 변조를 각각 차단한다", async () => {
  const valid = await sharp({
    create: {
      width: 8,
      height: 6,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 0.5 }
    }
  }).png().toBuffer();

  assert.deepEqual(validatePalworldPakPngBytes(valid), {
    width: 8,
    height: 6,
    hasAlpha: true
  });
  assert.throws(
    () => validatePalworldPakPngBytes(Buffer.from("not a png")),
    (error) => error instanceof PalworldPakAssetError && /signature/u.test(error.message)
  );

  const badCrc = Buffer.from(valid);
  badCrc[32] ^= 0xff;
  assert.throws(
    () => validatePalworldPakPngBytes(badCrc),
    (error) => error instanceof PalworldPakAssetError && /CRC/u.test(error.message)
  );

  assert.throws(
    () => validatePalworldPakPngBytes(valid, 4),
    (error) => error instanceof PalworldPakAssetError && /픽셀 크기/u.test(error.message)
  );

  const animationControl = Buffer.alloc(8);
  animationControl.writeUInt32BE(1, 0);
  const animated = Buffer.concat([
    valid.subarray(0, 33),
    pngChunk("acTL", animationControl),
    valid.subarray(33)
  ]);
  assert.throws(
    () => validatePalworldPakPngBytes(animated),
    (error) => error instanceof PalworldPakAssetError && /animated PNG/u.test(error.message)
  );
});

test("PNG import는 업스케일 없이 content-hash WebP를 결정적으로 재사용한다", async (context) => {
  const directory = await mkdtemp(
    path.join(await realpath(tmpdir()), "streamops-pak-image-")
  );
  context.after(() => rm(directory, { recursive: true, force: true }));
  const png = await sharp({
    create: {
      width: 12,
      height: 7,
      channels: 4,
      background: { r: 80, g: 100, b: 120, alpha: 0.75 }
    }
  }).png().toBuffer();
  const reader = archiveReader({ "Pal/Texture/T_test.png": png });
  const input = {
    reader,
    memberName: "Pal/Texture/T_test.png",
    id: "fixture-pal",
    kind: "pal",
    outputRoot: directory,
    maximumOutputDimension: 512
  };

  const first = await importPalworldPakPngAsset(input);
  const second = await importPalworldPakPngAsset(input);
  assert.deepEqual(second, first);
  assert.equal(first.sourceWidth, 12);
  assert.equal(first.sourceHeight, 7);
  assert.ok(first.outputWidth <= first.sourceWidth);
  assert.ok(first.outputHeight <= first.sourceHeight);
  assert.match(first.outputFile, /^assets\/pal\/[a-f0-9]{64}\.webp$/u);

  const output = await readFile(path.join(directory, ...first.outputFile.split("/")));
  assert.equal(createHash("sha256").update(output).digest("hex"), first.outputSha256);
  assert.equal(output.length, first.outputBytes);
});

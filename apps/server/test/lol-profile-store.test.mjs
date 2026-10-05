import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { runInNewContext } from "node:vm";
import { join } from "node:path";
import { LocalJsonLolProfileRepository } from "../dist/services/lol-profile-store.js";

function profile(index = 0) {
  return {
    riotPuuid: `puuid-${index}`,
    riotGameName: `사용자${index}`,
    riotTagLine: "KR1",
    riotIdKey: "정규화 전",
    status: "ready",
    recentMatches: [{ championId: 1, marker: "원본" }],
    rankHistory: { solo: [{ leaguePoints: 42 }] }
  };
}

function fixture(t, onError) {
  const directory = fs.mkdtempSync(join(tmpdir(), "lol-profile-batch-"));
  const filePath = join(directory, "profiles.json");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, filePath, repository: new LocalJsonLolProfileRepository(filePath, onError) };
}

test("연속 save 100회는 즉시 쓰기 100회 대신 3초 후 파일 교체 1회로 합쳐진다", (t) => {
  const { filePath, repository } = fixture(t);
  const open = t.mock.method(fs, "openSync");
  const rename = t.mock.method(fs, "renameSync");
  for (let index = 0; index < 100; index++) repository.save(profile(index));
  assert.equal(open.mock.callCount(), 0);
  assert.equal(rename.mock.callCount(), 0);
  assert.equal(repository.getByPuuid("puuid-99").riotGameName, "사용자99");
  assert.equal(repository.getByRiotId("사용자99", "kr1").riotPuuid, "puuid-99");
  assert.equal(repository.searchByText("사용자99").length, 1);
  t.mock.timers.tick(2_999);
  repository.save({ ...profile(99), status: "failed" });
  assert.equal(rename.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.equal(open.mock.callCount(), 1);
  assert.equal(rename.mock.callCount(), 1);
  const persisted = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(persisted.profiles.length, 100);
  assert.equal(persisted.profiles.at(-1).status, "failed");
  t.mock.timers.tick(9_000);
  assert.equal(rename.mock.callCount(), 1);
  repository.save(profile(100));
  t.mock.timers.tick(3_000);
  assert.equal(rename.mock.callCount(), 2);
});

test("flush는 예약을 취소하고 변경이 있을 때만 저장하며 이후 새 배치를 허용한다", (t) => {
  const { filePath, repository } = fixture(t);
  const rename = t.mock.method(fs, "renameSync");
  repository.flush();
  assert.equal(rename.mock.callCount(), 0);
  repository.save(profile());
  repository.flush();
  assert.equal(new LocalJsonLolProfileRepository(filePath).getByPuuid("puuid-0").status, "ready");
  repository.flush();
  t.mock.timers.tick(3_000);
  assert.equal(rename.mock.callCount(), 1);
  repository.save(profile(1));
  repository.flush();
  assert.equal(rename.mock.callCount(), 2);
});

test("저장은 입력과 반환값을 복제하고 중복 Riot ID를 즉시 제거하며 재로드 후에도 유지한다", (t) => {
  const { repository, filePath } = fixture(t);
  const input = profile();
  const saved = repository.save(input);
  input.recentMatches[0].marker = "입력 변경";
  saved.rankHistory.solo[0].leaguePoints = 999;
  const read = repository.getByPuuid(input.riotPuuid);
  assert.equal(read.recentMatches[0].marker, "원본");
  assert.equal(read.rankHistory.solo[0].leaguePoints, 42);
  read.recentMatches[0].marker = "조회 변경";
  repository.save({ ...repository.getByPuuid(input.riotPuuid), riotPuuid: "replacement" });
  assert.equal(repository.getByPuuid(input.riotPuuid), undefined);
  assert.equal(repository.getByRiotId(input.riotGameName, "kr1").riotPuuid, "replacement");
  repository.flush();
  const loaded = new LocalJsonLolProfileRepository(filePath);
  assert.equal(loaded.searchByText("사용자").length, 1);
  assert.equal(loaded.getByPuuid("replacement").recentMatches[0].marker, "원본");
});

test("전체 복제 없이 프로필 단위 compact JSON을 기록해 단일 쓰기 크기를 제한한다", (t) => {
  const { repository, filePath } = fixture(t);
  for (let index = 0; index < 40; index++) {
    repository.save({ ...profile(index), failedReason: '한글日本語"\\\n'.repeat(1_000) });
  }
  const writes = t.mock.method(fs, "writeFileSync");
  const stringify = t.mock.method(JSON, "stringify");
  repository.flush();
  assert.equal(stringify.mock.callCount(), 40);
  assert.ok(stringify.mock.calls.every((call) => call.arguments.length === 1 && call.arguments[0].riotPuuid));
  // 직렬화 대상의 참조 동일성으로 전체 캐시 복제 회귀를 탐지합니다.
  for (const call of stringify.mock.calls) {
    const serialized = call.arguments[0];
    assert.equal(serialized, repository.profiles.get(serialized.riotPuuid));
  }
  stringify.mock.restore();
  const raw = fs.readFileSync(filePath, "utf8");
  assert.equal(raw, JSON.stringify(JSON.parse(raw)));
  assert.equal(JSON.parse(raw).profiles.length, 40);
  assert.equal(writes.mock.callCount(), 42);
  assert.ok(writes.mock.calls.every((call) => typeof call.arguments[0] === "number"));
  const largest = Math.max(...writes.mock.calls.map((call) => Buffer.byteLength(call.arguments[1])));
  assert.ok(largest < Buffer.byteLength(raw) / 20);
});

for (const operation of ["writeFileSync", "renameSync"]) {
  test(`${operation} 실패 시 기존 파일과 변경 상태를 보존하고 임시 파일 정리 후 재시도한다`, (t) => {
    const errors = [];
    const { repository, filePath, directory } = fixture(t, (error) => errors.push(error));
    repository.save(profile());
    repository.flush();
    const original = fs.readFileSync(filePath, "utf8");
    repository.save(profile(1));
    const failure = new Error("디스크 쓰기 실패");
    const failing = t.mock.method(fs, operation, () => { throw failure; });
    t.mock.timers.tick(3_000);
    assert.deepEqual(errors, [failure]);
    assert.equal(fs.readFileSync(filePath, "utf8"), original);
    assert.deepEqual(fs.readdirSync(directory), ["profiles.json"]);
    failing.mock.restore();
    t.mock.timers.tick(6_000);
    assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 2);
    assert.equal(new LocalJsonLolProfileRepository(filePath).getByPuuid("puuid-1").status, "ready");
  });
}

test("명시적 flush 실패는 호출자에게 전달되고 다음 flush로 복구할 수 있다", (t) => {
  const { repository, filePath } = fixture(t);
  repository.save(profile());
  const failing = t.mock.method(fs, "renameSync", () => { throw new Error("교체 실패"); });
  assert.throws(() => repository.flush(), /교체 실패/);
  assert.equal(fs.existsSync(filePath), false);
  failing.mock.restore();
  repository.flush();
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 1);
});

test("load는 본 파일이 없어도 잔존 tmp만 정리하고 삭제 실패를 무시한다", (t) => {
  const { filePath, directory } = fixture(t);
  const stale = `${filePath}.123.456.tmp`;
  const protectedFile = `${filePath}.456.789.tmp`;
  const unrelated = join(directory, "other.json.123.tmp");
  for (const name of [stale, protectedFile, unrelated, `${filePath}.broken-1`]) fs.writeFileSync(name, "잔존");
  const old = new Date(Date.now() - 60_001);
  for (const name of [stale, protectedFile]) fs.utimesSync(name, old, old);
  t.mock.method(process, "kill", () => { throw Object.assign(new Error("프로세스 없음"), { code: "ESRCH" }); });
  const unlink = fs.unlinkSync;
  t.mock.method(fs, "unlinkSync", (name) => {
    if (name === protectedFile) throw Object.assign(new Error("삭제 불가"), { code: "EACCES" });
    return unlink(name);
  });
  assert.doesNotThrow(() => new LocalJsonLolProfileRepository(filePath));
  assert.equal(fs.existsSync(stale), false);
  assert.equal(fs.existsSync(protectedFile), true);
  assert.equal(fs.existsSync(unrelated), true);
  assert.equal(fs.existsSync(`${filePath}.broken-1`), true);
});

test("임시 파일 wx 충돌은 타인의 파일을 보존하고 다음 예약에서 성공한다", (t) => {
  const errors = [];
  const { repository, filePath } = fixture(t, (error) => errors.push(error));
  const now = Date.now();
  const clock = t.mock.method(Date, "now", () => now);
  const collision = `${filePath}.${process.pid}.${now}.tmp`;
  fs.writeFileSync(collision, "기존 파일");
  repository.save(profile());
  t.mock.timers.tick(3_000);
  assert.equal(errors[0].code, "EEXIST");
  assert.equal(fs.readFileSync(collision, "utf8"), "기존 파일");
  clock.mock.mockImplementation(() => now + 6_000);
  t.mock.timers.tick(6_000);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 1);
});

test("연속 저장 실패는 최대 5분까지 백오프하고 새 save도 이를 우회하지 않으며 성공 후 초기화한다", (t) => {
  const { repository, filePath } = fixture(t, () => { throw new Error("오류 보고 실패"); });
  const failure = t.mock.method(fs, "openSync", () => {
    throw Object.assign(new Error("공간 부족"), { code: "ENOSPC" });
  });
  repository.save(profile());
  for (const delay of [3_000, 6_000, 12_000, 24_000, 48_000, 96_000, 192_000, 300_000, 300_000]) {
    const previous = failure.mock.callCount();
    repository.save(profile(1));
    t.mock.timers.tick(delay - 1);
    assert.equal(failure.mock.callCount(), previous);
    assert.doesNotThrow(() => t.mock.timers.tick(1));
    assert.equal(failure.mock.callCount(), previous + 1);
  }
  failure.mock.restore();
  const rename = t.mock.method(fs, "renameSync");
  t.mock.timers.tick(300_000);
  assert.equal(rename.mock.callCount(), 1);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 2);
  repository.save(profile(2));
  t.mock.timers.tick(2_999);
  assert.equal(rename.mock.callCount(), 1);
  t.mock.timers.tick(1);
  assert.equal(rename.mock.callCount(), 2);
});

test("load TTL은 경계와 실패 재시도 유예를 지키고 너무 오래된 실패를 삭제한다", (t) => {
  const { filePath } = fixture(t);
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const daysAgo = (days) => new Date(now - days * 86_400_000).toISOString();
  const entries = [
    { ...profile(0), analyzedAt: daysAgo(90) },
    { ...profile(1), analyzedAt: daysAgo(91) },
    { ...profile(2), status: "failed", analyzedAt: daysAgo(91), nextRetryAt: daysAgo(-1) },
    { ...profile(3), status: "rate_limited", analyzedAt: daysAgo(91), nextRetryAt: daysAgo(-1) },
    { ...profile(4), status: "failed", analyzedAt: daysAgo(181), nextRetryAt: daysAgo(-1000) },
    { ...profile(5), status: "rate_limited", analyzedAt: daysAgo(181), nextRetryAt: daysAgo(-1000) },
    { ...profile(6), status: "failed", analyzedAt: daysAgo(91), nextRetryAt: daysAgo(0) },
    { ...profile(7), analyzedAt: "잘못된 시각", createdAt: daysAgo(91) },
    { ...profile(8), status: "failed", analyzedAt: daysAgo(91), nextRetryAt: "잘못된 시각" },
    { ...profile(9), analyzedAt: daysAgo(1), createdAt: daysAgo(200) }
  ];
  fs.writeFileSync(filePath, JSON.stringify({ profiles: entries }));
  const repository = new LocalJsonLolProfileRepository(filePath);
  for (const index of [0, 2, 3, 9]) assert.ok(repository.getByPuuid(`puuid-${index}`));
  for (const index of [1, 4, 5, 6, 7, 8]) assert.equal(repository.getByPuuid(`puuid-${index}`), undefined);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 10);
  t.mock.timers.tick(3_000);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 4);
});

test("생성 시각 없는 기존 항목은 파일 시각으로 만료하며 생성 시각은 재저장·재시작에도 유지된다", (t) => {
  const { filePath } = fixture(t);
  fs.writeFileSync(filePath, JSON.stringify({ profiles: [profile()] }));
  const old = new Date(Date.now() - 91 * 86_400_000);
  fs.utimesSync(filePath, old, old);
  const repository = new LocalJsonLolProfileRepository(filePath);
  assert.equal(repository.getByPuuid("puuid-0"), undefined);
  repository.flush();
  const saved = repository.save(profile(1));
  repository.flush();
  const loaded = new LocalJsonLolProfileRepository(filePath);
  assert.equal(loaded.getByPuuid("puuid-1").createdAt, saved.createdAt);
  assert.equal(loaded.save(profile(1)).createdAt, saved.createdAt);
  loaded.flush();
});

test("사용자 지정 TTL은 변경 없는 flush에서도 만료 항목을 정리하고 실패 시 재저장을 유지한다", (t) => {
  const { filePath } = fixture(t);
  const now = Date.now();
  const clock = t.mock.method(Date, "now", () => now);
  const repository = new LocalJsonLolProfileRepository(filePath, () => {}, 1);
  repository.save({ ...profile(), analyzedAt: new Date(now).toISOString() });
  repository.flush();
  clock.mock.mockImplementation(() => now + 86_400_001);
  const failure = t.mock.method(fs, "renameSync", () => { throw new Error("교체 실패"); });
  assert.throws(() => repository.flush(), /교체 실패/);
  assert.equal(repository.getByPuuid("puuid-0"), undefined);
  assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 1);
  failure.mock.restore();
  t.mock.timers.tick(6_000);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles, []);
});

for (const failing of [false, true]) {
  test(`실제 프로세스 exit 핸들러는 캐시를 flush하고 저장 ${failing ? "실패를 종료 코드로 전달한다" : "성공을 보장한다"}`, (t) => {
    const { filePath } = fixture(t);
    const source = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
    const start = source.indexOf('process.once("exit",');
    const end = source.indexOf('\n});', start);
    assert.ok(start >= 0 && end > start);
    const handler = source.slice(start, end + 4);
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import fs from "node:fs";
      import { LocalJsonLolProfileRepository } from ${JSON.stringify(new URL("../dist/services/lol-profile-store.js", import.meta.url).href)};
      const lolProfileRepository = new LocalJsonLolProfileRepository(${JSON.stringify(filePath)});
      const logger = { error() {} };
      const toSafeErrorMessage = String;
      lolProfileRepository.save(${JSON.stringify(profile())});
      ${failing ? 'fs.renameSync = () => { throw new Error("교체 실패"); };' : ""}
      ${handler}
    `], { encoding: "utf8", timeout: 10_000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, failing ? 1 : 0, result.stderr);
    assert.equal(fs.existsSync(filePath), !failing);
    if (!failing) assert.equal(JSON.parse(fs.readFileSync(filePath, "utf8")).profiles.length, 1);
  });
}

test("appConfig는 TTL 환경변수와 기본값 및 최소 보존 기간을 적용한다", (t) => {
  const { directory } = fixture(t);
  const emptyEnv = join(directory, ".env");
  fs.writeFileSync(emptyEnv, "");
  for (const [value, expected] of [[undefined, 90], ["30", 30], ["잘못된 값", 90], ["0", 1], ["-1", 1]]) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { appConfig } from ${JSON.stringify(new URL("../dist/config.js", import.meta.url).href)};
      process.stdout.write(JSON.stringify(appConfig.lolProfileCache.ttlDays));
    `], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        PATH: process.env.PATH,
        DOTENV_CONFIG_PATH: emptyEnv,
        ...(value === undefined ? {} : { LOL_PROFILE_CACHE_TTL_DAYS: value })
      }
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout), expected);
  }
});

test("tmp 정리는 60초 경계와 PID 생존·권한 및 파싱 여부를 함께 확인한다", (t) => {
  const { filePath } = fixture(t);
  const now = Date.now();
  t.mock.method(Date, "now", () => now);
  const cases = [
    ["123.1.tmp", 59_999, true],
    ["123.2.tmp", 60_000, false],
    [`${process.pid}.3.tmp`, 120_000, true],
    ["456.4.tmp", 120_000, true],
    ["legacy.tmp", 120_000, false],
    ["recent.tmp", 59_999, true],
    ["0.5.tmp", 120_000, false],
    ["99999999999999999999.6.tmp", 120_000, false]
  ];
  for (const [suffix, age] of cases) {
    const name = `${filePath}.${suffix}`;
    fs.writeFileSync(name, "임시");
    const time = new Date(now - age);
    fs.utimesSync(name, time, time);
  }
  const kill = t.mock.method(process, "kill", (pid, signal) => {
    assert.equal(signal, 0);
    if (pid === process.pid) return true;
    throw Object.assign(new Error("PID 확인 실패"), { code: pid === 456 ? "EPERM" : "ESRCH" });
  });
  new LocalJsonLolProfileRepository(filePath);
  for (const [suffix, , preserved] of cases) {
    assert.equal(fs.existsSync(`${filePath}.${suffix}`), preserved, suffix);
  }
  assert.equal(kill.mock.callCount(), 3);
});

test("종료 flush 최초 실패는 후속 flush 성공 후에도 원인이 로그에 남는다", async () => {
  const source = fs.readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  const start = source.indexOf("  server.close((error) => {");
  const end = source.indexOf("\n  server.closeIdleConnections", start);
  assert.ok(start >= 0 && end > start);
  const logs = [];
  const state = { exitCode: undefined };
  const failure = new Error("최초 디스크 교체 실패");
  let attempts = 0;
  const repository = { flush() { if (++attempts === 1) throw failure; } };
  await new Promise((resolve, reject) => {
    runInNewContext(source.slice(start, end), {
      server: { close(callback) { callback(new Error("HTTP 종료 실패")); } },
      forceTimer: undefined,
      clearTimeout,
      store: { closeAsync() {} },
      closeDatabasePool() {},
      lolProfileRepository: repository,
      logger: {
        error(entry) { logs.push({ ...entry }); if (entry.type === "server.shutdown_failed") resolve(); },
        event() { reject(new Error("실패 종료가 성공 처리됨")); }
      },
      toSafeErrorMessage: (error) => error.message,
      process: state,
      signal: "SIGTERM"
    });
  });
  repository.flush();
  assert.equal(attempts, 2);
  assert.equal(state.exitCode, 1);
  assert.deepEqual(logs[0], {
    type: "lol_profile.shutdown_persistence_failed",
    signal: "SIGTERM",
    error: failure.message
  });
});

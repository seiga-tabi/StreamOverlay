import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  loadFixedSecret,
  loadYoroLegalConfig,
  loadYoroRuntimeConfig
} from "../dist/runtime-configuration.js";

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "yoro-runtime-config-"));
}

test("runtime config는 strict schema로 읽는다", () => {
  const directory = temporaryDirectory();
  const file = path.join(directory, "runtime.json");
  fs.writeFileSync(file, JSON.stringify({
    schemaVersion: 1,
    environment: "development",
    public: {
      baseUrl: "http://localhost:3000",
      dashboardOrigin: "http://localhost:3000"
    },
    features: {
      database: false,
      discordSaas: false,
      discordBot: false,
      discordBotManagement: false,
      twitchEventSub: false
    }
  }), { mode: 0o644 });
  const config = loadYoroRuntimeConfig(file);
  assert.equal(config.environment, "development");
  fs.rmSync(directory, { recursive: true });
});

test("secret loader는 0600 파일의 마지막 개행만 제거한다", () => {
  const directory = temporaryDirectory();
  const file = path.join(directory, "secret");
  fs.writeFileSync(file, "안전한-비밀값\n", { mode: 0o600 });
  assert.equal(loadFixedSecret(file, { required: true }), "안전한-비밀값");
  fs.rmSync(directory, { recursive: true });
});

test("secret loader는 symlink와 열린 권한을 거부한다", () => {
  const directory = temporaryDirectory();
  const source = path.join(directory, "source");
  const link = path.join(directory, "link");
  fs.writeFileSync(source, "안전한-비밀값", { mode: 0o644 });
  fs.symlinkSync(source, link);
  assert.throws(() => loadFixedSecret(source, { required: true }), /secret_permissions_invalid/u);
  assert.throws(() => loadFixedSecret(link, { required: true }), /file_not_regular/u);
  fs.rmSync(directory, { recursive: true });
});

test("필수가 아닌 누락 secret은 읽지 않은 상태로 반환한다", () => {
  const directory = temporaryDirectory();
  assert.equal(loadFixedSecret(path.join(directory, "missing")), "");
  fs.rmSync(directory, { recursive: true });
});

test("legal config는 알 수 없는 필드를 거부한다", () => {
  const directory = temporaryDirectory();
  const file = path.join(directory, "legal.json");
  fs.writeFileSync(file, JSON.stringify({
    operatorName: "운영자",
    contactAddress: "운영자 주소",
    privacyOfficerName: "책임자",
    contactEmail: "support@yoro.gg",
    contactPhone: "",
    effectiveDate: "2026-01-01",
    minimumAge: 14,
    governingLawKo: "대한민국 법률",
    governingLawJa: "日本国法",
    disputeVenueKo: "관할 문구",
    disputeVenueJa: "管轄文言",
    processorsKo: "처리 위탁 문구",
    processorsJa: "処理委託文言",
    crossBorderTransferKo: "국외 이전 문구",
    crossBorderTransferJa: "国外移転文言",
    secret: "금지"
  }), { mode: 0o644 });
  assert.throws(() => loadYoroLegalConfig(file), /legal_schema_invalid/u);
  fs.rmSync(directory, { recursive: true });
});

test("runtime config가 있으면 legacy env feature override를 무시한다", () => {
  const directory = temporaryDirectory();
  const runtime = path.join(directory, "runtime.json");
  fs.writeFileSync(runtime, JSON.stringify({
    schemaVersion: 1,
    environment: "development",
    public: {
      baseUrl: "http://localhost:3000",
      dashboardOrigin: "http://localhost:3000"
    },
    features: {
      database: false,
      discordSaas: false,
      discordBot: false,
      discordBotManagement: false,
      twitchEventSub: false
    }
  }), { mode: 0o644 });
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "import('./dist/config.js').then(({appConfig})=>process.stdout.write(JSON.stringify({",
        "source:appConfig.configurationSource,",
        "database:appConfig.database.enabled,",
        "databaseTimeout:appConfig.database.connectionTimeoutMs,",
        "discordTtl:appConfig.discordSaas.setupLinkTtlSeconds,",
        "logFiles:appConfig.logging.maxFiles",
        "})))"
      ].join("")
    ],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      env: {
        ...process.env,
        YORO_CONFIG_FILE: runtime,
        DATABASE_ENABLED: "true",
        DATABASE_URL_FILE: "/존재하지-않는-경로",
        DATABASE_CONNECTION_TIMEOUT_MS: "29999",
        DISCORD_SETUP_LINK_TTL_SECONDS: "1799",
        LOG_MAX_FILES: "19"
      }
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    source: "runtime_file",
    database: false,
    databaseTimeout: 5_000,
    discordTtl: 600,
    logFiles: 5
  });
  fs.rmSync(directory, { recursive: true });
});

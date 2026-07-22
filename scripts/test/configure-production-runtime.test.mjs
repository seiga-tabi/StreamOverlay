import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const command = path.join(projectRoot, "scripts/configure-production-runtime.mjs");

function completeLegalConfig() {
  return [
    "LEGAL_OPERATOR_NAME=홍길동",
    "LEGAL_CONTACT_ADDRESS=대한민국 서울특별시 운영 연락처",
    "LEGAL_PRIVACY_OFFICER_NAME=홍길동",
    "LEGAL_CONTACT_EMAIL=support@yoro.gg",
    "LEGAL_EFFECTIVE_DATE=2026-07-16",
    "LEGAL_MINIMUM_AGE=14",
    "LEGAL_GOVERNING_LAW_KO=대한민국 법률",
    "LEGAL_GOVERNING_LAW_JA=日本国法令",
    "LEGAL_DISPUTE_VENUE_KO=대한민국 관할 법원",
    "LEGAL_DISPUTE_VENUE_JA=日本国内の管轄裁判所",
    "LEGAL_PROCESSORS_KO=Cloudflare의 콘텐츠 전송 및 보안 처리",
    "LEGAL_PROCESSORS_JA=Cloudflareによるコンテンツ配信およびセキュリティ処理",
    "LEGAL_CROSS_BORDER_TRANSFER_KO=암호화 통신을 통한 미국 소재 시스템의 서비스 처리",
    "LEGAL_CROSS_BORDER_TRANSFER_JA=暗号化通信による米国所在システムでのサービス処理"
  ].join("\n");
}

function runConfigure(envFile, extraArguments = []) {
  return spawnSync(
    process.execPath,
    [command, "--domain", "yoro.gg", "--env-file", envFile, ...extraArguments],
    { cwd: projectRoot, encoding: "utf8" }
  );
}

function parseEnv(text) {
  return new Map(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => {
        let value = match[2];
        if (value.startsWith("\"") && value.endsWith("\"")) value = JSON.parse(value);
        return [match[1], value];
      })
  );
}

async function skipWhenPalworldExternalSecretIsRequired(context) {
  const configPath = path.join(projectRoot, "apps/server/config/palworld-server-status.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (!config.enabled) return false;
  context.skip("활성 Palworld 서버 상태 설정의 실제 외부 secret을 읽지 않도록 production 설정 통합 테스트를 건너뜁니다.");
  return true;
}

test("production 설정 도구는 secret을 노출하지 않고 검증된 파일만 0600으로 기록한다", async (context) => {
  if (await skipWhenPalworldExternalSecretIsRequired(context)) return;
  const directory = await mkdtemp(path.join(os.tmpdir(), "yoro-runtime-"));
  const envFile = path.join(directory, ".env");
  await writeFile(
    envFile,
    [
      "NODE_ENV=development",
      "PUBLIC_BASE_URL=http://localhost:3000",
      "DASHBOARD_AUTH_TOKEN=change-me",
      "OVERLAY_ACCESS_TOKEN=",
      "BRIDGE_SHARED_SECRET=dev-secret-change-me",
      completeLegalConfig()
    ].join("\n"),
    "utf8"
  );

  const result = runConfigure(envFile, ["--write"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const text = await readFile(envFile, "utf8");
  const values = parseEnv(text);
  const secrets = [
    values.get("DASHBOARD_AUTH_TOKEN"),
    values.get("OVERLAY_ACCESS_TOKEN"),
    values.get("BRIDGE_SHARED_SECRET")
  ];
  assert.ok(secrets.every((value) => typeof value === "string" && value.length >= 32));
  assert.equal(new Set(secrets).size, secrets.length);
  for (const secret of secrets) {
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(values.get("PUBLIC_BASE_URL"), "https://yoro.gg");
  assert.equal(values.get("CORS_ORIGINS"), "https://yoro.gg");
  assert.equal((await stat(envFile)).mode & 0o777, 0o600);
});

test("production 설정 도구는 법적 운영정보가 미완료이면 원본을 변경하지 않는다", async (context) => {
  if (await skipWhenPalworldExternalSecretIsRequired(context)) return;
  const directory = await mkdtemp(path.join(os.tmpdir(), "yoro-runtime-invalid-"));
  const envFile = path.join(directory, ".env");
  const original = "NODE_ENV=development\nOVERLAY_ACCESS_TOKEN=\n";
  await writeFile(envFile, original, "utf8");

  const result = runConfigure(envFile, ["--write"]);
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(envFile, "utf8"), original);
  assert.match(result.stderr, /LEGAL_OPERATOR_NAME/);
});

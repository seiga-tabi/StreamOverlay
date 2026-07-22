import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  PalworldServerConnectionSummary,
  PalworldServerDashboardResponse,
  PalworldServerStatus
} from "@streamops/shared";
import { Layout } from "../src/components/Layout";
import {
  PalworldServerAvailabilityNotice,
  palworldServerAvailabilityCode
} from "../src/features/palworld-server/components/PalworldServerAvailabilityNotice";
import { PalworldServerConnectionForm } from "../src/features/palworld-server/components/PalworldServerConnectionForm";
import { PalworldServerStatusPanel } from "../src/features/palworld-server/components/PalworldServerStatusPanel";
import { canReusePalworldServerPassword } from "../src/features/palworld-server/connection";
import { palworldServerText } from "../src/features/palworld-server/i18n";
import { setDashboardLocale } from "../src/i18n";

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "http://dashboard.test" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    }
  }
});

const connection: PalworldServerConnectionSummary = {
  configured: true,
  baseUrl: "https://palworld.example.com:8212",
  passwordConfigured: true,
  updatedAt: "2026-07-22T10:00:00.000Z"
};

const status: PalworldServerStatus = {
  state: "online",
  checkedAt: "2026-07-22T10:01:00.000Z",
  lastSuccessAt: "2026-07-22T10:01:00.000Z",
  latencyMs: 42,
  consecutiveFailures: 0,
  info: { serverName: "YORO Palworld", version: "v0.6.6" },
  metrics: {
    serverFps: 60,
    currentPlayers: 3,
    maxPlayers: 32,
    frameTimeMs: 16.67,
    uptimeSeconds: 3_661,
    baseCampCount: 5,
    gameDays: 123
  },
  diagnostics: [
    { key: "url_policy", state: "passed" },
    { key: "dns_tcp", state: "passed" },
    { key: "tls", state: "passed" },
    { key: "basic_auth", state: "passed" },
    { key: "info", state: "passed" },
    { key: "metrics", state: "passed" },
    { key: "schema", state: "passed" }
  ]
};

test("스트리머 메뉴에 펠월드 서버 상태가 표시되고 관리자 메뉴에서는 제외된다", () => {
  const streamerHtml = renderToStaticMarkup(
    <Layout
      locale="ko"
      onLocaleChange={() => undefined}
      page="palworldServer"
      role="streamer"
      setPage={() => undefined}
    >
      <div>펠월드 서버 본문</div>
    </Layout>
  );
  const adminHtml = renderToStaticMarkup(
    <Layout
      locale="ko"
      onLocaleChange={() => undefined}
      page="palworldServer"
      role="admin"
      setPage={() => undefined}
    >
      <div>관리자 본문</div>
    </Layout>
  );

  assert.match(streamerHtml, /class="nav-item active"[^>]*data-ko="서버 상태"/);
  assert.match(streamerHtml, /펠월드/);
  assert.doesNotMatch(adminHtml, /data-ko="서버 상태"/);
});

test("펠월드 서버 페이지 초기 로딩은 공통 Skeleton을 표시한다", async () => {
  const { PalworldServerPage } = await import("../src/pages/PalworldServerPage");
  setDashboardLocale("ko");
  const html = renderToStaticMarkup(<PalworldServerPage />);

  assert.match(html, /aria-label="펠월드 서버 상태를 불러오는 중입니다\."/);
  assert.match(html, /상태 새로고침/);
  assert.match(html, /disabled=""/);
});

test("연결 설정은 저장된 비밀번호를 다시 출력하지 않고 변경 입력만 허용한다", () => {
  const html = renderToStaticMarkup(
    <PalworldServerConnectionForm
      adminPassword=""
      baseUrl={connection.baseUrl ?? ""}
      connection={connection}
      onAdminPasswordChange={() => undefined}
      onBaseUrlChange={() => undefined}
      onRemove={() => undefined}
      onSave={() => undefined}
      onTest={() => undefined}
      text={palworldServerText("ko")}
    />
  );

  assert.match(html, /type="password"/);
  assert.match(html, /value=""/);
  assert.doesNotMatch(html, /adminPassword/);
  assert.match(html, /비워 두면 저장된 비밀번호를 유지합니다/);
  assert.match(html, /게임 접속 비밀번호가 아닌 AdminPassword를 입력하세요/);
  assert.match(html, /연결 설정 삭제/);
});

test("저장된 비밀번호는 같은 canonical URL에서만 재사용한다", () => {
  assert.equal(
    canReusePalworldServerPassword("https://palworld.example.com:8212/", "https://palworld.example.com:8212", true),
    true
  );
  assert.equal(
    canReusePalworldServerPassword("https://palworld.example.com:8212/", "https://other.example.com:8212/", true),
    false
  );
  assert.equal(
    canReusePalworldServerPassword("https://palworld.example.com:8212/", "https://palworld.example.com:8212/", false),
    false
  );
});

test("운영 준비 오류는 연결 미설정과 구분해 한국어·일본어 안내를 표시한다", () => {
  const cases = [
    ["disabled", "전용 서버 상태 확인이 비활성화되어 있습니다", "専用サーバーの状態確認が無効です"],
    ["config_missing", "전용 서버 연동 설정이 준비되지 않았습니다", "専用サーバー連携の設定が準備されていません"],
    ["config_invalid", "전용 서버 연동 설정을 확인해야 합니다", "専用サーバー連携の設定を確認してください"],
    ["key_missing", "자격 증명 보호 설정이 준비되지 않았습니다", "認証情報の保護設定が準備されていません"],
    ["key_invalid", "자격 증명 보호 설정을 확인해야 합니다", "認証情報の保護設定を確認してください"],
    ["policy_missing", "전용 서버 접속 허용 정책이 준비되지 않았습니다", "専用サーバーの接続許可ポリシーが準備されていません"]
  ] as const;

  for (const [code, koreanTitle, japaneseTitle] of cases) {
    const korean = renderToStaticMarkup(
      <PalworldServerAvailabilityNotice code={code} text={palworldServerText("ko")} />
    );
    const japanese = renderToStaticMarkup(
      <PalworldServerAvailabilityNotice code={code} text={palworldServerText("ja")} />
    );
    assert.match(korean, new RegExp(`data-availability-code="${code}"`));
    assert.match(korean, new RegExp(koreanTitle));
    assert.match(japanese, new RegExp(japaneseTitle));
    assert.doesNotMatch(korean, /type="password"|adminPassword|\/run\/secrets|\.streamops/);
    assert.doesNotMatch(japanese, /type="password"|adminPassword|\/run\/secrets|\.streamops/);
  }
});

test("feature 준비 상태와 스트리머 연결 미설정 상태를 혼동하지 않는다", () => {
  const baseResponse: PalworldServerDashboardResponse = {
    enabled: true,
    pollIntervalSeconds: 30,
    connection: { configured: false, passwordConfigured: false },
    status: {
      state: "not_configured",
      errorCode: "not_configured",
      consecutiveFailures: 0,
      diagnostics: status.diagnostics.map((entry) => ({ ...entry, state: "skipped" }))
    }
  };

  assert.equal(palworldServerAvailabilityCode(baseResponse), undefined);
  assert.equal(palworldServerAvailabilityCode({
    ...baseResponse,
    enabled: false,
    status: { ...baseResponse.status, errorCode: "disabled" }
  }), "disabled");
  assert.equal(palworldServerAvailabilityCode({
    ...baseResponse,
    status: { ...baseResponse.status, errorCode: "key_missing" }
  }), "key_missing");
});

test("서버 상태 패널은 지표와 단계별 진단을 한국어와 일본어로 표시한다", () => {
  const korean = renderToStaticMarkup(
    <PalworldServerStatusPanel
      connection={connection}
      locale="ko"
      status={status}
      text={palworldServerText("ko")}
    />
  );
  const japanese = renderToStaticMarkup(
    <PalworldServerStatusPanel
      connection={connection}
      locale="ja"
      status={{ ...status, state: "auth_failed", errorCode: "auth_failed" }}
      text={palworldServerText("ja")}
    />
  );

  assert.match(korean, /YORO Palworld/);
  assert.match(korean, /3 \/ 32/);
  assert.match(korean, /DNS·TCP 연결/);
  assert.match(korean, /Basic 인증/);
  assert.match(japanese, /認証失敗/);
  assert.match(japanese, /管理者パスワードの認証に失敗しました/);
  assert.match(japanese, /リアルタイム指標/);
});

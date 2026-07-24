import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  PalworldServerConnectionSummary,
  PalworldServerDashboardResponse,
  PalworldServerRegistrationPolicy,
  PalworldServerStatus
} from "@streamops/shared";
import { Layout } from "../src/components/Layout";
import {
  PalworldServerAvailabilityNotice,
  palworldServerAvailabilityCode
} from "../src/features/palworld-server/components/PalworldServerAvailabilityNotice";
import { PalworldServerConnectionForm } from "../src/features/palworld-server/components/PalworldServerConnectionForm";
import { PalworldServerStatusPanel } from "../src/features/palworld-server/components/PalworldServerStatusPanel";
import {
  canReusePalworldServerPassword,
  createTransientPalworldAdminPasswordState
} from "../src/features/palworld-server/connection";
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

const registrationPolicy: PalworldServerRegistrationPolicy = {
  publicHttpsSelfService: true,
  publicHttpsPort: 443,
  privateNetworkRequiresOperatorApproval: true
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
      registrationPolicy={registrationPolicy}
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
  assert.match(html, /게임 접속 비밀번호나 Dashboard 로그인 비밀번호가 아닙니다/);
  assert.match(html, /Dashboard 자격 증명 전용 AES key/);
  assert.match(html, /placeholder="https:\/\/palworld\.example\.com"/);
  assert.match(html, /연결 설정 삭제/);
});

test("등록 정책은 한국어·일본어로 공개 HTTPS 443, 사설망 승인, 공개 HTTP 차단을 안내한다", () => {
  const render = (locale: "ko" | "ja") => renderToStaticMarkup(
    <PalworldServerConnectionForm
      adminPassword=""
      baseUrl=""
      connection={{ configured: false, passwordConfigured: false }}
      registrationPolicy={registrationPolicy}
      onAdminPasswordChange={() => undefined}
      onBaseUrlChange={() => undefined}
      onRemove={() => undefined}
      onSave={() => undefined}
      onTest={() => undefined}
      text={palworldServerText(locale)}
    />
  );
  const korean = render("ko");
  const japanese = render("ja");

  assert.match(korean, /HTTPS 443 포트만 직접 등록 가능/);
  assert.match(korean, /브라우저는 Palworld 서버에 직접 연결하지 않습니다/);
  assert.match(korean, /사설망·LAN·VPN 주소: 서버 운영자의 사전 승인 필요/);
  assert.match(korean, /공개 HTTP 주소: 등록 불가/);
  assert.match(japanese, /HTTPS の 443 ポートのみ直接登録可能/);
  assert.match(japanese, /ブラウザは Palworld サーバーへ直接接続しません/);
  assert.match(japanese, /サーバー運用者の事前承認が必要/);
  assert.match(japanese, /公開 HTTP アドレス: 登録不可/);
  assert.doesNotMatch(korean, /allowlist 편집|owner 전용|관리자 승인 버튼/);
  assert.doesNotMatch(japanese, /allowlist 編集|owner 専用|管理者承認ボタン/);
});

test("자가 등록이 비활성화되면 공개 HTTPS도 운영자 정책 승인 대상으로 안내한다", () => {
  const operatorPolicy: PalworldServerRegistrationPolicy = {
    publicHttpsSelfService: false,
    publicHttpsPort: 443,
    privateNetworkRequiresOperatorApproval: true
  };
  const render = (locale: "ko" | "ja") => renderToStaticMarkup(
    <PalworldServerConnectionForm
      adminPassword=""
      baseUrl=""
      connection={{ configured: false, passwordConfigured: false }}
      registrationPolicy={operatorPolicy}
      onAdminPasswordChange={() => undefined}
      onBaseUrlChange={() => undefined}
      onRemove={() => undefined}
      onSave={() => undefined}
      onTest={() => undefined}
      text={palworldServerText(locale)}
    />
  );
  const korean = render("ko");
  const japanese = render("ja");

  assert.match(korean, /공개 HTTPS 주소\(별도 포트 포함\): 서비스 운영자의 접속 정책 승인 필요/);
  assert.match(korean, /공개·사설 REST API 주소 모두 운영자의 접속 정책 승인 후 등록/);
  assert.doesNotMatch(korean, /HTTPS 443 포트만 직접 등록 가능/);
  assert.match(japanese, /公開 HTTPS アドレス（別ポートを含む）: サービス運営者による接続ポリシーの承認が必要/);
  assert.match(japanese, /公開・プライベートの REST API URL は、いずれも運用者の接続ポリシー承認後に登録/);
  assert.doesNotMatch(japanese, /HTTPS の 443 ポートのみ直接登録可能/);
});

test("AdminPassword 임시 상태는 작업 성공·실패와 unmount에서 정리된다", async () => {
  for (const operation of [
    () => Promise.resolve(),
    () => Promise.reject(new Error("예상된 테스트 실패"))
  ]) {
    const commits: string[] = [];
    const passwordState = createTransientPalworldAdminPasswordState((value) => commits.push(value));
    passwordState.update("테스트용-AdminPassword");
    try {
      await operation();
    } catch {
      // 실패 여부와 관계없이 finally에서 입력을 정리하는 페이지 동작을 검증한다.
    } finally {
      passwordState.finishOperation();
    }
    assert.equal(passwordState.current(), "");
    assert.equal(commits.at(-1), "");
  }

  const unmountCommits: string[] = [];
  const unmountedState = createTransientPalworldAdminPasswordState((value) => unmountCommits.push(value));
  unmountedState.update("unmount-전용-AdminPassword");
  const commitsBeforeUnmount = unmountCommits.length;
  unmountedState.dispose();
  assert.equal(unmountedState.current(), "");
  assert.equal(unmountCommits.length, commitsBeforeUnmount, "unmount cleanup은 React state를 갱신하지 않아야 합니다.");
});

test("정책 거부와 rate limit 오류는 한국어·일본어 안전 문구로 구분한다", async () => {
  const { DashboardApiError } = await import("../src/api/client");
  const {
    palworldServerOperationFailureDescription,
    palworldServerOperationStatusDescription
  } = await import("../src/pages/PalworldServerPage");
  const policyError = new DashboardApiError("내부 상세를 표시하지 않음", 400, "origin_not_allowed");
  const rateLimitError = new DashboardApiError("내부 상세를 표시하지 않음", 429, "rate_limited");

  assert.equal(
    palworldServerOperationFailureDescription(policyError, palworldServerText("ko")),
    "이 주소는 공개 HTTPS 자가 등록 조건을 충족하지 않습니다. 사설망 또는 별도 포트를 사용하는 서버는 서비스 운영자의 접속 정책 승인이 필요합니다."
  );
  assert.equal(
    palworldServerOperationFailureDescription(policyError, palworldServerText("ja")),
    "このアドレスは公開 HTTPS のセルフ登録条件を満たしていません。プライベートネットワークまたは別ポートを使用するサーバーには、サービス運営者による接続ポリシーの承認が必要です。"
  );
  assert.match(
    palworldServerOperationFailureDescription(rateLimitError, palworldServerText("ko")),
    /요청이 너무 많습니다/
  );
  for (const code of ["key_invalid", "key_permission_denied", "key_mismatch", "state_damaged"] as const) {
    const safeError = new DashboardApiError("내부 상세를 표시하지 않음", 503, code);
    const description = palworldServerOperationFailureDescription(safeError, palworldServerText("ko"));
    assert.equal(description, palworldServerText("ko").errorCodes[code]);
    assert.doesNotMatch(description, /AdminPassword|\/run\/secrets|ciphertext|https?:\/\//u);
  }
  assert.equal(
    palworldServerOperationStatusDescription({
      connection: { configured: false, passwordConfigured: true },
      status: {
        state: "blocked_by_policy",
        errorCode: "address_blocked",
        consecutiveFailures: 1,
        diagnostics: [
          { key: "url_policy", state: "passed" },
          { key: "dns_tcp", state: "failed", errorCode: "address_blocked" },
          { key: "tls", state: "skipped" },
          { key: "basic_auth", state: "skipped" },
          { key: "info", state: "skipped" },
          { key: "metrics", state: "skipped" },
          { key: "schema", state: "skipped" }
        ]
      }
    }, palworldServerText("ko"), "fallback"),
    palworldServerText("ko").registrationPolicyRejected
  );
});

test("Palworld Dashboard API는 안전한 서버 오류 code를 보존한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: "허용된 Palworld REST API URL을 입력해야 합니다.",
    code: "origin_not_allowed"
  }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  })) as typeof fetch;
  try {
    const { DashboardApiError } = await import("../src/api/client");
    const { testPalworldServerConnection } = await import("../src/features/palworld-server/api");
    await assert.rejects(
      () => testPalworldServerConnection({
        baseUrl: "https://palworld.example.com:8212",
        adminPassword: "테스트용-AdminPassword"
      }),
      (error) => error instanceof DashboardApiError
        && error.status === 400
        && error.code === "origin_not_allowed"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Palworld Dashboard API는 등록 정책이 누락된 구버전 응답을 fail-closed 처리한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    enabled: true,
    pollIntervalSeconds: 30,
    connection,
    status
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  })) as typeof fetch;
  try {
    const { getPalworldServerDashboard } = await import("../src/features/palworld-server/api");
    await assert.rejects(
      () => getPalworldServerDashboard(),
      /Palworld Dashboard 응답 검증에 실패했습니다\./
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
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
    ["key_missing", "StreamOverlay의 자격 증명 저장소가 준비되지 않았습니다", "StreamOverlay の認証情報ストレージが準備されていません"],
    ["key_invalid", "StreamOverlay의 공통 암호화 key 형식을 확인해야 합니다", "StreamOverlay の共通暗号化 key の形式を確認してください"],
    ["key_permission_denied", "StreamOverlay가 자격 증명 저장소를 읽을 수 없습니다", "StreamOverlay が認証情報ストレージを読み取れません"],
    ["key_mismatch", "기존 자격 증명 저장소를 현재 암호화 key로 열 수 없습니다", "現在の暗号化 key では既存の認証情報ストレージを開けません"],
    ["state_damaged", "StreamOverlay의 자격 증명 저장소 상태를 복구해야 합니다", "StreamOverlay の認証情報ストレージ状態を復旧してください"],
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
    if (code.startsWith("key_") || code === "state_damaged") {
      assert.match(korean, /입력한 Palworld 관리자 비밀번호의 문제가 아닙니다/);
      assert.match(japanese, /入力した Palworld 管理者パスワードの問題ではありません/);
    }
    assert.doesNotMatch(korean, /type="password"|adminPassword|\/run\/secrets|\.streamops/);
    assert.doesNotMatch(japanese, /type="password"|adminPassword|\/run\/secrets|\.streamops/);
  }
});

test("feature 준비 상태와 스트리머 연결 미설정 상태를 혼동하지 않는다", () => {
  const baseResponse: PalworldServerDashboardResponse = {
    enabled: true,
    pollIntervalSeconds: 30,
    registrationPolicy,
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
  assert.match(japanese, /Palworld AdminPassword の認証に失敗しました/);
  assert.match(japanese, /リアルタイム指標/);
});

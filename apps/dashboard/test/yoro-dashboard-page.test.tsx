import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

Object.defineProperty(globalThis, "React", {
  configurable: true,
  value: React
});

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { language: "ko-KR" }
});

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    __STREAMOPS_CONFIG__: { apiBase: "" },
    localStorage: {
      getItem: () => null,
      setItem: () => undefined
    },
    navigator: { language: "ko-KR" },
    location: {
      assign: () => undefined,
      pathname: "/dashboard",
      search: ""
    },
    history: {
      pushState: () => undefined,
      replaceState: () => undefined
    },
    dispatchEvent: () => true,
    scrollTo: () => undefined,
    setTimeout,
    clearTimeout
  }
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: {
      dataset: {},
      lang: "ko"
    }
  }
});

test("공통 YORO Dashboard는 로그인 사용자용 진입점과 KO·JA 문구를 제공한다", async () => {
  const { YoroDashboardPage } = await import(
    "../src/features/yoro-dashboard/YoroDashboardPage"
  );
  const source = await readFile(
    new URL("../src/features/yoro-dashboard/YoroDashboardPage.tsx", import.meta.url),
    "utf8"
  );
  const markup = renderToStaticMarkup(<YoroDashboardPage />);

  assert.match(markup, /Dashboard를 불러오는 중입니다/u);
  assert.match(source, /연결 계정/u);
  assert.match(source, /連携アカウント/u);
  assert.match(source, /Organization·Bot/u);
  assert.match(source, /Organization・Bot/u);
  assert.match(source, /updateAccountPreferences/u);
  assert.equal(source.includes("localStorage.setItem"), false);
});

test("공통 Dashboard 경로는 기존 방송 운영 하위 경로와 겹치지 않는다", async () => {
  const { yoroDashboardPageFromPath } = await import(
    "../src/features/yoro-dashboard/YoroDashboardPage"
  );
  assert.equal(yoroDashboardPageFromPath("/dashboard"), "overview");
  assert.equal(yoroDashboardPageFromPath("/dashboard/account"), "account");
  assert.equal(
    yoroDashboardPageFromPath("/dashboard/organizations/"),
    "organizations"
  );
  assert.equal(yoroDashboardPageFromPath("/dashboard/settings"), "settings");

  const appSource = await readFile(
    new URL("../src/App.tsx", import.meta.url),
    "utf8"
  );
  assert.match(appSource, /YORO_DASHBOARD_PATHS/u);
  assert.equal(
    appSource.includes("!isYoroDashboardPath(window.location.pathname)"),
    true
  );
  assert.equal(
    appSource.includes('window.location.pathname.startsWith("/dashboard/")'),
    true
  );
});

# YORO.gg Sprint2 Specification

## 1. Sprint 목표

Sprint2는 Dashboard Shell과 Shared UI 도입 Sprint다. 기존 page는 유지하고 shell, navigation, layout, 공통 component부터 정리한다.

## 2. 작업 순서

```text
Shared Button
  -> Shared Card
  -> MetricCard
  -> PageHeader
  -> Layout Adapter
  -> Navigation Data
  -> Role Gate Adapter
  -> Dashboard Shell Flag
```

## 3. 파일 단위 작업 순서

| 순서 | 파일 | 작업 | Risk |
|---:|---|---|---|
| 1 | `apps/dashboard/src/components/StatusCard.tsx` | MetricCard migration seed | Low |
| 2 | `apps/dashboard/src/components/EventLog.tsx` | shared panel 적용 후보 | Low |
| 3 | `apps/dashboard/src/components/Layout.tsx` | AppShell adapter | Medium |
| 4 | `apps/dashboard/src/App.tsx` | shell flag boundary | Medium |
| 5 | `apps/dashboard/src/components/LoginPage.tsx` | AuthEntry adapter | Medium |
| 6 | `apps/dashboard/src/pages/DashboardPage.tsx` | Today Broadcast placeholder boundary | Medium |
| 7 | `apps/dashboard/src/pages/TwitchConnectionPage.tsx` | PageHeader/Card 적용 | Medium |
| 8 | `apps/dashboard/src/pages/SettingsPage.tsx` | low-risk shared UI 적용 | Low |

## 4. Component 단위 순서

1. Button
2. Card
3. MetricCard
4. PageHeader
5. AppShell
6. Sidebar
7. TopBar
8. RoleGate
9. AuthEntry

## 5. Page 단위 순서

1. Settings
2. TwitchConnection
3. Dashboard
4. Login

High-risk page는 Sprint2에서 건드리지 않는다.

## 6. Feature Flag

- `YORO_SHARED_UI_V2_ENABLED`
- `YORO_DASHBOARD_SHELL_V2_ENABLED`

Flag off 시 기존 `Layout`/`App.tsx` 흐름으로 돌아가야 한다.

## 7. Legacy 유지 전략

- 기존 page component 유지
- 기존 `pages` array와 role allowlist fallback 유지
- 기존 login flow 유지
- existing dashboard socket 유지

## 8. QA Gate

- admin login
- streamer login
- role별 menu visibility
- mobile navigation
- dashboard socket connected indicator
- visual regression <= 기준
- build/type/test/config

## 9. 완료 조건

- shell 변경이 page behavior를 바꾸지 않음
- streamer/admin 권한 노출 오류 없음
- shared UI component가 token 사용
- fallback 동작 가능


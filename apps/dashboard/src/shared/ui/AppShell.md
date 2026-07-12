# AppShell API

`AppShell`은 YORO.gg dashboard 계열 화면에서 Public, User, Streamer, Admin surface를 같은 구조로 구성하기 위한 layout foundation이다. 기존 `Layout`이나 page에는 아직 적용하지 않는다.

## Import

```tsx
import {
  AppShell,
  AppShellFooter,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from "./shared/ui";
import type { AppShellProps, AppShellVariant } from "./shared/ui";
```

## Structure

```tsx
<AppShell variant="streamer" sidebarMode="drawer" sidebarOpen={isOpen}>
  <AppShellHeader>...</AppShellHeader>
  <AppShellSidebar as="nav" aria-label="Streamer Studio">...</AppShellSidebar>
  <AppShellMain>...</AppShellMain>
  <AppShellFooter>...</AppShellFooter>
</AppShell>
```

## Props

| Prop | Type | Default | 설명 |
|---|---|---|---|
| `variant` | `"public" | "user" | "streamer" | "admin"` | `"public"` | surface별 shell variant |
| `sidebarMode` | `"static" | "drawer"` | `"static"` | desktop sidebar 또는 mobile drawer 구조 |
| `sidebarOpen` | `boolean` | `false` | drawer sidebar open state |
| `mainId` | `string` | `"yoro-app-shell-main"` | skip link target id |
| `skipLinkLabel` | `ReactNode` | `"본문으로 이동"` | 접근성 skip link label |
| `showSkipLink` | `boolean` | `true` | skip link 표시 여부 |
| `as` | `"div" | "section"` | `"div"` | root element |
| `renderRoot` | `(props: AppShellRootRenderProps) => ReactElement` | 없음 | custom root 확장 |

## Components

| Component | 역할 |
|---|---|
| `AppShell` | 전체 shell root |
| `AppShellHeader` | 상단 product/header 영역 |
| `AppShellSidebar` | navigation/sidebar 영역, `as="nav"` 지원 |
| `AppShellMain` | 본문 영역, 기본 `main`과 skip link target 제공 |
| `AppShellFooter` | footer 영역 |

## Accessibility

- `AppShell`은 기본 skip link를 렌더링한다.
- `AppShellMain`은 기본 `id="yoro-app-shell-main"`과 `tabIndex={-1}`을 가진다.
- `AppShellSidebar as="nav"` 사용 시 caller가 `aria-label`을 제공해야 한다.
- drawer open/close 제어는 caller state와 `sidebarOpen` 또는 `AppShellSidebar open`으로 연결한다.

## Design Token

- 색상, spacing, shadow, radius, motion, z-index는 `--yoro-*` token만 사용한다.
- raw hex/rgb/gradient/임의 px를 추가하지 않는다.
- 기존 화면에는 연결하지 않아 visual 변경이 없다.

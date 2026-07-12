# Navigation API

`Navigation`은 YORO.gg shared UI에서 Public, User, Streamer, Admin surface의 sidebar/drawer navigation을 같은 구조로 구성하기 위한 foundation이다. 기존 route, menu, sidebar에는 아직 적용하지 않는다.

## Import

```tsx
import {
  Navigation,
  NavigationBadge,
  NavigationGroup,
  NavigationItem,
  NavigationSection,
} from "./shared/ui";
import type { NavigationProps, NavigationVariant } from "./shared/ui";
```

## Structure

```tsx
<Navigation variant="streamer" aria-label="Streamer Studio">
  <NavigationSection title="방송 운영">
    <NavigationItem as="a" href="/dashboard" active icon={<Icon />}>
      오늘 방송
    </NavigationItem>
    <NavigationItem as="a" href="/overlay">
      Overlay
      <NavigationBadge>3</NavigationBadge>
    </NavigationItem>
  </NavigationSection>
</Navigation>
```

## Props

| Component | 주요 Props | 설명 |
|---|---|---|
| `Navigation` | `variant`, `collapsed`, `keyboardNavigation`, `as`, `renderRoot` | navigation root |
| `NavigationSection` | `title`, `collapsed` | 큰 navigation section |
| `NavigationGroup` | `title`, `collapsed` | section 안의 하위 group |
| `NavigationItem` | `active`, `disabled`, `external`, `collapsed`, `icon`, `badge`, `as`, `renderRoot` | navigation action/link |
| `NavigationBadge` | `children` | item 오른쪽 badge |

## Variant

- `public`
- `user`
- `streamer`
- `admin`

## State

- default
- active: `aria-current="page"`와 `data-active="true"`
- disabled: `aria-disabled`, native `disabled`, click 방지
- external: anchor에서 기본 `target="_blank"`와 `rel="noreferrer"`
- collapsed: label/badge를 시각적으로 접고 icon 중심 구조 유지

## Keyboard

- root의 `keyboardNavigation` 기본값은 `true`다.
- `ArrowDown`, `ArrowRight`는 다음 item으로 이동한다.
- `ArrowUp`, `ArrowLeft`는 이전 item으로 이동한다.
- `Home`, `End`는 첫/마지막 item으로 이동한다.
- disabled item은 focus 이동 대상에서 제외한다.

## Design Token

- 색상, spacing, radius, shadow, typography, motion은 `--yoro-*` token만 사용한다.
- raw hex/rgb/gradient/임의 px를 추가하지 않는다.
- 기존 화면에는 연결하지 않아 visual 변경이 없다.

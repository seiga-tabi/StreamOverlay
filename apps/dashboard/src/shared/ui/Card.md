# Card API

`Card`는 YORO.gg shared UI에서 정보를 묶는 공통 surface component foundation이다. 기존 화면에는 아직 적용하지 않으며, page/card migration task에서만 사용한다.

## Import

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./shared/ui";
import type { CardPadding, CardProps, CardVariant } from "./shared/ui";
```

## Structure

```tsx
<Card variant="glass" padding="md">
  <CardHeader>
    <div>
      <CardTitle>방송 상태</CardTitle>
      <CardDescription>오늘 방송 운영에 필요한 상태를 표시한다.</CardDescription>
    </div>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

## Props

| Prop | Type | Default | 설명 |
|---|---|---|---|
| `variant` | `"default" | "glass" | "elevated" | "interactive" | "warning" | "danger"` | `"default"` | card surface 의미 |
| `padding` | `"none" | "sm" | "md" | "lg"` | `"md"` | card 내부 여백 |
| `as` | `"article" | "section" | "div" | "aside"` | `"article"` | semantic root element |
| `renderRoot` | `(props: CardRootRenderProps) => ReactElement` | 없음 | React Router Link 등 custom root 확장 |
| `disabled` | `boolean` | `false` | interactive card 비활성 상태 |

## Accessibility

- `interactive` variant에 `onClick`이 있으면 기본 `role="button"`과 keyboard activation을 제공한다.
- `Enter` 또는 `Space`로 interactive card를 실행할 수 있다.
- custom root는 `renderRoot`로 확장하되 전달받은 `role`, `tabIndex`, `onKeyDown`, `aria-disabled`를 보존해야 한다.
- 경고와 위험 상태는 `variant="warning"`, `variant="danger"`로 의미를 분리한다.

## Design Token

- 색상, spacing, radius, shadow, typography, motion은 `--yoro-*` token만 사용한다.
- raw hex/rgb/gradient/임의 px를 추가하지 않는다.

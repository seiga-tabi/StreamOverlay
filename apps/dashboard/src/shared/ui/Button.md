# Button API

`Button`은 YORO.gg shared UI에서 사용하는 공통 action component foundation이다. 기존 화면에는 아직 적용하지 않으며, 이후 component migration에서만 사용한다.

## Import

```tsx
import { Button } from "./shared/ui";
import type { ButtonProps, ButtonSize, ButtonVariant } from "./shared/ui";
```

## Props

| Prop | Type | Default | 설명 |
|---|---|---|---|
| `variant` | `"primary" | "secondary" | "tertiary" | "ghost" | "danger"` | `"primary"` | 버튼 시각 위계 |
| `size` | `"sm" | "md" | "lg"` | `"md"` | 버튼 크기 |
| `loading` | `boolean` | `false` | `aria-busy`와 중복 클릭 방지 적용 |
| `disabled` | `boolean` | `false` | `disabled` 또는 `aria-disabled` 적용 |
| `leftIcon` | `ReactNode` | 없음 | 왼쪽 icon slot |
| `rightIcon` | `ReactNode` | 없음 | 오른쪽 icon slot |
| `fullWidth` | `boolean` | `false` | 부모 폭을 채움 |
| `as` | `"button" | "a"` | `"button"` | native button 또는 anchor 렌더링 |
| `renderRoot` | `(props: ButtonRootRenderProps) => ReactElement` | 없음 | React Router Link 같은 custom root 확장 |

## 사용 예시

```tsx
<Button variant="primary">保存</Button>
<Button variant="danger" loading loadingLabel="処理中">削除</Button>
<Button as="a" href="/dashboard" variant="secondary">대시보드</Button>
```

React Router Link 확장은 dependency를 추가하지 않고 `renderRoot`로 연결한다.

```tsx
<Button
  renderRoot={(rootProps) => <Link to="/dashboard" {...rootProps} />}
  variant="ghost"
>
  방송 관리
</Button>
```

## 접근성 기준

- 최소 터치 영역은 `--yoro-size-touch-target`을 사용한다.
- `loading` 상태는 `aria-busy`를 사용하고 클릭을 차단한다.
- `disabled` 상태는 native button에서는 `disabled`, link/custom root에서는 `aria-disabled`를 사용한다.
- focus-visible은 `--yoro-shadow-focus` token을 사용한다.

# Form API

`Form` foundation은 YORO.gg shared UI에서 label, hint, error, input 상태를 일관되게 연결하기 위한 component set이다. 기존 로그인, 검색, 설정, 대회, 시참 폼에는 아직 적용하지 않는다.

## Import

```tsx
import {
  FormControl,
  FormError,
  FormField,
  FormHint,
  FormLabel,
  Input,
  Select,
  Textarea,
} from "./shared/ui";
import type { FormFieldProps, InputProps } from "./shared/ui";
```

## Structure

```tsx
<FormField invalid={hasError} required>
  <FormLabel>Riot ID</FormLabel>
  <FormControl>
    <Input placeholder="GameName#JP1" />
  </FormControl>
  <FormHint>게임 이름과 태그를 함께 입력한다.</FormHint>
  {hasError ? <FormError>Riot ID 형식을 확인해 주세요.</FormError> : null}
</FormField>
```

## Components

| Component | 역할 |
|---|---|
| `FormField` | field state와 control/hint/error id context |
| `FormLabel` | control과 `htmlFor` 자동 연결 |
| `FormControl` | input/select/textarea wrapper |
| `FormHint` | `aria-describedby` hint target |
| `FormError` | `aria-describedby` error target, 기본 `role="alert"` |
| `Input` | token 기반 input |
| `Textarea` | token 기반 textarea |
| `Select` | token 기반 select |

## State

- default
- focus: `focus-visible` token 사용
- disabled: native `disabled`, disabled style
- invalid: `aria-invalid`, error id 연결
- readonly: native `readOnly` 또는 `aria-readonly`
- loading: `aria-busy`, progress cursor

## Accessibility

- `FormField`는 control id, hint id, error id를 생성한다.
- `Input`, `Textarea`, `Select`는 같은 field 안에서 hint/error와 `aria-describedby`를 연결한다.
- invalid 상태에서는 `aria-invalid`가 적용된다.
- control의 최소 높이는 `--yoro-size-touch-target`을 사용한다.

## Design Token

- 색상, spacing, radius, shadow, typography, motion은 `--yoro-*` token만 사용한다.
- raw hex/rgb/gradient/임의 px를 추가하지 않는다.
- 기존 화면에는 연결하지 않아 visual 변경이 없다.

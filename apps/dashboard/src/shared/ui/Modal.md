# Modal

YORO.gg 공통 Modal/Dialog foundation component다. 기존 confirm, alert, 설정 modal, overlay modal은 즉시 교체하지 않고 이후 점진 migration에서 사용한다.

## Components

- `Modal`
- `ModalHeader`
- `ModalTitle`
- `ModalDescription`
- `ModalContent`
- `ModalFooter`
- `ModalCloseButton`

## Size

- `sm`
- `md`
- `lg`
- `fullscreen`

## State

- `open`
- `closing`
- `closeDisabled`
- `loading`

## API

```tsx
<Modal open={open} onOpenChange={setOpen} size="md">
  <ModalHeader>
    <div>
      <ModalTitle>{title}</ModalTitle>
      <ModalDescription>{description}</ModalDescription>
    </div>
    <ModalCloseButton aria-label={closeLabel}>{closeIcon}</ModalCloseButton>
  </ModalHeader>
  <ModalContent>{content}</ModalContent>
  <ModalFooter>{actions}</ModalFooter>
</Modal>
```

## Close Policy

- `closeOnEscape`: 기본 `true`
- `closeOnBackdrop`: 기본 `true`
- `closeDisabled`: 닫기 동작 비활성화
- `loading`: 닫기 동작 비활성화 및 `aria-busy` 전달
- `onClose`: 닫기 요청 callback
- `onOpenChange(false)`: 닫기 요청 시 호출

## Accessibility

- dialog surface는 `role="dialog"`를 사용한다.
- dialog surface는 `aria-modal="true"`를 사용한다.
- `ModalTitle`은 `aria-labelledby`에 자동 연결된다.
- `ModalDescription`은 `aria-describedby`에 자동 연결된다.
- `Escape` close를 지원한다.
- `Tab` focus trap을 지원한다.
- open 시 첫 focusable element 또는 dialog surface로 focus를 이동한다.
- close 시 이전 focus 또는 `returnFocusRef`로 focus를 복귀한다.
- `ModalCloseButton`은 반드시 localized accessible name을 `aria-label`로 받아야 한다.

## Token Rule

- 색상, spacing, radius, shadow, typography, motion, z-index는 `--yoro-*` token만 사용한다.
- raw hex, rgb, gradient, 임의 px 값을 component CSS에 추가하지 않는다.
- closing motion은 motion token만 사용한다.
- `prefers-reduced-motion`에서 transition과 closing transform을 제거한다.

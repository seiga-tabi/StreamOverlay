# Toast

YORO.gg 공통 Toast / Notification foundation component다. 기존 `alert()`, confirm, page notification, overlay notification은 즉시 교체하지 않고 이후 점진 migration에서 사용한다.

## Components

- `ToastProvider`
- `ToastViewport`
- `Toast`
- `ToastTitle`
- `ToastDescription`
- `ToastAction`
- `ToastCloseButton`

## Tone

- `neutral`
- `info`
- `success`
- `warning`
- `danger`

## Position

- `top-right`
- `top-center`
- `bottom-right`
- `bottom-center`

## State

- `open`
- `closing`
- `dismissed`
- `loading`

## API

```tsx
<ToastProvider position="top-right" duration={5000}>
  <ToastViewport>
    <Toast tone="success" autoDismiss onOpenChange={setOpen}>
      <ToastTitle>{title}</ToastTitle>
      <ToastDescription>{description}</ToastDescription>
      <ToastAction>{actionText}</ToastAction>
      <ToastCloseButton aria-label={closeLabel}>{closeIcon}</ToastCloseButton>
    </Toast>
  </ToastViewport>
</ToastProvider>
```

## Behavior

- `ToastViewport`는 `aria-live`를 지원한다.
- `Toast`는 `Escape` keyboard close를 지원한다.
- `autoDismiss`와 `duration`으로 자동 닫기를 설정한다.
- `pauseOnHover`와 `pauseOnFocus`는 기본 `true`다.
- `ToastCloseButton`은 반드시 localized accessible name을 `aria-label`로 받아야 한다.
- `warning`, `danger` tone은 기본 `role="alert"`를 사용한다.
- 그 외 tone은 기본 `role="status"`를 사용한다.

## Token Rule

- 색상, spacing, radius, shadow, typography, motion, z-index는 `--yoro-*` token만 사용한다.
- raw hex, rgb, gradient, 임의 px 값을 component CSS에 추가하지 않는다.
- closing/dismissed motion은 motion token만 사용한다.
- `prefers-reduced-motion`에서 transition과 closing transform을 제거한다.

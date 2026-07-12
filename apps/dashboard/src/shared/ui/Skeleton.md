# Skeleton

YORO.gg 공통 Skeleton / Loading foundation component다. 기존 로딩 화면과 placeholder UI는 즉시 교체하지 않고 이후 점진 migration에서 사용한다.

## Components

- `Skeleton`
- `SkeletonText`
- `SkeletonCard`
- `SkeletonAvatar`
- `SkeletonButton`

## Size

- `sm`
- `md`
- `lg`

## API

```tsx
<SkeletonCard loadingLabel={loadingLabel}>
  <SkeletonAvatar />
  <SkeletonText lines={3} />
  <SkeletonButton />
</SkeletonCard>
```

## Accessibility

- `Skeleton` 계열 primitive는 기본적으로 `aria-hidden`이다.
- loading 영역 자체를 보조 기술에 알려야 할 때는 `SkeletonCard`에 localized `loadingLabel`을 전달한다.
- `SkeletonCard`는 `aria-busy="true"`를 전달한다.
- 실제 data가 로드되면 skeleton을 DOM에서 제거하고 실제 content를 렌더링한다.

## Motion

- pulse animation은 motion token만 사용한다.
- `prefers-reduced-motion`에서는 animation을 제거한다.

## Token Rule

- 색상, spacing, radius, shadow, typography, motion은 `--yoro-*` token만 사용한다.
- raw hex, rgb, gradient, 임의 px 값을 component CSS에 추가하지 않는다.

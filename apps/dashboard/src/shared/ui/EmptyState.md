# EmptyState

YORO.gg 공통 EmptyState foundation component다. 기존 빈 화면, 검색 결과 없음, 커뮤니티 없음, 대회 없음 UI는 즉시 교체하지 않고 이후 점진 migration에서 사용한다.

## Components

- `EmptyState`
- `EmptyStateIcon`
- `EmptyStateTitle`
- `EmptyStateDescription`
- `EmptyStateActions`

## Variant

- `default`
- `search`
- `community`
- `streamer`
- `tournament`
- `error`

## API

```tsx
<EmptyState variant="search">
  <EmptyStateIcon>{icon}</EmptyStateIcon>
  <EmptyStateTitle>{title}</EmptyStateTitle>
  <EmptyStateDescription>{description}</EmptyStateDescription>
  <EmptyStateActions>{actions}</EmptyStateActions>
</EmptyState>
```

## Accessibility

- `EmptyState`는 기본 `section`으로 렌더링된다.
- title은 기본 `h2`이며 `as`로 `h3`, `h4`를 선택할 수 있다.
- icon은 기본 장식 요소로 `aria-hidden` 처리된다.
- icon 자체가 의미를 전달해야 하면 `decorative={false}`와 accessible name을 함께 제공한다.

## Token Rule

- 색상, spacing, radius, shadow, typography는 `--yoro-*` token만 사용한다.
- raw hex, rgb, gradient, 임의 px 값을 component CSS에 추가하지 않는다.

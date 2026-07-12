# Status

YORO.gg 상태 표시 foundation component다. 기존 LIVE, offline, warning, success, role badge, metric UI를 즉시 교체하지 않고 이후 점진 migration에서 사용한다.

## Components

- `StatusPill`: 짧은 상태 pill
- `Badge`: role, count, compact metadata 표시
- `Tag`: filter, category, 속성 표시
- `Metric`: label/value/status 조합의 수치 상태 표시
- `LiveIndicator`: 방송 중 상태 표시

## Tone

- `neutral`
- `info`
- `success`
- `warning`
- `danger`
- `live`
- `streamer`
- `admin`

## Size

- `sm`
- `md`
- `lg`

## API

```tsx
<StatusPill tone="success" size="md">
  {label}
</StatusPill>

<Badge tone="streamer" leftIcon={icon}>
  {label}
</Badge>

<Tag tone="info" rightIcon={icon}>
  {label}
</Tag>

<Metric
  label={label}
  value={value}
  description={description}
  status={status}
  tone="warning"
/>

<LiveIndicator aria-label={liveLabel} size="md">
  {liveText}
</LiveIndicator>
```

## Accessibility

- 상태 의미는 색상만으로 전달하지 않고 visible text 또는 accessible name을 함께 제공한다.
- `LiveIndicator`가 text 없이 dot만 렌더링될 때는 `aria-label`을 전달한다.
- icon은 장식 slot으로 처리되며 기본적으로 `aria-hidden`이다.
- motion은 `prefers-reduced-motion`에서 제거된다.

## Token Rule

- 색상, spacing, radius, typography, shadow, motion은 `--yoro-*` token만 사용한다.
- LIVE pulse는 duration/easing token만 사용한다.
- raw hex, rgb, px, gradient 값을 component CSS에 추가하지 않는다.

# PageHeader API

`PageHeader`는 YORO.gg shared UI에서 page 상단의 제목, 설명, 상태, 주요 action을 일관되게 배치하기 위한 component foundation이다. 기존 페이지 헤더에는 아직 적용하지 않는다.

## Import

```tsx
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
} from "./shared/ui";
import type { PageHeaderLayout, PageHeaderProps } from "./shared/ui";
```

## Structure

```tsx
<PageHeader layout="split">
  <PageHeaderEyebrow>Streamer Studio</PageHeaderEyebrow>
  <PageHeaderTitle>오늘 방송 운영</PageHeaderTitle>
  <PageHeaderDescription>
    방송 시작 전에 확인해야 할 상태와 주요 action을 보여준다.
  </PageHeaderDescription>
  <PageHeaderStatus>준비 완료</PageHeaderStatus>
  <PageHeaderActions>
    <Button variant="primary">OBS 열기</Button>
  </PageHeaderActions>
</PageHeader>
```

## Props

| Prop | Type | Default | 설명 |
|---|---|---|---|
| `layout` | `"default" | "compact" | "split"` | `"default"` | header 배치 방식 |
| `as` | `"header" | "section" | "div"` | `"header"` | semantic root element |
| `renderRoot` | `(props: PageHeaderRootRenderProps) => ReactElement` | 없음 | custom root 확장 |

## Components

| Component | 역할 |
|---|---|
| `PageHeader` | page header root |
| `PageHeaderEyebrow` | surface 또는 section label |
| `PageHeaderTitle` | page title, 기본 `h1` |
| `PageHeaderDescription` | title 아래 설명 |
| `PageHeaderActions` | primary/secondary actions, mobile wrap 지원 |
| `PageHeaderStatus` | 상태 pill, sync 상태, 보조 metadata |

## Design Token

- 색상, spacing, typography, motion은 `--yoro-*` token만 사용한다.
- raw hex/rgb/gradient/임의 px를 추가하지 않는다.
- 기존 페이지에는 연결하지 않아 visual 변경이 없다.

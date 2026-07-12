# YORO.gg Sprint3 Specification

## 1. Sprint 목표

Sprint3는 Dashboard를 `오늘 방송 운영` 중심으로 정리하고, Overlay Studio를 OBS 사용 흐름 기준으로 분리한다.

## 2. 작업 순서

```text
Today Broadcast Widget
  -> Twitch Status Block
  -> Overlay Status Block
  -> Participation Summary
  -> Overlay Source URL Builder
  -> Overlay Preview Grid
  -> Overlay Test Panel
  -> Overlay Runtime Boundary
```

## 3. 파일 단위 작업 순서

| 순서 | 파일 | 작업 | Risk |
|---:|---|---|---|
| 1 | `apps/dashboard/src/pages/DashboardPage.tsx` | Today Broadcast composition | Medium |
| 2 | `apps/dashboard/src/pages/OverlayOpsPage.tsx` | Overlay Studio view boundary | High |
| 3 | `apps/dashboard/src/components/OverlayClientStatusCard.tsx` | source URL adapter | High |
| 4 | `apps/dashboard/src/components/OverlayTestPanel.tsx` | test action grouping | High |
| 5 | `apps/dashboard/src/components/RewardMappingPanel.tsx` | admin read-only boundary | Medium |
| 6 | `apps/dashboard/src/components/AlertAssetPanel.tsx` | alert asset manager boundary | High |
| 7 | `apps/overlay/src/App.tsx` | runtime flag boundary | High |
| 8 | `apps/overlay/src/socket.ts` | socket parser adapter | High |
| 9 | `apps/overlay/src/components/Banner.tsx` | banner behavior boundary | Medium |
| 10 | `apps/overlay/src/overlays/ParticipationOverlay.tsx` | queue overlay boundary | High |
| 11 | `apps/overlay/src/overlays/SoloRankOverlay.tsx` | profile overlay boundary | Medium |

## 4. Component 단위 순서

1. TodayBroadcastPanel
2. BroadcastReadinessCard
3. OverlaySourceList
4. OverlayConnectionStatus
5. OverlayPreviewGrid
6. OverlayTestSuite
7. AlertAssetManager
8. EventBanner
9. QueueOverlay
10. SoloRankOverlayCard

## 5. Feature Flag

- `YORO_OVERLAY_STUDIO_V2_ENABLED`
- `YORO_OVERLAY_RUNTIME_V2_ENABLED`

Overlay runtime production default는 stage 검증 전 off.

## 6. Legacy 유지

- 기존 OBS URL 유지
- 기존 `mode` query 유지
- token/hash auth 유지
- dashboard hardcoded channel은 adapter 뒤에서만 교체
- old overlay render fallback 유지

## 7. QA Gate

- OBS 1920x1080 screenshot
- OBS 1280x720 screenshot
- mock preview
- live reconnect
- event/chat/participation/solo-rank render
- token auth
- overlay first frame <= 1s
- blank frame 0건

## 8. 완료 조건

- overlay URL compatibility 유지
- shared `OVERLAY_CHANNELS`와 dashboard channel 정책 정합
- unsafe action path 없음
- rollback flag 동작


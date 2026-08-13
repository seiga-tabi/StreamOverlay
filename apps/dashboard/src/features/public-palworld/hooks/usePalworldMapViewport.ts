import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
} from "react";
import type { PalworldMapMarker } from "@streamops/shared";

export const PALWORLD_MAP_MIN_ZOOM = 1;
export const PALWORLD_MAP_MAX_ZOOM = 10;
export const PALWORLD_MAP_ZOOM_STEP = 0.5;
export const PALWORLD_MAP_ZOOM_EPSILON = 0.001;
const PALWORLD_MAP_KEYBOARD_PAN_STEP = 48;

export type PalworldMapPoint = {
  x: number;
  y: number;
};

export type PalworldMapViewState = PalworldMapPoint & {
  zoom: number;
};

export type PalworldMapTouchMode = "map" | "page-scroll";
export type PalworldMapWheelMode = "always" | "modifier";

/* 수정키는 Alt(mac Option) — Ctrl/⌘+휠은 브라우저 페이지 줌과 겹쳐
   지도 줌과 화면 줌이 동시에 걸린다. Alt+휠의 브라우저 기본 동작(Firefox
   히스토리 이동)은 non-passive 리스너의 preventDefault 로 차단된다. */
export function shouldZoomPalworldMapFromWheel(
  wheelMode: PalworldMapWheelMode,
  modifiers: Readonly<{ altKey: boolean }>,
): boolean {
  return wheelMode === "always" || modifiers.altKey;
}

type PalworldMapGesture =
  | {
      kind: "drag";
      lastPoint: PalworldMapPoint;
    }
  | {
      anchorContent: PalworldMapPoint;
      kind: "pinch";
      startDistance: number;
      startZoom: number;
    };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampPalworldMapView(
  view: Readonly<PalworldMapViewState>,
  viewportWidth: number,
  viewportHeight: number,
): PalworldMapViewState {
  const zoom = clamp(
    Number.isFinite(view.zoom) ? view.zoom : PALWORLD_MAP_MIN_ZOOM,
    PALWORLD_MAP_MIN_ZOOM,
    PALWORLD_MAP_MAX_ZOOM,
  );
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { x: 0, y: 0, zoom };
  }

  /* stage 는 뷰포트 "폭" 기준 정사각입니다(layout width = 폭 × zoom, 이미지 1:1).
     세로 한계를 뷰포트 높이 × zoom 으로 잡으면 넓은 화면(h < w)에서 줌 1 일 때
     남쪽에 영영 닿지 못합니다 — 한계는 stage 크기에서 구합니다.
     정사각 뷰포트(상세 미니맵)에서는 예전 수식과 완전히 같습니다. */
  const stageSize = viewportWidth * zoom;
  return {
    x: clamp(Number.isFinite(view.x) ? view.x : 0, Math.min(0, viewportWidth - stageSize), 0),
    y: clamp(Number.isFinite(view.y) ? view.y : 0, Math.min(0, viewportHeight - stageSize), 0),
    zoom,
  };
}

export function zoomPalworldMapViewAt(
  view: Readonly<PalworldMapViewState>,
  nextZoom: number,
  anchor: Readonly<PalworldMapPoint>,
  viewportWidth: number,
  viewportHeight: number,
): PalworldMapViewState {
  const zoom = clamp(nextZoom, PALWORLD_MAP_MIN_ZOOM, PALWORLD_MAP_MAX_ZOOM);
  const currentZoom = clamp(view.zoom, PALWORLD_MAP_MIN_ZOOM, PALWORLD_MAP_MAX_ZOOM);
  return clampPalworldMapView({
    x: anchor.x - (((anchor.x - view.x) / currentZoom) * zoom),
    y: anchor.y - (((anchor.y - view.y) / currentZoom) * zoom),
    zoom,
  }, viewportWidth, viewportHeight);
}

/* view → URL center 변환. stage 는 두 축 모두 "뷰포트 폭 × zoom" 기준 정사각이므로
   y 도 반드시 폭으로 나눈다 — 높이로 나누면 pan 저장/복원 왕복마다 y 가 w/h 배씩 틀어져
   넓은 화면에서 지도가 북쪽으로 계속 스냅백한다(확대 후 이동 불가 결함의 원인). */
export function palworldMapCenterFromView(
  view: Readonly<PalworldMapViewState>,
  viewportWidth: number,
  viewportHeight: number,
): PalworldMapPoint | undefined {
  if (viewportWidth <= 0 || viewportHeight <= 0 || view.zoom <= 0) {
    return undefined;
  }
  const stageSize = viewportWidth * view.zoom;
  return {
    x: Math.min(1, Math.max(0, ((viewportWidth / 2) - view.x) / stageSize)),
    y: Math.min(1, Math.max(0, ((viewportHeight / 2) - view.y) / stageSize)),
  };
}

export function focusPalworldMapViewAt(
  marker: Pick<PalworldMapMarker, "normalizedX" | "normalizedY">,
  viewportWidth: number,
  viewportHeight: number,
  zoom = 2,
): PalworldMapViewState {
  /* 마커의 화면 좌표는 stage 크기(폭 × zoom) 기준입니다. 세로도 폭으로 셉니다. */
  const stageSize = viewportWidth * zoom;
  return clampPalworldMapView({
    x: (viewportWidth / 2) - (marker.normalizedX * stageSize),
    y: (viewportHeight / 2) - (marker.normalizedY * stageSize),
    zoom,
  }, viewportWidth, viewportHeight);
}

function distanceBetween(first: PalworldMapPoint, second: PalworldMapPoint): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: PalworldMapPoint, second: PalworldMapPoint): PalworldMapPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function isMapControlTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && Boolean(target.closest("button, a, input, select, textarea, [data-map-interactive='true']"));
}

export function usePalworldMapViewport(
  enabled: boolean,
  touchMode: PalworldMapTouchMode = "page-scroll",
  wheelMode: PalworldMapWheelMode = "always",
) {
  const [view, setView] = useState<PalworldMapViewState>({
    x: 0,
    y: 0,
    zoom: PALWORLD_MAP_MIN_ZOOM,
  });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view);
  const pointersRef = useRef(new Map<number, PalworldMapPoint>());
  const passiveTouchRef = useRef(new Map<number, PalworldMapPoint>());
  const gestureRef = useRef<PalworldMapGesture>();
  const renderFrameRef = useRef<number>();
  const pendingControlPointersRef = useRef(new Map<number, PalworldMapPoint>());
  const dragOccurredRef = useRef(false);

  const commitView = useCallback((nextView: PalworldMapViewState): void => {
    const viewport = viewportRef.current;
    const clampedView = clampPalworldMapView(
      nextView,
      viewport?.clientWidth ?? 0,
      viewport?.clientHeight ?? 0,
    );
    viewRef.current = clampedView;
    setView(clampedView);
  }, []);

  const commitViewOnAnimationFrame = useCallback((nextView: PalworldMapViewState): void => {
    const viewport = viewportRef.current;
    viewRef.current = clampPalworldMapView(
      nextView,
      viewport?.clientWidth ?? 0,
      viewport?.clientHeight ?? 0,
    );
    if (renderFrameRef.current !== undefined) {
      return;
    }
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = undefined;
      setView(viewRef.current);
    });
  }, []);

  const zoomAt = useCallback((nextZoom: number, anchor?: PalworldMapPoint): void => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    commitView(zoomPalworldMapViewAt(
      viewRef.current,
      nextZoom,
      anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 },
      viewport.clientWidth,
      viewport.clientHeight,
    ));
  }, [commitView]);

  const resetView = useCallback((): void => {
    pointersRef.current.clear();
    passiveTouchRef.current.clear();
    pendingControlPointersRef.current.clear();
    gestureRef.current = undefined;
    setIsPanning(false);
    /* 넓은 화면에서는 stage 가 뷰포트보다 세로로 커서 북쪽부터 보입니다.
       남쪽은 줌 1 에서도 끌어서 볼 수 있습니다(clamp 가 stage 크기 기준). */
    commitView({ x: 0, y: 0, zoom: PALWORLD_MAP_MIN_ZOOM });
  }, [commitView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const clampCurrentView = (): void => commitView(viewRef.current);
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", clampCurrentView);
      return () => window.removeEventListener("resize", clampCurrentView);
    }

    const observer = new ResizeObserver(clampCurrentView);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [commitView]);

  useEffect(() => () => {
    if (renderFrameRef.current !== undefined) {
      window.cancelAnimationFrame(renderFrameRef.current);
    }
  }, []);

  /* React 17+ 는 wheel 을 root 에 passive 로 붙이므로 synthetic onWheel 에서는
     preventDefault 가 통하지 않는다(ctrl+휠이 지도 줌과 브라우저 페이지 줌을 동시에
     일으킴). 뷰포트에 non-passive 네이티브 리스너를 직접 단다. */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const handleNativeWheel = (event: globalThis.WheelEvent): void => {
      if (!enabled || !shouldZoomPalworldMapFromWheel(wheelMode, event)) {
        return;
      }
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const wheelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      zoomAt(viewRef.current.zoom * Math.exp(-wheelDelta * 0.0015), {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    };
    /* 마커 안의 IMG 는 기본 draggable 이라 마우스 팬이 두 번째 move 에서
       네이티브 이미지 드래그로 넘어가 버린다 — 지도 안의 native drag 는 전부 막는다. */
    const handleDragStart = (event: DragEvent): void => {
      event.preventDefault();
    };
    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });
    viewport.addEventListener("dragstart", handleDragStart);
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
      viewport.removeEventListener("dragstart", handleDragStart);
    };
  }, [enabled, wheelMode, zoomAt]);

  function pointFromPointer(event: PointerEvent<HTMLDivElement>): PalworldMapPoint {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  function beginPinch(): void {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) {
      return;
    }
    const [first, second] = points;
    if (!first || !second) {
      return;
    }
    const center = midpoint(first, second);
    gestureRef.current = {
      anchorContent: {
        x: (center.x - viewRef.current.x) / viewRef.current.zoom,
        y: (center.y - viewRef.current.y) / viewRef.current.zoom,
      },
      kind: "pinch",
      startDistance: Math.max(1, distanceBetween(first, second)),
      startZoom: viewRef.current.zoom,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    dragOccurredRef.current = false;
    if (isMapControlTarget(event.target)) {
      /* 마커·버튼 위에서도 팬을 시작할 수 있어야 한다. 임계값을 넘기 전에는
         capture/preventDefault 없이 추적만 해서 탭·클릭은 그대로 동작한다. */
      pendingControlPointersRef.current.set(event.pointerId, pointFromPointer(event));
      return;
    }

    const point = pointFromPointer(event);

    if (
      event.pointerType === "touch"
      && touchMode === "page-scroll"
      && viewRef.current.zoom <= PALWORLD_MAP_MIN_ZOOM + PALWORLD_MAP_ZOOM_EPSILON
      && pointersRef.current.size === 0
    ) {
      if (passiveTouchRef.current.size === 0) {
        // 상세 미니맵은 1배율의 한 손가락 스와이프를 Modal 세로 스크롤에 양보합니다.
        passiveTouchRef.current.set(event.pointerId, point);
        return;
      }
      for (const [pointerId, passivePoint] of passiveTouchRef.current) {
        pointersRef.current.set(pointerId, passivePoint);
        try {
          event.currentTarget.setPointerCapture(pointerId);
        } catch {
          // 브라우저가 이미 스크롤 제스처로 전환한 pointer는 안전하게 무시합니다.
        }
      }
      passiveTouchRef.current.clear();
    }

    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 브라우저가 취소한 pointer는 다음 move 이벤트에서 안전하게 무시합니다.
      return;
    }
    pointersRef.current.set(event.pointerId, point);
    setIsPanning(true);
    if (pointersRef.current.size >= 2) {
      beginPinch();
    } else {
      gestureRef.current = { kind: "drag", lastPoint: point };
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (passiveTouchRef.current.has(event.pointerId)) {
      passiveTouchRef.current.set(event.pointerId, pointFromPointer(event));
      return;
    }
    const pendingStart = pendingControlPointersRef.current.get(event.pointerId);
    if (pendingStart) {
      const point = pointFromPointer(event);
      if (distanceBetween(pendingStart, point) <= 8) {
        return;
      }
      /* 임계값을 넘었다 — 이 제스처는 클릭이 아니라 팬이다. */
      pendingControlPointersRef.current.delete(event.pointerId);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      dragOccurredRef.current = true;
      pointersRef.current.set(event.pointerId, point);
      setIsPanning(true);
      if (pointersRef.current.size >= 2) {
        beginPinch();
      } else {
        gestureRef.current = { kind: "drag", lastPoint: point };
      }
      return;
    }
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }
    if (gestureRef.current?.kind === "drag") {
      dragOccurredRef.current = true;
    }

    event.preventDefault();
    const point = pointFromPointer(event);
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;

    if (pointersRef.current.size >= 2) {
      if (!gesture || gesture.kind !== "pinch") {
        beginPinch();
        return;
      }
      const points = [...pointersRef.current.values()];
      const [first, second] = points;
      if (!first || !second) {
        return;
      }
      const center = midpoint(first, second);
      const zoom = clamp(
        gesture.startZoom * (distanceBetween(first, second) / gesture.startDistance),
        PALWORLD_MAP_MIN_ZOOM,
        PALWORLD_MAP_MAX_ZOOM,
      );
      commitViewOnAnimationFrame({
        x: center.x - (gesture.anchorContent.x * zoom),
        y: center.y - (gesture.anchorContent.y * zoom),
        zoom,
      });
      return;
    }

    if (!gesture || gesture.kind !== "drag") {
      gestureRef.current = { kind: "drag", lastPoint: point };
      return;
    }
    commitViewOnAnimationFrame({
      ...viewRef.current,
      x: viewRef.current.x + (point.x - gesture.lastPoint.x),
      y: viewRef.current.y + (point.y - gesture.lastPoint.y),
    });
    gestureRef.current = { kind: "drag", lastPoint: point };
  }

  function endPointer(event: PointerEvent<HTMLDivElement>): void {
    if (pendingControlPointersRef.current.delete(event.pointerId)) {
      return;
    }
    if (passiveTouchRef.current.delete(event.pointerId)) {
      return;
    }
    if (!pointersRef.current.delete(event.pointerId)) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const remainingPoint = pointersRef.current.values().next().value as PalworldMapPoint | undefined;
    if (remainingPoint) {
      gestureRef.current = { kind: "drag", lastPoint: remainingPoint };
      return;
    }
    gestureRef.current = undefined;
    setIsPanning(false);
  }

  function handleClickCapture(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!dragOccurredRef.current) {
      return;
    }
    dragOccurredRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget || !enabled) {
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        commitView({ ...viewRef.current, x: viewRef.current.x + PALWORLD_MAP_KEYBOARD_PAN_STEP });
        break;
      case "ArrowRight":
        commitView({ ...viewRef.current, x: viewRef.current.x - PALWORLD_MAP_KEYBOARD_PAN_STEP });
        break;
      case "ArrowUp":
        commitView({ ...viewRef.current, y: viewRef.current.y + PALWORLD_MAP_KEYBOARD_PAN_STEP });
        break;
      case "ArrowDown":
        commitView({ ...viewRef.current, y: viewRef.current.y - PALWORLD_MAP_KEYBOARD_PAN_STEP });
        break;
      case "+":
      case "=":
        zoomAt(viewRef.current.zoom + PALWORLD_MAP_ZOOM_STEP);
        break;
      case "-":
      case "_":
        zoomAt(viewRef.current.zoom - PALWORLD_MAP_ZOOM_STEP);
        break;
      case "Home":
        resetView();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return {
    commitView,
    endPointer,
    handleClickCapture,
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    isPanning,
    resetView,
    view,
    viewRef,
    viewportRef,
    zoomAt,
  };
}

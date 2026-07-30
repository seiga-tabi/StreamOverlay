import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
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

export function shouldZoomPalworldMapFromWheel(
  wheelMode: PalworldMapWheelMode,
  modifiers: Readonly<{ ctrlKey: boolean; metaKey: boolean }>,
): boolean {
  return wheelMode === "always" || modifiers.ctrlKey || modifiers.metaKey;
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

  return {
    x: clamp(Number.isFinite(view.x) ? view.x : 0, viewportWidth - (viewportWidth * zoom), 0),
    y: clamp(Number.isFinite(view.y) ? view.y : 0, viewportHeight - (viewportHeight * zoom), 0),
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

export function focusPalworldMapViewAt(
  marker: Pick<PalworldMapMarker, "normalizedX" | "normalizedY">,
  viewportWidth: number,
  viewportHeight: number,
  zoom = 2,
): PalworldMapViewState {
  return clampPalworldMapView({
    x: (viewportWidth / 2) - (marker.normalizedX * viewportWidth * zoom),
    y: (viewportHeight / 2) - (marker.normalizedY * viewportHeight * zoom),
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
    gestureRef.current = undefined;
    setIsPanning(false);
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
    if (
      !enabled
      || (event.pointerType === "mouse" && event.button !== 0)
      || isMapControlTarget(event.target)
    ) {
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
    if (!pointersRef.current.has(event.pointerId)) {
      return;
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

  function handleWheel(event: WheelEvent<HTMLDivElement>): void {
    if (
      !enabled
      || !shouldZoomPalworldMapFromWheel(wheelMode, event)
    ) {
      return;
    }
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const wheelDelta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    zoomAt(viewRef.current.zoom * Math.exp(-wheelDelta * 0.0015), {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
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
    handleKeyDown,
    handlePointerDown,
    handlePointerMove,
    handleWheel,
    isPanning,
    resetView,
    view,
    viewRef,
    viewportRef,
    zoomAt,
  };
}

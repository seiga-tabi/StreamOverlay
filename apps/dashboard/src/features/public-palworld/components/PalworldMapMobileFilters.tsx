import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Button } from "../../../shared/ui/Button";
import {
  PalworldMapFilterPanel,
  type PalworldMapFilterPanelProps,
} from "./PalworldMapFilterPanel";
import {
  isPalworldMapLayerReady,
  resolvePalworldMapLabel,
  type PalworldMapLayerOption,
} from "./PalworldMapExplorerTypes";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { palworldI18n } from "../i18n/palworld-i18n";

/** 시트가 머무는 세 자리입니다. peek=손잡이만 · half=칩 줄 · full=전체 목록. */
export type PalworldMapSheetSnap = "peek" | "half" | "full";

const SNAP_ORDER: readonly PalworldMapSheetSnap[] = ["peek", "half", "full"];
/** 이만큼 끌면 다음 자리로 넘어갑니다. 짧은 흔들림은 무시합니다. */
const SHEET_DRAG_THRESHOLD_PX = 48;

export type PalworldMapMobileFiltersProps = Omit<
  PalworldMapFilterPanelProps,
  "className" | "collapsed" | "onCollapsedChange"
> & {
  snap: PalworldMapSheetSnap;
  onSnapChange: (snap: PalworldMapSheetSnap) => void;
  returnFocusRef?: RefObject<HTMLElement>;
  /** 손잡이 줄에 붙는 한 줄 상태 요약(예: "필드 보스 12"). 버튼 중첩이 불가능하므로 텍스트만 받습니다. */
  statusSummary?: string;
};

function snapAfterDrag(
  current: PalworldMapSheetSnap,
  deltaY: number,
): PalworldMapSheetSnap {
  if (Math.abs(deltaY) < SHEET_DRAG_THRESHOLD_PX) return current;
  const index = SNAP_ORDER.indexOf(current);
  const nextIndex = deltaY < 0 ? index + 1 : index - 1;
  return SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, Math.max(0, nextIndex))] ?? current;
}

/**
 * 좁은 화면의 지도 필터 하단 시트입니다.
 *
 * 예전에는 전체 화면 Modal 이라 여는 순간 지도가 사라졌습니다 — 무엇을 켰을 때
 * 지도가 어떻게 바뀌는지 볼 수 없어 켜고 닫기를 반복하게 됩니다. 시트는 지도를
 * 덮지 않고 밀어 올리므로, 칩을 누르면 위에서 마커가 즉시 늘고 주는 것이 보입니다.
 * 레이어 상태와 선택 검증은 공용 `PalworldMapFilterPanel`에 위임합니다.
 */
export function PalworldMapMobileFilters({
  copy,
  groups,
  locale,
  onLayerChange,
  onReset,
  onSnapChange,
  returnFocusRef,
  snap,
  statusSummary,
  ...panelProps
}: PalworldMapMobileFiltersProps) {
  /* 전체 목록일 때만 문서 스크롤을 잠급니다. 칩 줄에서는 지도를 계속 만질 수 있어야 합니다. */
  useBodyScrollLock(snap === "full");
  const sheetId = useId();
  const grabRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number } | null>(null);
  const closeLabel = palworldI18n[locale].close;

  const setSnap = useCallback(
    (nextSnap: PalworldMapSheetSnap) => {
      if (nextSnap === snap) return;
      onSnapChange(nextSnap);
      /* 전체 목록에서 내려오면 초점을 되돌립니다 — 시트 안에 갇히지 않게요.
         별도 트리거가 없어졌으므로 기본 복귀 지점은 시트 손잡이입니다. */
      if (snap === "full" && nextSnap !== "full") {
        window.requestAnimationFrame(() => (returnFocusRef?.current ?? grabRef.current)?.focus());
      }
    },
    [onSnapChange, returnFocusRef, snap],
  );

  useEffect(() => {
    if (snap !== "full") return undefined;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSnap("half");
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setSnap, snap]);

  function handleGrabKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    const index = SNAP_ORDER.indexOf(snap);
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSnap(SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, index + 1)] ?? snap);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSnap(SNAP_ORDER[Math.max(0, index - 1)] ?? snap);
    }
  }

  function handleGrabPointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGrabPointerUp(event: ReactPointerEvent<HTMLButtonElement>): void {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setSnap(snapAfterDrag(snap, event.clientY - drag.startY));
  }

  /* 칩은 켤 수 있는 레이어만 냅니다. 켜도 아무것도 나오지 않는 칩은 헛걸음입니다. */
  const chipLayers: PalworldMapLayerOption[] = groups.flatMap(
    (group) => group.layers.filter(
      (layer) => isPalworldMapLayerReady(layer)
        && (layer.selected || layer.count === undefined || layer.count > 0),
    ),
  );
  const selectedCount = groups.reduce(
    (total, group) => total + group.layers.filter((layer) => layer.selected).length,
    0,
  );

  return (
    <section
      aria-label={resolvePalworldMapLabel(copy.title, locale)}
      className="palworld-map-sheet"
      data-snap={snap}
      data-testid="palworld-map-mobile-filters"
    >
      {/* 루트는 탭바 위에 고정된 "창"(overflow clip)이고, 실제로 미끄러지는 것은
          이 래퍼입니다. 루트에 직접 transform 을 걸면 내려간 본체가 루트 바닥을
          넘어 탭바 좌표 위에 남아(transform 은 clip 되지 않음) 탭을 가립니다. */}
      <div className="palworld-map-sheet__inner">
      <button
        aria-controls={sheetId}
        aria-expanded={snap === "full"}
        className="palworld-map-sheet__grab"
        data-ja={copy.title.ja}
        data-ko={copy.title.ko}
        onClick={() => setSnap(snap === "full" ? "peek" : SNAP_ORDER[SNAP_ORDER.indexOf(snap) + 1] ?? "full")}
        onKeyDown={handleGrabKeyDown}
        onPointerDown={handleGrabPointerDown}
        onPointerUp={handleGrabPointerUp}
        ref={grabRef}
        type="button"
      >
        <span aria-hidden="true" className="palworld-map-sheet__grab-bar" />
        <span className="palworld-map-sheet__grab-title">
          {resolvePalworldMapLabel(copy.title, locale)}
          {statusSummary ? (
            <span className="palworld-map-sheet__grab-status">{statusSummary}</span>
          ) : null}
        </span>
        <span className="palworld-map-sheet__grab-count">{selectedCount}</span>
      </button>

      <div className="palworld-map-sheet__body" id={sheetId}>
        {/* 칩 줄: 시트를 더 올리지 않고도 자주 쓰는 레이어를 켜고 끕니다. */}
        <div
          aria-label={resolvePalworldMapLabel(copy.title, locale)}
          className="palworld-map-sheet__chips"
          role="group"
        >
          {chipLayers.map((layer) => (
            <button
              aria-pressed={layer.selected}
              className="palworld-map-sheet__chip"
              key={layer.id}
              onClick={() => onLayerChange(layer.id, !layer.selected)}
              type="button"
            >
              {resolvePalworldMapLabel(layer.label, locale)}
              {layer.count !== undefined ? <b>{layer.count}</b> : null}
            </button>
          ))}
        </div>

        <div className="palworld-map-sheet__panel">
          <PalworldMapFilterPanel
            {...panelProps}
            className="palworld-map-mobile-filters__panel"
            collapsed={false}
            copy={copy}
            groups={groups}
            locale={locale}
            onCollapsedChange={(collapsed) => {
              if (collapsed) setSnap("half");
            }}
            onLayerChange={onLayerChange}
            onReset={onReset}
          />
          <div className="palworld-map-sheet__footer">
            <Button
              data-ja={copy.reset.ja}
              data-ko={copy.reset.ko}
              onClick={onReset}
              variant="secondary"
            >
              {resolvePalworldMapLabel(copy.reset, locale)}
            </Button>
            <Button
              data-ja={palworldI18n.ja.close}
              data-ko={palworldI18n.ko.close}
              onClick={() => setSnap("peek")}
              variant="primary"
            >
              {closeLabel}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

import {
  useEffect,
  useId,
  useRef,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Button } from "../../../shared/ui/Button";
import { Card } from "../../../shared/ui/Card";
import { Badge } from "../../../shared/ui/Status";
import type { PalworldLocale } from "../i18n/palworld-i18n";
import {
  isPalworldMapLayerReady,
  resolvePalworldMapLabel,
  type PalworldMapLayerGroup,
  type PalworldMapLayerOption,
  type PalworldMapLocalizedLabel,
} from "./PalworldMapExplorerTypes";
import { PalworldMapLayerIcon } from "./PalworldMapLayerIcon";

export type PalworldMapFilterPanelCopy = {
  title: PalworldMapLocalizedLabel;
  hide: PalworldMapLocalizedLabel;
  show: PalworldMapLocalizedLabel;
  reset: PalworldMapLocalizedLabel;
  all: PalworldMapLocalizedLabel;
};

type PalworldMapFilterPanelProps = {
  children?: ReactNode;
  className?: string;
  collapsed: boolean;
  copy: PalworldMapFilterPanelCopy;
  groups: readonly PalworldMapLayerGroup[];
  locale: PalworldLocale;
  onCollapsedChange: (collapsed: boolean) => void;
  onGroupCollapsedChange?: (groupId: string, collapsed: boolean) => void;
  onGroupLayerChange: (
    layerIds: readonly PalworldMapLayerOption["id"][],
    selected: boolean,
  ) => void;
  onLayerChange: (layerId: PalworldMapLayerOption["id"], selected: boolean) => void;
  onReset: () => void;
};

function GroupSelectionInput({
  checked,
  disabled,
  id,
  indeterminate,
  label,
  locale,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  id: string;
  indeterminate: boolean;
  label: PalworldMapLocalizedLabel;
  locale: PalworldLocale;
  onChange: (selected: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="palworld-map-filter-all" htmlFor={id}>
      <input
        checked={checked}
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.currentTarget.checked)}
        ref={inputRef}
        type="checkbox"
      />
      <span data-ja={label.ja} data-ko={label.ko}>
        {resolvePalworldMapLabel(label, locale)}
      </span>
    </label>
  );
}

function LayerStatus({
  layer,
  locale,
}: {
  layer: PalworldMapLayerOption;
  locale: PalworldLocale;
}) {
  if (!layer.statusLabel) return null;
  const tone = layer.state === "error"
    ? "warning"
    : layer.state === "ready"
      ? "info"
      : "neutral";
  return (
    <Badge
      data-ja={layer.statusLabel.ja}
      data-ko={layer.statusLabel.ko}
      size="sm"
      tone={tone}
    >
      {resolvePalworldMapLabel(layer.statusLabel, locale)}
    </Badge>
  );
}

function LayerRow({
  inputId,
  layer,
  locale,
  onChange,
}: {
  inputId: string;
  layer: PalworldMapLayerOption;
  locale: PalworldLocale;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const ready = isPalworldMapLayerReady(layer);
  const description = layer.description
    ? resolvePalworldMapLabel(layer.description, locale)
    : undefined;
  const validCount = layer.count !== undefined
    && Number.isInteger(layer.count)
    && layer.count >= 0;

  return (
    <li className="palworld-map-filter-layer" data-layer={layer.id}>
      <label htmlFor={inputId}>
        <input
          checked={layer.selected}
          disabled={!ready}
          id={inputId}
          onChange={onChange}
          type="checkbox"
        />
        <PalworldMapLayerIcon
          asset={layer.iconAsset}
          fallbackSymbol={layer.iconFallback}
        />
        <span className="palworld-map-filter-layer-copy">
          <strong data-ja={layer.label.ja} data-ko={layer.label.ko}>
            {resolvePalworldMapLabel(layer.label, locale)}
          </strong>
          {layer.description ? (
            <small data-ja={layer.description.ja} data-ko={layer.description.ko}>
              {description}
            </small>
          ) : null}
        </span>
        {validCount ? (
          <span
            aria-label={`${resolvePalworldMapLabel(layer.label, locale)} ${layer.count}`}
            className="palworld-map-filter-layer-count"
          >
            {layer.count}
          </span>
        ) : null}
        <LayerStatus layer={layer} locale={locale} />
      </label>
    </li>
  );
}

function LayerGroup({
  allLabel,
  group,
  groupIndex,
  locale,
  onGroupCollapsedChange,
  onGroupLayerChange,
  onLayerChange,
  rootId,
}: {
  allLabel: PalworldMapLocalizedLabel;
  group: PalworldMapLayerGroup;
  groupIndex: number;
  locale: PalworldLocale;
  onGroupCollapsedChange?: (groupId: string, collapsed: boolean) => void;
  onGroupLayerChange: (
    layerIds: readonly PalworldMapLayerOption["id"][],
    selected: boolean,
  ) => void;
  onLayerChange: (layerId: PalworldMapLayerOption["id"], selected: boolean) => void;
  rootId: string;
}) {
  const contentId = `${rootId}-group-${groupIndex}`;
  const selectableLayers = group.layers.filter(isPalworldMapLayerReady);
  const selectedLayers = selectableLayers.filter((layer) => layer.selected);
  const allSelected = selectableLayers.length > 0
    && selectedLayers.length === selectableLayers.length;
  const partiallySelected = selectedLayers.length > 0 && !allSelected;
  const collapsed = group.collapsed ?? false;

  function changeGroup(selected: boolean): void {
    onGroupLayerChange(
      selectableLayers.map((layer) => layer.id),
      selected,
    );
  }

  return (
    <fieldset className="palworld-map-filter-group">
      <legend className="yoro-u-sr-only">
        {resolvePalworldMapLabel(group.label, locale)}
      </legend>
      <div className="palworld-map-filter-group-heading">
        <button
          aria-controls={contentId}
          aria-expanded={!collapsed}
          className="palworld-map-filter-group-toggle"
          data-ja={group.label.ja}
          data-ko={group.label.ko}
          onClick={() => onGroupCollapsedChange?.(group.id, !collapsed)}
          type="button"
        >
          <span aria-hidden="true">{collapsed ? "›" : "⌄"}</span>
          <span>{resolvePalworldMapLabel(group.label, locale)}</span>
        </button>
        <GroupSelectionInput
          checked={allSelected}
          disabled={selectableLayers.length === 0}
          id={`${contentId}-all`}
          indeterminate={partiallySelected}
          label={allLabel}
          locale={locale}
          onChange={changeGroup}
        />
      </div>
      <ul hidden={collapsed} id={contentId}>
        {group.layers.map((layer, layerIndex) => (
          <LayerRow
            inputId={`${contentId}-layer-${layerIndex}`}
            key={layer.id}
            layer={layer}
            locale={locale}
            onChange={(event) => onLayerChange(layer.id, event.currentTarget.checked)}
          />
        ))}
      </ul>
    </fieldset>
  );
}

/**
 * 검증된 지도 레이어의 노출만 제어하는 접근 가능한 필터 패널입니다.
 * `state="ready"`가 아닌 레이어는 UI에서 선택할 수 없습니다.
 */
export function PalworldMapFilterPanel({
  children,
  className,
  collapsed,
  copy,
  groups,
  locale,
  onCollapsedChange,
  onGroupCollapsedChange,
  onGroupLayerChange,
  onLayerChange,
  onReset,
}: PalworldMapFilterPanelProps) {
  const rootId = useId();
  const contentId = `${rootId}-content`;
  const panelClassName = ["palworld-map-filter-panel", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Card
      as="aside"
      aria-label={resolvePalworldMapLabel(copy.title, locale)}
      className={panelClassName}
      data-collapsed={collapsed ? "true" : undefined}
      padding="none"
    >
      <header className="palworld-map-filter-header">
        <strong data-ja={copy.title.ja} data-ko={copy.title.ko}>
          {resolvePalworldMapLabel(copy.title, locale)}
        </strong>
        <div className="palworld-map-filter-header-actions">
          {!collapsed ? (
            <Button
              data-ja={copy.reset.ja}
              data-ko={copy.reset.ko}
              onClick={onReset}
              size="sm"
              variant="ghost"
            >
              {resolvePalworldMapLabel(copy.reset, locale)}
            </Button>
          ) : null}
          <Button
            aria-controls={contentId}
            aria-expanded={!collapsed}
            data-ja={(collapsed ? copy.show : copy.hide).ja}
            data-ko={(collapsed ? copy.show : copy.hide).ko}
            onClick={() => onCollapsedChange(!collapsed)}
            size="sm"
            variant="ghost"
          >
            {resolvePalworldMapLabel(collapsed ? copy.show : copy.hide, locale)}
          </Button>
        </div>
      </header>
      <div className="palworld-map-filter-content" hidden={collapsed} id={contentId}>
        {children ? (
          <div className="palworld-map-filter-search">
            {children}
          </div>
        ) : null}
        {groups.map((group, index) => (
          <LayerGroup
            allLabel={copy.all}
            group={group}
            groupIndex={index}
            key={group.id}
            locale={locale}
            onGroupCollapsedChange={onGroupCollapsedChange}
            onGroupLayerChange={onGroupLayerChange}
            onLayerChange={onLayerChange}
            rootId={rootId}
          />
        ))}
      </div>
    </Card>
  );
}

export type { PalworldMapFilterPanelProps };

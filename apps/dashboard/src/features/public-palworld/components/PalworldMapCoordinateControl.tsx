import { useId, useState, type FormEvent } from "react";
import type { PalworldMapLocationArtifactTransform } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Input } from "../../../shared/ui/Form";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import {
  worldToPalworldMapCoordinate,
  type PalworldMapNormalizedCoordinate,
  type PalworldMapWorldCoordinate,
} from "../utils/map-coordinates";

type PalworldMapCoordinateControlProps = {
  locale: PalworldLocale;
  onLocate: (
    coordinate: PalworldMapNormalizedCoordinate,
    worldCoordinate: PalworldMapWorldCoordinate,
  ) => void;
  transform: PalworldMapLocationArtifactTransform;
};

function formatCoordinateRange(minimum: number, maximum: number): string {
  return `${minimum.toLocaleString()}–${maximum.toLocaleString()}`;
}

export function PalworldMapCoordinateControl({
  locale,
  onLocate,
  transform,
}: PalworldMapCoordinateControlProps) {
  const text = palworldI18n[locale];
  const descriptionId = useId();
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const worldCoordinate = {
      x: Number(x),
      y: Number(y),
    };
    const normalized = x.trim() && y.trim()
      ? worldToPalworldMapCoordinate(transform, worldCoordinate)
      : undefined;
    if (!normalized) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onLocate(normalized, worldCoordinate);
    setOpen(false);
  }

  return (
    <div
      className="palworld-map-coordinate-control"
      data-map-interactive="true"
      data-open={open ? "true" : undefined}
    >
      <Button
        aria-expanded={open}
        aria-label={text.mapCoordinateOpen}
        className="palworld-map-coordinate-trigger"
        onClick={() => setOpen((current) => !current)}
        size="sm"
        variant="secondary"
      >
        <span aria-hidden="true">⌖</span>
        <span>{text.mapCoordinateOpen}</span>
      </Button>
      <form
        aria-describedby={descriptionId}
        className="palworld-map-coordinate-form"
        noValidate
        onSubmit={submit}
      >
        <div className="palworld-map-coordinate-form__header">
          <strong>{text.mapCoordinateTitle}</strong>
          <Button
            aria-label={text.mapCoordinateClose}
            className="palworld-map-coordinate-close"
            onClick={() => setOpen(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            ×
          </Button>
        </div>
        <p id={descriptionId}>{text.mapCoordinateDescription}</p>
        <div className="palworld-map-coordinate-fields">
          <label>
            <span>{text.mapCoordinateX}</span>
            <Input
              aria-describedby={invalid ? errorId : descriptionId}
              inputMode="decimal"
              invalid={invalid}
              max={transform.sourceBounds.maxX}
              min={transform.sourceBounds.minX}
              onChange={(event) => {
                setX(event.currentTarget.value);
                setInvalid(false);
              }}
              placeholder={formatCoordinateRange(
                transform.sourceBounds.minX,
                transform.sourceBounds.maxX,
              )}
              step="any"
              type="number"
              value={x}
            />
          </label>
          <label>
            <span>{text.mapCoordinateY}</span>
            <Input
              aria-describedby={invalid ? errorId : descriptionId}
              inputMode="decimal"
              invalid={invalid}
              max={transform.sourceBounds.maxY}
              min={transform.sourceBounds.minY}
              onChange={(event) => {
                setY(event.currentTarget.value);
                setInvalid(false);
              }}
              placeholder={formatCoordinateRange(
                transform.sourceBounds.minY,
                transform.sourceBounds.maxY,
              )}
              step="any"
              type="number"
              value={y}
            />
          </label>
        </div>
        {invalid ? (
          <p className="palworld-map-coordinate-error" id={errorId} role="alert">
            {text.mapCoordinateInvalid}
          </p>
        ) : null}
        <Button className="palworld-map-coordinate-submit" size="sm" type="submit">
          {text.mapCoordinateSubmit}
        </Button>
      </form>
    </div>
  );
}

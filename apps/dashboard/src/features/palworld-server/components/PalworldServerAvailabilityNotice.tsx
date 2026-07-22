import type {
  PalworldServerAvailabilityErrorCode,
  PalworldServerDashboardResponse
} from "@streamops/shared";
import { PALWORLD_SERVER_AVAILABILITY_ERROR_CODES } from "@streamops/shared";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  type StatusTone
} from "../../../shared/ui";
import type { PalworldServerText } from "../i18n";

export type PalworldServerAvailabilityCode = PalworldServerAvailabilityErrorCode;

function isPalworldServerAvailabilityCode(
  value: PalworldServerDashboardResponse["status"]["errorCode"]
): value is PalworldServerAvailabilityCode {
  return Boolean(value && (PALWORLD_SERVER_AVAILABILITY_ERROR_CODES as readonly string[]).includes(value));
}

export function palworldServerAvailabilityCode(
  dashboard: PalworldServerDashboardResponse
): PalworldServerAvailabilityCode | undefined {
  if (isPalworldServerAvailabilityCode(dashboard.status.errorCode)) {
    return dashboard.status.errorCode;
  }
  return dashboard.enabled ? undefined : "disabled";
}

export function palworldServerAvailabilityTone(code: PalworldServerAvailabilityCode): StatusTone {
  if (code === "disabled") return "neutral";
  if (code === "config_invalid" || code === "key_invalid") return "danger";
  return "warning";
}

export function PalworldServerAvailabilityNotice({
  code,
  text
}: {
  code: PalworldServerAvailabilityCode;
  text: PalworldServerText;
}) {
  const copy = text.availability[code];
  const icon = code === "disabled" ? "Ⅱ" : code.endsWith("_invalid") ? "!" : "⚙";
  return (
    <EmptyState
      className="palworld-server-availability-notice"
      data-availability-code={code}
      variant="error"
    >
      <EmptyStateIcon>{icon}</EmptyStateIcon>
      <EmptyStateTitle>{copy.title}</EmptyStateTitle>
      <EmptyStateDescription>{copy.description}</EmptyStateDescription>
    </EmptyState>
  );
}

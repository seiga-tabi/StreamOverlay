import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PalworldServerConnectionInput,
  PalworldServerDashboardResponse,
  PalworldServerTestResponse
} from "@streamops/shared";
import { PALWORLD_SERVER_SAFE_REGISTRATION_POLICY } from "@streamops/shared";
import { DashboardApiError } from "../api/client";
import {
  getPalworldServerDashboard,
  refreshPalworldServerStatus,
  removePalworldServerConnection,
  savePalworldServerConnection,
  testPalworldServerConnection
} from "../features/palworld-server/api";
import { PalworldServerConnectionForm } from "../features/palworld-server/components/PalworldServerConnectionForm";
import {
  PalworldServerAvailabilityNotice,
  palworldServerAvailabilityCode,
  palworldServerAvailabilityTone
} from "../features/palworld-server/components/PalworldServerAvailabilityNotice";
import {
  canReusePalworldServerPassword,
  createTransientPalworldAdminPasswordState,
  type TransientPalworldAdminPasswordState
} from "../features/palworld-server/connection";
import {
  PalworldServerStatusPanel,
  palworldServerErrorCodeLabel,
  palworldServerStatusLabel,
  palworldServerStatusTone
} from "../features/palworld-server/components/PalworldServerStatusPanel";
import { palworldServerText, type PalworldServerText } from "../features/palworld-server/i18n";
import { dashboardLocale } from "../i18n";
import {
  Badge,
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
  SkeletonCard,
  StatusPill,
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastTone
} from "../shared/ui";
import "../features/palworld-server/PalworldServerPage.css";

type Operation = "testing" | "saving" | "refreshing" | "removing";

type Feedback = {
  id: number;
  tone: ToastTone;
  title: string;
  description: string;
};

const REGISTRATION_POLICY_ERROR_CODES = new Set([
  "invalid_url",
  "origin_not_allowed",
  "address_blocked"
]);

export function palworldServerOperationFailureDescription(
  error: unknown,
  text: PalworldServerText
): string {
  if (!(error instanceof DashboardApiError)) return text.operationFailedDescription;
  if (error.code && REGISTRATION_POLICY_ERROR_CODES.has(error.code)) {
    return text.registrationPolicyRejected;
  }
  if (error.code === "rate_limited") return text.errorCodes.rate_limited;
  if (error.code === "password_required") return text.errorCodes.password_required;
  if (error.code === "key_missing") return text.errorCodes.key_missing;
  if (error.code === "key_invalid") return text.errorCodes.key_invalid;
  if (error.code === "key_permission_denied") return text.errorCodes.key_permission_denied;
  if (error.code === "key_mismatch") return text.errorCodes.key_mismatch;
  if (error.code === "state_damaged") return text.errorCodes.state_damaged;
  return text.operationFailedDescription;
}

export function palworldServerOperationStatusDescription(
  response: PalworldServerTestResponse,
  text: PalworldServerText,
  fallback: string
): string {
  if (!response.status.errorCode) return fallback;
  return REGISTRATION_POLICY_ERROR_CODES.has(response.status.errorCode)
    ? text.registrationPolicyRejected
    : palworldServerErrorCodeLabel(response.status.errorCode, text);
}

function mergeTestResponse(
  current: PalworldServerDashboardResponse | undefined,
  response: PalworldServerTestResponse
): PalworldServerDashboardResponse {
  return {
    enabled: current?.enabled ?? true,
    pollIntervalSeconds: current?.pollIntervalSeconds ?? 30,
    registrationPolicy: current?.registrationPolicy ?? PALWORLD_SERVER_SAFE_REGISTRATION_POLICY,
    connection: current?.connection ?? response.connection,
    status: response.status
  };
}

export function PalworldServerPage() {
  const locale = dashboardLocale;
  const text = palworldServerText(locale);
  const mountedRef = useRef(true);
  const pollingRef = useRef(false);
  const operationRef = useRef<Operation>();
  const feedbackIdRef = useRef(0);
  const [dashboard, setDashboard] = useState<PalworldServerDashboardResponse>();
  const [baseUrl, setBaseUrl] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [baseUrlError, setBaseUrlError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [operation, setOperation] = useState<Operation>();
  const [removeOpen, setRemoveOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const [announcement, setAnnouncement] = useState("");
  const passwordStateRef = useRef<TransientPalworldAdminPasswordState>();

  if (!passwordStateRef.current) {
    passwordStateRef.current = createTransientPalworldAdminPasswordState(setAdminPassword);
  }

  operationRef.current = operation;

  const showFeedback = useCallback((tone: ToastTone, title: string, description: string) => {
    feedbackIdRef.current += 1;
    setFeedback({ id: feedbackIdRef.current, tone, title, description });
    setAnnouncement(`${title} ${description}`);
  }, []);

  const applyDashboard = useCallback((next: PalworldServerDashboardResponse, clearPassword = false) => {
    setDashboard(next);
    setBaseUrl(next.connection.baseUrl ?? "");
    if (clearPassword) passwordStateRef.current?.finishOperation();
    setBaseUrlError("");
    setPasswordError("");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const response = await getPalworldServerDashboard();
      if (!mountedRef.current) return;
      applyDashboard(response, true);
    } catch {
      if (mountedRef.current) setLoadFailed(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      passwordStateRef.current?.dispose();
    };
  }, [load]);

  useEffect(() => {
    if (!dashboard || palworldServerAvailabilityCode(dashboard) || !dashboard.connection.configured) return undefined;
    const intervalMs = Math.max(5, dashboard.pollIntervalSeconds) * 1_000;
    const timer = window.setInterval(() => {
      if (!mountedRef.current || pollingRef.current || operationRef.current) return;
      pollingRef.current = true;
      void getPalworldServerDashboard()
        .then((response) => {
          if (mountedRef.current && !operationRef.current) setDashboard(response);
        })
        .catch(() => undefined)
        .finally(() => {
          pollingRef.current = false;
        });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    dashboard?.connection.configured,
    dashboard?.enabled,
    dashboard?.pollIntervalSeconds,
    dashboard?.status.errorCode
  ]);

  function connectionInput(): PalworldServerConnectionInput | undefined {
    const normalizedBaseUrl = baseUrl.trim();
    const nextBaseUrlError = normalizedBaseUrl ? "" : text.baseUrlRequired;
    const canReusePassword = canReusePalworldServerPassword(
      dashboard?.connection.baseUrl,
      normalizedBaseUrl,
      dashboard?.connection.passwordConfigured ?? false
    );
    const nextPasswordError = canReusePassword || adminPassword.length > 0
      ? ""
      : dashboard?.connection.passwordConfigured
        ? text.passwordRequiredForUrlChange
        : text.passwordRequired;
    setBaseUrlError(nextBaseUrlError);
    setPasswordError(nextPasswordError);
    if (nextBaseUrlError || nextPasswordError) return undefined;
    return {
      baseUrl: normalizedBaseUrl,
      ...(adminPassword.length > 0 ? { adminPassword } : {})
    };
  }

  function operationDescription(response: PalworldServerTestResponse, fallback: string): string {
    return palworldServerOperationStatusDescription(response, text, fallback);
  }

  async function testConnection(): Promise<void> {
    const input = connectionInput();
    if (!input || operationRef.current) return;
    operationRef.current = "testing";
    setOperation("testing");
    try {
      const response = await testPalworldServerConnection(input);
      if (!mountedRef.current) return;
      setDashboard((current) => mergeTestResponse(current, response));
      const tone: ToastTone = response.status.state === "online" ? "success" : "warning";
      showFeedback(
        tone,
        text.testSuccessTitle,
        operationDescription(response, text.testSuccessDescription)
      );
    } catch (error) {
      if (mountedRef.current) {
        showFeedback("danger", text.operationFailedTitle, palworldServerOperationFailureDescription(error, text));
      }
    } finally {
      operationRef.current = undefined;
      if (mountedRef.current) {
        passwordStateRef.current?.finishOperation();
        setOperation(undefined);
      } else {
        passwordStateRef.current?.dispose();
      }
    }
  }

  async function saveConnection(): Promise<void> {
    const input = connectionInput();
    if (!input || operationRef.current) return;
    operationRef.current = "saving";
    setOperation("saving");
    try {
      const response = await savePalworldServerConnection(input);
      if (!mountedRef.current) return;
      if (response.connection.configured && response.status.state === "online") {
        applyDashboard(response, true);
        showFeedback("success", text.saveSuccessTitle, text.saveSuccessDescription);
      } else {
        setDashboard(response);
        showFeedback(
          "warning",
          text.saveRejectedTitle,
          operationDescription(response, text.saveRejectedDescription)
        );
      }
    } catch (error) {
      if (mountedRef.current) {
        showFeedback("danger", text.operationFailedTitle, palworldServerOperationFailureDescription(error, text));
      }
    } finally {
      operationRef.current = undefined;
      if (mountedRef.current) {
        passwordStateRef.current?.finishOperation();
        setOperation(undefined);
      } else {
        passwordStateRef.current?.dispose();
      }
    }
  }

  async function refreshStatus(): Promise<void> {
    if (!dashboard?.connection.configured || operationRef.current || pollingRef.current) return;
    operationRef.current = "refreshing";
    setOperation("refreshing");
    try {
      const response = await refreshPalworldServerStatus();
      if (!mountedRef.current) return;
      setDashboard(response);
      const tone: ToastTone = response.status.state === "online" ? "success" : "warning";
      showFeedback(
        tone,
        text.refreshSuccessTitle,
        operationDescription(response, text.refreshSuccessDescription)
      );
    } catch (error) {
      if (mountedRef.current) {
        showFeedback("danger", text.operationFailedTitle, palworldServerOperationFailureDescription(error, text));
      }
    } finally {
      operationRef.current = undefined;
      if (mountedRef.current) setOperation(undefined);
    }
  }

  async function removeConnection(): Promise<void> {
    if (operationRef.current) return;
    operationRef.current = "removing";
    setOperation("removing");
    try {
      const response = await removePalworldServerConnection();
      if (!mountedRef.current) return;
      applyDashboard(response, true);
      setRemoveOpen(false);
      showFeedback("success", text.removeSuccessTitle, text.removeSuccessDescription);
    } catch (error) {
      if (mountedRef.current) {
        showFeedback("danger", text.operationFailedTitle, palworldServerOperationFailureDescription(error, text));
      }
    } finally {
      operationRef.current = undefined;
      if (mountedRef.current) setOperation(undefined);
    }
  }

  const status = dashboard?.status;
  const availabilityCode = dashboard ? palworldServerAvailabilityCode(dashboard) : undefined;
  const statusLabel = availabilityCode
    ? text.availability[availabilityCode].label
    : status
      ? palworldServerStatusLabel(status.state, text)
      : text.status.unknown;
  const statusTone = availabilityCode
    ? palworldServerAvailabilityTone(availabilityCode)
    : palworldServerStatusTone(status?.state ?? "unknown");
  const showTestStatus = status && status.state !== "not_configured";

  return (
    <ToastProvider position="bottom-right">
      <div className="palworld-server-page">
        <PageHeader layout="split">
          <PageHeaderEyebrow>{text.eyebrow}</PageHeaderEyebrow>
          <PageHeaderTitle>{text.title}</PageHeaderTitle>
          <PageHeaderDescription>{text.description}</PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
            {dashboard?.pollIntervalSeconds && !availabilityCode ? (
              <Badge tone="neutral">
                {text.autoRefreshInterval} {dashboard.pollIntervalSeconds}{text.second}
              </Badge>
            ) : null}
          </PageHeaderStatus>
          <PageHeaderActions>
            <Button
              disabled={Boolean(availabilityCode) || !dashboard?.connection.configured || loading || Boolean(operation)}
              loading={operation === "refreshing"}
              loadingLabel={text.refreshing}
              onClick={() => void refreshStatus()}
              variant="secondary"
            >
              {text.refresh}
            </Button>
          </PageHeaderActions>
        </PageHeader>

        <p className="yoro-u-sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

        {loading ? (
          <div className="palworld-server-skeletons">
            <SkeletonCard loadingLabel={text.loading} size="lg" />
            <SkeletonCard size="lg" />
            <SkeletonCard size="lg" />
          </div>
        ) : null}

        {!loading && loadFailed && !dashboard ? (
          <EmptyState variant="error">
            <EmptyStateIcon>!</EmptyStateIcon>
            <EmptyStateTitle>{text.loadErrorTitle}</EmptyStateTitle>
            <EmptyStateDescription>{text.loadErrorDescription}</EmptyStateDescription>
            <EmptyStateActions><Button onClick={() => void load()}>{text.retry}</Button></EmptyStateActions>
          </EmptyState>
        ) : null}

        {!loading && availabilityCode ? (
          <PalworldServerAvailabilityNotice code={availabilityCode} text={text} />
        ) : null}

        {!loading && dashboard && !availabilityCode ? (
          <>
            {!dashboard.connection.configured ? (
              <EmptyState className="palworld-server-unconfigured" variant="streamer">
                <EmptyStateIcon>⚙</EmptyStateIcon>
                <EmptyStateTitle>{text.notConfiguredTitle}</EmptyStateTitle>
                <EmptyStateDescription>{text.notConfiguredDescription}</EmptyStateDescription>
              </EmptyState>
            ) : null}

            {showTestStatus ? (
              <PalworldServerStatusPanel
                connection={dashboard.connection}
                locale={locale}
                status={dashboard.status}
                text={text}
              />
            ) : null}

            <PalworldServerConnectionForm
              adminPassword={adminPassword}
              baseUrl={baseUrl}
              baseUrlError={baseUrlError}
              connection={dashboard.connection}
              registrationPolicy={dashboard.registrationPolicy}
              disabled={operation === "refreshing"}
              onAdminPasswordChange={(value) => {
                passwordStateRef.current?.update(value);
                if (value) setPasswordError("");
              }}
              onBaseUrlChange={(value) => {
                setBaseUrl(value);
                if (value.trim()) setBaseUrlError("");
              }}
              onRemove={() => setRemoveOpen(true)}
              onSave={() => void saveConnection()}
              onTest={() => void testConnection()}
              operation={operation === "refreshing" ? undefined : operation}
              passwordError={passwordError}
              passwordRequired={!canReusePalworldServerPassword(
                dashboard.connection.baseUrl,
                baseUrl,
                dashboard.connection.passwordConfigured
              )}
              text={text}
            />
          </>
        ) : null}

        <Modal
          closeDisabled={operation === "removing"}
          loading={operation === "removing"}
          onOpenChange={setRemoveOpen}
          open={removeOpen}
          size="sm"
        >
          <ModalHeader>
            <ModalTitle>{text.removeTitle}</ModalTitle>
            <ModalCloseButton aria-label={text.cancel} disabled={operation === "removing"}>×</ModalCloseButton>
          </ModalHeader>
          <ModalContent><ModalDescription>{text.removeDescription}</ModalDescription></ModalContent>
          <ModalFooter>
            <Button
              loading={operation === "removing"}
              loadingLabel={text.removing}
              onClick={() => void removeConnection()}
              variant="danger"
            >
              {text.removeConfirm}
            </Button>
            <Button disabled={operation === "removing"} onClick={() => setRemoveOpen(false)} variant="secondary">
              {text.cancel}
            </Button>
          </ModalFooter>
        </Modal>

        <ToastViewport className="palworld-server-toast-viewport">
          {feedback ? (
            <Toast key={feedback.id} autoDismiss onDismiss={() => setFeedback(undefined)} tone={feedback.tone}>
              <ToastTitle>{feedback.title}</ToastTitle>
              <ToastDescription>{feedback.description}</ToastDescription>
              <ToastCloseButton aria-label={text.close}>×</ToastCloseButton>
            </Toast>
          ) : null}
        </ToastViewport>
      </div>
    </ToastProvider>
  );
}

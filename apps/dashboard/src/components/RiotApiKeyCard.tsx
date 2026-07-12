import { useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy, uiText } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../shared/ui/EmptyState";
import { FormControl, FormField, FormHint, FormLabel, Input } from "../shared/ui/Form";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "../shared/ui/Modal";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Metric, StatusPill } from "../shared/ui/Status";
import { Toast, ToastCloseButton, ToastDescription, ToastProvider, ToastTitle, ToastViewport, type ToastTone } from "../shared/ui/Toast";

type RiotApiKeyStatus = {
  configured: boolean;
  source: "runtime" | "env" | "none";
  maskedKey?: string;
  updatedAt?: string;
  accountRegion: string;
  lolPlatform: string;
};

type RiotSettingsToast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

const emptyStatus: RiotApiKeyStatus = {
  configured: false,
  source: "none",
  accountRegion: "-",
  lolPlatform: "-"
};

const localI18n = {
  ko: {
    confirmClearTitle: "Riot API key 삭제",
    confirmClearDescription: "웹에 저장된 Riot API key를 삭제합니다. .env key가 없다면 전적/랭크 조회가 중단될 수 있습니다.",
    cancel: "취소",
    close: "닫기"
  },
  ja: {
    confirmClearTitle: "Riot API key 削除",
    confirmClearDescription: "Web に保存された Riot API key を削除します。.env key がない場合、戦績・ランク取得が停止する可能性があります。",
    cancel: "キャンセル",
    close: "閉じる"
  }
} as const;

const localText = createDashboardLocaleProxy(localI18n);

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function RiotApiKeyCard() {
  const t = uiText.settingsPage.riotApi;
  const [status, setStatus] = useState<RiotApiKeyStatus>(emptyStatus);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [toast, setToast] = useState<RiotSettingsToast | null>(null);

  function showToast(tone: ToastTone, title: string, description?: string): void {
    setToast({ id: Date.now(), tone, title, description });
  }

  async function loadStatus() {
    setLoading(true);
    try {
      setStatus(await apiGet<RiotApiKeyStatus>("/api/riot/settings"));
      setError("");
    } catch (err) {
      const detail = `${t.loadFailed}: ${String(err)}`;
      setError(detail);
      showToast("danger", t.loadFailed, String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const next = await apiPost<RiotApiKeyStatus>("/api/riot/api-key", { apiKey });
      setStatus(next);
      setApiKey("");
      setMessage(t.saved);
      showToast("success", t.saved);
    } catch (err) {
      const detail = `${t.saveFailed}: ${String(err)}`;
      setError(detail);
      showToast("danger", t.saveFailed, String(err));
    } finally {
      setSaving(false);
    }
  }

  async function clearRuntimeKey() {
    setClearing(true);
    setMessage("");
    setError("");
    try {
      const next = await apiPost<RiotApiKeyStatus>("/api/riot/api-key/delete", {});
      setStatus(next);
      setClearOpen(false);
      setMessage(t.cleared);
      showToast("success", t.cleared);
    } catch (err) {
      const detail = `${t.clearFailed}: ${String(err)}`;
      setError(detail);
      showToast("danger", t.clearFailed, String(err));
    } finally {
      setClearing(false);
    }
  }

  return (
    <ToastProvider position="top-right">
      <Card as="section" className="settings-shared-card riot-key-card" padding="lg" variant="glass">
        <CardHeader className="settings-shared-card-header">
          <div>
            <CardTitle as="h2">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </div>
          <StatusPill tone={status.configured ? "success" : "warning"}>
            {status.configured ? t.configured : t.notConfigured}
          </StatusPill>
        </CardHeader>

        <CardContent className="settings-shared-card-content">
          {loading ? (
            <SkeletonCard loadingLabel={t.title} size="md">
              <SkeletonText lines={3} size="md" />
            </SkeletonCard>
          ) : (
            <div className="settings-shared-metric-grid settings-shared-metric-grid--compact">
              <Metric label={t.source} value={t.sources[status.source]} tone={status.configured ? "success" : "warning"} size="sm" />
              <Metric label={t.maskedKey} value={status.maskedKey ?? "-"} tone="neutral" size="sm" />
              <Metric label={t.accountRegion} value={status.accountRegion} tone="info" size="sm" />
              <Metric label={t.lolPlatform} value={status.lolPlatform} tone="streamer" size="sm" />
              <Metric label={t.updatedAt} value={formatDate(status.updatedAt)} tone="neutral" size="sm" />
            </div>
          )}

          {error ? (
            <EmptyState className="settings-shared-empty-inline" variant="error">
              <EmptyStateIcon>!</EmptyStateIcon>
              <EmptyStateTitle as="h3">{t.loadFailed}</EmptyStateTitle>
              <EmptyStateDescription>{error}</EmptyStateDescription>
            </EmptyState>
          ) : null}

          <form className="settings-shared-form" onSubmit={save}>
            <FormField controlId="riot-api-key-input" disabled={saving || loading} required>
              <FormLabel>{t.inputLabel}</FormLabel>
              <FormControl>
                <Input
                  id="riot-api-key-input"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={t.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </FormControl>
              <FormHint>{t.notes[0]}</FormHint>
            </FormField>

            <CardFooter className="settings-shared-actions settings-shared-actions--flush">
              <Button type="submit" loading={saving} disabled={saving || loading || !apiKey.trim()}>
                {saving ? t.saving : t.save}
              </Button>
              <Button type="button" variant="danger" loading={clearing} onClick={() => setClearOpen(true)} disabled={clearing || status.source !== "runtime"}>
                {clearing ? t.clearing : t.clear}
              </Button>
            </CardFooter>
          </form>

          <ul className="settings-shared-note-list">
            {t.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
          {message ? <StatusPill tone="success">{message}</StatusPill> : null}
        </CardContent>
      </Card>

      <Modal open={clearOpen} onOpenChange={setClearOpen} size="sm" loading={clearing}>
        <ModalHeader>
          <ModalTitle>{localText.confirmClearTitle}</ModalTitle>
          <ModalDescription>{localText.confirmClearDescription}</ModalDescription>
        </ModalHeader>
        <ModalContent>
          <StatusPill tone="danger">{t.clear}</StatusPill>
        </ModalContent>
        <ModalFooter>
          <Button variant="danger" loading={clearing} onClick={() => void clearRuntimeKey()}>{t.clear}</Button>
          <Button variant="secondary" disabled={clearing} onClick={() => setClearOpen(false)}>{localText.cancel}</Button>
        </ModalFooter>
      </Modal>

      <ToastViewport className="settings-shared-toast-viewport">
        {toast ? (
          <Toast key={toast.id} autoDismiss tone={toast.tone} onDismiss={() => setToast(null)}>
            <ToastTitle>{toast.title}</ToastTitle>
            {toast.description ? <ToastDescription>{toast.description}</ToastDescription> : null}
            <ToastCloseButton aria-label={localText.close}>×</ToastCloseButton>
          </Toast>
        ) : null}
      </ToastViewport>
    </ToastProvider>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  SupportMailMessage,
  SupportMailMessageSummary,
  SupportMailboxListResponse
} from "@streamops/shared";
import { apiDelete, apiGet, apiPost } from "../api/client";
import { dashboardLocale } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "../shared/ui/EmptyState";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "../shared/ui/Modal";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle
} from "../shared/ui/PageHeader";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import "./SupportInboxPage.css";

type MailFilter = "all" | "unread" | "read";

const text = {
  ko: {
    eyebrow: "Admin Support",
    title: "문의 메일",
    description: "support@yoro.gg로 수신된 문의를 관리자 전용 받은편지함에서 확인합니다.",
    refresh: "새로고침",
    refreshing: "불러오는 중",
    all: "전체",
    unread: "읽지 않음",
    read: "읽음",
    inbox: "받은편지함",
    total: "전체 메일",
    unreadCount: "읽지 않음",
    retention: "보관 기간",
    days: "일",
    disabledTitle: "메일 수신이 아직 활성화되지 않았습니다.",
    disabledDescription: "Cloudflare Email Routing과 서버의 SUPPORT_MAILBOX 설정을 완료해주세요.",
    emptyTitle: "표시할 문의 메일이 없습니다.",
    emptyDescription: "선택한 필터에 해당하는 메일이 도착하면 이곳에 표시됩니다.",
    selectTitle: "메일을 선택해주세요.",
    selectDescription: "왼쪽 목록에서 문의를 선택하면 본문과 발신 정보를 확인할 수 있습니다.",
    noSubject: "제목 없음",
    noBody: "텍스트 본문이 없는 메일입니다.",
    sender: "보낸 사람",
    recipient: "받는 주소",
    receivedAt: "수신 시각",
    replyTo: "답장 주소",
    attachments: "첨부파일",
    attachmentNotice: "보안을 위해 첨부파일 내용은 저장하지 않고 메타데이터만 표시합니다.",
    reply: "답장하기",
    markRead: "읽음 처리",
    markUnread: "읽지 않음 처리",
    delete: "삭제",
    deleteTitle: "문의 메일을 삭제할까요?",
    deleteDescription: "삭제한 메일은 복구할 수 없습니다.",
    cancel: "취소",
    deleteConfirm: "삭제하기",
    loadFailed: "문의 메일을 불러오지 못했습니다.",
    updateFailed: "메일 상태를 변경하지 못했습니다.",
    deleteFailed: "메일을 삭제하지 못했습니다.",
    enabled: "수신 활성",
    disabled: "수신 비활성"
  },
  ja: {
    eyebrow: "Admin Support",
    title: "お問い合わせメール",
    description: "support@yoro.ggで受信したお問い合わせを管理者専用受信箱で確認します。",
    refresh: "更新",
    refreshing: "読み込み中",
    all: "すべて",
    unread: "未読",
    read: "既読",
    inbox: "受信箱",
    total: "全メール",
    unreadCount: "未読",
    retention: "保存期間",
    days: "日",
    disabledTitle: "メール受信はまだ有効化されていません。",
    disabledDescription: "Cloudflare Email RoutingとサーバーのSUPPORT_MAILBOX設定を完了してください。",
    emptyTitle: "表示するお問い合わせメールはありません。",
    emptyDescription: "選択したフィルターに該当するメールが届くとここに表示されます。",
    selectTitle: "メールを選択してください。",
    selectDescription: "左側の一覧からお問い合わせを選ぶと本文と送信者情報を確認できます。",
    noSubject: "件名なし",
    noBody: "テキスト本文がないメールです。",
    sender: "送信者",
    recipient: "受信アドレス",
    receivedAt: "受信日時",
    replyTo: "返信先",
    attachments: "添付ファイル",
    attachmentNotice: "安全のため添付ファイル本体は保存せず、メタデータのみ表示します。",
    reply: "返信する",
    markRead: "既読にする",
    markUnread: "未読にする",
    delete: "削除",
    deleteTitle: "お問い合わせメールを削除しますか？",
    deleteDescription: "削除したメールは復元できません。",
    cancel: "キャンセル",
    deleteConfirm: "削除する",
    loadFailed: "お問い合わせメールを読み込めませんでした。",
    updateFailed: "メールの状態を変更できませんでした。",
    deleteFailed: "メールを削除できませんでした。",
    enabled: "受信有効",
    disabled: "受信無効"
  }
} as const;

const emptyMailbox: SupportMailboxListResponse = {
  enabled: false,
  address: "support@yoro.gg",
  retentionDays: 90,
  totalCount: 0,
  unreadCount: 0,
  messages: []
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(dashboardLocale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function senderLabel(message: SupportMailMessageSummary | SupportMailMessage): string {
  return message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address;
}

export function SupportInboxPage() {
  const t = text[dashboardLocale];
  const [filter, setFilter] = useState<MailFilter>("all");
  const [mailbox, setMailbox] = useState<SupportMailboxListResponse>(emptyMailbox);
  const [selected, setSelected] = useState<SupportMailMessage>();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const response = await apiGet<SupportMailboxListResponse>(`/api/support-mailbox?filter=${filter}&limit=100`);
    setMailbox(response);
  }, [filter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [load, t.loadFailed]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filters = useMemo(() => [
    { value: "all" as const, label: t.all, count: mailbox.totalCount },
    { value: "unread" as const, label: t.unread, count: mailbox.unreadCount },
    { value: "read" as const, label: t.read, count: Math.max(0, mailbox.totalCount - mailbox.unreadCount) }
  ], [mailbox.totalCount, mailbox.unreadCount, t]);

  async function openMessage(summary: SupportMailMessageSummary): Promise<void> {
    setDetailLoading(true);
    setError("");
    try {
      const response = await apiGet<{ message: SupportMailMessage }>(`/api/support-mailbox/${encodeURIComponent(summary.id)}`);
      let message = response.message;
      if (!message.readAt) {
        const updated = await apiPost<{ message: SupportMailMessage }>(`/api/support-mailbox/${encodeURIComponent(summary.id)}/read`, { read: true });
        message = updated.message;
        await load();
      }
      setSelected(message);
    } catch {
      setError(t.loadFailed);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleRead(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiPost<{ message: SupportMailMessage }>(`/api/support-mailbox/${encodeURIComponent(selected.id)}/read`, { read: Boolean(selected.readAt) ? false : true });
      setSelected(response.message);
      await load();
    } catch {
      setError(t.updateFailed);
    } finally {
      setBusy(false);
    }
  }

  async function deleteMessage(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await apiDelete<{ ok: true }>(`/api/support-mailbox/${encodeURIComponent(selected.id)}`);
      setSelected(undefined);
      setDeleteOpen(false);
      await load();
    } catch {
      setError(t.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="support-inbox-page">
      <PageHeader layout="split">
        <PageHeaderEyebrow>{t.eyebrow}</PageHeaderEyebrow>
        <PageHeaderTitle data-ko={text.ko.title} data-ja={text.ja.title}>{t.title}</PageHeaderTitle>
        <PageHeaderDescription data-ko={text.ko.description} data-ja={text.ja.description}>{t.description}</PageHeaderDescription>
        <PageHeaderStatus>
          <StatusPill tone={mailbox.enabled ? "success" : "warning"}>
            {mailbox.enabled ? t.enabled : t.disabled}
          </StatusPill>
          <Badge tone="admin">{mailbox.address}</Badge>
        </PageHeaderStatus>
        <PageHeaderActions>
          <Button loading={loading} loadingLabel={t.refreshing} onClick={() => void refresh()} size="sm" variant="secondary">
            {t.refresh}
          </Button>
        </PageHeaderActions>
      </PageHeader>

      {error ? <p className="support-inbox-error" role="alert">{error}</p> : null}

      <div className="support-inbox-metrics" aria-label={t.inbox}>
        <Metric label={t.total} value={mailbox.totalCount} size="sm" tone="info" />
        <Metric label={t.unreadCount} value={mailbox.unreadCount} size="sm" tone={mailbox.unreadCount ? "warning" : "neutral"} />
        <Metric label={t.retention} value={`${mailbox.retentionDays}${t.days}`} size="sm" tone="neutral" />
      </div>

      {!mailbox.enabled && !loading ? (
        <Card padding="lg" variant="warning">
          <EmptyState variant="error">
            <EmptyStateTitle>{t.disabledTitle}</EmptyStateTitle>
            <EmptyStateDescription>{t.disabledDescription}</EmptyStateDescription>
          </EmptyState>
        </Card>
      ) : (
        <div className="support-inbox-layout">
          <Card as="section" className="support-inbox-list-card" padding="none" variant="glass">
            <CardHeader className="support-inbox-list-header">
              <CardTitle as="h2">{t.inbox}</CardTitle>
              <div className="support-inbox-filters" role="group" aria-label={t.inbox}>
                {filters.map((item) => (
                  <Button
                    aria-pressed={filter === item.value}
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    size="sm"
                    variant={filter === item.value ? "primary" : "ghost"}
                  >
                    {item.label} {item.count}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="support-inbox-list-content">
              {loading ? (
                <SkeletonCard loadingLabel={t.refreshing}><SkeletonText lines={6} /></SkeletonCard>
              ) : mailbox.messages.length === 0 ? (
                <EmptyState variant="default">
                  <EmptyStateTitle as="h3">{t.emptyTitle}</EmptyStateTitle>
                  <EmptyStateDescription>{t.emptyDescription}</EmptyStateDescription>
                </EmptyState>
              ) : (
                <div className="support-mail-list">
                  {mailbox.messages.map((message) => (
                    <button
                      className="support-mail-row"
                      data-active={selected?.id === message.id ? "true" : undefined}
                      data-unread={!message.readAt ? "true" : undefined}
                      key={message.id}
                      onClick={() => void openMessage(message)}
                      type="button"
                    >
                      <span className="support-mail-row__top">
                        <strong>{senderLabel(message)}</strong>
                        <time dateTime={message.receivedAt}>{formatDate(message.receivedAt)}</time>
                      </span>
                      <span className="support-mail-row__subject">{message.subject || t.noSubject}</span>
                      <span className="support-mail-row__preview">{message.preview || t.noBody}</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card as="section" className="support-inbox-detail-card" padding="lg" variant="elevated">
            {detailLoading ? (
              <SkeletonCard loadingLabel={t.refreshing}><SkeletonText lines={8} /></SkeletonCard>
            ) : selected ? (
              <>
                <CardHeader className="support-mail-detail-header">
                  <div>
                    <StatusPill size="sm" tone={selected.readAt ? "neutral" : "warning"}>{selected.readAt ? t.read : t.unread}</StatusPill>
                    <CardTitle as="h2">{selected.subject || t.noSubject}</CardTitle>
                  </div>
                  <time dateTime={selected.receivedAt}>{formatDate(selected.receivedAt)}</time>
                </CardHeader>
                <CardContent className="support-mail-detail">
                  <dl className="support-mail-meta">
                    <div><dt>{t.sender}</dt><dd>{senderLabel(selected)}</dd></div>
                    <div><dt>{t.replyTo}</dt><dd>{selected.replyTo || selected.from.address}</dd></div>
                    <div><dt>{t.recipient}</dt><dd>{selected.to}</dd></div>
                    <div><dt>{t.receivedAt}</dt><dd>{formatDate(selected.receivedAt)}</dd></div>
                  </dl>
                  <pre className="support-mail-body">{selected.text || t.noBody}</pre>
                  {selected.attachments.length ? (
                    <section className="support-mail-attachments">
                      <h3>{t.attachments} {selected.attachments.length}</h3>
                      <p>{t.attachmentNotice}</p>
                      <ul>
                        {selected.attachments.map((attachment, index) => (
                          <li key={`${attachment.fileName}-${index}`}>
                            <strong>{attachment.fileName}</strong>
                            <span>{attachment.mimeType} · {formatBytes(attachment.sizeBytes)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  <div className="support-mail-actions">
                    <Button as="a" href={`mailto:${selected.replyTo || selected.from.address}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`} size="sm" variant="primary">
                      {t.reply}
                    </Button>
                    <Button disabled={busy} onClick={() => void toggleRead()} size="sm" variant="secondary">
                      {selected.readAt ? t.markUnread : t.markRead}
                    </Button>
                    <Button disabled={busy} onClick={() => setDeleteOpen(true)} size="sm" variant="danger">
                      {t.delete}
                    </Button>
                  </div>
                </CardContent>
              </>
            ) : (
              <EmptyState variant="default">
                <EmptyStateTitle>{t.selectTitle}</EmptyStateTitle>
                <EmptyStateDescription>{t.selectDescription}</EmptyStateDescription>
              </EmptyState>
            )}
          </Card>
        </div>
      )}

      <Modal open={deleteOpen} onOpenChange={setDeleteOpen} size="sm" loading={busy}>
        <ModalHeader><ModalTitle>{t.deleteTitle}</ModalTitle></ModalHeader>
        <ModalContent><ModalDescription>{t.deleteDescription}</ModalDescription></ModalContent>
        <ModalFooter>
          <Button disabled={busy} onClick={() => setDeleteOpen(false)} variant="secondary">{t.cancel}</Button>
          <Button loading={busy} onClick={() => void deleteMessage()} variant="danger">{t.deleteConfirm}</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

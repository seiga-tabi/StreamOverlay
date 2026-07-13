import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CommunityModerationSnapshot,
  CommunityPost,
  CommunityPostReport,
  CommunityReportReason,
  CommunitySanction
} from "@streamops/shared";
import {
  getCommunityModeration,
  updateCommunityPostVisibility,
  updateCommunityUserSanction
} from "../api/client";
import { dashboardLocale } from "../i18n";
import { Button } from "../shared/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../shared/ui/Card";
import { EmptyState, EmptyStateDescription, EmptyStateTitle } from "../shared/ui/EmptyState";
import { FormControl, FormField, FormLabel, Textarea } from "../shared/ui/Form";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "../shared/ui/Modal";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle
} from "../shared/ui/PageHeader";
import { SkeletonCard } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import "./CommunityModerationPage.css";

type ModerationAction = {
  kind: "hide" | "restore" | "suspend" | "unsuspend";
  postId?: string;
  twitchUserId?: string;
  twitchLogin?: string;
  label: string;
};

const text = {
  ko: {
    eyebrow: "Admin Community",
    title: "커뮤니티 관리",
    description: "신고를 검토하고 게시글 숨김과 작성 제한을 관리합니다. 삭제 대신 복구 가능한 상태 변경을 사용합니다.",
    refresh: "새로고침",
    loading: "커뮤니티 관리 정보를 불러오는 중입니다.",
    loadFailed: "커뮤니티 관리 정보를 불러오지 못했습니다.",
    updateFailed: "관리 상태를 변경하지 못했습니다.",
    openReports: "미처리 신고",
    hiddenPosts: "숨김 게시글",
    activeSanctions: "작성 제한",
    reports: "신고 목록",
    noReports: "처리할 신고가 없습니다.",
    noReportsDescription: "새 신고가 접수되면 게시글과 신고 사유가 이곳에 표시됩니다.",
    hidden: "숨김",
    visible: "공개",
    resolved: "처리 완료",
    open: "검토 필요",
    reporter: "신고자",
    author: "작성자",
    hide: "게시글 숨기기",
    restore: "게시글 복구",
    suspend: "작성 제한",
    unsuspend: "제한 해제",
    reason: "처리 사유",
    reasonPlaceholder: "관리 기록에 남길 사유를 입력해주세요.",
    cancel: "취소",
    confirm: "적용",
    confirmDescription: "이 작업은 감사 기록과 커뮤니티 상태 파일에 저장됩니다.",
    sanctions: "제재 기록",
    noSanctions: "작성 제한 기록이 없습니다.",
    indefinite: "해제 전까지",
    expired: "만료",
    active: "적용 중",
    revoked: "해제됨",
    reasons: {
      spam: "스팸·광고",
      harassment: "괴롭힘·혐오",
      privacy: "개인정보 노출",
      other: "기타"
    }
  },
  ja: {
    eyebrow: "Admin Community",
    title: "コミュニティ管理",
    description: "通報を確認し、投稿の非表示と投稿制限を管理します。削除せず復元可能な状態変更を使用します。",
    refresh: "更新",
    loading: "コミュニティ管理情報を読み込んでいます。",
    loadFailed: "コミュニティ管理情報を読み込めませんでした。",
    updateFailed: "管理状態を変更できませんでした。",
    openReports: "未処理の通報",
    hiddenPosts: "非表示投稿",
    activeSanctions: "投稿制限",
    reports: "通報一覧",
    noReports: "確認が必要な通報はありません。",
    noReportsDescription: "新しい通報が届くと投稿と理由がここに表示されます。",
    hidden: "非表示",
    visible: "公開",
    resolved: "対応済み",
    open: "要確認",
    reporter: "通報者",
    author: "投稿者",
    hide: "投稿を非表示",
    restore: "投稿を復元",
    suspend: "投稿を制限",
    unsuspend: "制限を解除",
    reason: "対応理由",
    reasonPlaceholder: "管理記録に残す理由を入力してください。",
    cancel: "キャンセル",
    confirm: "適用",
    confirmDescription: "この操作は監査記録とコミュニティ状態ファイルに保存されます。",
    sanctions: "制限履歴",
    noSanctions: "投稿制限の履歴はありません。",
    indefinite: "解除まで",
    expired: "期限切れ",
    active: "適用中",
    revoked: "解除済み",
    reasons: {
      spam: "スパム・広告",
      harassment: "嫌がらせ・ヘイト",
      privacy: "個人情報の露出",
      other: "その他"
    }
  }
} as const;

function isSanctionActive(sanction: CommunitySanction): boolean {
  if (sanction.revokedAt) return false;
  if (!sanction.expiresAt) return true;
  const expiresAt = Date.parse(sanction.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function formattedDate(value: string | undefined, locale: "ko" | "ja"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function CommunityModerationPage() {
  const locale = dashboardLocale;
  const t = text[locale];
  const [snapshot, setSnapshot] = useState<CommunityModerationSnapshot>({ posts: [], reports: [], sanctions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<ModerationAction>();
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSnapshot(await getCommunityModeration());
    } catch {
      setError(t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [t.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const postsById = useMemo(() => new Map(snapshot.posts.map((post) => [post.id, post])), [snapshot.posts]);
  const openReports = snapshot.reports.filter((report) => report.status === "open");
  const hiddenPosts = snapshot.posts.filter((post) => post.moderation?.visibility === "hidden");
  const activeSanctions = snapshot.sanctions.filter(isSanctionActive);

  function beginAction(nextAction: ModerationAction): void {
    setReason("");
    setAction(nextAction);
  }

  async function confirmAction(): Promise<void> {
    if (!action || busy) return;
    if ((action.kind === "hide" || action.kind === "suspend") && !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      const nextSnapshot = action.kind === "hide" || action.kind === "restore"
        ? await updateCommunityPostVisibility({
            postId: action.postId ?? "",
            visibility: action.kind === "hide" ? "hidden" : "visible",
            reason: reason.trim() || undefined
          })
        : await updateCommunityUserSanction({
            twitchUserId: action.twitchUserId ?? "",
            twitchLogin: action.twitchLogin,
            active: action.kind === "suspend",
            reason: reason.trim() || undefined
          });
      setSnapshot(nextSnapshot);
      setAction(undefined);
      setReason("");
    } catch {
      setError(t.updateFailed);
    } finally {
      setBusy(false);
    }
  }

  function moderationButtons(post: CommunityPost) {
    const hidden = post.moderation?.visibility === "hidden";
    const sanctioned = activeSanctions.some((sanction) => sanction.twitchUserId === post.authorTwitchUserId);
    return (
      <div className="community-moderation-actions">
        <Button
          size="sm"
          variant={hidden ? "secondary" : "danger"}
          onClick={() => beginAction({
            kind: hidden ? "restore" : "hide",
            postId: post.id,
            label: hidden ? t.restore : t.hide
          })}
        >
          {hidden ? t.restore : t.hide}
        </Button>
        <Button
          size="sm"
          variant={sanctioned ? "secondary" : "tertiary"}
          onClick={() => beginAction({
            kind: sanctioned ? "unsuspend" : "suspend",
            twitchUserId: post.authorTwitchUserId,
            twitchLogin: post.authorTwitchLogin,
            label: sanctioned ? t.unsuspend : t.suspend
          })}
        >
          {sanctioned ? t.unsuspend : t.suspend}
        </Button>
      </div>
    );
  }

  return (
    <div className="community-moderation-page">
      <PageHeader layout="split">
        <PageHeaderEyebrow>{t.eyebrow}</PageHeaderEyebrow>
        <PageHeaderTitle data-ko={text.ko.title} data-ja={text.ja.title}>{t.title}</PageHeaderTitle>
        <PageHeaderDescription data-ko={text.ko.description} data-ja={text.ja.description}>{t.description}</PageHeaderDescription>
        <PageHeaderStatus>
          <StatusPill tone={openReports.length ? "warning" : "success"}>{openReports.length ? t.open : t.resolved}</StatusPill>
        </PageHeaderStatus>
        <PageHeaderActions>
          <Button loading={loading} loadingLabel={t.loading} size="sm" variant="secondary" onClick={() => void load()}>{t.refresh}</Button>
        </PageHeaderActions>
      </PageHeader>

      {error ? <p className="community-moderation-error" role="alert">{error}</p> : null}

      <div className="community-moderation-metrics" aria-label={t.title}>
        <Metric label={t.openReports} value={openReports.length} tone={openReports.length ? "warning" : "neutral"} size="sm" />
        <Metric label={t.hiddenPosts} value={hiddenPosts.length} tone={hiddenPosts.length ? "danger" : "neutral"} size="sm" />
        <Metric label={t.activeSanctions} value={activeSanctions.length} tone={activeSanctions.length ? "admin" : "neutral"} size="sm" />
      </div>

      <Card as="section" className="community-moderation-section" padding="lg" variant="glass">
        <CardHeader>
          <CardTitle as="h2">{t.reports}</CardTitle>
          <Badge tone={openReports.length ? "warning" : "neutral"}>{openReports.length}</Badge>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonCard loadingLabel={t.loading} /> : openReports.length === 0 ? (
            <EmptyState variant="community">
              <EmptyStateTitle as="h3">{t.noReports}</EmptyStateTitle>
              <EmptyStateDescription>{t.noReportsDescription}</EmptyStateDescription>
            </EmptyState>
          ) : (
            <div className="community-moderation-list">
              {openReports.map((report) => {
                const post = postsById.get(report.postId);
                return (
                  <Card as="article" className="community-moderation-row" key={report.id} padding="md" variant="default">
                    <CardHeader>
                      <div>
                        <CardTitle as="h3">{post?.title ?? report.postId}</CardTitle>
                        <CardDescription>{t.author}: {post?.authorDisplayName ?? "-"} · {formattedDate(report.createdAt, locale)}</CardDescription>
                      </div>
                      <StatusPill size="sm" tone="warning">{t.reasons[report.reason as CommunityReportReason]}</StatusPill>
                    </CardHeader>
                    <CardContent>
                      <p>{report.detail || t.reasons[report.reason as CommunityReportReason]}</p>
                      <small>{t.reporter}: {report.reporterDisplayName} (@{report.reporterTwitchLogin})</small>
                    </CardContent>
                    <CardFooter>{post ? moderationButtons(post) : <StatusPill tone="neutral">{t.expired}</StatusPill>}</CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="community-moderation-secondary-grid">
        <Card as="section" padding="lg" variant="glass">
          <CardHeader><CardTitle as="h2">{t.hiddenPosts}</CardTitle><Badge tone="danger">{hiddenPosts.length}</Badge></CardHeader>
          <CardContent className="community-moderation-compact-list">
            {hiddenPosts.length ? hiddenPosts.map((post) => (
              <div className="community-moderation-compact-row" key={post.id}>
                <div><strong>{post.title}</strong><small>{post.authorDisplayName} · {post.moderation?.reason ?? "-"}</small></div>
                {moderationButtons(post)}
              </div>
            )) : <EmptyState><EmptyStateTitle as="h3">{t.visible}</EmptyStateTitle></EmptyState>}
          </CardContent>
        </Card>
        <Card as="section" padding="lg" variant="glass">
          <CardHeader><CardTitle as="h2">{t.sanctions}</CardTitle><Badge tone="admin">{snapshot.sanctions.length}</Badge></CardHeader>
          <CardContent className="community-moderation-compact-list">
            {snapshot.sanctions.length ? snapshot.sanctions.map((sanction) => (
              <div className="community-moderation-compact-row" key={sanction.id}>
                <div>
                  <strong>@{sanction.twitchLogin || sanction.twitchUserId}</strong>
                  <small>{sanction.reason} · {sanction.expiresAt ? formattedDate(sanction.expiresAt, locale) : t.indefinite}</small>
                </div>
                <StatusPill size="sm" tone={isSanctionActive(sanction) ? "danger" : "neutral"}>{isSanctionActive(sanction) ? t.active : t.revoked}</StatusPill>
              </div>
            )) : <EmptyState><EmptyStateTitle as="h3">{t.noSanctions}</EmptyStateTitle></EmptyState>}
          </CardContent>
        </Card>
      </div>

      <Modal open={Boolean(action)} loading={busy} onClose={() => setAction(undefined)} size="sm">
        <ModalHeader><ModalTitle>{action?.label ?? t.confirm}</ModalTitle></ModalHeader>
        <ModalContent>
          <ModalDescription>{t.confirmDescription}</ModalDescription>
          <FormField required={action?.kind === "hide" || action?.kind === "suspend"}>
            <FormLabel>{t.reason}</FormLabel>
            <FormControl>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder={t.reasonPlaceholder} />
            </FormControl>
          </FormField>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAction(undefined)} disabled={busy}>{t.cancel}</Button>
          <Button
            variant={action?.kind === "hide" || action?.kind === "suspend" ? "danger" : "primary"}
            loading={busy}
            disabled={(action?.kind === "hide" || action?.kind === "suspend") && !reason.trim()}
            onClick={() => void confirmAction()}
          >
            {t.confirm}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

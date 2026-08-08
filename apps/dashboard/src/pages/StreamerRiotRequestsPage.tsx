import { useEffect, useMemo, useState } from "react";
import {
  parseStreamerRiotIdRequestListResponse,
  type StreamerRiotIdRequest,
  type StreamerRiotIdRequestListItem
} from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { AdminConfirmDialog } from "../components/AdminConfirmDialog";

type DashboardSnapshot = {
  streamerRiotIdRequests?: StreamerRiotIdRequest[];
};

type AdminStreamerRiotIdRequest = Omit<StreamerRiotIdRequestListItem, "verification"> & {
  /** 초기 dashboard snapshot·mutation 구형 응답에는 없을 수 있습니다. */
  verification?: StreamerRiotIdRequestListItem["verification"];
};

const i18n = {
  ko: {
    title: "스트리머 Riot ID 승인",
    description: "Twitch 로그인 사용자가 신청한 Riot ID를 확인하고 승인하면 공개 전적의 팔로우 방송인 목록에 연결됩니다.",
    empty: "처리할 등록 요청이 없습니다.",
    loadFailed: "등록 요청을 불러오지 못했습니다.",
    resolveFailed: "등록 요청 처리에 실패했습니다.",
    dashboardAccessFailed: "대시보드 사용 권한 변경에 실패했습니다.",
    resolved: "등록 요청을 처리했습니다.",
    dashboardAccessUpdated: "대시보드 사용 권한을 변경했습니다.",
    pending: "대기",
    approved: "승인됨",
    rejected: "거절됨",
    pendingCount: "대기 요청",
    approvedCount: "승인 완료",
    totalCount: "전체 요청",
    twitchAccount: "Twitch 계정",
    riotId: "Riot ID",
    dashboardAccess: "대시보드 사용",
    dashboardEnabled: "사용 가능",
    dashboardDisabled: "사용 불가",
    status: "상태",
    requestedAt: "요청 시간",
    reviewedAt: "처리 시간",
    approve: "승인",
    reject: "거절",
    dashboardEnable: "대시보드 허용",
    dashboardDisable: "대시보드 차단",
    loading: "불러오는 중",
    none: "없음",
    search: "Twitch 또는 Riot ID 검색",
    searchEmpty: "검색 결과가 없습니다.",
    filterAll: "전체",
    reapprove: "승인으로 변경",
    confirmApproveTitle: "스트리머 승인",
    confirmApproveBody: "승인하면 공개 전적에 노출되고 스트리머 기능이 열립니다. 되돌리려면 별도 차단이 필요합니다.",
    confirmApprove: "승인합니다",
    confirmRejectTitle: "신청 거절",
    confirmRejectBody: "사유는 감사 기록에 남습니다. 신청자가 다시 신청할 때 참고합니다.",
    confirmReject: "거절합니다",
    cancel: "취소",
    reasonLabel: "거절 사유 (필수)",
    reasonPlaceholder: "사유를 입력하세요",
    reasonRiot: "Riot ID 확인 불가",
    reasonIdentity: "본인 확인 필요",
    reasonOther: "직접 입력",
    noteLabel: "거절 사유",
    processing: "처리 중"
  },
  ja: {
    title: "配信者 Riot ID 承認",
    description: "Twitchログインユーザーが申請した Riot ID を確認し、承認すると公開戦績のフォロー配信者一覧に連携されます。",
    empty: "処理する登録申請はありません。",
    loadFailed: "登録申請を読み込めませんでした。",
    resolveFailed: "登録申請の処理に失敗しました。",
    dashboardAccessFailed: "ダッシュボード利用権限の変更に失敗しました。",
    resolved: "登録申請を処理しました。",
    dashboardAccessUpdated: "ダッシュボード利用権限を変更しました。",
    pending: "待機",
    approved: "承認済み",
    rejected: "拒否済み",
    pendingCount: "待機申請",
    approvedCount: "承認完了",
    totalCount: "全申請",
    twitchAccount: "Twitch アカウント",
    riotId: "Riot ID",
    dashboardAccess: "ダッシュボード利用",
    dashboardEnabled: "利用可",
    dashboardDisabled: "利用不可",
    status: "状態",
    requestedAt: "申請時間",
    reviewedAt: "処理時間",
    approve: "承認",
    reject: "拒否",
    dashboardEnable: "利用を許可",
    dashboardDisable: "利用を停止",
    loading: "読み込み中",
    none: "なし",
    search: "Twitch または Riot ID を検索",
    searchEmpty: "検索結果がありません。",
    filterAll: "すべて",
    reapprove: "承認に変更",
    confirmApproveTitle: "配信者を承認",
    confirmApproveBody: "承認すると公開戦績に表示され、ストリーマー機能が利用できます。取り消すには別途ブロックが必要です。",
    confirmApprove: "承認します",
    confirmRejectTitle: "申請を拒否",
    confirmRejectBody: "理由は監査記録に残ります。再申請時の参考になります。",
    confirmReject: "拒否します",
    cancel: "キャンセル",
    reasonLabel: "拒否理由 (必須)",
    reasonPlaceholder: "理由を入力してください",
    reasonRiot: "Riot ID を確認できません",
    reasonIdentity: "本人確認が必要です",
    reasonOther: "自由入力",
    noteLabel: "拒否理由",
    processing: "処理中"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function requestStatusLabel(status: AdminStreamerRiotIdRequest["status"]): string {
  return t[status] ?? status;
}

function formatDateTime(value: string | undefined): string {
  if (!value) return t.none;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t.none;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function apiErrorDetail(error: unknown, path: string, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback;
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return error.message.replace(new RegExp(`^${escapedPath} failed: \\d+(?: - )?`), "");
}

export function StreamerRiotRequestsPage({ snapshot }: { snapshot: DashboardSnapshot }) {
  const [requests, setRequests] = useState<AdminStreamerRiotIdRequest[]>(snapshot.streamerRiotIdRequests ?? []);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminStreamerRiotIdRequest["status"]>("pending");
  /* 되돌릴 수 없는 조작은 확인을 거칩니다. */
  const [pendingAction, setPendingAction] = useState<{
    request: AdminStreamerRiotIdRequest;
    decision: "approved" | "rejected";
  }>();
  const [reason, setReason] = useState("");

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<unknown>("/api/participation/streamer-riot-id-requests")
      .then((value) => {
        const result = parseStreamerRiotIdRequestListResponse(value);
        if (!result) throw new Error("streamer Riot ID 요청 목록 응답이 올바르지 않습니다.");
        if (!cancelled) setRequests(result.requests);
      })
      .catch(() => {
        if (!cancelled) setMessage(t.loadFailed);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function resolveRequest(
    requestId: string,
    decision: "approved" | "rejected",
    note?: string
  ) {
    setBusyId(requestId);
    setMessage("");
    try {
      const result = await apiPost<{ request: AdminStreamerRiotIdRequest; requests: AdminStreamerRiotIdRequest[] }>(
        "/api/participation/streamer-riot-id-requests/resolve",
        { requestId, decision, ...(note ? { note } : {}) }
      );
      setRequests(result.requests);
      setMessage(t.resolved);
    } catch (error) {
      setMessage(apiErrorDetail(error, "/api/participation/streamer-riot-id-requests/resolve", t.resolveFailed));
    } finally {
      setBusyId(null);
    }
  }

  async function updateDashboardAccess(requestId: string, dashboardEnabled: boolean) {
    setBusyId(requestId);
    setMessage("");
    try {
      const result = await apiPost<{ request: AdminStreamerRiotIdRequest; requests: AdminStreamerRiotIdRequest[] }>(
        "/api/participation/streamer-riot-id-requests/dashboard-access",
        { requestId, dashboardEnabled }
      );
      setRequests(result.requests);
      setMessage(t.dashboardAccessUpdated);
    } catch (error) {
      setMessage(apiErrorDetail(error, "/api/participation/streamer-riot-id-requests/dashboard-access", t.dashboardAccessFailed));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmPendingAction(): Promise<void> {
    if (!pendingAction) return;
    const { request, decision } = pendingAction;
    const note = decision === "rejected" ? reason.trim() : undefined;
    setPendingAction(undefined);
    setReason("");
    await resolveRequest(request.id, decision, note);
  }

  /* 현재 화면은 하위 호환 무인자 응답을 사용합니다. 서버 pagination UI 연결 전까지
     이미 받아 둔 목록 안에서만 검색·상태 필터를 적용합니다. */
  const visibleRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (!needle) return true;
      return [
        request.twitchDisplayName,
        request.twitchLogin,
        `${request.riotGameName}#${request.riotTagLine}`
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [requests, query, statusFilter]);

  const statusCounts = {
    all: requests.length,
    pending: pendingCount,
    approved: approvedCount,
    rejected: requests.filter((request) => request.status === "rejected").length
  } as const;

  return (
    <>
      <div className="page-title-row page-header compact">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
        <span className="queue-status neutral">{loading ? t.loading : `${t.pending} ${pendingCount}`}</span>
      </div>

      <div className="participation-summary">
        <div><span>{t.pendingCount}</span><strong>{pendingCount}</strong></div>
        <div><span>{t.approvedCount}</span><strong>{approvedCount}</strong></div>
        <div><span>{t.totalCount}</span><strong>{requests.length}</strong></div>
      </div>

      <div className="card streamer-riot-requests-card">
        {message ? <p className="form-message">{message}</p> : null}

        <div className="yoro-ar-tools">
          <input
            aria-label={t.search}
            className="yoro-ar-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.search}
            type="search"
            value={query}
          />
          <div className="yoro-ar-filters">
            {([
              ["pending", t.pending],
              ["approved", t.approved],
              ["rejected", t.rejected],
              ["all", t.filterAll]
            ] as const).map(([key, label]) => (
              <button
                aria-pressed={statusFilter === key}
                className="yoro-ar-filter"
                key={key}
                onClick={() => setStatusFilter(key)}
                type="button"
              >
                {label}<b>{statusCounts[key]}</b>
              </button>
            ))}
          </div>
        </div>

        {requests.length === 0 ? <p className="yoro-ar-empty">{t.empty}</p> : null}
        {requests.length > 0 && visibleRequests.length === 0 ? (
          <p className="yoro-ar-empty">{t.searchEmpty}</p>
        ) : null}
        {visibleRequests.length > 0 ? (
          <div className="streamer-riot-requests-list">
            {visibleRequests.map((request) => (
              <article className={`streamer-riot-request-row ${request.status}`} key={request.id}>
                <div className="streamer-riot-request-user">
                  <span className="streamer-riot-request-avatar">
                    {request.twitchProfileImageUrl ? <img src={request.twitchProfileImageUrl} alt="" /> : request.twitchDisplayName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{request.twitchDisplayName}</strong>
                    <span>@{request.twitchLogin}</span>
                  </div>
                </div>
                <div>
                  <span>{t.riotId}</span>
                  <strong>{request.riotGameName}<small>#{request.riotTagLine}</small></strong>
                </div>
                <div>
                  <span>{t.status}</span>
                  <strong>{requestStatusLabel(request.status)}</strong>
                </div>
                <div>
                  <span>{t.dashboardAccess}</span>
                  <strong className={request.dashboardEnabled ? "access-enabled" : "access-disabled"}>
                    {request.dashboardEnabled ? t.dashboardEnabled : t.dashboardDisabled}
                  </strong>
                </div>
                <div>
                  <span>{t.requestedAt}</span>
                  <strong>{formatDateTime(request.requestedAt)}</strong>
                  {request.reviewedAt ? <small>{t.reviewedAt}: {formatDateTime(request.reviewedAt)}</small> : null}
                </div>
                <div className="streamer-riot-request-actions">
                  {/* 같은 자리에서 반대 조작이 일어나지 않게 상태별로 가릅니다.
                      거절된 요청에 "승인"이 그대로 활성이던 것을 바꿉니다. */}
                  {request.status === "approved" ? null : (
                    <button
                      className="secondary compact-button"
                      disabled={busyId === request.id}
                      onClick={() => setPendingAction({ request, decision: "approved" })}
                    >
                      {request.status === "rejected" ? t.reapprove : t.approve}
                    </button>
                  )}
                  {request.status === "rejected" ? null : (
                    <button
                      className="secondary compact-button danger"
                      disabled={busyId === request.id}
                      onClick={() => {
                        setReason("");
                        setPendingAction({ request, decision: "rejected" });
                      }}
                    >
                      {t.reject}
                    </button>
                  )}
                  {request.status === "approved" ? (
                    <button
                      className={`secondary compact-button ${request.dashboardEnabled ? "danger" : ""}`}
                      disabled={busyId === request.id}
                      onClick={() => void updateDashboardAccess(request.id, !request.dashboardEnabled)}
                    >
                      {request.dashboardEnabled ? t.dashboardDisable : t.dashboardEnable}
                    </button>
                  ) : null}
                </div>
                {/* 저장된 거절 사유가 어디에도 보이지 않았습니다. */}
                {request.note ? (
                  <p className="yoro-ar-note">{t.noteLabel}: {request.note}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>

      {pendingAction ? (
        <AdminConfirmDialog
          busy={busyId === pendingAction.request.id}
          cancelLabel={t.cancel}
          confirmDisabled={pendingAction.decision === "rejected" && !reason.trim()}
          confirmLabel={pendingAction.decision === "approved" ? t.confirmApprove : t.confirmReject}
          description={pendingAction.decision === "approved" ? t.confirmApproveBody : t.confirmRejectBody}
          onCancel={() => {
            setPendingAction(undefined);
            setReason("");
          }}
          onConfirm={() => void confirmPendingAction()}
          summary={[
            {
              label: t.twitchAccount,
              value: `${pendingAction.request.twitchDisplayName} (@${pendingAction.request.twitchLogin})`
            },
            {
              label: t.riotId,
              value: `${pendingAction.request.riotGameName}#${pendingAction.request.riotTagLine}`
            },
            { label: t.requestedAt, value: formatDateTime(pendingAction.request.requestedAt) }
          ]}
          title={pendingAction.decision === "approved" ? t.confirmApproveTitle : t.confirmRejectTitle}
          tone={pendingAction.decision === "approved" ? "primary" : "danger"}
        >
          {pendingAction.decision === "rejected" ? (
            <label className="yoro-ac-field">
              <span>{t.reasonLabel}</span>
              <span className="yoro-ac-presets">
                {[t.reasonRiot, t.reasonIdentity].map((preset) => (
                  <button
                    aria-pressed={reason === preset}
                    className="yoro-ac-preset"
                    key={preset}
                    onClick={() => setReason(preset)}
                    type="button"
                  >
                    {preset}
                  </button>
                ))}
              </span>
              <textarea
                maxLength={300}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t.reasonPlaceholder}
                value={reason}
              />
              {/* 서버가 300자까지만 저장합니다. */}
              <span className="yoro-ac-count">{reason.length} / 300</span>
            </label>
          ) : null}
        </AdminConfirmDialog>
      ) : null}
    </>
  );
}

import { useEffect, useState } from "react";
import type { StreamerRiotIdRequest } from "@streamops/shared";
import { apiGet, apiPost } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";

type DashboardSnapshot = {
  streamerRiotIdRequests?: StreamerRiotIdRequest[];
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
    overlayAccess: "오버레이 접근",
    overlaySlug: "URL",
    overlayKey: "Key",
    status: "상태",
    requestedAt: "요청 시간",
    reviewedAt: "처리 시간",
    approve: "승인",
    reject: "거절",
    dashboardEnable: "대시보드 허용",
    dashboardDisable: "대시보드 차단",
    loading: "불러오는 중",
    none: "없음"
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
    overlayAccess: "オーバーレイ接続",
    overlaySlug: "URL",
    overlayKey: "Key",
    status: "状態",
    requestedAt: "申請時間",
    reviewedAt: "処理時間",
    approve: "承認",
    reject: "拒否",
    dashboardEnable: "利用を許可",
    dashboardDisable: "利用を停止",
    loading: "読み込み中",
    none: "なし"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function requestStatusLabel(status: StreamerRiotIdRequest["status"]): string {
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
  const [requests, setRequests] = useState<StreamerRiotIdRequest[]>(snapshot.streamerRiotIdRequests ?? []);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const approvedCount = requests.filter((request) => request.status === "approved").length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet<{ requests: StreamerRiotIdRequest[] }>("/api/participation/streamer-riot-id-requests")
      .then((result) => {
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

  async function resolveRequest(requestId: string, decision: "approved" | "rejected") {
    setBusyId(requestId);
    setMessage("");
    try {
      const result = await apiPost<{ request: StreamerRiotIdRequest; requests: StreamerRiotIdRequest[] }>(
        "/api/participation/streamer-riot-id-requests/resolve",
        { requestId, decision }
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
      const result = await apiPost<{ request: StreamerRiotIdRequest; requests: StreamerRiotIdRequest[] }>(
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
        {requests.length === 0 ? <p className="muted">{t.empty}</p> : null}
        {requests.length > 0 ? (
          <div className="streamer-riot-requests-list">
            {requests.map((request) => (
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
                  <span>{t.overlayAccess}</span>
                  {request.overlaySlug && request.overlayKey ? (
                    <>
                      <strong>{t.overlaySlug}<small>/{request.overlaySlug}</small></strong>
                      <small>{t.overlayKey}: {request.overlayKey}</small>
                    </>
                  ) : <strong>{t.none}</strong>}
                </div>
                <div>
                  <span>{t.requestedAt}</span>
                  <strong>{formatDateTime(request.requestedAt)}</strong>
                  {request.reviewedAt ? <small>{t.reviewedAt}: {formatDateTime(request.reviewedAt)}</small> : null}
                </div>
                <div className="streamer-riot-request-actions">
                  <button
                    className="secondary compact-button"
                    disabled={busyId === request.id || request.status === "approved"}
                    onClick={() => void resolveRequest(request.id, "approved")}
                  >
                    {t.approve}
                  </button>
                  <button
                    className="secondary compact-button danger"
                    disabled={busyId === request.id || request.status === "rejected"}
                    onClick={() => void resolveRequest(request.id, "rejected")}
                  >
                    {t.reject}
                  </button>
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
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

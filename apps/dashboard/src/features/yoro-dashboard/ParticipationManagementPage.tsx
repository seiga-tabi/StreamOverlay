import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import type {
  ParticipationDashboardQueueEntry,
  ParticipationSessionStatus,
  ParticipationState,
  ParticipationStatus
} from "@streamops/shared";
import {
  getYoroParticipation,
  updateYoroParticipationEntry,
  updateYoroParticipationSession,
  type ParticipationSessionAction
} from "./api";

type Locale = "ko" | "ja";
type EntryMutationStatus = Extract<
  ParticipationStatus,
  "checked_in" | "in_game" | "played" | "skipped" | "no_show"
>;

const copy = {
  ko: {
    eyebrow: "STREAMER PARTICIPATION",
    title: "시청자 참여 관리",
    description: "공개 참여 세션을 만들고 신청 대기열과 참가 상태를 관리합니다.",
    loading: "시청자 참여 상태를 불러오는 중입니다.",
    loadFailed: "시청자 참여 상태를 불러오지 못했습니다.",
    retry: "다시 시도",
    createTitle: "새 참여 세션",
    createDescription: "세션을 시작하면 시청자가 공개 URL에서 같은 대기열에 신청할 수 있습니다.",
    maxQueueSize: "최대 대기 인원",
    checkInSeconds: "체크인 제한 시간(초)",
    allowRejoin: "참여 완료 후 재참여 허용",
    create: "참여 세션 시작",
    creating: "세션 생성 중",
    sessionTitle: "진행 중인 세션",
    publicUrl: "시청자 공개 URL",
    copyUrl: "URL 복사",
    copied: "공개 참여 URL을 복사했습니다.",
    openPublic: "공개 화면 열기",
    status: "세션 상태",
    statusRecruiting: "모집 중",
    statusClosed: "모집 닫힘",
    statusInGame: "게임 중",
    statusCompleted: "종료됨",
    queueCapacity: "대기 인원",
    selectedCount: "선정·체크인",
    playedCount: "참여 완료",
    close: "모집 닫기",
    reopen: "모집 다시 열기",
    selectNext: "다음 참가자 선정",
    finishGame: "게임 종료 처리",
    finishSession: "세션 종료",
    finishConfirm: "현재 참여 세션을 종료할까요? 종료 후에는 다시 열 수 없습니다.",
    queueTitle: "참여 대기열",
    queueDescription: "신청 순서와 현재 상태를 확인하고 필요한 상태만 직접 변경할 수 있습니다.",
    queueEmpty: "아직 참여 신청이 없습니다.",
    position: "대기 순번",
    riotId: "Riot ID",
    role: "희망 포지션",
    action: "관리",
    checkIn: "체크인 처리",
    markInGame: "게임 중",
    markPlayed: "참여 완료",
    skip: "건너뛰기",
    noShow: "미응답",
    pending: "검증 중",
    verified: "검증 완료",
    waitlisted: "대기 중",
    selected: "선정됨",
    checked_in: "체크인 완료",
    invited: "초대됨",
    in_game: "게임 중",
    played: "참여 완료",
    skipped: "건너뜀",
    cancelled: "취소됨",
    no_show: "미응답",
    rejected: "거절됨",
    blocked: "차단됨",
    unknownRole: "상관없음",
    updateFailed: "참여 상태를 변경하지 못했습니다.",
    sessionStarted: "참여 세션을 시작했습니다.",
    sessionUpdated: "참여 세션 상태를 변경했습니다.",
    sessionFinished: "참여 세션을 종료했습니다.",
    entryUpdated: "참가자 상태를 변경했습니다."
  },
  ja: {
    eyebrow: "STREAMER PARTICIPATION",
    title: "視聴者参加管理",
    description: "公開参加セッションを作成し、申請待機列と参加状態を管理します。",
    loading: "視聴者参加の状態を読み込んでいます。",
    loadFailed: "視聴者参加の状態を読み込めませんでした。",
    retry: "再試行",
    createTitle: "新しい参加セッション",
    createDescription: "セッションを開始すると、視聴者が公開URLから同じ待機列に申請できます。",
    maxQueueSize: "最大待機人数",
    checkInSeconds: "チェックイン制限時間（秒）",
    allowRejoin: "参加完了後の再参加を許可",
    create: "参加セッションを開始",
    creating: "セッション作成中",
    sessionTitle: "進行中のセッション",
    publicUrl: "視聴者向け公開URL",
    copyUrl: "URLをコピー",
    copied: "公開参加URLをコピーしました。",
    openPublic: "公開画面を開く",
    status: "セッション状態",
    statusRecruiting: "受付中",
    statusClosed: "受付停止",
    statusInGame: "ゲーム中",
    statusCompleted: "終了済み",
    queueCapacity: "待機人数",
    selectedCount: "選出・チェックイン",
    playedCount: "参加完了",
    close: "受付を停止",
    reopen: "受付を再開",
    selectNext: "次の参加者を選出",
    finishGame: "ゲーム終了処理",
    finishSession: "セッション終了",
    finishConfirm: "現在の参加セッションを終了しますか？終了後は再開できません。",
    queueTitle: "参加待機列",
    queueDescription: "申請順と現在の状態を確認し、必要な状態のみ変更できます。",
    queueEmpty: "参加申請はまだありません。",
    position: "待機順",
    riotId: "Riot ID",
    role: "希望ロール",
    action: "管理",
    checkIn: "チェックイン処理",
    markInGame: "ゲーム中",
    markPlayed: "参加完了",
    skip: "スキップ",
    noShow: "未応答",
    pending: "確認中",
    verified: "確認済み",
    waitlisted: "待機中",
    selected: "選出済み",
    checked_in: "チェックイン済み",
    invited: "招待済み",
    in_game: "ゲーム中",
    played: "参加完了",
    skipped: "スキップ済み",
    cancelled: "取消済み",
    no_show: "未応答",
    rejected: "拒否済み",
    blocked: "ブロック済み",
    unknownRole: "どこでも",
    updateFailed: "参加状態を変更できませんでした。",
    sessionStarted: "参加セッションを開始しました。",
    sessionUpdated: "参加セッションの状態を変更しました。",
    sessionFinished: "参加セッションを終了しました。",
    entryUpdated: "参加者の状態を変更しました。"
  }
} as const;

const roleLabels = {
  ko: { top: "탑", jungle: "정글", mid: "미드", adc: "원딜", support: "서포터", fill: "상관없음", unknown: "상관없음" },
  ja: { top: "トップ", jungle: "ジャングル", mid: "ミッド", adc: "ボット", support: "サポート", fill: "どこでも", unknown: "どこでも" }
} as const;

function sessionStatusLabel(
  status: ParticipationSessionStatus,
  text: typeof copy.ko | typeof copy.ja
): string {
  if (status === "recruiting") return text.statusRecruiting;
  if (status === "in_game") return text.statusInGame;
  if (status === "completed") return text.statusCompleted;
  return text.statusClosed;
}

function publicParticipationUrl(publicSessionId: string, locale: Locale): string {
  if (typeof window === "undefined") return "";
  const url = new URL(`/${locale}/participation`, window.location.origin);
  url.searchParams.set("session", publicSessionId);
  return url.toString();
}

function entryActions(entry: ParticipationDashboardQueueEntry): Array<{
  status: EntryMutationStatus;
  labelKey: "checkIn" | "markInGame" | "markPlayed" | "skip" | "noShow";
}> {
  if (entry.status === "selected") {
    return [
      { status: "checked_in", labelKey: "checkIn" },
      { status: "no_show", labelKey: "noShow" },
      { status: "skipped", labelKey: "skip" }
    ];
  }
  if (entry.status === "checked_in" || entry.status === "invited") {
    return [
      { status: "in_game", labelKey: "markInGame" },
      { status: "skipped", labelKey: "skip" }
    ];
  }
  if (entry.status === "in_game") {
    return [{ status: "played", labelKey: "markPlayed" }];
  }
  if (["pending", "verified", "waitlisted"].includes(entry.status)) {
    return [{ status: "skipped", labelKey: "skip" }];
  }
  return [];
}

export function ParticipationManagementPage({
  csrfToken,
  locale
}: {
  csrfToken: string;
  locale: Locale;
}) {
  const text = copy[locale];
  const [state, setState] = useState<ParticipationState>();
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [maxQueueSize, setMaxQueueSize] = useState(100);
  const [checkInSeconds, setCheckInSeconds] = useState(60);
  const [allowRejoin, setAllowRejoin] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const next = await getYoroParticipation(signal);
      setState(next);
      setError("");
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(text.loadFailed);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [text.loadFailed]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden" || busyKey) return;
      void load();
    }, 10_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [busyKey, load]);

  const session = state?.session;
  const activeSession = Boolean(session && session.status !== "completed");
  const publicUrl = session?.publicSessionId
    ? publicParticipationUrl(session.publicSessionId, locale)
    : "";
  const selectedCount = useMemo(
    () => state?.queue.filter((entry) => ["selected", "checked_in", "invited", "in_game"].includes(entry.status)).length ?? 0,
    [state]
  );

  async function mutateSession(
    action: ParticipationSessionAction,
    options: { maxQueueSize?: number; checkInSeconds?: number; allowRejoin?: boolean } = {}
  ): Promise<void> {
    if (busyKey) return;
    if (action === "finish" && !window.confirm(text.finishConfirm)) return;
    setBusyKey(`session:${action}`);
    setError("");
    setMessage("");
    try {
      const result = await updateYoroParticipationSession({ action, ...options }, csrfToken);
      setState(result.state.participation);
      setMessage(action === "start" ? text.sessionStarted : action === "finish" ? text.sessionFinished : text.sessionUpdated);
    } catch {
      setError(text.updateFailed);
    } finally {
      setBusyKey("");
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await mutateSession("start", { maxQueueSize, checkInSeconds, allowRejoin });
  }

  async function mutateEntry(entryId: string, status: EntryMutationStatus): Promise<void> {
    if (busyKey) return;
    setBusyKey(`entry:${entryId}:${status}`);
    setError("");
    setMessage("");
    try {
      setState(await updateYoroParticipationEntry(entryId, status, csrfToken));
      setMessage(text.entryUpdated);
    } catch {
      setError(text.updateFailed);
    } finally {
      setBusyKey("");
    }
  }

  async function copyPublicUrl(): Promise<void> {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setMessage(text.copied);
      setError("");
    } catch {
      setError(text.updateFailed);
    }
  }

  if (loading && !state) {
    return <section className="participation-management-page" role="status">{text.loading}</section>;
  }

  return (
    <section className="participation-management-page" aria-labelledby="participation-management-title">
      <header className="participation-management-hero">
        <span>{text.eyebrow}</span>
        <h1 id="participation-management-title">{text.title}</h1>
        <p>{text.description}</p>
      </header>

      {error ? (
        <div className="participation-management-alert is-error" role="alert">
          <span>{error}</span>
          {!state ? <button onClick={() => void load()} type="button">{text.retry}</button> : null}
        </div>
      ) : null}
      {message ? <p className="participation-management-alert" aria-live="polite">{message}</p> : null}

      {!activeSession ? (
        <form className="participation-management-create" onSubmit={(event) => void createSession(event)}>
          <header>
            <h2>{text.createTitle}</h2>
            <p>{text.createDescription}</p>
          </header>
          <div className="participation-management-form-grid">
            <label>
              <span>{text.maxQueueSize}</span>
              <input min={1} max={500} onChange={(event) => setMaxQueueSize(Number(event.target.value))} required type="number" value={maxQueueSize} />
            </label>
            <label>
              <span>{text.checkInSeconds}</span>
              <input min={15} max={600} onChange={(event) => setCheckInSeconds(Number(event.target.value))} required type="number" value={checkInSeconds} />
            </label>
            <label className="participation-management-checkbox">
              <input checked={allowRejoin} onChange={(event) => setAllowRejoin(event.target.checked)} type="checkbox" />
              <span>{text.allowRejoin}</span>
            </label>
          </div>
          <button disabled={Boolean(busyKey)} type="submit">
            {busyKey === "session:start" ? text.creating : text.create}
          </button>
        </form>
      ) : (
        <>
          <section className="participation-management-session" aria-labelledby="participation-session-title">
            <header>
              <div>
                <h2 id="participation-session-title">{text.sessionTitle}</h2>
                <p>{text.publicUrl}</p>
              </div>
              <strong data-status={session?.status}>{sessionStatusLabel(session?.status ?? "closed", text)}</strong>
            </header>
            <div className="participation-management-url">
              <input aria-label={text.publicUrl} readOnly value={publicUrl} />
              <button disabled={!publicUrl} onClick={() => void copyPublicUrl()} type="button">{text.copyUrl}</button>
              <a href={publicUrl} rel="noopener noreferrer" target="_blank">{text.openPublic}</a>
            </div>
            <dl className="participation-management-metrics">
              <div><dt>{text.status}</dt><dd>{sessionStatusLabel(session?.status ?? "closed", text)}</dd></div>
              <div><dt>{text.queueCapacity}</dt><dd>{state?.summary.active ?? 0} / {session?.maxQueueSize ?? 100}</dd></div>
              <div><dt>{text.selectedCount}</dt><dd>{selectedCount}</dd></div>
              <div><dt>{text.playedCount}</dt><dd>{state?.summary.played ?? 0}</dd></div>
            </dl>
            <div className="participation-management-session-actions">
              {state?.isOpen ? (
                <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("close")} type="button">{text.close}</button>
              ) : (
                <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("open")} type="button">{text.reopen}</button>
              )}
              <button disabled={Boolean(busyKey) || (state?.summary.waiting ?? 0) === 0} onClick={() => void mutateSession("select_next")} type="button">{text.selectNext}</button>
              <button disabled={Boolean(busyKey) || !state?.queue.some((entry) => entry.status === "in_game")} onClick={() => void mutateSession("finish_game")} type="button">{text.finishGame}</button>
              <button className="is-danger" disabled={Boolean(busyKey)} onClick={() => void mutateSession("finish")} type="button">{text.finishSession}</button>
            </div>
          </section>

          <section className="participation-management-queue" aria-labelledby="participation-queue-title">
            <header>
              <div>
                <h2 id="participation-queue-title">{text.queueTitle}</h2>
                <p>{text.queueDescription}</p>
              </div>
              <span>{state?.queue.length ?? 0}</span>
            </header>
            {state?.queue.length ? (
              <div className="participation-management-table-wrap">
                <table>
                  <thead>
                    <tr><th>{text.position}</th><th>Twitch</th><th>{text.riotId}</th><th>{text.role}</th><th>{text.status}</th><th>{text.action}</th></tr>
                  </thead>
                  <tbody>
                    {state.queue.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.position}</td>
                        <td>{entry.twitchUserName}</td>
                        <td>{entry.riotId}</td>
                        <td>{roleLabels[locale][entry.preferredRole ?? "unknown"]}</td>
                        <td><span className="participation-management-status">{text[entry.status]}</span></td>
                        <td>
                          <div className="participation-management-entry-actions">
                            {entryActions(entry).map((action) => (
                              <button disabled={Boolean(busyKey)} key={action.status} onClick={() => void mutateEntry(entry.id, action.status)} type="button">
                                {text[action.labelKey]}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="participation-management-empty">{text.queueEmpty}</p>}
          </section>
        </>
      )}
    </section>
  );
}

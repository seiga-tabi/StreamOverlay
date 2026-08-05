import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import type {
  ParticipationDashboardQueueEntry,
  ParticipationListingVisibility,
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
import {
  getCurrentParticipationEntry
} from "../participation/participation-display";

type Locale = "ko" | "ja";
type EntryMutationStatus = Extract<
  ParticipationStatus,
  "selected" | "checked_in" | "in_game" | "played" | "skipped" | "no_show"
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
    createDescription: "기본 설정으로 바로 모집을 시작하고, 필요한 경우에만 세부 설정을 변경할 수 있습니다.",
    quickStartTitle: "시청자 참여를 시작하세요",
    quickStartHint: "최대 100명 · 체크인 60초 · 재참여 허용",
    advancedSettings: "세부 설정",
    maxQueueSize: "최대 대기 인원",
    checkInSeconds: "체크인 제한 시간(초)",
    allowRejoin: "참여 완료 후 재참여 허용",
    listingVisibility: "참여 페이지 공개 범위",
    listingPublic: "전체 공개",
    listingPublicDescription: "방송 상태와 관계없이 참여 페이지의 모집 목록에 표시합니다.",
    listingFollowers: "시청자 공개",
    listingFollowersDescription: "Twitch 로그인 후 채널을 팔로우 중인 시청자에게만 모집 목록을 표시합니다.",
    listingScope: "공개 범위",
    create: "참여 세션 시작",
    creating: "세션 생성 중",
    sessionTitle: "진행 중인 세션",
    openPublic: "공개 화면 열기",
    status: "세션 상태",
    statusRecruiting: "모집 중",
    statusClosed: "모집 중지됨",
    statusInGame: "게임 중",
    statusCompleted: "종료됨",
    queueCapacity: "대기 인원",
    selectedCount: "선정·체크인",
    checkedInCount: "체크인",
    playedCount: "참여 완료",
    close: "모집 중지",
    reopen: "모집 재개",
    selectNext: "다음 참가자 선정",
    selectNextHint: "검증이 완료된 대기자 한 명을 체크한 후 선정하세요.",
    selectForNext: "다음 참가자로 선택",
    finishGame: "게임 종료 처리",
    finishSession: "세션 종료",
    more: "더보기",
    currentParticipant: "현재 참가자",
    noCurrentParticipant: "현재 처리 중인 참가자가 없습니다.",
    queueWaiting: "대기 중",
    queueHistory: "완료·취소",
    queueHistoryEmpty: "완료되거나 취소된 참가 이력이 없습니다.",
    botIntegrationTitle: "Discord Bot 연동",
    botIntegrationDescription: "참여 상태는 YORO Server에서 관리되며, Discord 공지와 체크인 알림은 같은 공개 참여 링크를 사용합니다.",
    botIntegrationAction: "Discord Bot 제어 열기",
    botIntegrationSafety: "Discord 전송 실패가 참여 신청이나 대기열 상태를 변경하지 않습니다.",
    details: "상세 보기",
    appliedAt: "신청 시각",
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
    createDescription: "基本設定ですぐ受付を開始し、必要な場合だけ詳細設定を変更できます。",
    quickStartTitle: "視聴者参加を始めましょう",
    quickStartHint: "最大100名・チェックイン60秒・再参加可",
    advancedSettings: "詳細設定",
    maxQueueSize: "最大待機人数",
    checkInSeconds: "チェックイン制限時間（秒）",
    allowRejoin: "参加完了後の再参加を許可",
    listingVisibility: "参加ページの公開範囲",
    listingPublic: "全体公開",
    listingPublicDescription: "配信状態に関係なく、参加ページの募集一覧に表示します。",
    listingFollowers: "視聴者に公開",
    listingFollowersDescription: "Twitchログイン後、このチャンネルをフォロー中の視聴者にのみ募集一覧を表示します。",
    listingScope: "公開範囲",
    create: "参加セッションを開始",
    creating: "セッション作成中",
    sessionTitle: "進行中のセッション",
    openPublic: "公開画面を開く",
    status: "セッション状態",
    statusRecruiting: "受付中",
    statusClosed: "受付停止",
    statusInGame: "ゲーム中",
    statusCompleted: "終了済み",
    queueCapacity: "待機人数",
    selectedCount: "選出・チェックイン",
    checkedInCount: "チェックイン",
    playedCount: "参加完了",
    close: "受付を停止",
    reopen: "受付を再開",
    selectNext: "次の参加者を選出",
    selectNextHint: "確認済みの待機者を1人選択してから選出してください。",
    selectForNext: "次の参加者として選択",
    finishGame: "ゲーム終了処理",
    finishSession: "セッション終了",
    more: "その他",
    currentParticipant: "現在の参加者",
    noCurrentParticipant: "現在処理中の参加者はいません。",
    queueWaiting: "待機中",
    queueHistory: "完了・取消",
    queueHistoryEmpty: "完了または取り消された参加履歴はありません。",
    botIntegrationTitle: "Discord Bot連携",
    botIntegrationDescription: "参加状態はYORO Serverで管理され、Discordのお知らせとチェックイン通知も同じ公開参加リンクを使用します。",
    botIntegrationAction: "Discord Bot管理を開く",
    botIntegrationSafety: "Discord送信の失敗によって、参加申請や待機列の状態が変更されることはありません。",
    details: "詳細を見る",
    appliedAt: "申請時刻",
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
  const [listingVisibility, setListingVisibility] = useState<ParticipationListingVisibility>("public");
  const [selectedWaitingEntryId, setSelectedWaitingEntryId] = useState("");

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
  const currentEntry = useMemo(() => getCurrentParticipationEntry(state), [state]);
  const waitingEntries = useMemo(
    () => state?.queue.filter((entry) => ["pending", "verified", "waitlisted"].includes(entry.status)) ?? [],
    [state]
  );
  const historyEntries = useMemo(
    () => state?.queue.filter((entry) => ["played", "skipped", "cancelled", "no_show", "rejected", "blocked"].includes(entry.status)) ?? [],
    [state]
  );
  const selectedWaitingEntry = useMemo(
    () => waitingEntries.find((entry) => (
      entry.id === selectedWaitingEntryId
      && (entry.status === "verified" || entry.status === "waitlisted")
    )),
    [selectedWaitingEntryId, waitingEntries]
  );

  useEffect(() => {
    if (selectedWaitingEntryId && !waitingEntries.some((entry) => entry.id === selectedWaitingEntryId)) {
      setSelectedWaitingEntryId("");
    }
  }, [selectedWaitingEntryId, waitingEntries]);

  async function mutateSession(
    action: ParticipationSessionAction,
    options: {
      maxQueueSize?: number;
      checkInSeconds?: number;
      allowRejoin?: boolean;
      listingVisibility?: ParticipationListingVisibility;
    } = {}
  ): Promise<void> {
    if (busyKey) return;
    if (action === "finish" && !window.confirm(text.finishConfirm)) return;
    setBusyKey(`session:${action}`);
    setError("");
    setMessage("");
    try {
      const result = await updateYoroParticipationSession({
        action,
        ...options,
        ...(state?.revision === undefined ? {} : { expectedRevision: state.revision })
      }, csrfToken);
      setState(result.state.participation);
      setMessage(action === "start" ? text.sessionStarted : action === "finish" ? text.sessionFinished : text.sessionUpdated);
    } catch {
      setError(text.updateFailed);
      void load();
    } finally {
      setBusyKey("");
    }
  }

  async function createSession(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await mutateSession("start", { maxQueueSize, checkInSeconds, allowRejoin, listingVisibility });
  }

  async function mutateEntry(entryId: string, status: EntryMutationStatus): Promise<void> {
    if (busyKey) return;
    setBusyKey(`entry:${entryId}:${status}`);
    setError("");
    setMessage("");
    try {
      setState(await updateYoroParticipationEntry(entryId, status, csrfToken, state?.revision));
      if (status === "selected") setSelectedWaitingEntryId("");
      setMessage(text.entryUpdated);
    } catch {
      setError(text.updateFailed);
      void load();
    } finally {
      setBusyKey("");
    }
  }

  function renderOperationalActionButton() {
    if (currentEntry?.status === "checked_in" || currentEntry?.status === "invited") {
      return <button className="is-primary" disabled={Boolean(busyKey)} onClick={() => void mutateEntry(currentEntry.id, "in_game")} type="button">{text.markInGame}</button>;
    }
    if (currentEntry?.status === "in_game") {
      return <button className="is-primary" disabled={Boolean(busyKey)} onClick={() => void mutateSession("finish_game")} type="button">{text.finishGame}</button>;
    }
    return null;
  }

  function renderParticipantRow(entry: ParticipationDashboardQueueEntry, compact = false, selectable = false) {
    const actions = entryActions(entry);
    const primaryAction = actions[0];
    const secondaryActions = actions.slice(1);
    const canSelect = entry.status === "verified" || entry.status === "waitlisted";
    return (
      <article className={`participation-management-participant ${compact ? "is-compact" : ""} ${selectable ? "is-selectable" : ""}`} key={entry.id}>
        {selectable ? (
          <label className="participation-management-selection">
            <input
              aria-label={`${entry.twitchUserName} ${text.selectForNext}`}
              checked={selectedWaitingEntryId === entry.id}
              disabled={Boolean(busyKey) || Boolean(currentEntry) || !state?.isOpen || !canSelect}
              onChange={(event) => setSelectedWaitingEntryId(event.target.checked ? entry.id : "")}
              type="checkbox"
            />
            <span className="participation-management-position">#{entry.position}</span>
          </label>
        ) : <span className="participation-management-position">#{entry.position}</span>}
        <div className="participation-management-participant-main">
          <strong>{entry.twitchUserName}</strong>
          <span>{entry.riotId} · {roleLabels[locale][entry.preferredRole ?? "unknown"]}</span>
          <small>{text.appliedAt} {new Date(entry.createdAt).toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP")}</small>
        </div>
        <span className="participation-management-status">{text[entry.status]}</span>
        <div className="participation-management-entry-actions">
          {primaryAction ? (
            <button disabled={Boolean(busyKey)} onClick={() => void mutateEntry(entry.id, primaryAction.status)} type="button">
              {text[primaryAction.labelKey]}
            </button>
          ) : null}
          {secondaryActions.length ? (
            <details className="participation-management-row-more">
              <summary>{text.more}</summary>
              <div>
                {secondaryActions.map((action) => (
                  <button disabled={Boolean(busyKey)} key={action.status} onClick={() => void mutateEntry(entry.id, action.status)} type="button">
                    {text[action.labelKey]}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </article>
    );
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
            <h2>{text.quickStartTitle}</h2>
            <p>{text.createDescription}</p>
            <small>{text.quickStartHint}</small>
          </header>
          <button disabled={Boolean(busyKey)} type="submit">
            {busyKey === "session:start" ? text.creating : text.create}
          </button>
          <details className="participation-management-advanced">
            <summary>{text.advancedSettings}</summary>
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
              <fieldset className="participation-management-visibility">
                <legend>{text.listingVisibility}</legend>
                <label>
                  <input
                    checked={listingVisibility === "public"}
                    name="listingVisibility"
                    onChange={() => setListingVisibility("public")}
                    type="radio"
                  />
                  <span><strong>{text.listingPublic}</strong><small>{text.listingPublicDescription}</small></span>
                </label>
                <label>
                  <input
                    checked={listingVisibility === "followers"}
                    name="listingVisibility"
                    onChange={() => setListingVisibility("followers")}
                    type="radio"
                  />
                  <span><strong>{text.listingFollowers}</strong><small>{text.listingFollowersDescription}</small></span>
                </label>
              </fieldset>
            </div>
          </details>
        </form>
      ) : (
        <>
          <section className="participation-management-session" aria-labelledby="participation-session-title">
            <header>
              <div>
                <h2 id="participation-session-title">{text.sessionTitle}</h2>
                <p>{text.listingScope} · {session?.listingVisibility === "followers" ? text.listingFollowers : text.listingPublic}</p>
              </div>
              <strong data-status={session?.status}>{sessionStatusLabel(session?.status ?? "closed", text)}</strong>
            </header>
            <dl className="participation-management-metrics">
              <div><dt>{text.queueCapacity}</dt><dd>{state?.summary.waiting ?? 0}</dd></div>
              <div><dt>{text.selectedCount}</dt><dd>{selectedCount}</dd></div>
              <div><dt>{text.checkedInCount}</dt><dd>{state?.summary.checkedIn ?? 0}</dd></div>
              <div><dt>{text.playedCount}</dt><dd>{state?.summary.played ?? 0}</dd></div>
            </dl>
            <div className="participation-management-session-toolbar">
              <a href={publicUrl} rel="noopener noreferrer" target="_blank">{text.openPublic}</a>
              {renderOperationalActionButton()}
              {state?.isOpen ? (
                <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("close")} type="button">{text.close}</button>
              ) : session?.status === "closed" ? (
                <button className="is-primary" disabled={Boolean(busyKey)} onClick={() => void mutateSession("open")} type="button">{text.reopen}</button>
              ) : null}
              <button className="is-danger" disabled={Boolean(busyKey)} onClick={() => void mutateSession("finish")} type="button">{text.finishSession}</button>
            </div>
          </section>

          <section className="participation-management-current" aria-labelledby="participation-current-title">
            <header>
              <h2 id="participation-current-title">{text.currentParticipant}</h2>
            </header>
            {currentEntry ? renderParticipantRow(currentEntry) : <p className="participation-management-empty">{text.noCurrentParticipant}</p>}
          </section>

          <section className="participation-management-queue" aria-labelledby="participation-queue-title">
            <header>
              <div>
                <h2 id="participation-queue-title">{text.queueTitle}</h2>
                <p>{text.queueDescription}</p>
              </div>
              <div className="participation-management-queue-actions">
                <span>{waitingEntries.length}</span>
                {!currentEntry && state?.isOpen && waitingEntries.length > 0 ? (
                  <button
                    className="is-primary"
                    disabled={Boolean(busyKey) || !selectedWaitingEntry}
                    onClick={() => selectedWaitingEntry && void mutateEntry(selectedWaitingEntry.id, "selected")}
                    type="button"
                  >
                    {text.selectNext}
                  </button>
                ) : null}
              </div>
            </header>
            {!currentEntry && state?.isOpen && waitingEntries.length > 0 ? <p className="participation-management-select-hint">{text.selectNextHint}</p> : null}
            <div className="participation-management-group" aria-labelledby="participation-waiting-title">
              <h3 id="participation-waiting-title">{text.queueWaiting}</h3>
              {waitingEntries.length
                ? waitingEntries.map((entry) => renderParticipantRow(entry, true, true))
                : <p className="participation-management-empty">{text.queueEmpty}</p>}
            </div>
            <details className="participation-management-history">
              <summary>{text.queueHistory} <span>{historyEntries.length}</span></summary>
              <div>
                {historyEntries.length
                  ? historyEntries.map((entry) => renderParticipantRow(entry, true))
                  : <p className="participation-management-empty">{text.queueHistoryEmpty}</p>}
              </div>
            </details>
          </section>

          <aside className="participation-management-bot" aria-labelledby="participation-bot-title">
            <div>
              <h2 id="participation-bot-title">{text.botIntegrationTitle}</h2>
              <p>{text.botIntegrationDescription}</p>
              <small>{text.botIntegrationSafety}</small>
            </div>
            <a href="/dashboard/organizations/bot">{text.botIntegrationAction}</a>
          </aside>
        </>
      )}
    </section>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import type {
  ParticipationDashboardQueueEntry,
  ParticipationGame,
  ParticipationListingVisibility,
  ParticipationSessionStatus,
  ParticipationState,
  ParticipationStatus
} from "@streamops/shared";
import { PARTICIPATION_GAME_CAPACITY } from "@streamops/shared";
import {
  getYoroParticipation,
  selectYoroParticipationEntries,
  updateYoroParticipationEntry,
  updateYoroParticipationSession,
  type ParticipationSessionAction
} from "./api";
import {
  getCurrentParticipationEntry
} from "../participation/participation-display";
import { ParticipationAnnouncementPanel } from "./ParticipationAnnouncementPanel";

type Locale = "ko" | "ja";
type EntryMutationStatus = Extract<
  ParticipationStatus,
  "selected" | "checked_in" | "in_game" | "played" | "skipped" | "no_show"
>;

/**
 * 진행 인원 정원(PARTICIPATION_GAME_CAPACITY, packages/shared)은 방송인 1자리를
 * 포함합니다 — LoL 5명 = 방송인 1 + 시청자 4, Palworld 32명 = 방송인 1 + 시청자 31.
 * 서버(entry-status "selected" 처리)가 최종 정원을 강제하고, 여기서는 같은 상수로
 * "선정" 버튼을 미리 비활성화하는 안내용 가드로만 씁니다.
 */
function viewerSeatCount(game: ParticipationGame): number {
  return PARTICIPATION_GAME_CAPACITY[game] - 1;
}
/** 정원이 이보다 크면(Palworld) 슬롯 카드 대신 압축된 점 그리드로 보여줍니다. */
const COMPACT_SEAT_THRESHOLD = 8;

/* 진행 인원 원형 게이지 반지름·둘레 — SVG stroke-dasharray/-dashoffset 계산에 씁니다. */
const GAUGE_RADIUS = 15;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function gaugeDashoffset(filled: number, total: number): number {
  const ratio = total > 0 ? Math.min(1, Math.max(0, filled / total)) : 0;
  return GAUGE_CIRCUMFERENCE * (1 - ratio);
}

const copy = {
  ko: {
    eyebrow: "STREAMER PARTICIPATION",
    title: "시청자 참여 관리",
    description: "공개 참여 세션을 만들고 신청 대기열과 참가 상태를 관리합니다.",
    loading: "시청자 참여 상태를 불러오는 중입니다.",
    loadFailed: "시청자 참여 상태를 불러오지 못했습니다.",
    retry: "다시 시도",
    gameLabel: "게임",
    gameLol: "League of Legends",
    gamePalworld: "Palworld",
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
    capacityIngame: "진행 인원",
    capacityHostNote: "방송인 포함",
    capacityCheckin: "체크인",
    capacityQueueMax: "대기열 최대",
    personUnit: "명",
    secondUnit: "초",
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
    select: "선정",
    selectNext: "선택한 참가자 선정",
    selectNextHint: "검증이 완료된 대기자를 한 명 이상 체크한 후 함께 선정하세요.",
    selectForNext: "다음 참가자로 선택",
    bulkSelectToggle: "여러 명 선택",
    finishGame: "게임 종료 처리",
    finishSession: "세션 종료",
    more: "더보기",
    currentParticipant: "현재 참가자",
    noCurrentParticipant: "현재 처리 중인 참가자가 없습니다.",
    hostSeatLabel: "방송인",
    emptySeatLabel: "빈 슬롯",
    capacityFull: "진행 인원이 가득 찼어요.",
    queueWaiting: "대기 중",
    queueHistory: "완료·취소",
    queueHistoryEmpty: "완료되거나 취소된 참가 이력이 없습니다.",
    queueSearchPlaceholder: "이름 또는 Riot ID로 검색",
    queueSearchEmpty: "검색 결과가 없습니다.",
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
    entryUpdated: "참가자 상태를 변경했습니다.",
    entriesSelected: "선택한 참가자를 선정했습니다.",
    stepRecruit: "모집",
    stepGame: "게임",
    stepDone: "정산",
    stepWaitingSuffix: "명 대기",
    moreActionsMenu: "더 많은 동작",
    announceSettings: "Discord 공지 설정",
    finishDangerNote: "복구 불가",
    stripEmpty: "아래 대기열에서 선정하세요",
    queueLockedNote: "게임이 끝나면 다음 선정이 열립니다.",
    /* 결함 수정 — 확정만 하고 아직 게임을 시작하지 않은 상태에서도 위 문구가 떴는데,
       "게임이 끝나면"은 게임 중이 아닐 때는 사실과 다른 안내였습니다. */
    queueLockedNoteRecruit: "확정된 인원으로 게임을 시작해야 다음 선정이 열립니다.",
    pickLockedTooltip: "이미 확정된 참가자가 있어 선정할 수 없어요. 게임을 시작하거나 종료해야 다음 선정이 열립니다.",
    refresh: "새로고침",
    historyToggle: "완료·취소 이력",
    candidateLabel: "후보",
    confirmedLabel: "확정됨",
    excludeLabel: "제외",
    confirmPick: "선정 확정",
    startGame: "게임 시작",
    fillFirstCta: "슬롯을 채우면 게임 시작",
    pickHint: "대기열에서 선정하면 슬롯에 담기고, 선정 확정으로 한 번에 확정합니다"
  },
  ja: {
    eyebrow: "STREAMER PARTICIPATION",
    title: "視聴者参加管理",
    description: "公開参加セッションを作成し、申請待機列と参加状態を管理します。",
    loading: "視聴者参加の状態を読み込んでいます。",
    loadFailed: "視聴者参加の状態を読み込めませんでした。",
    retry: "再試行",
    gameLabel: "ゲーム",
    gameLol: "League of Legends",
    gamePalworld: "Palworld",
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
    capacityIngame: "進行人数",
    capacityHostNote: "配信者を含む",
    capacityCheckin: "チェックイン",
    capacityQueueMax: "待機列 最大",
    personUnit: "名",
    secondUnit: "秒",
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
    select: "選出",
    selectNext: "選択した参加者を選出",
    selectNextHint: "確認済みの待機者を1人以上選択して、一緒に選出してください。",
    selectForNext: "次の参加者として選択",
    bulkSelectToggle: "複数人選択",
    finishGame: "ゲーム終了処理",
    finishSession: "セッション終了",
    more: "その他",
    currentParticipant: "現在の参加者",
    noCurrentParticipant: "現在処理中の参加者はいません。",
    hostSeatLabel: "配信者",
    emptySeatLabel: "空きスロット",
    capacityFull: "進行人数が満員です。",
    queueWaiting: "待機中",
    queueHistory: "完了・取消",
    queueHistoryEmpty: "完了または取り消された参加履歴はありません。",
    queueSearchPlaceholder: "名前またはRiot IDで検索",
    queueSearchEmpty: "検索結果がありません。",
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
    entryUpdated: "参加者の状態を変更しました。",
    entriesSelected: "選択した参加者を選出しました。",
    stepRecruit: "受付",
    stepGame: "ゲーム",
    stepDone: "精算",
    stepWaitingSuffix: "名待機",
    moreActionsMenu: "その他の操作",
    announceSettings: "Discordお知らせ設定",
    finishDangerNote: "復元不可",
    stripEmpty: "下の待機列から選出してください",
    queueLockedNote: "ゲームが終わると次の選出ができます。",
    queueLockedNoteRecruit: "確定した人数でゲームを開始すると、次の選出ができます。",
    pickLockedTooltip: "すでに確定した参加者がいるため選出できません。ゲームを開始または終了すると次の選出ができます。",
    refresh: "更新",
    historyToggle: "完了・取消履歴",
    candidateLabel: "候補",
    confirmedLabel: "確定済み",
    excludeLabel: "除外",
    confirmPick: "選出を確定",
    startGame: "ゲーム開始",
    fillFirstCta: "スロットを埋めるとゲーム開始",
    pickHint: "待機列から選出するとスロットに入り、選出確定で一括確定します"
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
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [maxQueueSize, setMaxQueueSize] = useState(100);
  const [checkInSeconds, setCheckInSeconds] = useState(60);
  const [allowRejoin, setAllowRejoin] = useState(true);
  const [listingVisibility, setListingVisibility] = useState<ParticipationListingVisibility>("public");
  const [selectedGame, setSelectedGame] = useState<ParticipationGame>("lol");
  const [startSettingsOpen, setStartSettingsOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  /* 후보 담기(로컬) — 서버 선정은 활성 참가자 0명일 때 한 번의 배치만 허용하므로,
     "선정" 클릭은 로컬 후보로 담고 "선정 확정"이 배치 선정 + 즉시 자동 체크인을
     수행합니다(체크인 UI 제거 모델 — selected 방치 시 서버가 60초 뒤 자동 노쇼). */
  const [candidateIds, setCandidateIds] = useState<ReadonlySet<string>>(() => new Set());
  const queueSectionRef = useRef<HTMLElement>(null);

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

  async function manualRefresh(): Promise<void> {
    if (refreshing || busyKey) return;
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

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
  /* 세션이 시작된 뒤에는 게임을 바꿀 수 없으므로 서버가 돌려준 session.game이
     항상 우선합니다 — selectedGame은 시작 전 화면에서만 의미가 있습니다. */
  const activeGame: ParticipationGame = session?.game ?? selectedGame;
  const gameLabels: Record<ParticipationGame, string> = { lol: text.gameLol, palworld: text.gamePalworld };
  const publicUrl = session?.publicSessionId
    ? publicParticipationUrl(session.publicSessionId, locale)
    : "";
  const selectedCount = useMemo(
    () => state?.queue.filter((entry) => ["selected", "checked_in", "invited", "in_game"].includes(entry.status)).length ?? 0,
    [state]
  );
  const currentEntry = useMemo(() => getCurrentParticipationEntry(state), [state]);
  const currentEntries = useMemo(
    () => state?.queue.filter((entry) => ["selected", "checked_in", "invited", "in_game"].includes(entry.status)) ?? [],
    [state]
  );
  const waitingEntries = useMemo(
    () => state?.queue.filter((entry) => ["pending", "verified", "waitlisted"].includes(entry.status)) ?? [],
    [state]
  );
  /* 단계 파생 — 모집(후보 담는 중) → 게임 → 정산. 체크인 단계는 없습니다. */
  const inGameEntries = useMemo(
    () => currentEntries.filter((entry) => entry.status === "in_game"),
    [currentEntries]
  );
  const confirmedEntries = useMemo(
    () => currentEntries.filter((entry) => entry.status !== "in_game"),
    [currentEntries]
  );
  const activeStep: "recruit" | "game" = inGameEntries.length ? "game" : "recruit";
  const candidateEntries = useMemo(
    () => waitingEntries.filter((entry) => candidateIds.has(entry.id)),
    [candidateIds, waitingEntries]
  );
  useEffect(() => {
    /* 서버 큐에서 사라진 후보(취소·이탈)는 로컬 후보에서도 뺍니다. */
    const waitingIdSet = new Set(waitingEntries.map((entry) => entry.id));
    setCandidateIds((current) => {
      const next = new Set(Array.from(current).filter((entryId) => waitingIdSet.has(entryId)));
      return next.size === current.size ? current : next;
    });
  }, [waitingEntries]);
  useEffect(() => {
    if (!moreMenuOpen) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest(".participation-management-overflow")) return;
      setMoreMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [moreMenuOpen]);
  function toggleCandidate(entryId: string): void {
    setCandidateIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else if (next.size < remainingSeats) next.add(entryId);
      return next;
    });
  }
  /* 선정 확정: 배치 선정(selected) 직후 각 참가자를 자동 체크인(checked_in) 처리해
     확정합니다 — selected 로 남겨두면 서버 스위퍼가 60초 뒤 자동 노쇼 처리합니다. */
  async function confirmCandidates(): Promise<void> {
    const entryIds = candidateEntries.map((entry) => entry.id);
    if (busyKey || entryIds.length === 0) return;
    setBusyKey("entries:confirm");
    setError("");
    setMessage("");
    try {
      let next = await selectYoroParticipationEntries(entryIds, csrfToken, state?.revision);
      for (const entryId of entryIds) {
        next = await updateYoroParticipationEntry(entryId, "checked_in", csrfToken, next.revision);
      }
      setState(next);
      setCandidateIds(new Set());
      setMessage(text.entriesSelected);
    } catch {
      setError(text.updateFailed);
      void load();
    } finally {
      setBusyKey("");
    }
  }
  /* 게임 시작: 확정 인원 전원을 게임 중으로 전이합니다. */
  async function startGame(): Promise<void> {
    if (busyKey || confirmedEntries.length === 0) return;
    setBusyKey("entries:start-game");
    setError("");
    setMessage("");
    try {
      let next = state;
      for (const entry of confirmedEntries) {
        next = await updateYoroParticipationEntry(entry.id, "in_game", csrfToken, next?.revision);
      }
      if (next) setState(next);
      setMessage(text.entryUpdated);
    } catch {
      setError(text.updateFailed);
      void load();
    } finally {
      setBusyKey("");
    }
  }
  const historyEntries = useMemo(
    () => state?.queue.filter((entry) => ["played", "skipped", "cancelled", "no_show", "rejected", "blocked"].includes(entry.status)) ?? [],
    [state]
  );
  const visibleWaitingEntries = useMemo(() => {
    const query = queueSearch.trim().toLowerCase();
    /* 후보로 담긴 신청자는 슬롯 칩으로 이동한 것처럼 목록에서 숨깁니다. */
    const withoutCandidates = waitingEntries.filter((entry) => !candidateIds.has(entry.id));
    if (!query) return withoutCandidates;
    return withoutCandidates.filter((entry) => (
      entry.twitchUserName.toLowerCase().includes(query)
      || (entry.riotId ?? "").toLowerCase().includes(query)
      || (entry.palworldNickname ?? "").toLowerCase().includes(query)
    ));
  }, [candidateIds, queueSearch, waitingEntries]);
  /* 진행 인원 정원(방송인 포함)까지 몇 자리가 남았는지. 서버가 최종 정원을
     강제하므로(entry-status "selected" 처리), 여기서는 "선정" 동작을 앞서
     막는 안내용 가드로만 씁니다 — 판단 근거는 항상 서버 응답(currentEntries)입니다. */
  const viewerSeats = viewerSeatCount(activeGame);
  const remainingSeats = Math.max(0, viewerSeats - currentEntries.length);
  const capacityIsFull = remainingSeats <= 0;

  async function mutateSession(
    action: ParticipationSessionAction,
    options: {
      game?: ParticipationGame;
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
    await mutateSession("start", { game: selectedGame, maxQueueSize, checkInSeconds, allowRejoin, listingVisibility });
  }

  async function mutateEntry(entryId: string, status: EntryMutationStatus): Promise<void> {
    if (busyKey) return;
    setBusyKey(`entry:${entryId}:${status}`);
    setError("");
    setMessage("");
    try {
      setState(await updateYoroParticipationEntry(entryId, status, csrfToken, state?.revision));
      setMessage(text.entryUpdated);
    } catch {
      setError(text.updateFailed);
      void load();
    } finally {
      setBusyKey("");
    }
  }

  /* 주행동 하나가 항상 액션 줄 같은 자리에 옵니다:
     후보 있음 → 선정 확정 / 확정 있음 → 게임 시작 / 게임 중 → 게임 종료 처리. */
  function renderPrimaryAction() {
    if (inGameEntries.length > 0) {
      return (
        <button className="is-primary" disabled={Boolean(busyKey)} onClick={() => void mutateSession("finish_game")} type="button">
          {text.finishGame}
        </button>
      );
    }
    if (candidateEntries.length > 0) {
      return (
        <button className="is-primary" disabled={Boolean(busyKey)} onClick={() => void confirmCandidates()} type="button">
          {text.confirmPick} · {candidateEntries.length}{text.personUnit}
        </button>
      );
    }
    if (confirmedEntries.length > 0) {
      return (
        <button className="is-primary" disabled={Boolean(busyKey)} onClick={() => void startGame()} type="button">
          {text.startGame}
        </button>
      );
    }
    return (
      <button className="is-primary" disabled type="button">
        {text.fillFirstCta}
      </button>
    );
  }

  function renderEntryActions(entry: ParticipationDashboardQueueEntry) {
    const actions = entryActions(entry);
    const primaryAction = actions[0];
    const secondaryActions = actions.slice(1);
    return (
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
    );
  }

  /* 정원이 큰 게임(Palworld)은 슬롯 카드를 다 펼치면 화면이 너무 길어져,
     대기열과 같은 압축 행으로 보여줍니다 — 동작(체크인 등)은 동일하게 유지합니다. */
  function renderCompactSeat(entry: ParticipationDashboardQueueEntry) {
    return (
      <article className="participation-management-participant is-compact" key={entry.id}>
        <div className="participation-management-participant-main">
          <strong>{entry.twitchUserName}</strong>
          {entry.game === "palworld" && entry.palworldNickname ? <span>{entry.palworldNickname}</span> : null}
        </div>
        <span className="participation-management-status">{text[entry.status]}</span>
        {renderEntryActions(entry)}
      </article>
    );
  }

  function renderQueueRow(entry: ParticipationDashboardQueueEntry, historic = false) {
    const canSelect = !historic && (entry.status === "verified" || entry.status === "waitlisted");
    /* "선정"은 로컬 후보 담기입니다 — 서버 배치 선정은 액션 줄의 "선정 확정"이 수행합니다. */
    const pickDisabled = Boolean(busyKey) || Boolean(currentEntry) || !state?.isOpen || !canSelect
      || capacityIsFull || candidateEntries.length >= remainingSeats;
    /* 결함 수정 — 정원이 안 찼는데도 "선정"이 잠기는 건 서버가 확정된 참가자가
       하나라도 있으면 다음 배치 선정을 막기 때문입니다(순차 처리 규칙). 이유 없이
       버튼만 흐려지던 문제를 툴팁으로 설명합니다. */
    const pickLockedReason = capacityIsFull
      ? text.capacityFull
      : Boolean(currentEntry)
        ? text.pickLockedTooltip
        : undefined;
    const appliedAtLabel = `${text.appliedAt} ${new Date(entry.createdAt).toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP")}`;
    return (
      <article
        className={`participation-management-participant ${historic ? "is-compact" : ""}`}
        data-status={entry.status}
        key={entry.id}
        title={appliedAtLabel}
      >
        <span className="participation-management-position">#{entry.position}</span>
        <div className="participation-management-participant-main">
          <strong>{entry.twitchUserName}</strong>
          <span>
            {entry.game === "palworld" ? entry.palworldNickname : entry.riotId}
            {entry.preferredRole ? ` · ${roleLabels[locale][entry.preferredRole]}` : ""}
          </span>
        </div>
        <span className="participation-management-status" data-status={entry.status}>{text[entry.status]}</span>
        {historic ? renderEntryActions(entry) : (
          <div className="participation-management-entry-actions">
            <button
              className="is-primary"
              disabled={pickDisabled}
              onClick={() => toggleCandidate(entry.id)}
              title={pickLockedReason}
              type="button"
            >
              {text.select}
            </button>
            <details className="participation-management-row-more">
              <summary aria-label={text.more}>⋯</summary>
              <div>
                <button
                  disabled={Boolean(busyKey)}
                  onClick={() => void mutateEntry(entry.id, "skipped")}
                  type="button"
                >
                  {text.skip}
                </button>
              </div>
            </details>
          </div>
        )}
      </article>
    );
  }

  if (loading && !state) {
    return <section className="participation-management-page" role="status">{text.loading}</section>;
  }

  return (
    <section className="participation-management-page" aria-labelledby="participation-management-title">
      {/* 대형 히어로 대신 한 줄 제목 — 매일 쓰는 운영 화면은 공간이 자산입니다. */}
      <header className="participation-management-titlebar">
        <h1 id="participation-management-title">{text.title}</h1>
        <button
          aria-label={text.refresh}
          className={`participation-management-refresh${refreshing ? " is-spinning" : ""}`}
          disabled={refreshing || Boolean(busyKey)}
          onClick={() => void manualRefresh()}
          title={text.refresh}
          type="button"
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
          </svg>
        </button>
        {activeSession ? (
          <>
            <span className="participation-management-game-chip is-active">{gameLabels[activeGame]}</span>
            <span className="participation-management-session-status" data-status={session?.status} data-step={activeStep}>
              {activeStep === "game" ? text.statusInGame : sessionStatusLabel(session?.status ?? "closed", text)}
            </span>
            <a
              className="participation-management-public-open"
              href={publicUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {text.openPublic} ↗
            </a>
          </>
        ) : null}
        <p className="yoro-u-sr-only">{text.description}</p>
      </header>

      {error ? (
        <div className="participation-management-alert is-error" role="alert">
          <span>{error}</span>
          {!state ? <button onClick={() => void load()} type="button">{text.retry}</button> : null}
        </div>
      ) : null}
      {message ? <p className="participation-management-alert" aria-live="polite">{message}</p> : null}

      {!activeSession ? (
        <section className="participation-management-start" aria-labelledby="participation-start-title">
          <div className="participation-management-game-row" role="radiogroup" aria-label={text.gameLabel}>
            {(["lol", "palworld"] as const).map((game) => (
              <button
                aria-pressed={selectedGame === game}
                className={`participation-management-game-chip ${selectedGame === game ? "is-active" : ""}`}
                key={game}
                onClick={() => setSelectedGame(game)}
                type="button"
              >
                {gameLabels[game]}
              </button>
            ))}
          </div>
          <h2 id="participation-start-title">{text.quickStartTitle}</h2>
          <p>{text.createDescription}</p>
          <ul className="participation-management-capacity-preview">
            <li><strong>{PARTICIPATION_GAME_CAPACITY[selectedGame]}{text.personUnit}</strong> {text.capacityIngame}({text.capacityHostNote})</li>
            <li><strong>{checkInSeconds}{text.secondUnit}</strong> {text.capacityCheckin}</li>
            <li><strong>{maxQueueSize}{text.personUnit}</strong> {text.capacityQueueMax}</li>
          </ul>
          <form className="participation-management-start-actions" onSubmit={(event) => void createSession(event)}>
            <button className="is-primary" disabled={Boolean(busyKey)} type="submit">
              {busyKey === "session:start" ? text.creating : text.create}
            </button>
            <button
              aria-expanded={startSettingsOpen}
              onClick={() => setStartSettingsOpen((open) => !open)}
              type="button"
            >
              {text.advancedSettings}
            </button>
            {startSettingsOpen ? (
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
            ) : null}
          </form>
        </section>
      ) : (
        <>
          {/* 콕핏 카드 한 몸: 단계 바(모집→게임→정산) + 진행 슬롯 + 액션 줄 */}
          <section className="participation-management-cockpit" data-step={activeStep} aria-labelledby="participation-session-title">
            <h2 className="yoro-u-sr-only" id="participation-session-title">{text.sessionTitle}</h2>
            <ol className="participation-management-steps">
              {(["recruit", "game", "done"] as const).map((step, index) => {
                const isActive = (step === "recruit" && activeStep === "recruit")
                  || (step === "game" && activeStep === "game");
                const isDone = step === "recruit" && activeStep === "game";
                const label = step === "recruit" ? text.stepRecruit : step === "game" ? text.stepGame : text.stepDone;
                const count = step === "recruit"
                  ? `${state?.summary.waiting ?? 0}${text.stepWaitingSuffix}`
                  : step === "game"
                    ? inGameEntries.length ? `${inGameEntries.length}${text.personUnit}` : "—"
                    : `${state?.summary.played ?? 0}${text.personUnit}`;
                return (
                  <li className={`participation-management-step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`} key={step}>
                    <span className="participation-management-step-row">
                      <span aria-hidden="true" className="participation-management-step-num">{isDone ? "✓" : index + 1}</span>
                      <strong>{label}</strong>
                      <span className="participation-management-step-count">{count}</span>
                    </span>
                    <span aria-hidden="true" className="participation-management-step-track"><i /></span>
                  </li>
                );
              })}
            </ol>

            {/* 진행 슬롯 — 방송인 + 확정·후보 칩. 선정 즉시 확정 모델(체크인 없음). */}
            <div className="participation-management-strip">
              <span className="participation-management-gauge-wrap">
                <svg aria-hidden="true" className="participation-management-gauge" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="participation-gauge-gradient" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--info)" />
                      <stop offset="100%" stopColor="var(--brand)" />
                    </linearGradient>
                  </defs>
                  <circle className="is-track" cx="18" cy="18" r={GAUGE_RADIUS} />
                  <circle
                    className="is-fill"
                    cx="18"
                    cy="18"
                    r={GAUGE_RADIUS}
                    strokeDasharray={GAUGE_CIRCUMFERENCE}
                    strokeDashoffset={gaugeDashoffset(
                      currentEntries.length + candidateEntries.length + 1,
                      PARTICIPATION_GAME_CAPACITY[activeGame]
                    )}
                  />
                </svg>
                <span className="participation-management-gauge-label">
                  <strong>{currentEntries.length + candidateEntries.length + 1}/{PARTICIPATION_GAME_CAPACITY[activeGame]}</strong>
                  <span>{text.capacityIngame}</span>
                </span>
              </span>
              <span className="participation-management-chip is-host">
                <span className="participation-management-chip-avatar" aria-hidden="true">🎙</span>
                <span className="participation-management-chip-copy"><strong>{text.hostSeatLabel}</strong></span>
              </span>
              {viewerSeats > COMPACT_SEAT_THRESHOLD && currentEntries.length > 0 ? (
                <span className="participation-management-strip-compact-note">
                  {currentEntries.length}{text.personUnit}
                </span>
              ) : currentEntries.map((entry) => (
                <span className="participation-management-chip" key={entry.id}>
                  <span className="participation-management-chip-avatar" aria-hidden="true">{entry.twitchUserName.slice(0, 1)}</span>
                  <span className="participation-management-chip-copy">
                    <strong>{entry.twitchUserName}</strong>
                    <small>{entry.status === "in_game" ? text.in_game : text.confirmedLabel}</small>
                  </span>
                  {entry.status !== "in_game" ? (
                    <button
                      aria-label={`${entry.twitchUserName} ${text.excludeLabel}`}
                      className="participation-management-chip-remove"
                      disabled={Boolean(busyKey)}
                      onClick={() => void mutateEntry(entry.id, "skipped")}
                      type="button"
                    >
                      ✕
                    </button>
                  ) : null}
                </span>
              ))}
              {candidateEntries.map((entry) => (
                <span className="participation-management-chip is-candidate" key={entry.id}>
                  <span className="participation-management-chip-avatar" aria-hidden="true">{entry.twitchUserName.slice(0, 1)}</span>
                  <span className="participation-management-chip-copy">
                    <strong>{entry.twitchUserName}</strong>
                    <small>{text.candidateLabel}</small>
                  </span>
                  <button
                    aria-label={`${entry.twitchUserName} ${text.excludeLabel}`}
                    className="participation-management-chip-remove"
                    onClick={() => toggleCandidate(entry.id)}
                    type="button"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {currentEntries.length === 0 && candidateEntries.length === 0 ? (
                <span className="participation-management-strip-empty">
                  <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {text.stripEmpty}
                </span>
              ) : null}
            </div>

            {viewerSeats > COMPACT_SEAT_THRESHOLD && currentEntries.length > 0 ? (
              <div className="participation-management-group participation-management-compact-list">
                {currentEntries.map((entry) => renderCompactSeat(entry))}
              </div>
            ) : null}

            {/* 액션 줄 — 주행동이 항상 같은 자리. 모바일은 이 내용이 하단 고정 바로 갑니다. */}
            <div className="participation-management-actions">
              {renderPrimaryAction()}
              {activeStep === "recruit" && candidateEntries.length === 0 && currentEntries.length === 0 ? (
                <span className="participation-management-actions-hint">{text.pickHint}</span>
              ) : null}
              <div className="participation-management-actions-aside">
                {state?.isOpen ? (
                  <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("close")} type="button">{text.close}</button>
                ) : session?.status === "closed" ? (
                  <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("open")} type="button">{text.reopen}</button>
                ) : null}
                <div className="participation-management-overflow">
                  <button
                    aria-expanded={moreMenuOpen}
                    aria-haspopup="menu"
                    aria-label={text.moreActionsMenu}
                    onClick={() => setMoreMenuOpen((open) => !open)}
                    type="button"
                  >
                    ⋯
                  </button>
                  {moreMenuOpen ? (
                    <div className="participation-management-overflow-menu" role="menu">
                      <a href={publicUrl} onClick={() => setMoreMenuOpen(false)} rel="noopener noreferrer" role="menuitem" target="_blank">
                        {text.openPublic}
                      </a>
                      <button
                        onClick={() => {
                          setMoreMenuOpen(false);
                          setAnnounceOpen((open) => !open);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {text.announceSettings}
                      </button>
                      <hr />
                      <button
                        className="is-danger"
                        disabled={Boolean(busyKey)}
                        onClick={() => {
                          setMoreMenuOpen(false);
                          void mutateSession("finish");
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {text.finishSession} · {text.finishDangerNote}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="participation-management-queue" aria-labelledby="participation-queue-title" ref={queueSectionRef}>
              <header>
                <h2 id="participation-queue-title">{text.queueTitle}</h2>
                <span className="participation-management-queue-count">
                  {waitingEntries.length}/{session?.maxQueueSize ?? maxQueueSize}
                </span>
                <label className="participation-management-search">
                  <span className="yoro-u-sr-only">{text.queueSearchPlaceholder}</span>
                  <input
                    onChange={(event) => setQueueSearch(event.target.value)}
                    placeholder={text.queueSearchPlaceholder}
                    type="search"
                    value={queueSearch}
                  />
                </label>
                <p className="yoro-u-sr-only">{text.queueDescription}</p>
              </header>
              {capacityIsFull ? <p className="participation-management-capacity-full">{text.capacityFull}</p> : null}
              {activeStep !== "recruit" || currentEntries.length > 0 ? (
                <p className="participation-management-queue-locked">
                  {inGameEntries.length > 0 ? text.queueLockedNote : text.queueLockedNoteRecruit}
                </p>
              ) : null}
              <div className="participation-management-group" aria-labelledby="participation-waiting-title">
                <h3 id="participation-waiting-title" className="yoro-u-sr-only">{text.queueWaiting}</h3>
                {visibleWaitingEntries.length
                  ? visibleWaitingEntries.map((entry) => renderQueueRow(entry))
                  : (
                    <p className="participation-management-empty">
                      <svg aria-hidden="true" fill="none" height="32" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="32">
                        <circle cx="9" cy="8" r="3" />
                        <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
                        <path d="M17 8h5M19.5 5.5v5" />
                      </svg>
                      <span>{queueSearch ? text.queueSearchEmpty : text.queueEmpty}</span>
                    </p>
                  )}
              </div>
              <details className="participation-management-history">
                <summary>{text.historyToggle} <span>{historyEntries.length}</span></summary>
                <div>
                  {historyEntries.length
                    ? historyEntries.map((entry) => renderQueueRow(entry, true))
                    : (
                      <p className="participation-management-empty">
                        <svg aria-hidden="true" fill="none" height="32" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24" width="32">
                          <path d="M12 8v5l3 2" />
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                        <span>{text.queueHistoryEmpty}</span>
                      </p>
                    )}
                </div>
              </details>
          </section>

          {announceOpen ? <ParticipationAnnouncementPanel csrfToken={csrfToken} locale={locale} /> : null}

          {/* 모바일 하단 고정 바 — 액션 줄의 주행동이 엄지 범위로 내려옵니다. */}
          <div className="participation-management-mobile-bar">
            {renderPrimaryAction()}
            {state?.isOpen ? (
              <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("close")} type="button">{text.close}</button>
            ) : session?.status === "closed" ? (
              <button disabled={Boolean(busyKey)} onClick={() => void mutateSession("open")} type="button">{text.reopen}</button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

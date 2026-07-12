import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  StreamerTournament,
  TournamentMatch,
  TournamentMatchStatus,
  TournamentNewsItem,
  TournamentPlayerRole,
  TournamentTeam,
  TournamentTeamPlayer,
  TournamentUpsertInput
} from "@streamops/shared";
import { deleteDashboardTournament, getDashboardTournaments, saveDashboardTournament } from "../api/client";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
  AppShellSidebar,
} from "../shared/ui/AppShell";
import { Button } from "../shared/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../shared/ui/Card";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../shared/ui/EmptyState";
import { FormControl, FormField, FormHint, FormLabel, Input, Select, Textarea } from "../shared/ui/Form";
import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../shared/ui/Modal";
import {
  Navigation,
  NavigationBadge,
  NavigationItem,
  NavigationSection,
} from "../shared/ui/Navigation";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
} from "../shared/ui/PageHeader";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill, type StatusTone } from "../shared/ui/Status";
import {
  Toast,
  ToastCloseButton,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../shared/ui/Toast";

const pageText = {
  ko: {
    eyebrow: "스트리머 콘텐츠",
    title: "대회 관리",
    description: "승인된 스트리머 계정으로 공개 대회 페이지에 표시할 대진표, 일정, 뉴스를 관리합니다.",
    studio: "Tournament Studio",
    navLabel: "대회 관리 섹션",
    navTitle: "오늘 대회 운영",
    listNav: "대회 목록",
    formNav: "대회 작성",
    teamsMetric: "참가팀",
    matchesMetric: "경기",
    scheduleMetric: "일정",
    visibilityMetric: "공개 상태",
    loading: "대회 목록을 불러오는 중입니다.",
    successTitle: "작업 완료",
    errorTitle: "작업 실패",
    closeToast: "알림 닫기",
    deleteTitle: "대회 삭제",
    cancel: "취소",
    confirmDelete: "삭제 확인",
    listTitle: "대회 목록",
    empty: "생성된 대회가 없습니다.",
    formTitleCreate: "대회 생성",
    formTitleEdit: "대회 수정",
    titleLabel: "대회명",
    descriptionLabel: "소개",
    startsAtLabel: "시작일",
    endsAtLabel: "종료일",
    formatLabel: "경기 방식",
    prizeLabel: "상금",
    visibilityLabel: "공개 상태",
    draft: "비공개",
    public: "공개",
    newButton: "새 대회",
    createButton: "대회 생성",
    saveButton: "저장",
    saving: "저장 중",
    deleting: "삭제 중",
    deleteButton: "삭제",
    deleteConfirm: "이 대회를 삭제할까요? 삭제 후에는 복구할 수 없습니다.",
    deleted: "대회를 삭제했습니다.",
    refresh: "새로고침",
    saved: "저장되었습니다.",
    loadFailed: "대회 목록을 불러오지 못했습니다.",
    saveFailed: "대회를 저장하지 못했습니다.",
    deleteFailed: "대회를 삭제하지 못했습니다.",
    streamerOnly: "대회 생성/수정은 승인된 스트리머 Twitch 세션이 필요합니다.",
    openPublic: "공개 페이지",
    updatedAt: "수정",
    basicInfoTitle: "대회 정보",
    contentInfoTitle: "참가팀/대진/뉴스",
    teamsTitle: "참가팀",
    teamsHelp: "팀을 추가한 뒤 선수별 라인, Riot ID#태그, 리더 여부만 입력하면 됩니다.",
    addTeam: "팀 추가",
    removeTeam: "팀 삭제",
    teamName: "팀명",
    teamSeed: "시드",
    teamImage: "이미지 URL",
    playersTitle: "선수",
    addPlayer: "선수 추가",
    removePlayer: "삭제",
    roleLabel: "라인",
    riotIdLabel: "Riot ID#태그",
    leaderLabel: "리더",
    matchesTitle: "대진",
    matchesHelp: "팀 목록을 기준으로 랜덤 대진을 만들거나, 날짜를 지정해 순서대로 경기를 추가할 수 있습니다.",
    matchDate: "경기 날짜",
    matchFormat: "경기 방식",
    randomBracket: "랜덤 대진 생성",
    orderedBracket: "순서대로 대진 생성",
    addMatch: "대진 추가",
    removeMatch: "대진 삭제",
    roundLabel: "라운드",
    teamA: "팀 A",
    teamB: "팀 B",
    statusLabel: "상태",
    scoreLabel: "스코어",
    winnerLabel: "승리팀",
    noWinner: "미정",
    scheduled: "예정",
    live: "진행 중",
    completed: "완료",
    newsLabel: "뉴스",
    newsHelp: "한 줄에 제목|본문|게시일 형식으로 입력합니다.",
    noTeams: "아직 참가팀이 없습니다. 팀 추가 버튼으로 시작하세요.",
    noMatches: "아직 대진이 없습니다. 팀을 등록한 뒤 대진 생성 버튼을 사용하세요.",
    selectTeam: "팀 선택",
    stepBasic: "대회 정보",
    stepTeams: "참가팀",
    stepMatches: "대진",
    stepNews: "뉴스",
    prevStep: "이전",
    nextStep: "다음",
    titleRequired: "대회명을 먼저 입력해주세요.",
    top: "탑",
    jungle: "정글",
    mid: "미드",
    adc: "원딜",
    support: "서포터"
  },
  ja: {
    eyebrow: "配信者コンテンツ",
    title: "大会管理",
    description: "承認済み配信者アカウントで、公開大会ページに表示するトーナメント表、日程、ニュースを管理します。",
    studio: "Tournament Studio",
    navLabel: "大会管理セクション",
    navTitle: "今日の大会運営",
    listNav: "大会リスト",
    formNav: "大会作成",
    teamsMetric: "参加チーム",
    matchesMetric: "試合",
    scheduleMetric: "日程",
    visibilityMetric: "公開状態",
    loading: "大会リストを読み込み中です。",
    successTitle: "完了",
    errorTitle: "失敗",
    closeToast: "通知を閉じる",
    deleteTitle: "大会削除",
    cancel: "キャンセル",
    confirmDelete: "削除する",
    listTitle: "大会リスト",
    empty: "作成された大会がありません。",
    formTitleCreate: "大会作成",
    formTitleEdit: "大会編集",
    titleLabel: "大会名",
    descriptionLabel: "紹介",
    startsAtLabel: "開始日",
    endsAtLabel: "終了日",
    formatLabel: "試合形式",
    prizeLabel: "賞金",
    visibilityLabel: "公開状態",
    draft: "非公開",
    public: "公開",
    newButton: "新規大会",
    createButton: "大会作成",
    saveButton: "保存",
    saving: "保存中",
    deleting: "削除中",
    deleteButton: "削除",
    deleteConfirm: "この大会を削除しますか？削除後は復元できません。",
    deleted: "大会を削除しました。",
    refresh: "更新",
    saved: "保存しました。",
    loadFailed: "大会リストを読み込めませんでした。",
    saveFailed: "大会を保存できませんでした。",
    deleteFailed: "大会を削除できませんでした。",
    streamerOnly: "大会の作成/編集には承認済み配信者の Twitch セッションが必要です。",
    openPublic: "公開ページ",
    updatedAt: "更新",
    basicInfoTitle: "大会情報",
    contentInfoTitle: "参加チーム/組み合わせ/ニュース",
    teamsTitle: "参加チーム",
    teamsHelp: "チームを追加し、選手ごとにロール、Riot ID#タグ、リーダー有無だけ入力します。",
    addTeam: "チーム追加",
    removeTeam: "チーム削除",
    teamName: "チーム名",
    teamSeed: "シード",
    teamImage: "画像 URL",
    playersTitle: "選手",
    addPlayer: "選手追加",
    removePlayer: "削除",
    roleLabel: "ロール",
    riotIdLabel: "Riot ID#タグ",
    leaderLabel: "リーダー",
    matchesTitle: "組み合わせ",
    matchesHelp: "チーム一覧をもとにランダム組み合わせを作成するか、日付を指定して順番に試合を追加できます。",
    matchDate: "試合日時",
    matchFormat: "試合形式",
    randomBracket: "ランダム生成",
    orderedBracket: "順番で生成",
    addMatch: "組み合わせ追加",
    removeMatch: "組み合わせ削除",
    roundLabel: "ラウンド",
    teamA: "チーム A",
    teamB: "チーム B",
    statusLabel: "状態",
    scoreLabel: "スコア",
    winnerLabel: "勝利チーム",
    noWinner: "未定",
    scheduled: "予定",
    live: "進行中",
    completed: "完了",
    newsLabel: "ニュース",
    newsHelp: "1行に タイトル|本文|公開日 形式で入力します。",
    noTeams: "参加チームがまだありません。チーム追加ボタンから始めてください。",
    noMatches: "組み合わせがまだありません。チーム登録後に生成ボタンを使ってください。",
    selectTeam: "チーム選択",
    stepBasic: "大会情報",
    stepTeams: "参加チーム",
    stepMatches: "組み合わせ",
    stepNews: "ニュース",
    prevStep: "前へ",
    nextStep: "次へ",
    titleRequired: "大会名を先に入力してください。",
    top: "トップ",
    jungle: "ジャングル",
    mid: "ミッド",
    adc: "ボット",
    support: "サポート"
  }
} as const;

type FormState = {
  id?: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  formatLabel: string;
  prizeLabel: string;
  visibility: "draft" | "public";
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  newsText: string;
  matchDraftDate: string;
  matchDraftFormat: "BO3" | "BO5";
};

type TournamentFormStep = "basic" | "teams" | "matches" | "news";

const formSteps: Array<{ key: TournamentFormStep; labelKey: "stepBasic" | "stepTeams" | "stepMatches" | "stepNews" }> = [
  { key: "basic", labelKey: "stepBasic" },
  { key: "teams", labelKey: "stepTeams" },
  { key: "matches", labelKey: "stepMatches" },
  { key: "news", labelKey: "stepNews" }
];

const roleOptions: Array<{ value: TournamentPlayerRole; key: "top" | "jungle" | "mid" | "adc" | "support" }> = [
  { value: "TOP", key: "top" },
  { value: "JUNGLE", key: "jungle" },
  { value: "MID", key: "mid" },
  { value: "ADC", key: "adc" },
  { value: "SUPPORT", key: "support" }
];

const emptyForm: FormState = {
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  formatLabel: "16강~4강 BO3 · 결승 BO5",
  prizeLabel: "",
  visibility: "draft",
  teams: [],
  matches: [],
  newsText: "",
  matchDraftDate: "",
  matchDraftFormat: "BO3"
};

function localeText() {
  return document.documentElement.lang === "ja" ? pageText.ja : pageText.ko;
}

function compactDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(document.documentElement.lang === "ja" ? "ja-JP" : "ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function idFromText(prefix: string, value: string, index: number): string {
  const safe = value.trim().toLowerCase().replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${safe || index + 1}`;
}

function clientId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asLocalDateInput(value: string | undefined): string {
  return value?.slice(0, 16) ?? "";
}

function createPlayer(role: TournamentPlayerRole = "TOP"): TournamentTeamPlayer {
  return {
    id: clientId("player"),
    role,
    riotId: ""
  };
}

function createTeam(index: number): TournamentTeam {
  return {
    id: clientId("team"),
    name: "",
    seed: index + 1,
    players: roleOptions.map((role) => createPlayer(role.value))
  };
}

function createMatch(index: number, input?: Partial<TournamentMatch>): TournamentMatch {
  return {
    id: clientId("match"),
    round: input?.round ?? `${index + 1}경기`,
    teamAId: input?.teamAId,
    teamBId: input?.teamBId,
    scheduledAt: input?.scheduledAt,
    format: input?.format ?? "BO3",
    status: input?.status ?? "scheduled",
    scoreA: input?.scoreA,
    scoreB: input?.scoreB,
    winnerTeamId: input?.winnerTeamId,
    recordMatchIds: input?.recordMatchIds
  };
}

function formFromTournament(tournament: StreamerTournament): FormState {
  return {
    id: tournament.id,
    title: tournament.title,
    description: tournament.description,
    startsAt: asLocalDateInput(tournament.startsAt),
    endsAt: asLocalDateInput(tournament.endsAt),
    formatLabel: tournament.formatLabel ?? "",
    prizeLabel: tournament.prizeLabel ?? "",
    visibility: tournament.visibility,
    teams: tournament.teams.map((team) => ({
      ...team,
      players: team.players?.map((player) => ({ ...player })) ?? []
    })),
    matches: tournament.matches.map((match) => ({
      ...match,
      scheduledAt: asLocalDateInput(match.scheduledAt),
      recordMatchIds: match.recordMatchIds ? [...match.recordMatchIds] : undefined
    })),
    newsText: tournament.news.map((item) => [item.title, item.body, asLocalDateInput(item.publishedAt)].join("|")).join("\n"),
    matchDraftDate: "",
    matchDraftFormat: "BO3"
  };
}

function parseNews(text: string): TournamentNewsItem[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title = "", body = "", publishedAt = ""] = line.split("|").map((part) => part.trim());
      return {
        id: idFromText("news", title, index),
        title,
        body: body || "",
        publishedAt: publishedAt || new Date().toISOString()
      };
    });
}

function cleanTeams(teams: TournamentTeam[]): TournamentTeam[] {
  return teams
    .map((team, index) => {
      const name = team.name.trim();
      const players = (team.players ?? [])
        .map((player) => ({
          ...player,
          riotId: player.riotId.trim()
        }))
        .filter((player) => player.riotId);
      return {
        ...team,
        name,
        seed: Number.isFinite(Number(team.seed)) ? Number(team.seed) : index + 1,
        avatarUrl: team.avatarUrl?.trim() || undefined,
        twitchLogin: undefined,
        riotId: team.riotId?.trim() || undefined,
        players
      };
    })
    .filter((team) => team.name);
}

function cleanMatches(matches: TournamentMatch[]): TournamentMatch[] {
  return matches
    .filter((match) => match.teamAId || match.teamBId)
    .map((match, index) => ({
      ...match,
      round: match.round.trim() || `${index + 1}경기`,
      scheduledAt: match.scheduledAt?.trim() || undefined,
      format: match.format?.trim() || "BO3",
      winnerTeamId: match.winnerTeamId || undefined,
      recordMatchIds: match.recordMatchIds?.map((id) => id.trim()).filter(Boolean)
    }));
}

function teamLabel(teams: TournamentTeam[], teamId: string | undefined, fallback: string): string {
  if (!teamId) return fallback;
  return teams.find((team) => team.id === teamId)?.name || fallback;
}

function shuffledTeams(teams: TournamentTeam[]): TournamentTeam[] {
  return [...teams].sort(() => Math.random() - 0.5);
}

function visibilityTone(visibility: StreamerTournament["visibility"] | FormState["visibility"]): StatusTone {
  return visibility === "public" ? "success" : "neutral";
}

function matchStatusTone(status: TournamentMatchStatus): StatusTone {
  if (status === "live") return "live";
  if (status === "completed") return "success";
  return "info";
}

export function TournamentsPage() {
  const text = localeText();
  const [tournaments, setTournaments] = useState<StreamerTournament[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<TournamentFormStep>("basic");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const selected = useMemo(() => tournaments.find((tournament) => tournament.id === form.id), [form.id, tournaments]);
  const savedTeams = useMemo(() => cleanTeams(form.teams), [form.teams]);
  const stepIndex = formSteps.findIndex((item) => item.key === step);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepIndex >= formSteps.length - 1;

  async function load(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      setTournaments(await getDashboardTournaments());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function resetForm(): void {
    setForm(emptyForm);
    setStep("basic");
    setMessage("");
    setError("");
  }

  function selectTournament(tournament: StreamerTournament): void {
    setForm(formFromTournament(tournament));
    setStep("basic");
    setMessage("");
    setError("");
  }

  function goToStep(nextStep: TournamentFormStep): void {
    if (nextStep !== "basic" && !form.title.trim()) {
      setError(text.titleRequired);
      return;
    }
    setStep(nextStep);
    setError("");
  }

  function moveStep(direction: 1 | -1): void {
    if (direction > 0 && step === "basic" && !form.title.trim()) {
      setError(text.titleRequired);
      return;
    }
    const nextIndex = Math.min(Math.max(stepIndex + direction, 0), formSteps.length - 1);
    setStep(formSteps[nextIndex]?.key ?? "basic");
    setError("");
  }

  function addTeam(): void {
    setForm((current) => ({
      ...current,
      teams: [...current.teams, createTeam(current.teams.length)]
    }));
  }

  function updateTeam(teamId: string, patch: Partial<TournamentTeam>): void {
    setForm((current) => ({
      ...current,
      teams: current.teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team))
    }));
  }

  function removeTeam(teamId: string): void {
    setForm((current) => ({
      ...current,
      teams: current.teams.filter((team) => team.id !== teamId),
      matches: current.matches.filter((match) => match.teamAId !== teamId && match.teamBId !== teamId)
    }));
  }

  function addPlayer(teamId: string): void {
    setForm((current) => ({
      ...current,
      teams: current.teams.map((team) =>
        team.id === teamId
          ? { ...team, players: [...(team.players ?? []), createPlayer()] }
          : team
      )
    }));
  }

  function updatePlayer(teamId: string, playerId: string, patch: Partial<TournamentTeamPlayer>): void {
    setForm((current) => ({
      ...current,
      teams: current.teams.map((team) => {
        if (team.id !== teamId) return team;
        const players = (team.players ?? []).map((player) => {
          if (player.id !== playerId) return patch.leader === true ? { ...player, leader: false } : player;
          return { ...player, ...patch };
        });
        return { ...team, players };
      })
    }));
  }

  function removePlayer(teamId: string, playerId: string): void {
    setForm((current) => ({
      ...current,
      teams: current.teams.map((team) =>
        team.id === teamId
          ? { ...team, players: (team.players ?? []).filter((player) => player.id !== playerId) }
          : team
      )
    }));
  }

  function addMatch(input?: Partial<TournamentMatch>): void {
    setForm((current) => ({
      ...current,
      matches: [...current.matches, createMatch(current.matches.length, input)]
    }));
  }

  function generateMatches(mode: "random" | "ordered"): void {
    const teams = mode === "random" ? shuffledTeams(savedTeams) : [...savedTeams].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));
    const nextMatches: TournamentMatch[] = [];
    for (let index = 0; index < teams.length; index += 2) {
      nextMatches.push(createMatch(form.matches.length + nextMatches.length, {
        round: "1라운드",
        teamAId: teams[index]?.id,
        teamBId: teams[index + 1]?.id,
        scheduledAt: form.matchDraftDate || undefined,
        format: form.matchDraftFormat,
        status: "scheduled"
      }));
    }
    if (nextMatches.length === 0) return;
    setForm((current) => ({ ...current, matches: [...current.matches, ...nextMatches] }));
  }

  function updateMatch(matchId: string, patch: Partial<TournamentMatch>): void {
    setForm((current) => ({
      ...current,
      matches: current.matches.map((match) => (match.id === matchId ? { ...match, ...patch } : match))
    }));
  }

  function updateMatchScore(matchId: string, side: "scoreA" | "scoreB", rawValue: string): void {
    const score = rawValue === "" ? undefined : Number(rawValue);
    setForm((current) => ({
      ...current,
      matches: current.matches.map((match) => {
        if (match.id !== matchId) return match;
        const next = { ...match, [side]: Number.isFinite(score) ? score : undefined };
        if (next.scoreA !== undefined && next.scoreB !== undefined && next.scoreA !== next.scoreB) {
          next.status = "completed";
          next.winnerTeamId = next.scoreA > next.scoreB ? next.teamAId : next.teamBId;
        }
        return next;
      })
    }));
  }

  function removeMatch(matchId: string): void {
    setForm((current) => ({
      ...current,
      matches: current.matches.filter((match) => match.id !== matchId)
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const body: TournamentUpsertInput = {
        id: form.id,
        title: form.title,
        description: form.description,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        formatLabel: form.formatLabel || undefined,
        prizeLabel: form.prizeLabel || undefined,
        visibility: form.visibility,
        teams: cleanTeams(form.teams),
        matches: cleanMatches(form.matches),
        news: parseNews(form.newsText)
      };
      const next = await saveDashboardTournament(body);
      setTournaments(next);
      const saved = next.find((tournament) => tournament.id === form.id) ?? next[0];
      if (saved) setForm(formFromTournament(saved));
      setMessage(text.saved);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected(): Promise<void> {
    if (!form.id) return;
    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const next = await deleteDashboardTournament(form.id);
      setTournaments(next);
      setForm(emptyForm);
      setStep("basic");
      setDeleteModalOpen(false);
      setMessage(text.deleted);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ToastProvider position="top-right">
      <AppShell
        as="section"
        className="dashboard-tournament-page tournament-shared-shell"
        mainId="tournament-shared-main"
        skipLinkLabel={text.title}
        variant="streamer"
      >
        <AppShellHeader className="tournament-shared-header">
          <PageHeader className="tournament-shared-page-header" layout="split">
            <PageHeaderEyebrow data-ko={pageText.ko.eyebrow} data-ja={pageText.ja.eyebrow}>
              {text.eyebrow}
            </PageHeaderEyebrow>
            <PageHeaderTitle data-ko={pageText.ko.title} data-ja={pageText.ja.title}>
              {text.title}
            </PageHeaderTitle>
            <PageHeaderDescription data-ko={pageText.ko.description} data-ja={pageText.ja.description}>
              {text.description}
            </PageHeaderDescription>
            <PageHeaderStatus>
              <StatusPill tone={form.visibility === "public" ? "success" : "neutral"}>
                {form.visibility === "public" ? text.public : text.draft}
              </StatusPill>
            </PageHeaderStatus>
            <PageHeaderActions>
              <Button type="button" variant="secondary" onClick={() => void load()} loading={loading}>
                {text.refresh}
              </Button>
              <Button type="button" variant="primary" onClick={resetForm}>
                {text.newButton}
              </Button>
            </PageHeaderActions>
          </PageHeader>
        </AppShellHeader>

        <AppShellSidebar as="nav" className="tournament-shared-sidebar">
          <Navigation aria-label={text.navLabel} variant="streamer">
            <NavigationSection title={text.navTitle}>
              <NavigationItem
                as="a"
                href="#tournament-list"
                badge={<NavigationBadge>{tournaments.length}</NavigationBadge>}
              >
                {text.listNav}
              </NavigationItem>
              <NavigationItem
                as="a"
                href="#tournament-editor"
                badge={<NavigationBadge>{selected ? text.formTitleEdit : text.formTitleCreate}</NavigationBadge>}
              >
                {text.formNav}
              </NavigationItem>
            </NavigationSection>
            <NavigationSection title={text.contentInfoTitle}>
              {formSteps.map((item) => (
                <NavigationItem
                  active={step === item.key}
                  as="button"
                  disabled={saving || deleting}
                  key={item.key}
                  onClick={() => goToStep(item.key)}
                >
                  {text[item.labelKey]}
                </NavigationItem>
              ))}
            </NavigationSection>
          </Navigation>
        </AppShellSidebar>

        <AppShellMain className="tournament-shared-main" id="tournament-shared-main">
          <div className="tournament-shared-summary-grid">
            <Metric label={text.teamsMetric} value={savedTeams.length} tone="streamer" size="sm" />
            <Metric label={text.matchesMetric} value={form.matches.length} tone="info" size="sm" />
            <Metric
              description={form.startsAt ? compactDate(form.startsAt) : "-"}
              label={text.scheduleMetric}
              value={form.endsAt ? compactDate(form.endsAt) : "-"}
              tone="neutral"
              size="sm"
            />
            <Metric
              label={text.visibilityMetric}
              status={<StatusPill size="sm" tone={visibilityTone(form.visibility)}>{form.visibility === "public" ? text.public : text.draft}</StatusPill>}
              value={form.visibility === "public" ? text.public : text.draft}
              tone={visibilityTone(form.visibility)}
              size="sm"
            />
          </div>

          <div className="dashboard-tournament-grid tournament-shared-grid">
            <Card as="section" className="dashboard-tournament-list tournament-shared-list" id="tournament-list" padding="lg" variant="glass">
              <CardHeader className="tournament-shared-card-header">
                <div>
                  <CardTitle as="h2" data-ko={pageText.ko.listTitle} data-ja={pageText.ja.listTitle}>
                    {text.listTitle}
                  </CardTitle>
                  <CardDescription>{tournaments.length} {text.matchesMetric}</CardDescription>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
                  {text.refresh}
                </Button>
              </CardHeader>
              <CardContent className="dashboard-tournament-items tournament-shared-list-items">
                {loading ? (
                  <>
                    <SkeletonCard loadingLabel={text.loading} />
                    <SkeletonCard loadingLabel={text.loading} />
                  </>
                ) : null}
                {!loading && tournaments.length === 0 ? (
                  <EmptyState variant={error ? "error" : "tournament"} as="div">
                    <EmptyStateIcon>{error ? "!" : "+"}</EmptyStateIcon>
                    <EmptyStateTitle as="h3">{error ? text.loadFailed : text.empty}</EmptyStateTitle>
                    {error ? <EmptyStateDescription>{error}</EmptyStateDescription> : null}
                    <EmptyStateActions>
                      <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                        {text.refresh}
                      </Button>
                    </EmptyStateActions>
                  </EmptyState>
                ) : null}
                {!loading && tournaments.map((tournament) => (
                  <Card
                    className="tournament-shared-list-card"
                    key={tournament.id}
                    onClick={() => selectTournament(tournament)}
                    padding="sm"
                    variant={tournament.id === form.id ? "elevated" : "interactive"}
                  >
                    <CardHeader className="tournament-shared-list-card-header">
                      <StatusPill size="sm" tone={visibilityTone(tournament.visibility)}>
                        {tournament.visibility === "public" ? text.public : text.draft}
                      </StatusPill>
                      <Badge size="sm" tone="neutral">{text.updatedAt} {compactDate(tournament.updatedAt)}</Badge>
                    </CardHeader>
                    <CardContent>
                      <strong className="tournament-shared-list-card-title">{tournament.title}</strong>
                      <div className="tournament-shared-list-card-metrics">
                        <Metric label={text.teamsMetric} value={tournament.teams.length} tone="streamer" size="sm" />
                        <Metric label={text.matchesMetric} value={tournament.matches.length} tone="info" size="sm" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card
              as="section"
              className="dashboard-tournament-form tournament-shared-editor"
              id="tournament-editor"
              padding="lg"
              variant="glass"
            >
              <form className="tournament-shared-editor-form" onSubmit={(event) => void submit(event)}>
                <CardHeader className="tournament-shared-card-header">
                  <div>
                    <CardTitle as="h2">{selected ? text.formTitleEdit : text.formTitleCreate}</CardTitle>
                    <CardDescription>{text.streamerOnly}</CardDescription>
                  </div>
                  <div className="button-row dashboard-tournament-actions tournament-shared-actions">
                    {selected?.visibility === "public" ? (
                      <Button
                        as="a"
                        href={`/lol/tournaments/${encodeURIComponent(selected.slug)}`}
                        rel="noreferrer"
                        target="_blank"
                        variant="secondary"
                        size="sm"
                      >
                        {text.openPublic}
                      </Button>
                    ) : null}
                    {selected ? (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteModalOpen(true)}
                        disabled={deleting || saving}
                      >
                        {deleting ? text.deleting : text.deleteButton}
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="tournament-shared-editor-content">
                  <nav className="dashboard-tournament-stepper tournament-shared-stepper" aria-label={text.contentInfoTitle}>
                    {formSteps.map((item, index) => (
                      <Button
                        type="button"
                        key={item.key}
                        variant={step === item.key ? "primary" : "ghost"}
                        size="sm"
                        onClick={() => goToStep(item.key)}
                      >
                        <span>{index + 1}</span>
                        <strong>{text[item.labelKey]}</strong>
                      </Button>
                    ))}
                  </nav>

                  {step === "basic" ? (
                    <Card className="dashboard-tournament-form-section tournament-shared-section" padding="md" variant="elevated">
                      <CardHeader>
                        <CardTitle as="h3">{text.basicInfoTitle}</CardTitle>
                      </CardHeader>
                      <CardContent className="form-grid two tournament-shared-form-grid">
                        <FormField required>
                          <FormLabel>{text.titleLabel}</FormLabel>
                          <FormControl>
                            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
                          </FormControl>
                        </FormField>
                        <FormField>
                          <FormLabel>{text.visibilityLabel}</FormLabel>
                          <FormControl>
                            <Select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value === "public" ? "public" : "draft" }))}>
                              <option value="draft">{text.draft}</option>
                              <option value="public">{text.public}</option>
                            </Select>
                          </FormControl>
                        </FormField>
                        <FormField>
                          <FormLabel>{text.startsAtLabel}</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
                          </FormControl>
                        </FormField>
                        <FormField>
                          <FormLabel>{text.endsAtLabel}</FormLabel>
                          <FormControl>
                            <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
                          </FormControl>
                        </FormField>
                        <FormField>
                          <FormLabel>{text.formatLabel}</FormLabel>
                          <FormControl>
                            <Input value={form.formatLabel} onChange={(event) => setForm((current) => ({ ...current, formatLabel: event.target.value }))} />
                          </FormControl>
                        </FormField>
                        <FormField>
                          <FormLabel>{text.prizeLabel}</FormLabel>
                          <FormControl>
                            <Input value={form.prizeLabel} onChange={(event) => setForm((current) => ({ ...current, prizeLabel: event.target.value }))} />
                          </FormControl>
                        </FormField>
                        <FormField className="tournament-shared-form-grid-full">
                          <FormLabel>{text.descriptionLabel}</FormLabel>
                          <FormControl>
                            <Textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                          </FormControl>
                        </FormField>
                      </CardContent>
                    </Card>
                  ) : null}

                  {step === "teams" ? (
                    <Card className="dashboard-tournament-form-section tournament-shared-section" padding="md" variant="elevated">
                      <CardHeader className="dashboard-tournament-section-header tournament-shared-section-header">
                        <div>
                          <CardTitle as="h3">{text.teamsTitle}</CardTitle>
                          <CardDescription>{text.teamsHelp}</CardDescription>
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={addTeam}>{text.addTeam}</Button>
                      </CardHeader>
                      <CardContent className="dashboard-tournament-team-builder tournament-shared-builder">
                        {form.teams.length === 0 ? (
                          <EmptyState variant="tournament" as="div">
                            <EmptyStateIcon>+</EmptyStateIcon>
                            <EmptyStateTitle as="h3">{text.noTeams}</EmptyStateTitle>
                          </EmptyState>
                        ) : null}
                        {form.teams.map((team, teamIndex) => (
                          <Card className="dashboard-tournament-team-card tournament-shared-team-card" key={team.id} padding="md" variant="default">
                            <CardHeader className="dashboard-tournament-team-head">
                              <CardTitle as="h4">{team.name || `${text.teamsTitle} ${teamIndex + 1}`}</CardTitle>
                              <Button type="button" variant="danger" size="sm" onClick={() => removeTeam(team.id)}>{text.removeTeam}</Button>
                            </CardHeader>
                            <CardContent className="form-grid tournament-team-grid tournament-shared-form-grid">
                              <FormField>
                                <FormLabel>{text.teamName}</FormLabel>
                                <FormControl>
                                  <Input value={team.name} onChange={(event) => updateTeam(team.id, { name: event.target.value })} placeholder="SEIGA Team" />
                                </FormControl>
                              </FormField>
                              <FormField>
                                <FormLabel>{text.teamSeed}</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={team.seed ?? teamIndex + 1}
                                    onChange={(event) => updateTeam(team.id, { seed: Number(event.target.value) || teamIndex + 1 })}
                                  />
                                </FormControl>
                              </FormField>
                              <FormField>
                                <FormLabel>{text.teamImage}</FormLabel>
                                <FormControl>
                                  <Input value={team.avatarUrl ?? ""} onChange={(event) => updateTeam(team.id, { avatarUrl: event.target.value })} placeholder="https://..." />
                                </FormControl>
                              </FormField>
                            </CardContent>
                            <CardFooter className="dashboard-tournament-player-heading">
                              <span>{text.playersTitle}</span>
                              <Button type="button" variant="secondary" size="sm" onClick={() => addPlayer(team.id)}>{text.addPlayer}</Button>
                            </CardFooter>
                            <div className="dashboard-tournament-player-list">
                              {(team.players ?? []).map((player) => (
                                <div className="dashboard-tournament-player-row tournament-shared-player-row" key={player.id}>
                                  <Select value={player.role} onChange={(event) => updatePlayer(team.id, player.id, { role: event.target.value as TournamentPlayerRole })}>
                                    {roleOptions.map((role) => (
                                      <option key={role.value} value={role.value}>{text[role.key]}</option>
                                    ))}
                                  </Select>
                                  <Input
                                    value={player.riotId}
                                    onChange={(event) => updatePlayer(team.id, player.id, { riotId: event.target.value })}
                                    placeholder="Hide on bush#KR1"
                                  />
                                  <label className="checkbox-label tournament-leader-check tournament-shared-checkbox">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(player.leader)}
                                      onChange={(event) => updatePlayer(team.id, player.id, { leader: event.target.checked })}
                                    />
                                    <span>{text.leaderLabel}</span>
                                  </label>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removePlayer(team.id, player.id)}>{text.removePlayer}</Button>
                                </div>
                              ))}
                            </div>
                          </Card>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  {step === "matches" ? (
                    <Card className="dashboard-tournament-form-section tournament-shared-section" padding="md" variant="elevated">
                      <CardHeader className="dashboard-tournament-section-header tournament-shared-section-header">
                        <div>
                          <CardTitle as="h3">{text.matchesTitle}</CardTitle>
                          <CardDescription>{text.matchesHelp}</CardDescription>
                        </div>
                        <Button type="button" variant="secondary" size="sm" onClick={() => addMatch()}>{text.addMatch}</Button>
                      </CardHeader>
                      <CardContent className="tournament-shared-builder">
                        <div className="dashboard-tournament-match-tools tournament-shared-match-tools">
                          <FormField>
                            <FormLabel>{text.matchDate}</FormLabel>
                            <FormControl>
                              <Input type="datetime-local" value={form.matchDraftDate} onChange={(event) => setForm((current) => ({ ...current, matchDraftDate: event.target.value }))} />
                            </FormControl>
                          </FormField>
                          <FormField>
                            <FormLabel>{text.matchFormat}</FormLabel>
                            <FormControl>
                              <Select value={form.matchDraftFormat} onChange={(event) => setForm((current) => ({ ...current, matchDraftFormat: event.target.value === "BO5" ? "BO5" : "BO3" }))}>
                                <option value="BO3">BO3</option>
                                <option value="BO5">BO5</option>
                              </Select>
                            </FormControl>
                          </FormField>
                          <Button type="button" variant="secondary" size="sm" onClick={() => generateMatches("random")} disabled={savedTeams.length < 2}>{text.randomBracket}</Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => generateMatches("ordered")} disabled={savedTeams.length < 2}>{text.orderedBracket}</Button>
                        </div>
                        {form.matches.length === 0 ? (
                          <EmptyState variant="tournament" as="div">
                            <EmptyStateIcon>+</EmptyStateIcon>
                            <EmptyStateTitle as="h3">{text.noMatches}</EmptyStateTitle>
                          </EmptyState>
                        ) : null}
                        <div className="dashboard-tournament-match-builder tournament-shared-builder">
                          {form.matches.map((match, matchIndex) => (
                            <Card className="dashboard-tournament-match-card tournament-shared-match-card" key={match.id} padding="md" variant="default">
                              <CardHeader className="dashboard-tournament-match-head">
                                <div>
                                  <CardTitle as="h4">{match.round || `${matchIndex + 1}경기`}</CardTitle>
                                  <StatusPill size="sm" tone={matchStatusTone(match.status)}>
                                    {match.status === "live" ? text.live : match.status === "completed" ? text.completed : text.scheduled}
                                  </StatusPill>
                                </div>
                                <Button type="button" variant="danger" size="sm" onClick={() => removeMatch(match.id)}>{text.removeMatch}</Button>
                              </CardHeader>
                              <CardContent className="form-grid tournament-match-grid tournament-shared-form-grid">
                                <FormField>
                                  <FormLabel>{text.roundLabel}</FormLabel>
                                  <FormControl>
                                    <Input value={match.round} onChange={(event) => updateMatch(match.id, { round: event.target.value })} />
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.teamA}</FormLabel>
                                  <FormControl>
                                    <Select value={match.teamAId ?? ""} onChange={(event) => updateMatch(match.id, { teamAId: event.target.value || undefined })}>
                                      <option value="">{text.selectTeam}</option>
                                      {savedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                                    </Select>
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.teamB}</FormLabel>
                                  <FormControl>
                                    <Select value={match.teamBId ?? ""} onChange={(event) => updateMatch(match.id, { teamBId: event.target.value || undefined })}>
                                      <option value="">{text.selectTeam}</option>
                                      {savedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                                    </Select>
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.matchDate}</FormLabel>
                                  <FormControl>
                                    <Input type="datetime-local" value={asLocalDateInput(match.scheduledAt)} onChange={(event) => updateMatch(match.id, { scheduledAt: event.target.value })} />
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.matchFormat}</FormLabel>
                                  <FormControl>
                                    <Select value={match.format ?? "BO3"} onChange={(event) => updateMatch(match.id, { format: event.target.value })}>
                                      <option value="BO3">BO3</option>
                                      <option value="BO5">BO5</option>
                                    </Select>
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.statusLabel}</FormLabel>
                                  <FormControl>
                                    <Select value={match.status} onChange={(event) => updateMatch(match.id, { status: event.target.value as TournamentMatchStatus })}>
                                      <option value="scheduled">{text.scheduled}</option>
                                      <option value="live">{text.live}</option>
                                      <option value="completed">{text.completed}</option>
                                    </Select>
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.scoreLabel} A</FormLabel>
                                  <FormControl>
                                    <Input type="number" min={0} value={match.scoreA ?? ""} onChange={(event) => updateMatchScore(match.id, "scoreA", event.target.value)} />
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.scoreLabel} B</FormLabel>
                                  <FormControl>
                                    <Input type="number" min={0} value={match.scoreB ?? ""} onChange={(event) => updateMatchScore(match.id, "scoreB", event.target.value)} />
                                  </FormControl>
                                </FormField>
                                <FormField>
                                  <FormLabel>{text.winnerLabel}</FormLabel>
                                  <FormControl>
                                    <Select value={match.winnerTeamId ?? ""} onChange={(event) => updateMatch(match.id, { winnerTeamId: event.target.value || undefined })}>
                                      <option value="">{text.noWinner}</option>
                                      {match.teamAId ? <option value={match.teamAId}>{teamLabel(savedTeams, match.teamAId, text.teamA)}</option> : null}
                                      {match.teamBId ? <option value={match.teamBId}>{teamLabel(savedTeams, match.teamBId, text.teamB)}</option> : null}
                                    </Select>
                                  </FormControl>
                                </FormField>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {step === "news" ? (
                    <Card className="dashboard-tournament-form-section tournament-shared-section" padding="md" variant="elevated">
                      <CardHeader>
                        <CardTitle as="h3">{text.newsLabel}</CardTitle>
                        <Badge tone="neutral">{text.contentInfoTitle}</Badge>
                      </CardHeader>
                      <CardContent>
                        <FormField>
                          <FormLabel>{text.newsLabel}</FormLabel>
                          <FormHint>{text.newsHelp}</FormHint>
                          <FormControl>
                            <Textarea rows={5} value={form.newsText} onChange={(event) => setForm((current) => ({ ...current, newsText: event.target.value }))} />
                          </FormControl>
                        </FormField>
                      </CardContent>
                    </Card>
                  ) : null}
                </CardContent>

                <CardFooter className="form-actions dashboard-tournament-step-actions tournament-shared-footer-actions">
                  <StatusPill tone={error ? "danger" : "neutral"}>{error || text.streamerOnly}</StatusPill>
                  <div className="button-row">
                    <Button type="button" variant="secondary" onClick={() => moveStep(-1)} disabled={isFirstStep || saving || deleting}>
                      {text.prevStep}
                    </Button>
                    {!isLastStep ? (
                      <Button type="button" variant="primary" onClick={() => moveStep(1)} disabled={saving || deleting}>
                        {text.nextStep}
                      </Button>
                    ) : null}
                    <Button type="submit" variant={isLastStep ? "primary" : "secondary"} loading={saving} disabled={deleting}>
                      {saving ? text.saving : selected ? text.saveButton : text.createButton}
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </Card>
          </div>
        </AppShellMain>
      </AppShell>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        closeDisabled={deleting}
        loading={deleting}
        size="sm"
      >
        <ModalHeader>
          <ModalTitle>{text.deleteTitle}</ModalTitle>
          <ModalCloseButton aria-label={text.cancel} disabled={deleting}>×</ModalCloseButton>
        </ModalHeader>
        <ModalContent>
          <ModalDescription>{text.deleteConfirm}</ModalDescription>
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>
            {text.cancel}
          </Button>
          <Button type="button" variant="danger" onClick={() => void removeSelected()} loading={deleting}>
            {text.confirmDelete}
          </Button>
        </ModalFooter>
      </Modal>

      <ToastViewport>
        {message || error ? (
          <Toast autoDismiss onDismiss={() => { setMessage(""); setError(""); }} tone={error ? "danger" : "success"}>
            <ToastTitle>{error ? text.errorTitle : text.successTitle}</ToastTitle>
            <ToastDescription>{error || message}</ToastDescription>
            <ToastCloseButton aria-label={text.closeToast}>×</ToastCloseButton>
          </Toast>
        ) : null}
      </ToastViewport>
    </ToastProvider>
  );
}

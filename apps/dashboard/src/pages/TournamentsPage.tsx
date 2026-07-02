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

const pageText = {
  ko: {
    title: "대회 관리",
    description: "승인된 스트리머 계정으로 공개 대회 페이지에 표시할 대진표, 일정, 뉴스를 관리합니다.",
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
    title: "大会管理",
    description: "承認済み配信者アカウントで、公開大会ページに表示するトーナメント表、日程、ニュースを管理します。",
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
    if (!window.confirm(text.deleteConfirm)) return;
    setDeleting(true);
    setMessage("");
    setError("");
    try {
      const next = await deleteDashboardTournament(form.id);
      setTournaments(next);
      setForm(emptyForm);
      setMessage(text.deleted);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : text.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="dashboard-tournament-page">
      <div className="section-heading">
        <span className="eyebrow" data-ko="스트리머 콘텐츠" data-ja="配信者コンテンツ">스트리머 콘텐츠</span>
        <h1 data-ko={pageText.ko.title} data-ja={pageText.ja.title}>{text.title}</h1>
        <p data-ko={pageText.ko.description} data-ja={pageText.ja.description}>{text.description}</p>
      </div>

      {message ? <div className="status-banner success">{message}</div> : null}
      {error ? <div className="status-banner danger">{error}</div> : null}

      <div className="dashboard-tournament-grid">
        <article className="card dashboard-tournament-list">
          <div className="card-heading-row">
            <h2 data-ko={pageText.ko.listTitle} data-ja={pageText.ja.listTitle}>{text.listTitle}</h2>
            <div className="button-row">
              <button className="secondary" type="button" onClick={() => void load()} disabled={loading}>{text.refresh}</button>
              <button className="primary" type="button" onClick={resetForm}>{text.newButton}</button>
            </div>
          </div>
          {loading ? <p className="muted">{text.refresh}</p> : null}
          {!loading && tournaments.length === 0 ? <p className="muted">{text.empty}</p> : null}
          <div className="dashboard-tournament-items">
            {tournaments.map((tournament) => (
              <button
                type="button"
                className={tournament.id === form.id ? "active" : ""}
                key={tournament.id}
                onClick={() => selectTournament(tournament)}
              >
                <span className={`visibility-pill ${tournament.visibility}`}>{tournament.visibility === "public" ? text.public : text.draft}</span>
                <strong>{tournament.title}</strong>
                <small>{text.updatedAt} {compactDate(tournament.updatedAt)}</small>
              </button>
            ))}
          </div>
        </article>

        <form className="card dashboard-tournament-form" onSubmit={(event) => void submit(event)}>
          <div className="card-heading-row">
            <h2>{selected ? text.formTitleEdit : text.formTitleCreate}</h2>
            <div className="button-row dashboard-tournament-actions">
              {selected?.visibility === "public" ? (
                <a className="secondary link-button" href={`/lol/tournaments/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer">{text.openPublic}</a>
              ) : null}
              {selected ? (
                <button className="secondary danger-button" type="button" onClick={() => void removeSelected()} disabled={deleting || saving}>
                  {deleting ? text.deleting : text.deleteButton}
                </button>
              ) : null}
            </div>
          </div>

          <nav className="dashboard-tournament-stepper" aria-label={text.contentInfoTitle}>
            {formSteps.map((item, index) => (
              <button
                type="button"
                key={item.key}
                className={step === item.key ? "active" : ""}
                onClick={() => goToStep(item.key)}
              >
                <span>{index + 1}</span>
                <strong>{text[item.labelKey]}</strong>
              </button>
            ))}
          </nav>

          {step === "basic" ? (
          <div className="dashboard-tournament-form-section">
            <h3>{text.basicInfoTitle}</h3>
            <div className="form-grid two">
              <label>
                <span>{text.titleLabel}</span>
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label>
                <span>{text.visibilityLabel}</span>
                <select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value === "public" ? "public" : "draft" }))}>
                  <option value="draft">{text.draft}</option>
                  <option value="public">{text.public}</option>
                </select>
              </label>
              <label>
                <span>{text.startsAtLabel}</span>
                <input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
              </label>
              <label>
                <span>{text.endsAtLabel}</span>
                <input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
              </label>
              <label>
                <span>{text.formatLabel}</span>
                <input value={form.formatLabel} onChange={(event) => setForm((current) => ({ ...current, formatLabel: event.target.value }))} />
              </label>
              <label>
                <span>{text.prizeLabel}</span>
                <input value={form.prizeLabel} onChange={(event) => setForm((current) => ({ ...current, prizeLabel: event.target.value }))} />
              </label>
            </div>
            <label>
              <span>{text.descriptionLabel}</span>
              <textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          ) : null}

          {step === "teams" ? (
          <div className="dashboard-tournament-form-section">
            <div className="dashboard-tournament-section-header">
              <div>
                <h3>{text.teamsTitle}</h3>
                <p>{text.teamsHelp}</p>
              </div>
              <button className="secondary" type="button" onClick={addTeam}>{text.addTeam}</button>
            </div>
            {form.teams.length === 0 ? <p className="dashboard-tournament-empty">{text.noTeams}</p> : null}
            <div className="dashboard-tournament-team-builder">
              {form.teams.map((team, teamIndex) => (
                <article className="dashboard-tournament-team-card" key={team.id}>
                  <div className="dashboard-tournament-team-head">
                    <strong>{team.name || `${text.teamsTitle} ${teamIndex + 1}`}</strong>
                    <button className="secondary danger-button" type="button" onClick={() => removeTeam(team.id)}>{text.removeTeam}</button>
                  </div>
                  <div className="form-grid tournament-team-grid">
                    <label>
                      <span>{text.teamName}</span>
                      <input value={team.name} onChange={(event) => updateTeam(team.id, { name: event.target.value })} placeholder="SEIGA Team" />
                    </label>
                    <label>
                      <span>{text.teamSeed}</span>
                      <input
                        type="number"
                        min={1}
                        value={team.seed ?? teamIndex + 1}
                        onChange={(event) => updateTeam(team.id, { seed: Number(event.target.value) || teamIndex + 1 })}
                      />
                    </label>
                    <label>
                      <span>{text.teamImage}</span>
                      <input value={team.avatarUrl ?? ""} onChange={(event) => updateTeam(team.id, { avatarUrl: event.target.value })} placeholder="https://..." />
                    </label>
                  </div>
                  <div className="dashboard-tournament-player-list">
                    <div className="dashboard-tournament-player-heading">
                      <span>{text.playersTitle}</span>
                      <button className="secondary compact-button" type="button" onClick={() => addPlayer(team.id)}>{text.addPlayer}</button>
                    </div>
                    {(team.players ?? []).map((player) => (
                      <div className="dashboard-tournament-player-row" key={player.id}>
                        <select value={player.role} onChange={(event) => updatePlayer(team.id, player.id, { role: event.target.value as TournamentPlayerRole })}>
                          {roleOptions.map((role) => (
                            <option key={role.value} value={role.value}>{text[role.key]}</option>
                          ))}
                        </select>
                        <input
                          value={player.riotId}
                          onChange={(event) => updatePlayer(team.id, player.id, { riotId: event.target.value })}
                          placeholder="Hide on bush#KR1"
                        />
                        <label className="checkbox-label tournament-leader-check">
                          <input
                            type="checkbox"
                            checked={Boolean(player.leader)}
                            onChange={(event) => updatePlayer(team.id, player.id, { leader: event.target.checked })}
                          />
                          <span>{text.leaderLabel}</span>
                        </label>
                        <button className="secondary compact-button" type="button" onClick={() => removePlayer(team.id, player.id)}>{text.removePlayer}</button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
          ) : null}

          {step === "matches" ? (
          <div className="dashboard-tournament-form-section">
            <div className="dashboard-tournament-section-header">
              <div>
                <h3>{text.matchesTitle}</h3>
                <p>{text.matchesHelp}</p>
              </div>
              <button className="secondary" type="button" onClick={() => addMatch()}>{text.addMatch}</button>
            </div>
            <div className="dashboard-tournament-match-tools">
              <label>
                <span>{text.matchDate}</span>
                <input type="datetime-local" value={form.matchDraftDate} onChange={(event) => setForm((current) => ({ ...current, matchDraftDate: event.target.value }))} />
              </label>
              <label>
                <span>{text.matchFormat}</span>
                <select value={form.matchDraftFormat} onChange={(event) => setForm((current) => ({ ...current, matchDraftFormat: event.target.value === "BO5" ? "BO5" : "BO3" }))}>
                  <option value="BO3">BO3</option>
                  <option value="BO5">BO5</option>
                </select>
              </label>
              <button className="secondary" type="button" onClick={() => generateMatches("random")} disabled={savedTeams.length < 2}>{text.randomBracket}</button>
              <button className="secondary" type="button" onClick={() => generateMatches("ordered")} disabled={savedTeams.length < 2}>{text.orderedBracket}</button>
            </div>
            {form.matches.length === 0 ? <p className="dashboard-tournament-empty">{text.noMatches}</p> : null}
            <div className="dashboard-tournament-match-builder">
              {form.matches.map((match, matchIndex) => (
                <article className="dashboard-tournament-match-card" key={match.id}>
                  <div className="dashboard-tournament-match-head">
                    <strong>{match.round || `${matchIndex + 1}경기`}</strong>
                    <button className="secondary danger-button compact-button" type="button" onClick={() => removeMatch(match.id)}>{text.removeMatch}</button>
                  </div>
                  <div className="form-grid tournament-match-grid">
                    <label>
                      <span>{text.roundLabel}</span>
                      <input value={match.round} onChange={(event) => updateMatch(match.id, { round: event.target.value })} />
                    </label>
                    <label>
                      <span>{text.teamA}</span>
                      <select value={match.teamAId ?? ""} onChange={(event) => updateMatch(match.id, { teamAId: event.target.value || undefined })}>
                        <option value="">{text.selectTeam}</option>
                        {savedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>{text.teamB}</span>
                      <select value={match.teamBId ?? ""} onChange={(event) => updateMatch(match.id, { teamBId: event.target.value || undefined })}>
                        <option value="">{text.selectTeam}</option>
                        {savedTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>{text.matchDate}</span>
                      <input type="datetime-local" value={asLocalDateInput(match.scheduledAt)} onChange={(event) => updateMatch(match.id, { scheduledAt: event.target.value })} />
                    </label>
                    <label>
                      <span>{text.matchFormat}</span>
                      <select value={match.format ?? "BO3"} onChange={(event) => updateMatch(match.id, { format: event.target.value })}>
                        <option value="BO3">BO3</option>
                        <option value="BO5">BO5</option>
                      </select>
                    </label>
                    <label>
                      <span>{text.statusLabel}</span>
                      <select value={match.status} onChange={(event) => updateMatch(match.id, { status: event.target.value as TournamentMatchStatus })}>
                        <option value="scheduled">{text.scheduled}</option>
                        <option value="live">{text.live}</option>
                        <option value="completed">{text.completed}</option>
                      </select>
                    </label>
                    <label>
                      <span>{text.scoreLabel} A</span>
                      <input type="number" min={0} value={match.scoreA ?? ""} onChange={(event) => updateMatchScore(match.id, "scoreA", event.target.value)} />
                    </label>
                    <label>
                      <span>{text.scoreLabel} B</span>
                      <input type="number" min={0} value={match.scoreB ?? ""} onChange={(event) => updateMatchScore(match.id, "scoreB", event.target.value)} />
                    </label>
                    <label>
                      <span>{text.winnerLabel}</span>
                      <select value={match.winnerTeamId ?? ""} onChange={(event) => updateMatch(match.id, { winnerTeamId: event.target.value || undefined })}>
                        <option value="">{text.noWinner}</option>
                        {match.teamAId ? <option value={match.teamAId}>{teamLabel(savedTeams, match.teamAId, text.teamA)}</option> : null}
                        {match.teamBId ? <option value={match.teamBId}>{teamLabel(savedTeams, match.teamBId, text.teamB)}</option> : null}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </div>
          ) : null}

          {step === "news" ? (
          <div className="dashboard-tournament-form-section">
            <label>
              <span>{text.newsLabel}</span>
              <small>{text.newsHelp}</small>
              <textarea rows={5} value={form.newsText} onChange={(event) => setForm((current) => ({ ...current, newsText: event.target.value }))} />
            </label>
          </div>
          ) : null}

          <div className="form-actions dashboard-tournament-step-actions">
            <span className="muted">{text.streamerOnly}</span>
            <div className="button-row">
              <button className="secondary" type="button" onClick={() => moveStep(-1)} disabled={isFirstStep || saving || deleting}>{text.prevStep}</button>
              {!isLastStep ? (
                <button className="primary" type="button" onClick={() => moveStep(1)} disabled={saving || deleting}>{text.nextStep}</button>
              ) : null}
              <button className={isLastStep ? "primary" : "secondary"} type="submit" disabled={saving || deleting}>
                {saving ? text.saving : selected ? text.saveButton : text.createButton}
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

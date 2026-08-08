import { useCallback, useEffect, useState } from "react";
import {
  getParticipationAnnouncement,
  saveParticipationAnnouncement,
  type ParticipationAnnounceCandidate,
  type ParticipationAnnounceDeliverable,
  type ParticipationAnnounceSettings
} from "./api";

/* 참여 모집 Discord 알림 설정.
 *
 * 기존 .participation-management-* 는 legacy layer 이고 지금 다른 작업이
 * 진행 중이라, 새 이름(.yoro-pa-*)과 pages layer 로 분리했습니다.
 *
 * 화면 설계: docs/mockups/discord-announce-settings.html
 */

const MAX_TARGETS = 3;
const NO_MENTION = "";

type Locale = "ko" | "ja";

type Draft = {
  organizationId: string;
  discordGuildId: string;
  channelId: string;
  mentionRoleId: string;
};

const copy = {
  ko: {
    title: "참여 모집 Discord 알림",
    description: "모집을 열면 지정한 채널에 알립니다. 대기 인원은 주기적으로 갱신됩니다.",
    safety: "Discord 전송 실패가 참여 신청이나 대기열 상태를 바꾸지 않습니다.",
    loading: "Discord 서버 목록을 불러오는 중입니다.",
    loadFailed: "후보를 불러오지 못했습니다.",
    retry: "다시 시도",
    enabledOn: "사용",
    enabledOff: "사용 안 함",
    channel: "알림 채널",
    role: "멘션할 역할",
    noMention: "멘션 안 함",
    noGuild: "Bot이 설치된 Discord 서버가 없습니다",
    noGuildHint: "서버에 YORO Bot을 추가하면 여기에서 알림 채널을 고를 수 있습니다.",
    manageOrganization: "Organization 관리 열기",
    addGuild: "Discord 서버 추가",
    remove: "제거",
    save: "저장",
    saving: "저장 중",
    saved: "알림 설정을 저장했습니다. 다음 모집부터 적용됩니다.",
    saveFailed: "알림 설정을 저장하지 못했습니다.",
    mentionNotice: "@everyone·@here는 사용하지 않습니다. 지정한 역할만 멘션합니다.",
    selectChannel: "채널을 고르세요",
    lastSent: "마지막 발송",
    neverSent: "아직 발송하지 않았습니다",
    blockedByGuild: "이 서버의 관리자가 참여 알림을 껐습니다.",
    deliverable: {
      ok: "정상",
      missing_channel: "채널을 찾을 수 없음",
      missing_permission: "쓰기 권한 없음",
      bot_removed: "Bot이 제거됨",
      blocked_by_guild: "차단됨"
    }
  },
  ja: {
    title: "参加募集のDiscord通知",
    description: "募集を開始すると指定チャンネルに通知します。待機人数は定期的に更新されます。",
    safety: "Discord送信の失敗によって、参加申請や待機列の状態が変更されることはありません。",
    loading: "Discordサーバー一覧を読み込んでいます。",
    loadFailed: "候補を読み込めませんでした。",
    retry: "再試行",
    enabledOn: "使用する",
    enabledOff: "使用しない",
    channel: "通知チャンネル",
    role: "メンションするロール",
    noMention: "メンションしない",
    noGuild: "Botが導入されたDiscordサーバーがありません",
    noGuildHint: "サーバーにYORO Botを追加すると、ここで通知チャンネルを選べます。",
    manageOrganization: "Organization管理を開く",
    addGuild: "Discordサーバーを追加",
    remove: "削除",
    save: "保存",
    saving: "保存中",
    saved: "通知設定を保存しました。次の募集から適用されます。",
    saveFailed: "通知設定を保存できませんでした。",
    mentionNotice: "@everyone・@hereは使用しません。指定したロールのみメンションします。",
    selectChannel: "チャンネルを選択",
    lastSent: "最終送信",
    neverSent: "まだ送信していません",
    blockedByGuild: "このサーバーの管理者が参加通知をオフにしています。",
    deliverable: {
      ok: "正常",
      missing_channel: "チャンネルが見つかりません",
      missing_permission: "書き込み権限がありません",
      bot_removed: "Botが削除されました",
      blocked_by_guild: "ブロック中"
    }
  }
} as const;

function candidateKey(organizationId: string, discordGuildId: string): string {
  return `${organizationId}:${discordGuildId}`;
}

function draftsFrom(settings: ParticipationAnnounceSettings): Draft[] {
  return settings.targets.map((target) => ({
    organizationId: target.organizationId,
    discordGuildId: target.discordGuildId,
    channelId: target.channelId,
    mentionRoleId: target.mentionRoleId ?? NO_MENTION
  }));
}

function deliverableTone(value: ParticipationAnnounceDeliverable): "ok" | "warn" | "bad" {
  if (value === "ok") return "ok";
  return value === "bot_removed" ? "bad" : "warn";
}

export function ParticipationAnnouncementPanel({
  csrfToken,
  locale
}: {
  csrfToken: string;
  locale: Locale;
}) {
  const text = copy[locale];
  const [settings, setSettings] = useState<ParticipationAnnounceSettings>();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadFailed(false);
    try {
      const next = await getParticipationAnnouncement(signal);
      setSettings(next);
      setDrafts(draftsFrom(next));
      setEnabled(next.enabled);
    } catch (error) {
      /* 화면을 떠나며 중단한 요청은 실패가 아닙니다.
         이것을 실패로 세면 다시 띄운 조회가 성공해도 오류 배너가 남습니다. */
      if (signal?.aborted || (error as { name?: string })?.name === "AbortError") return;
      /* 조회에 실패해도 이미 저장된 값을 지우지 않습니다. */
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const available = settings?.available ?? [];
  const byGuild = new Map<string, ParticipationAnnounceCandidate>(
    available.map((item) => [candidateKey(item.organizationId, item.discordGuildId), item])
  );
  const usedGuilds = new Set(
    drafts.map((draft) => candidateKey(draft.organizationId, draft.discordGuildId))
  );
  const addable = available.filter(
    (item) => !usedGuilds.has(candidateKey(item.organizationId, item.discordGuildId))
  );

  function updateDraft(index: number, patch: Partial<Draft>): void {
    setDrafts((current) => current.map(
      (draft, position) => position === index ? { ...draft, ...patch } : draft
    ));
    setMessage(undefined);
  }

  function addTarget(): void {
    const next = addable[0];
    if (!next || drafts.length >= MAX_TARGETS) return;
    setDrafts((current) => [...current, {
      organizationId: next.organizationId,
      discordGuildId: next.discordGuildId,
      channelId: next.channels[0]?.id ?? "",
      mentionRoleId: NO_MENTION
    }]);
    setMessage(undefined);
  }

  async function save(): Promise<void> {
    if (saving) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const next = await saveParticipationAnnouncement({
        enabled,
        targets: drafts
          .filter((draft) => draft.channelId)
          .map((draft) => ({
            organizationId: draft.organizationId,
            discordGuildId: draft.discordGuildId,
            channelId: draft.channelId,
            ...(draft.mentionRoleId ? { mentionRoleId: draft.mentionRoleId } : {})
          }))
      }, csrfToken);
      setSettings(next);
      setDrafts(draftsFrom(next));
      setEnabled(next.enabled);
      setMessage({ tone: "ok", text: text.saved });
    } catch {
      /* 실패해도 사용자가 고른 값을 지우지 않습니다. */
      setMessage({ tone: "error", text: text.saveFailed });
    } finally {
      setSaving(false);
    }
  }

  if (!settings && !loadFailed) {
    return (
      <section aria-labelledby="yoro-pa-title" className="yoro-pa">
        <div className="yoro-pa-head">
          <div>
            <h2 id="yoro-pa-title">{text.title}</h2>
            <p>{text.loading}</p>
          </div>
        </div>
        <p aria-hidden="true" className="yoro-pa-skeleton" />
      </section>
    );
  }

  /* 고를 수 있는 서버가 없으면 토글을 아예 두지 않습니다.
     스위치만 있고 아무 일도 일어나지 않는 화면을 만들지 않습니다. */
  if (settings && available.length === 0) {
    return (
      <section aria-labelledby="yoro-pa-title" className="yoro-pa">
        <div className="yoro-pa-head">
          <div>
            <h2 id="yoro-pa-title">{text.title}</h2>
            <p>{text.description}</p>
          </div>
        </div>
        <p className="yoro-pa-empty">
          {text.noGuild}
          <span>{text.noGuildHint}</span>
        </p>
        <a className="yoro-pa-action is-primary is-block" href="/dashboard/organizations">
          {text.manageOrganization}
        </a>
      </section>
    );
  }

  return (
    <section aria-labelledby="yoro-pa-title" className="yoro-pa">
      <div className="yoro-pa-head">
        <div>
          <h2 id="yoro-pa-title">{text.title}</h2>
          <p>{text.description}</p>
          <small>{text.safety}</small>
        </div>
        <label className="yoro-pa-toggle">
          <input
            checked={enabled}
            onChange={(event) => {
              setEnabled(event.target.checked);
              setMessage(undefined);
            }}
            type="checkbox"
          />
          <span>{enabled ? text.enabledOn : text.enabledOff}</span>
          <i aria-hidden="true" />
        </label>
      </div>

      {loadFailed ? (
        <p className="yoro-pa-alert" role="alert">
          {text.loadFailed}
          <button onClick={() => void load()} type="button">{text.retry}</button>
        </p>
      ) : null}

      {message ? (
        <p
          aria-live="polite"
          className={message.tone === "ok" ? "yoro-pa-saved" : "yoro-pa-alert"}
        >
          {message.text}
        </p>
      ) : null}

      <ul className="yoro-pa-targets">
        {drafts.map((draft, index) => {
          const guild = byGuild.get(candidateKey(draft.organizationId, draft.discordGuildId));
          const stored = settings?.targets.find(
            (target) => target.organizationId === draft.organizationId
              && target.discordGuildId === draft.discordGuildId
          );
          const blocked = guild?.announcementAllowed === false;
          const state: ParticipationAnnounceDeliverable = blocked
            ? "blocked_by_guild"
            : stored?.deliverable ?? "ok";
          return (
            <li
              className="yoro-pa-target"
              data-warn={state === "ok" ? undefined : "1"}
              key={candidateKey(draft.organizationId, draft.discordGuildId)}
            >
              <div className="yoro-pa-target-head">
                <span className="yoro-pa-name">
                  <b>{guild?.organizationName ?? draft.organizationId}</b>
                  <small>{guild?.guildDisplayName ?? draft.discordGuildId}</small>
                </span>
                <span className="yoro-pa-badge" data-tone={deliverableTone(state)}>
                  {text.deliverable[state]}
                </span>
              </div>

              {blocked ? (
                <p className="yoro-pa-note">{text.blockedByGuild}</p>
              ) : (
                <div className="yoro-pa-fields">
                  <label>
                    <span>{text.channel}</span>
                    <select
                      onChange={(event) => updateDraft(index, { channelId: event.target.value })}
                      value={draft.channelId}
                    >
                      {draft.channelId ? null : (
                        <option value="">{text.selectChannel}</option>
                      )}
                      {(guild?.channels ?? []).map((channel) => (
                        <option key={channel.id} value={channel.id}>#{channel.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>{text.role}</span>
                    <select
                      onChange={(event) => updateDraft(index, { mentionRoleId: event.target.value })}
                      value={draft.mentionRoleId}
                    >
                      <option value={NO_MENTION}>{text.noMention}</option>
                      {(guild?.roles ?? []).map((role) => (
                        <option key={role.id} value={role.id}>@{role.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="yoro-pa-target-foot">
                <small>
                  {stored?.lastDeliveredAt
                    ? `${text.lastSent} ${new Date(stored.lastDeliveredAt).toLocaleString(locale)}`
                    : text.neverSent}
                </small>
                <button
                  className="yoro-pa-action is-danger"
                  onClick={() => {
                    setDrafts((current) => current.filter((_, position) => position !== index));
                    setMessage(undefined);
                  }}
                  type="button"
                >
                  {text.remove}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="yoro-pa-foot">
        <button
          className="yoro-pa-action"
          disabled={addable.length === 0 || drafts.length >= MAX_TARGETS}
          onClick={addTarget}
          type="button"
        >
          {text.addGuild} <span>{drafts.length} / {MAX_TARGETS}</span>
        </button>
        <button
          className="yoro-pa-action is-primary"
          disabled={saving}
          onClick={() => void save()}
          type="button"
        >
          {saving ? text.saving : text.save}
        </button>
      </div>

      <p className="yoro-pa-hint">{text.mentionNotice}</p>
    </section>
  );
}

import type { DiscordBotControlSettings } from "@streamops/shared";

export type DiscordBotControlDraft = Omit<DiscordBotControlSettings, "revision">;

export function botControlActiveCommandCount(
  draft: DiscordBotControlDraft
): number {
  return [
    draft.statusCommandEnabled,
    draft.guideCommandEnabled,
    draft.playerCommandEnabled,
  ].filter(Boolean).length;
}

export function botControlDraftChanged(
  current: DiscordBotControlDraft,
  saved: DiscordBotControlDraft
): boolean {
  return current.publicCommandsEnabled !== saved.publicCommandsEnabled
    || current.palworldStatusEnabled !== saved.palworldStatusEnabled
    || current.statusCommandEnabled !== saved.statusCommandEnabled
    || current.playerCommandEnabled !== saved.playerCommandEnabled
    || current.guideCommandEnabled !== saved.guideCommandEnabled
    || current.deleteInvocationAfterReply !== saved.deleteInvocationAfterReply
    || current.preferredLocale !== saved.preferredLocale
    || current.statusFields.players !== saved.statusFields.players
    || current.statusFields.version !== saved.statusFields.version
    || current.statusFields.latency !== saved.statusFields.latency
    || current.statusFields.observedAt !== saved.statusFields.observedAt;
}

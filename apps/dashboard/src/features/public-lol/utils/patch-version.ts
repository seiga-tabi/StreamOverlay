import type { PatchNote } from "@streamops/shared";

/* 패치 번호("16.17") 비교 규칙 — 서버 apps/server/src/services/patch-change-summary.ts
 * 의 patchVersionOrder 와 같은 파싱입니다. 문자열 비교로는 "16.9" > "16.17" 이 되어
 * 최신 패치를 한 칸 놓칩니다. */

/** "16.17" → 16017. 형식을 벗어나면 undefined 입니다. */
export function patchVersionOrder(patchVersion: string): number | undefined {
  const match = /^(\d{1,3})\.(\d{1,3})$/u.exec(patchVersion);
  if (!match?.[1] || !match[2]) return undefined;
  return Number(match[1]) * 1_000 + Number(match[2]);
}

/**
 * 패치 노트 목록에서 가장 최신 패치 번호를 고릅니다.
 *
 * 피드가 최신순으로 온다는 사실에 기대지 않고 번호 자체를 비교합니다 — 첫 항목이
 * 패치 번호 없는 공지(예: 시즌 안내)인 경우에도 최신 패치를 찾아야 합니다.
 */
export function latestPatchVersion(notes: readonly PatchNote[]): string | undefined {
  let best: { version: string; order: number } | undefined;
  for (const note of notes) {
    if (!note.patchVersion) continue;
    const order = patchVersionOrder(note.patchVersion);
    if (order === undefined) continue;
    if (!best || order > best.order) best = { version: note.patchVersion, order };
  }
  return best?.version;
}

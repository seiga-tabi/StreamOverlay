import {
  parsePatchNotesFeed,
  parsePatchPlaySummary,
  type PatchNoteLocale,
  type PatchNotesFeed,
  type PatchPlaySummary
} from "@streamops/shared";
import { t } from "../i18n/public-lol-i18n";
import { parsePatchChangeSummary, type PatchChangeSummary } from "../types/patch-change-summary";

/**
 * 패치 노트 목록을 받아옵니다.
 *
 * 응답은 shared parser 를 한 번 더 통과시킵니다. 서버가 이미 검증하지만,
 * 화면이 검증되지 않은 값으로 링크와 이미지를 만들지 않게 하기 위해서입니다.
 */
export async function requestPatchNotes(
  locale: PatchNoteLocale,
  signal: AbortSignal
): Promise<PatchNotesFeed> {
  /* Riot 은 ko-kr·ja-jp 를 따로 서비스합니다. 언어가 바뀌면 목록도 다시 받아야 합니다. */
  const response = await fetch(`/api/public/patch-notes?locale=${locale === "ja" ? "ja" : "ko"}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal
  });
  if (!response.ok) throw new Error(t().patchNotesLoadFailed);
  const feed = parsePatchNotesFeed(await response.json());
  if (!feed) throw new Error(t().patchNotesInvalidData);
  /* 요청한 언어와 다른 목록이 오면 화면이 엉뚱한 언어를 보여 주게 됩니다. */
  if (feed.locale !== locale) throw new Error(t().patchNotesInvalidData);
  return feed;
}

/**
 * 이 방문자가 고른 소환사의 패치별 전적입니다.
 *
 * Riot ID 와 서버는 방문자가 이미 검색한 값(최근 검색·즐겨찾기)에서만 옵니다.
 * 응답도 shared parser 를 통과시켜, 승/판/승률이 서로 어긋난 값을 화면에 올리지 않습니다.
 */
export async function requestPatchPlaySummary(
  riotId: string,
  lolPlatform: string,
  signal: AbortSignal
): Promise<PatchPlaySummary> {
  const query = new URLSearchParams({ riotId, platform: lolPlatform });
  const response = await fetch(`/api/public/patch-notes/summary?${query.toString()}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal
  });
  if (!response.ok) throw new Error(t().patchNotesMineFailed);
  const summary = parsePatchPlaySummary(await response.json());
  if (!summary) throw new Error(t().patchNotesInvalidData);
  return summary;
}


/**
 * 패치 변경 요약(기본 스탯·아이템 diff)입니다.
 *
 * 서버가 아직 이 계약을 구현하지 않은 배포가 있습니다 — 그런 경우 404 나 파싱 실패로
 * 끝나는데, 화면은 이걸 오류로 올리지 않고 패널을 숨깁니다(fail-soft). 요약은 부가
 * 정보이고, 없다고 해서 패치 노트 화면이 고장 난 것처럼 보이면 안 됩니다.
 *
 * 경로가 /patch-notes/summary 가 아니라 /changes 인 이유: summary 는 이미 패치별
 * 전적(requestPatchPlaySummary)이 쓰고 있는 경로입니다(2026-08-18 확인).
 */
export async function requestPatchChangeSummary(
  patchVersion: string,
  locale: PatchNoteLocale,
  signal: AbortSignal
): Promise<PatchChangeSummary | undefined> {
  const query = new URLSearchParams({ patch: patchVersion, locale: locale === "ja" ? "ja" : "ko" });
  try {
    const response = await fetch(`/api/public/patch-notes/changes?${query.toString()}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal
    });
    if (!response.ok) return undefined;
    const summary = parsePatchChangeSummary(await response.json());
    /* 요청한 패치와 다른 요약이 오면 화면이 엉뚱한 패치의 변경을 말하게 됩니다. */
    if (!summary || summary.patchVersion !== patchVersion) return undefined;
    return summary;
  } catch (error) {
    /* 취소는 호출부가 다루도록 그대로 올립니다. 그 외 네트워크 오류는 숨김 처리. */
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return undefined;
  }
}

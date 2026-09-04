import {
  isPatchNoteLocale,
  parsePatchNotesFeed,
  parsePatchPlaySummary,
  type PatchNoteLocale,
  type PatchNotesFeed,
  type PatchPlaySummary
} from "@streamops/shared";
import { t } from "../i18n/public-lol-i18n";

/** 화면 언어를 Riot 목록 언어로 좁힙니다. 허용 목록 밖이면 한국어로 닫습니다. */
export function patchNoteLocale(locale: string): PatchNoteLocale {
  return isPatchNoteLocale(locale) ? locale : "ko";
}

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
  /* Riot 은 ko-kr·ja-jp·en-us 를 따로 서비스합니다. 언어가 바뀌면 목록도 다시 받아야 합니다. */
  const response = await fetch(`/api/public/patch-notes?locale=${locale}`, {
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

/* 리그 오브 레전드 패치 노트 목록 수집기.
 *
 * Riot 은 패치 노트 목록에 공개 API 를 주지 않습니다. 대신 목록 페이지가
 * Next.js 로 만들어져 있어 `__NEXT_DATA__` 안에 카드 목록이 그대로 들어 있습니다.
 * 우리는 그 카드가 이미 보여 주는 값(제목·발행일·한 줄 요약·썸네일·원문 링크)만
 * 옮깁니다. 본문은 Riot 저작물이므로 가져오지 않고 원문으로 보냅니다.
 *
 * 실측(2026-08-09): ko-kr 424KB / ja-jp 432KB, blade type "articleCardGrid" 에
 * 170건, 최신순 정렬, slug 는 두 언어가 동일.
 */

import {
  PATCH_NOTES_MAX_ITEMS,
  dataDragonVersionForPatch,
  parsePatchNote,
  patchVersionFromTitle,
  type PatchNote,
  type PatchNoteLocale
} from "@streamops/shared";

const PATCH_NOTES_ORIGIN = "https://www.leagueoflegends.com";

/** 수집 대상은 이 두 URL 로 고정입니다. 외부 입력으로 바뀌지 않습니다. */
export const PATCH_NOTE_SOURCE_PATHS: Readonly<Record<PatchNoteLocale, string>> = Object.freeze({
  ko: "/ko-kr/news/tags/patch-notes/",
  ja: "/ja-jp/news/tags/patch-notes/"
});

export function patchNoteSourceUrl(locale: PatchNoteLocale): string {
  return `${PATCH_NOTES_ORIGIN}${PATCH_NOTE_SOURCE_PATHS[locale]}`;
}

/* 실측 432KB. 3배 여유를 두되 무한정 읽지는 않습니다. */
const MAX_SOURCE_BYTES = 3_000_000;
const SOURCE_TIMEOUT_MS = 15_000;

/* 브라우저 UA 를 쓰지 않으면 Riot CDN 이 403 을 돌려줍니다. */
const SOURCE_USER_AGENT = "Mozilla/5.0 (compatible; YOROggPatchNotes/1.0; +https://yoro.gg)";

export type PatchNotesFetchDeps = {
  fetchImpl?: typeof fetch;
  /** Data Dragon 버전 목록. 없으면 dataDragonVersion 을 비워 둡니다. */
  dataDragonVersions?: readonly string[];
};

async function readBoundedText(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      /* 상한을 넘으면 그 자리에서 끊습니다. 응답 크기를 상대가 정하게 두지 않습니다. */
      if (total > MAX_SOURCE_BYTES) throw new Error("PATCH_NOTES_SOURCE_TOO_LARGE");
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
    await body.cancel().catch(() => undefined);
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

function nextDataPayload(html: string): unknown {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/u.exec(html);
  if (!match?.[1]) return undefined;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 카드 목록 blade 를 찾습니다. 배열 위치는 Riot 이 언제든 바꿀 수 있으므로 type 으로 찾습니다. */
function articleCards(payload: unknown): unknown[] {
  if (!isRecord(payload)) return [];
  const props = isRecord(payload.props) ? payload.props : undefined;
  const pageProps = props && isRecord(props.pageProps) ? props.pageProps : undefined;
  const page = pageProps && isRecord(pageProps.page) ? pageProps.page : undefined;
  const blades = page && Array.isArray(page.blades) ? page.blades : [];
  for (const blade of blades) {
    if (!isRecord(blade) || blade.type !== "articleCardGrid") continue;
    if (Array.isArray(blade.items)) return blade.items;
  }
  return [];
}

/** 요약에 태그가 섞여 들어오면 지웁니다. Riot 은 description.type 을 "html" 로 표기합니다. */
function plainText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.replace(/<[^>]*>/gu, " ");
}

function absoluteUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) return undefined;
  try {
    return new URL(value, PATCH_NOTES_ORIGIN).toString();
  } catch {
    return undefined;
  }
}

function slugFromUrl(url: string): string | undefined {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return segments.at(-1);
  } catch {
    return undefined;
  }
}

export function patchNotesFromSourceHtml(
  html: string,
  dataDragonVersions: readonly string[] = []
): PatchNote[] {
  const notes: PatchNote[] = [];
  const seen = new Set<string>();

  for (const card of articleCards(nextDataPayload(html))) {
    if (notes.length >= PATCH_NOTES_MAX_ITEMS) break;
    if (!isRecord(card)) continue;

    const action = isRecord(card.action) ? card.action : undefined;
    const payload = action && isRecord(action.payload) ? action.payload : undefined;
    const url = action?.type === "weblink" ? absoluteUrl(payload?.url) : undefined;
    if (!url) continue;
    const slug = slugFromUrl(url);
    if (!slug) continue;

    const title = typeof card.title === "string" ? card.title : "";
    const patchVersion = patchVersionFromTitle(title);
    const media = isRecord(card.imageMedia) ? card.imageMedia : undefined;
    /* Riot 이 썸네일에서 뽑아 함께 주는 대표 색입니다. 우리가 계산하지 않습니다. */
    const mediaColors = media && isRecord(media.colors) ? media.colors : undefined;
    const description = isRecord(card.description) ? card.description : undefined;
    /* 요약이 비면 키 자체를 뺍니다. 빈 문자열을 넘기면 카드가 통째로 버려집니다. */
    const summary = plainText(description?.body)?.replace(/\s+/gu, " ").trim();

    /* 형식을 벗어난 카드는 통째로 버립니다. 절반만 채워 넣지 않습니다. */
    const note = parsePatchNote({
      slug,
      title,
      ...(summary ? { summary } : {}),
      publishedAt: card.publishedAt,
      ...(patchVersion ? { patchVersion } : {}),
      ...(patchVersion
        ? { dataDragonVersion: dataDragonVersionForPatch(patchVersion, dataDragonVersions) }
        : {}),
      url,
      ...(media && typeof media.url === "string" ? { imageUrl: media.url } : {}),
      ...(mediaColors && typeof mediaColors.primary === "string" ? { accentColor: mediaColors.primary } : {})
    });
    if (!note || seen.has(note.slug)) continue;
    seen.add(note.slug);
    notes.push(note);
  }

  return notes;
}

export async function fetchPatchNotes(
  locale: PatchNoteLocale,
  deps: PatchNotesFetchDeps = {}
): Promise<PatchNote[]> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(patchNoteSourceUrl(locale), {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html",
      "accept-language": locale === "ko" ? "ko-KR" : "ja-JP",
      "user-agent": SOURCE_USER_AGENT
    },
    signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`PATCH_NOTES_SOURCE_STATUS_${response.status}`);

  const notes = patchNotesFromSourceHtml(await readBoundedText(response), deps.dataDragonVersions ?? []);
  /* 0건은 성공이 아니라 파서가 깨진 것입니다. 캐시를 빈 목록으로 덮지 않습니다. */
  if (notes.length === 0) throw new Error("PATCH_NOTES_SOURCE_EMPTY");
  return notes;
}

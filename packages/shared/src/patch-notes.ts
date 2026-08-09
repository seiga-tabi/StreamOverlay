/* 리그 오브 레전드 패치 노트 목록.
 *
 * 원문 본문은 담지 않습니다. Riot 이 목록 페이지에서 이미 제공하는 값
 * (제목·발행일·한 줄 요약·썸네일·원문 링크)만 옮기고 읽기는 원문으로 보냅니다.
 * 본문은 Riot 의 저작물이므로 복제하지 않습니다.
 */

export const PATCH_NOTE_LOCALES = ["ko", "ja"] as const;
export type PatchNoteLocale = (typeof PATCH_NOTE_LOCALES)[number];

export const PATCH_NOTES_MAX_ITEMS = 60;

export type PatchNote = Readonly<{
  /** 안정적인 식별자. 원문 URL 의 마지막 경로 조각을 씁니다. */
  slug: string;
  title: string;
  /** Riot 이 제공하는 한 줄 요약. 없을 수 있습니다. */
  summary?: string;
  /** ISO 8601. */
  publishedAt: string;
  /** "26.15" 처럼 제목에서 뽑아낸 패치 번호. 못 찾으면 생략합니다. */
  patchVersion?: string;
  /** 같은 패치의 Data Dragon 버전. 마이너 번호로 이어집니다. */
  dataDragonVersion?: string;
  url: string;
  imageUrl?: string;
  /**
   * 썸네일에서 뽑은 대표 색(`#RRGGBB`).
   *
   * Riot 이 목록 응답의 `imageMedia.colors.primary` 로 이미 함께 주는 값입니다.
   * 우리가 계산하거나 지어내지 않습니다. 화면은 이 값을 CSS custom property 로
   * 흘려보내므로 형식을 벗어난 문자열은 여기서 막아야 합니다.
   */
  accentColor?: string;
}>;

export type PatchNotesFeed = Readonly<{
  schemaVersion: 1;
  locale: PatchNoteLocale;
  /** 마지막으로 성공한 수집 시각. 캐시본을 보여 줄 때 화면이 이 값을 씁니다. */
  fetchedAt: string;
  /** 최신 수집이 실패해 저장본을 돌려주는 중이면 true 입니다. */
  stale: boolean;
  notes: readonly PatchNote[];
}>;

const MAX_TITLE = 200;
const MAX_SUMMARY = 400;
const MAX_SLUG = 160;
const MAX_URL = 400;
/* CSS 값으로 그대로 들어가므로 6자리 hex 만 허용합니다. */
const HEX_COLOR = /^#[0-9a-f]{6}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > maxLength) return undefined;
  /* 제어문자는 저장하지 않습니다. 외부에서 온 문자열입니다. */
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized;
}

/** Riot 도메인의 https 링크만 허용합니다. 임의 URL 을 화면에 싣지 않습니다. */
export function isPatchNoteUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_URL) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:"
    && (url.hostname === "www.leagueoflegends.com" || url.hostname === "leagueoflegends.com")
    && !url.username
    && !url.password;
}

/** 썸네일은 Riot CMS 호스트만 허용합니다. */
export function isPatchNoteImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_URL) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:"
    && (url.hostname === "cmsassets.rgpub.io" || url.hostname.endsWith(".rgpub.io"))
    && !url.username
    && !url.password;
}

/**
 * 제목에서 패치 번호를 뽑습니다. "리그 오브 레전드 26.15 패치 노트" → "26.15".
 * 못 찾으면 undefined 입니다 — 추측하지 않습니다.
 */
export function patchVersionFromTitle(title: string): string | undefined {
  const match = /(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/u.exec(title);
  if (!match) return undefined;
  return `${match[1]}.${match[2]}`;
}

/**
 * 패치 번호에 대응하는 Data Dragon 버전을 고릅니다.
 *
 * 실측(2026-08-09): 패치 26.15 ↔ ddragon 16.15.1, 26.14 ↔ 16.14.1.
 * 메이저가 다르고 마이너가 같으므로 마이너로 맞춥니다. 전체 문자열로 비교하면
 * 아무것도 매칭되지 않습니다.
 */
export function dataDragonVersionForPatch(
  patchVersion: string,
  versions: readonly string[]
): string | undefined {
  const parts = patchVersion.split(".");
  if (parts.length !== 2) return undefined;
  const minor = Number(parts[1]);
  if (!Number.isInteger(minor)) return undefined;
  return versions.find((version) => {
    const segments = version.split(".");
    return segments.length >= 2 && Number(segments[1]) === minor;
  });
}

export function parsePatchNote(value: unknown): PatchNote | undefined {
  if (!isRecord(value)) return undefined;
  const slug = safeText(value.slug, MAX_SLUG);
  const title = safeText(value.title, MAX_TITLE);
  const publishedAt = typeof value.publishedAt === "string" ? value.publishedAt : "";
  if (
    !slug
    || !/^[a-z0-9-]+$/u.test(slug)
    || !title
    || !Number.isFinite(Date.parse(publishedAt))
    || !isPatchNoteUrl(value.url)
  ) return undefined;

  const summary = value.summary === undefined ? undefined : safeText(value.summary, MAX_SUMMARY);
  if (value.summary !== undefined && !summary) return undefined;
  const patchVersion = value.patchVersion === undefined
    ? undefined
    : safeText(value.patchVersion, 12);
  if (value.patchVersion !== undefined && (!patchVersion || !/^\d{1,2}\.\d{1,2}$/u.test(patchVersion))) {
    return undefined;
  }
  const dataDragonVersion = value.dataDragonVersion === undefined
    ? undefined
    : safeText(value.dataDragonVersion, 20);
  if (
    value.dataDragonVersion !== undefined
    && (!dataDragonVersion || !/^\d{1,3}(?:\.\d{1,3}){1,3}$/u.test(dataDragonVersion))
  ) return undefined;
  if (value.imageUrl !== undefined && !isPatchNoteImageUrl(value.imageUrl)) return undefined;
  if (value.accentColor !== undefined && (typeof value.accentColor !== "string" || !HEX_COLOR.test(value.accentColor))) {
    return undefined;
  }

  return Object.freeze({
    slug,
    title,
    ...(summary ? { summary } : {}),
    publishedAt: new Date(publishedAt).toISOString(),
    ...(patchVersion ? { patchVersion } : {}),
    ...(dataDragonVersion ? { dataDragonVersion } : {}),
    url: value.url,
    ...(value.imageUrl === undefined ? {} : { imageUrl: value.imageUrl as string }),
    ...(value.accentColor === undefined ? {} : { accentColor: (value.accentColor as string).toLowerCase() })
  });
}

export function parsePatchNotesFeed(value: unknown): PatchNotesFeed | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "fetchedAt,locale,notes,schemaVersion,stale") return undefined;
  if (
    value.schemaVersion !== 1
    || typeof value.locale !== "string"
    || !(PATCH_NOTE_LOCALES as readonly string[]).includes(value.locale)
    || typeof value.fetchedAt !== "string"
    || !Number.isFinite(Date.parse(value.fetchedAt))
    || typeof value.stale !== "boolean"
    || !Array.isArray(value.notes)
    || value.notes.length > PATCH_NOTES_MAX_ITEMS
  ) return undefined;

  const notes: PatchNote[] = [];
  const seen = new Set<string>();
  for (const raw of value.notes) {
    const note = parsePatchNote(raw);
    /* 하나라도 형식을 벗어나면 목록 전체를 버립니다. 절반만 보여 주지 않습니다. */
    if (!note || seen.has(note.slug)) return undefined;
    seen.add(note.slug);
    notes.push(note);
  }

  return Object.freeze({
    schemaVersion: 1,
    locale: value.locale as PatchNoteLocale,
    fetchedAt: new Date(value.fetchedAt).toISOString(),
    stale: value.stale,
    notes: Object.freeze(notes)
  });
}

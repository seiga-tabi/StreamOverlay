import {
  validateMinecraftPatchEntry,
  type MinecraftPatchEntry,
  type MinecraftPatchType
} from "@streamops/shared";
import {
  MINECRAFT_JAVA_PATCH_NOTES_HUB_URL,
  MINECRAFT_PATCH_SOURCE_USER_AGENT
} from "./minecraft-patch-notes-source.js";

/**
 * 2026-08-15에 공식 category/section API로 이름과 소속을 확인한 고정 섹션입니다.
 * https://feedback.minecraft.net/api/v2/help_center/en-us/sections.json?per_page=100
 */
export const MINECRAFT_FEEDBACK_SECTION_IDS = Object.freeze({
  release: 360001186971,
  bedrockPreview: 360001185332,
  javaSnapshot: 360002267532
} as const);

const FEEDBACK_API_ORIGIN = "https://feedback.minecraft.net";
const FEEDBACK_PER_PAGE = 100;
const FEEDBACK_MAX_PAGES = 10;
const FEEDBACK_MAX_ARTICLES = 1_000;
const FEEDBACK_MAX_PAGE_BYTES = 8 * 1024 * 1024;
const SOURCE_TIMEOUT_MS = 10_000;
const SOURCE_MAX_ATTEMPTS = 3;
const SOURCE_RETRY_DELAY_MS = 250;
const VERSION_PATTERN = /^[0-9][0-9a-zA-Z._-]{0,31}$/u;
const VERSION_TOKEN_PATTERN = /^[0-9][0-9a-zA-Z._-]{0,31}(?:\/[0-9a-zA-Z_-]{1,16}){0,4}$/u;
const TITLE_PATTERN_TEXT = "[^\\u0000-\\u001f\\u007f]{1,300}";

export type MinecraftFeedbackSectionId =
  (typeof MINECRAFT_FEEDBACK_SECTION_IDS)[keyof typeof MINECRAFT_FEEDBACK_SECTION_IDS];

export type MinecraftFeedbackArticle = Readonly<{
  id: number;
  sectionId: MinecraftFeedbackSectionId;
  title: string;
  createdAt: string;
  htmlUrl: string;
}>;

export type MinecraftJavaOfficialUrlResult = Readonly<{
  entries: readonly MinecraftPatchEntry[];
  matched: number;
  fallback: number;
}>;

type FetchMinecraftFeedbackDeps = {
  fetchImpl?: typeof fetch;
  sleepImpl?: (delayMs: number) => Promise<void>;
  timeoutMs?: number;
  maxAttempts?: number;
  maxPages?: number;
};

export class MinecraftFeedbackSourceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MinecraftFeedbackSourceError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function officialFeedbackArticleUrl(value: unknown, articleId: number): value is string {
  if (typeof value !== "string" || value.length > 2_048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && parsed.hostname === "feedback.minecraft.net"
      && parsed.username === ""
      && parsed.password === ""
      && parsed.port === ""
      && (
        parsed.pathname === `/hc/en-us/articles/${articleId}`
        || parsed.pathname.startsWith(`/hc/en-us/articles/${articleId}-`)
      );
  } catch {
    return false;
  }
}

function feedbackSectionUrl(sectionId: MinecraftFeedbackSectionId, page: number): string {
  const url = new URL(
    `/api/v2/help_center/en-us/sections/${sectionId}/articles.json`,
    FEEDBACK_API_ORIGIN
  );
  url.searchParams.set("sort_by", "created_at");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("per_page", String(FEEDBACK_PER_PAGE));
  url.searchParams.set("page", String(page));
  return url.href;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size < 0 || size > FEEDBACK_MAX_PAGE_BYTES) {
      throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGE_TOO_LARGE");
    }
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_CONTENT_TYPE_INVALID");
  }
  if (!response.body) {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGE_EMPTY");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > FEEDBACK_MAX_PAGE_BYTES) {
        throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGE_TOO_LARGE");
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
    await response.body.cancel().catch(() => undefined);
  }
  chunks.push(decoder.decode());
  try {
    return JSON.parse(chunks.join("")) as unknown;
  } catch {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_JSON_INVALID");
  }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchFeedbackPage(
  sectionId: MinecraftFeedbackSectionId,
  page: number,
  deps: FetchMinecraftFeedbackDeps
): Promise<unknown> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleepImpl = deps.sleepImpl ?? defaultSleep;
  const timeoutMs = Math.min(Math.max(1, deps.timeoutMs ?? SOURCE_TIMEOUT_MS), SOURCE_TIMEOUT_MS);
  const maxAttempts = Math.min(
    Math.max(1, deps.maxAttempts ?? SOURCE_MAX_ATTEMPTS),
    SOURCE_MAX_ATTEMPTS
  );
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(feedbackSectionUrl(sectionId, page), {
        method: "GET",
        redirect: "error",
        headers: {
          accept: "application/json",
          "user-agent": MINECRAFT_PATCH_SOURCE_USER_AGENT
        },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= maxAttempts) break;
      await sleepImpl(SOURCE_RETRY_DELAY_MS * (2 ** attempt));
      continue;
    }

    if (!response.ok) {
      lastError = new MinecraftFeedbackSourceError(`MINECRAFT_FEEDBACK_STATUS_${response.status}`);
      await response.body?.cancel().catch(() => undefined);
      if (!retryableStatus(response.status) || attempt + 1 >= maxAttempts) throw lastError;
      await sleepImpl(SOURCE_RETRY_DELAY_MS * (2 ** attempt));
      continue;
    }
    return readBoundedJson(response);
  }

  if (lastError instanceof MinecraftFeedbackSourceError) throw lastError;
  throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_REQUEST_FAILED");
}

type ParsedFeedbackPage = Readonly<{
  count: number;
  pageCount: number;
  articles: readonly MinecraftFeedbackArticle[];
}>;

function parseFeedbackPage(
  value: unknown,
  sectionId: MinecraftFeedbackSectionId,
  expectedPage: number
): ParsedFeedbackPage {
  if (!isRecord(value)) {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGE_INVALID");
  }
  const expectedKeys = [
    "articles", "count", "next_page", "page", "page_count", "per_page",
    "previous_page", "sort_by", "sort_order"
  ];
  if (
    Object.keys(value).some((key) => !expectedKeys.includes(key))
    || !Array.isArray(value.articles)
    || value.articles.length > FEEDBACK_PER_PAGE
    || !Number.isSafeInteger(value.count)
    || (value.count as number) < 1
    || (value.count as number) > FEEDBACK_MAX_ARTICLES
    || value.page !== expectedPage
    || !Number.isSafeInteger(value.page_count)
    || (value.page_count as number) < 1
    || (value.page_count as number) > FEEDBACK_MAX_PAGES
    || value.per_page !== FEEDBACK_PER_PAGE
    || value.sort_by !== "created_at"
    || value.sort_order !== "desc"
    || (expectedPage < (value.page_count as number)
      ? typeof value.next_page !== "string"
      : value.next_page !== null)
  ) throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGE_INVALID");

  const articles: MinecraftFeedbackArticle[] = value.articles.map((candidate) => {
    if (
      !isRecord(candidate)
      || !Number.isSafeInteger(candidate.id)
      || (candidate.id as number) < 1
      || candidate.section_id !== sectionId
      || candidate.locale !== "en-us"
      || candidate.draft !== false
      || typeof candidate.title !== "string"
      || candidate.title.length < 1
      || candidate.title.length > 300
      || /[\u0000-\u001f\u007f]/u.test(candidate.title)
    ) throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_ARTICLE_INVALID");
    const createdAt = canonicalIsoDate(candidate.created_at);
    if (!createdAt || !officialFeedbackArticleUrl(candidate.html_url, candidate.id as number)) {
      throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_ARTICLE_INVALID");
    }
    return {
      id: candidate.id as number,
      sectionId,
      title: candidate.title,
      createdAt,
      htmlUrl: candidate.html_url as string
    };
  });
  return {
    count: value.count as number,
    pageCount: value.page_count as number,
    articles
  };
}

export async function fetchMinecraftFeedbackSectionArticles(
  sectionId: MinecraftFeedbackSectionId,
  deps: FetchMinecraftFeedbackDeps = {}
): Promise<MinecraftFeedbackArticle[]> {
  if (!Object.values(MINECRAFT_FEEDBACK_SECTION_IDS).includes(sectionId)) {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_SECTION_INVALID");
  }
  const maximumPages = Math.min(
    Math.max(1, deps.maxPages ?? FEEDBACK_MAX_PAGES),
    FEEDBACK_MAX_PAGES
  );
  const first = parseFeedbackPage(await fetchFeedbackPage(sectionId, 1, deps), sectionId, 1);
  if (first.pageCount > maximumPages) {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGE_LIMIT_EXCEEDED");
  }
  const articles = [...first.articles];
  for (let page = 2; page <= first.pageCount; page += 1) {
    const current = parseFeedbackPage(await fetchFeedbackPage(sectionId, page, deps), sectionId, page);
    if (current.count !== first.count || current.pageCount !== first.pageCount) {
      throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_PAGINATION_CHANGED");
    }
    articles.push(...current.articles);
  }
  if (articles.length !== first.count || new Set(articles.map((article) => article.id)).size !== articles.length) {
    throw new MinecraftFeedbackSourceError("MINECRAFT_FEEDBACK_ARTICLE_COUNT_INVALID");
  }
  return articles;
}

function expandVersionToken(token: string): string[] {
  if (!VERSION_TOKEN_PATTERN.test(token)) return [];
  const [first, ...suffixes] = token.split("/");
  if (!first || !VERSION_PATTERN.test(first)) return [];
  if (suffixes.length === 0) return [first];
  const separator = first.lastIndexOf(".");
  if (separator < 1) return [];
  const prefix = first.slice(0, separator + 1);
  const versions = [first, ...suffixes.map((suffix) => `${prefix}${suffix}`)];
  return versions.every((version) => VERSION_PATTERN.test(version))
    && new Set(versions).size === versions.length
    ? versions
    : [];
}

const BEDROCK_RELEASE_PATTERNS = [
  new RegExp(`^Minecraft - (${VERSION_TOKEN_PATTERN.source.slice(1, -1)}) \\(Bedrock\\)$`, "u"),
  new RegExp(
    `^Minecraft:? Bedrock Edition(?: -)? (${VERSION_TOKEN_PATTERN.source.slice(1, -1)})`
      + `(?: Hotfix)?(?: Changelog)?(?: - ${TITLE_PATTERN_TEXT})?$`,
    "u"
  )
] as const;
const BEDROCK_PREVIEW_PATTERN = new RegExp(
  `^Minecraft Beta & Preview - (${VERSION_TOKEN_PATTERN.source.slice(1, -1)})$`,
  "u"
);
const JAVA_RELEASE_PATTERN = new RegExp(
  `^Minecraft:? Java Edition(?: -)? (${VERSION_PATTERN.source.slice(1, -1)})`
    + `(?: Hotfix)?(?: - ${TITLE_PATTERN_TEXT})?$`,
  "u"
);
const JAVA_NUMBERED_SNAPSHOT_PATTERN = new RegExp(
  `^Minecraft:? Java Edition(?: -)? (${VERSION_PATTERN.source.slice(1, -1)}) Snapshot ([0-9]{1,3})$`,
  "u"
);
const JAVA_WEEKLY_SNAPSHOT_PATTERN =
  /^Minecraft:? Java Edition(?: -)? Snapshot ([0-9]{2}w[0-9]{2})([a-z](?:\+[a-z])*)$/u;
const JAVA_PRE_RELEASE_PATTERN = new RegExp(
  `^Minecraft:? Java Edition(?: -)? (${VERSION_PATTERN.source.slice(1, -1)}) Pre-Release ([0-9]{1,3})$`,
  "u"
);
const JAVA_RELEASE_CANDIDATE_PATTERN = new RegExp(
  `^Minecraft:? Java Edition(?: -)? (${VERSION_PATTERN.source.slice(1, -1)}) Release Candidate ([0-9]{1,3})$`,
  "u"
);

export function bedrockVersionsFromFeedbackTitle(
  title: string,
  type: Extract<MinecraftPatchType, "release" | "preview">
): string[] {
  const patterns = type === "preview" ? [BEDROCK_PREVIEW_PATTERN] : BEDROCK_RELEASE_PATTERNS;
  for (const pattern of patterns) {
    const match = pattern.exec(title);
    if (match?.[1]) return expandVersionToken(match[1]);
  }
  return [];
}

export function javaVersionsFromFeedbackTitle(title: string): string[] {
  const release = JAVA_RELEASE_PATTERN.exec(title);
  if (release?.[1] && VERSION_PATTERN.test(release[1])) return [release[1]];

  const numbered = JAVA_NUMBERED_SNAPSHOT_PATTERN.exec(title);
  if (numbered?.[1] && numbered[2]) {
    const version = `${numbered[1]}-snapshot-${numbered[2]}`;
    return VERSION_PATTERN.test(version) ? [version] : [];
  }
  const weekly = JAVA_WEEKLY_SNAPSHOT_PATTERN.exec(title);
  if (weekly?.[1] && weekly[2]) {
    const versions = weekly[2].split("+").map((suffix) => `${weekly[1]}${suffix}`);
    return versions.every((version) => VERSION_PATTERN.test(version)) ? versions : [];
  }
  const preRelease = JAVA_PRE_RELEASE_PATTERN.exec(title);
  if (preRelease?.[1] && preRelease[2]) {
    const version = `${preRelease[1]}-pre${preRelease[2]}`;
    return VERSION_PATTERN.test(version) ? [version] : [];
  }
  const releaseCandidate = JAVA_RELEASE_CANDIDATE_PATTERN.exec(title);
  if (releaseCandidate?.[1] && releaseCandidate[2]) {
    const version = `${releaseCandidate[1]}-rc${releaseCandidate[2]}`;
    return VERSION_PATTERN.test(version) ? [version] : [];
  }
  return [];
}

export function minecraftBedrockPatchEntriesFromArticles(
  releaseArticles: readonly MinecraftFeedbackArticle[],
  previewArticles: readonly MinecraftFeedbackArticle[]
): MinecraftPatchEntry[] {
  const byId = new Map<string, MinecraftPatchEntry>();
  for (const [type, articles] of [
    ["release", releaseArticles],
    ["preview", previewArticles]
  ] as const) {
    for (const article of articles) {
      for (const version of bedrockVersionsFromFeedbackTitle(article.title, type)) {
        const entry: MinecraftPatchEntry = {
          id: `bedrock-${version.toLowerCase()}`,
          edition: "bedrock",
          version,
          type,
          publishedAt: article.createdAt,
          officialUrl: article.htmlUrl
        };
        if (!validateMinecraftPatchEntry(entry).ok) continue;
        const existing = byId.get(entry.id);
        if (!existing || Date.parse(entry.publishedAt) > Date.parse(existing.publishedAt)) {
          byId.set(entry.id, entry);
        }
      }
    }
  }
  return [...byId.values()].sort((left, right) => (
    Date.parse(right.publishedAt) - Date.parse(left.publishedAt)
    || left.id.localeCompare(right.id)
  ));
}

export function applyMinecraftJavaOfficialUrls(
  entries: readonly MinecraftPatchEntry[],
  articles: readonly MinecraftFeedbackArticle[]
): MinecraftJavaOfficialUrlResult {
  const urls = new Map<string, { createdAt: string; htmlUrl: string }>();
  for (const article of articles) {
    for (const version of javaVersionsFromFeedbackTitle(article.title)) {
      const existing = urls.get(version.toLowerCase());
      if (!existing || Date.parse(article.createdAt) > Date.parse(existing.createdAt)) {
        urls.set(version.toLowerCase(), { createdAt: article.createdAt, htmlUrl: article.htmlUrl });
      }
    }
  }
  let matched = 0;
  const enhanced = entries.map((entry) => {
    const match = urls.get(entry.version.toLowerCase());
    if (!match) return entry;
    matched += 1;
    return { ...entry, officialUrl: match.htmlUrl };
  });
  return {
    entries: enhanced,
    matched,
    fallback: enhanced.length - matched
  };
}

export function minecraftJavaFallbackOnly(
  entries: readonly MinecraftPatchEntry[]
): MinecraftJavaOfficialUrlResult {
  return {
    entries: entries.map((entry) => ({
      ...entry,
      officialUrl: MINECRAFT_JAVA_PATCH_NOTES_HUB_URL
    })),
    matched: 0,
    fallback: entries.length
  };
}

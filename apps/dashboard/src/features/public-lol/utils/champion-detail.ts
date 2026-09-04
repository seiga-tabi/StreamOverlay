import { activePublicLocale } from "../i18n/public-lol-i18n";

/* 챔피언 상세(스킬·기본 스탯) 표시 규칙 — 목업
 * `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §02·§04·§11.
 *
 * 서버는 배열 원본과 ko/ja/en 원문만 보냅니다. 슬래시 접기와 단위(초/秒/s)는
 * 화면 책임입니다 — 서버가 문자열로 접어 보내면 언어별 단위가 서버에 들어갑니다. */

/** ko/ja/en 3언어 필드에서 화면 언어를 고릅니다. 비면 다른 언어로 떨어집니다. */
export function localizedChampionText(values: {
  ko?: string;
  ja?: string;
  en?: string;
}): string | undefined {
  if (activePublicLocale === "ja") return values.ja ?? values.ko ?? values.en;
  if (activePublicLocale === "en") return values.en ?? values.ko ?? values.ja;
  return values.ko ?? values.en ?? values.ja;
}

/** 부동소수 잔값(0.6000000000000001)을 화면에 흘리지 않습니다. */
export function formatChampionNumber(value: number): string {
  return String(Math.round(value * 1_000) / 1_000);
}

/**
 * 레벨별 배열을 화면 표기로 접습니다.
 *
 * 전부 같으면 한 값("7"), 다르면 슬래시("9/8/7/6/5"). 같은 값을 5번 반복하면
 * 읽는 사람이 "레벨마다 다르다"고 오해합니다(목업 §02).
 */
export function foldLevelValues(values: readonly number[]): string | undefined {
  const [first] = values;
  if (first === undefined) return undefined;
  if (values.every((value) => value === first)) return formatChampionNumber(first);
  return values.map(formatChampionNumber).join("/");
}

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'"
};

/**
 * Data Dragon description 을 줄 배열로 바꿉니다.
 *
 * 원문에는 `<br>` 같은 태그가 섞여 있지만 **HTML 로 렌더하지 않습니다** — 외부
 * 응답을 innerHTML 로 넣지 않는다는 규칙(AI_WORKFLOW §5)이 우선입니다. 줄바꿈만
 * 살리고 나머지 태그는 걷어낸 뒤 React 가 텍스트로 그립니다.
 */
export function championDescriptionLines(description: string | undefined): string[] {
  if (!description) return [];
  const plain = description
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]*>/gu, "")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/gu, (entity) => HTML_ENTITIES[entity] ?? entity);
  return plain
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function fillChampionText(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template
  );
}

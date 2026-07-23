import { createHash } from "node:crypto";
import type { PalworldPakArchiveReader } from "./palworld-pak-preflight.js";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const PLACEHOLDER_PATTERN = /^(?:-|(?:ko|ja|en)[ _]Text)$/iu;
const MESSAGE_KEY_PATTERN = /^[A-Za-z0-9_]+$/u;
const MAX_LOCALIZED_TEXT_LENGTH = 32_768;

type JsonRecord = Record<string, unknown>;

export const PALWORLD_PAK_OFFICIAL_LOCALES = ["ko", "ja", "en"] as const;
export type PalworldPakOfficialLocale = (typeof PALWORLD_PAK_OFFICIAL_LOCALES)[number];
export type PalworldPakLocaleField =
  | "pal_name"
  | "pal_description"
  | "pal_first_activated"
  | "item_name"
  | "item_description"
  | "skill_name"
  | "skill_description"
  | "partner_append"
  | "ui_common"
  | "map_object_name";

export type PalworldPakOfficialTextRecord = {
  messageKey: string;
  field: PalworldPakLocaleField;
  text: string;
  valueSha256: string;
  status: "source_provided";
  sourceMember: string;
  sourceMemberSha256: string;
};

export type PalworldPakOfficialLocaleCandidate = {
  schemaVersion: 1;
  locale: PalworldPakOfficialLocale;
  status: "source_provided" | "missing";
  sourceArchiveSha256: string;
  languageVerified: boolean;
  records: PalworldPakOfficialTextRecord[];
  coverage: {
    inputRows: number;
    includedRows: number;
    placeholderRows: number;
    invalidRows: number;
    duplicateMessageKeys: number;
  };
};

type LocaleTable = {
  field: PalworldPakLocaleField;
  relativeMember: string;
};

const LOCALE_TABLES: readonly LocaleTable[] = [
  { field: "pal_name", relativeMember: "Pal/DataTable/Text/DT_PalNameText_Common.json" },
  { field: "pal_description", relativeMember: "Pal/DataTable/Text/DT_PalLongDescriptionText.json" },
  { field: "pal_first_activated", relativeMember: "Pal/DataTable/Text/DT_PalFirstActivatedInfoText.json" },
  { field: "item_name", relativeMember: "Pal/DataTable/Text/DT_ItemNameText_Common.json" },
  { field: "item_description", relativeMember: "Pal/DataTable/Text/DT_ItemDescriptionText_Common.json" },
  { field: "skill_name", relativeMember: "Pal/DataTable/Text/DT_SkillNameText_Common.json" },
  { field: "skill_description", relativeMember: "Pal/DataTable/Text/DT_SkillDescText_Common.json" },
  { field: "partner_append", relativeMember: "Pal/DataTable/Text/DT_PartnerSkillAppendText.json" },
  { field: "ui_common", relativeMember: "Pal/DataTable/Text/DT_UI_Common_Text_Common.json" },
  { field: "map_object_name", relativeMember: "Pal/DataTable/Text/DT_MapObjectNameText_Common.json" }
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sha256(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isPalworldPakPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return true;
  const normalized = value.trim();
  return normalized.length === 0 || PLACEHOLDER_PATTERN.test(normalized);
}

function normalizedLocalizedText(row: unknown): string | undefined {
  if (!isRecord(row) || !isRecord(row.TextData)) return undefined;
  const textData = row.TextData;
  const allowedTextDataKeys = new Set(["Namespace", "Key", "SourceString", "LocalizedString"]);
  if (Object.keys(textData).some((key) => !allowedTextDataKeys.has(key))) return undefined;
  const candidate = typeof textData.LocalizedString === "string"
    ? textData.LocalizedString
    : typeof textData.SourceString === "string"
      ? textData.SourceString
      : undefined;
  if (typeof candidate !== "string" || isPalworldPakPlaceholder(candidate)) return undefined;
  const normalized = candidate.replace(/\r\n?/gu, "\n").trim();
  if (
    normalized.length > MAX_LOCALIZED_TEXT_LENGTH
    || CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function localeMember(locale: PalworldPakOfficialLocale, relativeMember: string): string {
  if (locale === "ja") return relativeMember;
  return `L10N/${locale}/${relativeMember}`;
}

function languageVerified(locale: PalworldPakOfficialLocale, records: readonly PalworldPakOfficialTextRecord[]): boolean {
  if (records.length === 0) return false;
  const pattern = locale === "ko"
    ? /[\uac00-\ud7a3]/u
    : locale === "ja"
      ? /[\u3040-\u30ff\u3400-\u9fff]/u
      : /[A-Za-z]/u;
  const sampled = records.filter((record) => record.field === "pal_name");
  const values = sampled.length > 0 ? sampled : records;
  return values.filter((record) => pattern.test(record.text)).length / values.length >= 0.9;
}

export async function readPalworldPakOfficialLocale(
  reader: PalworldPakArchiveReader,
  locale: PalworldPakOfficialLocale
): Promise<PalworldPakOfficialLocaleCandidate> {
  const records: PalworldPakOfficialTextRecord[] = [];
  const seen = new Map<string, string>();
  let inputRows = 0;
  let placeholderRows = 0;
  let invalidRows = 0;
  let duplicateMessageKeys = 0;
  let presentTables = 0;

  for (const table of LOCALE_TABLES) {
    const member = localeMember(locale, table.relativeMember);
    if (!reader.has(member)) continue;
    presentTables += 1;
    const memberBytes = await reader.readBytes(member);
    const memberSha256 = sha256(memberBytes);
    let parsed: unknown;
    try {
      parsed = JSON.parse(memberBytes.toString("utf8")) as unknown;
    } catch {
      throw new Error(`${member}: locale JSON을 파싱할 수 없습니다.`);
    }
    if (!Array.isArray(parsed)) throw new Error(`${member}: FModel locale JSON 최상위 값은 배열이어야 합니다.`);
    const dataTable = parsed.find((entry) => isRecord(entry) && isRecord(entry.Rows));
    if (!isRecord(dataTable) || !isRecord(dataTable.Rows)) {
      throw new Error(`${member}: DataTable Rows를 찾을 수 없습니다.`);
    }
    for (const [messageKey, row] of Object.entries(dataTable.Rows)) {
      inputRows += 1;
      if (!MESSAGE_KEY_PATTERN.test(messageKey)) {
        invalidRows += 1;
        continue;
      }
      const text = normalizedLocalizedText(row);
      if (text === undefined) {
        if (
          isRecord(row)
          && isRecord(row.TextData)
          && (
            isPalworldPakPlaceholder(row.TextData.LocalizedString)
            || isPalworldPakPlaceholder(row.TextData.SourceString)
          )
        ) {
          placeholderRows += 1;
        } else {
          invalidRows += 1;
        }
        continue;
      }
      const collisionKey = `${table.field}:${messageKey}`;
      const previous = seen.get(collisionKey);
      if (previous !== undefined) {
        duplicateMessageKeys += 1;
        if (previous !== text) {
          throw new Error(`${collisionKey}: 공식 locale message key가 서로 다른 값으로 중복됩니다.`);
        }
        continue;
      }
      seen.set(collisionKey, text);
      records.push({
        messageKey,
        field: table.field,
        text,
        valueSha256: sha256(text),
        status: "source_provided",
        sourceMember: member,
        sourceMemberSha256: memberSha256
      });
    }
  }

  records.sort((left, right) =>
    left.field.localeCompare(right.field, "en")
    || left.messageKey.localeCompare(right.messageKey, "en")
  );
  const status = presentTables === 0 ? "missing" : "source_provided";
  return {
    schemaVersion: 1,
    locale,
    status,
    sourceArchiveSha256: reader.archiveSha256,
    languageVerified: status === "source_provided" && languageVerified(locale, records),
    records,
    coverage: {
      inputRows,
      includedRows: records.length,
      placeholderRows,
      invalidRows,
      duplicateMessageKeys
    }
  };
}

export function officialLocaleLookup(
  candidate: PalworldPakOfficialLocaleCandidate,
  field: PalworldPakLocaleField
): ReadonlyMap<string, PalworldPakOfficialTextRecord> {
  return new Map(
    candidate.records
      .filter((record) => record.field === field)
      .map((record) => [record.messageKey, record])
  );
}

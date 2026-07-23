const MAX_INPUT_CHARACTERS = 32_768;
const MAX_LOOKUP_CHARACTERS = 8_192;
const MAX_OUTPUT_CHARACTERS = 65_536;
const MAX_TOKEN_COUNT = 4_096;
const MAX_UNRESOLVED_COUNT = 1_024;
const MAX_STYLE_DEPTH = 8;
const MAX_REFERENCE_DEPTH = 8;
const MAX_MARKUP_CHARACTERS = 512;
const MAX_IDENTIFIER_CHARACTERS = 128;

const UNSAFE_CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const ATTRIBUTE_PATTERN = /([A-Za-z][A-Za-z0-9_]*)=\|([^|<>\r\n]*)\|/gu;
const RAW_MARKUP_PATTERN = /[<>{}]/u;
const FMODEL_PIPE_WRAPPED_SELF_CLOSING_TAG_PATTERN =
  /\|(<(?:characterName|itemName|activeSkillName|uiCommon|mapObjectName|mapObjectname|MapObjectName|img)\s+[^<>\r\n]*\/>)\|/gu;

const PLACEHOLDER_VALUES = new Set([
  "-",
  "ko_Text",
  "ja_Text",
  "en_Text",
  "en Text"
]);

const DEFAULT_STYLE_NAMES = new Set([
  "BlueGreen_13",
  "Blue_16",
  "DeathAnnounce_Guild",
  "Effect_Burn",
  "Effect_Darkness",
  "Effect_Electrical",
  "Effect_Freeze",
  "Effect_IvyCling",
  "Effect_Muddy",
  "Effect_Poison",
  "Effect_Stun",
  "Effect_Wetness",
  "Elem_Dark",
  "Elem_Dragon",
  "Elem_Electric",
  "Elem_Fire",
  "Elem_Grass",
  "Elem_Ground",
  "Elem_Ice",
  "Elem_Neutral",
  "Elem_Water",
  "Green_13",
  "NumBlue_13",
  "NumRed_12",
  "NumRed_13",
  "NumRed_20",
  "Purple_13",
  "Red_12",
  "Red_16",
  "Status_Keyword",
  "Status_Up",
  "White_12",
  "White_13",
  "WorldSetting_Hardcore",
  "Yellow_12",
  "Yellow_13B",
  "Yellow_20B"
]);

type PalworldPakReferenceTag =
  | "characterName"
  | "itemName"
  | "activeSkillName"
  | "uiCommon"
  | "mapObjectName"
  | "mapObjectname"
  | "MapObjectName";

export type PalworldPakRichTextReferenceKind =
  | "character"
  | "item"
  | "active_skill"
  | "ui_common"
  | "map_object";

export type PalworldPakRichTextRank = 1 | 2 | 3 | 4 | 5;

export type PalworldPakRichTextRankValue = {
  rank: PalworldPakRichTextRank;
  text: string;
};

export type PalworldPakRichTextLookupValue =
  | string
  | {
    byRank: readonly PalworldPakRichTextRankValue[];
  };

export type PalworldPakRichTextExactLookup = (id: string) => string | undefined;

export type PalworldPakRichTextImageLookupValue = {
  text?: string;
};

export type PalworldPakRichTextResolvers = {
  characterName?: PalworldPakRichTextExactLookup;
  itemName?: PalworldPakRichTextExactLookup;
  activeSkillName?: PalworldPakRichTextExactLookup;
  uiCommon?: PalworldPakRichTextExactLookup;
  mapObjectName?: PalworldPakRichTextExactLookup;
  image?: (
    id: string
  ) => string | PalworldPakRichTextImageLookupValue | undefined;
  referenceMessage?: (id: string) => PalworldPakRichTextLookupValue | undefined;
  rankVariable?: (id: string) => PalworldPakRichTextLookupValue | undefined;
  isAllowedStyle?: (id: string) => boolean;
};

type StyledToken = {
  styles: readonly string[];
};

export type PalworldPakRichTextToken =
  | ({
    type: "text";
    text: string;
  } & StyledToken)
  | ({
    type: "reference";
    referenceKind: PalworldPakRichTextReferenceKind;
    id: string;
    text: string;
  } & StyledToken)
  | ({
    type: "image";
    id: string;
    text: string;
  } & StyledToken)
  | ({
    type: "reference_message";
    id: string;
    text: string;
    tokens: readonly PalworldPakRichTextToken[];
  } & StyledToken)
  | ({
    type: "ranked_reference";
    referenceKind: "reference_message" | "rank_variable";
    id: string;
    text: string;
    values: readonly {
      rank: PalworldPakRichTextRank;
      text: string;
      tokens: readonly PalworldPakRichTextToken[];
    }[];
  } & StyledToken);

export type PalworldPakRichTextUnresolvedCode =
  | "PLACEHOLDER_TEXT"
  | "MALFORMED_TAG"
  | "UNKNOWN_TAG"
  | "UNKNOWN_STYLE"
  | "UNBALANCED_STYLE_CLOSE"
  | "UNCLOSED_STYLE"
  | "MALFORMED_VARIABLE"
  | "UNRESOLVED_REFERENCE"
  | "UNRESOLVED_IMAGE"
  | "UNRESOLVED_REFERENCE_MESSAGE"
  | "UNRESOLVED_RANK_VARIABLE"
  | "REFERENCE_CYCLE"
  | "INVALID_LOOKUP_VALUE";

export type PalworldPakRichTextUnresolved = {
  code: PalworldPakRichTextUnresolvedCode;
  offset: number;
  token: string;
  id?: string;
};

export type PalworldPakRichTextResult = {
  status: "resolved" | "unresolved" | "placeholder";
  text: string;
  tokens: readonly PalworldPakRichTextToken[];
  unresolved: readonly PalworldPakRichTextUnresolved[];
};

export class PalworldPakRichTextError extends Error {
  readonly code = "PALWORLD_PAK_RICH_TEXT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldPakRichTextError";
  }
}

type ParserBudget = {
  tokenCount: number;
  unresolvedCount: number;
  outputCharacters: number;
};

type ParserContext = {
  resolvers: PalworldPakRichTextResolvers;
  budget: ParserBudget;
  referenceDepth: number;
  referenceStack: readonly string[];
};

type ParsedAttributes = {
  id: string;
  style?: string;
};

function fail(message: string): never {
  throw new PalworldPakRichTextError(message);
}

function normalizeInput(value: string, label: string, maxCharacters: number): string {
  if (typeof value !== "string") fail(`${label}: 문자열이어야 합니다.`);
  if (value.length > maxCharacters) fail(`${label}: ${maxCharacters}자를 초과할 수 없습니다.`);
  if (UNSAFE_CONTROL_CHARACTER_PATTERN.test(value)) {
    fail(`${label}: 허용되지 않은 제어 문자가 포함되어 있습니다.`);
  }
  return value
    .replace(/\r\n?/gu, "\n")
    .replace(FMODEL_PIPE_WRAPPED_SELF_CLOSING_TAG_PATTERN, "$1")
    .normalize("NFC");
}

export function isPalworldPakLocalePlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.length === 0 || PLACEHOLDER_VALUES.has(normalized);
}

function safeUnresolvedToken(value: string): string {
  return value.slice(0, MAX_MARKUP_CHARACTERS);
}

function addUnresolved(
  unresolved: PalworldPakRichTextUnresolved[],
  context: ParserContext,
  value: PalworldPakRichTextUnresolved
): void {
  context.budget.unresolvedCount += 1;
  if (context.budget.unresolvedCount > MAX_UNRESOLVED_COUNT) {
    fail(`unresolved token 수가 ${MAX_UNRESOLVED_COUNT}개를 초과했습니다.`);
  }
  unresolved.push({
    ...value,
    token: safeUnresolvedToken(value.token)
  });
}

function sameStyles(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((style, index) => style === right[index]);
}

function appendToken(
  tokens: PalworldPakRichTextToken[],
  context: ParserContext,
  token: PalworldPakRichTextToken
): void {
  if (token.type === "text" && token.text.length === 0) return;
  const previous = tokens.at(-1);
  if (
    token.type === "text"
    && previous?.type === "text"
    && sameStyles(previous.styles, token.styles)
  ) {
    previous.text += token.text;
  } else {
    context.budget.tokenCount += 1;
    if (context.budget.tokenCount > MAX_TOKEN_COUNT) {
      fail(`rich-text token 수가 ${MAX_TOKEN_COUNT}개를 초과했습니다.`);
    }
    tokens.push(token);
  }
  context.budget.outputCharacters += token.text.length;
  if (context.budget.outputCharacters > MAX_OUTPUT_CHARACTERS) {
    fail(`정규화된 rich-text가 ${MAX_OUTPUT_CHARACTERS}자를 초과했습니다.`);
  }
}

function appendPlainText(
  tokens: PalworldPakRichTextToken[],
  context: ParserContext,
  text: string,
  styles: readonly string[]
): void {
  appendToken(tokens, context, {
    type: "text",
    text,
    styles: [...styles]
  });
}

function parseAttributes(source: string): ParsedAttributes | undefined {
  const values = new Map<string, string>();
  let cursor = 0;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const start = match.index;
    if (source.slice(cursor, start).trim().length > 0) return undefined;
    const key = match[1];
    const value = match[2];
    if (key === undefined || value === undefined || values.has(key)) return undefined;
    values.set(key, value);
    cursor = start + match[0].length;
  }
  if (source.slice(cursor).trim().length > 0) return undefined;
  if ([...values.keys()].some((key) => key !== "id" && key !== "style")) return undefined;
  const id = values.get("id");
  if (
    id === undefined
    || id.length === 0
    || id.length > MAX_IDENTIFIER_CHARACTERS
    || !IDENTIFIER_PATTERN.test(id)
  ) {
    return undefined;
  }
  const style = values.get("style");
  if (
    style !== undefined
    && (
      style.length === 0
      || style.length > MAX_IDENTIFIER_CHARACTERS
      || !IDENTIFIER_PATTERN.test(style)
    )
  ) {
    return undefined;
  }
  return style === undefined ? { id } : { id, style };
}

function referenceKindForTag(tag: PalworldPakReferenceTag): PalworldPakRichTextReferenceKind {
  if (tag === "characterName") return "character";
  if (tag === "itemName") return "item";
  if (tag === "activeSkillName") return "active_skill";
  if (tag === "uiCommon") return "ui_common";
  return "map_object";
}

function resolverForTag(
  tag: PalworldPakReferenceTag,
  resolvers: PalworldPakRichTextResolvers
): PalworldPakRichTextExactLookup | undefined {
  if (tag === "characterName") return resolvers.characterName;
  if (tag === "itemName") return resolvers.itemName;
  if (tag === "activeSkillName") return resolvers.activeSkillName;
  if (tag === "uiCommon") return resolvers.uiCommon;
  return resolvers.mapObjectName;
}

function isReferenceTag(value: string): value is PalworldPakReferenceTag {
  return value === "characterName"
    || value === "itemName"
    || value === "activeSkillName"
    || value === "uiCommon"
    || value === "mapObjectName"
    || value === "mapObjectname"
    || value === "MapObjectName";
}

function isAllowedStyle(style: string, resolvers: PalworldPakRichTextResolvers): boolean {
  return DEFAULT_STYLE_NAMES.has(style) || resolvers.isAllowedStyle?.(style) === true;
}

function tokenStyles(
  styles: readonly string[],
  attributeStyle: string | undefined,
  attributeStyleAllowed: boolean
): readonly string[] {
  if (attributeStyle === undefined || !attributeStyleAllowed) {
    return [...styles];
  }
  return [...styles, attributeStyle];
}

function validatePlainLookupValue(
  value: string,
  label: string
): string | undefined {
  const normalized = normalizeInput(value, label, MAX_LOOKUP_CHARACTERS);
  if (isPalworldPakLocalePlaceholder(normalized) || RAW_MARKUP_PATTERN.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function validateImageLookupValue(
  value: string | PalworldPakRichTextImageLookupValue,
  label: string
): string | undefined {
  if (typeof value === "string") return validatePlainLookupValue(value, label);
  if (
    value === null
    || typeof value !== "object"
    || Object.keys(value).some((key) => key !== "text")
    || (value.text !== undefined && typeof value.text !== "string")
  ) {
    return undefined;
  }
  if (value.text === undefined || value.text.length === 0) return "";
  return validatePlainLookupValue(value.text, label);
}

function rankedPlainText(
  values: readonly { rank: PalworldPakRichTextRank; text: string }[]
): string {
  return values.map((value) => `Lv.${value.rank} ${value.text}`).join(" · ");
}

function parseRankedLookup(
  value: { byRank: readonly PalworldPakRichTextRankValue[] },
  context: ParserContext,
  identity: string,
  offset: number,
  unresolved: PalworldPakRichTextUnresolved[]
): {
  text: string;
  values: readonly {
    rank: PalworldPakRichTextRank;
    text: string;
    tokens: readonly PalworldPakRichTextToken[];
  }[];
} | undefined {
  if (!Array.isArray(value.byRank) || value.byRank.length === 0 || value.byRank.length > 5) {
    addUnresolved(unresolved, context, {
      code: "INVALID_LOOKUP_VALUE",
      offset,
      token: identity,
      id: identity
    });
    return undefined;
  }

  const ranks = new Set<number>();
  const normalizedValues: {
    rank: PalworldPakRichTextRank;
    text: string;
    tokens: readonly PalworldPakRichTextToken[];
  }[] = [];
  for (const rankValue of value.byRank) {
    if (
      rankValue === null
      || typeof rankValue !== "object"
      || !Number.isInteger(rankValue.rank)
      || rankValue.rank < 1
      || rankValue.rank > 5
      || ranks.has(rankValue.rank)
      || typeof rankValue.text !== "string"
    ) {
      addUnresolved(unresolved, context, {
        code: "INVALID_LOOKUP_VALUE",
        offset,
        token: identity,
        id: identity
      });
      return undefined;
    }
    ranks.add(rankValue.rank);
    const nested = parseRichText(rankValue.text, {
      ...context,
      referenceDepth: context.referenceDepth + 1,
      referenceStack: [...context.referenceStack, `${identity}:rank:${rankValue.rank}`]
    });
    unresolved.push(...nested.unresolved);
    normalizedValues.push({
      rank: rankValue.rank as PalworldPakRichTextRank,
      text: nested.text,
      tokens: nested.tokens
    });
  }
  normalizedValues.sort((left, right) => left.rank - right.rank);
  return {
    text: rankedPlainText(normalizedValues),
    values: normalizedValues
  };
}

function parseLookupValue(
  value: PalworldPakRichTextLookupValue,
  context: ParserContext,
  identity: string,
  offset: number,
  unresolved: PalworldPakRichTextUnresolved[]
): {
  text: string;
  tokens: readonly PalworldPakRichTextToken[];
} | {
  text: string;
  values: readonly {
    rank: PalworldPakRichTextRank;
    text: string;
    tokens: readonly PalworldPakRichTextToken[];
  }[];
} | undefined {
  if (context.referenceDepth >= MAX_REFERENCE_DEPTH) {
    addUnresolved(unresolved, context, {
      code: "REFERENCE_CYCLE",
      offset,
      token: identity,
      id: identity
    });
    return undefined;
  }
  if (context.referenceStack.includes(identity)) {
    addUnresolved(unresolved, context, {
      code: "REFERENCE_CYCLE",
      offset,
      token: identity,
      id: identity
    });
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = normalizeInput(value, identity, MAX_LOOKUP_CHARACTERS);
    if (isPalworldPakLocalePlaceholder(normalized)) {
      addUnresolved(unresolved, context, {
        code: "INVALID_LOOKUP_VALUE",
        offset,
        token: identity,
        id: identity
      });
      return undefined;
    }
    const nested = parseRichText(normalized, {
      ...context,
      referenceDepth: context.referenceDepth + 1,
      referenceStack: [...context.referenceStack, identity]
    });
    unresolved.push(...nested.unresolved);
    return {
      text: nested.text,
      tokens: nested.tokens
    };
  }
  if (value === null || typeof value !== "object" || !("byRank" in value)) {
    addUnresolved(unresolved, context, {
      code: "INVALID_LOOKUP_VALUE",
      offset,
      token: identity,
      id: identity
    });
    return undefined;
  }
  return parseRankedLookup(value, context, identity, offset, unresolved);
}

function parseRichText(input: string, context: ParserContext): PalworldPakRichTextResult {
  const normalized = normalizeInput(input, "rich-text", MAX_INPUT_CHARACTERS);
  if (isPalworldPakLocalePlaceholder(normalized)) {
    const placeholder: PalworldPakRichTextUnresolved = {
      code: "PLACEHOLDER_TEXT",
      offset: 0,
      token: safeUnresolvedToken(normalized)
    };
    context.budget.unresolvedCount += 1;
    return {
      status: "placeholder",
      text: "",
      tokens: [],
      unresolved: [placeholder]
    };
  }

  const tokens: PalworldPakRichTextToken[] = [];
  const unresolved: PalworldPakRichTextUnresolved[] = [];
  const styles: string[] = [];
  let cursor = 0;
  let plainStart = 0;

  const flushPlain = (end: number): void => {
    if (end > plainStart) {
      appendPlainText(tokens, context, normalized.slice(plainStart, end), styles);
    }
  };

  while (cursor < normalized.length) {
    const character = normalized[cursor];
    if (character !== "<" && character !== "{") {
      cursor += 1;
      continue;
    }

    flushPlain(cursor);
    if (character === "<") {
      const close = normalized.indexOf(">", cursor + 1);
      if (close < 0 || close - cursor + 1 > MAX_MARKUP_CHARACTERS) {
        addUnresolved(unresolved, context, {
          code: "MALFORMED_TAG",
          offset: cursor,
          token: normalized.slice(cursor, Math.min(normalized.length, cursor + MAX_MARKUP_CHARACTERS))
        });
        cursor += 1;
        plainStart = cursor;
        continue;
      }
      const markup = normalized.slice(cursor, close + 1);
      if (markup === "</>") {
        if (styles.length === 0) {
          addUnresolved(unresolved, context, {
            code: "UNBALANCED_STYLE_CLOSE",
            offset: cursor,
            token: markup
          });
        } else {
          styles.pop();
        }
        cursor = close + 1;
        plainStart = cursor;
        continue;
      }

      const selfClosingMatch = /^<([A-Za-z][A-Za-z0-9_]*)\s+([\s\S]+)\/>$/u.exec(markup);
      if (selfClosingMatch !== null) {
        const tagName = selfClosingMatch[1];
        const attributesSource = selfClosingMatch[2];
        const attributes = attributesSource === undefined ? undefined : parseAttributes(attributesSource);
        const attributeStyleAllowed = attributes?.style === undefined
          || isAllowedStyle(attributes.style, context.resolvers);
        if (tagName === undefined || attributes === undefined) {
          addUnresolved(unresolved, context, {
            code: "MALFORMED_TAG",
            offset: cursor,
            token: markup
          });
        } else if (
          attributes.style !== undefined
          && !attributeStyleAllowed
        ) {
          addUnresolved(unresolved, context, {
            code: "UNKNOWN_STYLE",
            offset: cursor,
            token: markup,
            id: attributes.style
          });
        }

        if (attributes !== undefined && tagName === "img") {
          const resolved = context.resolvers.image?.(attributes.id);
          const text = resolved === undefined
            ? undefined
            : validateImageLookupValue(resolved, `image:${attributes.id}`);
          if (text === undefined) {
            addUnresolved(unresolved, context, {
              code: resolved === undefined ? "UNRESOLVED_IMAGE" : "INVALID_LOOKUP_VALUE",
              offset: cursor,
              token: markup,
              id: attributes.id
            });
          } else {
            appendToken(tokens, context, {
              type: "image",
              id: attributes.id,
              text,
              styles: tokenStyles(styles, attributes.style, attributeStyleAllowed)
            });
          }
        } else if (
          attributes !== undefined
          && tagName !== undefined
          && isReferenceTag(tagName)
        ) {
          const resolver = resolverForTag(tagName, context.resolvers);
          const resolved = resolver?.(attributes.id);
          const text = resolved === undefined
            ? undefined
            : validatePlainLookupValue(resolved, `${tagName}:${attributes.id}`);
          if (text === undefined) {
            addUnresolved(unresolved, context, {
              code: resolved === undefined ? "UNRESOLVED_REFERENCE" : "INVALID_LOOKUP_VALUE",
              offset: cursor,
              token: markup,
              id: attributes.id
            });
          } else {
            appendToken(tokens, context, {
              type: "reference",
              referenceKind: referenceKindForTag(tagName),
              id: attributes.id,
              text,
              styles: tokenStyles(styles, attributes.style, attributeStyleAllowed)
            });
          }
        } else if (attributes !== undefined && tagName !== "img") {
          addUnresolved(unresolved, context, {
            code: "UNKNOWN_TAG",
            offset: cursor,
            token: markup,
            id: tagName
          });
        }
        cursor = close + 1;
        plainStart = cursor;
        continue;
      }

      const styleMatch = /^<([A-Za-z][A-Za-z0-9_]*)>$/u.exec(markup);
      const style = styleMatch?.[1];
      if (style !== undefined && isAllowedStyle(style, context.resolvers)) {
        if (styles.length >= MAX_STYLE_DEPTH) {
          fail(`style 중첩 깊이가 ${MAX_STYLE_DEPTH}단계를 초과했습니다.`);
        }
        styles.push(style);
      } else {
        addUnresolved(unresolved, context, {
          code: style === undefined ? "UNKNOWN_TAG" : "UNKNOWN_STYLE",
          offset: cursor,
          token: markup,
          ...(style === undefined ? {} : { id: style })
        });
      }
      cursor = close + 1;
      plainStart = cursor;
      continue;
    }

    const close = normalized.indexOf("}", cursor + 1);
    if (close < 0 || close - cursor + 1 > MAX_MARKUP_CHARACTERS) {
      addUnresolved(unresolved, context, {
        code: "MALFORMED_VARIABLE",
        offset: cursor,
        token: normalized.slice(cursor, Math.min(normalized.length, cursor + MAX_MARKUP_CHARACTERS))
      });
      cursor += 1;
      plainStart = cursor;
      continue;
    }
    const markup = normalized.slice(cursor, close + 1);
    const id = normalized.slice(cursor + 1, close);
    if (
      id.length === 0
      || id.length > MAX_IDENTIFIER_CHARACTERS
      || !IDENTIFIER_PATTERN.test(id)
    ) {
      addUnresolved(unresolved, context, {
        code: "MALFORMED_VARIABLE",
        offset: cursor,
        token: markup
      });
      cursor = close + 1;
      plainStart = cursor;
      continue;
    }

    const isReferenceMessage = id.startsWith("ReferenceMsgId_");
    const resolver = isReferenceMessage
      ? context.resolvers.referenceMessage
      : context.resolvers.rankVariable;
    const resolved = resolver?.(id);
    if (resolved === undefined) {
      addUnresolved(unresolved, context, {
        code: isReferenceMessage
          ? "UNRESOLVED_REFERENCE_MESSAGE"
          : "UNRESOLVED_RANK_VARIABLE",
        offset: cursor,
        token: markup,
        id
      });
    } else {
      const parsed = parseLookupValue(
        resolved,
        context,
        `${isReferenceMessage ? "reference_message" : "rank_variable"}:${id}`,
        cursor,
        unresolved
      );
      if (parsed !== undefined) {
        if ("values" in parsed) {
          appendToken(tokens, context, {
            type: "ranked_reference",
            referenceKind: isReferenceMessage ? "reference_message" : "rank_variable",
            id,
            text: parsed.text,
            values: parsed.values,
            styles: [...styles]
          });
        } else {
          appendToken(tokens, context, {
            type: "reference_message",
            id,
            text: parsed.text,
            tokens: parsed.tokens,
            styles: [...styles]
          });
        }
      }
    }
    cursor = close + 1;
    plainStart = cursor;
  }

  flushPlain(normalized.length);
  for (const style of styles.reverse()) {
    addUnresolved(unresolved, context, {
      code: "UNCLOSED_STYLE",
      offset: normalized.length,
      token: `<${style}>`,
      id: style
    });
  }

  return {
    status: unresolved.length === 0 ? "resolved" : "unresolved",
    text: tokens.map((token) => token.text).join(""),
    tokens,
    unresolved
  };
}

export function normalizePalworldPakRichText(
  input: string,
  resolvers: PalworldPakRichTextResolvers = {}
): PalworldPakRichTextResult {
  return parseRichText(input, {
    resolvers,
    budget: {
      tokenCount: 0,
      unresolvedCount: 0,
      outputCharacters: 0
    },
    referenceDepth: 0,
    referenceStack: []
  });
}

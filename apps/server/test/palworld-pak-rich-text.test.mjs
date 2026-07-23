import assert from "node:assert/strict";
import test from "node:test";
import {
  isPalworldPakLocalePlaceholder,
  normalizePalworldPakRichText,
  PalworldPakRichTextError
} from "../dist/data/palworld-pak-rich-text.js";

const exactNames = new Map([
  ["Lamball", "도로롱"],
  ["Berries", "빨간 열매"],
  ["PowerShot", "파워 샷"],
  ["COMMON_STATUS_HP", "HP"],
  ["MonsterFarm", "가축 목장"]
]);

const resolvers = {
  characterName: (id) => exactNames.get(id),
  itemName: (id) => exactNames.get(id),
  activeSkillName: (id) => exactNames.get(id),
  uiCommon: (id) => exactNames.get(id),
  mapObjectName: (id) => exactNames.get(id),
  image: (id) => id === "ElemIcon_Fire" ? {} : undefined
};

test("공식 locale의 exact reference와 style을 구조화된 평문으로 정규화한다", () => {
  const result = normalizePalworldPakRichText(
    "<characterName id=|Lamball|/>은 <itemName id=|Berries| style=|Status_Keyword|/>을 먹고 "
      + "<activeSkillName id=|PowerShot|/>을 쓴다. <Status_Up>강화</>",
    resolvers
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.text, "도로롱은 빨간 열매을 먹고 파워 샷을 쓴다. 강화");
  assert.deepEqual(
    result.tokens.filter((token) => token.type === "reference").map((token) => [
      token.referenceKind,
      token.id,
      token.text
    ]),
    [
      ["character", "Lamball", "도로롱"],
      ["item", "Berries", "빨간 열매"],
      ["active_skill", "PowerShot", "파워 샷"]
    ]
  );
  const itemReference = result.tokens.find(
    (token) => token.type === "reference" && token.referenceKind === "item"
  );
  assert.deepEqual(itemReference?.styles, ["Status_Keyword"]);
  assert.deepEqual(result.tokens.at(-1)?.styles, ["Status_Up"]);
  assert.deepEqual(result.unresolved, []);
});

test("uiCommon, mapObjectName의 명시적 대소문자 alias와 img를 exact lookup한다", () => {
  const result = normalizePalworldPakRichText(
    "<img id=|ElemIcon_Fire|/><uiCommon id=|COMMON_STATUS_HP| style=|Elem_Fire|/> "
      + "<mapObjectName id=|MonsterFarm|/> <MapObjectName id=|MonsterFarm|/> "
      + "<mapObjectname id=|MonsterFarm|/>",
    resolvers
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.text, "HP 가축 목장 가축 목장 가축 목장");
  assert.equal(result.tokens.filter((token) => token.type === "image").length, 1);
  assert.equal(
    result.tokens.filter(
      (token) => token.type === "reference" && token.referenceKind === "map_object"
    ).length,
    3
  );
});

test("reference message를 재귀 정규화하고 rank별 값을 임의로 하나만 고르지 않는다", () => {
  const result = normalizePalworldPakRichText(
    "{ReferenceMsgId_DamageUp}: <Status_Up>{Passive1_EffectValue1}%</>",
    {
      ...resolvers,
      referenceMessage: (id) => id === "ReferenceMsgId_DamageUp"
        ? "피해 <characterName id=|Lamball|/>"
        : undefined,
      rankVariable: (id) => id === "Passive1_EffectValue1"
        ? {
          byRank: [
            { rank: 5, text: "50" },
            { rank: 1, text: "10" },
            { rank: 3, text: "30" }
          ]
        }
        : undefined
    }
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.text, "피해 도로롱: Lv.1 10 · Lv.3 30 · Lv.5 50%");
  const ranked = result.tokens.find((token) => token.type === "ranked_reference");
  assert.equal(ranked?.type, "ranked_reference");
  assert.deepEqual(ranked?.values.map((value) => value.rank), [1, 3, 5]);
  assert.deepEqual(ranked?.styles, ["Status_Up"]);
});

test("reference 순환과 lookup placeholder를 unresolved로 보고하고 무한 재귀하지 않는다", () => {
  const result = normalizePalworldPakRichText(
    "{ReferenceMsgId_A} {ReferenceMsgId_Placeholder}",
    {
      referenceMessage: (id) => {
        if (id === "ReferenceMsgId_A") return "{ReferenceMsgId_B}";
        if (id === "ReferenceMsgId_B") return "{ReferenceMsgId_A}";
        if (id === "ReferenceMsgId_Placeholder") return "ko_Text";
        return undefined;
      }
    }
  );

  assert.equal(result.status, "unresolved");
  assert.deepEqual(
    result.unresolved.map((item) => item.code),
    ["REFERENCE_CYCLE", "INVALID_LOOKUP_VALUE"]
  );
  assert.equal(result.text, " ");
});

test("알 수 없는 HTML·태그와 누락 reference는 출력 markup에서 제거하고 보고한다", () => {
  const result = normalizePalworldPakRichText(
    "<script>alert(1)</script><characterName id=|Blueplatypus|/>"
      + "<keyGuideIcon id=|Jump|/><UnknownStyle>내용</>",
    resolvers
  );

  assert.equal(result.status, "unresolved");
  assert.equal(result.text, "alert(1)내용");
  assert.equal(result.text.includes("<"), false);
  assert.equal(result.text.includes(">"), false);
  assert.deepEqual(
    result.unresolved.map((item) => item.code),
    [
      "UNKNOWN_STYLE",
      "UNKNOWN_TAG",
      "UNRESOLVED_REFERENCE",
      "UNKNOWN_TAG",
      "UNKNOWN_STYLE",
      "UNBALANCED_STYLE_CLOSE"
    ]
  );
});

test("duplicate·unknown attribute와 잘못된 variable 문법을 차단한다", () => {
  const result = normalizePalworldPakRichText(
    "<itemName id=|Berries| id=|Stone|/>"
      + "<itemName id=|Berries| href=|https://example.invalid|/>"
      + "{bad value}",
    resolvers
  );

  assert.equal(result.status, "unresolved");
  assert.deepEqual(
    result.unresolved.map((item) => item.code),
    ["MALFORMED_TAG", "MALFORMED_TAG", "MALFORMED_VARIABLE"]
  );
  assert.equal(result.text, "");
});

test("공식 locale placeholder를 값으로 인정하지 않는다", () => {
  for (const value of ["", " ", "-", "ko_Text", "ja_Text", "en_Text", "en Text"]) {
    assert.equal(isPalworldPakLocalePlaceholder(value), true, value);
    const result = normalizePalworldPakRichText(value);
    assert.equal(result.status, "placeholder", value);
    assert.equal(result.text, "", value);
    assert.equal(result.unresolved[0]?.code, "PLACEHOLDER_TEXT", value);
  }
  assert.equal(isPalworldPakLocalePlaceholder("ko text"), false);
  assert.equal(isPalworldPakLocalePlaceholder(1), false);
});

test("style 중첩·입력 크기·제어 문자 제한을 적용한다", () => {
  const deeplyNested = "<Status_Up>".repeat(9) + "값" + "</>".repeat(9);
  assert.throws(
    () => normalizePalworldPakRichText(deeplyNested),
    PalworldPakRichTextError
  );
  assert.throws(
    () => normalizePalworldPakRichText("가".repeat(32_769)),
    PalworldPakRichTextError
  );
  assert.throws(
    () => normalizePalworldPakRichText("정상\u0000아님"),
    PalworldPakRichTextError
  );
});

test("동일 입력과 resolver는 byte-for-byte 직렬화 가능한 동일 결과를 만든다", () => {
  const input = "<Status_Up><characterName id=|Lamball|/></>\r\n"
    + "{ReferenceMsgId_DamageUp}";
  const deterministicResolvers = {
    ...resolvers,
    referenceMessage: (id) => id === "ReferenceMsgId_DamageUp" ? "증가" : undefined
  };
  const first = normalizePalworldPakRichText(input, deterministicResolvers);
  const second = normalizePalworldPakRichText(input, deterministicResolvers);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.text, "도로롱\n증가");
});

test("FModel이 self-closing reference 주위에 추가한 pipe를 화면 문자열에서 제거한다", () => {
  const result = normalizePalworldPakRichText(
    "재료 |<itemName id=|Berries|/>| 사용",
    resolvers
  );

  assert.equal(result.status, "resolved");
  assert.equal(result.text, "재료 빨간 열매 사용");
  assert.equal(result.text.includes("|"), false);
});

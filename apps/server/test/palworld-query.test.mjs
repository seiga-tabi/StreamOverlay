import test from "node:test";
import assert from "node:assert/strict";

const {
  PalworldQueryError,
  normalizePalworldSearchTerm,
  parsePalworldBreedingQuery,
  parsePalworldItemListQuery,
  parsePalworldPalListQuery,
  parsePalworldSkillListQuery,
  parsePalworldSearchQuery
} = await import("../dist/services/palworld-query.js");

test("펠월드 검색어는 공백, 대소문자와 전각 문자를 안정적으로 정규화한다", () => {
  assert.equal(normalizePalworldSearchTerm("  ＡＮＵＢＩＳ   아누비스  "), "anubis 아누비스");
  assert.equal(normalizePalworldSearchTerm("  アヌビス　100  "), "アヌビス 100");
});

test("Pal 목록 query는 allowlist 필터, 정렬과 pagination만 허용한다", () => {
  const query = parsePalworldPalListQuery(new URLSearchParams(
    "q=%EC%95%84%EB%88%84%EB%B9%84%EC%8A%A4&element=ground&work=mining&rarity=10&variant=special&sort=rarity&order=desc&page=2&limit=12"
  ));

  assert.deepEqual(query, {
    q: "아누비스",
    element: "ground",
    work: "mining",
    rarity: 10,
    variant: "special",
    sort: "rarity",
    order: "desc",
    page: 2,
    limit: 12
  });
});

test("아이템 목록 query는 허용된 필터와 정렬을 해석한다", () => {
  const query = parsePalworldItemListQuery(new URLSearchParams(
    "category=sphere&acquisition=craft&rarity=0&sort=technologyLevel&page=3&limit=10"
  ));

  assert.equal(query.category, "sphere");
  assert.equal(query.acquisition, "craft");
  assert.equal(query.rarity, 0);
  assert.equal(query.sort, "technologyLevel");
  assert.equal(query.page, 3);
  assert.equal(query.limit, 10);
  assert.throws(
    () => parsePalworldPalListQuery(new URLSearchParams("rarity=0")),
    PalworldQueryError
  );
});

test("스킬 목록 query는 종류·속성·정렬과 pagination만 허용한다", () => {
  const query = parsePalworldSkillListQuery(new URLSearchParams(
    "q=Flame&type=active&element=fire&sort=power&order=desc&page=2&limit=12"
  ));

  assert.deepEqual(query, {
    q: "Flame",
    type: "active",
    element: "fire",
    sort: "power",
    order: "desc",
    page: 2,
    limit: 12
  });
  assert.throws(
    () => parsePalworldSkillListQuery(new URLSearchParams("type=unknown")),
    PalworldQueryError
  );
  assert.throws(
    () => parsePalworldSkillListQuery(new URLSearchParams("q=fire&redirect=https%3A%2F%2Fexample.com")),
    PalworldQueryError
  );
});

test("검색과 교배 query는 빈 값, 중복 값, 알 수 없는 필드와 비정상 ID를 거부한다", () => {
  for (const params of [
    new URLSearchParams("q="),
    new URLSearchParams("q=anubis&q=lamball"),
    new URLSearchParams("q=anubis&redirect=https%3A%2F%2Fexample.com"),
    new URLSearchParams("q=anubis&limit=101")
  ]) {
    assert.throws(() => parsePalworldSearchQuery(params), PalworldQueryError);
  }

  assert.throws(
    () => parsePalworldBreedingQuery(new URLSearchParams("parentA=..%2Fsecret&parentB=lamball")),
    PalworldQueryError
  );
  assert.deepEqual(
    parsePalworldBreedingQuery(new URLSearchParams(
      "parentA=katress&parentB=wixen&parentAGender=female&parentBGender=male"
    )),
    {
      parentA: "katress",
      parentB: "wixen",
      parentAGender: "female",
      parentBGender: "male"
    }
  );
  assert.throws(
    () => parsePalworldBreedingQuery(new URLSearchParams(
      "parentA=katress&parentB=wixen&parentAGender=any"
    )),
    PalworldQueryError
  );
});

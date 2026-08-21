import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const finalOverrides = readFileSync(
  new URL("../src/styles/pages/public-lol/10-final-overrides.css", import.meta.url),
  "utf8"
);

const inkProfile = readFileSync(
  new URL("../src/styles/pages/public-lol/38-ink-profile.css", import.meta.url),
  "utf8"
);

const core = readFileSync(
  new URL("../src/styles/legacy/01-core.css", import.meta.url),
  "utf8"
);

/* 연관 패널 리스킨(목업 LolHeaderSearch) 이후의 계약 — 모바일 2단 재배치 대신
 * 전 폭 공통의 52px 단일 행(38-ink-profile 소유)과 말줄임이 좁은 폭을 감당합니다. */
test("LoL 연관검색 행은 52px 단일 행(아바타 30·티어 엠블럼 22)이고 표면은 38-ink 가 소유한다", () => {
  assert.match(
    inkProfile,
    /public-search-wrap \.public-suggestion-list button \{[\s\S]*?grid-template-columns: 30px 22px minmax\(0, 1fr\) max-content;[\s\S]*?min-height: 52px;/u
  );
  assert.match(
    inkProfile,
    /public-search-wrap \.public-suggestion-avatar \{[\s\S]*?border-radius: 99px;/u
  );
});

test("좁은 폭 연관검색은 가로를 숨기고 이름은 말줄임으로 접는다", () => {
  assert.match(
    finalOverrides,
    /@media \(max-width: 47\.5rem\)[\s\S]*?public-suggestion-list[\s\S]*?overflow-x: hidden !important;/u
  );
  /* 이름 말줄임은 01-core 기본 계약이 담당합니다. */
  assert.match(core, /\.public-suggestion-name span \{[\s\S]*?text-overflow: ellipsis;/u);
});

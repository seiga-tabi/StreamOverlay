import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const finalOverrides = readFileSync(
  new URL("../src/styles/pages/public-lol/10-final-overrides.css", import.meta.url),
  "utf8"
);

test("모바일 LoL 연관검색 행은 이름과 랭크를 한 가변 열에 배치한다", () => {
  assert.match(
    finalOverrides,
    /@media \(max-width: 47\.5rem\)[\s\S]*?grid-template-columns:[\s\S]*?minmax\(var\(--yoro-space-0\), 1fr\)[\s\S]*?grid-template-areas:[\s\S]*?"avatar tier name mark"[\s\S]*?"avatar tier rank mark"/u
  );
  assert.match(
    finalOverrides,
    /public-suggestion-list button > \*[\s\S]*?min-width: var\(--yoro-space-0\) !important;[\s\S]*?max-width: 100% !important;/u
  );
  assert.match(
    finalOverrides,
    /public-suggestion-rank-copy > span[\s\S]*?text-overflow: ellipsis;[\s\S]*?white-space: nowrap;/u
  );
});

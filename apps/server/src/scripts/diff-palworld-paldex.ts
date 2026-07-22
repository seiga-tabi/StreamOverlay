import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertPalworldPaldexArtifact } from "../data/palworld-paldex-artifact.js";
import { PALWORLD_PALDEX_RELEASE_ROOT } from "../data/palworld-paldex-import.js";

const againstFlag = process.argv.indexOf("--against");
if (againstFlag < 0 || !process.argv[againstFlag + 1]) throw new Error("사용법: diff-palworld-paldex --against <검증된 이전 paldex.json>");
const current = assertPalworldPaldexArtifact(JSON.parse(await readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "paldex.json"), "utf8")) as unknown);
const previous = assertPalworldPaldexArtifact(JSON.parse(await readFile(path.resolve(process.argv[againstFlag + 1]!), "utf8")) as unknown);
const currentById = new Map(current.records.map((pal) => [pal.id, pal]));
const previousById = new Map(previous.records.map((pal) => [pal.id, pal]));
const added = current.records.filter((pal) => !previousById.has(pal.id)).map((pal) => pal.id);
const removed = previous.records.filter((pal) => !currentById.has(pal.id)).map((pal) => pal.id);
const changed = current.records
  .filter((pal) => {
    const before = previousById.get(pal.id);
    return before !== undefined && JSON.stringify(before) !== JSON.stringify(pal);
  })
  .map((pal) => pal.id);
console.log(JSON.stringify({ from: previous.release, to: current.release, added, removed, changed }, null, 2));

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseAramAugmentCatalog, type AramAugmentCatalog } from "@streamops/shared";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export function defaultAramAugmentCatalogPath(): string {
  return path.resolve(moduleDirectory, "../../data/lol/aram/augment-catalog.json");
}

export function loadAramAugmentCatalog(filePath = defaultAramAugmentCatalogPath()): AramAugmentCatalog {
  const parsed = parseAramAugmentCatalog(JSON.parse(fs.readFileSync(filePath, "utf8")));
  if (!parsed) throw new Error("ARAM_AUGMENT_CATALOG_INVALID");
  return parsed;
}

import { importPalworldCatalog } from "../data/palworld-catalog-import.js";

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${name} 경로를 명시해야 합니다.`);
  return value;
}

const result = await importPalworldCatalog({
  atlasArchivePath: argument("--atlas-archive"),
  pyPalArchivePath: argument("--pypal-archive")
});

process.stdout.write(`${JSON.stringify({
  release: result.catalog.release,
  coverage: result.catalog.coverage,
  itemManifestEntries: result.itemManifest.entries.length,
  elementManifestEntries: result.elementManifest.entries.length
}, null, 2)}\n`);

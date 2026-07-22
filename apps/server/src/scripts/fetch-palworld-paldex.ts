import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PALWORLD_PALDEX_RELEASE_ROOT,
  PALWORLD_PALDEX_SOURCE_CACHE_ROOT,
  assertPalworldPaldexSourceLock,
  readPalworldSourceResponseBytes,
  sha256Bytes
} from "../data/palworld-paldex-import.js";

const sourceLock = assertPalworldPaldexSourceLock(
  JSON.parse(await readFile(path.join(PALWORLD_PALDEX_RELEASE_ROOT, "sources.lock.json"), "utf8")) as unknown
);

await mkdir(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, { recursive: true, mode: 0o700 });

for (const source of sourceLock.sources) {
  const response = await fetch(source.downloadUrl, {
    method: "GET",
    redirect: "error",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${source.id}: 고정 source 다운로드에 실패했습니다. HTTP ${response.status}`);
  const bytes = await readPalworldSourceResponseBytes(response, source.bytes, source.id);
  if (bytes.length !== source.bytes || sha256Bytes(bytes) !== source.sha256) {
    throw new Error(`${source.id}: 다운로드 checksum 또는 크기가 lock과 다릅니다.`);
  }
  JSON.parse(bytes.toString("utf8"));
  const finalPath = path.join(PALWORLD_PALDEX_SOURCE_CACHE_ROOT, `${source.id}.json`);
  const temporaryPath = `${finalPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, bytes, { mode: 0o600, flag: "wx" });
  await rename(temporaryPath, finalPath);
  console.log(`[palworld-data] source 검증 완료: ${source.id} (${bytes.length} bytes, ${source.sha256})`);
}

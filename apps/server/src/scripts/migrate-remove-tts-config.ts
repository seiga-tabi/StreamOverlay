import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appConfig } from "../config.js";
import { ALERT_OVERLAY_KEYS } from "../services/alert-overlay-config.js";

const LEGACY_FIELDS = new Set([
  "speechEnabled",
  "speechText",
  "speechAudioUrl",
  "speechLanguage",
  "speechRate",
  "speechPitch",
  "speechVolume"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function removeLegacyFieldsFromRecord(value: Record<string, unknown>): {
  value: Record<string, unknown>;
  removedFields: number;
} {
  let removedFields = 0;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (LEGACY_FIELDS.has(key)) {
      removedFields += 1;
      continue;
    }
    if (isRecord(child)) {
      const nested = removeLegacyFieldsFromRecord(child);
      next[key] = nested.value;
      removedFields += nested.removedFields;
      continue;
    }
    if (Array.isArray(child)) {
      next[key] = child.map((entry) => {
        if (!isRecord(entry)) return entry;
        const nested = removeLegacyFieldsFromRecord(entry);
        removedFields += nested.removedFields;
        return nested.value;
      });
      continue;
    }
    next[key] = child;
  }
  return { value: next, removedFields };
}

export function removeLegacyTtsFields(value: unknown): { value: unknown; changedRecords: number; removedFields: number } {
  if (!isRecord(value)) return { value, changedRecords: 0, removedFields: 0 };
  let changedRecords = 0;
  let removedFields = 0;
  const next = { ...value };
  for (const key of ["defaults", ...ALERT_OVERLAY_KEYS]) {
    const preset = next[key];
    if (preset === undefined) continue;
    if (!isRecord(preset)) {
      throw new Error(`알림 runtime 설정의 ${key} 값이 객체가 아닙니다.`);
    }
    const clean = removeLegacyFieldsFromRecord(preset);
    if (clean.removedFields > 0) {
      next[key] = clean.value;
      removedFields += clean.removedFields;
      changedRecords += 1;
    }
  }
  return { value: next, changedRecords, removedFields };
}

type MigrationHooks = {
  beforeWrite?: () => void | Promise<void>;
  beforeRename?: () => void | Promise<void>;
};

export type TtsConfigMigrationResult = {
  status: "not_found" | "dry_run" | "unchanged" | "applied";
  target: string;
  backup?: string;
  changedRecords: number;
  removedFields: number;
};

async function assertRegularMigrationTarget(target: string): Promise<void> {
  const parent = path.dirname(target);
  const parentStat = await fsp.lstat(parent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new Error("알림 runtime 설정 디렉터리는 실제 디렉터리여야 합니다.");
  }
  const targetStat = await fsp.lstat(target);
  if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
    throw new Error("알림 runtime 설정은 symlink가 아닌 일반 파일이어야 합니다.");
  }
}

async function ensureBackup(target: string, backup: string, source: string): Promise<void> {
  try {
    await fsp.copyFile(target, backup, fs.constants.COPYFILE_EXCL);
    await fsp.chmod(backup, 0o600);
    return;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
  }

  const backupStat = await fsp.lstat(backup);
  if (backupStat.isSymbolicLink() || !backupStat.isFile()) {
    throw new Error("기존 TTS migration backup이 안전한 일반 파일이 아닙니다.");
  }
  if (await fsp.readFile(backup, "utf8") !== source) {
    throw new Error("기존 TTS migration backup이 현재 원본과 일치하지 않습니다.");
  }
}

export async function migrateLegacyTtsConfigFile(
  targetPath: string,
  options: { apply?: boolean; hooks?: MigrationHooks } = {}
): Promise<TtsConfigMigrationResult> {
  const target = path.resolve(targetPath);
  try {
    await assertRegularMigrationTarget(target);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { status: "not_found", target, changedRecords: 0, removedFields: 0 };
    }
    throw error;
  }

  const source = await fsp.readFile(target, "utf8");
  if (!source.trim()) throw new Error("알림 runtime 설정 파일이 비어 있습니다.");
  const parsed = JSON.parse(source) as unknown;
  if (!isRecord(parsed)) throw new Error("알림 runtime 설정의 최상위 값이 객체가 아닙니다.");
  const migrated = removeLegacyTtsFields(parsed);
  if (!options.apply) {
    return { status: "dry_run", target, changedRecords: migrated.changedRecords, removedFields: migrated.removedFields };
  }
  if (migrated.removedFields === 0) {
    return { status: "unchanged", target, changedRecords: 0, removedFields: 0 };
  }

  const backup = `${target}.pre-tts-removal.bak`;
  await ensureBackup(target, backup, source);

  const temp = `${target}.tts-migration.${process.pid}.${Date.now()}.tmp`;
  let tempCreated = false;
  try {
    await options.hooks?.beforeWrite?.();
    const handle = await fsp.open(temp, "wx", 0o600);
    tempCreated = true;
    try {
      await handle.writeFile(`${JSON.stringify(migrated.value, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    const verified = JSON.parse(await fsp.readFile(temp, "utf8")) as unknown;
    if (!isRecord(verified) || removeLegacyTtsFields(verified).removedFields !== 0) {
      throw new Error("TTS migration 임시 파일 재검증에 실패했습니다.");
    }
    await options.hooks?.beforeRename?.();
    await fsp.rename(temp, target);
    tempCreated = false;
  } catch (error) {
    if (tempCreated) await fsp.rm(temp, { force: true });
    throw error;
  }

  return {
    status: "applied",
    target,
    backup,
    changedRecords: migrated.changedRecords,
    removedFields: migrated.removedFields
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const target = path.resolve(appConfig.paths.state, "alert-overlays.runtime.json");
  const result = await migrateLegacyTtsConfigFile(target, { apply });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "TTS 설정 migration에 실패했습니다.");
    process.exitCode = 1;
  });
}

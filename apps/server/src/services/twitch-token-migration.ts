import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import {
  decodeTwitchTokenEncryptionKey,
  decryptTwitchTokenDocument,
  encryptTwitchTokenDocument
} from "./twitch-token-encryption.js";
import {
  parseStreamerFollowerTokenDocument,
  STREAMER_FOLLOWER_TOKEN_AAD
} from "./streamer-follower-token-store.js";
import {
  parseTwitchStoredToken,
  TWITCH_TOKEN_AAD
} from "./twitch-token-store.js";

type TokenMigrationOptions = {
  tokenStorePath: string;
  followerTokenStorePath: string;
  stateDirectory: string;
  backupDirectory: string;
  encryptionKey: string;
  operatorApproved: boolean;
  backupStorageEncryptedConfirmed: boolean;
};

type PreparedFile = {
  filePath: string;
  original: string;
  temporaryPath?: string;
  backupPath: string;
  verifyPlaintext: (plaintext: string) => void;
};

export type TokenMigrationResult = {
  migrated: string[];
  alreadyEncrypted: string[];
  missing: string[];
  backupSnapshotDirectory?: string;
};

function isPathInside(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeFileLabel(filePath: string): string {
  return path.basename(filePath).replace(/[^A-Za-z0-9._-]/g, "_");
}

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeVerifiedTemporaryFile(
  prepared: PreparedFile,
  encrypted: string,
  encryptionKey: Buffer,
  aad: string
): Promise<void> {
  const directory = path.dirname(prepared.filePath);
  await fs.access(directory, fsConstants.W_OK);
  const temporaryPath = `${prepared.filePath}.${process.pid}.${Date.now()}.migration.tmp`;
  await fs.writeFile(temporaryPath, encrypted, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await fs.chmod(temporaryPath, 0o600);
  const verification = decryptTwitchTokenDocument(
    await fs.readFile(temporaryPath, "utf8"),
    encryptionKey,
    aad
  );
  if (verification.legacyPlaintext) throw new Error("OAuth token migration 검증 결과가 암호화 형식이 아닙니다.");
  prepared.verifyPlaintext(verification.plaintext);
  prepared.temporaryPath = temporaryPath;
}

async function restoreOriginal(prepared: PreparedFile): Promise<void> {
  const temporaryPath = `${prepared.filePath}.${process.pid}.${Date.now()}.rollback.tmp`;
  await fs.writeFile(temporaryPath, prepared.original, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await fs.rename(temporaryPath, prepared.filePath);
  await fs.chmod(prepared.filePath, 0o600);
}

export async function migrateTwitchTokenStores(options: TokenMigrationOptions): Promise<TokenMigrationResult> {
  if (!options.operatorApproved) throw new Error("운영자 승인 없이 OAuth token migration을 실행할 수 없습니다.");
  if (!options.backupStorageEncryptedConfirmed) {
    throw new Error("backup 저장소의 암호화와 접근 권한 확인이 필요합니다.");
  }
  if (isPathInside(options.stateDirectory, options.backupDirectory)) {
    throw new Error("OAuth token backup은 application state directory 외부에 저장해야 합니다.");
  }
  const encryptionKey = decodeTwitchTokenEncryptionKey(options.encryptionKey);
  if (!encryptionKey) throw new Error("OAuth token migration encryption key가 필요합니다.");

  const result: TokenMigrationResult = { migrated: [], alreadyEncrypted: [], missing: [] };
  const definitions = [
    {
      filePath: options.tokenStorePath,
      aad: TWITCH_TOKEN_AAD,
      verify(plaintext: string) {
        parseTwitchStoredToken(JSON.parse(plaintext));
      }
    },
    {
      filePath: options.followerTokenStorePath,
      aad: STREAMER_FOLLOWER_TOKEN_AAD,
      verify(plaintext: string) {
        parseStreamerFollowerTokenDocument(JSON.parse(plaintext));
      }
    }
  ];
  const originals: Array<{ definition: typeof definitions[number]; raw: string }> = [];
  for (const definition of definitions) {
    const raw = await readOptionalFile(definition.filePath);
    if (raw === undefined) {
      result.missing.push(definition.filePath);
      continue;
    }
    const decoded = decryptTwitchTokenDocument(raw, encryptionKey, definition.aad);
    definition.verify(decoded.plaintext);
    if (!decoded.legacyPlaintext) {
      result.alreadyEncrypted.push(definition.filePath);
      continue;
    }
    originals.push({ definition, raw });
  }
  if (originals.length === 0) return result;

  const snapshotDirectory = path.join(
    path.resolve(options.backupDirectory),
    `twitch-token-pre-migration-${new Date().toISOString().replace(/[:.]/g, "-")}`
  );
  await fs.mkdir(path.resolve(options.backupDirectory), { recursive: true, mode: 0o700 });
  await fs.chmod(path.resolve(options.backupDirectory), 0o700);
  await fs.mkdir(snapshotDirectory, { recursive: false, mode: 0o700 });
  await fs.chmod(snapshotDirectory, 0o700);
  result.backupSnapshotDirectory = snapshotDirectory;

  const preparedFiles: PreparedFile[] = [];
  try {
    for (const { definition, raw } of originals) {
      const backupPath = path.join(snapshotDirectory, safeFileLabel(definition.filePath));
      await fs.writeFile(backupPath, raw, { encoding: "utf8", mode: 0o600, flag: "wx" });
      await fs.chmod(backupPath, 0o600);
      if (await fs.readFile(backupPath, "utf8") !== raw) {
        throw new Error("OAuth token migration backup 검증에 실패했습니다.");
      }
      const prepared: PreparedFile = {
        filePath: definition.filePath,
        original: raw,
        backupPath,
        verifyPlaintext: definition.verify
      };
      const encrypted = encryptTwitchTokenDocument(
        JSON.stringify(JSON.parse(raw)),
        encryptionKey,
        definition.aad
      );
      await writeVerifiedTemporaryFile(prepared, encrypted, encryptionKey, definition.aad);
      preparedFiles.push(prepared);
    }

    const committed: PreparedFile[] = [];
    try {
      for (const prepared of preparedFiles) {
        if (!prepared.temporaryPath) throw new Error("OAuth token migration 임시 파일이 준비되지 않았습니다.");
        await fs.rename(prepared.temporaryPath, prepared.filePath);
        prepared.temporaryPath = undefined;
        await fs.chmod(prepared.filePath, 0o600);
        committed.push(prepared);
      }
      for (const { definition } of originals) {
        const decoded = decryptTwitchTokenDocument(
          await fs.readFile(definition.filePath, "utf8"),
          encryptionKey,
          definition.aad
        );
        if (decoded.legacyPlaintext) throw new Error("OAuth token migration 완료 검증에 실패했습니다.");
        definition.verify(decoded.plaintext);
        result.migrated.push(definition.filePath);
      }
    } catch (error) {
      for (const prepared of committed.reverse()) await restoreOriginal(prepared);
      throw error;
    }
  } finally {
    for (const prepared of preparedFiles) {
      if (prepared.temporaryPath) await fs.rm(prepared.temporaryPath, { force: true }).catch(() => undefined);
    }
  }
  return result;
}

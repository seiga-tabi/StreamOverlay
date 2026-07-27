import fs from "node:fs";
import path from "node:path";
import { migrateTwitchTokenStores } from "../services/twitch-token-migration.js";

function requiredArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1]?.trim() : "";
  if (!value) throw new Error(`${name} 인자가 필요합니다.`);
  return value;
}

const keyFile = requiredArgument("--key-file");
const encryptionKey = fs.readFileSync(path.resolve(keyFile), "utf8").trim();
const result = await migrateTwitchTokenStores({
  tokenStorePath: path.resolve(requiredArgument("--token-store")),
  followerTokenStorePath: path.resolve(requiredArgument("--follower-token-store")),
  stateDirectory: path.resolve(requiredArgument("--state-directory")),
  backupDirectory: path.resolve(requiredArgument("--backup-directory")),
  encryptionKey,
  operatorApproved: process.argv.includes("--operator-approved"),
  backupStorageEncryptedConfirmed: process.argv.includes("--backup-storage-encrypted")
});

process.stdout.write(`${JSON.stringify({
  migratedCount: result.migrated.length,
  alreadyEncryptedCount: result.alreadyEncrypted.length,
  missingCount: result.missing.length,
  backupSnapshotCreated: Boolean(result.backupSnapshotDirectory)
})}\n`);

import fs from "node:fs";
import {
  PALWORLD_SERVER_CONNECTIONS_STATE_FILE,
  PALWORLD_SERVER_CREDENTIALS_SECRET_PATH
} from "../services/palworld-server-status-config.js";
import {
  PALWORLD_SERVER_CREDENTIALS_DIRECTORY,
  PalworldServerCredentialsBootstrapError,
  bootstrapPalworldServerCredentials
} from "../services/palworld-server-credentials-bootstrap.js";
import {
  PalworldServerConnectionStore,
  PalworldServerConnectionStoreError
} from "../services/palworld-server-connection-store.js";

const STREAMOPS_UID = 10_001;
const STREAMOPS_GID = 10_001;
const STATE_DIRECTORY = "/app/.streamops";

function safeFailureCode(error: unknown): string {
  if (error instanceof PalworldServerCredentialsBootstrapError) return error.code;
  if (error instanceof PalworldServerConnectionStoreError) return error.code;
  return "initialization_failed";
}

try {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    throw new PalworldServerCredentialsBootstrapError("permission_denied");
  }
  const result = bootstrapPalworldServerCredentials({
    secretDirectory: PALWORLD_SERVER_CREDENTIALS_DIRECTORY,
    stateDirectory: STATE_DIRECTORY,
    targetUid: STREAMOPS_UID,
    targetGid: STREAMOPS_GID
  });
  const encryptionKey = fs.readFileSync(PALWORLD_SERVER_CREDENTIALS_SECRET_PATH, "utf8").trim();
  try {
    new PalworldServerConnectionStore({
      filePath: `${STATE_DIRECTORY}/${PALWORLD_SERVER_CONNECTIONS_STATE_FILE}`,
      encryptionKey
    });
  } finally {
    // 프로세스 종료 전에 JS 문자열을 직접 소거할 수 없으므로 key를 출력하거나 보관하지 않습니다.
  }
  process.stdout.write(`${JSON.stringify({
    type: "palworld_server.credentials_ready",
    keyStatus: result.keyStatus,
    stateStatus: result.stateStatus
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    type: "palworld_server.credentials_unavailable",
    errorCode: safeFailureCode(error)
  })}\n`);
  process.exitCode = 1;
}

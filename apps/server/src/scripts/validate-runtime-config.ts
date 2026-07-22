import { appConfig, validateRuntimeConfig } from "../config.js";
import {
  PalworldServerStatusConfigError,
  loadPalworldServerStatusConfig
} from "../services/palworld-server-status-config.js";

const result = validateRuntimeConfig();
const errors = result.ok ? [] : [...result.errors];

try {
  loadPalworldServerStatusConfig({
    configDir: appConfig.paths.config,
    stateDir: appConfig.paths.state,
    reusedSecrets: [
      appConfig.security.dashboardAuthToken,
      appConfig.security.overlayAccessToken,
      appConfig.bridge.sharedSecret,
      appConfig.twitch.clientSecret,
      appConfig.twitch.userAccessToken,
      appConfig.riot.apiKey,
      appConfig.supportMailbox.webhookSecret,
      appConfig.supportMailbox.encryptionKey
    ].filter((value): value is string => Boolean(value))
  });
} catch (error) {
  const code = error instanceof PalworldServerStatusConfigError ? error.code : "config_invalid_file";
  errors.push(`Palworld 서버 상태 runtime 검증에 실패했습니다: ${code}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[runtime] ${error}`);
  console.error(`Runtime config validation failed: ${errors.length}개 오류`);
  process.exit(1);
}

console.log("Runtime config validation passed");

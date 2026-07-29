import { fileURLToPath } from "node:url";
import { AgentDaemon } from "./agent-daemon.js";
import { loadAgentConfig } from "./config.js";
import { agentEvent } from "./logger.js";

export async function runAgent(): Promise<void> {
  const config = loadAgentConfig();
  const daemon = new AgentDaemon(config);
  const shutdown = () => {
    void daemon.stop().finally(() => {
      process.exitCode = 0;
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  await daemon.start();
}

const entry = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (entry) {
  runAgent().catch((error: unknown) => {
    agentEvent("agent.startup.failed", {
      code: error instanceof Error ? error.message : "startup_failed"
    });
    process.exitCode = 1;
  });
}

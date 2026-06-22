import { ObsController } from "./obs.js";
import { ServerConnection } from "./server-connection.js";

const obs = new ObsController();
try {
  await obs.connect();
} catch {
  console.warn("OBS is not connected yet. The bridge will retry when commands arrive.");
}

const server = new ServerConnection(obs);
server.start();

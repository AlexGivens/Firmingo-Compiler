import { parentPort } from "node:worker_threads";
import { installPreparationWorker } from "../runtime/preparation-worker-core.js";
installPreparationWorker(handler => parentPort.on("message", handler), message => parentPort.postMessage(message));

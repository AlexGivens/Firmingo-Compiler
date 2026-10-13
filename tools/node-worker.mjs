import { parentPort } from "node:worker_threads";
import { installWorker } from "../runtime/worker-core.js";
/** Developer adapter runs the same portable worker core, without Swift or a native compiler. */
if (!parentPort) throw new Error("Compiler requires an isolated worker");
installWorker(handler => parentPort.on("message", handler), (message, transfers = []) => parentPort.postMessage(message, transfers));

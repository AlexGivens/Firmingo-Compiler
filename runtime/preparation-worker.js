import { installPreparationWorker } from "./preparation-worker-core.js";
/** Standard module-worker entry for service-free source preparation. */
installPreparationWorker(handler => globalThis.addEventListener("message", event => handler(event.data)),
  message => globalThis.postMessage(message));

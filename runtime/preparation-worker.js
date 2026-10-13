import { installPreparationWorker } from "./preparation-worker-core.js";
/** Standard module-worker entry for service-free preparation and declared ELF packaging. */
installPreparationWorker(handler => globalThis.addEventListener("message", event => handler(event.data)),
  message => globalThis.postMessage(message));

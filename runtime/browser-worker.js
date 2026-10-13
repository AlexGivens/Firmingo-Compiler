import { installWorker } from "./worker-core.js";
/** A standard module worker; wrapping applications provide the web environment and approved local assets. */
installWorker(handler => globalThis.addEventListener("message", event => handler(event.data)),
  (message, transfers = []) => globalThis.postMessage(message, transfers));

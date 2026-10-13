import { prepareSketch } from "../src/preprocess.js";

/** One bounded service-free source preparation per isolated worker; the host owns termination. */
export function installPreparationWorker(listen, send) {
  let consumed = false;
  listen(async message => {
    if (consumed) return;
    consumed = true;
    const common = { interfaceVersion: 1, buildID: message.request?.buildID };
    try {
      if (!message || Object.keys(message).join() !== "request") throw new Error("Invalid preparation worker request");
      const prepared = await prepareSketch(message.request);
      const { request, ...result } = prepared;
      send({ ...common, kind: "prepared", result });
    } catch (error) {
      send({ ...common, kind: "failure", error: { code: error.code || "runtime_failed", stage: "preprocessing",
        message: String(error.message).slice(0, 4096) }, diagnostics: error.diagnostics || [] });
    }
  });
}

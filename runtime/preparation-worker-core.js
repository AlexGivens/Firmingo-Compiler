import { prepareSketch } from "../src/preprocess.js";
import { packageDeclaredELF } from "../src/capsule.js";
import { canonicalJSON } from "../src/hash.js";

/** One bounded service-free preparation or declared ELF packaging per worker; the host owns termination. */
export function installPreparationWorker(listen, send) {
  let consumed = false;
  listen(async message => {
    if (consumed) return;
    consumed = true;
    const common = { interfaceVersion: 1, buildID: message?.request?.buildID };
    const packaging = message?.request?.kind === "package_elf";
    try {
      if (packaging) {
        if (Object.keys(message).sort().join() !== "elfBytes,request") throw new Error("Invalid packaging worker request");
        const artifact = await packageDeclaredELF(message.elfBytes, message.request);
        send({ ...common, kind: "packaged", result: { format: artifact.format, filename: artifact.filename,
          bytes: artifact.bytes, sha256: artifact.sha256, reportJSON: artifact.reportJSON, receiptJSON: canonicalJSON(artifact.receipt) } });
        return;
      }
      if (!message || Object.keys(message).join() !== "request") throw new Error("Invalid preparation worker request");
      const prepared = await prepareSketch(message.request);
      const { request, ...result } = prepared;
      send({ ...common, kind: "prepared", result });
    } catch (error) {
      send({ ...common, kind: "failure", error: { code: error.code || "runtime_failed", stage: packaging ? error.stage || "packaging" : "preprocessing",
        message: String(error.message).slice(0, 4096) }, diagnostics: error.diagnostics || [] });
    }
  });
}

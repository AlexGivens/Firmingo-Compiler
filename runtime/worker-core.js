import { executeBuild } from "./build.js";

/** Exactly one request per worker; host disposal is mandatory even on a successful build. */
export function installWorker(listen, send) {
  let consumed = false;
  listen(async message => {
    if (consumed) return;
    consumed = true;
    let sequence = 0;
    const emit = (kind, fields) => send({ interfaceVersion: 1, kind, buildID: message.request?.buildID, sequence: ++sequence, ...fields });
    try {
      if (Object.keys(message).sort().join() !== "request,resources") throw new Error("Invalid worker request");
      const result = await executeBuild(message.request, message.resources, phase => emit("progress", { phase }));
      send({ interfaceVersion: 1, kind: "success", buildID: message.request.buildID, sequence: ++sequence, result },
        [result.linkedELF.buffer, result.capsuleBytes.buffer]);
    } catch (error) {
      emit("failure", { error: { code: error.code || "runtime_failed", stage: error.stage || "verifying", message: String(error.message).slice(0, 4096) },
        diagnostics: error.diagnostics || [] });
    }
  });
}

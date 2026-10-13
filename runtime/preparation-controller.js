import { validateBuildRequest } from "../src/contract.js";
import { prepareSketch } from "../src/preprocess.js";
import { PipelineError } from "../src/pipeline-error.js";
import { validateDiagnostics } from "./messages.js";

const fields = (value, names) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join() === [...names].sort().join();
const fail = () => { throw new PipelineError("invalid_response", "preprocessing", "Invalid preparation worker response"); };

function browserWorker() {
  if (typeof Worker !== "function") throw new PipelineError("host_unavailable", "preprocessing", "Host must provide workers");
  const worker = new Worker(new URL("./preparation-worker.js", import.meta.url), { type: "module" });
  return { postMessage: message => worker.postMessage(message), terminate: () => worker.terminate(),
    listen(message, error) {
      const receive = event => message(event.data), failed = () => error(new Error("Preparation worker failed"));
      worker.addEventListener("message", receive); worker.addEventListener("error", failed); worker.addEventListener("messageerror", failed);
      return () => { worker.removeEventListener("message", receive); worker.removeEventListener("error", failed); worker.removeEventListener("messageerror", failed); };
    } };
}

/** Service-free preparation, preserving one-active-operation bounds and termination-before-settlement. */
export class PreparationController {
  #active = null;
  #workerFactory;
  constructor({ workerFactory = browserWorker } = {}) {
    if (typeof workerFactory !== "function") throw new TypeError("Require a worker factory");
    this.#workerFactory = workerFactory;
  }
  async prepare(input, { signal } = {}) {
    const request = validateBuildRequest(input);
    if (this.#active) throw new PipelineError("busy", "preprocessing", "Preparation already active");
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError("Require an AbortSignal");
    const active = {}; this.#active = active;
    let worker, stopping;
    const stop = () => stopping ??= Promise.resolve().then(() => worker?.terminate());
    try {
      return await new Promise((resolve, reject) => {
        let settled = false, received = false, unsubscribe = () => {};
        const finish = async (error, prepared) => {
          if (settled) return;
          settled = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel); unsubscribe();
          try { await stop(); } catch { error = new PipelineError("cleanup_failed", "preprocessing", "Preparation worker termination failed"); }
          if (this.#active === active) this.#active = null;
          if (error) reject(error instanceof PipelineError ? error : new PipelineError("runtime_failed", "preprocessing", error.message));
          else resolve(prepared);
        };
        const cancel = () => { void finish(new PipelineError("cancelled", "preprocessing", "Preparation cancelled")); };
        const timer = setTimeout(() => { void finish(new PipelineError("timed_out", "preprocessing", "Preparation deadline exceeded")); }, request.options.deadlineMilliseconds);
        signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) { cancel(); return; }
        try {
          worker = this.#workerFactory();
          unsubscribe = worker.listen(async response => {
            if (settled || received) return;
            received = true;
            try {
              if (!response || response.interfaceVersion !== 1 || response.buildID !== request.buildID) fail();
              if (response.kind === "failure") {
                if (!fields(response, ["interfaceVersion", "buildID", "kind", "error", "diagnostics"])) fail();
                validateDiagnostics(response.diagnostics);
                const error = response.error;
                if (!fields(error, ["code", "stage", "message"]) || error.stage !== "preprocessing"
                    || !/^[a-z_]{1,64}$/.test(error.code) || typeof error.message !== "string"
                    || new TextEncoder().encode(error.message).length > 4096 || error.message.includes("\0")) fail();
                void finish(new PipelineError(error.code, error.stage, error.message, response.diagnostics));
              } else {
                if (response.kind !== "prepared" || !fields(response, ["interfaceVersion", "buildID", "kind", "result"])
                    || !fields(response.result, ["sourceSHA256", "translationUnit", "translationUnitSHA256", "requestSHA256", "sourceLineCount", "sourceBOMBytes"])) fail();
                await stop();
                const expected = await prepareSketch(request, { signal });
                for (const [key, value] of Object.entries(expected)) if (key !== "request" && response.result[key] !== value) fail();
                void finish(null, expected);
              }
            } catch (error) { void finish(error); }
          }, error => { void finish(error); }, () => {
            if (!received && !settled) void finish(new PipelineError("worker_exited", "preprocessing", "Preparation worker exited before a result"));
          });
          worker.postMessage({ request });
        } catch (error) { void finish(error); }
      });
    } finally { if (this.#active === active) this.#active = null; }
  }
}

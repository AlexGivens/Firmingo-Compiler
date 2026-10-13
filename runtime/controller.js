import { validateBuildRequest, validateCancelRequest } from "../src/contract.js";
import { PipelineError } from "../src/pipeline-error.js";
import { snapshotResources, verifyBuildResult } from "./build.js";
import { validateWorkerMessage } from "./messages.js";

/** Default web adapter; module-worker hosting policy belongs to the embedding application. */
function browserWorker() {
  if (typeof Worker !== "function") throw new PipelineError("host_unavailable", "verifying", "Host must provide module workers");
  const worker = new Worker(new URL("./browser-worker.js", import.meta.url), { type: "module" });
  return {
    postMessage: (message, transfers) => worker.postMessage(message, transfers), terminate: () => worker.terminate(),
    listen(message, error) {
      const receive = event => message(event.data);
      const failed = () => error(new Error("Compiler module worker failed"));
      worker.addEventListener("message", receive); worker.addEventListener("error", failed); worker.addEventListener("messageerror", failed);
      return () => { worker.removeEventListener("message", receive); worker.removeEventListener("error", failed); worker.removeEventListener("messageerror", failed); };
    },
  };
}

/** One active build, no queue/retry/cache; termination precedes each caller-visible terminal outcome. */
export class CompilerController {
  #active = null;
  #workerFactory;
  constructor({ workerFactory = browserWorker } = {}) {
    if (typeof workerFactory !== "function") throw new TypeError("Require a worker factory");
    this.#workerFactory = workerFactory;
  }

  /** Correlated cancellation cannot affect a different or already settled build. */
  cancel(input) {
    const request = validateCancelRequest(input);
    if (!this.#active || this.#active.buildID !== request.buildID) return false;
    return this.#active.cancel();
  }

  /** Locks synchronously before snapshotting; the explicit request deadline covers worker startup through validation. */
  async build(input, resourceInput, { signal, onEvent = () => {} } = {}) {
    const request = validateBuildRequest(input);
    if (this.#active) throw new PipelineError("busy", "verifying", "A build is already active");
    if (signal !== undefined && (typeof AbortSignal !== "function" || !(signal instanceof AbortSignal))) throw new TypeError("Require an AbortSignal");
    if (typeof onEvent !== "function") throw new TypeError("Require an event callback");
    const active = { buildID: request.buildID, cancel: () => false };
    this.#active = active;
    let sequence = 0, stage = "verifying", settled = false;
    // Observer errors are isolated from compiler state and must never lose the terminal promise.
    const emit = fields => { try { onEvent(Object.freeze({ interfaceVersion: 1, buildID: request.buildID, sequence: ++sequence, ...fields })); } catch {} };
    let worker, stopPromise;
    const stop = () => stopPromise ??= Promise.resolve().then(() => worker?.terminate());
    try {
      return await new Promise((resolve, reject) => {
        let unsubscribe = () => {}, workerSequence = 1, terminalReceived = false;
        let phaseIndex = 0;
        const phases = ["verifying", "preprocessing", "compiling", "compiling", "linking", "validating", "packaging"];
        /** Chooses one outcome, suppresses late responses, disposes the worker, then releases ownership. */
        const finish = async (error, result) => {
          if (settled) return;
          settled = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel); unsubscribe();
          try { await stop(); } catch { error = new PipelineError("cleanup_failed", stage, "Worker termination failed"); }
          if (this.#active === active) this.#active = null;
          if (error) {
            if (!(error instanceof PipelineError)) error = new PipelineError("runtime_failed", stage, error.message);
            const diagnostics = error.diagnostics || [];
            for (const diagnostic of diagnostics) emit({ kind: "diagnostic", diagnostic });
            emit({ kind: "result", outcome: error.code === "cancelled" ? "cancelled" : error.code === "timed_out" ? "timed_out" : "failed",
              error: Object.freeze({ code: error.code, stage: error.stage, message: error.message }) });
            reject(error);
          } else {
            for (const diagnostic of result.diagnostics) emit({ kind: "diagnostic", diagnostic });
            emit({ kind: "result", outcome: "succeeded", artifact: Object.freeze({ format: result.format, filename: result.filename,
              bytes: result.bytes, sha256: result.sha256, reportJSON: result.reportJSON, receipt: result.receipt }) });
            resolve(result);
          }
        };
        const cancel = () => { if (settled) return false; void finish(new PipelineError("cancelled", stage, "Build cancelled")); return true; };
        active.cancel = cancel;
        const timer = setTimeout(() => { void finish(new PipelineError("timed_out", stage, "Build deadline exceeded")); }, request.options.deadlineMilliseconds);
        signal?.addEventListener("abort", cancel, { once: true });
        if (signal?.aborted) { cancel(); return; }
        try {
          const resources = snapshotResources(resourceInput);
          worker = this.#workerFactory();
          unsubscribe = worker.listen(async response => {
            if (settled || terminalReceived) return;
            try {
              validateWorkerMessage(response, request.buildID, workerSequence++);
              if (response.kind === "progress") {
                if (response.phase !== phases[phaseIndex++]) throw new PipelineError("invalid_response", stage, "Unexpected worker phase order");
                stage = response.phase; emit({ kind: "progress", phase: stage });
              } else if (response.kind === "failure") {
                terminalReceived = true;
                void finish(new PipelineError(response.error.code, response.error.stage, response.error.message, response.diagnostics));
              } else {
                if (phaseIndex !== phases.length) throw new PipelineError("invalid_response", stage, "Worker omitted a compiler phase");
                terminalReceived = true;
                await stop();
                const result = await verifyBuildResult(response.result, request);
                void finish(null, result);
              }
            } catch (error) { void finish(error); }
          }, error => { void finish(error); }, code => { if (!terminalReceived && !settled) void finish(new PipelineError("worker_exited", stage, `Worker exited before a result (${code})`)); });
          worker.postMessage({ request, resources }, [resources.serviceBytes.buffer]);
        } catch (error) { void finish(error); }
      });
    } finally {
      // Cleanup failure prevents publishing a success, but never leaves the controller permanently busy.
      if (this.#active === active) this.#active = null;
    }
  }
}

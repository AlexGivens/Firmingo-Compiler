import { validateDeclaredPackagingRequest } from "../src/contract.js";
import { packageDeclaredELF } from "../src/capsule.js";
import { canonicalJSON } from "../src/hash.js";
import { PipelineError, snapshotBytes } from "../src/pipeline-error.js";
import { MAXIMUM_ELF_BYTES } from "../src/elf.js";
import { validateDiagnostics } from "./messages.js";

const fields = (value, names) => {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Reflect.ownKeys(value).length === names.length && names.every(key => Object.hasOwn(descriptors, key)
    && Object.hasOwn(descriptors[key], "value") && descriptors[key].enumerable);
};
const fail = () => { throw new PipelineError("invalid_response", "packaging", "Invalid packaging worker response"); };

function browserWorker() {
  if (typeof Worker !== "function") throw new PipelineError("host_unavailable", "packaging", "Host must provide workers");
  const worker = new Worker(new URL("./preparation-worker.js", import.meta.url), { type: "module" });
  return { postMessage: message => worker.postMessage(message), terminate: () => worker.terminate(),
    listen(message, error) {
      const receive = event => message(event.data), failed = () => error(new Error("Packaging worker failed"));
      worker.addEventListener("message", receive); worker.addEventListener("error", failed); worker.addEventListener("messageerror", failed);
      return () => { worker.removeEventListener("message", receive); worker.removeEventListener("error", failed); worker.removeEventListener("messageerror", failed); };
    } };
}

/** Isolated service-free ELF packaging with bounded input, cancellation and termination before settlement. */
export class PackagingController {
  #active = null;
  #workerFactory;
  constructor({ workerFactory = browserWorker } = {}) {
    if (typeof workerFactory !== "function") throw new TypeError("Require a worker factory");
    this.#workerFactory = workerFactory;
  }
  async package(input, requestInput, { signal } = {}) {
    const request = validateDeclaredPackagingRequest(requestInput);
    const elf = snapshotBytes(input, 52, MAXIMUM_ELF_BYTES, "validating", "invalid_elf");
    if (this.#active) throw new PipelineError("busy", "packaging", "Packaging already active");
    if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError("Require an AbortSignal");
    const active = {}; this.#active = active;
    let worker, stopping;
    const stop = () => stopping ??= Promise.resolve().then(() => worker?.terminate());
    try {
      return await new Promise((resolve, reject) => {
        let settled = false, received = false, unsubscribe = () => {};
        const finish = async (error, artifact) => {
          if (settled) return;
          settled = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel); unsubscribe();
          try { await stop(); } catch { error = new PipelineError("cleanup_failed", "packaging", "Packaging worker termination failed"); }
          if (this.#active === active) this.#active = null;
          if (error) reject(error instanceof PipelineError ? error : new PipelineError(error.code || "runtime_failed", error.stage || "packaging", error.message));
          else resolve(artifact);
        };
        const cancel = () => { void finish(new PipelineError("cancelled", "packaging", "Packaging cancelled")); };
        const timer = setTimeout(() => { void finish(new PipelineError("timed_out", "packaging", "Packaging deadline exceeded")); }, request.options.deadlineMilliseconds);
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
                if (!fields(error, ["code", "stage", "message"]) || !["preprocessing", "validating", "packaging"].includes(error.stage)
                    || typeof error.code !== "string" || !/^[a-z_]{1,64}$/.test(error.code) || typeof error.message !== "string"
                    || new TextEncoder().encode(error.message).length > 4096 || error.message.includes("\0")) fail();
                void finish(new PipelineError(error.code, error.stage, error.message, response.diagnostics));
              } else {
                if (response.kind !== "packaged" || !fields(response, ["interfaceVersion", "buildID", "kind", "result"])
                    || !fields(response.result, ["format", "filename", "bytes", "sha256", "reportJSON", "receiptJSON"])) fail();
                const bytes = snapshotBytes(response.result.bytes, 260, 4096, "packaging", "invalid_response");
                // The trusted host rechecks bounded production output after disposal, before publishing a result.
                await stop();
                const expected = await packageDeclaredELF(elf, request, { signal });
                const expectedBytes = expected.bytes;
                for (const key of ["format", "filename", "sha256", "reportJSON"]) if (response.result[key] !== expected[key]) fail();
                if (response.result.receiptJSON !== canonicalJSON(expected.receipt)
                    || bytes.length !== expectedBytes.length || !bytes.every((value, index) => value === expectedBytes[index])) fail();
                void finish(null, expected);
              }
            } catch (error) { void finish(error); }
          }, error => { void finish(error); }, () => {
            if (!received && !settled) void finish(new PipelineError("worker_exited", "packaging", "Packaging worker exited before a result"));
          });
          worker.postMessage({ request, elfBytes: elf.slice() });
        } catch (error) { void finish(error); }
      });
    } finally { if (this.#active === active) this.#active = null; }
  }
}

/** Bounded source/packaging failure; never a build or deployment success. */
export class PipelineError extends Error {
  constructor(code, stage, message, diagnostics = []) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.stage = stage;
    this.diagnostics = Object.freeze(diagnostics.map(value => Object.freeze({ ...value })));
  }
}

/** Cooperative cancellation for bounded portable stages; synchronous WASM termination belongs to the worker host. */
export function checkCancellation(signal, stage) {
  if (signal?.aborted) throw new PipelineError("cancelled", stage, "Operation cancelled");
}

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength").get;
const buffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer").get;

/** Copies native byte storage without iterators/species/accessors; shared memory is not a stable build input. */
export function snapshotBytes(value, minimum, maximum, stage, code) {
  const fail = () => { throw new PipelineError(code, stage, "Expected bounded, nonshared binary bytes"); };
  if (!(value instanceof Uint8Array)) fail();
  let length, storage;
  try { length = byteLength.call(value); storage = buffer.call(value); } catch { fail(); }
  if (length < minimum || length > maximum
      || (typeof SharedArrayBuffer !== "undefined" && storage instanceof SharedArrayBuffer)) fail();
  const copy = new Uint8Array(length);
  copy.set(value);
  return copy;
}

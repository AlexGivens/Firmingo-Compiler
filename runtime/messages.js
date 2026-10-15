import { PipelineError } from "../src/pipeline-error.js";

export const PHASES = Object.freeze(["verifying", "preprocessing", "compiling", "linking", "validating", "packaging"]);
const severities = ["error", "warning", "note"];
const bounded = (value, maximum) => typeof value === "string" && !/[\u0000\ud800-\udfff]/u.test(value) && new TextEncoder().encode(value).length <= maximum;
const fields = (value, names) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join() === names.sort().join();
const fail = () => { throw new PipelineError("invalid_response", "verifying", "Invalid or uncorrelated worker response"); };

/** Validates bounded structured diagnostics, including explicit absent positions. */
export function validateDiagnostics(value) {
  if (!Array.isArray(value) || value.length > 128) fail();
  for (const item of value) {
    if (!fields(item, ["severity", "stage", "code", "message", "filename", "line", "column"])
        || !severities.includes(item.severity) || !PHASES.includes(item.stage) || !bounded(item.code, 64) || !/^[a-z_]+$/.test(item.code)
        || !bounded(item.message, 4096) || (item.filename !== null && !bounded(item.filename, 256))
        || [item.line, item.column].some(position => position !== null && (!Number.isSafeInteger(position) || position < 1))
        || (item.filename === null && (item.line !== null || item.column !== null))) fail();
  }
}

/** The internal worker envelope is closed, correlated, sequenced, bounded and never trusted as success by itself. */
export function validateWorkerMessage(value, buildID, sequence) {
  const common = ["interfaceVersion", "kind", "buildID", "sequence"];
  const extra = value?.kind === "progress" ? ["phase"] : value?.kind === "success" ? ["result"] : ["error", "diagnostics"];
  if (!fields(value, [...common, ...extra]) || value.interfaceVersion !== 1 || value.buildID !== buildID || value.sequence !== sequence
      || !["progress", "success", "failure"].includes(value.kind) || sequence > 16) fail();
  if (value.kind === "progress") { if (!PHASES.includes(value.phase)) fail(); }
  else if (value.kind === "failure") {
    if (!fields(value.error, ["code", "stage", "message"]) || !bounded(value.error.code, 64)
        || !/^[a-z_]+$/.test(value.error.code) || !PHASES.includes(value.error.stage) || !bounded(value.error.message, 4096)) fail();
    validateDiagnostics(value.diagnostics);
  } else {
    validateDiagnostics(value.result?.diagnostics);
    validateReceiptData(value.result?.receipt);
    if (value.result.diagnostics.some(item => item.severity === "error")) fail();
  }
}

/** Bounds receipt data before recursive canonicalization; structured-cloned cycles and excessive fields fail. */
export function validateReceiptData(value) {
  let nodes = 0;
  const seen = new Set();
  const visit = (item, depth) => {
    if (++nodes > 512 || depth > 8) fail();
    if (item === null || typeof item === "boolean") return;
    if (typeof item === "number") { if (!Number.isSafeInteger(item)) fail(); return; }
    if (typeof item === "string") { if (!bounded(item, 4096)) fail(); return; }
    if (!item || typeof item !== "object" || seen.has(item)) fail();
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) fail();
    seen.add(item);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
      if (Array.isArray(item) && key === "length") continue;
      if (!bounded(key, 128) || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) fail();
      visit(descriptor.value, depth + 1);
    }
    seen.delete(item);
  };
  visit(value, 0);
}

/** Validates public event shape; ordering is owned by the controller and checked by serialized consumers per build. */
export function validateRuntimeEvent(value) {
  const common = ["interfaceVersion", "buildID", "sequence", "kind"];
  if (!value || value.interfaceVersion !== 1 || !bounded(value.buildID, 128) || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value.buildID)
      || !Number.isSafeInteger(value.sequence) || value.sequence < 1 || value.sequence > 136) fail();
  if (value.kind === "progress") {
    if (!fields(value, [...common, "phase"]) || !PHASES.includes(value.phase)) fail();
  } else if (value.kind === "diagnostic") {
    if (!fields(value, [...common, "diagnostic"])) fail(); validateDiagnostics([value.diagnostic]);
  } else if (value.kind === "result" && value.outcome === "succeeded") {
    if (!fields(value, [...common, "outcome", "artifact"])) fail();
    const artifact = value.artifact;
    if (!fields(artifact, ["format", "filename", "bytes", "sha256", "reportJSON", "receipt"])
        || !["nano-managed-v1", "nano-managed-v2"].includes(artifact.format) || !bounded(artifact.filename, 96) || !/^[A-Za-z0-9_][A-Za-z0-9_. -]*\.fms$/.test(artifact.filename)
        || artifact.filename.includes("..") || !(artifact.bytes instanceof Uint8Array) || artifact.bytes.length < 260 || artifact.bytes.length > 4096
        || artifact.bytes.length % 4 || !/^[0-9a-f]{64}$/.test(artifact.sha256) || !bounded(artifact.reportJSON, 16384)) fail();
    validateReceiptData(artifact.receipt);
    if (artifact.receipt.receiptSchema !== "firmingo-compiler-build-v1" || artifact.receipt.buildID !== value.buildID
        || artifact.receipt.capsuleBytes !== artifact.bytes.length || artifact.receipt.capsuleSHA256 !== artifact.sha256) fail();
  } else if (value.kind === "result" && ["failed", "cancelled", "timed_out"].includes(value.outcome)) {
    if (!fields(value, [...common, "outcome", "error"]) || !fields(value.error, ["code", "stage", "message"])
        || !bounded(value.error.code, 64) || !/^[a-z_]+$/.test(value.error.code) || !PHASES.includes(value.error.stage) || !bounded(value.error.message, 4096)) fail();
    if (value.outcome === "cancelled" && value.error.code !== "cancelled") fail();
    if (value.outcome === "timed_out" && value.error.code !== "timed_out") fail();
  } else fail();
  return value;
}

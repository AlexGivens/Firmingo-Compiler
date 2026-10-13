import { ContractError } from "./errors.js";
import { LIMITS, NANO_BASELINE } from "./limits.js";
import { parseContractJSON } from "./json.js";
import { dataIdentity } from "./hash.js";

const descriptorFields = ["schema", "board", "profile", "backend", "firmwareVersion", "firmwareCommit",
  "residentELFSHA256", "firmwareImageSHA256", "buildReportSHA256", "apiAddress", "residentABI", "targetID",
  "maximumCapsuleBytes", "recipeIdentifier", "recipeSHA256", "qualification"];

function reject(code, path, message) { throw new ContractError(code, path, message); }

/** Accepts data objects only; unknown fields, prototypes and accessors cannot alter the contract. */
function object(value, fields, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    reject("invalid_input", path, "Expected a contract data object");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== fields.length
      || fields.some(key => !Object.hasOwn(descriptors, key)
        || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) {
    reject("invalid_input", path, "Missing, unknown, or non-data field");
  }
}

function equal(value, expected, path, code = "invalid_input") {
  if (value !== expected) reject(code, path, "Unsupported contract value");
}

function integer(value, minimum, maximum, path) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    reject("invalid_input", path, "Expected an integer within the contract bounds");
  }
}

function text(value, maximum, path, pattern) {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum
      || /[\u0000\ud800-\udfff]/u.test(value)
      || new TextEncoder().encode(value).length > maximum || (pattern && !pattern.test(value))) {
    reject("invalid_input", path, "Invalid or oversized contract text");
  }
}

/** Validates static declarations without authenticating a build or associating a physical device. */
export function validateFirmwareBuildDescriptor(value) {
  const path = "$.target.firmwareBuild";
  object(value, descriptorFields, path);
  equal(value.schema, 1, `${path}.schema`, "unsupported_version");
  for (const key of ["board", "profile", "recipeIdentifier", "recipeSHA256", "residentABI", "targetID", "maximumCapsuleBytes"]) {
    equal(value[key], NANO_BASELINE[key], `${path}.${key}`, "unsupported_target");
  }
  equal(value.backend, "application", `${path}.backend`, "unsupported_target");
  equal(value.qualification, "experimental", `${path}.qualification`, "unsupported_target");
  text(value.firmwareVersion, 64, `${path}.firmwareVersion`, /^[A-Za-z0-9._-]+$/);
  text(value.firmwareCommit, 40, `${path}.firmwareCommit`, /^[0-9a-f]{40}$/);
  for (const key of ["residentELFSHA256", "firmwareImageSHA256", "buildReportSHA256"]) {
    text(value[key], 64, `${path}.${key}`, /^[0-9a-f]{64}$/);
  }
  integer(value.apiAddress, 0x10000000, 0x101ffffc, `${path}.apiAddress`);
  if (value.apiAddress % 4 !== 0) reject("invalid_input", `${path}.apiAddress`, "Unaligned resident API address");
  return Object.freeze(Object.fromEntries(descriptorFields.map(key => [key, value[key]])));
}

function envelope(value, kind, fields) {
  object(value, fields, "$");
  equal(value.interfaceVersion, 1, "$.interfaceVersion", "unsupported_version");
  equal(value.kind, kind, "$.kind");
  text(value.buildID, LIMITS.identifierBytes, "$.buildID", /^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
}

/** Snapshots and validates one unprepared single-file build request; it does not compile or deploy. */
export function validateBuildRequest(value) {
  envelope(value, "build", ["interfaceVersion", "kind", "buildID", "source", "target", "options"]);
  object(value.source, ["filename", "revision", "text"], "$.source");
  const source = value.source;
  text(source.filename, LIMITS.filenameBytes, "$.source.filename", /^[A-Za-z0-9_][A-Za-z0-9_. -]*\.ino$/);
  if (source.filename.includes("..")) reject("invalid_input", "$.source.filename", "Unsafe source leaf name");
  text(source.revision, LIMITS.identifierBytes, "$.source.revision", /^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
  text(source.text, LIMITS.sourceBytes, "$.source.text");
  const bindingKey = value.target && typeof value.target === "object" && Object.hasOwn(value.target, "residentBinding") ? "residentBinding" : "firmwareBuild";
  object(value.target, ["board", "profile", "recipeIdentifier", "recipeSHA256", bindingKey], "$.target");
  for (const key of ["board", "profile", "recipeIdentifier", "recipeSHA256"]) {
    equal(value.target[key], NANO_BASELINE[key], `$.target.${key}`, "unsupported_target");
  }
  const binding = bindingKey === "firmwareBuild" ? validateFirmwareBuildDescriptor(value.target.firmwareBuild) : validateResidentBinding(value.target.residentBinding);
  object(value.options, ["deadlineMilliseconds"], "$.options");
  integer(value.options.deadlineMilliseconds, 1, LIMITS.deadlineMilliseconds, "$.options.deadlineMilliseconds");
  return Object.freeze({ interfaceVersion: 1, kind: "build", buildID: value.buildID,
    source: Object.freeze({ filename: source.filename, revision: source.revision, text: source.text }),
    target: Object.freeze({ ...nanoTarget(), [bindingKey]: binding }),
    options: Object.freeze({ deadlineMilliseconds: value.options.deadlineMilliseconds }) });
}

function nanoTarget() {
  const { board, profile, recipeIdentifier, recipeSHA256 } = NANO_BASELINE;
  return { board, profile, recipeIdentifier, recipeSHA256 };
}

/** Rejects duplicate keys and oversized JSON before production build validation. */
export function parseBuildRequest(json) { return validateBuildRequest(parseContractJSON(json)); }

/** Validates cancellation correlation only; runtime cancellation is a later implementation stage. */
export function validateCancelRequest(value) {
  envelope(value, "cancel", ["interfaceVersion", "kind", "buildID"]);
  return Object.freeze({ interfaceVersion: 1, kind: "cancel", buildID: value.buildID });
}

/** Identifies exact validated request data, including revision/correlation/deadline; never artifact provenance. */
export async function requestIdentity(request) { return dataIdentity(validateBuildRequest(request)); }

/** Preserves the SDK's descriptor ID for unchanged schema-one scalar metadata. */
export async function firmwareBuildIdentity(descriptor) { return dataIdentity(validateFirmwareBuildDescriptor(descriptor)); }


/** Minimal static requirements for legacy wrappers; no device identity or invented full-build metadata. */
export function validateResidentBinding(value) {
  const path = "$.target.residentBinding";
  const fields = ["schema", "board", "profile", "residentELFSHA256", "firmwareImageSHA256", "apiAddress", "residentABI", "targetID", "maximumCapsuleBytes"];
  object(value, fields, path);
  equal(value.schema, 1, `${path}.schema`, "unsupported_version");
  for (const key of ["board", "profile", "residentABI", "targetID", "maximumCapsuleBytes"]) equal(value[key], NANO_BASELINE[key], `${path}.${key}`, "unsupported_target");
  for (const key of ["residentELFSHA256", "firmwareImageSHA256"]) text(value[key], 64, `${path}.${key}`, /^[0-9a-f]{64}$/);
  integer(value.apiAddress, 0x10000000, 0x101ffffc, `${path}.apiAddress`);
  if (value.apiAddress % 4) reject("invalid_input", `${path}.apiAddress`, "Unaligned resident API address");
  return Object.freeze(Object.fromEntries(fields.map(key => [key, value[key]])));
}

/** Returns explicit validated static constraints without inferring missing descriptor facts. */
export function staticTarget(request) { return request.target.firmwareBuild ?? request.target.residentBinding; }

/** Distinguishes full descriptors from minimal static bindings by their closed required fields. */
export function validateStaticTarget(value) {
  return value && typeof value === "object" && Object.hasOwn(value, "firmwareVersion") ? validateFirmwareBuildDescriptor(value) : validateResidentBinding(value);
}
export function residentBindingIdentity(value) { return dataIdentity(validateResidentBinding(value)); }

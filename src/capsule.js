import { validateBuildRequest, validateDeclaredPackagingRequest, staticTarget, validateStaticTarget } from "./contract.js";
import { prepareSketch, preparePackagingSketch } from "./preprocess.js";
import { parseELF, CODE_ADDRESS, MAXIMUM_ELF_BYTES } from "./elf.js";
import { canonicalJSON, dataIdentity, sha256 } from "./hash.js";
import { PipelineError, checkCancellation, snapshotBytes } from "./pipeline-error.js";

/** Snapshots bounded declared build metadata; it cannot attest source association or actual service use. */
function provenanceSnapshot(value, target) {
  const fields = ["compiler", "recipeIdentifier", "recipeSHA256", "toolchainSHA256"];
  const fail = () => { throw new PipelineError("invalid_provenance", "packaging", "Invalid or incompatible declared compiler provenance"); };
  if (value === null || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      || Reflect.ownKeys(value).length !== fields.length) fail();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (fields.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], "value") || !descriptors[key].enumerable)) fail();
  if (typeof value.compiler !== "string" || !value.compiler.length || value.compiler.length > 256
      || /[\u0000\ud800-\udfff]/u.test(value.compiler) || new TextEncoder().encode(value.compiler).length > 256
      || value.recipeIdentifier !== target.recipeIdentifier || value.recipeSHA256 !== target.recipeSHA256
      || typeof value.toolchainSHA256 !== "string" || !/^[0-9a-f]{64}$/.test(value.toolchainSHA256)) fail();
  return Object.freeze(Object.fromEntries(fields.map(key => [key, value[key]])));
}

const address = value => "0x" + value.toString(16).padStart(8, "0");

/** Validates FMS1 size/header/binding/entry/digest without trusting a report or authorizing deployment. */
export async function validateCapsule(input, descriptorInput, { signal } = {}) {
  checkCancellation(signal, "validating");
  const descriptor = validateStaticTarget(descriptorInput);
  return validateBoundCapsule(input, descriptor, signal);
}

async function validateBoundCapsule(input, descriptor, signal) {
  const bytes = snapshotBytes(input, 257, descriptor.maximumCapsuleBytes, "validating", "invalid_capsule");
  const view = new DataView(bytes.buffer);
  const u16 = offset => view.getUint16(offset, true), u32 = offset => view.getUint32(offset, true);
  const fail = message => { throw new PipelineError("invalid_capsule", "validating", message); };
  if (![70, 77, 83, 49].every((value, index) => bytes[index] === value) || u16(4) !== 1 || u16(6) !== 64
      || u32(8) !== 0x4f4e414e || u32(12) !== descriptor.apiAddress || u32(16) !== CODE_ADDRESS
      || !bytes.subarray(64, 256).every(value => value === 0)) fail("Invalid FMS1 header, padding, board or API binding");
  const codeBytes = u32(20), setupAddress = u32(24), loopAddress = u32(28);
  const entry = value => value % 2 === 1 && value - 1 >= CODE_ADDRESS && value - 1 - CODE_ADDRESS < codeBytes;
  if (!codeBytes || codeBytes !== bytes.length - 256 || !entry(setupAddress) || !entry(loopAddress)) fail("Invalid FMS1 length or Thumb entry point");
  const [codeSHA256, capsuleSHA256] = await Promise.all([sha256(bytes.subarray(256)), sha256(bytes)]);
  const storedHash = [...bytes.subarray(32, 64)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (storedHash !== codeSHA256) fail("FMS1 code digest mismatch");
  checkCancellation(signal, "validating");
  return Object.freeze({ codeBytes, setupAddress, loopAddress, codeSHA256, capsuleSHA256, capsuleBytes: bytes.length });
}

/** Packages independently linked ELF against actual prepared source identity; no source-to-code assertion is made. */
export async function packageELF(input, requestInput, provenanceInput, { signal } = {}) {
  checkCancellation(signal, "packaging");
  const request = validateBuildRequest(requestInput);
  return packageValidatedELF(input, request, provenanceSnapshot(provenanceInput, request.target), signal, false);
}

/** Packages supplied ELF with declared recipe provenance; no service, source-to-code proof or execution receipt. */
export async function packageDeclaredELF(input, requestInput, { signal } = {}) {
  checkCancellation(signal, "packaging");
  const request = validateDeclaredPackagingRequest(requestInput);
  return packageValidatedELF(input, request, request.provenance, signal, true);
}

async function packageValidatedELF(input, request, provenance, signal, declared) {
  const binding = staticTarget(request);
  const elfBytes = snapshotBytes(input, 52, MAXIMUM_ELF_BYTES, "validating", "invalid_elf");
  const image = parseELF(elfBytes, { signal });
  const prepared = await (declared ? preparePackagingSketch : prepareSketch)(request, { signal });
  const code = image.code;
  const [codeSHA256, linkedELFSHA256, firmwareBuildID] = await Promise.all([
    sha256(code), sha256(elfBytes), dataIdentity(binding),
  ]);
  checkCancellation(signal, "packaging");
  const bytes = new Uint8Array(256 + code.length), view = new DataView(bytes.buffer);
  bytes.set([70, 77, 83, 49]);
  view.setUint16(4, 1, true); view.setUint16(6, 64, true);
  for (const [offset, value] of [[8, 0x4f4e414e], [12, binding.apiAddress], [16, CODE_ADDRESS],
    [20, code.length], [24, image.setupAddress], [28, image.loopAddress]]) view.setUint32(offset, value, true);
  bytes.set(Uint8Array.from(codeSHA256.match(/../g), pair => parseInt(pair, 16)), 32);
  bytes.set(code, 256);
  const checked = await validateBoundCapsule(bytes, binding, signal);
  const report = Object.freeze({
    status: "structurally validated packaging; compiler/source association is host supplied; no hardware proof",
    board: request.target.board, image_format: request.target.profile,
    target_id: binding.targetID, max_install_bytes: binding.maximumCapsuleBytes,
    api_address: address(binding.apiAddress), resident_elf_sha256: binding.residentELFSHA256,
    setup_address: address(image.setupAddress), loop_address: address(image.loopAddress),
    code_bytes: code.length, code_sha256: codeSHA256, capsule_bytes: bytes.length, capsule_sha256: checked.capsuleSHA256,
    source_sha256: Object.freeze({ [`sketch/${request.source.filename}`]: prepared.sourceSHA256,
      "generated/Sketch.cpp": prepared.translationUnitSHA256, "recipe/manifest.json": provenance.recipeSHA256,
      "toolchain/manifest.json": provenance.toolchainSHA256 }),
    compiler: provenance.compiler, recipe_id: provenance.recipeIdentifier, linked_elf_sha256: linkedELFSHA256,
  });
  const receiptInputs = Object.freeze({
    receiptSchema: declared ? "firmingo-compiler-declared-packaging-v1" : "firmingo-compiler-packaging-v1", operation: "independent_elf_packaging", provenanceStatus: "declared",
    requestSHA256: prepared.requestSHA256, buildID: request.buildID, sourceRevision: request.source.revision,
    sourceFilename: request.source.filename, sourceSHA256: prepared.sourceSHA256,
    translationUnitSHA256: prepared.translationUnitSHA256, ...(request.target.firmwareBuild ? { firmwareBuildID } : { residentBindingID: firmwareBuildID }),
    board: request.target.board, profile: request.target.profile, provenance,
  });
  const receipt = Object.freeze({ ...receiptInputs, buildInputSHA256: await dataIdentity(receiptInputs),
    linkedELFSHA256, capsuleSHA256: checked.capsuleSHA256, capsuleBytes: bytes.length });
  checkCancellation(signal, "packaging");
  return Object.freeze({ format: request.target.profile, filename: request.source.filename.slice(0, -4) + ".fms",
    get bytes() { return bytes.slice(); }, sha256: checked.capsuleSHA256,
    reportJSON: canonicalJSON(report), receipt, ...(request.target.firmwareBuild ? { firmwareBuild: binding } : { residentBinding: binding }) });
}

import { validateBuildRequest, staticTarget } from "../src/contract.js";
import { createNanoJobs, verifyNanoRecipe } from "../src/nano-recipe.js";
import { packageELF } from "../src/capsule.js";
import { parseELF } from "../src/elf.js";
import { PipelineError, snapshotBytes } from "../src/pipeline-error.js";
import { canonicalJSON, dataIdentity } from "../src/hash.js";
import { compileModule, ManagedService } from "./ManagedService.js";
import { SERVICE, SHIM, RECIPE_ASSETS } from "./pins.js";

/** Owns all build bytes before suspension; only the pinned resource set can be used. */
export function snapshotResources(value) {
  const fail = () => { throw new PipelineError("invalid_resources", "verifying", "Require serviceBytes, recipeManifest and recipeAssets only"); };
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail();
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== 3 || ["serviceBytes", "recipeManifest", "recipeAssets"].some(key => !Object.hasOwn(fields[key] || {}, "value"))) fail();
  const paths = ["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"];
  const assets = fields.recipeAssets.value;
  if (!assets || typeof assets !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(assets))) fail();
  const descriptors = Object.getOwnPropertyDescriptors(assets);
  if (Reflect.ownKeys(descriptors).length !== paths.length || paths.some(key => !Object.hasOwn(descriptors[key] || {}, "value"))) fail();
  return { serviceBytes: snapshotBytes(fields.serviceBytes.value, SERVICE.bytes, SERVICE.bytes, "verifying", "invalid_service"),
    recipeManifest: snapshotBytes(fields.recipeManifest.value, 1, 16384, "verifying", "invalid_recipe"),
    recipeAssets: Object.fromEntries(paths.map(path => [path, snapshotBytes(descriptors[path].value, 1, 65536, "verifying", "invalid_recipe")])) };
}

/** The service byte identity also identifies the complete embedded Clang/LLD toolchain. */
export async function executionProvenance(request) {
  return { compiler: SERVICE.compiler, recipeIdentifier: request.target.recipeIdentifier,
    recipeSHA256: request.target.recipeSHA256, toolchainSHA256: await dataIdentity({ schema: 1, service: SERVICE }) };
}

/** Distinct execution receipt; integrity is verified against pins, publisher/hardware trust is not inferred. */
export async function compilationReceipt(packagingReceipt) {
  const { linkedELFSHA256, capsuleSHA256, capsuleBytes, buildInputSHA256: _packagingInput, ...input } = packagingReceipt;
  const fields = { ...input, receiptSchema: "firmingo-compiler-build-v1", operation: "wasm_compile_link_package",
    provenanceStatus: "pinned_assets_executed", interfaceVersion: 1, service: SERVICE, wasiShim: SHIM, toolchainManifest: { schema: 1, service: SERVICE }, recipeAssets: RECIPE_ASSETS };
  const receipt = { ...fields, buildInputSHA256: await dataIdentity(fields), linkedELFSHA256, capsuleSHA256, capsuleBytes };
  const freeze = value => { if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } return value; };
  return freeze(receipt);
}

/** Runs one real compiler in a fresh WASI workspace; only the worker host may invoke this synchronous work. */
export async function executeBuild(requestInput, resourcesInput, progress = () => {}) {
  let stage = "verifying";
  const phase = value => { stage = value; progress(value); };
  try {
    const request = validateBuildRequest(requestInput), resources = snapshotResources(resourcesInput);
    phase("verifying");
    const recipe = await verifyNanoRecipe(resources.recipeManifest, resources.recipeAssets);
    const module = await compileModule(resources.serviceBytes, SERVICE);
    phase("preprocessing");
    const { prepared } = await createNanoJobs(request);
    const service = await ManagedService.create(module, new Map(["Arduino.h", "Entry.cpp", "Module.ld"]
      .map(name => [name, recipe.assets["Recipe/" + name]])));
    const result = service.run({ schema: 1, recipe: request.target.recipeIdentifier, board: request.target.board,
      profile: request.target.profile, filename: request.source.filename, translationUnit: prepared.translationUnit,
      apiAddress: staticTarget(request).apiAddress }, phase);
    // Physical generated-file lines are mapped by the service; original #line filenames are already logical.
    for (const diagnostic of result.diagnostics) {
      if (diagnostic.filename === request.source.filename && diagnostic.line === 1 && diagnostic.column !== null)
        diagnostic.column += prepared.sourceBOMBytes;
    }
    if (!result.succeeded) throw new PipelineError(stage === "linking" ? "link_failed" : "compile_failed", stage,
      "Compiler service rejected the sketch", result.diagnostics);
    phase("validating"); parseELF(result.elf);
    phase("packaging");
    const artifact = await packageELF(result.elf, request, await executionProvenance(request));
    return { linkedELF: result.elf, capsuleBytes: artifact.bytes, reportJSON: artifact.reportJSON,
      receipt: await compilationReceipt(artifact.receipt), diagnostics: result.diagnostics, timings: result.timings, memoryBytes: result.memoryBytes };
  } catch (error) {
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(stage === "verifying" ? "invalid_service" : "runtime_failed", stage, error.message);
  }
}

/** Parent-side artifact/correlation gate reruns independent packaging and checks the exact receipt. */
export async function verifyBuildResult(value, request) {
  const fail = () => { throw new PipelineError("invalid_response", "validating", "Worker result does not match the accepted build"); };
  if (!value || Object.keys(value).sort().join() !== "capsuleBytes,diagnostics,linkedELF,memoryBytes,receipt,reportJSON,timings") fail();
  const elf = snapshotBytes(value.linkedELF, 52, 2097152, "validating", "invalid_response");
  const capsule = snapshotBytes(value.capsuleBytes, 257, 4096, "validating", "invalid_response");
  if (typeof value.reportJSON !== "string" || value.reportJSON.length > 16384 || !Number.isSafeInteger(value.memoryBytes)
      || value.memoryBytes < 1 || value.memoryBytes > SERVICE.maximumMemoryBytes) fail();
  if (!Array.isArray(value.timings) || value.timings.length !== 3 || value.timings.some((item, index) =>
    Object.keys(item).sort().join() !== "milliseconds,phase" || item.phase !== ["compiling", "compiling", "linking"][index]
      || typeof item.milliseconds !== "number" || !Number.isFinite(item.milliseconds) || item.milliseconds < 0 || item.milliseconds > 60000)) fail();
  const artifact = await packageELF(elf, request, await executionProvenance(request));
  const receipt = await compilationReceipt(artifact.receipt);
  const expectedCapsule = artifact.bytes;
  if (value.reportJSON !== artifact.reportJSON || canonicalJSON(value.receipt) !== canonicalJSON(receipt)
      || !capsule.every((byte, index) => byte === expectedCapsule[index]) || capsule.length !== expectedCapsule.length) fail();
  const timings = Object.freeze(value.timings.map(item => Object.freeze({ ...item })));
  return Object.freeze({ ...artifact, get bytes() { return artifact.bytes; }, receipt: Object.freeze(receipt), get linkedELF() { return elf.slice(); },
    diagnostics: Object.freeze(value.diagnostics.map(item => Object.freeze({ ...item }))), timings, memoryBytes: value.memoryBytes });
}

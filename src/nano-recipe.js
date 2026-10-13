import { staticTarget } from "./contract.js";
import { NANO_BASELINE } from "./limits.js";
import { parseContractJSON } from "./json.js";
import { sha256 } from "./hash.js";
import { PipelineError, snapshotBytes, checkCancellation } from "./pipeline-error.js";
import { prepareSketch } from "./preprocess.js";
import { makeJobs } from "../recipes/nano_rp2040_connect/Sources/ManagedRecipe.js";

const paths = ["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"];

/** Verifies the unchanged pinned recipe and copies its assets before async hashing. */
export async function verifyNanoRecipe(manifestInput, assetInput, { signal } = {}) {
  checkCancellation(signal, "verifying");
  const fail = () => { throw new PipelineError("invalid_recipe", "verifying", "Missing, corrupt or incompatible Nano recipe assets"); };
  const manifest = snapshotBytes(manifestInput, 1, 16384, "verifying", "invalid_recipe");
  if (assetInput === null || typeof assetInput !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(assetInput))
      || Reflect.ownKeys(assetInput).length !== paths.length) fail();
  const descriptors = Object.getOwnPropertyDescriptors(assetInput);
  if (paths.some(path => !Object.hasOwn(descriptors, path) || !Object.hasOwn(descriptors[path], "value"))) fail();
  const snapshots = Object.fromEntries(paths.map(path => [path, snapshotBytes(assetInput[path], 1, 65536, "verifying", "invalid_recipe")]));
  if (await sha256(manifest) !== NANO_BASELINE.recipeSHA256) fail();
  const metadata = parseContractJSON(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(manifest));
  if (metadata.schema !== 1 || metadata.serviceABI !== 2 || metadata.recipe !== NANO_BASELINE.recipeIdentifier
      || metadata.board !== NANO_BASELINE.board || metadata.profile !== NANO_BASELINE.profile
      || metadata.maximumCodeBytes !== 3840 || metadata.assets.length !== paths.length) fail();
  const verified = {};
  for (const asset of metadata.assets) {
    const bytes = snapshots[asset.path];
    if (!bytes || bytes.length !== asset.bytes || await sha256(bytes) !== asset.sha256) fail();
    Object.defineProperty(verified, asset.path, { enumerable: true, get: () => bytes.slice() });
  }
  checkCancellation(signal, "verifying");
  return Object.freeze({ recipeIdentifier: metadata.recipe, recipeSHA256: NANO_BASELINE.recipeSHA256,
    serviceABI: metadata.serviceABI, assets: Object.freeze(verified) });
}

/** Produces fixed response-file jobs from portable preparation; does not execute the service or verify assets. */
export async function createNanoJobs(request, options = {}) {
  const prepared = await prepareSketch(request, options);
  const { board, profile, recipeIdentifier } = prepared.request.target;
  const jobs = makeJobs({ schema: 1, recipe: recipeIdentifier, board, profile,
    filename: prepared.request.source.filename, translationUnit: prepared.translationUnit,
    apiAddress: staticTarget(prepared.request).apiAddress });
  return Object.freeze({ prepared, jobs: Object.freeze(jobs.map(job => {
    const bytes = Uint8Array.from(job.bytes);
    return Object.freeze({ phase: job.phase, path: job.path, get bytes() { return bytes.slice(); } });
  })) });
}

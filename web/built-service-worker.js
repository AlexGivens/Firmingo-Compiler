import { serviceExecutionChecks } from "./service-execution.js";
import { fetchBytes, loadRecipe } from "./resource-loading.js";

/** A single maintenance job; external worker termination interrupts synchronous compiler work. */
globalThis.addEventListener("message", async event => {
  const { id, config, mode, corruptRecipe } = event.data;
  try {
    if (!Number.isInteger(id) || !config || config.schema !== 1) throw new Error("Invalid maintenance job");
    const { recipeManifest, recipeAssets: assets } = await loadRecipe();
    if (corruptRecipe) assets["Recipe/Arduino.h"][0] ^= 1;
    const bytes = await fetchBytes("/candidate-service.wasm", config.identity.bytes);
    const result = await serviceExecutionChecks({ bytes, expectedSHA256: config.identity.sha256,
      descriptor: config.descriptor, recipeManifest, assets }, { mode, onPhase: phase => postMessage({ id, phase }) });
    postMessage({ id, result });
  } catch (error) { postMessage({ id, error: { code: error.code || "check_failed", message: error.message } }); }
}, { once: true });

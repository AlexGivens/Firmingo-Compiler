import { verifyNanoRecipe } from "../src/nano-recipe.js";

/** Rejects absent/invalid declared lengths and enforces the observed byte cap on local responses. */
export async function fetchBytes(path, maximum) {
  const cancellation = new AbortController();
  const timer = setTimeout(() => cancellation.abort(), 15000);
  let response;
  try {
    response = await fetch(path, { signal: cancellation.signal, cache: "no-store", credentials: "omit", redirect: "error" });
    if (!response.ok || !response.body) throw new Error("Local harness resource unavailable");
    const length = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(length) || length < 1 || length > maximum) {
      await response.body.cancel(); throw new Error("Local harness resource exceeds byte bounds");
    }
    const bytes = new Uint8Array(length), reader = response.body.getReader();
    let offset = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        if (value.length > bytes.length - offset) throw new Error("Resource exceeded its declared byte count");
        bytes.set(value, offset); offset += value.length;
      }
      if (offset !== length) throw new Error("Resource omitted declared bytes");
      return bytes;
    } catch (error) { await reader.cancel(); throw error; }
    finally { reader.releaseLock(); }
  } finally { clearTimeout(timer); }
}

/** Loads exact package recipe bytes; no library discovery or arbitrary asset URLs exist. */
export async function loadRecipe() {
  const base = "/recipes/nano_rp2040_connect/";
  const paths = ["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"];
  const [recipeManifest, ...bytes] = await Promise.all([fetchBytes(base + "manifest.json", 16384), ...paths.map(path => fetchBytes(base + path, 65536))]);
  const recipeAssets = Object.fromEntries(paths.map((path, index) => [path, bytes[index]]));
  await verifyNanoRecipe(recipeManifest, recipeAssets);
  return { recipeManifest, recipeAssets };
}


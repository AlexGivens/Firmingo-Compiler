import { readFileSync } from "node:fs";
import { verifyNanoRecipe } from "../src/index.js";

/** Runs production integrity checks over the actual local recipe without sibling inputs. */
export async function verifyRecipe() {
  const root = new URL("../recipes/nano_rp2040_connect/", import.meta.url);
  const assets = Object.fromEntries(["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"]
    .map(path => [path, new Uint8Array(readFileSync(new URL(path, root)))]));
  await verifyNanoRecipe(new Uint8Array(readFileSync(new URL("manifest.json", root))), assets);
  console.log("Verified pinned Nano recipe and four assets; no compiler service executed");
}

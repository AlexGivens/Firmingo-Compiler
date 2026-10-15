import { readFileSync } from "node:fs";
import { verifyNanoRecipe } from "../src/index.js";

/** Runs production integrity checks over the actual local recipe without sibling inputs. */
export async function verifyRecipe() {
  for (const directory of ["nano_rp2040_connect", "nano_rp2040_connect_v2"]) {
    const root = new URL(`../recipes/${directory}/`, import.meta.url);
    const assets = Object.fromEntries(["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"]
      .map(path => [path, new Uint8Array(readFileSync(new URL(path, root)))]));
    await verifyNanoRecipe(new Uint8Array(readFileSync(new URL("manifest.json", root))), assets);
  }
  console.log("Verified both pinned Nano recipes and eight assets; no compiler service executed");
}

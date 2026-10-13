import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";
import { boundMemory, memoryLimits } from "../runtime/ModuleMemory.js";
import { SERVICE } from "../runtime/pins.js";

export const ORIGINAL_SERVICE = Object.freeze({ bytes: 101196042,
  sha256: "bce6632512852bf86baf7ca7b6eddd07209c0c4e29ae3b2288ec27e69028887d" });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

/** Explicit development-only transformation; source and existing outputs are never overwritten. */
export function boundService(sourcePath, outputDirectory) {
  const source = readBounded(resolve(sourcePath), ORIGINAL_SERVICE.bytes);
  if (source.length !== ORIGINAL_SERVICE.bytes || hash(source) !== ORIGINAL_SERVICE.sha256)
    throw new Error("Require the exact pinned original development service");
  const sourceMemory = memoryLimits(source), derived = boundMemory(source), derivedMemory = memoryLimits(derived);
  if (derived.length !== SERVICE.bytes || hash(derived) !== SERVICE.sha256 || derivedMemory.maximum !== 4096)
    throw new Error("Memory adaptation does not reproduce the pinned bounded service");
  // Compare untouched ranges independently of the producer: every other section remains verbatim.
  if (Buffer.compare(source.subarray(0, sourceMemory.sectionStart), derived.subarray(0, derivedMemory.sectionStart))
      || Buffer.compare(source.subarray(sourceMemory.sectionEnd), derived.subarray(derivedMemory.sectionEnd)))
    throw new Error("Memory adaptation changed another WASM section");
  const receipt = { schema: 1, operation: "development_service_memory_bound", source: ORIGINAL_SERVICE,
    derived: { bytes: derived.length, sha256: hash(derived) }, sourceMemory, derivedMemory,
    maximumMemoryBytes: SERVICE.maximumMemoryBytes,
    adaptation: "Only defined-memory limits and section length change; other sections remain verbatim.",
    distribution: "unresolved; explicit local development derivative, not approved release assets" };
  const output = resolve(outputDirectory); mkdirSync(output);
  writeFileSync(join(output, "compiler-bounded.wasm"), derived, { flag: "wx" });
  writeFileSync(join(output, "memory-receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  return receipt;
}

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";
import { memoryLimits, requireBoundedMemory } from "../runtime/ModuleMemory.js";

const recipe = JSON.parse(readFileSync(new URL("../service/recipe.json", import.meta.url)));

/** Static build-output validation only: no service instantiation, compatibility promotion or distribution. */
export function inspectService(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 || bytes.length > 128 * 1024 * 1024) throw new Error("Invalid bounded service artifact");
  requireBoundedMemory(bytes);
  const module = new WebAssembly.Module(bytes), memory = memoryLimits(bytes);
  const exports = WebAssembly.Module.exports(module).sort((a, b) => a.name.localeCompare(b.name));
  const imports = WebAssembly.Module.imports(module).sort((a, b) => (a.module + "." + a.name).localeCompare(b.module + "." + b.name));
  const expected = [...recipe.exports, "_initialize", "memory"].sort();
  if (exports.map(entry => entry.name).sort().join() !== expected.join()
      || exports.some(entry => entry.kind !== (entry.name === "memory" ? "memory" : "function"))
      || imports.some(entry => entry.module !== "wasi_snapshot_preview1" || entry.kind !== "function")) throw new Error("Unsupported built service import/export shape");
  return { schema: 1, status: "statically_validated_owned_service", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"), imports, exports,
    memory: { minimumPages: memory.minimum, maximumPages: memory.maximum },
    declaredServiceABI: recipe.serviceABI, instantiated: false, distributionStatus: "unresolved" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Select one explicit built service path");
    console.log(JSON.stringify(inspectService(readBounded(process.argv[2], 128 * 1024 * 1024))));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

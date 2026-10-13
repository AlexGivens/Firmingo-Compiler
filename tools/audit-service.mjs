import { readFileSync, lstatSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";
import { canonicalJSON } from "../src/hash.js";
import { memoryLimits } from "../runtime/ModuleMemory.js";

const referenceBytes = readFileSync(new URL("../docs/service-reference.json", import.meta.url));
const reference = JSON.parse(referenceBytes);
const original = { bytes: 101196042, sha256: "bce6632512852bf86baf7ca7b6eddd07209c0c4e29ae3b2288ec27e69028887d" };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const decode = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes);

function git(root, args, maximum = 2 * 1024 * 1024) {
  const result = spawnSync("git", ["--no-optional-locks", "--no-replace-objects", "-c", "core.fsmonitor=false", "-C", root, ...args],
    { env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" }, maxBuffer: maximum, timeout: 15000 });
  if (result.error || result.status !== 0) throw new Error("Service audit Git metadata/owned-patch operation failed");
  return result.stdout;
}

function leaf(root, path) {
  if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.startsWith("/") || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Unsafe service input path");
  let current = root;
  for (const part of path.split("/")) { current = join(current, part); if (lstatSync(current).isSymbolicLink()) throw new Error("Symlinked service input"); }
  return current;
}

function bytesAt(root, record) {
  if (!Number.isSafeInteger(record.bytes) || record.bytes < 1 || record.bytes > 524288 || !/^[0-9a-f]{64}$/.test(record.sha256)) throw new Error("Invalid service input pin");
  const bytes = readBounded(leaf(root, record.path), record.bytes);
  if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw new Error("Service source/configuration/patch hash mismatch: " + record.path);
  return bytes;
}

/** Checks actual source state by applying pinned patches only to an owned temporary subset, never the reference. */
function patchedSource(llvmRoot, sources, pins) {
  if (decode(git(llvmRoot, ["rev-parse", "HEAD"])).trim() !== pins.llvmCommit) throw new Error("Unexpected LLVM source commit");
  const patches = pins.files.filter(record => record.role === "patch");
  const names = new Set(), additions = new Set();
  for (const patch of patches) {
    const text = decode(sources.get(patch.path));
    const matches = [...text.matchAll(/^diff --git a\/([^\s]+) b\/([^\s]+)\n([^]*?)(?=^diff --git|$(?![^]))/gm)];
    if (!matches.length) throw new Error("Patch lacks bounded file targets");
    for (const match of matches) {
      if (match[1] !== match[2] || !/^(llvm|clang)\/[A-Za-z0-9_./-]+$/.test(match[1]) || match[1].split("/").includes("..")) throw new Error("Unsafe LLVM patch target");
      names.add(match[1]); if (match[3].includes("new file mode 100644")) additions.add(match[1]);
    }
  }
  const modified = decode(git(llvmRoot, ["diff", "--no-ext-diff", "--no-textconv", "--name-only", "-z", "HEAD"])).split("\0").filter(Boolean);
  const untracked = decode(git(llvmRoot, ["ls-files", "--others", "--exclude-standard", "-z"])).split("\0").filter(Boolean);
  if (new Set([...modified, ...untracked]).size !== names.size || [...modified, ...untracked].some(name => !names.has(name))) throw new Error("LLVM has missing or additional source modifications");
  const temporary = mkdtempSync(join(tmpdir(), "firmingo-service-audit-"));
  try {
    for (const name of names) if (!additions.has(name)) {
      const data = git(llvmRoot, ["show", pins.llvmCommit + ":" + name]);
      const destination = join(temporary, name); mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, data, { flag: "wx" });
    }
    const directory = join(temporary, "audit-patches"); mkdirSync(directory);
    for (const record of patches) {
      const path = join(directory, record.path.split("/").at(-1)); writeFileSync(path, sources.get(record.path), { flag: "wx" });
      git(temporary, ["apply", "--whitespace=nowarn", path]);
    }
    return [...names].sort().map(path => {
      const expected = readBounded(leaf(temporary, path), 2 * 1024 * 1024), actual = readBounded(leaf(llvmRoot, path), 2 * 1024 * 1024);
      if (!Buffer.from(expected).equals(Buffer.from(actual))) throw new Error("LLVM source differs from exact reviewed patches: " + path);
      return { path, bytes: actual.length, sha256: hash(actual) };
    });
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

/** Read-only provenance observation, always unresolved; it never executes, rebuilds or approves the service. */
export function auditService(referenceRootInput, llvmRootInput, receiptPath, modulePath,
  { pins = reference, servicePin = original } = {}) {
  const referenceRoot = resolve(referenceRootInput), llvmRoot = resolve(llvmRootInput);
  for (const root of [referenceRoot, llvmRoot]) if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error("Select real source directories");
  if (decode(git(referenceRoot, ["rev-parse", "HEAD"])).trim() !== pins.referenceCommit) throw new Error("Unexpected reference source commit");
  const sources = new Map();
  for (const record of pins.files) {
    const bytes = bytesAt(referenceRoot, record);
    if (!Buffer.from(bytes).equals(git(referenceRoot, ["show", pins.referenceCommit + ":" + record.path]))) throw new Error("Reference differs from committed input");
    sources.set(record.path, bytes);
  }
  const receiptBytes = readBounded(receiptPath, 65536);
  if (receiptBytes.length !== pins.receipt.bytes || hash(receiptBytes) !== pins.receipt.sha256) throw new Error("Unexpected original build receipt");
  // The exact byte anchor precedes parsing; the historical receipt contains a fractional timing observation.
  const receipt = JSON.parse(decode(receiptBytes));
  if (receipt.schemaVersion !== 1 || receipt.llvm?.sourceRevision !== pins.llvmCommit || receipt.llvm?.version !== pins.llvmVersion
      || receipt.module?.byteCount !== servicePin.bytes || receipt.module?.sha256 !== servicePin.sha256) throw new Error("Build receipt identity mismatch");
  const patches = pins.files.filter(record => record.role === "patch").map(record => ({ name: record.path.split("/").at(-1), sha256: record.sha256 }));
  if (canonicalJSON(receipt.llvm.patches) !== canonicalJSON(patches)) throw new Error("Build receipt patch inventory mismatch");
  for (const input of receipt.configurationInputs) {
    const record = pins.files.find(record => record.path.endsWith("/" + input.name));
    if (!record || record.sha256 !== input.sha256) throw new Error("Build receipt configuration mismatch");
  }
  const license = bytesAt(llvmRoot, pins.llvmLicense);
  if (!Buffer.from(license).equals(git(llvmRoot, ["show", pins.llvmCommit + ":" + pins.llvmLicense.path]))) throw new Error("LLVM license differs from committed source");
  const sourceState = patchedSource(llvmRoot, sources, pins);
  const moduleBytes = readBounded(modulePath, servicePin.bytes);
  if (moduleBytes.length !== servicePin.bytes || hash(moduleBytes) !== servicePin.sha256) throw new Error("Service module identity mismatch");
  const module = new WebAssembly.Module(moduleBytes); // Validation/shape only; never instantiate or call exports.
  const exports = WebAssembly.Module.exports(module).sort((a, b) => a.name.localeCompare(b.name));
  const imports = WebAssembly.Module.imports(module).sort((a, b) => (a.module + "." + a.name).localeCompare(b.module + "." + b.name));
  if (canonicalJSON(exports) !== canonicalJSON(receipt.module.exports) || canonicalJSON(imports) !== canonicalJSON(receipt.module.imports)) throw new Error("Actual module differs from recorded import/export shape");
  const memory = memoryLimits(moduleBytes);
  return { schema: 1, operation: "compiler_service_provenance_audit", distributionStatus: "unresolved", reproducedFromSource: false,
    referenceRepository: pins.referenceRepository, referenceCommit: pins.referenceCommit, llvmCommit: pins.llvmCommit,
    referenceManifestSHA256: hash(pins === reference ? referenceBytes : Buffer.from(JSON.stringify(pins))), originalReceiptSHA256: hash(receiptBytes),
    sourceFiles: pins.files, patchedLLVMFiles: sourceState, llvmLicense: pins.llvmLicense,
    module: { bytes: moduleBytes.length, sha256: hash(moduleBytes), imports, exports, memory: { minimumPages: memory.minimum, maximumPages: memory.maximum } },
    originalReceiptTools: receipt.tools,
    verified: ["pinned reference source/configuration/patch bytes", "exact patched LLVM tracked/visible-untracked source state", "pinned LLVM license bytes",
      "original receipt and module identities", "static actual WASM import/export/memory shape; no execution"],
    gaps: ["original receipt omits service source/header digests", "original receipt omits linked library/archive and generated-header identities",
      "merged WASI sysroot components, source/version/license and file inventory unresolved", "native compiler/TableGen/linker executable and target runtime input identities unresolved",
      "reference wrapper/patch attribution and license selection unresolved", "clean full-source rebuild and repeat-build identity not established"],
    exclusions: ["no source or artifact in the reference checkout modified", "no binary copied or redistributed", "no service execution or firmware/device operation",
      "ignored/generated source-tree files outside tracked/visible-untracked patch-state verification"] };
}

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { boundService, ORIGINAL_SERVICE, LEGACY_BOUNDED_SERVICE as SERVICE } from "../tools/bound-service.mjs";

// Small ordinary inputs prove identity rejection before directory/output creation, without a compiler binary.
test("memory-maintenance rejects arbitrary input without touching source or creating output", () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-memory-input-"));
  try {
    const input = join(root, "input.wasm"), output = join(root, "output"), bytes = Buffer.from([0,97,115,109,1,0,0,0]);
    writeFileSync(input, bytes);
    assert.throws(() => boundService(input, output), /exact pinned original/);
    assert.deepEqual(readFileSync(input), bytes); assert(!existsSync(output));
    assert.throws(() => boundService(join(root, "missing"), output), { code: "ENOENT" });
    assert(!existsSync(output));
    assert.notEqual(ORIGINAL_SERVICE.sha256, SERVICE.sha256);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const original = process.env.FIRMINGO_COMPILER_ORIGINAL_SERVICE;
test("actual original service reproduces pinned bounded bytes, preserves source and refuses overwrite", {
  skip: original ? false : "SKIPPED memory adaptation: supply an explicit pinned original to tools/dev.mjs test-memory"
}, () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-real-memory-"));
  const digest = bytes => createHash("sha256").update(bytes).digest("hex");
  try {
    const output = join(root, "result");
    const result = spawnSync(process.execPath, ["tools/dev.mjs", "bound-service", original, output],
      { cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "development_service_memory_bounded");
    const derived = readFileSync(join(output, "compiler-bounded.wasm"));
    assert.equal(derived.length, SERVICE.bytes); assert.equal(digest(derived), SERVICE.sha256);
    const source = readFileSync(original); assert.equal(digest(source), ORIGINAL_SERVICE.sha256);
    const receipt = JSON.parse(readFileSync(join(output, "memory-receipt.json")));
    assert.equal(receipt.derivedMemory.maximum, 4096); assert.equal(receipt.sourceMemory.maximum, null);
    assert.deepEqual(source.subarray(0, receipt.sourceMemory.sectionStart), derived.subarray(0, receipt.derivedMemory.sectionStart));
    assert.deepEqual(source.subarray(receipt.sourceMemory.sectionEnd), derived.subarray(receipt.derivedMemory.sectionEnd));
    const repeated = spawnSync(process.execPath, ["tools/dev.mjs", "bound-service", original, output],
      { cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 15000 });
    assert.equal(repeated.status, 1); assert.match(repeated.stderr, /EEXIST/);
    assert.deepEqual(readFileSync(join(output, "compiler-bounded.wasm")), derived);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

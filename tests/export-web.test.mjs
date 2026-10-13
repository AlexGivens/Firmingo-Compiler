import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Script, createContext } from "node:vm";
import { exportWeb } from "../tools/export-web.mjs";

// Exercises the actual source export, its opaque-origin consumer and independently reproducible maintenance inputs.
test("source-only web package is deterministic, bounded, reconstructible and refuses overwrite", async () => {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-export-"));
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  try {
    const first = join(directory, "first"), second = join(directory, "second");
    await exportWeb(first); await exportWeb(second);
    for (const name of readdirSync(first)) assert.deepEqual(readFileSync(join(first, name)), readFileSync(join(second, name)), name);
    await assert.rejects(exportWeb(first), { code: "EEXIST" });
    const manifest = JSON.parse(readFileSync(join(first, "manifest.json")));
    assert(readFileSync(join(first, "manifest.json")).length <= 16384);
    for (const record of manifest.files) {
      const bytes = readFileSync(join(first, record.path));
      assert.equal(bytes.length, record.bytes); assert.equal(hash(bytes), record.sha256); assert(bytes.length <= 524288);
    }
    assert(!manifest.files.some(item => item.path.endsWith(".wasm")));
    const context = createContext({ TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, AbortController, URL, setTimeout, clearTimeout, btoa, atob });
    new Script(readFileSync(join(first, "compiler.js"), "utf8")).runInContext(context);
    assert.equal(context.crypto, undefined);
    const input = JSON.parse(readFileSync(new URL("./fixtures/synthetic-packaging-request.json", import.meta.url)));
    input.source.text = "\ufeff// café 🎵\r\nvoid setup() {}\r\nvoid loop() {}";
    const prepared = await context.FirmingoCompiler.prepareSketch(context.FirmingoCompiler.parseBuildRequest(JSON.stringify(input)));
    assert.equal(prepared.sourceSHA256, hash(Buffer.from(input.source.text)));
    const sources = JSON.parse(readFileSync(join(first, "sources.json")));
    const recreated = join(directory, "recreated");
    for (const record of manifest.sourceRecords) {
      const bytes = Buffer.from(sources[record.path]);
      assert.equal(bytes.length, record.bytes); assert.equal(hash(bytes), record.sha256);
      const path = join(recreated, record.path); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes);
    }
    const rebuilt = join(directory, "rebuilt");
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", 'import { exportWeb } from "./tools/export-web.mjs"; await exportWeb(process.argv[1]);', rebuilt],
      { cwd: recreated, encoding: "utf8", timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    for (const name of readdirSync(first)) assert.deepEqual(readFileSync(join(first, name)), readFileSync(join(rebuilt, name)), name);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

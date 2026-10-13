import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { checkBuiltService } from "../tools/test-built-service.mjs";

test("built service execution requires a reviewed anchor and never publishes invalid module/descriptor inputs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-built-service-rejection-"));
  try {
    const module = join(directory, "invalid.wasm"), output = join(directory, "unpublished");
    const bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]); // Static empty WASM; never instantiated.
    writeFileSync(module, bytes);
    await assert.rejects(checkBuiltService(module, "0".repeat(64), "tests/fixtures/synthetic-nano-descriptor.json", output), /anchor mismatch/);
    const hash = createHash("sha256").update(bytes).digest("hex");
    const descriptor = join(directory, "descriptor.json"); writeFileSync(descriptor, "{}");
    await assert.rejects(checkBuiltService(module, hash, descriptor, output));
    await assert.rejects(checkBuiltService(module, hash, "tests/fixtures/synthetic-nano-descriptor.json", output), /memory/);
    assert.equal(existsSync(output), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

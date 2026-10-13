import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtHarnessResources, saveBuiltWebReport } from "../tools/built-web-checks.mjs";
import { BUILT_WEB_CASES } from "../web/built-service-checks.js";
import { packageELF } from "../src/capsule.js";
import { sha256 } from "../src/hash.js";

/** Synthetic package fixture only; no WASM service is instantiated or browser pass claimed by this test. */
async function fixtureReport() {
  const request = JSON.parse(readFileSync("tests/fixtures/synthetic-build-request.json"));
  const descriptor = request.target.firmwareBuild;
  const elf = Buffer.from(readFileSync("tests/fixtures/stateless.elf.hex", "utf8").replace(/\s/g, ""), "hex");
  const provenance = JSON.parse(readFileSync("tests/fixtures/declared-packaging-provenance.json"));
  const capsule = Buffer.from((await packageELF(elf, request, provenance)).bytes);
  const identity = { bytes: 8, sha256: "1".repeat(64) };
  const artifact = { capsuleBytes: capsule.length, capsuleSHA256: await sha256(capsule), linkedELFSHA256: await sha256(elf),
    capsuleBase64: capsule.toString("base64"), elfBase64: elf.toString("base64") };
  return { identity, descriptor, report: { schema: 1, operation: "owned_service_web_checks", passed: 9, failed: 0, skipped: 0,
    cases: BUILT_WEB_CASES.map(([name, actualCompiler]) => ({ name, actualCompiler, outcome: "passed" })), actualCompilerPasses: 4,
    artifacts: ["gpio", "console"].map(name => ({ name, ...artifact })), descriptor, serviceIdentity: identity, consumerPinsChanged: false, hardwareExecuted: false } };
}

test("development web routes reject wrong anchors and unbounded WASM before listening or executing", async () => {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-built-web-input-"));
  try {
    const path = join(directory, "static-empty.wasm"), bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
    writeFileSync(path, bytes);
    await assert.rejects(builtHarnessResources(path, "0".repeat(64), "tests/fixtures/synthetic-nano-descriptor.json"), /anchor mismatch/);
    await assert.rejects(builtHarnessResources(path, await sha256(bytes), "tests/fixtures/synthetic-nano-descriptor.json"), /memory/);
  } finally { rmSync(directory, { recursive: true }); }
});

test("report boundary validates fixed cases and independent ELF/capsule binding before writing anything", async () => {
  const { report, identity, descriptor } = await fixtureReport();
  const directory = mkdtempSync(join(tmpdir(), "firmingo-built-web-report-"));
  try {
    const output = join(directory, "unpublished");
    for (const mutate of [
      value => { value.cases.pop(); }, value => { value.cases[0].name = "invented"; },
      value => { value.cases[0].actualCompiler = true; }, value => { value.actualCompilerPasses = 0; },
      value => { value.descriptor.apiAddress += 4; }, value => { value.artifacts[1].name = "gpio"; },
      value => { value.artifacts[0].capsuleBase64 += "\n"; },
      value => { value.extra = "x".repeat(2 * 1024 * 1024); },
      async value => { const bytes = Buffer.from(value.artifacts[0].capsuleBase64, "base64"); bytes.writeUInt32LE(descriptor.apiAddress + 4, 12);
        value.artifacts[0].capsuleBase64 = bytes.toString("base64"); value.artifacts[0].capsuleSHA256 = await sha256(bytes); },
      async value => { const bytes = Buffer.from(value.artifacts[0].elfBase64, "base64"); bytes[0] = 0;
        value.artifacts[0].elfBase64 = bytes.toString("base64"); value.artifacts[0].linkedELFSHA256 = await sha256(bytes); },
      async value => { const bytes = Buffer.from(value.artifacts[0].capsuleBase64, "base64"); bytes[256] ^= 1;
        bytes.set(Buffer.from(await sha256(bytes.subarray(256)), "hex"), 32);
        value.artifacts[0].capsuleBase64 = bytes.toString("base64"); value.artifacts[0].capsuleSHA256 = await sha256(bytes); },
    ]) {
      const corrupted = structuredClone(report); await mutate(corrupted);
      await assert.rejects(saveBuiltWebReport(corrupted, output, identity, descriptor)); assert.equal(existsSync(output), false);
    }
    await saveBuiltWebReport(report, output, identity, descriptor);
    assert.equal(readFileSync(join(output, "gpio.fms")).toString("base64"), report.artifacts[0].capsuleBase64);
    await assert.rejects(saveBuiltWebReport(report, output, identity, descriptor), /new browser output/);
  } finally { rmSync(directory, { recursive: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { parseBuildRequest, validateCapsule, validateRuntimeEvent, serializeRuntimeEvent, parseRuntimeEvent } from "../src/index.js";
import { dataIdentity, canonicalJSON } from "../src/hash.js";
import { createNodeCompiler, localResources } from "../tools/node-runtime.mjs";
import { readBounded } from "../tools/dev.mjs";
import { verifyBuildResult } from "../runtime/build.js";
import { SERVICE } from "../runtime/pins.js";

const path = process.env.FIRMINGO_COMPILER_SERVICE;
const skip = path ? false : "SKIPPED actual compilation: supply an explicit pinned local service to tools/dev.mjs test-runtime";
const resources = path ? localResources(readBounded(resolve(path), SERVICE.bytes)) : null;
const baseline = parseBuildRequest(readFileSync(new URL("./fixtures/synthetic-packaging-request.json", import.meta.url), "utf8"));
const request = (id, source = "void setup() {}\nvoid loop() {}") => ({ ...baseline, buildID: id,
  source: { filename: "Sketch.ino", revision: id + ":revision", text: source } });
const succeeded = artifact => {
  assert.equal(artifact.receipt.operation, "wasm_compile_link_package");
  assert.equal(artifact.receipt.provenanceStatus, "pinned_assets_executed");
  assert.equal(artifact.receipt.service.sha256, SERVICE.sha256);
  assert(artifact.memoryBytes <= SERVICE.maximumMemoryBytes);
  assert(artifact.timings.every(item => item.milliseconds >= 0));
};

// Every case reaches the real service except explicit host cancellation/deadline tests.
test("actual WASM compiles different sketches, reproduces bytes and correlates complete receipts", { skip }, async () => {
  const controller = createNodeCompiler(), events = [];
  const firstRequest = request("real-a", "void setup() { pinMode(6, 1); }\nvoid loop() { digitalWrite(6, 1); delay(10); }");
  const first = await controller.build(firstRequest, resources, { onEvent: event => events.push(event) });
  const repeat = await controller.build(firstRequest, resources);
  const second = await controller.build(request("real-b", 'void setup() { Serial.println("ready"); }\nvoid loop() { int c = Serial.read(); if (c >= 0) Serial.write(uint8_t(c)); }'), resources);
  for (const result of [first, repeat, second]) succeeded(result);
  assert.equal(first.sha256, repeat.sha256); assert.deepEqual(first.linkedELF, repeat.linkedELF); assert.deepEqual(first.receipt, repeat.receipt);
  assert.notEqual(first.sha256, second.sha256);
  const raw = { linkedELF: first.linkedELF, capsuleBytes: first.bytes, reportJSON: first.reportJSON, receipt: first.receipt,
    diagnostics: first.diagnostics, timings: first.timings, memoryBytes: first.memoryBytes };
  await assert.rejects(verifyBuildResult({ ...raw, receipt: { ...raw.receipt, buildID: "stale" } }, firstRequest), { code: "invalid_response" });
  const corrupt = first.bytes; corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(verifyBuildResult({ ...raw, capsuleBytes: corrupt }, firstRequest), { code: "invalid_response" });
  await assert.rejects(verifyBuildResult(raw, request("different-source")), { code: "invalid_response" });
  assert.equal(first.receipt.sourceRevision, firstRequest.source.revision);
  const { capsuleBytes, capsuleSHA256, linkedELFSHA256, buildInputSHA256, ...input } = first.receipt;
  assert.equal(await dataIdentity(input), buildInputSHA256);
  assert.equal(capsuleSHA256, first.sha256); assert.equal(capsuleBytes, first.bytes.length);
  assert.equal((await validateCapsule(first.bytes, baseline.target.firmwareBuild)).capsuleSHA256, first.sha256);
  assert.deepEqual(events.map(event => event.sequence), events.map((_, index) => index + 1));
  assert.deepEqual(events.filter(event => event.kind === "progress").map(event => event.phase),
    ["verifying", "preprocessing", "compiling", "compiling", "linking", "validating", "packaging"]);
  for (const event of events) validateRuntimeEvent(event);
  const decoded = parseRuntimeEvent(serializeRuntimeEvent(events.at(-1)));
  assert.deepEqual(decoded.artifact.bytes, first.bytes); assert.equal(canonicalJSON(decoded.artifact.receipt), canonicalJSON(first.receipt));
  assert(Object.isFrozen(first.receipt.toolchainManifest));
  assert.equal(events.at(-1).outcome, "succeeded"); assert.equal(events.filter(event => event.kind === "result").length, 1);
});

test("actual legacy static binding executes without fabricated firmware facts", { skip }, async () => {
  const full = request("legacy-static");
  const { schema, board, profile, residentELFSHA256, firmwareImageSHA256, apiAddress, residentABI, targetID, maximumCapsuleBytes } = full.target.firmwareBuild;
  const { firmwareBuild, ...target } = full.target;
  const binding = { schema, board, profile, residentELFSHA256, firmwareImageSHA256, apiAddress, residentABI, targetID, maximumCapsuleBytes };
  const controller = createNodeCompiler();
  const first = await controller.build(full, resources);
  const second = await controller.build({ ...full, target: { ...target, residentBinding: binding } }, resources);
  succeeded(second); assert.deepEqual(first.bytes, second.bytes);
  assert.equal(second.receipt.firmwareBuildID, undefined);
  assert.equal(second.receipt.residentBindingID, await dataIdentity(binding));
  assert.equal(second.residentBinding.firmwareVersion, undefined);
});

test("actual frontend error is terminal even with zero service status and maps BOM byte columns", { skip }, async () => {
  const controller = createNodeCompiler();
  for (const bom of ["", "\ufeff"]) {
    const events = [];
    await assert.rejects(controller.build(request("frontend", bom + "void setup() { missingFunction(); }\nvoid loop() {}"), resources, { onEvent: event => events.push(event) }), error => {
      assert.equal(error.code, "compile_failed");
      const diagnostic = error.diagnostics.find(item => item.severity === "error");
      assert.equal(diagnostic.filename, "Sketch.ino"); assert.equal(diagnostic.line, 1); assert.equal(diagnostic.column, bom ? 19 : 16);
      return true;
    });
    assert.deepEqual(events.filter(event => event.kind === "progress").map(event => event.phase), ["verifying", "preprocessing", "compiling"]);
    assert.equal(events.at(-1).outcome, "failed"); assert.equal(events.at(-1).artifact, undefined);
  }
  succeeded(await controller.build(request("after-frontend"), resources));
});

test("actual facade, mutable-state, constructors and runtime-helper failures never produce artifacts", { skip }, async () => {
  const controller = createNodeCompiler();
  for (const [source, code, expected] of [
    ["void setup() { analogWrite(6, 1); } void loop() {}", "compile_failed", "analogWrite"],
    ["volatile int x; void setup() { x = 1; } void loop() { ++x; }", "link_failed", "mutable storage"],
    ["struct X { X(); }; X::X() { pinMode(6, 1); } X object; void setup() {} void loop() {}", "link_failed", "runtime constructors"],
    ["void setup() {} void loop() { digitalWrite(6, millis() / 250); }", "link_failed", "__aeabi_uidiv"],
  ]) {
    await assert.rejects(controller.build(request("unsupported", source), resources), error => {
      assert.equal(error.code, code);
      assert(error.diagnostics.some(item => item.severity === "error" && item.message.includes(expected)), canonicalJSON(error.diagnostics));
      return true;
    });
  }
  succeeded(await controller.build(request("after-link"), resources));
});

test("real worker abort during compile rejects busy and stale cancels then permits a fresh build", { skip }, async () => {
  const controller = createNodeCompiler(), signal = new AbortController(), events = [];
  const pending = controller.build(request("cancelled"), resources, { signal: signal.signal, onEvent: event => {
    events.push(event); if (event.kind === "progress" && event.phase === "compiling") signal.abort();
  } });
  assert.equal(controller.cancel({ interfaceVersion: 1, kind: "cancel", buildID: "other" }), false);
  await assert.rejects(controller.build(request("busy"), resources), { code: "busy" });
  await assert.rejects(pending, { code: "cancelled" });
  assert.equal(events.filter(event => event.kind === "result").length, 1); assert.equal(events.at(-1).outcome, "cancelled");
  assert.equal(controller.cancel({ interfaceVersion: 1, kind: "cancel", buildID: "cancelled" }), false);
  succeeded(await controller.build(request("after-cancel"), resources));
});

test("real worker deadline terminates startup and a fresh build has no leaked state", { skip }, async () => {
  const controller = createNodeCompiler(), events = [];
  const timed = { ...request("deadline"), options: { deadlineMilliseconds: 1 } };
  await assert.rejects(controller.build(timed, resources, { onEvent: event => events.push(event) }), { code: "timed_out" });
  assert.equal(events.at(-1).outcome, "timed_out"); assert.equal(events.filter(event => event.kind === "result").length, 1);
  succeeded(await controller.build(request("after-deadline"), resources));
});

test("corrupt real service and recipe bytes fail before compilation, with a clean subsequent build", { skip }, async () => {
  const controller = createNodeCompiler();
  const corruptService = resources.serviceBytes.slice(); corruptService[corruptService.length - 1] ^= 1;
  await assert.rejects(controller.build(request("corrupt-service"), { ...resources, serviceBytes: corruptService }), { code: "invalid_service" });
  const assets = { ...resources.recipeAssets, "Recipe/Arduino.h": resources.recipeAssets["Recipe/Arduino.h"].slice() };
  assets["Recipe/Arduino.h"][0] ^= 1;
  await assert.rejects(controller.build(request("corrupt-recipe"), { ...resources, recipeAssets: assets }), { code: "invalid_recipe" });
  succeeded(await controller.build(request("after-corruption"), resources));
});

test("actual developer CLI compiles, fails/cancels without output and refuses existing output", { skip }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-real-"));
  const cwd = new URL("../", import.meta.url);
  const command = output => spawnSync(process.execPath, ["tools/dev.mjs", "build", "tests/fixtures/synthetic-packaging-request.json", resolve(path), output],
    { cwd, encoding: "utf8", timeout: 15000 });
  try {
    const output = join(directory, "result"), result = command(output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, "wasm_compiled_linked_packaged");
    assert.equal(JSON.parse(readFileSync(join(output, "receipt.json"))).provenanceStatus, "pinned_assets_executed");
    assert(existsSync(join(output, "operation.json"))); assert(existsSync(join(output, "Sketch.elf")));
    assert.equal(command(output).status, 1);
    const badInput = join(directory, "bad.json"), failedOutput = join(directory, "failed");
    writeFileSync(badInput, JSON.stringify(request("bad-cli", "void setup() { missingFunction(); } void loop() {}")));
    const failed = spawnSync(process.execPath, ["tools/dev.mjs", "build", badInput, resolve(path), failedOutput], { cwd, encoding: "utf8", timeout: 15000 });
    assert.equal(failed.status, 1); assert.match(failed.stderr, /compile_failed/); assert(!existsSync(failedOutput));
    const cancelledOutput = join(directory, "cancelled");
    await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ["tools/dev.mjs", "build", "tests/fixtures/synthetic-packaging-request.json", resolve(path), cancelledOutput],
        { cwd, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "", stdout = "", sent = false;
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("CLI cancellation deadline exceeded")); }, 15000);
      child.stderr.on("data", data => { stderr += data; if (!sent && stderr.includes('"phase":"compiling"')) { sent = true; child.kill("SIGINT"); } });
      child.stdout.on("data", data => { stdout += data; });
      child.on("error", error => { clearTimeout(timer); reject(error); });
      child.on("close", code => {
        clearTimeout(timer);
        try { assert(sent); assert.equal(code, 1, stderr); assert.match(stderr, /cancelled/); assert.equal(stdout, ""); assert(!existsSync(cancelledOutput)); resolveResult(); }
        catch (error) { reject(error); }
      });
    });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

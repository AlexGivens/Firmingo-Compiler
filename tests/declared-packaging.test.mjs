import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { validateDeclaredPackagingRequest, parseDeclaredPackagingRequest, packageDeclaredELF, PackagingController,
  validateBuildRequest, packageELF } from "../src/index.js";
import { canonicalJSON } from "../src/hash.js";

const reference = JSON.parse(readFileSync(new URL("./fixtures/declared-packaging-reference.json", import.meta.url)));
const request = () => structuredClone(reference.request);
const elf = () => Uint8Array.from(readFileSync(new URL("./fixtures/stateless.elf.hex", import.meta.url), "utf8").trim().split(/\s+/), pair => parseInt(pair, 16));
const factory = () => {
  const worker = new Worker(new URL("../tools/node-preparation-worker.mjs", import.meta.url));
  return { postMessage: message => worker.postMessage(message), terminate: () => worker.terminate(),
    listen(message, error, exit) { worker.on("message", message); worker.on("error", error); worker.on("exit", exit);
      return () => { worker.off("message", message); worker.off("error", error); worker.off("exit", exit); }; } };
};

test("declared packaging preserves arbitrary bounded provenance and independent golden receipt/report", async () => {
  const input = parseDeclaredPackagingRequest(JSON.stringify(request()));
  const result = await packageDeclaredELF(elf(), input);
  assert.deepEqual(result.receipt, reference.receipt); assert.equal(result.reportJSON, canonicalJSON(reference.report));
  const golden = Uint8Array.from(readFileSync(new URL("./fixtures/firmware-upload-chunk.hex", import.meta.url), "utf8").trim().split(/\s+/), pair => parseInt(pair, 16)).slice(24);
  assert.deepEqual(result.bytes, golden);
  assert.equal(result.receipt.operation, "independent_elf_packaging"); assert.equal(result.receipt.provenanceStatus, "declared");
  for (const key of ["deviceID", "service", "wasiShim", "toolchainManifest"]) assert.equal(Object.hasOwn(result.receipt, key), false);
  const bytes = result.bytes; bytes.fill(0); assert.deepEqual(result.bytes, golden);
  const legacy = request(); const descriptor = legacy.target.firmwareBuild;
  legacy.target.residentBinding = Object.fromEntries(["schema", "board", "profile", "residentELFSHA256", "firmwareImageSHA256", "apiAddress", "residentABI", "targetID", "maximumCapsuleBytes"].map(key => [key, descriptor[key]]));
  delete legacy.target.firmwareBuild;
  assert.deepEqual((await packageDeclaredELF(elf(), legacy)).bytes, golden);
});

test("declared requests cannot weaken pinned build/descriptor validation or fabricate compilation receipts", async () => {
  assert.throws(() => validateBuildRequest(request()));
  const build = request(); build.kind = "build"; delete build.provenance;
  assert.throws(() => validateBuildRequest(build), { code: "unsupported_target" });
  await assert.rejects(packageELF(elf(), build, reference.request.provenance), { code: "unsupported_target" });
  for (const mutate of [r => { r.target.firmwareBuild.recipeSHA256 = "8".repeat(64); }, r => { r.provenance.recipeIdentifier = "mismatch"; },
    r => { r.target.board = "rp2040_pico"; }, r => { r.target.recipeIdentifier = "../path"; },
    r => { r.provenance.toolchainSHA256 = "A".repeat(64); }, r => { r.provenance.compiler = "é".repeat(129); },
    r => { r.target.firmwareBuild.apiAddress++; }, r => { r.extra = true; }, r => { r.source.filename = "../Sketch.ino"; }]) {
    const input = request(); mutate(input); assert.throws(() => validateDeclaredPackagingRequest(input));
  }
  assert.throws(() => parseDeclaredPackagingRequest(JSON.stringify(request()).replace('"kind":', '"kind":"package_elf","kind":')), { code: "duplicate_key" });
});

test("declared packaging snapshots all inputs, retains strict ELF gates, and checks cancellation", async () => {
  const input = request(), bytes = elf();
  const pending = packageDeclaredELF(bytes, input); bytes.fill(0); input.provenance.compiler = "changed"; input.source.text = "changed";
  assert.deepEqual((await pending).receipt, reference.receipt);
  for (const offset of [0, 4, 560, 300]) { const corrupt = elf(); corrupt[offset] ^= 1; await assert.rejects(packageDeclaredELF(corrupt, request()), { code: "invalid_elf" }); }
  await assert.rejects(packageDeclaredELF(new Uint8Array(new SharedArrayBuffer(712)), request()), { code: "invalid_elf" });
  const controller = new AbortController(), cancelled = packageDeclaredELF(elf(), request(), { signal: controller.signal });
  controller.abort(); await assert.rejects(cancelled, { code: "cancelled" });
});

test("actual isolated service-free packaging matches goldens, rejects ELF and permits a fresh operation", async () => {
  const controller = new PackagingController({ workerFactory: factory });
  const bytes = elf(), input = request(), pending = controller.package(bytes, input); bytes.fill(0); input.provenance.compiler = "changed";
  assert.deepEqual((await pending).receipt, reference.receipt);
  await assert.rejects(controller.package(new Uint8Array(712), request()), { code: "invalid_elf" });
  assert.deepEqual((await controller.package(elf(), request())).receipt, reference.receipt);
});

test("packaging cancellation/deadline/busy settles after disposal and supports fresh operations", async () => {
  const controller = new PackagingController({ workerFactory: factory }), abort = new AbortController();
  const pending = controller.package(elf(), request(), { signal: abort.signal });
  await assert.rejects(controller.package(elf(), request()), { code: "busy" }); abort.abort(); await assert.rejects(pending, { code: "cancelled" });
  await assert.rejects(controller.package(elf(), { ...request(), options: { deadlineMilliseconds: 1 } }), { code: "timed_out" });
  assert.deepEqual((await controller.package(elf(), request())).receipt, reference.receipt);
});

test("packaging rejects stale/altered responses and retains admission until asynchronous cleanup completes", async () => {
  let receive, release;
  const controller = new PackagingController({ workerFactory: () => ({ postMessage() {},
    listen(message) { receive = message; return () => {}; }, terminate() { return new Promise(resolve => { release = resolve; }); } }) });
  const pending = controller.package(elf(), request());
  receive({ interfaceVersion: 1, buildID: "stale", kind: "packaged", result: {} });
  await assert.rejects(controller.package(elf(), request()), { code: "busy" }); release(); await assert.rejects(pending, { code: "invalid_response" });
  const expected = await packageDeclaredELF(elf(), request());
  for (const mutate of [r => { r.reportJSON = "altered"; }, r => { r.receiptJSON = "{}"; }, r => { r.bytes[256] ^= 1; }, r => { r.extra = true; }]) {
    const altered = new PackagingController({ workerFactory: () => ({ terminate() {}, listen(message) { receive = message; return () => {}; },
      postMessage() { const result = { format: expected.format, filename: expected.filename, bytes: expected.bytes, sha256: expected.sha256,
        reportJSON: expected.reportJSON, receiptJSON: canonicalJSON(expected.receipt) }; mutate(result);
        receive({ interfaceVersion: 1, buildID: reference.request.buildID, kind: "packaged", result }); } }) });
    await assert.rejects(altered.package(elf(), request()), { code: "invalid_response" });
  }
});

test("packaging worker cleanup failure cannot publish success and allows a fresh independent operation", async () => {
  let first = true, receive;
  const controller = new PackagingController({ workerFactory: () => first ? {
    listen(message) { receive = message; return () => {}; },
    postMessage() { receive({ interfaceVersion: 1, buildID: reference.request.buildID, kind: "failure", error: { code: "invalid_elf", stage: "validating", message: "failure" }, diagnostics: [] }); },
    terminate() { first = false; throw new Error("failed disposal"); }
  } : factory() });
  await assert.rejects(controller.package(elf(), request()), { code: "cleanup_failed" });
  assert.deepEqual((await controller.package(elf(), request())).receipt, reference.receipt);
});

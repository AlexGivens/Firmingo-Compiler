import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CompilerController, parseBuildRequest, validateRuntimeEvent, serializeRuntimeEvent, parseRuntimeEvent } from "../src/index.js";
import { validateWorkerMessage, validateReceiptData } from "../runtime/messages.js";
import { snapshotResources } from "../runtime/build.js";
import { SERVICE } from "../runtime/pins.js";
import { localResources } from "../tools/node-runtime.mjs";
const request = parseBuildRequest(readFileSync(new URL("./fixtures/synthetic-packaging-request.json", import.meta.url), "utf8"));

// These mocks exercise host failure/disposal paths only; no test fabricates a successful compilation.
test("pre-aborted requests create no worker and settle exactly once", async () => {
  const controller = new CompilerController({ workerFactory: () => { throw new Error("Must not create"); } });
  const signal = new AbortController(); signal.abort(); const events = [];
  await assert.rejects(controller.build(request, null, { signal: signal.signal, onEvent: event => events.push(event) }), { code: "cancelled" });
  assert.equal(events.length, 1); assert.equal(events[0].outcome, "cancelled");
  assert.equal(controller.cancel({ interfaceVersion: 1, kind: "cancel", buildID: request.buildID }), false);
});

test("missing/accessor resources reject before creating a worker without a stuck busy state", async () => {
  const controller = new CompilerController({ workerFactory: () => { throw new Error("Must not create"); } });
  for (const resources of [null, {}, { get serviceBytes() { throw new Error("Must not read"); }, recipeManifest: null, recipeAssets: null }])
    await assert.rejects(controller.build(request, resources), { code: "invalid_resources" });
  assert.throws(() => snapshotResources({ serviceBytes: new Uint8Array(8), recipeManifest: new Uint8Array(1), recipeAssets: {} }));
});

test("strict worker responses reject wrong IDs, duplicate/skipped sequences, errors and oversized diagnostics", () => {
  const progress = { interfaceVersion: 1, kind: "progress", buildID: request.buildID, sequence: 1, phase: "verifying" };
  validateWorkerMessage(progress, request.buildID, 1);
  for (const changes of [{ interfaceVersion: 2 }, { buildID: "stale" }, { sequence: 0 }, { sequence: 2 }, { phase: "unknown" }, { extra: true }])
    assert.throws(() => validateWorkerMessage({ ...progress, ...changes }, request.buildID, 1), { code: "invalid_response" });
  const failure = { interfaceVersion: 1, kind: "failure", buildID: request.buildID, sequence: 1,
    error: { code: "compile_failed", stage: "compiling", message: "Compilation failed" }, diagnostics: [] };
  validateWorkerMessage(failure, request.buildID, 1);
  assert.throws(() => validateWorkerMessage({ ...failure, error: { ...failure.error, message: "x".repeat(4097) } }, request.buildID, 1));
  assert.throws(() => validateWorkerMessage({ ...failure, diagnostics: Array(129).fill({}) }, request.buildID, 1));
  const cycle = {}; cycle.cycle = cycle; assert.throws(() => validateReceiptData(cycle));
  assert.throws(() => validateReceiptData({ items: Array(513).fill(0) }));
});

test("stale response and wrong phase terminate and ignore later messages, then permit another request", async () => {
  let terminated = 0, receive;
  const controller = new CompilerController({ workerFactory: () => ({
    listen(message) { receive = message; return () => {}; }, terminate() { terminated++; },
    postMessage() { queueMicrotask(() => receive({ interfaceVersion: 1, kind: "progress", buildID: "stale", sequence: 1, phase: "verifying" })); },
  }) });
  const resources = localResources(new Uint8Array(SERVICE.bytes));
  for (let index = 0; index < 2; index++) {
    const events = [];
    await assert.rejects(controller.build(request, resources, { onEvent: event => events.push(event) }), { code: "invalid_response" });
    assert.equal(terminated, index + 1); assert.equal(events.at(-1).outcome, "failed");
    const count = events.length;
    await receive({ interfaceVersion: 1, kind: "progress", buildID: request.buildID, sequence: 1, phase: "verifying" });
    assert.equal(events.length, count);
  }
});

test("worker exit, exception and cleanup failure do not publish artifacts or leave pending promises", async () => {
  const resources = localResources(new Uint8Array(SERVICE.bytes));
  for (const mode of ["exit", "error", "cleanup"]) {
    const controller = new CompilerController({ workerFactory: () => ({
      listen(message, error, exit) { queueMicrotask(() => mode === "exit" ? exit(0) : error(new Error("Worker failed"))); return () => {}; },
      terminate() { if (mode === "cleanup") throw new Error("Termination failed"); }, postMessage() {},
    }) });
    const events = [];
    await assert.rejects(controller.build(request, resources, { onEvent: event => events.push(event) }),
      { code: mode === "exit" ? "worker_exited" : mode === "cleanup" ? "cleanup_failed" : "runtime_failed" });
    assert.equal(events.length, 1); assert.equal(events[0].artifact, undefined);
  }
});

test("public event codec preserves byte counts and rejects extra fields, duplicate keys and noncanonical encodings", () => {
  const event = { interfaceVersion: 1, kind: "result", buildID: request.buildID, sequence: 1, outcome: "cancelled",
    error: { code: "cancelled", stage: "verifying", message: "Build cancelled" } };
  validateRuntimeEvent(event); assert.equal(serializeRuntimeEvent(parseRuntimeEvent(serializeRuntimeEvent(event))), serializeRuntimeEvent(event));
  assert.throws(() => validateRuntimeEvent({ ...event, artifact: {} }));
  assert.throws(() => parseRuntimeEvent('{"interfaceVersion":1,"interfaceVersion":1}'));
  assert.throws(() => parseRuntimeEvent(" ".repeat(32769)));
  assert.throws(() => parseRuntimeEvent(JSON.stringify({ outcome: "succeeded", artifact: { bytes: "Zh==" } })));
});

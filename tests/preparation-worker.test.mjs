import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Worker } from "node:worker_threads";
import { PreparationController, parseBuildRequest, prepareSketch } from "../src/index.js";

const baseline = parseBuildRequest(readFileSync(new URL("./fixtures/synthetic-packaging-request.json", import.meta.url), "utf8"));
const request = (text = baseline.source.text) => ({ ...baseline, source: { ...baseline.source, text } });
const factory = () => {
  const worker = new Worker(new URL("../tools/node-preparation-worker.mjs", import.meta.url));
  return { postMessage: message => worker.postMessage(message), terminate: () => worker.terminate(),
    listen(message, error, exit) { worker.on("message", message); worker.on("error", error); worker.on("exit", exit);
      return () => { worker.off("message", message); worker.off("error", error); worker.off("exit", exit); }; } };
};

test("isolated service-free preparation matches production hashes/normalization and preserves unsupported diagnostics", async () => {
  const controller = new PreparationController({ workerFactory: factory });
  for (const text of ["\ufeff// café 🎵\r\nvoid setup() {}\rvoid loop() {}", '/* #define HIDE */\n#include "Arduino.h"\nvoid setup() {}\nvoid loop() {}', "int n = 1'000; void setup() {} void loop() {}"])
    assert.deepEqual(await controller.prepare(request(text)), await prepareSketch(request(text)));
  await assert.rejects(controller.prepare(request("\ufeff  #define BAD 1")), error => {
    assert.equal(error.code, "unsupported_source"); assert.equal(error.diagnostics[0].column, 6); return true;
  });
  await assert.rejects(controller.prepare(request("\ufeff")), { code: "invalid_source" });
  assert(await controller.prepare(baseline));
});

test("preparation cancellation/deadline/busy rejection terminates workers then permits fresh operations", async () => {
  const controller = new PreparationController({ workerFactory: factory });
  const signal = new AbortController(), pending = controller.prepare(baseline, { signal: signal.signal });
  await assert.rejects(controller.prepare(baseline), { code: "busy" }); signal.abort();
  await assert.rejects(pending, { code: "cancelled" });
  assert(await controller.prepare(baseline));
  await assert.rejects(controller.prepare({ ...baseline, options: { deadlineMilliseconds: 1 } }), { code: "timed_out" });
  assert(await controller.prepare(baseline));
});

test("preparation rejects stale/altered output and holds admission until asynchronous disposal completes", async () => {
  let receive, stopped = false, release;
  const worker = { postMessage() {}, listen(message) { receive = message; return () => {}; },
    terminate() { return new Promise(resolve => { release = () => { stopped = true; resolve(); }; }); } };
  const controller = new PreparationController({ workerFactory: () => worker });
  const pending = controller.prepare(baseline);
  receive({ interfaceVersion: 1, buildID: "stale", kind: "prepared", result: {} });
  await assert.rejects(controller.prepare(baseline), { code: "busy" }); assert.equal(stopped, false);
  release(); await assert.rejects(pending, { code: "invalid_response" });
  const altered = new PreparationController({ workerFactory: () => ({ ...worker, terminate() {}, postMessage: () => {
    void prepareSketch(baseline).then(({ request, ...result }) => receive({ interfaceVersion: 1, buildID: baseline.buildID, kind: "prepared", result: { ...result, translationUnit: "altered" } }));
  } }) });
  await assert.rejects(altered.prepare(baseline), { code: "invalid_response" });
});

test("preparation cleanup failures prevent success and release the controller", async () => {
  let first = true, receive;
  const controller = new PreparationController({ workerFactory: () => first ? {
    listen(message) { receive = message; return () => {}; },
    postMessage() { receive({ interfaceVersion: 1, buildID: baseline.buildID, kind: "failure", error: { code: "invalid_source", stage: "preprocessing", message: "failure" }, diagnostics: [] }); },
    terminate() { first = false; throw new Error("failed disposal"); }
  } : factory() });
  await assert.rejects(controller.prepare(baseline), { code: "cleanup_failed" });
  assert(await controller.prepare(baseline));
});

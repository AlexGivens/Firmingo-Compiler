import test from "node:test";
import assert from "node:assert/strict";
import { BuiltServiceController } from "../web/built-service-controller.js";

/** Protocol-only lifetime fixture; no WASM module is instantiated or compilation claimed. */
function fakeWorker(t) {
  const workers = [], prior = globalThis.Worker;
  class Worker {
    constructor() { this.terminated = 0; workers.push(this); }
    postMessage(message) { this.input = message; }
    terminate() { ++this.terminated; }
    send(fields) { this.onmessage?.({ data: { id: this.input.id, ...fields } }); }
  }
  globalThis.Worker = Worker;
  t.after(() => { globalThis.Worker = prior; });
  return workers;
}

test("maintenance controller cancellation terminates before settling, rejects busy and ignores stale results after fresh admission", async t => {
  const workers = fakeWorker(t), controller = new BuiltServiceController(), abort = new AbortController();
  const phases = [];
  const pending = controller.run({}, { signal: abort.signal, onPhase: phase => phases.push(phase) });
  const rejection = assert.rejects(pending, { code: "cancelled" });
  const stale = workers[0].onmessage, id = workers[0].input.id;
  await assert.rejects(controller.run({}), { code: "busy" });
  abort.abort(); await rejection;
  assert.equal(workers[0].terminated, 1); assert.equal(workers[0].onmessage, null);
  const fresh = controller.run({});
  stale({ data: { id, phase: "compiling" } }); stale({ data: { id, result: { builds: [{}] } } });
  assert.deepEqual(phases, []); assert.equal(workers[1].terminated, 0);
  workers[1].send({ result: { builds: [{ fixture: "protocol only" }] } });
  assert.deepEqual(await fresh, { builds: [{ fixture: "protocol only" }] }); assert.equal(workers[1].terminated, 1);
});

test("startup and compile deadlines terminate unresponsive workers and allow fresh admission with deterministic clocks", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const workers = fakeWorker(t), controller = new BuiltServiceController();
  let pending = controller.run({}, { timeout: 50 });
  let rejection = assert.rejects(pending, { code: "timed_out" }); t.mock.timers.tick(50); await rejection;
  assert.equal(workers[0].terminated, 1);
  pending = controller.run({}, { compilationTimeout: 10 }); rejection = assert.rejects(pending, { code: "timed_out" });
  workers[1].send({ phase: "compiling" }); t.mock.timers.tick(10); await rejection;
  assert.equal(workers[1].terminated, 1);
  const fresh = controller.run({}); workers[2].send({ result: { builds: [{}] } }); await fresh;
  t.mock.timers.tick(60000); assert.equal(workers[2].terminated, 1);
});

test("uncorrelated, malformed, crashed and observer-failed workers settle as failures and clean up", async t => {
  const workers = fakeWorker(t), controller = new BuiltServiceController();
  for (const [send, expected] of [
    [worker => worker.onmessage({ data: { id: worker.input.id + 1, result: { builds: [{}] } } }), { code: "uncorrelated_worker_result" }],
    [worker => worker.send({ phase: "invented" }), { code: "invalid_worker_phase" }],
    [worker => worker.send({ result: {} }), { code: "invalid_worker_result" }],
    [worker => worker.onerror(), { code: "worker_failed" }],
    [worker => worker.onmessageerror(), { code: "worker_failed" }],
  ]) {
    const pending = controller.run({}), rejection = assert.rejects(pending, expected), worker = workers.at(-1);
    send(worker); await rejection; assert.equal(worker.terminated, 1);
  }
  const pending = controller.run({}, { onPhase: () => { throw new Error("observer failure"); } });
  const rejection = assert.rejects(pending, /observer failure/); workers.at(-1).send({ phase: "compiling" }); await rejection;
  assert.equal(workers.at(-1).terminated, 1);
});

test("invalid deadlines, pre-cancellation and synchronous post failure never leave an admitted worker", async t => {
  const workers = fakeWorker(t), controller = new BuiltServiceController();
  await assert.rejects(controller.run({}, { timeout: 0 }), { code: "invalid_deadline" });
  await assert.rejects(controller.run({}, { compilationTimeout: 60001 }), { code: "invalid_deadline" });
  await assert.rejects(controller.run({}, { signal: AbortSignal.abort() }), { code: "cancelled" }); assert.equal(workers.length, 0);
  const prior = globalThis.Worker;
  globalThis.Worker = class extends prior { postMessage() { throw new Error("post failed"); } };
  await assert.rejects(controller.run({}), /post failed/); assert.equal(workers[0].terminated, 1);
  globalThis.Worker = prior;
  const fresh = controller.run({}); workers[1].send({ result: { builds: [{}] } }); await fresh;
});

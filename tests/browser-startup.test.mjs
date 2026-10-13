import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { waitForBrowserEndpoint } from "../tools/browser-startup.mjs";

const child = () => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
const clean = browser => {
  assert.equal(browser.stdout.listenerCount("data"), 0); assert.equal(browser.stderr.listenerCount("data"), 0);
  assert.equal(browser.listenerCount("error"), 0); assert.equal(browser.listenerCount("exit"), 0);
};

test("browser readiness resolves immediately from either output stream and cleans bounded startup watchers", async () => {
  for (const stream of ["stdout", "stderr"]) {
    const browser = child(), observed = []; let text = "initial unrelated diagnostic";
    const pending = waitForBrowserEndpoint(browser, { diagnostic: () => text, record: record => observed.push(record) });
    text += "\nDevTools listening on ws://127.0.0.1:1234/devtools/browser/review-1"; browser[stream].emit("data", Buffer.from(text));
    assert.equal(await pending, "ws://127.0.0.1:1234/devtools/browser/review-1");
    assert.deepEqual(observed, [{ status: "ready", deadlineMilliseconds: 30000, endpointFound: true }]); clean(browser);
  }
});

test("browser startup timeout, process error and early exit remain failures with no retry or leaked watchers", async () => {
  for (const event of ["timeout", "error", "exit"]) {
    const browser = child(), observed = [];
    const pending = waitForBrowserEndpoint(browser, { diagnostic: () => "bounded diagnostics", deadlineMilliseconds: 1, record: state => observed.push(state) });
    if (event === "error") browser.emit("error", new Error("launch failed"));
    if (event === "exit") browser.emit("exit", 7, null);
    await assert.rejects(pending);
    assert.equal(observed.length, 1); assert.equal(observed[0].endpointFound, false); clean(browser);
  }
});

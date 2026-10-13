import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { trackBrowser, closeBrowser, removeBrowserProfile } from "../tools/browser-lifecycle.mjs";

const budgets = { graceMilliseconds: 5, terminateMilliseconds: 5, killMilliseconds: 5 };

test("browser exit does not authorize profile deletion while helper stdio remains open", async () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-browser-close-"));
  const browser = new EventEmitter(), signals = [];
  const lifetime = trackBrowser(browser, name => signals.push(name));
  const profile = join(root, "isolated"), helper = join(profile, "Default"); mkdirSync(helper, { recursive: true });
  try {
    let requested;
    const started = new Promise(resolve => { requested = resolve; });
    const pending = closeBrowser(lifetime, async () => { browser.emit("exit", 0); requested(); }, { ...budgets, graceMilliseconds: 1000 });
    await started;
    assert.equal(lifetime.closed, false); assert(existsSync(profile));
    writeFileSync(join(helper, "last-write"), "helper still owns profile");
    browser.emit("close", 0); await pending;
    lifetime.signal("SIGTERM"); // Disposal must not signal a process group after closure.
    assert.deepEqual(signals, []); removeBrowserProfile(profile); assert(!existsSync(profile));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("browser cleanup escalates a stalled graceful close through its owned process group", async () => {
  const browser = new EventEmitter(), signals = [];
  const lifetime = trackBrowser(browser, name => { signals.push(name); if (name === "SIGKILL") browser.emit("close", null, name); });
  await closeBrowser(lifetime, async () => {}, budgets);
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]); assert(lifetime.closed);
});

test("missing/closed browser protocol still permits bounded termination, including spawn failure", async () => {
  for (const requestClose of [undefined, async () => { throw new Error("closed protocol"); }]) {
    const browser = new EventEmitter(), signals = [];
    const lifetime = trackBrowser(browser, name => { signals.push(name); browser.emit("close", null, name); });
    await closeBrowser(lifetime, requestClose, budgets); assert.deepEqual(signals, ["SIGTERM"]);
  }
  const failed = new EventEmitter(), signals = [];
  const lifetime = trackBrowser(failed, name => signals.push(name));
  failed.emit("error", new Error("spawn failed")); failed.emit("close", -1);
  await closeBrowser(lifetime, undefined, budgets); assert.deepEqual(signals, []);
});

test("unacknowledged browser termination fails instead of deleting a profile still in use", async () => {
  const browser = new EventEmitter(), signals = [];
  const lifetime = trackBrowser(browser, name => signals.push(name));
  await assert.rejects(closeBrowser(lifetime, async () => {}, budgets), /did not close.*profile retained/);
  assert.equal(lifetime.closed, false); assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  browser.emit("close", null); // Release the owned observation after testing the failure path.
});

test("profile removal handles readonly files and absence but rejects invalid paths", () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-profile-remove-"));
  try {
    const profile = join(root, "isolated"); mkdirSync(join(profile, "Default"), { recursive: true });
    writeFileSync(join(profile, "Default", "readonly"), "owned fixture", { mode: 0o400 });
    removeBrowserProfile(profile); assert(!existsSync(profile)); removeBrowserProfile(profile);
    assert.throws(() => removeBrowserProfile(null), { code: "ERR_INVALID_ARG_TYPE" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

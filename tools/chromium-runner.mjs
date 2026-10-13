import { spawn } from "node:child_process";
import { accessSync, constants, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

/** Uses an explicitly provisioned browser, never downloads or modifies the user's normal profile. */
export function findChromium(explicit) {
  if (explicit) { accessSync(resolve(explicit), constants.X_OK); return resolve(explicit); }
  const candidates = process.platform === "darwin" ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"] : [];
  for (const directory of (process.env.PATH || "").split(delimiter)) for (const name of ["google-chrome", "chromium", "chromium-browser"]) candidates.push(join(directory, name));
  for (const path of candidates) try { accessSync(path, constants.X_OK); return path; } catch {}
  return null;
}

/** Small bounded DevTools client, used for test functions and text results only; no screenshots/UI inspection. */
class Protocol {
  #socket;
  #sequence = 0;
  #pending = new Map();
  #listeners = new Set();
  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener("message", event => {
      try {
        if (typeof event.data !== "string" || event.data.length > 1048576) throw new Error("Browser protocol message exceeds limit");
        const message = JSON.parse(event.data);
        if (message.id) {
          const pending = this.#pending.get(message.id); if (!pending) return;
          this.#pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
        } else for (const listener of this.#listeners) listener(message);
      } catch (error) { this.#fail(error); }
    });
    socket.addEventListener("close", () => this.#fail(new Error("Browser protocol closed")));
    socket.addEventListener("error", () => this.#fail(new Error("Browser protocol failed")));
  }
  #fail(error) { for (const pending of this.#pending.values()) { clearTimeout(pending.timer); pending.reject(error); } this.#pending.clear(); }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error("Browser protocol connection deadline exceeded")); }, 10000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Browser protocol connection failed")); }, { once: true });
    });
    return new Protocol(socket);
  }
  send(method, params = {}, sessionId, timeout = 10000) {
    if (this.#pending.size >= 64) return Promise.reject(new Error("Excessive pending browser protocol commands"));
    const id = ++this.#sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.#pending.delete(id); reject(new Error("Browser command deadline exceeded: " + method)); }, timeout);
      this.#pending.set(id, { resolve, reject, timer });
      try { this.#socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (error) { clearTimeout(timer); this.#pending.delete(id); reject(error); }
    });
  }
  listen(handler) { this.#listeners.add(handler); return () => this.#listeners.delete(handler); }
  event(method, sessionId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const unsubscribe = this.listen(message => {
        if (message.method === method && message.sessionId === sessionId) { clearTimeout(timer); unsubscribe(); resolve(message.params); }
      });
      const timer = setTimeout(() => { unsubscribe(); reject(new Error("Browser event deadline exceeded: " + method)); }, timeout);
    });
  }
  close() { this.#socket.close(); this.#fail(new Error("Test protocol disposed")); }
}

/** Runs only the isolated harness; page requests outside its loopback origin are rejected. */
export async function runChromiumChecks(browserPath, host) {
  const directory = fileURLToPath(new URL("../.build/web-profiles/", import.meta.url));
  mkdirSync(directory, { recursive: true }); const profile = mkdtempSync(join(directory, "isolated-"));
  const browser = spawn(browserPath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-sync", "--disable-component-update", "--disable-extensions", "--disable-default-apps",
    "--disable-breakpad", "--metrics-recording-only", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=" + profile, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let diagnostic = "", protocol, closed = false;
  const exited = new Promise(resolve => browser.once("exit", () => { closed = true; resolve(); }));
  browser.stderr.on("data", bytes => { diagnostic = (diagnostic + bytes.toString()).slice(-16384); });
  const outerDeadline = setTimeout(() => browser.kill("SIGKILL"), 120000);
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error("Headless browser startup deadline exceeded: " + diagnostic)); }, 12000);
      const output = () => { const match = /DevTools listening on (ws:\/\/127\.0\.0\.1:[0-9]+\/devtools\/browser\/[A-Za-z0-9-]+)/.exec(diagnostic); if (match) { cleanup(); resolve(match[1]); } };
      const failed = error => { cleanup(); reject(error instanceof Error ? error : new Error("Headless browser exited during startup: " + diagnostic)); };
      const cleanup = () => { clearTimeout(timer); browser.stderr.off("data", output); browser.off("error", failed); browser.off("exit", failed); };
      browser.stderr.on("data", output); browser.once("error", failed); browser.once("exit", failed); output();
    });
    protocol = await Protocol.connect(endpoint);
    const version = await protocol.send("Browser.getVersion");
    const { targetId } = await protocol.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await protocol.send("Target.attachToTarget", { targetId, flatten: true });
    const external = [], faults = [];
    const stopListening = protocol.listen(message => {
      if (message.sessionId !== sessionId) return;
      if (message.method === "Fetch.requestPaused") {
        const url = message.params.request.url;
        const allowed = url.startsWith(host.origin + "/");
        if (!allowed && external.length < 64) external.push(url.slice(0, 256));
        void protocol.send(allowed ? "Fetch.continueRequest" : "Fetch.failRequest", allowed ? { requestId: message.params.requestId }
          : { requestId: message.params.requestId, errorReason: "BlockedByClient" }, sessionId).catch(error => { if (faults.length < 64) faults.push(error.message); });
      }
      if (message.method === "Runtime.exceptionThrown" && faults.length < 64) faults.push(message.params.exceptionDetails.text);
    });
    await protocol.send("Page.enable", {}, sessionId);
    await protocol.send("Runtime.enable", {}, sessionId);
    await protocol.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] }, sessionId);
    const loaded = protocol.event("Page.loadEventFired", sessionId);
    void loaded.catch(() => {}); // Navigation failure must not leave an unobserved event timeout.
    const navigation = await protocol.send("Page.navigate", { url: host.origin + "/" }, sessionId);
    if (navigation.errorText) throw new Error(navigation.errorText);
    await loaded;
    // Await the page's static module setup, then call its reusable test module. No source/DOM inspection is performed.
    const result = await protocol.send("Runtime.evaluate", { expression: `(async () => { await globalThis.firmingoHarnessReady; const { runWebChecks } = await import('/web/checks.js'); return await runWebChecks({ serviceAvailable: ${host.serviceAvailable} }); })()`,
      awaitPromise: true, returnByValue: true, allowUnsafeEvalBlockedByCSP: false }, sessionId, 100000);
    if (result.exceptionDetails) throw new Error("Browser harness evaluation failed: " + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
    const report = result.result?.value;
    if (!report || report.schema !== 1 || !Array.isArray(report.cases) || report.cases.length !== 9) throw new Error("Browser omitted bounded test report");
    stopListening();
    return { ...report, browser: { product: version.product, revision: version.revision, protocolVersion: version.protocolVersion, jsVersion: version.jsVersion },
      externalRequests: external, protocolFaults: faults, localRequestCount: host.requests.length };
  } finally {
    clearTimeout(outerDeadline);
    if (protocol) { try { await protocol.send("Browser.close", {}, undefined, 3000); } catch {} protocol.close(); }
    if (!closed) browser.kill("SIGTERM");
    await Promise.race([exited, new Promise(resolve => { const timer = setTimeout(() => { browser.kill("SIGKILL"); resolve(); }, 3000); exited.then(() => { clearTimeout(timer); resolve(); }); })]);
    rmSync(profile, { recursive: true, force: true });
  }
}

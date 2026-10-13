import test from "node:test";
import assert from "node:assert/strict";
import { permittedHarnessRequest, HARNESS_CSP, harnessResources } from "../tools/web-server.mjs";
import { findChromium } from "../tools/chromium-runner.mjs";

const host = "127.0.0.1:45678", routes = new Map([["/", {}], ["/runtime/browser-worker.js", {}]]);
const request = (changes = {}) => ({ method: "GET", url: "/", headers: { host }, ...changes });

test("developer web route policy accepts only exact readonly same-origin requests", () => {
  assert(permittedHarnessRequest(request(), host, routes));
  assert(permittedHarnessRequest(request({ method: "HEAD" }), host, routes));
  assert(permittedHarnessRequest(request({ url: "/runtime/browser-worker.js", headers: { host, origin: "http://" + host, "sec-fetch-site": "same-origin" } }), host, routes));
  for (const changes of [{ method: "POST" }, { method: "PUT" }, { method: "OPTIONS" }, { method: "DELETE" },
    { headers: { host: "attacker.invalid:45678" } }, { headers: { host, origin: "null" } },
    { headers: { host, origin: "https://other.invalid" } }, { headers: { host, "sec-fetch-site": "cross-site" } }])
    assert(!permittedHarnessRequest(request(changes), host, routes), JSON.stringify(changes));
});

test("harness never resolves dotfiles, sibling paths, encoded aliases, arbitrary outputs or query variants", () => {
  for (const url of ["/.git/config", "/.build/receipt.json", "/../FirmingoKit/AGENTS.md", "/%2e%2e/runtime/browser-worker.js", "/runtime/../runtime/browser-worker.js",
    "/runtime//browser-worker.js", "//runtime/browser-worker.js", "/runtime/browser-worker.js?source=secret", "/development-service.wasm", "/source.json"])
    assert(!permittedHarnessRequest(request({ url }), host, routes), url);
  assert(HARNESS_CSP.includes("connect-src 'self'")); assert(HARNESS_CSP.includes("worker-src 'self'"));
  assert(HARNESS_CSP.includes("'wasm-unsafe-eval'")); assert(!HARNESS_CSP.includes("'unsafe-eval'"));
  assert(HARNESS_CSP.includes("frame-ancestors 'none'"));
});

test("explicit missing browser/service paths fail without launching or silently downloading anything", async () => {
  assert.throws(() => findChromium("/nonexistent/explicit-chromium"), { code: "ENOENT" });
  await assert.rejects(harnessResources("/nonexistent/explicit-service.wasm"), { code: "ENOENT" });
});

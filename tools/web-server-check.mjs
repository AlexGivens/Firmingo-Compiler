import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";

/** Exercises the real loopback HTTP boundary without source uploads, browser assumptions or service execution. */
export async function checkWebServer(host) {
  const fetchLocal = (path, options = {}) => fetch(host.origin + path, { ...options, signal: AbortSignal.timeout(5000), redirect: "error" });
  const config = await fetchLocal("/harness-config.json");
  assert.equal(config.status, 200);
  assert(config.headers.get("content-security-policy").includes("connect-src 'self'"));
  assert.equal(config.headers.get("cache-control"), "no-store");
  assert.equal(config.headers.get("access-control-allow-origin"), null);
  assert.equal((await config.json()).serviceAvailable, host.serviceAvailable);
  const worker = await fetchLocal("/runtime/browser-worker.js", { method: "HEAD" });
  assert.equal(worker.status, 200); assert(worker.headers.get("content-type").startsWith("text/javascript"));
  assert(Number(worker.headers.get("content-length")) > 0); assert.equal((await worker.arrayBuffer()).byteLength, 0);
  for (const directory of ["nano_rp2040_connect", "nano_rp2040_connect_v2"]) {
    const response = await fetchLocal(`/recipes/${directory}/Sources/ManagedRecipe.js`);
    assert.equal(response.status, 200); assert(response.headers.get("content-type").startsWith("text/javascript"));
  }
  for (const [path, options] of [["/.git/config", {}], ["/.build/logs/web-results.json", {}], ["/source.json", {}], ["/runtime/browser-worker.js?alias=1", {}],
    ["/", { method: "POST", body: "No source is accepted" }], ["/", { headers: { origin: "https://other.invalid" } }]]) {
    const response = await fetchLocal(path, options); assert.equal(response.status, 404, JSON.stringify({ path, options })); assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
  // Fetch controls Host itself; use HTTP directly to exercise an actual hostile Host header.
  const hostileStatus = await new Promise((resolve, reject) => {
    const url = new URL(host.origin);
    const request = httpRequest({ hostname: url.hostname, port: url.port, path: "/", method: "GET", headers: { host: "attacker.invalid" } }, response => {
      response.resume(); response.once("end", () => resolve(response.statusCode)); response.once("error", reject);
    });
    request.setTimeout(5000, () => request.destroy(new Error("HTTP policy deadline exceeded")));
    request.once("error", reject); request.end();
  });
  assert.equal(hostileStatus, 404);
  const service = await fetchLocal("/development-service.wasm", { method: "HEAD" });
  assert.equal(service.status, host.serviceAvailable ? 200 : 404);
  if (host.serviceAvailable) assert.equal(service.headers.get("content-type"), "application/wasm");
  console.log("Real loopback resource/headers/readonly-route checks passed; no source or device operation");
}

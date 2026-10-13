import { createServer } from "node:http";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readBounded } from "./bounded-file.mjs";
import { verifyVendor } from "./verify-vendor.mjs";
import { verifyRecipe } from "./verify-recipe.mjs";
import { sha256 } from "../src/hash.js";
import { SERVICE } from "../runtime/pins.js";
import { requireBoundedMemory } from "../runtime/ModuleMemory.js";

const root = new URL("../", import.meta.url);
export const HARNESS_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/** Exact route matching: no directories, source uploads, aliases, CORS or arbitrary files. */
export function permittedHarnessRequest(request, host, routes) {
  return ["GET", "HEAD"].includes(request.method) && request.headers.host === host
    && (!request.headers.origin || request.headers.origin === "http://" + host)
    && (!request.headers["sec-fetch-site"] || ["same-origin", "none"].includes(request.headers["sec-fetch-site"]))
    && typeof request.url === "string" && routes.has(request.url);
}

/** Snapshots only package modules, the marked synthetic fixture and an optional verified service before listening. */
export async function harnessResources(servicePath) {
  verifyVendor({ quiet: true }); await verifyRecipe();
  const routes = new Map();
  const add = (url, path, type, maximum = 262144) => {
    routes.set(url, { bytes: readBounded(fileURLToPath(new URL(path, root)), maximum), type });
  };
  for (const directory of ["src", "runtime", "third_party/browser_wasi_shim/dist"]) {
    for (const file of readdirSync(new URL(directory + "/", root)).filter(name => name.endsWith(".js")))
      add(`/${directory}/${file}`, `${directory}/${file}`, "text/javascript; charset=utf-8");
  }
  for (const file of ["harness.js", "checks.js"]) add("/web/" + file, "web/" + file, "text/javascript; charset=utf-8");
  add("/", "web/harness.html", "text/html; charset=utf-8");
  add("/web/harness.css", "web/harness.css", "text/css; charset=utf-8");
  const recipe = "recipes/nano_rp2040_connect/";
  for (const path of ["manifest.json", "Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"])
    add("/" + recipe + path, recipe + path, path.endsWith(".js") ? "text/javascript; charset=utf-8" : "application/octet-stream");
  add("/fixture-request.json", "tests/fixtures/synthetic-packaging-request.json", "application/json; charset=utf-8");
  if (servicePath) {
    const bytes = readBounded(servicePath, SERVICE.bytes);
    if (bytes.length !== SERVICE.bytes || await sha256(bytes) !== SERVICE.sha256) throw new Error("Explicit compiler service does not match pinned size/digest");
    requireBoundedMemory(bytes);
    routes.set("/development-service.wasm", { bytes, type: "application/wasm" });
  }
  routes.set("/harness-config.json", { bytes: new TextEncoder().encode(JSON.stringify({ schema: 1, serviceAvailable: Boolean(servicePath),
    qualification: "developer harness; synthetic fixture NEVER DEPLOY" })), type: "application/json; charset=utf-8" });
  return routes;
}

/** Readonly loopback developer host; source and resulting microcontroller bytes stay in the browser. */
export async function startWebHarness({ servicePath } = {}) {
  const routes = await harnessResources(servicePath), requests = [];
  const server = createServer((request, response) => {
    const host = "127.0.0.1:" + server.address().port;
    response.setHeader("Content-Security-Policy", HARNESS_CSP);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (requests.length >= 4096) { response.writeHead(429); response.end(); return; }
    const permitted = permittedHarnessRequest(request, host, routes);
    requests.push({ method: request.method, path: String(request.url).slice(0, 256), status: permitted ? 200 : 404 });
    if (!permitted) { response.writeHead(404); response.end(); return; }
    const asset = routes.get(request.url);
    response.setHeader("Content-Type", asset.type); response.setHeader("Content-Length", asset.bytes.length);
    response.writeHead(200); response.end(request.method === "HEAD" ? undefined : asset.bytes);
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  server.maxHeadersCount = 32;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => { server.off("error", reject); resolve(); });
  });
  return { origin: "http://127.0.0.1:" + server.address().port, serviceAvailable: Boolean(servicePath),
    get requests() { return requests.map(item => ({ ...item })); },
    close: () => new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}

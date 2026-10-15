import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { bundle } from "./bundle.mjs";
import { verifyRecipe } from "./verify-recipe.mjs";
import { verifyVendor } from "./verify-vendor.mjs";
import { RECIPE_ASSETS, STATEFUL_RECIPE_ASSETS, SERVICE } from "../runtime/pins.js";

/** Exports deterministic classic-worker compiler assets with source/notice identity; no host bridge or service binary. */
export async function exportWeb(directory) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  verifyVendor({ quiet: true }); await verifyRecipe();
  const page = bundle(root, "src/index.js"), worker = bundle(root, "runtime/browser-worker.js"), preparation = bundle(root, "runtime/preparation-worker.js");
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  const recipeManifest = readFileSync(join(root, "recipes/nano_rp2040_connect/manifest.json"));
  const resources = { recipeManifest: [...recipeManifest], recipeAssets: Object.fromEntries(RECIPE_ASSETS.map(item =>
    [item.path, [...readFileSync(join(root, "recipes/nano_rp2040_connect/", item.path))]])) };
  resources.profiles = { "nano-managed-v2": { recipeManifest: [...readFileSync(join(root, "recipes/nano_rp2040_connect_v2/manifest.json"))],
    recipeAssets: Object.fromEntries(STATEFUL_RECIPE_ASSETS.map(item => [item.path, [...readFileSync(join(root, "recipes/nano_rp2040_connect_v2/", item.path))]])) } };
  const sources = new Map([...page.inputs, ...worker.inputs, ...preparation.inputs].map(item => [item.path, item.bytes]));
  // Include the exact recipe, vendor inventory and maintenance sources needed to recreate this export.
  const vendor = JSON.parse(readFileSync(join(root, "third_party/browser_wasi_shim/receipt.json")));
  const additional = ["package.json", "LICENSE", ".node-version", "tools/export-web.mjs", "tools/bundle.mjs",
    "tools/verify-recipe.mjs", "tools/verify-vendor.mjs", "recipes/nano_rp2040_connect/manifest.json",
    "recipes/nano_rp2040_connect_v2/manifest.json", ...STATEFUL_RECIPE_ASSETS.map(item => "recipes/nano_rp2040_connect_v2/" + item.path),
    ...RECIPE_ASSETS.map(item => "recipes/nano_rp2040_connect/" + item.path),
    "third_party/browser_wasi_shim/receipt.json", ...vendor.files.map(item => "third_party/browser_wasi_shim/" + item.path)];
  for (const path of additional) sources.set(path, readFileSync(join(root, path)));
  const sourceRecords = [...sources].sort(([a], [b]) => a < b ? -1 : 1).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) }));
  const files = { "compiler.js": Buffer.from(page.output), "worker.js": Buffer.from(worker.output), "preparation-worker.js": Buffer.from(preparation.output), "resources.json": Buffer.from(JSON.stringify(resources)),
    "LICENSE-MIT": readFileSync(join(root, "third_party/browser_wasi_shim/LICENSE-MIT")),
    "LICENSE-APACHE": readFileSync(join(root, "third_party/browser_wasi_shim/LICENSE-APACHE")), "Firmingo-Compiler-LICENSE": readFileSync(join(root, "LICENSE")),
    "sources.json": Buffer.from(JSON.stringify(Object.fromEntries([...sources].sort(([a], [b]) => a < b ? -1 : 1).map(([path, bytes]) => [path, bytes.toString("utf8")])))) };
  const manifest = { schema: 1, package: "firmingo-compiler", version: "0.0.0-development", interfaceVersion: 1, serviceABI: 2,
    recipeSHA256: hash(recipeManifest), service: SERVICE, sourceRecords,
    files: Object.entries(files).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })) };
  mkdirSync(directory);
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(directory, name), bytes, { flag: "wx" });
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(directory, "manifest.json"), manifestBytes, { flag: "wx" });
  console.log(JSON.stringify({ status: "exported_web_sources_only", manifestSHA256: hash(manifestBytes), modules: sources.size }));
}

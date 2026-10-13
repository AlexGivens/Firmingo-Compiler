import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { SHIM } from "../runtime/pins.js";

/** Checks the unchanged vendor inventory against a trusted package pin, retaining both license notices. */
export function verifyVendor({ quiet = false } = {}) {
  const root = new URL("../third_party/browser_wasi_shim/", import.meta.url);
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  const bytes = readFileSync(new URL("receipt.json", root));
  if (hash(bytes) !== SHIM.receiptSHA256) throw new Error("WASI shim receipt mismatch");
  const receipt = JSON.parse(bytes);
  if (receipt.package !== SHIM.package || receipt.version !== SHIM.version || receipt.files.length !== 11) throw new Error("WASI shim pin mismatch");
  for (const item of receipt.files) {
    if (!/^(?:package\.json|LICENSE-(?:MIT|APACHE)|dist\/[a-z_]+\.js)$/.test(item.path)) throw new Error("Unsafe vendor receipt path");
    const content = readFileSync(new URL(item.path, root));
    if (content.length !== item.bytes || hash(content) !== item.sha256) throw new Error("WASI shim resource mismatch: " + item.path);
  }
  if (!quiet) console.log("Verified unchanged WASI shim 0.4.2 and license inventory");
}

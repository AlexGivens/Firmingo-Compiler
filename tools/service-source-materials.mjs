import { createHash } from "node:crypto";
import { lstatSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve, dirname } from "node:path";
import { parseContractJSON } from "../src/index.js";
import { readBounded } from "./bounded-file.mjs";
import { verifyServiceNoticeReview } from "./service-notice-review.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const prefix = "Tools/ArduinoDirectWASM/CompilerService/";
const identity = bytes => ({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
const json = bytes => parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
const safeName = name => typeof name === "string" && /^[A-Za-z0-9_.\/-]+$/.test(name)
  && name.split("/").every(part => part && part !== "." && part !== "..");

function regular(rootPath, name, maximum = 1048576) {
  if (!safeName(name) || !lstatSync(rootPath).isDirectory() || lstatSync(rootPath).isSymbolicLink()) throw new Error("Unsafe source material path");
  let path = rootPath;
  for (const part of name.split("/")) {
    path = join(path, part);
    if (lstatSync(path).isSymbolicLink()) throw new Error("Symlinked source material");
  }
  return readBounded(path, maximum);
}

/** Verify the author's grant and byte-identical original inputs; this is not binary clearance. */
export function verifyOwnedServiceSources(sourceRoot = join(root, "service/source")) {
  const bytes = regular(sourceRoot, "manifest.json", 65536), manifest = json(bytes);
  const pins = json(regular(root, "docs/service-reference.json", 65536));
  if (manifest.schema !== 1 || manifest.author !== "Alex Givens" || manifest.contributionLicense !== "GPL-3.0-only"
      || manifest.ownershipStatus !== "confirmed by author" || manifest.confirmationDate !== "2026-10-13"
      || manifest.confirmation !== "ArduinoKit and LLVM patches were all authored by me, and should use the GPL-3.0 license"
      || manifest.origin?.repository !== "ArduinoKit" || manifest.origin.commit !== pins.referenceCommit
      || manifest.upstream?.project !== "LLVM" || manifest.upstream.commit !== pins.llvmCommit
      || manifest.upstream.license !== "Apache-2.0 WITH LLVM-exception" || manifest.distributionStatus !== "unresolved"
      || !Array.isArray(manifest.files) || !Array.isArray(manifest.licenseFiles)) throw new Error("Unsupported source ownership/license grant");
  const expected = pins.files.filter(record => record.path.startsWith(prefix) && ["source", "patch"].includes(record.role));
  if (manifest.files.length !== expected.length || expected.length !== 23 || manifest.licenseFiles.length !== 2) throw new Error("Incomplete licensed source inventory");
  const materials = new Map([["manifest.json", bytes], ["SOURCE-LICENSE.md", regular(sourceRoot, "SOURCE-LICENSE.md", 65536)]]);
  for (const [index, record] of manifest.files.entries()) {
    const pin = expected[index];
    if (record.path !== pin.path.slice(prefix.length) || record.originPath !== pin.path || record.role !== pin.role
        || record.bytes !== pin.bytes || record.sha256 !== pin.sha256) throw new Error("Licensed source inventory differs from reference pin");
    const data = regular(sourceRoot, record.path, pin.bytes);
    if (JSON.stringify(identity(data)) !== JSON.stringify({ bytes: pin.bytes, sha256: pin.sha256 })) throw new Error("Licensed source bytes differ from reference pin");
    materials.set(record.path, data);
  }
  for (const [index, record] of manifest.licenseFiles.entries()) {
    const name = index === 0 ? "LICENSE" : "LLVM-LICENSE.txt";
    const pin = index === 0 ? identity(regular(root, "LICENSE", 65536)) : pins.llvmLicense;
    if (record.path !== name || record.bytes !== pin.bytes || record.sha256 !== pin.sha256) throw new Error("Unexpected source license identity");
    const data = regular(sourceRoot, name, pin.bytes);
    if (identity(data).sha256 !== pin.sha256 || data.length !== pin.bytes) throw new Error("Source license bytes differ from pin");
    materials.set(name, data);
  }
  let entryCount = 0;
  function inventory(directory, relative = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = relative + entry.name;
      if (++entryCount > 64 || name.split("/").length > 8 || !safeName(name) || entry.isSymbolicLink()) throw new Error("Unsafe source inventory entry");
      if (entry.isDirectory()) inventory(join(directory, entry.name), name + "/");
      else if (!entry.isFile() || !materials.has(name)) throw new Error("Unlisted source material");
    }
  }
  inventory(sourceRoot);
  return { manifest, manifestIdentity: identity(bytes), materials };
}

/** Source/selected-notice review directory; intentionally not complete Corresponding Source. */
export function exportServiceMaterials(output) {
  const owned = verifyOwnedServiceSources();
  const files = new Map([...owned.materials].map(([name, bytes]) => ["service/source/" + name, bytes]));
  for (const [name, bytes] of verifyServiceNoticeReview().materials) files.set("third_party/service-notice-review/" + name, bytes);
  const notices = json(regular(root, "third_party/service-runtime-notices/wasi-libc32/manifest.json", 65536));
  const shim = json(regular(root, "third_party/browser_wasi_shim/receipt.json", 65536));
  const add = (name, pin) => {
    const bytes = regular(root, name, pin?.bytes ?? 1048576);
    if (pin && (bytes.length !== pin.bytes || identity(bytes).sha256 !== pin.sha256)) throw new Error("Notice bytes differ from source receipt");
    files.set(name, bytes);
  };
  for (const record of [...notices.files, ...notices.sourceExcerpts]) add("third_party/service-runtime-notices/wasi-libc32/" + record.path, record);
  for (const record of shim.files.filter(record => record.path.startsWith("LICENSE-"))) add("third_party/browser_wasi_shim/" + record.path, record);
  for (const name of ["LICENSE", "docs/service-reference.json", "docs/service-licensing.md", "docs/service-build.md", "docs/runtime-source-build.md",
    "service/recipe.json", "service/runtime-recipe.json", "service/component-sources.json", "service/WASIClangToolchain.cmake",
    "tools/service_build.py", "tools/runtime_build.py", "tools/inspect-service.mjs", "tools/bounded-file.mjs", "runtime/ModuleMemory.js",
    "third_party/service-runtime-notices/wasi-libc32/manifest.json", "third_party/browser_wasi_shim/receipt.json"]) add(name);
  const manifest = { schema: 1, operation: "custom_service_source_notice_review_materials", contributionLicense: "GPL-3.0-only",
    sourceGrant: owned.manifestIdentity, distributionStatus: "unresolved", binaryIncluded: false, completeCorrespondingSource: false,
    missing: ["Full pinned upstream LLVM and WASI runtime source trees, adaptations and generation inputs",
      "Exact linked-component and file-specific notice review", "Complete source/build instructions paired with the selected distributable asset"],
    files: [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([path, bytes]) => ({ path, ...identity(bytes) })) };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
  output = resolve(output);
  mkdirSync(output);
  for (const [name, bytes] of files) {
    const path = join(output, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, { flag: "wx" });
  }
  writeFileSync(join(output, "manifest.json"), manifestBytes, { flag: "wx" });
  const receipt = { schema: 1, status: "exported_source_notice_review_materials", manifest: identity(manifestBytes), files: files.size,
    distributionStatus: "unresolved", binaryIncluded: false, completeCorrespondingSource: false };
  writeFileSync(join(output, "operation.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  return receipt;
}

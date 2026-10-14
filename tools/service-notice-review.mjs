import { createHash } from "node:crypto";
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBounded } from "./bounded-file.mjs";

const reviewRoot = fileURLToPath(new URL("../third_party/service-notice-review/", import.meta.url));
const manifestSHA256 = "6ea68ac9c6c2f898516bf450009c3f81d0605837242a059c3ab543339f38e817";
const identity = bytes => ({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });

function regular(root, name, maximum) {
  if (typeof name !== "string" || !/^[A-Za-z0-9_./-]+$/.test(name)
      || name.split("/").some(part => !part || part === "." || part === "..")
      || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error("Unsafe notice material path");
  let path = root;
  for (const part of name.split("/")) {
    path = join(path, part);
    if (lstatSync(path).isSymbolicLink()) throw new Error("Symlinked notice material");
  }
  return readBounded(path, maximum);
}

function checked(root, name, record) {
  const bytes = regular(root, name, record.bytes);
  const actual = identity(bytes);
  if (actual.bytes !== record.bytes || actual.sha256 !== record.sha256) throw new Error("Notice material bytes differ from reviewed identity");
  return bytes;
}

/** Checks a pinned conservative review bundle. Optional source checks do not verify the full archive or clear distribution. */
export function verifyServiceNoticeReview({ root = reviewRoot, sourceRoot } = {}) {
  const bytes = regular(root, "manifest.json", 131072);
  if (identity(bytes).sha256 !== manifestSHA256) throw new Error("Notice review manifest differs from reviewed pin");
  // The byte cap and independent committed hash are checked before parsing this large, fixed review inventory.
  const manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const materials = new Map([["manifest.json", bytes]]);
  for (const record of manifest.files) materials.set(record.path, checked(root, record.path, record));
  if (readdirSync(root).some(name => !materials.has(name)) || readdirSync(root).length !== materials.size) throw new Error("Unlisted notice review material");
  if (sourceRoot !== undefined) {
    checked(sourceRoot, "manifest.json", manifest.sourceManifest);
    const sections = [];
    for (const record of manifest.sourceExcerpts) {
      const source = checked(sourceRoot, record.sourcePath, record.sourceFile);
      const excerpt = source.subarray(record.offset, record.offset + record.excerpt.bytes);
      const observed = identity(excerpt);
      if (observed.bytes !== record.excerpt.bytes || observed.sha256 !== record.excerpt.sha256) throw new Error("Notice excerpt differs from source selection");
      sections.push(Buffer.from(`===== ${record.sourcePath} (line ${record.firstLine}) =====\n`), excerpt, Buffer.from("\n\n"));
    }
    if (!Buffer.concat(sections).equals(materials.get("FILE-NOTICES.txt"))) throw new Error("Notice documentation differs from source excerpts");
    const licenses = [];
    for (const record of manifest.namedLicenseSources) {
      licenses.push(Buffer.from(`===== ${record.sourcePath} =====\n`), checked(sourceRoot, record.sourcePath, record), Buffer.from("\n\n"));
    }
    if (!Buffer.concat(licenses).equals(materials.get("LICENSES.txt"))) throw new Error("License documentation differs from source texts");
  }
  return { manifest, materials, sourceSelectionsVerified: sourceRoot !== undefined };
}

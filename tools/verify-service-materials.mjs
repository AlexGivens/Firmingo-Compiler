import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";

/** Checks committed source-reference/review materials; no binary, download, license conclusion or execution. */
export function verifyServiceMaterials({ quiet = false } = {}) {
  const recipe = JSON.parse(readFileSync(new URL("../service/recipe.json", import.meta.url)));
  const sources = JSON.parse(readFileSync(new URL("../service/component-sources.json", import.meta.url)));
  const runtime = JSON.parse(readFileSync(new URL("../service/runtime-recipe.json", import.meta.url)));
  if (recipe.schema !== 1 || recipe.llvmVersion !== "22.1.8" || recipe.llvmCommit !== "ca7933e47d3a3451d81e72ac174dcb5aa28b59d1"
      || recipe.serviceABI !== 2 || recipe.maximumMemoryBytes !== 268435456 || recipe.stackBytes !== 16777216
      || recipe.distributionStatus !== "unresolved" || sources.schema !== 1 || sources.distributionStatus !== "unresolved") throw new Error("Unsupported maintenance source/material pins");
  if (runtime.schema !== 1 || runtime.target !== "wasm32-wasip1" || runtime.llvmCommit !== recipe.llvmCommit
      || runtime.cpu !== "lime1" || runtime.libcxxABIVersion !== "2"
      || runtime.archives.libc.sha256 !== "ea9827495c0f35bca3b3d0a953e854cac112c43bea3196b5a4f7f8fc4704b9a4"
      || runtime.archives.wasiHeaders.sha256 !== "fc78b28c2c06b64e0233544a65736fc5c515c5520365d6cf821408eadedaf367") throw new Error("Unsupported WASI runtime source recipe");
  const root = new URL("../third_party/service-runtime-notices/wasi-libc32/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root)));
  if (manifest.schema !== 1 || manifest.component !== "wasi-libc" || manifest.version !== "wasi-sdk-32"
      || manifest.sourceArchive.sha256 !== "ea9827495c0f35bca3b3d0a953e854cac112c43bea3196b5a4f7f8fc4704b9a4"
      || manifest.sourceArchive.bytes !== 1637111 || manifest.distributionStatus !== "unresolved" || manifest.files.length !== 8) throw new Error("Unexpected runtime notice source inventory");
  const names = new Set();
  for (const record of manifest.files) {
    if (!/^[A-Za-z0-9_./-]+$/.test(record.path) || record.path.split("/").some(part => !part || part === "." || part === "..")
        || names.has(record.path) || record.sourcePath !== "wasi-libc-wasi-sdk-32/" + record.path
        || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || record.bytes > 65536 || !/^[0-9a-f]{64}$/.test(record.sha256)) throw new Error("Unsafe runtime notice record");
    names.add(record.path);
    const bytes = readBounded(new URL(record.path, root), record.bytes);
    if (bytes.length !== record.bytes || createHash("sha256").update(bytes).digest("hex") !== record.sha256) throw new Error("Runtime notice bytes differ from receipt");
  }
  const excerpt = manifest.sourceExcerpts?.[0];
  if (manifest.sourceExcerpts?.length !== 1 || excerpt.path !== "dlmalloc-NOTICE.txt"
      || excerpt.sourcePath !== "wasi-libc-wasi-sdk-32/dlmalloc/src/malloc.c" || excerpt.firstLine !== 1 || excerpt.lineCount !== 6
      || !Number.isSafeInteger(excerpt.bytes) || excerpt.bytes <= 0 || excerpt.bytes > 4096
      || !/^[0-9a-f]{64}$/.test(excerpt.sha256) || !/^[0-9a-f]{64}$/.test(excerpt.sourceFileSHA256)) throw new Error("Unexpected allocator attribution excerpt");
  const excerptBytes = readBounded(new URL(excerpt.path, root), excerpt.bytes);
  if (excerptBytes.length !== excerpt.bytes || createHash("sha256").update(excerptBytes).digest("hex") !== excerpt.sha256) throw new Error("Allocator notice excerpt differs from receipt");
  if (!quiet) console.log("Verified owned development recipe/source references and eight unchanged upstream runtime notices; distribution unresolved");
}

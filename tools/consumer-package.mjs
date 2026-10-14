import { lstatSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, openSync, closeSync, readSync, writeSync, fstatSync, constants } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readBounded } from "./bounded-file.mjs";
import { parseContractJSON } from "../src/json.js";
import { canonicalJSON } from "../src/hash.js";
import { exportWeb } from "./export-web.mjs";
import { importResident } from "./import-resident.mjs";
import { SERVICE } from "../runtime/pins.js";

const repo = fileURLToPath(new URL("../", import.meta.url));
export const CONSUMER_REVIEW = Object.freeze(parseContractJSON(new TextDecoder().decode(readBounded(join(repo, "consumer/review.json"), 16384))));
const MAXIMUM = 400 * 1024 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const hex = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const parse = path => parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(readBounded(path, 65536)));

/** Streams an ordinary nonlink input; fixed caps and observed identity apply to copies as well as hashes. */
export function consumerFile(path, output) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  let target;
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.size < 1 || before.size > MAXIMUM) throw new Error("Invalid bounded consumer file");
    if (output) target = openSync(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
    const digest = createHash("sha256"), buffer = Buffer.alloc(1024 * 1024); let bytes = 0;
    for (;;) {
      const count = readSync(fd, buffer, 0, buffer.length, null); if (!count) break;
      bytes += count;
      if (bytes > before.size) throw new Error("Consumer input grew during capture");
      digest.update(buffer.subarray(0, count));
      if (target !== undefined) {
        let written = 0;
        while (written < count) written += writeSync(target, buffer, written, count - written);
      }
    }
    const after = fstatSync(fd);
    if (bytes !== before.size || before.ino !== after.ino || before.mtimeMs !== after.mtimeMs || before.size !== after.size)
      throw new Error("Consumer input changed during capture");
    return { bytes, sha256: digest.digest("hex") };
  } finally { if (target !== undefined) closeSync(target); closeSync(fd); }
}

/** Closed finite tree enumeration rejects links, special files, unsafe names and excess output before use. */
export function consumerFiles(root, localReceipt = false) {
  const records = []; let total = 0;
  const visit = (directory, prefix = "", depth = 0) => {
    const facts = lstatSync(directory);
    if (!facts.isDirectory() || facts.isSymbolicLink() || depth > 4) throw new Error("Unsafe consumer directory");
    const names = readdirSync(directory);
    if (!names.length || names.length > 64) throw new Error("Empty or excessive consumer directory");
    for (const name of names.sort()) {
      if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name === "." || name === "..") throw new Error("Unsafe consumer role");
      const path = prefix + name, absolute = join(directory, name), entry = lstatSync(absolute);
      if (entry.isSymbolicLink()) throw new Error("Symlinked consumer role");
      if (entry.isDirectory()) { visit(absolute, path + "/", depth + 1); continue; }
      if (localReceipt && !prefix && ["manifest.json", "operation.json"].includes(name)) {
        if (!entry.isFile()) throw new Error("Unsafe consumer metadata");
        continue;
      }
      if (records.length >= 64) throw new Error("Excessive consumer roles");
      const identity = consumerFile(absolute); total += identity.bytes;
      if (total > MAXIMUM) throw new Error("Excessive consumer payload");
      records.push({ path, ...identity });
    }
  };
  visit(root);
  return records.sort((a, b) => a.path < b.path ? -1 : 1);
}

/** Executes the existing complete source/notice verifier with the explicit optional isolated Python host. */
function delivery(root) {
  const result = spawnSync(process.env.FIRMINGO_SERVICE_BUILD_PYTHON || "python3", ["-I", "-S", "-B", join(repo, "tools/service_delivery.py"),
    "verify", root, CONSUMER_REVIEW.deliveryManifestSHA256], { encoding: "utf8", timeout: 300000, maxBuffer: 16384 });
  if (result.error || result.status !== 0) throw new Error("Reviewed delivery verification failed: " + (result.stderr || result.error?.message || result.status));
  const value = parseContractJSON(result.stdout);
  if (value.status !== "verified_reviewed_service_delivery" || value.serviceSHA256 !== SERVICE.sha256) throw new Error("Wrong reviewed service");
}

/** Recreates the portable runtime and recipe from this pinned source; no service is instantiated. */
async function webMatches(root) {
  const scratch = mkdtempSync(join(tmpdir(), "firmingo-consumer-web-"));
  try {
    const expected = join(scratch, "web"); await exportWeb(expected);
    if (consumerFile(join(expected, "manifest.json")).sha256 !== CONSUMER_REVIEW.webManifestSHA256
        || !same(consumerFiles(root), consumerFiles(expected))) throw new Error("Consumer web runtime differs from reviewed export");
  } finally { rmSync(scratch, { recursive: true }); }
}

/** Checks the reviewed firmware anchor and source contract, never inferring installed-device evidence. */
async function firmware(root) {
  const value = await importResident(root, CONSUMER_REVIEW.firmwareManifestSHA256);
  if (!value.contract || !value.receipt.contractVerified || value.receipt.firmwareBuildID !== CONSUMER_REVIEW.firmwareBuildID
      || value.descriptor.firmwareCommit !== CONSUMER_REVIEW.firmwareCommit) throw new Error("Consumer requires the selected schema-two experimental resident");
  const expected = [...value.receipt.files, { path: "manifest.json", ...consumerFile(join(root, "manifest.json")) }]
    .sort((a, b) => a.path < b.path ? -1 : 1);
  if (!same(consumerFiles(root), expected)) throw new Error("Unlisted firmware export content");
  return value;
}

/** Verifies a complete versioned package against an independently supplied inventory anchor and exact review. */
export async function verifyConsumerPackage(input, expected) {
  const root = resolve(input);
  if (!hex(expected) || consumerFile(join(root, "manifest.json")).sha256 !== expected) throw new Error("Consumer manifest anchor mismatch");
  const manifest = parse(join(root, "manifest.json"));
  const fixed = { schema: 1, package: "firmingo-compiler-consumer", version: CONSUMER_REVIEW.version,
    interfaceVersion: 1, serviceABI: 2, qualification: "experimental-unqualified", service: SERVICE, review: CONSUMER_REVIEW };
  const { files, catalogueSHA256, ...metadata } = manifest;
  if (!same(metadata, fixed) || !hex(catalogueSHA256) || !Array.isArray(files) || files.length !== 33
      || files.some(file => !/^(?:service\/|firmware\/|web\/)/.test(file.path) && !["catalogue.json", "resident-import.json"].includes(file.path)))
    throw new Error("Incompatible consumer manifest");
  const observed = consumerFiles(root, true);
  if (!same(observed, files)) throw new Error("Missing, corrupt, extra or unsafe consumer role");
  await webMatches(join(root, "web"));
  const resident = await firmware(join(root, "firmware"));
  const catalogue = json(resident.catalogue), receipt = json(resident.receipt);
  if (hash(catalogue) !== catalogueSHA256 || !same(consumerFile(join(root, "catalogue.json")), { bytes: catalogue.length, sha256: hash(catalogue) })
      || !same(consumerFile(join(root, "resident-import.json")), { bytes: receipt.length, sha256: hash(receipt) })) throw new Error("Catalogue differs from verified resident facts");
  delivery(join(root, "service"));
  if (!same(consumerFiles(root, true), observed) || consumerFile(join(root, "manifest.json")).sha256 !== expected)
    throw new Error("Consumer package changed during source verification");
  return { schema: 1, status: "verified_experimental_consumer_package", version: manifest.version, manifestSHA256: expected,
    firmwareBuildID: resident.receipt.firmwareBuildID, catalogueSHA256, serviceSHA256: SERVICE.sha256, files: files.length,
    hardwareQualified: false, published: false };
}

/** Stages paired service/source, exact web assets and firmware evidence in a new offline consumer package. */
export async function buildConsumerPackage(deliveryRoot, firmwareRoot, output) {
  deliveryRoot = resolve(deliveryRoot); firmwareRoot = resolve(firmwareRoot); output = resolve(output);
  // Validate before reserving output; never modify either input or an existing destination.
  const resident = await firmware(firmwareRoot); delivery(deliveryRoot);
  mkdirSync(output);
  try {
    for (const [name, source] of [["service", deliveryRoot], ["firmware", firmwareRoot]]) {
      mkdirSync(join(output, name));
      for (const file of consumerFiles(source).filter(file => file.path !== "operation.json")) {
        const destination = join(output, name, file.path); mkdirSync(dirname(destination), { recursive: true });
        const copied = consumerFile(join(source, file.path), destination);
        if (!same(copied, { bytes: file.bytes, sha256: file.sha256 })) throw new Error("Consumer copy differs from observed input");
      }
    }
    await exportWeb(join(output, "web"));
    writeFileSync(join(output, "catalogue.json"), json(resident.catalogue), { flag: "wx" });
    writeFileSync(join(output, "resident-import.json"), json(resident.receipt), { flag: "wx" });
    const files = consumerFiles(output);
    const manifest = { schema: 1, package: "firmingo-compiler-consumer", version: CONSUMER_REVIEW.version,
      interfaceVersion: 1, serviceABI: 2, qualification: "experimental-unqualified", service: SERVICE, review: CONSUMER_REVIEW,
      files, catalogueSHA256: hash(json(resident.catalogue)) };
    const data = json(manifest); writeFileSync(join(output, "manifest.json"), data, { flag: "wx" });
    const result = await verifyConsumerPackage(output, hash(data));
    writeFileSync(join(output, "operation.json"), json(result), { flag: "wx" });
    return result;
  } catch (error) { rmSync(output, { recursive: true }); throw error; }
}

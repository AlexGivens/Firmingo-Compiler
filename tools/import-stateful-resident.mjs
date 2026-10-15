import { readFileSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";
import { parseContractJSON } from "../src/json.js";
import { canonicalJSON } from "../src/hash.js";
import { validateFirmwareBuildDescriptor, firmwareBuildIdentity } from "../src/contract.js";
import { NANO_STATEFUL } from "../src/limits.js";

const review = JSON.parse(readFileSync(new URL("../recipes/nano_rp2040_connect_v2/firmware-export.json", import.meta.url)));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const parse = bytes => parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(bytes));

/** Initial schema-three import is deliberately pinned to the reviewed export, including every resource. */
export async function importStatefulResident(directory, anchor, manifest) {
  const { exportManifestSHA256, review: _review, ...expected } = review;
  if (anchor !== exportManifestSHA256 || canonicalJSON(manifest) !== canonicalJSON(expected)) throw new Error("FMS2 export requires explicit compiler recipe review");
  const files = {};
  for (const record of manifest.files) {
    const path = join(directory, record.path);
    let parent = directory;
    for (const component of record.path.split("/")) {
      parent = join(parent, component);
      if (lstatSync(parent).isSymbolicLink()) throw new Error("Symlinked FMS2 export resource");
    }
    const bytes = readBounded(path, record.bytes);
    if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw new Error("FMS2 export resource integrity mismatch");
    files[record.path] = bytes;
  }
  const facts = parse(files["resident-facts.json"]), contract = parse(files["contract.json"]);
  if (facts.residentELFSHA256 !== hash(files["resident.elf"]) || facts.residentUF2SHA256 !== hash(files["resident.uf2"])
      || facts.buildReportSHA256 !== hash(files["build-report.json"]) || facts.compilerContractSHA256 !== hash(files["contract.json"])
      || facts.compilerContractSHA256 !== NANO_STATEFUL.compilerContractSHA256 || facts.residentABI !== 2
      || !facts.runtimeEnabled || !facts.fms2NetworkUploadsEnabled || facts.hardwareTested !== false) throw new Error("Inconsistent FMS2 resident facts");
  const elf = files["resident.elf"], ev = new DataView(elf.buffer, elf.byteOffset, elf.byteLength);
  const ew = offset => ev.getUint32(offset, true), eh = offset => ev.getUint16(offset, true);
  if (Buffer.from(elf.subarray(0, 8)).toString("hex") !== "7f454c4601010100" || eh(16) !== 2 || eh(18) !== 40
      || eh(42) !== 32 || eh(44) > 128 || ew(28) + eh(44) * 32 > elf.length) throw new Error("Invalid resident ELF program headers");
  const flash = new Map();
  for (let i = 0; i < eh(44); i++) {
    const p = ew(28) + i * 32;
    if (ew(p) !== 1 || !ew(p + 16)) continue;
    const offset = ew(p + 4), address = ew(p + 12), count = ew(p + 16);
    if (offset > elf.length || count > elf.length - offset || address < 0x10000000 || address + count > 0x10200000) throw new Error("Resident initialized LOAD outside flash");
    for (let j = 0; j < count; j++) { if (flash.has(address + j)) throw new Error("Overlapping resident LOAD"); flash.set(address + j, elf[offset + j]); }
  }
  const uf2 = files["resident.uf2"], uv = new DataView(uf2.buffer, uf2.byteOffset, uf2.byteLength), uw = offset => uv.getUint32(offset, true), seen = new Set();
  if (!uf2.length || uf2.length % 512) throw new Error("Invalid resident UF2 size");
  let compared = 0;
  const memory = new Map();
  for (let o = 0; o < uf2.length; o += 512) {
    const a = uw(o + 12);
    if (uw(o) !== 0x0a324655 || uw(o + 4) !== 0x9e5d5157 || uw(o + 508) !== 0x0ab16f30 || uw(o + 8) !== 0x2000
        || uw(o + 16) !== 256 || uw(o + 28) !== 0xe48bff56 || uw(o + 20) !== o / 512 || uw(o + 24) !== uf2.length / 512
        || a % 256 || a < 0x10000000 || a + 256 > 0x10200000 || seen.has(a)) throw new Error("Invalid resident-only UF2 block");
    seen.add(a);
    for (let j = 0; j < 256; j++) {
      const byte = uf2[o + 32 + j]; memory.set(a + j, byte);
      if (flash.has(a + j)) { if (flash.get(a + j) !== byte) throw new Error("Resident ELF/UF2 disagreement"); compared++; }
    }
  }
  if (compared !== flash.size || compared !== facts.elfUF2ComparedBytes) throw new Error("Missing resident flash bytes");
  const table = (address, count) => {
    const result = new Uint8Array(count);
    for (let i = 0; i < count; i++) { if (!memory.has(address + i) || !flash.has(address + i)) throw new Error("Missing resident table byte"); result[i] = memory.get(address + i); }
    // Arduino-Pico combines flash sections in an RWE LOAD. Check readonly section
    // attributes and virtual/file mapping independently rather than treating LOAD flags as section permissions.
    let readonly = false;
    if (eh(46) !== 40 || eh(48) > 512 || ew(32) + eh(48) * 40 > elf.length) throw new Error("Invalid resident sections");
    for (let i = 1; i < eh(48); i++) {
      const p = ew(32) + i * 40, base = ew(p + 12), offset = ew(p + 16), size = ew(p + 20);
      if (ew(p + 4) !== 1 || ew(p + 8) & 1 || !(ew(p + 8) & 2) || address < base || address + count > base + size) continue;
      if (offset + size > elf.length) throw new Error("Truncated resident section");
      readonly = result.every((byte, j) => byte === elf[offset + address - base + j]);
    }
    if (!readonly) throw new Error("Resident table is not readonly mapped flash");
    return result;
  };
  const api = table(facts.apiAddress, 52), av = new DataView(api.buffer);
  if (hash(api) !== facts.apiTableSHA256 || av.getUint32(0, true) !== 0x49504146 || av.getUint16(4, true) !== 2 || av.getUint16(6, true) !== 52
      || av.getUint32(40, true) !== facts.stateAddress || av.getUint32(44, true) !== facts.stateCapacityBytes || av.getUint32(48, true) !== 4096) throw new Error("FMS2 API/state table mismatch");
  for (let i = 8; i < 40; i += 4) { const pointer = av.getUint32(i, true); if (!(pointer & 1)
    || !(pointer >= 0x10000001 && pointer < 0x10200000 || pointer >= 0x20000001 && pointer < 0x20042000)) throw new Error("Invalid resident call pointer"); }
  const upload = table(facts.uploadTarget.tableAddress, 56), u = new DataView(upload.buffer);
  if (hash(upload) !== facts.uploadTarget.tableSHA256 || u.getUint32(0, true) !== 0x32505546 || u.getUint16(4, true) !== 1 || u.getUint16(6, true) !== 56
      || [2, 4096, 1024, 30000].some((n, i) => u.getUint32(8 + 4 * i, true) !== n)
      || Buffer.from(upload.subarray(24, 40)).toString("hex") !== Buffer.from("nano-managed-v2\0").toString("hex")
      || Buffer.from(upload.subarray(40)).toString("hex") !== Buffer.from("physical-d2-gnd\0").toString("hex")) throw new Error("FMS2 upload table mismatch");
  let arena = false;
  for (let i = 1; i < eh(48); i++) {
    const p = ew(32) + i * 40;
    if (ew(p + 4) === 8 && ew(p + 8) === 3 && facts.stateAddress >= ew(p + 12)
        && facts.stateAddress + facts.stateCapacityBytes <= ew(p + 12) + ew(p + 20)
        && facts.stateAddress + facts.stateCapacityBytes <= facts.linkerBounds.__end__) arena = true;
  }
  if (!arena) throw new Error("Resident state is not within owned BSS below heap");
  const descriptor = validateFirmwareBuildDescriptor({ schema: 2, board: facts.board, profile: facts.profile, backend: "application",
    firmwareVersion: facts.firmwareVersion, firmwareCommit: facts.firmwareCommit, residentELFSHA256: facts.residentELFSHA256,
    firmwareImageSHA256: facts.residentUF2SHA256, buildReportSHA256: facts.buildReportSHA256, apiAddress: facts.apiAddress,
    residentABI: 2, targetID: 2, maximumCapsuleBytes: 4096, recipeIdentifier: NANO_STATEFUL.recipeIdentifier,
    recipeSHA256: NANO_STATEFUL.recipeSHA256, qualification: "experimental", stateAddress: facts.stateAddress,
    stateCapacityBytes: facts.stateCapacityBytes, compilerContractSHA256: facts.compilerContractSHA256 });
  return { descriptor, catalogue: { schema: 1, firmwareBuilds: [descriptor] }, contract,
    receipt: { schema: 1, operation: "experimental_stateful_resident_metadata_import", exportSchema: 3,
      exportManifestSHA256: anchor, firmwareBuildID: await firmwareBuildIdentity(descriptor), files: manifest.files,
      contractVerified: true, elfUF2ComparedBytes: compared, apiTableSHA256: facts.apiTableSHA256,
      uploadTableSHA256: facts.uploadTarget.tableSHA256, imagesCopied: false, defaultCatalogueChanged: false,
      qualification: "experimental; no WASM-to-resident hardware qualification" } };
}

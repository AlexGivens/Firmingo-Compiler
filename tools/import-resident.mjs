import { lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";
import { parseContractJSON } from "../src/json.js";
import { validateFirmwareBuildDescriptor, firmwareBuildIdentity } from "../src/contract.js";
import { CONTRACT_ROLES, verifyResidentContract } from "./resident-contract.mjs";
import { NANO_BASELINE } from "../src/limits.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const decode = bytes => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
const roles = { "resident.elf": 8 * 1024 * 1024, "resident.uf2": 4 * 1024 * 1024,
  "build-report.json": 256 * 1024, "resident-facts.json": 256 * 1024 };
const fields = (value, names) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...names].sort().join()) throw new Error("Invalid resident export fields");
};
const hex = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

/** Independently checks the declared FAPI bytes against the actual resident-only RP2040 UF2 blocks. */
function apiFromUF2(bytes, facts) {
  if (!bytes.length || bytes.length % 512 || !Number.isInteger(facts.apiAddress)) throw new Error("Invalid resident UF2 size/API");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), blocks = new Map();
  const word = offset => view.getUint32(offset, true);
  for (let offset = 0; offset < bytes.length; offset += 512) {
    const address = word(offset + 12);
    if (word(offset) !== 0x0a324655 || word(offset + 4) !== 0x9e5d5157 || word(offset + 508) !== 0x0ab16f30
        || word(offset + 8) !== 0x2000 || word(offset + 16) !== 256 || word(offset + 28) !== 0xe48bff56
        || word(offset + 20) !== offset / 512 || word(offset + 24) !== bytes.length / 512
        || address % 256 || address < 0x10000000 || address > 0x10200000 - 256 || blocks.has(address)) throw new Error("Invalid resident-only UF2 block");
    blocks.set(address, bytes.subarray(offset + 32, offset + 288));
  }
  const table = new Uint8Array(40);
  for (let i = 0; i < table.length; i++) {
    const address = facts.apiAddress + i, block = blocks.get(Math.floor(address / 256) * 256);
    if (!block) throw new Error("Resident API table is absent from UF2");
    table[i] = block[address % 256];
  }
  const api = new DataView(table.buffer);
  const pointers = Array.from({ length: 8 }, (_, i) => api.getUint32(8 + i * 4, true));
  if (api.getUint32(0, true) !== 0x49504146 || api.getUint16(4, true) !== 1 || api.getUint16(6, true) !== 40
      || facts.apiTable.apiAddress !== facts.apiAddress || facts.apiTable.residentABI !== 1 || facts.apiTable.apiTableBytes !== 40
      || hash(table) !== facts.apiTable.apiTableSHA256 || JSON.stringify(pointers) !== JSON.stringify(facts.apiTable.functionAddresses)
      || pointers.some(pointer => pointer % 2 !== 1 || !(pointer - 1 >= 0x10000000 && pointer - 1 < 0x10200000
        || pointer - 1 >= 0x20000000 && pointer - 1 < 0x20042000))) throw new Error("Resident API declaration differs from UF2 table bytes");
}

/** Explicit trusted-anchor metadata import; no images copied, device association invented or default catalogue changed. */
export async function importResident(directoryInput, expectedManifestSHA256) {
  if (!hex(expectedManifestSHA256)) throw new Error("Select an independently trusted resident-export manifest SHA-256");
  const directory = resolve(directoryInput);
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error("Select a real resident export directory");
  const read = (name, maximum) => {
    const path = join(directory, name);
    if (lstatSync(path).isSymbolicLink()) throw new Error("Symlinked resident export input");
    return readBounded(path, maximum);
  };
  const manifestBytes = read("manifest.json", 16384);
  if (hash(manifestBytes) !== expectedManifestSHA256) throw new Error("Resident export manifest anchor mismatch");
  const manifest = parseContractJSON(decode(manifestBytes));
  fields(manifest, ["schema", "purpose", "board", "profile", "firmwareCommit", "files", "qualification"]);
  if (![1, 2].includes(manifest.schema) || manifest.purpose !== "experimental_resident_compiler_export" || manifest.board !== NANO_BASELINE.board
      || manifest.profile !== NANO_BASELINE.profile || !/^[0-9a-f]{40}$/.test(manifest.firmwareCommit)
      || manifest.qualification !== "experimental structural/source/artifact checks; no installation or hardware qualification"
      || !Array.isArray(manifest.files) || manifest.files.length !== (manifest.schema === 1 ? 4 : 11)) throw new Error("Unsupported resident export");
  const acceptedRoles = manifest.schema === 1 ? roles : { ...roles, "contract.json": 16384, ...CONTRACT_ROLES };
  const files = {};
  for (const record of manifest.files) {
    fields(record, ["path", "bytes", "sha256"]);
    if (!Object.hasOwn(acceptedRoles, record.path) || Object.hasOwn(files, record.path) || !Number.isSafeInteger(record.bytes)
        || record.bytes < 1 || record.bytes > acceptedRoles[record.path] || !hex(record.sha256)) throw new Error("Invalid resident export inventory");
    const bytes = read(record.path, record.bytes);
    if (bytes.length !== record.bytes || hash(bytes) !== record.sha256) throw new Error("Resident export artifact integrity mismatch");
    files[record.path] = bytes;
  }
  const facts = parseContractJSON(decode(files["resident-facts.json"]));
  fields(facts, ["schema", "board", "profile", "backend", "firmwareVersion", "firmwareCommit", "residentELFSHA256", "firmwareImageSHA256",
    "buildReportSHA256", "apiAddress", "residentABI", "targetID", "maximumCapsuleBytes", "qualification", "apiTable", "comparedFlashBytes",
    "sourceSHA256", "ignoredHistoricalMetadata", "hardwareQualification", "provenanceLimit", "exportToolSHA256", "exportValidatorSHA256"]);
  fields(facts.apiTable, ["apiAddress", "residentABI", "apiTableBytes", "apiTableSHA256", "functionAddresses", "loadFlags"]);
  if (facts.firmwareCommit !== manifest.firmwareCommit || facts.residentELFSHA256 !== hash(files["resident.elf"])
      || facts.firmwareImageSHA256 !== hash(files["resident.uf2"]) || facts.buildReportSHA256 !== hash(files["build-report.json"])
      || facts.hardwareQualification !== "not established by export" || !hex(facts.exportToolSHA256) || !hex(facts.exportValidatorSHA256)
      || !Number.isSafeInteger(facts.comparedFlashBytes) || facts.comparedFlashBytes <= 0 || facts.comparedFlashBytes > 2 * 1024 * 1024
      || ![4, 5, 6, 7].includes(facts.apiTable.loadFlags)) throw new Error("Resident facts/artifacts differ");
  const report = parseContractJSON(decode(files["build-report.json"]));
  if (report.status !== "compile-tested experimental resident; not flashed" || report.board !== NANO_BASELINE.board
      || report.core !== "rp2040:rp2040@6.0.0" || report.elf_sha256 !== facts.residentELFSHA256 || report.uf2_sha256 !== facts.firmwareImageSHA256) throw new Error("Resident build report mismatch");
  const sources = { ...report.source_sha256 }; delete sources["src/.DS_Store"];
  const ignored = Object.hasOwn(report.source_sha256 || {}, "src/.DS_Store")
    ? { "src/.DS_Store": report.source_sha256["src/.DS_Store"] } : {};
  if (JSON.stringify(facts.ignoredHistoricalMetadata) !== JSON.stringify(ignored)
      || Object.values(ignored).some(value => !hex(value))
      || facts.provenanceLimit !== "reported project sources match commit; installed core/toolchain inputs are declared, not fully reproduced or inventoried") throw new Error("Resident provenance declarations differ");
  if (!report.source_sha256 || typeof report.source_sha256 !== "object" || Array.isArray(report.source_sha256)
      || !facts.sourceSHA256 || typeof facts.sourceSHA256 !== "object" || Array.isArray(facts.sourceSHA256)
      || Object.keys(sources).length < 5 || Object.keys(sources).length > 256
      || Object.entries(sources).some(([path, digest]) => !hex(digest) || !/^[A-Za-z0-9_./-]+$/.test(path)
        || path.split("/").some(part => !part || part === "." || part === ".."))
      || ["boards/nano_rp2040_connect/baseline.json", "experiments/managed_sketch/abi.h", "src/core/version.h",
        "experiments/managed_sketch/firmingo_managed_resident/firmingo_managed_resident.ino", "experiments/managed_sketch/build_resident.py"].some(path => !Object.hasOwn(sources, path))) throw new Error("Invalid resident source inventory");
  if (JSON.stringify(Object.entries(sources).sort()) !== JSON.stringify(Object.entries(facts.sourceSHA256).sort())) throw new Error("Resident source inventory mismatch");
  apiFromUF2(files["resident.uf2"], facts);
  const contract = manifest.schema === 2 ? verifyResidentContract(files, facts) : null;
  // Firmware owns observed facts; the compiler explicitly attaches only its pinned compatible recipe.
  const descriptor = validateFirmwareBuildDescriptor(Object.fromEntries(["schema", "board", "profile", "backend", "firmwareVersion", "firmwareCommit",
    "residentELFSHA256", "firmwareImageSHA256", "buildReportSHA256", "apiAddress", "residentABI", "targetID", "maximumCapsuleBytes", "qualification"]
    .map(key => [key, facts[key]]).concat([["recipeIdentifier", NANO_BASELINE.recipeIdentifier], ["recipeSHA256", NANO_BASELINE.recipeSHA256]])));
  return { descriptor, contract, catalogue: { schema: 1, firmwareBuilds: [descriptor] }, receipt: { schema: 1, operation: "experimental_resident_metadata_import",
    exportManifestSHA256: expectedManifestSHA256, firmwareBuildID: await firmwareBuildIdentity(descriptor), files: manifest.files,
    recipeIdentifier: descriptor.recipeIdentifier, recipeSHA256: descriptor.recipeSHA256, qualification: "experimental; no Clang-to-resident hardware qualification",
    apiTableSHA256: facts.apiTable.apiTableSHA256, sourceProof: "firmware export binds reported project sources to exact commit; upstream core/toolchain full reproduction remains open",
    exportSchema: manifest.schema, contractVerified: Boolean(contract), ...(contract ? { contract } : {}),
    imagesCopied: false, defaultCatalogueChanged: false } };
}

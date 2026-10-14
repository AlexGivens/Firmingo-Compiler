import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseContractJSON } from "../src/json.js";
import { canonicalJSON } from "../src/hash.js";
import { NANO_BASELINE } from "../src/limits.js";

const mappingBytes = readFileSync(new URL("../recipes/nano_rp2040_connect/firmware-contract.json", import.meta.url));
export const CONTRACT_MAPPING = parseContractJSON(mappingBytes.toString("utf8"));
export const CONTRACT_ROLES = Object.freeze(Object.fromEntries(CONTRACT_MAPPING.resources.map(record => [record.path, 65536])));
export const CONTRACT_COMPATIBILITY = "exact resident API address required; changed resource bytes require explicit compiler recipe review";
export const CONTRACT_SCOPE = "resident headers are build inputs; facade/entry/linker are native proof references, not a WASM recipe";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fields = (value, names) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...names].sort().join()) throw new Error("Invalid firmware contract fields");
};

/** Verifies exact source bytes and the reviewed recipe adaptation; schema-one exports have no such proof. */
export function verifyResidentContract(files, facts) {
  const contract = parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(files["contract.json"]));
  fields(contract, ["schema", "identifier", "firmwareCommit", "board", "profile", "residentABI", "apiTableBytes", "qualification", "image", "compatibility", "resourceScope", "resources"]);
  if (contract.schema !== 1 || contract.identifier !== CONTRACT_MAPPING.contractIdentifier || contract.firmwareCommit !== facts.firmwareCommit
      || contract.board !== NANO_BASELINE.board || contract.profile !== NANO_BASELINE.profile || contract.residentABI !== 1 || contract.apiTableBytes !== 40
      || contract.qualification !== "experimental source contract; no hardware qualification" || contract.compatibility !== CONTRACT_COMPATIBILITY
      || contract.resourceScope !== CONTRACT_SCOPE || canonicalJSON(contract.image) !== canonicalJSON(CONTRACT_MAPPING.image)
      || CONTRACT_MAPPING.recipeIdentifier !== NANO_BASELINE.recipeIdentifier || CONTRACT_MAPPING.recipeSHA256 !== NANO_BASELINE.recipeSHA256
      || !Array.isArray(contract.resources) || contract.resources.length !== CONTRACT_MAPPING.resources.length)
    throw new Error("Unsupported firmware contract or recipe adaptation");
  const seen = new Set();
  for (const record of contract.resources) {
    fields(record, ["path", "sourcePath", "role", "bytes", "sha256"]);
    const expected = CONTRACT_MAPPING.resources.find(item => item.path === record.path);
    if (!expected || seen.has(record.path) || canonicalJSON(record) !== canonicalJSON(expected)) throw new Error("Firmware contract requires recipe compatibility review");
    seen.add(record.path);
    const bytes = files[record.path];
    if (!bytes || bytes.length !== record.bytes || hash(bytes) !== record.sha256
        || record.role === "resident-build-input" && facts.sourceSHA256[record.sourcePath] !== record.sha256)
      throw new Error("Firmware contract resource/build integrity mismatch");
  }
  return { schema: 1, identifier: contract.identifier, contractSHA256: hash(files["contract.json"]),
    mappingSHA256: hash(mappingBytes),
    resources: contract.resources, compatibility: contract.compatibility, qualification: CONTRACT_MAPPING.qualification };
}

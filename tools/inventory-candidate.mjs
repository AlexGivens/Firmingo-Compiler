import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { readBounded } from "./bounded-file.mjs";
import { inspectService } from "./inspect-service.mjs";
import { importResident } from "./import-resident.mjs";
import { exportWeb } from "./export-web.mjs";
import { verifyServiceMaterials } from "./verify-service-materials.mjs";
import { verifyOwnedServiceSources } from "./service-source-materials.mjs";
import { parseContractJSON } from "../src/json.js";
import { SERVICE } from "../runtime/pins.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const decode = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const hex = value => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const identity = bytes => ({ bytes: bytes.length, sha256: hash(bytes) });

/** Inventories an explicitly anchored build and schema-two firmware contract; never copies or executes the candidate. */
export async function inventoryCandidate(buildDirectory, trustedBuildReceiptSHA256, firmwareDirectory, trustedFirmwareManifestSHA256, output) {
  output = resolve(output);
  if (existsSync(output)) throw new Error("Select a new candidate inventory directory");
  if (!hex(trustedBuildReceiptSHA256)) throw new Error("Select an independently reviewed build-receipt SHA-256");
  const receiptBytes = readBounded(join(resolve(buildDirectory), "operation.json"), 16384);
  if (hash(receiptBytes) !== trustedBuildReceiptSHA256) throw new Error("Candidate build receipt anchor mismatch");
  const receipt = parseContractJSON(decode(receiptBytes));
  const recipe = parseContractJSON(readFileSync(new URL("../service/recipe.json", import.meta.url), "utf8"));
  if (Object.keys(receipt).sort().join() !== ["schema", "status", "inputManifestSHA256", "recipeIdentifier", "module", "linkedArchiveCount", "distributionStatus", "upstreamRuntimeSourceReproduction"].sort().join()
      || receipt.schema !== 1 || receipt.status !== "built_owned_development_service" || receipt.recipeIdentifier !== recipe.identifier
      || receipt.distributionStatus !== "unresolved" || !hex(receipt.inputManifestSHA256) || receipt.linkedArchiveCount !== 96
      || receipt.upstreamRuntimeSourceReproduction !== "not established by installed-component capture"
      || !receipt.module || Object.keys(receipt.module).sort().join() !== "bytes,path,sha256" || receipt.module.path !== "compiler.wasm"
      || !hex(receipt.module.sha256) || !Number.isSafeInteger(receipt.module.bytes) || receipt.module.bytes < 1 || receipt.module.bytes > 128 * 1024 * 1024)
    throw new Error("Select a successful supported owned build receipt; inventory cannot grant distribution approval");
  const inputManifest = readBounded(join(resolve(buildDirectory), "input-manifest.json"), 128 * 1024 * 1024);
  if (hash(inputManifest) !== receipt.inputManifestSHA256) throw new Error("Candidate input manifest differs from build receipt");
  const bytes = readBounded(join(resolve(buildDirectory), "compiler.wasm"), receipt.module.bytes);
  if (bytes.length !== receipt.module.bytes || hash(bytes) !== receipt.module.sha256) throw new Error("Candidate module differs from build receipt");
  const inspection = inspectService(bytes); // Compiles metadata for static validation; no instance or service call.
  const firmware = await importResident(firmwareDirectory, trustedFirmwareManifestSHA256);
  if (!firmware.contract || !firmware.receipt.contractVerified) throw new Error("Candidate inventory requires schema-two reviewed firmware contract resources");
  verifyServiceMaterials({ quiet: true });
  const scratch = mkdtempSync(join(tmpdir(), "firmingo-candidate-source-inventory-"));
  let sourceManifest, sourceManifestIdentity;
  try {
    const directory = join(scratch, "sources"); await exportWeb(directory);
    const manifestBytes = readBounded(join(directory, "manifest.json"), 65536);
    sourceManifest = parseContractJSON(decode(manifestBytes)); sourceManifestIdentity = identity(manifestBytes);
    if (sourceManifest.service.sha256 !== SERVICE.sha256 || sourceManifest.service.bytes !== SERVICE.bytes) throw new Error("Source export changed public service pins");
  } finally { rmSync(scratch, { recursive: true }); }
  const components = parseContractJSON(readFileSync(new URL("../service/component-sources.json", import.meta.url), "utf8"));
  const notices = parseContractJSON(readFileSync(new URL("../third_party/service-runtime-notices/wasi-libc32/manifest.json", import.meta.url), "utf8"));
  const shim = parseContractJSON(readFileSync(new URL("../third_party/browser_wasi_shim/receipt.json", import.meta.url), "utf8"));
  const owned = verifyOwnedServiceSources();
  const record = { schema: 1, operation: "owned_candidate_package_inventory", status: "development inventory; no distributable compiler package",
    distributionStatus: "unresolved", binaryIncluded: false, serviceInstantiated: false, hardwareExecuted: false,
    build: { receipt: identity(receiptBytes), inputManifest: identity(inputManifest), linkedArchiveCount: receipt.linkedArchiveCount,
      provenanceLimit: receipt.upstreamRuntimeSourceReproduction },
    candidateService: { path: "compiler.wasm", ...identity(bytes), declaredServiceABI: inspection.declaredServiceABI,
      memory: inspection.memory, imports: inspection.imports, exports: inspection.exports, payloadIncluded: false },
    currentSourcePackage: { manifest: sourceManifestIdentity, sourceRecords: sourceManifest.sourceRecords.length, files: sourceManifest.files,
      acceptedService: sourceManifest.service, candidateMatchesPublicPin: sourceManifest.service.sha256 === inspection.sha256, payloadIncluded: false },
    firmware: { descriptor: firmware.descriptor, buildID: firmware.receipt.firmwareBuildID, exportManifestSHA256: trustedFirmwareManifestSHA256,
      contract: firmware.contract, imageRoles: firmware.receipt.files.filter(item => ["resident.elf", "resident.uf2"].includes(item.path)), payloadIncluded: false },
    components: { sourceReferences: components.components, runtimeNotices: notices.files, runtimeNoticeExcerpts: notices.sourceExcerpts,
      shim: { package: shim.package, version: shim.version, license: shim.license, notices: shim.files.filter(item => item.path.startsWith("LICENSE-")) },
      customSourceGrant: { manifest: owned.manifestIdentity, author: owned.manifest.author, contributionLicense: owned.manifest.contributionLicense,
        sourceInputs: owned.manifest.files.length, scope: "author grant for pinned original source/patch contributions; upstream terms retained" },
      projectLicense: { path: "LICENSE", ...identity(readFileSync(new URL("../LICENSE", import.meta.url))), designation: "GPL-3.0-only project and original custom-source contributions; upstream terms retained" } },
    promotionRequirements: ["Complete exact upstream component/notice review and corresponding-source packaging for the selected binary",
      "Review exact candidate identities and deliberately promote consumer pins/package version",
      "Qualify the public SDK/private web host and a fresh packaged consumer offline",
      "Complete selected board/platform deployment qualification before hardware support claims"],
    imagesCopied: false, defaultCatalogueChanged: false, consumerPinsChanged: false };
  const serialized = JSON.stringify(record, null, 2) + "\n";
  if (Buffer.byteLength(serialized) > 131072) throw new Error("Candidate inventory exceeds byte bounds");
  mkdirSync(output);
  writeFileSync(join(output, "candidate-inventory.json"), serialized, { flag: "wx" });
  const summary = { schema: 1, status: "inventoried_unpromoted_candidate", inventorySHA256: hash(Buffer.from(serialized)),
    serviceSHA256: inspection.sha256, firmwareBuildID: firmware.receipt.firmwareBuildID, binaryIncluded: false, consumerPinsChanged: false, distributionStatus: "unresolved" };
  writeFileSync(join(output, "operation.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  return summary;
}

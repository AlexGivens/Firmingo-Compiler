import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { portableSHA256 } from "../runtime/portable-sha256.js";
import { parseBuildRequest, validateResidentBinding, packageELF } from "../src/index.js";
import { readFileSync } from "node:fs";

test("portable SHA matches independent SHA-256 at padding/block boundaries without Web Crypto", () => {
  for (const size of [0,1,55,56,63,64,65,127,128,129,4096,262144]) {
    const bytes = Uint8Array.from({ length: size }, (_, index) => index % 251);
    assert.equal(Buffer.from(portableSHA256(bytes)).toString("hex"), createHash("sha256").update(bytes).digest("hex"));
  }
});

test("legacy static binding packages the same bytes with a distinct identity and no invented build facts", async () => {
  const full = parseBuildRequest(readFileSync(new URL("./fixtures/synthetic-packaging-request.json", import.meta.url), "utf8"));
  const { schema, board, profile, residentELFSHA256, firmwareImageSHA256, apiAddress, residentABI, targetID, maximumCapsuleBytes } = full.target.firmwareBuild;
  const binding = { schema, board, profile, residentELFSHA256, firmwareImageSHA256, apiAddress, residentABI, targetID, maximumCapsuleBytes };
  validateResidentBinding(binding);
  for (const change of [{ deviceID: "0102030405060708" }, { apiAddress: apiAddress + 1 }, { firmwareVersion: "unknown" }]) assert.throws(() => validateResidentBinding({ ...binding, ...change }));
  const { firmwareBuild, ...target } = full.target;
  const request = { ...full, target: { ...target, residentBinding: binding } };
  const provenance = JSON.parse(readFileSync(new URL("./fixtures/declared-packaging-provenance.json", import.meta.url)));
  const elf = Uint8Array.from(readFileSync(new URL("./fixtures/stateless.elf.hex", import.meta.url), "utf8").trim().split(/\s+/), byte => parseInt(byte,16));
  const first = await packageELF(elf, full, provenance), second = await packageELF(elf, request, provenance);
  assert.deepEqual(first.bytes, second.bytes); assert.equal(second.receipt.firmwareBuildID, undefined); assert.match(second.receipt.residentBindingID, /^[0-9a-f]{64}$/);
  assert.equal(second.firmwareBuild, undefined); assert.equal(second.residentBinding.firmwareVersion, undefined);
});

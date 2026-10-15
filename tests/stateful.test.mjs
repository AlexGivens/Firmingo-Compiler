import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseELF, packageELF, validateCapsule, validateBuildRequest, validateFirmwareBuildDescriptor, NANO_STATEFUL } from "../src/index.js";
import { dataIdentity } from "../src/hash.js";
import { localResources, createNodeCompiler } from "../tools/node-runtime.mjs";
import { verifyBuildResult } from "../runtime/build.js";

const json = name => JSON.parse(readFileSync(new URL(`./fixtures/stateful-wasm/${name}`, import.meta.url)));
const hex = name => Uint8Array.from(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8").trim().split(/\s+/), value => parseInt(value, 16));
const elf = () => hex("stateful-wasm/counter.elf.hex"), capsule = () => hex("stateful-wasm/counter.fms.hex");
const request = json("request.json"), descriptor = json("descriptor.json"), receipt = json("receipt.json");
const word = (bytes, offset, value) => new DataView(bytes.buffer).setUint32(offset, value, true);

test("explicit schema-two descriptors bind state and recipe while rejecting ABI-one mixtures", async () => {
  assert.deepEqual(validateBuildRequest(request), request);
  assert.equal(await dataIdentity(validateFirmwareBuildDescriptor(descriptor)), receipt.firmwareBuildID);
  for (const change of [{ schema: 1 }, { residentABI: 1 }, { targetID: 1 }, { stateAddress: 0xffffffff }, { stateCapacityBytes: 4097 },
    { stateCapacityBytes: 0 }, { compilerContractSHA256: "0".repeat(64) }, { recipeIdentifier: "nano-stateless-clang-22.1.8-v1-experimental" }])
    assert.throws(() => validateFirmwareBuildDescriptor({ ...descriptor, ...change }));
  const noState = { ...descriptor }; delete noState.stateAddress;
  assert.throws(() => validateFirmwareBuildDescriptor(noState));
  assert.throws(() => validateBuildRequest({ ...request, target: { ...request.target, profile: "nano-managed-v1" } }));
});

test("real linked data/BSS packages to the independently firmware-validated FMS2 vector", async () => {
  const result = parseELF(elf(), { state: descriptor });
  assert.equal(result.codeBytes, 120); assert.equal(result.dataBytes, 4); assert.equal(result.bssBytes, 4);
  assert.deepEqual([...result.data], [7, 0, 0, 0]);
  assert.throws(() => parseELF(elf()));
  assert.throws(() => parseELF(elf(), { state: { ...descriptor, stateAddress: descriptor.stateAddress + 4 } }));
  const packaged = await packageELF(elf(), request, receipt.provenance);
  assert.deepEqual(packaged.bytes, capsule());
  assert.equal(packaged.sha256, "e349a77d85958db1c4eba4f5c10f27e23dc9dd2ce03eb675c108d07bbfd93abb");
  assert.equal((await validateCapsule(capsule(), descriptor)).bssBytes, 4);
});

test("firmware synthetic FMS2 fixture validates without executing or claiming real resident addresses", async () => {
  const synthetic = { ...descriptor, apiAddress: 0x10000100, stateAddress: 0x20030000, stateCapacityBytes: 32 };
  const bytes = hex("stateful-contract/vectors/stateful-image/initialized.hex");
  assert.equal((await validateCapsule(bytes, synthetic)).capsuleSHA256, "1c955e832d351a9b91a3bd5e5e4463a2f6732e4e87cd1de0d783c769f01ae867");
});

test("FMS2 rejects truncation, trailers, overflow, state mismatch, flags, padding and either digest mutation", async () => {
  for (const offset of [0, 4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 96, 128, 255, 256, 379]) {
    const bytes = capsule(); bytes[offset] ^= 1;
    await assert.rejects(validateCapsule(bytes, descriptor), { code: "invalid_capsule" });
  }
  for (const offset of [20, 32, 36, 40, 44, 48, 52]) {
    const bytes = capsule(); word(bytes, offset, 0xfffffffc);
    await assert.rejects(validateCapsule(bytes, descriptor), { code: "invalid_capsule" });
  }
  await assert.rejects(validateCapsule(capsule().slice(0, -1), descriptor));
  await assert.rejects(validateCapsule(new Uint8Array([...capsule(), 0]), descriptor));
});

test("stateful ELF rejects writable/excess sections and divergent LOAD mappings", () => {
  const original = elf(), v = new DataView(original.buffer), ph = v.getUint32(28, true), sh = v.getUint32(32, true);
  for (const [offset, value] of [[ph + 12, 0x10200104], [ph + 32 + 12, 0x10200500], [ph + 32 + 20, 4096],
    [sh + 40 + 8, 7], [ph + 24, 7], [sh + 40 + 20, 4096]]) {
    const bytes = original.slice(); word(bytes, offset, value);
    assert.throws(() => parseELF(bytes, { state: descriptor }), { code: "invalid_elf" });
  }
});

const path = process.env.FIRMINGO_COMPILER_SERVICE;
test("actual WASM stateful builds reproduce, reject unsupported initialization, and recover", { skip: path ? false : "Supply pinned local service for actual FMS2 compilation" }, async () => {
  const resources = localResources(new Uint8Array(readFileSync(path)), NANO_STATEFUL.profile), controller = createNodeCompiler();
  const build = source => controller.build({ ...request, source: { ...request.source, text: source } }, resources);
  const first = await controller.build(request, resources);
  assert.deepEqual(first.bytes, capsule());
  const raw = { linkedELF: first.linkedELF, capsuleBytes: first.bytes, reportJSON: first.reportJSON, receipt: first.receipt,
    diagnostics: first.diagnostics, timings: first.timings, memoryBytes: first.memoryBytes };
  await assert.rejects(verifyBuildResult({ ...raw, receipt: { ...raw.receipt, firmwareBuildID: "0".repeat(64) } }, request));
  for (const source of ["struct X { X() { pinMode(6, 1); } }; X x; void setup() {} void loop() {}",
    "volatile uint32_t values[1025]; void setup() { values[0] = 1; } void loop() { ++values[0]; }"])
    await assert.rejects(build(source), { code: "link_failed" });
  for (const source of ["void setup() {} void loop() {}", "volatile uint32_t n; void setup() {} void loop() { ++n; }",
    "volatile uint32_t n = 7; void setup() {} void loop() { ++n; }"])
    assert.equal((await build(source)).format, NANO_STATEFUL.profile);
  assert.deepEqual((await controller.build(request, resources)).bytes, first.bytes);
});

test("descriptor discriminants never invoke accessor-backed untrusted metadata", () => {
  let calls = 0;
  const value = { ...descriptor };
  Object.defineProperty(value, "profile", { enumerable: true, get() { calls++; return "nano-managed-v2"; } });
  assert.throws(() => validateFirmwareBuildDescriptor(value));
  assert.equal(calls, 0);
});

test("reviewed firmware schema-three resources retain exact committed bytes and source bindings", async () => {
  const manifest = JSON.parse(readFileSync(new URL("./fixtures/stateful-contract/manifest.json", import.meta.url)));
  const contract = JSON.parse(readFileSync(new URL("./fixtures/stateful-contract/contract.json", import.meta.url)));
  const facts = JSON.parse(readFileSync(new URL("./fixtures/stateful-contract/resident-facts.json", import.meta.url)));
  const { sha256 } = await import("../src/hash.js");
  assert.equal(manifest.schema, 3); assert.equal(manifest.files.length, 39);
  assert.equal(contract.identifier, "firmingo-nano-managed-abi2-v1-experimental");
  for (const record of manifest.files.filter(item => !["resident.elf", "resident.uf2"].includes(item.path))) {
    const bytes = readFileSync(new URL(`./fixtures/stateful-contract/${record.path}`, import.meta.url));
    assert.equal(bytes.length, record.bytes); assert.equal(await sha256(bytes), record.sha256);
  }
  for (const record of contract.resources.filter(item => facts.sourceSHA256[item.sourcePath]))
    assert.equal(record.sha256, facts.sourceSHA256[record.sourcePath]);
});

test("published execution schemas name the actual ABI-two recipe assets and unchanged reviewed service", () => {
  const schema = JSON.parse(readFileSync(new URL("../schemas/build-receipt.schema.json", import.meta.url)));
  const branch = schema.oneOf.find(item => item.properties.profile.const === "nano-managed-v2" && item.properties.firmwareBuildID);
  assert.equal(branch.properties.provenance.properties.recipeIdentifier.const, receipt.provenance.recipeIdentifier);
  assert.equal(branch.properties.provenance.properties.recipeSHA256.const, receipt.provenance.recipeSHA256);
  assert.deepEqual(branch.properties.recipeAssets.const, receipt.recipeAssets);
  assert.deepEqual(branch.properties.service.const, receipt.service);
});

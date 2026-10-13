import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { importResident } from "../tools/import-resident.mjs";
import { firmwareBuildIdentity } from "../src/contract.js";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value));

// Independent static UF2/FAPI bytes and declared metadata, NEVER DEPLOY. ELF derivation belongs to
// the firmware exporter; this fixture tests the compiler's trusted-anchor and UF2 checks only.
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-resident-import-"));
  const descriptor = JSON.parse(readFileSync(new URL("./fixtures/synthetic-nano-descriptor.json", import.meta.url)));
  const table = Buffer.alloc(40); table.writeUInt32LE(0x49504146); table.writeUInt16LE(1, 4); table.writeUInt16LE(40, 6);
  for (let i = 0; i < 8; i++) table.writeUInt32LE(0x10000041, 8 + 4 * i);
  const uf2 = Buffer.alloc(512);
  for (const [offset, value] of [[0, 0x0a324655], [4, 0x9e5d5157], [8, 0x2000], [12, 0x10000000],
    [16, 256], [20, 0], [24, 1], [28, 0xe48bff56], [508, 0x0ab16f30]]) uf2.writeUInt32LE(value, offset);
  table.copy(uf2, 32 + 128);
  const elf = Buffer.from("non-executable ELF-role fixture; producer-owned derivation; NEVER DEPLOY");
  const source = Object.fromEntries(["boards/nano_rp2040_connect/baseline.json", "experiments/managed_sketch/abi.h", "src/core/version.h",
    "experiments/managed_sketch/firmingo_managed_resident/firmingo_managed_resident.ino", "experiments/managed_sketch/build_resident.py"].map(path => [path, "a".repeat(64)]));
  const report = { status: "compile-tested experimental resident; not flashed", board: descriptor.board,
    core: "rp2040:rp2040@6.0.0", elf_sha256: hash(elf), uf2_sha256: hash(uf2), source_sha256: source };
  descriptor.apiAddress = 0x10000080; descriptor.residentELFSHA256 = hash(elf); descriptor.firmwareImageSHA256 = hash(uf2);
  descriptor.buildReportSHA256 = hash(json(report));
  const { recipeIdentifier, recipeSHA256, ...base } = descriptor;
  const facts = { ...base, apiTable: { apiAddress: descriptor.apiAddress, residentABI: 1, apiTableBytes: 40,
    apiTableSHA256: hash(table), functionAddresses: Array(8).fill(0x10000041), loadFlags: 7 }, comparedFlashBytes: 256,
    sourceSHA256: source, ignoredHistoricalMetadata: {}, hardwareQualification: "not established by export",
    provenanceLimit: "reported project sources match commit; installed core/toolchain inputs are declared, not fully reproduced or inventoried",
    exportToolSHA256: "b".repeat(64), exportValidatorSHA256: "c".repeat(64) };
  const files = { "resident.elf": elf, "resident.uf2": uf2, "build-report.json": json(report), "resident-facts.json": json(facts) };
  const manifest = { schema: 1, purpose: "experimental_resident_compiler_export", board: descriptor.board,
    profile: descriptor.profile, firmwareCommit: descriptor.firmwareCommit, files: [],
    qualification: "experimental structural/source/artifact checks; no installation or hardware qualification" };
  const save = () => {
    for (const [path, bytes] of Object.entries(files)) writeFileSync(join(directory, path), bytes);
    manifest.files = Object.entries(files).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) }));
    writeFileSync(join(directory, "manifest.json"), json(manifest)); return hash(json(manifest));
  };
  const anchor = save();
  return { directory, files, manifest, facts, report, descriptor, anchor, save,
    close: () => rmSync(directory, { recursive: true, force: true }) };
}

test("explicit anchored resident metadata uses pinned recipe and never offers images or changes default catalogue", async () => {
  const f = fixture();
  try {
    const first = await importResident(f.directory, f.anchor), second = await importResident(f.directory, f.anchor);
    assert.deepEqual(first, second); assert.deepEqual(first.descriptor, f.descriptor);
    assert.deepEqual(first.catalogue.firmwareBuilds, [f.descriptor]);
    assert.equal(first.receipt.firmwareBuildID, await firmwareBuildIdentity(f.descriptor));
    assert.equal(first.receipt.imagesCopied, false); assert.equal(first.receipt.defaultCatalogueChanged, false);
    assert.equal(first.descriptor.deviceID, undefined); assert.match(first.receipt.qualification, /no Clang-to-resident hardware/);
  } finally { f.close(); }
});

test("resident importer rejects wrong anchor, corrupt roles, unsafe or duplicate inventory and symlinks", async () => {
  for (const mutate of [
    f => writeFileSync(join(f.directory, "resident.elf"), "corrupt"),
    f => { f.manifest.files[0].path = "../resident.elf"; },
    f => { f.manifest.files[0] = f.manifest.files[1]; },
    f => { f.manifest.files.pop(); },
    f => { rmSync(join(f.directory, "resident.elf")); symlinkSync(join(f.directory, "resident.uf2"), join(f.directory, "resident.elf")); },
    f => { f.manifest.files[0].bytes = 8 * 1024 * 1024 + 1; },
  ]) {
    const f = fixture();
    try {
      await assert.rejects(importResident(f.directory, "0".repeat(64)), /anchor mismatch/);
      mutate(f); writeFileSync(join(f.directory, "manifest.json"), json(f.manifest));
      await assert.rejects(importResident(f.directory, hash(json(f.manifest))));
    } finally { f.close(); }
  }
});

test("independent UF2 table checks reject malformed blocks and inconsistent declared API even with recomputed anchors", async () => {
  for (const [offset, value] of [[0, 0], [8, 0], [12, 0x10200000], [16, 257], [20, 1], [24, 2], [28, 0], [508, 0],
    [160, 0], [164, 0], [168, 0x10000040]]) {
    const f = fixture();
    try {
      f.files["resident.uf2"].writeUInt32LE(value, offset);
      f.facts.firmwareImageSHA256 = f.report.uf2_sha256 = hash(f.files["resident.uf2"]);
      f.files["build-report.json"] = json(f.report); f.facts.buildReportSHA256 = hash(f.files["build-report.json"]);
      f.files["resident-facts.json"] = json(f.facts);
      await assert.rejects(importResident(f.directory, f.save()), /UF2|API/);
    } finally { f.close(); }
  }
});

test("resident importer rejects incomplete facts, recipe injection, source drift and unsupported provenance claims", async () => {
  for (const mutate of [
    f => { delete f.facts.exportValidatorSHA256; },
    f => { f.facts.recipeIdentifier = "injected"; },
    f => { f.facts.firmwareCommit = "0".repeat(40); },
    f => { f.facts.sourceSHA256 = {}; },
    f => { f.facts.ignoredHistoricalMetadata = { "other.cpp": "a".repeat(64) }; },
    f => { f.facts.hardwareQualification = "approved"; },
    f => { f.facts.provenanceLimit = "reproduced all upstream inputs"; },
    f => { f.report.source_sha256 = { "../unsafe": "a".repeat(64) }; },
    f => { f.report.core = "rp2040:rp2040@6.1.0"; },
  ]) {
    const f = fixture();
    try {
      mutate(f); f.files["build-report.json"] = json(f.report); f.facts.buildReportSHA256 = hash(f.files["build-report.json"]);
      f.files["resident-facts.json"] = json(f.facts);
      await assert.rejects(importResident(f.directory, f.save()));
    } finally { f.close(); }
  }
});

test("resident CLI emits only metadata into new directories and fails before publication for invalid inputs", () => {
  const f = fixture();
  const output = join(f.directory, "imported");
  const run = args => spawnSync(process.execPath, ["tools/dev.mjs", ...args], { encoding: "utf8", timeout: 5000 });
  try {
    const args = ["import-resident", f.directory, f.anchor, output];
    const first = run(args); assert.equal(first.status, 0, first.stderr);
    assert.equal(JSON.parse(first.stdout).status, "imported_experimental_resident_metadata");
    assert.deepEqual(JSON.parse(readFileSync(join(output, "descriptor.json"))), f.descriptor);
    assert.equal(existsSync(join(output, "resident.elf")), false); assert.equal(run(args).status, 1);
    args[2] = "0".repeat(64); args[3] = join(f.directory, "invalid");
    assert.equal(run(args).status, 1); assert.equal(existsSync(args[3]), false);
    assert.equal(run(["import-resident"]).status, 1); assert.equal(run(["audit-service"]).status, 1);
  } finally { f.close(); }
});

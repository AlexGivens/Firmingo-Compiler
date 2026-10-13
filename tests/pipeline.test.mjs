import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prepareSketch, originalSourceLocation, parseELF, packageELF, validateCapsule, PipelineError,
  verifyNanoRecipe, createNanoJobs } from "../src/index.js";

const json = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const request = json("synthetic-packaging-request.json"), provenance = json("declared-packaging-provenance.json");
const fresh = () => structuredClone(request);
const hex = name => Uint8Array.from(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8").trim().split(/\s+/), pair => parseInt(pair, 16));
const elf = () => hex("stateless.elf.hex"), capsule = () => hex("firmware-upload-chunk.hex").slice(24);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const word = (bytes, offset, value) => new DataView(bytes.buffer, bytes.byteOffset, bytes.length).setUint32(offset, value, true);
const invalid = operation => assert.throws(operation, error => error instanceof PipelineError && error.code === "invalid_elf");

/** Independent fixture layout helper only: shifts existing metadata for code boundary cases. */
function boundaryELF(codeBytes) {
  const original = elf(), metadata = Math.ceil((256 + codeBytes) / 16) * 16, table = metadata + 240;
  const bytes = new Uint8Array(table + 200);
  bytes.set(original.subarray(0, 84)); bytes.fill(0xaa, 256, 256 + codeBytes);
  bytes.set(original.subarray(272, 417), metadata); bytes.set(original.subarray(512, 712), table);
  word(bytes, 32, table); word(bytes, 68, 256 + codeBytes); word(bytes, 72, 256 + codeBytes);
  word(bytes, table + 60, codeBytes); word(bytes, table + 96, metadata);
  word(bytes, table + 136, metadata + 48); word(bytes, table + 176, metadata + 112);
  if (codeBytes === 4) word(bytes, metadata + 36, 0x10200101);
  return bytes;
}

test("preparation preserves independent SDK normalization/hash vectors", async () => {
  const input = fresh(); input.source.text = "\ufeffvoid setup() {}\r\nvoid loop() {}\r";
  const prepared = await prepareSketch(input);
  assert.equal(prepared.translationUnit, '#include <Arduino.h>\n#line 1 "Sketch.ino"\nvoid setup() {}\nvoid loop() {}\n');
  assert.equal(prepared.sourceSHA256, "2f3bb57b502367f2d87bd53a1e6a2f98c61d22107b7c47ac85faab56b8e6a153");
  assert.equal(prepared.translationUnitSHA256, "9a298b76d01802f89c360908c473933a9ff814b794ec40a07f49fdabe0e386f4");
  assert.equal(prepared.sourceLineCount, 3);
  assert.deepEqual(originalSourceLocation(prepared, 3), { filename: "Sketch.ino", line: 1, column: 4 });
  for (const line of [-1, 0, 1, 2, 6, Number.MAX_SAFE_INTEGER]) assert.equal(originalSourceLocation(prepared, line), null);
  assert.equal(originalSourceLocation(prepared, 3, Number.MAX_SAFE_INTEGER), null);
  assert.equal(originalSourceLocation(null, 3), null);
});

test("comments, ordinary/raw literals and literal facade includes preserve source order", async () => {
  const input = fresh();
  input.source.text = `/* é */ # include "Arduino.h" // local
void helper();
const char *s = "#pragma once /* \\" */";
const char *r = u8R"tag(
#line 900 "wrong"
// /* )wrong"
)tag";
void setup() { helper(); } void loop() {}
void helper() {}`;
  const prepared = await prepareSketch(input);
  assert.ok(prepared.translationUnit.endsWith(input.source.text + "\n"));
  assert.equal(prepared.translationUnit.split("void helper();").length, 2);
});

for (const directive of ["#define X 1", "#if 1", "#include <Wire.h>", "#include HEADER", '#include "../Arduino.h"',
  "#pragma once", "#line 4", "#include <Arduino.h> garbage"]) {
  test(`rejects directive with original UTF-8 location: ${directive}`, async () => {
    const input = fresh(); input.source.text = `void setup() {}\n/* é */ ${directive}\nvoid loop() {}`;
    await assert.rejects(() => prepareSketch(input), error => {
      assert.equal(error.code, "unsupported_source");
      assert.equal(error.diagnostics[0].line, 2); assert.equal(error.diagnostics[0].column, 10);
      return true;
    });
  });
}

test("digit separators do not conceal following directives", async () => {
  for (const number of ["1'000", "0xAB'CD", "0b10'01", "123'456'789"]) {
    const input = fresh(); input.source.text = `int n = ${number};\n  #define X 1`;
    await assert.rejects(() => prepareSketch(input), error => error.code === "unsupported_source"
      && error.diagnostics[0].line === 2 && error.diagnostics[0].column === 3);
  }
});

test("line splicing, BOM-only source and directive flood reject with bounded diagnostics", async () => {
  const input = fresh(); input.source.text = "// splice\\\r\n#define X 1";
  await assert.rejects(() => prepareSketch(input), error => error.diagnostics[0].column === 10);
  input.source.text = "\ufeff #define X 1";
  await assert.rejects(() => prepareSketch(input), error => error.diagnostics[0].column === 5);
  for (const text of ["\ufeff", " \r\n\t"]) {
    input.source.text = text;
    await assert.rejects(() => prepareSketch(input), error => error.code === "invalid_source");
  }
  input.source.text = "#define X 1\n".repeat(100);
  await assert.rejects(() => prepareSketch(input), error => error.diagnostics.length === 64);
});

test("preparation snapshots request before hashing and checks cancellation after async work", async () => {
  const input = fresh(), original = input.source.text;
  const promise = prepareSketch(input); input.source.text = "changed";
  assert.equal((await promise).request.source.text, original);
  const controller = new AbortController();
  const cancelled = prepareSketch(fresh(), { signal: controller.signal }); controller.abort();
  await assert.rejects(() => cancelled, error => error.code === "cancelled");
});

test("golden ELF packages exact firmware bytes and independent report/receipt", async () => {
  const result = await packageELF(elf(), fresh(), provenance);
  assert.deepEqual(result.bytes, capsule());
  assert.equal(result.sha256, "ef8bff817d9b80026f6eaeac33d1c40fac2f41b046865de967d3c0cf2539d52a");
  assert.equal(result.filename, "Sketch.fms");
  assert.deepEqual(JSON.parse(result.reportJSON), json("golden-packaging-report.json"));
  assert.equal(result.reportJSON, readFileSync(new URL("./fixtures/golden-packaging-report.json", import.meta.url), "utf8").slice(0, -1));
  assert.deepEqual(result.receipt, json("golden-packaging-receipt.json"));
  const copy = result.bytes; copy.fill(0);
  assert.deepEqual(result.bytes, capsule());
  assert.equal(result.receipt.provenanceStatus, "declared");
  assert.equal(Object.hasOwn(result.receipt, "deviceID"), false);
});

test("every ELF truncation fails as a bounded typed validation error", () => {
  const bytes = elf();
  for (let length = 0; length < bytes.length; length++) invalid(() => parseELF(bytes.subarray(0, length)));
  invalid(() => parseELF(new Uint8Array(2 * 1024 * 1024 + 1)));
});

test("ELF code bounds allow aligned minimum/maximum and reject excess or unaligned code", async () => {
  for (const size of [4, 8, 3840]) {
    const result = await packageELF(boundaryELF(size), fresh(), provenance);
    assert.equal(result.bytes.length, 256 + size);
  }
  for (const size of [0, 1, 7, 3844]) invalid(() => parseELF(boundaryELF(size)));
});

test("readonly LLD string flags are accepted; writable and unknown flags fail", () => {
  const bytes = elf(); word(bytes, 560, 0x36);
  assert.deepEqual(parseELF(bytes).code, bytes.slice(256, 264));
  for (const flags of [7, 0x37, 0x16, 0x26, 0x46, 0x136]) {
    word(bytes, 560, flags); invalid(() => parseELF(bytes));
  }
});

test("malformed header/table/mapping/symbol matrix is terminal", () => {
  const changes = [[0, 0], [16, 0x00280001], [20, 0], [24, 0x10200105], [28, 0xfffffff0], [32, 0xfffffff0],
    [36, 0x05000400], [40, 0], [44, 0x00280000], [48, 0x00040000], [48, 0x00040081],
    [52, 2], [56, 4], [60, 0x10000100], [64, 0x10200004], [68, 263], [72, 265], [76, 7], [80, 3],
    [512, 1], [552, 9999], [556, 8], [560, 7], [564, 0x10000100], [568, 52], [572, 3844],
    [592, 9999], [596, 9], [600, 2], [608, 256], [616, 9999], [624, 3], [628, 8],
    [648, 0xfffffff0], [652, 0xfffffff0], [688, 256], [272, 1], [288, 9999], [292, 0x10200100],
    [296, 9], [300, 0x00010002], [304, 1], [308, 0x10200109], [312, 8], [316, 0x00020012]];
  for (const [offset, value] of changes) {
    const bytes = elf(); word(bytes, offset, value);
    assert.throws(() => parseELF(bytes), error => error instanceof PipelineError && error.code === "invalid_elf", `offset ${offset} value ${value}`);
  }
  for (const [offset, value] of [[4, 2], [5, 2], [7, 1], [302, 0], [300, 0x22], [301, 2], [320, 1], [416, 1]]) {
    const bytes = elf(); bytes[offset] = value; invalid(() => parseELF(bytes));
  }
  for (const type of [4, 6, 9, 11, 14, 15, 16]) {
    const bytes = elf(); word(bytes, 636, type); invalid(() => parseELF(bytes));
  }
});

test("binary views are normalized; shared buffers and conventional artifacts are rejected", () => {
  const original = elf(), prefixed = new Uint8Array(original.length + 2); prefixed.set(original, 2);
  assert.deepEqual(parseELF(prefixed.subarray(2)).code, original.slice(256, 264));
  const shared = new Uint8Array(new SharedArrayBuffer(original.length)); shared.set(original);
  invalid(() => parseELF(shared));
  invalid(() => parseELF(new TextEncoder().encode("UF2\n".padEnd(512, "x"))));
  const copy = parseELF(original).code; copy.fill(0);
  assert.equal(sha(parseELF(original).code), sha(original.slice(256, 264)));
});

test("UTF-8 symbol names preserve BOM rather than aliasing a required wrapper", () => {
  const bytes = elf(), table = bytes.slice(320, 384), view = new DataView(bytes.buffer);
  bytes.fill(0, 320, 384);
  bytes.set([0, 0xef, 0xbb, 0xbf, ...table.subarray(1, 60)], 320);
  word(bytes, 304, view.getUint32(304, true) + 3);
  invalid(() => parseELF(bytes));
  const invalidUTF8 = elf(); invalidUTF8[321] = 0xff;
  invalid(() => parseELF(invalidUTF8));
});

test("binary snapshots use native bytes without invoking caller accessors or iterators", () => {
  const bytes = elf();
  Object.defineProperty(bytes, "byteLength", { get() { assert.fail("Byte-length accessor invoked"); } });
  bytes[Symbol.iterator] = function* () { assert.fail("Caller iterator invoked"); };
  assert.equal(parseELF(bytes).codeBytes, 8);
  invalid(() => parseELF(new Proxy(elf(), {})));
  const shared = new Uint8Array(new SharedArrayBuffer(712));
  Object.defineProperty(shared, "buffer", { value: new ArrayBuffer(712) });
  invalid(() => parseELF(shared));
});

test("FMS1 validator rejects corrupt headers/padding/entries/hash and trailing data", async () => {
  for (const offset of [0, 4, 6, 8, 12, 16, 20, 24, 28, 32, 64, 255, 256]) {
    const bytes = capsule(); bytes[offset] ^= 1;
    await assert.rejects(() => validateCapsule(bytes, request.target.firmwareBuild), error => error.code === "invalid_capsule");
  }
  const bytes = new Uint8Array(capsule().length + 1); bytes.set(capsule());
  await assert.rejects(() => validateCapsule(bytes, request.target.firmwareBuild), error => error.code === "invalid_capsule");
  const other = { ...request.target.firmwareBuild, apiAddress: request.target.firmwareBuild.apiAddress + 4 };
  await assert.rejects(() => validateCapsule(capsule(), other), error => error.code === "invalid_capsule");
});

test("packaging snapshots ELF/request/provenance before async work and rejects cancellation", async () => {
  const bytes = Buffer.from(elf()), input = fresh(), declared = { ...provenance };
  const promise = packageELF(bytes, input, declared);
  bytes.fill(0); input.source.text = "changed"; declared.compiler = "changed";
  const result = await promise;
  assert.deepEqual(result.bytes, capsule()); assert.equal(result.receipt.provenance.compiler, provenance.compiler);
  const controller = new AbortController();
  const cancelled = packageELF(elf(), fresh(), provenance, { signal: controller.signal }); controller.abort();
  await assert.rejects(() => cancelled, error => error.code === "cancelled");
});

test("input receipt changes with declared inputs while byte-identical capsules remain byte-identical", async () => {
  const first = await packageELF(elf(), fresh(), provenance);
  for (const mutate of [r => r.source.revision = "revision-8", r => r.source.text += "\n", r => r.options.deadlineMilliseconds = 1]) {
    const input = fresh(); mutate(input);
    const next = await packageELF(elf(), input, provenance);
    assert.equal(next.sha256, first.sha256); assert.notEqual(next.receipt.buildInputSHA256, first.receipt.buildInputSHA256);
  }
  for (const invalidProvenance of [{ ...provenance, compiler: "" }, { ...provenance, toolchainSHA256: "A".repeat(64) },
    { ...provenance, recipeSHA256: "0".repeat(64) }, { ...provenance, unexpected: true }]) {
    await assert.rejects(() => packageELF(elf(), fresh(), invalidProvenance), error => error.code === "invalid_provenance");
  }
});

const recipeRoot = new URL("../recipes/nano_rp2040_connect/", import.meta.url);
const recipeInputs = () => ({
  manifest: new Uint8Array(readFileSync(new URL("manifest.json", recipeRoot))),
  assets: Object.fromEntries(["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"]
    .map(path => [path, new Uint8Array(readFileSync(new URL(path, recipeRoot)))])),
});

test("unchanged Nano manifest/assets verify, and corruption or unsafe extra paths reject", async () => {
  const inputs = recipeInputs(); const pending = verifyNanoRecipe(inputs.manifest, inputs.assets);
  inputs.assets["Recipe/Arduino.h"].fill(0);
  const verified = await pending;
  assert.equal(verified.recipeSHA256, request.target.recipeSHA256);
  assert.notEqual(verified.assets["Recipe/Arduino.h"][0], 0);
  verified.assets["Recipe/Arduino.h"].fill(0);
  assert.notEqual(verified.assets["Recipe/Arduino.h"][0], 0);
  for (const mutate of [x => x.manifest[0] ^= 1, x => x.assets["Recipe/Arduino.h"][0] ^= 1,
    x => x.assets["../escape"] = new Uint8Array([1]), x => delete x.assets["Recipe/Entry.cpp"]]) {
    const input = recipeInputs(); mutate(input);
    await assert.rejects(() => verifyNanoRecipe(input.manifest, input.assets), error => error.code === "invalid_recipe");
  }
});

test("portable recipe creates fixed compile/compile/link jobs after preprocessing", async () => {
  const result = await createNanoJobs(fresh());
  assert.deepEqual(result.jobs.map(job => job.phase), ["compiling", "compiling", "linking"]);
  const args = new TextDecoder().decode(result.jobs[0].bytes);
  assert.ok(args.includes("--target=armv6m-none-eabi\n"));
  assert.ok(args.includes(`-DFIRMINGO_API_ADDRESS=${request.target.firmwareBuild.apiAddress}\n`));
  const input = fresh(); input.source.text = "#define UNSUPPORTED 1";
  await assert.rejects(() => createNanoJobs(input), error => error.code === "unsupported_source");
});

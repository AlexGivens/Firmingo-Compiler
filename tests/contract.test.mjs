import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ContractError, LIMITS, validateBuildRequest, parseBuildRequest, validateCancelRequest,
  validateFirmwareBuildDescriptor, requestIdentity, firmwareBuildIdentity, parseContractJSON,
} from "../src/index.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/synthetic-build-request.json", import.meta.url)));
const provenance = JSON.parse(readFileSync(new URL("./fixtures/provenance.json", import.meta.url)));
const fresh = () => structuredClone(fixture);
const fails = (operation, code, path) => assert.throws(operation, error => {
  assert.ok(error instanceof ContractError);
  assert.equal(error.code, code);
  if (path) assert.equal(error.path, path);
  return true;
});

test("synthetic request round-trips exact source bytes without preprocessing", () => {
  const request = fresh();
  request.source.text = "\ufeff// héllo 😀\r\nvoid setup() {}\rvoid loop() {}\n";
  const parsed = parseBuildRequest(JSON.stringify(request));
  assert.equal(parsed.source.text, request.source.text);
  assert.deepEqual(parsed, request);
});

test("descriptor and request identities match independent Python golden hashes", async () => {
  assert.equal(await firmwareBuildIdentity(fixture.target.firmwareBuild), provenance.descriptorID);
  assert.equal(await requestIdentity(fixture), provenance.requestID);
});

test("identity is independent of object ordering but changes with revision, source, and deadline", async () => {
  const identity = await requestIdentity(fixture);
  const reordered = Object.fromEntries(Object.entries(fixture).reverse());
  assert.equal(await requestIdentity(reordered), identity);
  for (const change of [r => r.source.revision = "revision-2", r => r.source.text += "\n",
    r => r.options.deadlineMilliseconds = 1, r => r.buildID = "new-build"]) {
    const request = fresh(); change(request);
    assert.notEqual(await requestIdentity(request), identity);
  }
});

test("validation snapshots and deeply freezes caller-owned build data", () => {
  const request = fresh();
  const validated = validateBuildRequest(request);
  request.source.text = "changed";
  request.target.firmwareBuild.apiAddress += 4;
  assert.equal(validated.source.text, fixture.source.text);
  assert.equal(validated.target.firmwareBuild.apiAddress, fixture.target.firmwareBuild.apiAddress);
  assert.ok(Object.isFrozen(validated.options));
  assert.throws(() => validated.target.firmwareBuild.apiAddress++, TypeError);
  assert.throws(() => validated.source.text = "changed", TypeError);
});

for (const [name, mutate, code] of [
  ["unknown top-level field", r => r.deviceID = "device", "invalid_input"],
  ["missing source", r => delete r.source, "invalid_input"],
  ["unknown library input", r => r.source.libraries = [], "invalid_input"],
  ["unknown option", r => r.options.flags = ["-O3"], "invalid_input"],
  ["wrong interface version", r => r.interfaceVersion = 2, "unsupported_version"],
  ["boolean interface version", r => r.interfaceVersion = true, "unsupported_version"],
  ["Pico target", r => r.target.board = "raspberry_pi_pico", "unsupported_target"],
  ["recipe digest mismatch", r => r.target.recipeSHA256 = "0".repeat(64), "unsupported_target"],
  ["descriptor target mismatch", r => r.target.firmwareBuild.board = "other", "unsupported_target"],
  ["descriptor ABI mismatch", r => r.target.firmwareBuild.residentABI = 2, "unsupported_target"],
  ["fabricated qualified status", r => r.target.firmwareBuild.qualification = "qualified", "unsupported_target"],
  ["uppercase digest", r => r.target.firmwareBuild.residentELFSHA256 = "A".repeat(64), "invalid_input"],
  ["unaligned API address", r => r.target.firmwareBuild.apiAddress++, "invalid_input"],
  ["API address in sketch slot", r => r.target.firmwareBuild.apiAddress = 0x10200000, "invalid_input"],
  ["negative deadline", r => r.options.deadlineMilliseconds = -1, "invalid_input"],
  ["zero deadline", r => r.options.deadlineMilliseconds = 0, "invalid_input"],
  ["oversized deadline", r => r.options.deadlineMilliseconds = 60001, "invalid_input"],
  ["fractional deadline", r => r.options.deadlineMilliseconds = 1.5, "invalid_input"],
  ["unsafe build integer", r => r.buildID = Number.MAX_SAFE_INTEGER + 1, "invalid_input"],
]) {
  test(`rejects ${name} before compiler execution`, () => {
    const request = fresh(); mutate(request);
    fails(() => validateBuildRequest(request), code);
  });
}

test("accepts source/deadline boundaries and rejects one byte beyond UTF-8 limits", () => {
  const request = fresh();
  request.source.text = "é".repeat(LIMITS.sourceBytes / 2);
  request.options.deadlineMilliseconds = 1;
  assert.equal(validateBuildRequest(request).source.text, request.source.text);
  request.source.text += "a";
  fails(() => validateBuildRequest(request), "invalid_input", "$.source.text");
});

test("rejects empty, NUL, and lone-surrogate source without including payload in errors", () => {
  for (const text of ["", "private-source\0", "private-source\ud800", "private-source\udfff"]) {
    const request = fresh(); request.source.text = text;
    try { validateBuildRequest(request); assert.fail("Invalid source accepted"); }
    catch (error) {
      assert.ok(error instanceof ContractError);
      assert.equal(error.path, "$.source.text");
      assert.ok(!error.message.includes("private-source"));
    }
  }
});

test("rejects traversal, directive injection, unsafe names and oversized revision tokens", () => {
  for (const filename of ["../Blink.ino", ".ino", "a..ino", "dir/Blink.ino", "x\\Blink.ino", "x\n.ino", "a".repeat(93) + ".ino"]) {
    const request = fresh(); request.source.filename = filename;
    fails(() => validateBuildRequest(request), "invalid_input", "$.source.filename");
  }
  const request = fresh(); request.source.revision = "x".repeat(129);
  fails(() => validateBuildRequest(request), "invalid_input", "$.source.revision");
});

test("does not invoke data accessors or accept prototype-bearing input", () => {
  const request = fresh();
  Object.defineProperty(request.source, "text", { enumerable: true, get() { assert.fail("Getter invoked"); } });
  fails(() => validateBuildRequest(request), "invalid_input", "$.source");
  fails(() => validateBuildRequest(Object.assign(Object.create({ injected: 1 }), fixture)), "invalid_input", "$");
});

test("duplicate decoded JSON keys cannot hide unsupported versions", () => {
  const input = JSON.stringify(fixture).replace('"interfaceVersion":1', '"interfaceVersion":2,"interface\\u0056ersion":1');
  fails(() => parseBuildRequest(input), "duplicate_key");
  fails(() => parseContractJSON('{"source":{"text":"a","text":"b"}}'), "duplicate_key");
});

test("every truncation of a representative control JSON object fails cleanly", () => {
  const json = '{"interfaceVersion":1,"kind":"cancel","buildID":"build-1"}';
  for (let split = 0; split < json.length; split++) {
    fails(() => parseContractJSON(json.slice(0, split)), "invalid_json");
  }
  assert.equal(validateCancelRequest(parseContractJSON(json)).buildID, "build-1");
});

test("JSON parsing rejects malformed escapes, numbers, trailing data and non-JSON whitespace", () => {
  for (const json of ['{"x":01}', '{"x":1,}', '"\\x00"', '"line\nfeed"', '[1,]', '{}{}', '{"x":9007199254740993}',
    '{"x":1e999}', '{"x":1e0}', '{"x":1.000000000000000000001}', '{"x":1e-999}', '\ufeff{}']) {
    fails(() => parseContractJSON(json), "invalid_json");
  }
});

test("JSON nesting, token and byte limits are enforced before validation", () => {
  fails(() => parseContractJSON("[".repeat(10) + "0" + "]".repeat(10)), "input_limit");
  fails(() => parseContractJSON("[" + Array(4097).fill("0").join(",") + "]"), "input_limit");
  fails(() => parseContractJSON(" ".repeat(LIMITS.jsonBytes + 1)), "input_limit");
});

test("decoded __proto__ keys never mutate object prototypes", () => {
  const parsed = parseContractJSON('{"__proto__":{"polluted":true}}');
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal({}.polluted, undefined);
  fails(() => validateBuildRequest(parsed), "invalid_input");
});

test("descriptor validation accepts boundary addresses while returning no deployment permission", () => {
  for (const apiAddress of [0x10000000, 0x101ffffc]) {
    const descriptor = { ...fixture.target.firmwareBuild, apiAddress };
    assert.equal(validateFirmwareBuildDescriptor(descriptor).apiAddress, apiAddress);
  }
  assert.equal(Object.hasOwn(validateFirmwareBuildDescriptor(fixture.target.firmwareBuild), "deviceID"), false);
});

test("cancel requests have only version, operation and exact build correlation", () => {
  assert.deepEqual(validateCancelRequest({ interfaceVersion: 1, kind: "cancel", buildID: "build-1" }),
    { interfaceVersion: 1, kind: "cancel", buildID: "build-1" });
  fails(() => validateCancelRequest({ interfaceVersion: 1, kind: "cancel", buildID: "build-1", retry: true }), "invalid_input");
});

test("opaque hosts preserve input identity through portable SHA-256", async () => {
  const expected = await requestIdentity(fixture);
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  try {
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    assert.equal(await requestIdentity(fixture), expected);
  } finally { Object.defineProperty(globalThis, "crypto", original); }
});

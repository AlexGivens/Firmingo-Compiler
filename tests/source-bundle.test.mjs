import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareSketch, validateBuildRequest, requestIdentity, NANO_STATEFUL } from "../src/index.js";
import { createNanoJobs } from "../src/nano-recipe.js";
import { serializeRuntimeEvent, parseRuntimeEvent } from "../runtime/serialization.js";
import { createNodeCompiler, createNodePreparer, localResources } from "../tools/node-runtime.mjs";

const fixture = name => JSON.parse(readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8"));
const request = fixture("source-bundle-request.json"), source = request.source;
const withFiles = files => ({ ...request, source: { ...source, files } });
const reverse = withFiles([...source.files].reverse());

test("source bundles snapshot sorted relative paths and assign independent fixed jobs", async () => {
  const accepted = validateBuildRequest(request);
  assert.ok(Object.isFrozen(accepted.source.files[0]));
  assert.deepEqual(accepted.source.files.map(file => file.path), ["logic/counter.h", "logic/setup.cpp", "logic/tick.cpp", "shared/state.h"]);
  assert.equal(await requestIdentity(request), await requestIdentity(reverse));
  const { prepared, jobs } = await createNanoJobs(request);
  assert.equal(prepared.sourceBundleSHA256, (await prepareSketch(reverse)).sourceBundleSHA256);
  const edited = withFiles(source.files.map(file => file.path.endsWith("/tick.cpp") ? { ...file, text: file.text + "\n" } : file));
  const next = await prepareSketch(edited);
  assert.equal(next.translationUnitSHA256, prepared.translationUnitSHA256);
  assert.notEqual(next.sourceBundleSHA256, prepared.sourceBundleSHA256);
  assert.notEqual(next.requestSHA256, prepared.requestSHA256);
  const response = job => new TextDecoder().decode(job.bytes);
  assert.equal(jobs.length, 5);
  assert.match(response(jobs[0]), /-I\/workspace\/Bundle\n-c\n\/workspace\/Sketch.cpp\n/);
  assert.match(response(jobs[1]), /\/workspace\/Bundle\/logic\/setup.cpp\n-o\n\/workspace\/helper-0.o\n/);
  assert.match(response(jobs[2]), /\/workspace\/Bundle\/logic\/tick.cpp\n-o\n\/workspace\/helper-1.o\n/);
  assert.match(response(jobs.at(-1)), /helper-0.o\n\/workspace\/helper-1.o\n-o\n/);
  const workerPrepared = await createNodePreparer().prepare(request);
  assert.deepEqual(workerPrepared, prepared);
});

test("closed source bundle rejects traversal, conflicting paths, unsafe objects and total overflow", () => {
  const entry = path => ({ path, text: "" });
  for (const path of ["../bad.cpp", "/bad.cpp", "folder/../bad.cpp", "folder\\bad.h", "a//b.h", ".x.h",
    "a/b/c/d.cpp", "a.txt", "dir./bad.h", "Arduino.h", "nested/ARDUINO.h", "foo.CPP", "a\nb.h", "a.h\n", "AUX.cpp", "LPT1/x.h"]) {
    assert.throws(() => validateBuildRequest(withFiles([entry(path)])), { code: "invalid_input" }, JSON.stringify(path));
  }
  for (const paths of [["same.h", "Same.h"], ["Shared/a.h", "shared/b.h"], ["dir.h", "Dir.h/nested.cpp"],
    ["Dir.h/nested.cpp", "dir.h"], ["Counter.ino/helper.h"]]) {
    assert.throws(() => validateBuildRequest(withFiles(paths.map(entry))), { code: "invalid_input" });
  }
  const accessor = [entry("safe.h")];
  Object.defineProperty(accessor, 0, { get: () => assert.fail("invoked source accessor"), enumerable: true });
  for (const files of [[], Array(1), Array.from({ length: 9 }, (_, index) => entry(`${index}.h`)), accessor,
    [{ ...entry("a.h"), flags: ["-I/"] }], [{ path: "a.h", text: "é".repeat(131072) }]]) {
    assert.throws(() => validateBuildRequest(withFiles(files)), { code: "invalid_input" });
  }
  assert.throws(() => validateBuildRequest({ ...request, interfaceVersion: 1 }), { code: "invalid_input" });
  assert.throws(() => validateBuildRequest({ ...request, target: fixture("synthetic-build-request.json").target }), { code: "unsupported_target" });
});

test("includes resolve only supplied headers and report original helper positions", async () => {
  for (const text of ['#include "other.h"', '#include "../../toolchain/Arduino.h"', '#include <logic/counter.h>',
    '#include "logic/tick.cpp"', '#line 90 "other.h"', '%:include "missing.h"', '??=include "missing.h"',
    '#include \\ \t\n"counter.h"', 'const char *broken = "\n#include "missing.h"', 'const char *broken = identifierR"(\n#include "missing.h"']) {
    const files = [...source.files, { path: "logic/extra.h", text: "\ufeff" + text }];
    await assert.rejects(prepareSketch(withFiles(files)), error => {
      assert.equal(error.code, "unsupported_source");
      assert.equal(error.diagnostics[0].filename, "logic/extra.h");
      assert.equal(error.diagnostics[0].line, text.startsWith("const char") ? 2 : 1);
      assert.ok(error.diagnostics[0].column >= (text.startsWith("const char") ? 1 : 4));
      return true;
    });
  }
  await prepareSketch(withFiles([...source.files, { path: "extra.h",
    text: 'const char *literal = u8R"raw(\n#include "missing.h"\n)raw";' }]));
});

const service = process.env.FIRMINGO_COMPILER_SERVICE;
test("pinned WASM builds and diagnoses multiple translation units through the normal worker", {
  skip: service ? false : "Supply the pinned WASM service to run the multi-file build",
}, async () => {
  const resources = localResources(readFileSync(service), NANO_STATEFUL.profile);
  const controller = createNodeCompiler();
  const events = [];
  const build = (input, onEvent) => controller.build(input, resources, { onEvent });
  const artifact = await build(request, event => events.push(event));
  const replay = await build(reverse);
  assert.deepEqual(replay.bytes, artifact.bytes);
  assert.deepEqual(replay.linkedELF, artifact.linkedELF);
  assert.deepEqual(replay.receipt, artifact.receipt);
  assert.equal(artifact.receipt.receiptSchema, "firmingo-compiler-build-v2");
  assert.equal(artifact.receipt.sourceFiles.length, 4);
  assert.equal(artifact.receipt.sourceBundleSHA256, (await prepareSketch(request)).sourceBundleSHA256);
  const report = JSON.parse(artifact.reportJSON);
  assert.equal(report.data_bytes, 4);
  assert.equal(report.bss_bytes, 4);
  assert.equal(report.source_sha256["sketch/logic/setup.cpp"], artifact.receipt.sourceFiles[1].sha256);
  assert.deepEqual(events.filter(event => event.kind === "progress").map(event => event.phase),
    ["verifying", "preprocessing", "compiling", "compiling", "compiling", "compiling", "linking", "validating", "packaging"]);
  for (const event of events) assert.equal(parseRuntimeEvent(serializeRuntimeEvent(event)).interfaceVersion, 2);
  const result = JSON.parse(serializeRuntimeEvent(events.at(-1)));
  result.artifact.receipt.sourceFiles.reverse();
  assert.throws(() => parseRuntimeEvent(JSON.stringify(result)), { code: "invalid_response" });
  for (const [path, text, code, line, column] of [
    ["logic/tick.cpp", "\ufeffvoid tick() { missing_symbol(); }\r\n", "compile_failed", 1, 18],
    ["logic/counter.h", "#pragma once\r\ninvalid_type variable;\r\n", "compile_failed", 2, 1],
    ["logic/tick.cpp", "void differentName() {}\n", "link_failed", null, null],
  ]) {
    const bad = withFiles(source.files.map(file => file.path === path ? { path, text } : file));
    await assert.rejects(build(bad), error => {
      assert.equal(error.code, code);
      if (line !== null) assert.ok(error.diagnostics.some(item => item.filename === path && item.line === line && item.column === column),
        JSON.stringify(error.diagnostics));
      return true;
    });
  }
  assert.equal((await build(request)).sha256, artifact.sha256);

  const maximum = { ...request, source: { ...source, text: "void setup() {} void loop() {}",
    files: Array.from({ length: 8 }, (_, index) => ({ path: "dir" + index + "/nested/helper.cpp", text: "void helper" + index + "() {}" })) } };
  const maximumEvents = [];
  const maximumBuild = await build(maximum, event => maximumEvents.push(event));
  assert.equal(maximumBuild.timings.length, 11);
  assert.equal(maximumEvents.at(-1).sequence, 16);
});

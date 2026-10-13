import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { readBounded } from "./bounded-file.mjs";
import { compileModule, ManagedService } from "../runtime/ManagedService.js";
import { validateBuildRequest, validateFirmwareBuildDescriptor, firmwareBuildIdentity } from "../src/contract.js";
import { parseContractJSON } from "../src/json.js";
import { createNanoJobs, verifyNanoRecipe } from "../src/nano-recipe.js";
import { packageELF } from "../src/capsule.js";
import { dataIdentity, sha256 } from "../src/hash.js";

/** Maintenance-only execution of an explicitly anchored new asset; consumer pins and catalogue stay unchanged. */
export async function checkBuiltService(modulePath, expectedSHA256, descriptorPath, outputPath) {
  if (!/^[0-9a-f]{64}$/.test(expectedSHA256)) throw new Error("Select an independently reviewed built-module SHA-256");
  const bytes = readBounded(modulePath, 128 * 1024 * 1024);
  if (await sha256(bytes) !== expectedSHA256) throw new Error("Built service anchor mismatch");
  const descriptor = validateFirmwareBuildDescriptor(parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(readBounded(descriptorPath, 16384))));
  const result = await new Promise((resolvePromise, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { bytes, expectedSHA256, descriptor }, transferList: [bytes.buffer] });
    const deadline = setTimeout(() => { void worker.terminate(); reject(new Error("Built service checks timed out; no artifact published")); }, 60000);
    worker.once("message", result => {
      clearTimeout(deadline); void worker.terminate();
      if (result.error) reject(new Error(result.error)); else resolvePromise(result);
    });
    worker.once("error", error => { clearTimeout(deadline); void worker.terminate(); reject(error); });
    worker.once("exit", code => { if (code !== 0) { clearTimeout(deadline); reject(new Error("Built service worker exited without completing checks")); } });
  });
  mkdirSync(outputPath);
  for (const build of result.builds) {
    writeFileSync(join(outputPath, build.name + ".elf"), build.elf, { flag: "wx" });
    writeFileSync(join(outputPath, build.name + ".fms"), build.capsule, { flag: "wx" });
  }
  const report = { schema: 1, operation: "owned_development_service_execution_checks", serviceSHA256: expectedSHA256,
    firmwareBuildID: await firmwareBuildIdentity(descriptor), descriptor,
    builds: result.builds.map(({ elf, capsule, ...fields }) => fields), errorChecks: result.errorChecks,
    repeat: "GPIO capsule and linked ELF byte-identical", consumerPinsChanged: false, distributionStatus: "unresolved", hardwareExecuted: false };
  writeFileSync(join(outputPath, "operation.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  return report;
}

async function workerChecks({ bytes, expectedSHA256, descriptor }) {
  const module = await compileModule(bytes, { bytes: bytes.length, sha256: expectedSHA256 });
  const root = new URL("../recipes/nano_rp2040_connect/", import.meta.url);
  const paths = ["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"];
  const assets = Object.fromEntries(paths.map(path => [path, new Uint8Array(readFileSync(new URL(path, root)))]));
  await verifyNanoRecipe(new Uint8Array(readFileSync(new URL("manifest.json", root))), assets);
  const build = async (name, text) => {
    const request = validateBuildRequest({ interfaceVersion: 1, kind: "build", buildID: "owned-service-" + name,
      source: { filename: "Sketch.ino", revision: name + ":review-1", text },
      target: { board: descriptor.board, profile: descriptor.profile, recipeIdentifier: descriptor.recipeIdentifier,
        recipeSHA256: descriptor.recipeSHA256, firmwareBuild: descriptor }, options: { deadlineMilliseconds: 60000 } });
    const { prepared } = await createNanoJobs(request);
    const service = await ManagedService.create(module, new Map(["Arduino.h", "Entry.cpp", "Module.ld"].map(name => [name, assets["Recipe/" + name]])));
    const result = service.run({ schema: 1, recipe: request.target.recipeIdentifier, board: request.target.board,
      profile: request.target.profile, filename: request.source.filename, translationUnit: prepared.translationUnit, apiAddress: descriptor.apiAddress });
    if (!result.succeeded) return { failed: true, diagnostics: result.diagnostics };
    const provenance = { compiler: "owned LLVM 22.1.8 ABI-two development service", recipeIdentifier: descriptor.recipeIdentifier,
      recipeSHA256: descriptor.recipeSHA256, toolchainSHA256: await dataIdentity({ schema: 1, serviceSHA256: expectedSHA256 }) };
    const packaged = await packageELF(result.elf, request, provenance);
    return { name, source: request.source, elf: result.elf, capsule: packaged.bytes,
      capsuleBytes: packaged.bytes.length, capsuleSHA256: packaged.sha256, linkedELFSHA256: await sha256(result.elf),
      sourceSHA256: prepared.sourceSHA256, receipt: packaged.receipt, memoryBytes: result.memoryBytes, diagnostics: result.diagnostics };
  };
  const gpio = "void setup() { pinMode(6, 1); }\nvoid loop() { digitalWrite(6, 1); delay(10); }\n";
  const first = await build("gpio", gpio), repeat = await build("gpio", gpio);
  const second = await build("console", 'void setup() { Serial.println("ready"); }\nvoid loop() { int c = Serial.read(); if (c >= 0) Serial.write(uint8_t(c)); }\n');
  for (const item of [first, repeat, second]) assert.equal(item.failed, undefined, JSON.stringify(item.diagnostics));
  assert.deepEqual(first.elf, repeat.elf); assert.deepEqual(first.capsule, repeat.capsule);
  assert.notEqual(first.capsuleSHA256, second.capsuleSHA256);
  const errorChecks = [];
  for (const [name, source, expected] of [
    ["frontend", "void setup() { missingFunction(); }\nvoid loop() {}", "missingFunction"],
    ["mutable-storage", "volatile int x; void setup() { x = 1; } void loop() { ++x; }", "mutable storage"],
    ["runtime-helper", "void setup() {} void loop() { digitalWrite(6, millis() / 250); }", "__aeabi_uidiv"],
  ]) {
    const result = await build(name, source);
    assert.equal(result.failed, true, name);
    assert(result.diagnostics.some(diagnostic => diagnostic.severity === "error" && diagnostic.message.includes(expected)), JSON.stringify(result.diagnostics));
    errorChecks.push({ name, result: "rejected without artifact", expectedDiagnostic: expected });
  }
  const fresh = await build("after-errors", gpio);
  assert.equal(fresh.failed, undefined, JSON.stringify(fresh.diagnostics)); assert.deepEqual(fresh.capsule, first.capsule);
  return { builds: [first, second], errorChecks };
}

if (!isMainThread) {
  try { parentPort.postMessage(await workerChecks(workerData)); }
  catch (error) { parentPort.postMessage({ error: error.message }); }
} else if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 6) throw new Error("Usage: node tools/test-built-service.mjs explicit-built.wasm trusted-sha256 firmware-descriptor.json new-output-directory");
    const result = await checkBuiltService(...process.argv.slice(2).map((value, index) => index === 1 ? value : resolve(value)));
    console.log(JSON.stringify({ status: "checked_owned_development_service_execution", builds: result.builds.length,
      errorsRejected: result.errorChecks.length, serviceSHA256: result.serviceSHA256, hardwareExecuted: false }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

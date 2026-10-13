import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { serviceExecutionChecks } from "../web/service-execution.js";
import { readBounded } from "./bounded-file.mjs";
import { validateFirmwareBuildDescriptor, firmwareBuildIdentity } from "../src/contract.js";
import { parseContractJSON } from "../src/json.js";
import { sha256 } from "../src/hash.js";

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

async function workerChecks(inputs) {
  const root = new URL("../recipes/nano_rp2040_connect/", import.meta.url);
  const paths = ["Recipe/Arduino.h", "Recipe/Entry.cpp", "Recipe/Module.ld", "Sources/ManagedRecipe.js"];
  const assets = Object.fromEntries(paths.map(path => [path, new Uint8Array(readFileSync(new URL(path, root)))]));
  const recipeManifest = new Uint8Array(readFileSync(new URL("manifest.json", root)));
  return serviceExecutionChecks({ ...inputs, assets, recipeManifest });
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

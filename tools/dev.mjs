import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { parseBuildRequest, parseDeclaredPackagingRequest, parseContractJSON, requestIdentity, LIMITS, prepareSketch, packageELF } from "../src/index.js";
import { verifyFixtures } from "./verify-fixtures.mjs";
import { verifyRecipe } from "./verify-recipe.mjs";
import { fuzz } from "./fuzz.mjs";
import { fuzzELF } from "./fuzz-elf.mjs";
import { createNodeCompiler, createNodePackager, localResources } from "./node-runtime.mjs";
import { verifyVendor } from "./verify-vendor.mjs";
import { readBounded } from "./bounded-file.mjs";
export { readBounded } from "./bounded-file.mjs";
import { startWebHarness } from "./web-server.mjs";
import { webChecks } from "./web-checks.mjs";
import { exportWeb } from "./export-web.mjs";
import { boundService } from "./bound-service.mjs";
import { auditService } from "./audit-service.mjs";
import { importResident } from "./import-resident.mjs";
import { checkBuiltService } from "./test-built-service.mjs";
import { verifyServiceMaterials } from "./verify-service-materials.mjs";
import { SERVICE } from "../runtime/pins.js";
import { builtWebChecks, builtWebUnavailable, builtWebKitChecks } from "./built-web-checks.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const pin = readFileSync(new URL("../.node-version", import.meta.url), "utf8").trim();

function run(argumentsList, options = {}) {
  const result = spawnSync(process.execPath, argumentsList, { cwd: root, stdio: "inherit", timeout: 60000, ...options });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(result.error?.message || `Check failed: ${argumentsList.join(" ")} (${result.signal || result.status})`);
  }
}

const decode = bytes => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);

/** Creates only an explicit new directory, and marks completion after all bounded files were written. */
function writeOutput(path, files, summary) {
  mkdirSync(path);
  for (const [name, bytes] of Object.entries(files)) writeFileSync(join(path, name), bytes, { flag: "wx" });
  writeFileSync(join(path, "operation.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(summary));
}

/** Development entry point only; no native subprocess dependency exists in src/. */
async function main() {
  const [command, ...argumentsList] = process.argv.slice(2);
  if (!command || command === "--help" || argumentsList.includes("--help")) {
    console.log("Usage: node tools/dev.mjs doctor|test|check|fuzz|fuzz-elf\n"
      + "  validate-request <request.json>\n  prepare-request <request.json> <new-output-directory>\n"
      + "  package-elf <request.json> <linked.elf> <provenance.json> <new-output-directory>\n"
      + "  build <request.json> <pinned-service.wasm> <new-output-directory>\n"
      + "  test-runtime [pinned-service.wasm] (explicit skip when absent)\n"
      + "  export-web <new-output-directory>\n"
      + "  bound-service <pinned-original.wasm> <new-development-directory>\n"
      + "  test-memory [pinned-original.wasm] (explicit skip when absent)\n"
      + "  package-declared request.json module.elf output-directory\n"
      + "  audit-service reference-root llvm-source original-receipt.json original-service.wasm new-output-directory\n"
      + "  import-resident explicit-export-directory trusted-manifest-sha256 new-output-directory\n"
      + "  service-build capture|configure|build|compare ... (optional pinned Python maintenance host)\n"
      + "  test-service-build (owned synthetic sources/tools; no actual LLVM compilation)\n"
      + "  runtime-build capture|build|compare ... (owned WASI Preview 1 source builds)\n"
      + "  test-runtime-build (bounded source archives and runtime receipt checks)\n"
      + "  test-built-service explicit-built.wasm trusted-module-sha256 resident-descriptor.json new-output-directory\n"
      + "  test-built-web [built.wasm trusted-sha256 descriptor.json new-output-directory [--browser chromium-path]]\n"
      + "  test-built-webkit built.wasm trusted-sha256 descriptor.json explicit-native-host new-output-directory\n"
      + "  serve-web [pinned-service.wasm]\n  test-web [pinned-service.wasm] [--browser chromium-path]\n"
      + "No device access. WASM build requires an explicitly provisioned pinned local service; none is bundled.\n"
      + `Pinned development Node: ${pin}; no external dependencies or installation required.`);
    return;
  }
  if (process.versions.node !== pin) throw new Error(`Use Node ${pin}; found ${process.versions.node}. See docs/development.md.`);
  if (command === "test-built-webkit") {
    if (argumentsList.length !== 5) throw new Error("Select explicit candidate, anchor, descriptor, native host executable and new output");
    await builtWebKitChecks(...argumentsList); return;
  }
  if (command === "test-built-web") {
    if (!argumentsList.length) { builtWebUnavailable(); return; }
    if (argumentsList.length !== 4 && !(argumentsList.length === 6 && argumentsList[4] === "--browser")) throw new Error("Select explicit candidate, anchor, descriptor, new output and optional --browser path");
    await builtWebChecks(...argumentsList.slice(0, 4), argumentsList[5]); return;
  }
  if (command === "test-built-service") {
    if (argumentsList.length !== 4) throw new Error("Select explicit built service, reviewed module SHA-256, resident descriptor and new output directory");
    const result = await checkBuiltService(resolve(argumentsList[0]), argumentsList[1], resolve(argumentsList[2]), resolve(argumentsList[3]));
    console.log(JSON.stringify({ status: "checked_owned_development_service_execution", builds: result.builds.length,
      errorsRejected: result.errorChecks.length, serviceSHA256: result.serviceSHA256, hardwareExecuted: false }));
    return;
  }
  if (["service-build", "test-service-build", "runtime-build", "test-runtime-build"].includes(command)) {
    const test = command.startsWith("test-");
    if (test && argumentsList.length) throw new Error(`${command} takes no arguments`);
    const python = process.env.FIRMINGO_SERVICE_BUILD_PYTHON || "python3";
    const stem = command.includes("runtime") ? "runtime_build" : "service_build";
    const result = spawnSync(python, ["-I", "-S", "-B", test ? `tests/maintenance/test_${stem}.py` : `tools/${stem}.py`, ...argumentsList],
    { cwd: root, stdio: "inherit", timeout: test ? 60000 : 3 * 60 * 60 * 1000 });
    if (result.error || result.signal || result.status !== 0) throw new Error("Service maintenance failed; use the documented explicit Python host and retained phase logs");
    return;
  }
  if (command === "validate-request") {
    if (argumentsList.length !== 1) throw new Error("validate-request requires one explicit JSON file");
    const path = resolve(argumentsList[0]);
    const request = parseBuildRequest(decode(readBounded(path)));
    console.log(JSON.stringify({ status: "valid_input_only", buildID: request.buildID, requestSHA256: await requestIdentity(request) }));
    return;
  }
  if (command === "prepare-request") {
    if (argumentsList.length !== 2) throw new Error("prepare-request requires explicit input and a new output directory");
    const prepared = await prepareSketch(parseBuildRequest(decode(readBounded(resolve(argumentsList[0])))));
    const summary = { status: "prepared_source_only", buildID: prepared.request.buildID, sourceSHA256: prepared.sourceSHA256,
      translationUnitSHA256: prepared.translationUnitSHA256, requestSHA256: prepared.requestSHA256, sourceLineCount: prepared.sourceLineCount };
    writeOutput(resolve(argumentsList[1]), { "Sketch.cpp": prepared.translationUnit,
      "preparation.json": JSON.stringify({ ...summary, sourceBOMBytes: prepared.sourceBOMBytes }, null, 2) + "\n" }, summary);
    return;
  }
  if (command === "bound-service") {
    if (argumentsList.length !== 2) throw new Error("bound-service requires an explicit original service and new development directory");
    const receipt = boundService(argumentsList[0], argumentsList[1]);
    console.log(JSON.stringify({ status: "development_service_memory_bounded", bytes: receipt.derived.bytes,
      sha256: receipt.derived.sha256, maximumMemoryBytes: receipt.maximumMemoryBytes, distribution: "unresolved" }));
    return;
  }
  if (command === "export-web") { if (argumentsList.length !== 1) throw new Error("export-web requires a new explicit output directory"); await exportWeb(resolve(argumentsList[0])); return; }
  if (command === "serve-web" || command === "test-web") {
    let servicePath, browserPath;
    for (let index = 0; index < argumentsList.length; index++) {
      const argument = argumentsList[index];
      if (argument === "--browser" && command === "test-web" && !browserPath && argumentsList[index + 1]) browserPath = argumentsList[++index];
      else if (!argument.startsWith("-") && !servicePath) servicePath = resolve(argument);
      else throw new Error("Select at most one explicit service and one --browser path");
    }
    if (command === "test-web") { await webChecks({ servicePath, browserPath }); return; }
    const host = await startWebHarness({ servicePath });
    console.log(JSON.stringify({ status: "loopback_harness_ready", url: host.origin, serviceAvailable: host.serviceAvailable,
      qualification: "developer harness; synthetic sample NEVER DEPLOY" }));
    await new Promise(resolve => {
      const stop = () => { process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); void host.close().then(resolve); };
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
    });
    return;
  }
  if (command === "test-memory") {
    if (argumentsList.length > 1) throw new Error("test-memory takes at most one explicit original service path");
    run(["--test", "tests/bound-service.test.mjs"], { env: { ...process.env,
      FIRMINGO_COMPILER_ORIGINAL_SERVICE: argumentsList[0] ? resolve(argumentsList[0]) : "" } });
    return;
  }
  if (command === "test-runtime") {
    if (argumentsList.length > 1) throw new Error("test-runtime takes at most one explicit service path");
    verifyVendor(); await verifyRecipe();
    run(["--test", "tests/real-runtime.test.mjs"], { timeout: 180000,
      env: { ...process.env, FIRMINGO_COMPILER_SERVICE: argumentsList[0] ? resolve(argumentsList[0]) : "" } });
    return;
  }
  if (command === "build") {
    if (argumentsList.length !== 3) throw new Error("build requires an explicit request, pinned local service and new output directory");
    const request = parseBuildRequest(decode(readBounded(resolve(argumentsList[0]))));
    verifyVendor({ quiet: true });
    const resources = localResources(readBounded(resolve(argumentsList[1]), SERVICE.bytes));
    const controller = createNodeCompiler(), cancellation = new AbortController();
    const interrupt = () => cancellation.abort(); process.once("SIGINT", interrupt);
    let artifact;
    try { artifact = await controller.build(request, resources, { signal: cancellation.signal, onEvent: event => {
      if (event.kind === "progress") console.error(JSON.stringify(event));
    } }); } finally { process.removeListener("SIGINT", interrupt); }
    writeOutput(resolve(argumentsList[2]), { [artifact.filename]: artifact.bytes, "Sketch.elf": artifact.linkedELF,
      "report.json": artifact.reportJSON + "\n", "receipt.json": JSON.stringify(artifact.receipt, null, 2) + "\n",
      "diagnostics.json": JSON.stringify(artifact.diagnostics, null, 2) + "\n",
      "runtime.json": JSON.stringify({ timings: artifact.timings, memoryBytes: artifact.memoryBytes }, null, 2) + "\n" },
    { status: "wasm_compiled_linked_packaged", buildID: request.buildID, capsuleSHA256: artifact.sha256,
      capsuleBytes: artifact.bytes.length, provenanceStatus: "pinned_assets_executed" });
    return;
  }
  if (command === "package-elf") {
    if (argumentsList.length !== 4) throw new Error("package-elf requires explicit request, ELF, provenance and a new output directory");
    const request = parseBuildRequest(decode(readBounded(resolve(argumentsList[0]))));
    const bytes = readBounded(resolve(argumentsList[1]), 2 * 1024 * 1024);
    const provenance = parseContractJSON(decode(readBounded(resolve(argumentsList[2]), 4096)));
    const artifact = await packageELF(bytes, request, provenance);
    writeOutput(resolve(argumentsList[3]), { [artifact.filename]: artifact.bytes, "report.json": artifact.reportJSON + "\n",
      "receipt.json": JSON.stringify(artifact.receipt, null, 2) + "\n" },
    { status: "packaged_independent_elf", buildID: request.buildID, capsuleSHA256: artifact.sha256,
      capsuleBytes: artifact.bytes.length, provenanceStatus: "declared" });
    return;
  }
  if (command === "import-resident") {
    if (argumentsList.length !== 3) throw new Error("Select an explicit resident export, independently trusted manifest SHA-256 and new output directory");
    const result = await importResident(argumentsList[0], argumentsList[1]);
    writeOutput(resolve(argumentsList[2]), { "descriptor.json": JSON.stringify(result.descriptor, null, 2) + "\n",
      "catalogue.json": JSON.stringify(result.catalogue, null, 2) + "\n", "import-receipt.json": JSON.stringify(result.receipt, null, 2) + "\n" },
      { status: "imported_experimental_resident_metadata", firmwareBuildID: result.receipt.firmwareBuildID, imagesCopied: false,
        apiAddress: result.descriptor.apiAddress, defaultCatalogueChanged: false });
    return;
  }
  if (command === "audit-service") {
    if (argumentsList.length !== 5) throw new Error("Select explicit reference/LLVM roots, original receipt/service and a new output directory");
    const audit = auditService(...argumentsList.slice(0, 4));
    writeOutput(resolve(argumentsList[4]), { "audit.json": JSON.stringify(audit, null, 2) + "\n" },
      { status: "audited_service_provenance_unresolved", moduleSHA256: audit.module.sha256, sourceFiles: audit.sourceFiles.length,
        patchedLLVMFiles: audit.patchedLLVMFiles.length, distributionStatus: "unresolved", serviceExecuted: false });
    return;
  }
  if (command === "package-declared") {
    if (argumentsList.length !== 3) throw new Error("Select declared request JSON, supplied ELF and a new output directory");
    const request = parseDeclaredPackagingRequest(decode(readBounded(resolve(argumentsList[0]), LIMITS.jsonBytes)));
    const artifact = await createNodePackager().package(new Uint8Array(readBounded(resolve(argumentsList[1]), 2 * 1024 * 1024)), request);
    writeOutput(resolve(argumentsList[2]), { [artifact.filename]: artifact.bytes, "report.json": artifact.reportJSON + "\n",
      "receipt.json": JSON.stringify(artifact.receipt, null, 2) + "\n" },
      { status: "packaged_declared_independent_elf", buildID: request.buildID, capsuleSHA256: artifact.sha256,
        capsuleBytes: artifact.bytes.length, provenanceStatus: "declared" });
    return;
  }
  if (argumentsList.length !== 0) throw new Error("Unexpected development command arguments");
  if (command === "doctor") {
    console.log(`Node ${pin}; portable preparation/ELF/capsule modules and node:test available; no external dependencies`);
    console.log("Isolated WASI compiler runtime implemented; no service bundled; recorded Chrome/HTTP-loopback evidence available; macOS SDK adapter evidenced; signed/physical Apple hosts and hardware unqualified");
  } else if (command === "test") {
    verifyServiceMaterials();
    verifyFixtures();
    verifyVendor();
    await verifyRecipe();
    const files = readdirSync(new URL("../tests/", import.meta.url)).filter(name => name.endsWith(".test.mjs") && name !== "real-runtime.test.mjs");
    run(["--test", ...files.map(name => `tests/${name}`)]);
  } else if (command === "fuzz") fuzz();
  else if (command === "fuzz-elf") fuzzELF();
  else if (command === "check") {
    verifyServiceMaterials();
    for (const directory of ["src", "runtime", "tools", "tests", "web", "third_party/browser_wasi_shim/dist"]) {
      for (const file of readdirSync(resolve(root, directory)).filter(name => /\.(js|mjs)$/.test(name))) {
        run(["--check", `${directory}/${file}`]);
      }
    }
    verifyFixtures();
    verifyVendor();
    await verifyRecipe();
    console.log("JavaScript syntax and fixture checks passed");
  } else throw new Error("Unknown command; use --help");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try { await main(); }
catch (error) {
  console.error(`${error.code || "failed"}${error.path ? " " + error.path : ""}: ${error.message}`);
  for (const item of error.diagnostics || []) console.error(`${item.filename}:${item.line}:${item.column}: ${item.code}: ${item.message}`);
  process.exitCode = 1;
}

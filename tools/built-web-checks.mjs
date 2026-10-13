import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBounded } from "./bounded-file.mjs";
import { harnessResources, startHarnessRoutes } from "./web-server.mjs";
import { checkWebServer } from "./web-server-check.mjs";
import { findChromium, runChromiumChecks } from "./chromium-runner.mjs";
import { canonicalJSON, sha256 } from "../src/hash.js";
import { validateFirmwareBuildDescriptor } from "../src/contract.js";
import { parseContractJSON } from "../src/json.js";
import { requireBoundedMemory } from "../runtime/ModuleMemory.js";
import { validateCapsule } from "../src/capsule.js";
import { parseELF } from "../src/elf.js";
import { BUILT_WEB_CASES } from "../web/built-service-checks.js";
import { SERVICE } from "../runtime/pins.js";

const root = new URL("../", import.meta.url);
/** Anchors an explicit development asset before listening; neither public pins nor SDK resources are rewritten. */
export async function builtHarnessResources(modulePath, expectedSHA256, descriptorPath) {
  if (!/^[0-9a-f]{64}$/.test(expectedSHA256) || expectedSHA256 === SERVICE.sha256)
    throw new Error("Select an independently reviewed unpromoted service SHA-256; standard pins use test-web");
  const bytes = readBounded(modulePath, 128 * 1024 * 1024);
  if (await sha256(bytes) !== expectedSHA256) throw new Error("Built service anchor mismatch");
  requireBoundedMemory(bytes);
  const descriptor = validateFirmwareBuildDescriptor(parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(readBounded(descriptorPath, 16384))));
  const routes = await harnessResources();
  const files = ["built-service-page.js", "built-service-checks.js", "built-service-worker.js", "built-service-controller.js", "service-execution.js"];
  for (const name of files) routes.set("/web/" + name, { bytes: readBounded(fileURLToPath(new URL("web/" + name, root)), 65536), type: "text/javascript; charset=utf-8" });
  routes.set("/", { bytes: readBounded(fileURLToPath(new URL("web/built-service.html", root)), 4096), type: "text/html; charset=utf-8" });
  const identity = { bytes: bytes.length, sha256: expectedSHA256 };
  routes.set("/candidate-service.wasm", { bytes, type: "application/wasm" });
  routes.set("/candidate-config.json", { bytes: new TextEncoder().encode(JSON.stringify({ schema: 1, identity, descriptor,
    qualification: "explicit owned development asset; no device execution or distribution approval" })), type: "application/json; charset=utf-8" });
  return { routes, identity, descriptor };
}

/** Starts only the exact reviewed routes on an ephemeral IPv4 loopback port. */
export async function startBuiltWebHarness(modulePath, expectedSHA256, descriptorPath) {
  const { routes, identity, descriptor } = await builtHarnessResources(modulePath, expectedSHA256, descriptorPath);
  const host = await startHarnessRoutes(routes);
  return { ...host, get requests() { return host.requests; }, identity, descriptor };
}

/** Revalidates browser-returned bounded bytes before writing any microcontroller artifact. */
export async function saveBuiltWebReport(report, output, identity, descriptor) {
  if (existsSync(output)) throw new Error("Select a new browser output directory");
  if (report.schema !== 1 || report.operation !== "owned_service_web_checks" || report.failed !== 0 || report.passed !== 9 || report.skipped !== 0
      || report.serviceIdentity?.sha256 !== identity.sha256 || report.serviceIdentity?.bytes !== identity.bytes
      || report.artifacts?.length !== 2 || report.consumerPinsChanged !== false || report.hardwareExecuted !== false)
    throw new Error("Browser omitted successful correlated development checks");
  if (canonicalJSON(validateFirmwareBuildDescriptor(report.descriptor)) !== canonicalJSON(descriptor)
      || report.cases?.length !== 9 || new Set(report.cases.map(item => item.name)).size !== 9
      || report.cases.some((item, index) => item.outcome !== "passed" || item.name !== BUILT_WEB_CASES[index][0] || item.actualCompiler !== BUILT_WEB_CASES[index][1])
      || report.cases.filter(item => item.actualCompiler).length !== 4 || report.actualCompilerPasses !== 4)
    throw new Error("Browser changed the resident binding or omitted observed cases");
  const files = [];
  const names = new Set();
  for (const artifact of report.artifacts) {
    if (!["gpio", "console"].includes(artifact.name) || names.has(artifact.name)) throw new Error("Unexpected browser artifact name");
    names.add(artifact.name);
    const decoded = {};
    for (const [role, maximum, hash] of [["capsule", 4096, artifact.capsuleSHA256], ["elf", 8192, artifact.linkedELFSHA256]]) {
      const encoded = artifact[role + "Base64"];
      if (typeof encoded !== "string" || encoded.length > Math.ceil(maximum / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
        throw new Error("Invalid bounded browser artifact bytes");
      const bytes = Buffer.from(encoded, "base64");
      if (!bytes.length || bytes.length > maximum || bytes.toString("base64") !== encoded || await sha256(bytes) !== hash)
        throw new Error("Browser artifact digest mismatch");
      decoded[role] = bytes;
      files.push([artifact.name + (role === "elf" ? ".elf" : ".fms"), bytes]);
    }
    const capsule = await validateCapsule(decoded.capsule, descriptor), elf = parseELF(decoded.elf);
    if (elf.setupAddress !== capsule.setupAddress || elf.loopAddress !== capsule.loopAddress
        || await sha256(elf.code) !== capsule.codeSHA256 || artifact.capsuleBytes !== decoded.capsule.length)
      throw new Error("Browser ELF and capsule disagree");
  }
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (Buffer.byteLength(serialized) > 2 * 1024 * 1024) throw new Error("Browser report exceeds byte bounds");
  mkdirSync(output);
  for (const [name, bytes] of files) writeFileSync(join(output, name), bytes, { flag: "wx" });
  writeFileSync(join(output, "operation.json"), serialized, { flag: "wx" });
}

/** No candidate provided in normal CI means an explicit availability skip, never compiler success. */
export function builtWebUnavailable() {
  const report = { schema: 1, status: "skipped", passed: 0, failed: 0, skipped: 9, actualCompilerPasses: 0,
    reason: "No explicitly anchored owned service provided; no asset fetched or distributed" };
  const directory = fileURLToPath(new URL("../.build/logs/", import.meta.url)); mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "built-web-absent.json"), JSON.stringify(report, null, 2) + "\n"); console.log(JSON.stringify(report));
}

/** Runs maintained-source checks with an isolated Chrome profile; preserves a failing report without publishing artifacts. */
export async function builtWebChecks(modulePath, expectedSHA256, descriptorPath, output, browserPath) {
  if (existsSync(output)) throw new Error("Select a new browser output directory");
  const browser = findChromium(browserPath);
  if (!browser) throw new Error("Provision Chromium explicitly; candidate checks cannot pass without a browser");
  const host = await startBuiltWebHarness(modulePath, expectedSHA256, descriptorPath);
  try {
    await checkWebServer(host);
    const report = await runChromiumChecks(browser, host, { builtService: true });
    if (report.failed || report.externalRequests.length || report.protocolFaults.length) {
      const logs = fileURLToPath(new URL("../.build/logs/", import.meta.url)); mkdirSync(logs, { recursive: true });
      writeFileSync(join(logs, "built-web-failure.json"), JSON.stringify(report, null, 2) + "\n");
      throw new Error("Owned browser checks failed; see .build/logs/built-web-failure.json");
    }
    await saveBuiltWebReport(report, resolve(output), host.identity, host.descriptor);
    console.log(JSON.stringify({ status: "owned_browser_checks_completed", passed: report.passed, actualCompilerPasses: report.actualCompilerPasses,
      browser: report.browser.product, serviceSHA256: expectedSHA256, hardwareExecuted: false }));
    return report;
  } finally { await host.close(); }
}

/** Runs an explicitly provisioned native host; its executable is never a consumer dependency or implicitly found in a sibling checkout. */
export async function builtWebKitChecks(modulePath, expectedSHA256, descriptorPath, executable, output) {
  if (existsSync(output)) throw new Error("Select a new browser output directory");
  const profiles = fileURLToPath(new URL("../.build/web-profiles/", import.meta.url));
  mkdirSync(profiles, { recursive: true });
  let privateDirectory;
  let diagnostics = "";
  const logs = fileURLToPath(new URL("../.build/logs/", import.meta.url)); mkdirSync(logs, { recursive: true });
  const host = await startBuiltWebHarness(modulePath, expectedSHA256, descriptorPath);
  try {
    privateDirectory = mkdtempSync(join(profiles, "webkit-"));
    const reportPath = join(privateDirectory, "report.json");
    await checkWebServer(host);
    await new Promise((done, reject) => {
      const child = spawn(resolve(executable), [host.origin + "/", reportPath], { stdio: ["ignore", "pipe", "pipe"] });
      let failure;
      const stop = () => { failure = new Error("WebKit maintenance interrupted"); child.kill("SIGKILL"); };
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
      const timer = setTimeout(() => { failure = new Error("Native WebKit host deadline exceeded"); child.kill("SIGKILL"); }, 145000);
      const capture = bytes => { diagnostics = (diagnostics + bytes.toString()).slice(-65536);
        writeFileSync(join(logs, "built-webkit-progress.log"), diagnostics); };
      child.stdout.on("data", capture); child.stderr.on("data", capture);
      const cleanup = () => { clearTimeout(timer); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); };
      child.once("error", error => { cleanup(); reject(error); });
      child.once("close", (code, signal) => { cleanup(); code === 0 && !failure ? done() : reject(failure || new Error(`Native WebKit host failed (${signal || code}): ${diagnostics}`)); });
    });
    const report = parseContractJSON(new TextDecoder("utf-8", { fatal: true }).decode(readBounded(reportPath, 65536)));
    report.hostRequests = host.requests;
    await saveBuiltWebReport(report, resolve(output), host.identity, host.descriptor);
    writeFileSync(join(resolve(output), "native-host.log"), diagnostics, { flag: "wx" });
    console.log(JSON.stringify({ status: "owned_webkit_checks_completed", passed: report.passed, actualCompilerPasses: report.actualCompilerPasses,
      browser: report.userAgent, serviceSHA256: expectedSHA256, hardwareExecuted: false }));
    return report;
  } catch (error) {
    const logs = fileURLToPath(new URL("../.build/logs/", import.meta.url)); mkdirSync(logs, { recursive: true });
    writeFileSync(join(logs, "built-webkit-requests.json"), JSON.stringify(host.requests, null, 2));
    writeFileSync(join(logs, "built-webkit-failure.log"), (String(error) + "\n" + diagnostics).slice(-65536));
    throw error;
  } finally {
    try { await host.close(); } finally { if (privateDirectory) rmSync(privateDirectory, { recursive: true }); }
  }
}

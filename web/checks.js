import { PreparationController, PackagingController, CompilerController, parseBuildRequest, prepareSketch, validateCapsule, validateRuntimeEvent, serializeRuntimeEvent, parseRuntimeEvent } from "/src/index.js";
import { canonicalJSON, sha256 } from "/src/hash.js";
import { SERVICE } from "/runtime/pins.js";
import { fetchBytes, loadRecipe } from "./harness.js";

function assert(value, message) { if (!value) throw new Error(message); }
async function rejects(operation, code) {
  try { await operation(); } catch (error) { assert(error.code === code, `Expected ${code}; observed ${error.code || error.name}: ${error.message}`); return error; }
  throw new Error(`Expected rejection: ${code}`);
}
function checkEvents(events, outcome) {
  events.forEach((event, index) => { validateRuntimeEvent(event); assert(event.sequence === index + 1, "Event sequence mismatch"); });
  assert(events.filter(event => event.kind === "result").length === 1 && events.at(-1).outcome === outcome, "Expected one correlated terminal outcome");
}

/** Runs actual standard-browser modules/workers; missing service yields explicit skips, no fake compile success. */
export async function runWebChecks({ serviceAvailable, onCase = () => {} } = {}) {
  const cases = [], artifacts = [], controller = new CompilerController();
  const baseline = parseBuildRequest(new TextDecoder("utf-8", { fatal: true }).decode(await fetchBytes("/fixture-request.json", 16384)));
  const recipe = await loadRecipe();
  const resources = { ...recipe, serviceBytes: serviceAvailable ? await fetchBytes("/development-service.wasm", SERVICE.bytes) : null };
  const request = (id, source = "void setup() {}\nvoid loop() {}", filename = "Sketch.ino") => ({ ...baseline, buildID: id,
    source: { filename, revision: id + ":revision", text: source } });
  const run = async (name, operation, actualCompiler = false) => {
    const start = performance.now();
    let result;
    if (actualCompiler && !serviceAvailable) result = { name, outcome: "skipped", reason: "Explicit pinned local compiler service unavailable", actualCompiler };
    else try { await operation(); result = { name, outcome: "passed", actualCompiler, milliseconds: performance.now() - start }; }
    catch (error) { result = { name, outcome: "failed", actualCompiler, code: error.code || "check_failed", message: error.message }; }
    cases.push(result); onCase(result);
  };
  const build = async (input, options = {}) => {
    const artifact = await controller.build(input, resources, options);
    assert(artifact.receipt.provenanceStatus === "pinned_assets_executed", "Missing execution receipt");
    assert(artifact.receipt.buildID === input.buildID && artifact.receipt.sourceRevision === input.source.revision, "Receipt input correlation mismatch");
    assert(await sha256(artifact.bytes) === artifact.sha256, "Returned capsule digest mismatch");
    assert((await validateCapsule(artifact.bytes, input.target.firmwareBuild)).capsuleSHA256 === artifact.sha256, "Independent capsule validation mismatch");
    artifacts.push({ buildID: input.buildID, sourceFilename: input.source.filename, sourceSHA256: artifact.receipt.sourceSHA256,
      requestSHA256: artifact.receipt.requestSHA256, capsuleBytes: artifact.bytes.length, capsuleSHA256: artifact.sha256,
      linkedELFSHA256: artifact.receipt.linkedELFSHA256, memoryBytes: artifact.memoryBytes });
    return artifact;
  };
  await run("secure context and isolated service-free preparation/declared-packaging workers", async () => {
    assert(isSecureContext && crypto.subtle && typeof Worker === "function", "Missing secure-context web worker primitives");
    const preparation = new PreparationController();
    const prepared = await preparation.prepare(request("web-prepare"));
    assert(canonicalJSON(prepared) === canonicalJSON(await prepareSketch(request("web-prepare"))), "Worker preparation differs from portable core");
    assert(prepared.translationUnit.startsWith('#include <Arduino.h>\n#line 1 "Sketch.ino"\n'), "Preparation mismatch");
    await rejects(() => preparation.prepare(request("web-library", "#include <Wire.h>\nvoid setup() {} void loop() {}")), "unsupported_source");
    const cancellation = new AbortController(), pending = preparation.prepare(request("web-prepare-cancel"), { signal: cancellation.signal });
    await rejects(() => preparation.prepare(request("web-prepare-busy")), "busy");
    cancellation.abort(); await rejects(() => pending, "cancelled");
    await rejects(() => preparation.prepare({ ...request("web-prepare-deadline"), options: { deadlineMilliseconds: 1 } }), "timed_out");
    assert(await preparation.prepare(request("web-prepare-fresh")), "Preparation did not recover after termination");
    const packaging = new PackagingController();
    const declared = { compiler: "non-executable independent parser fixture", recipeIdentifier: "independent-test-v1",
      recipeSHA256: "4".repeat(64), toolchainSHA256: "5".repeat(64) };
    const input = { ...request("web-package"), kind: "package_elf", provenance: declared,
      target: { ...baseline.target, recipeIdentifier: declared.recipeIdentifier, recipeSHA256: declared.recipeSHA256,
        firmwareBuild: { ...baseline.target.firmwareBuild, recipeIdentifier: declared.recipeIdentifier, recipeSHA256: declared.recipeSHA256 } } };
    const hex = new TextDecoder().decode(await fetchBytes("/fixture-elf.hex", 4096));
    const elf = Uint8Array.from(hex.trim().split(/\s+/), pair => parseInt(pair, 16));
    const packaged = await packaging.package(elf, input);
    assert(packaged.sha256 === "ef8bff817d9b80026f6eaeac33d1c40fac2f41b046865de967d3c0cf2539d52a", "Independent firmware capsule differs");
    assert(packaged.receipt.receiptSchema === "firmingo-compiler-declared-packaging-v1" && packaged.receipt.provenanceStatus === "declared", "Declared provenance was replaced");
    assert(packaged.receipt.provenance.recipeIdentifier === declared.recipeIdentifier, "Declared recipe was replaced");
    await rejects(() => packaging.package(new Uint8Array(712), input), "invalid_elf");
    const abort = new AbortController(), pendingPackage = packaging.package(elf, input, { signal: abort.signal });
    await rejects(() => packaging.package(elf, input), "busy"); abort.abort(); await rejects(() => pendingPackage, "cancelled");
    await rejects(() => packaging.package(elf, { ...input, options: { deadlineMilliseconds: 1 } }), "timed_out");
    assert((await packaging.package(elf, input)).sha256 === packaged.sha256, "Packaging did not recover after termination");
  });
  await run("actual default module worker rejects an unpinned service before compiler execution", async () => {
    const events = [];
    await rejects(() => controller.build(request("web-unpinned"), { ...recipe, serviceBytes: new Uint8Array(SERVICE.bytes) }, { onEvent: event => events.push(event) }), "invalid_service");
    checkEvents(events, "failed"); assert(events[0].phase === "verifying", "Module worker did not start");
    assert(!events.some(event => event.phase === "compiling"), "Corrupt service reached the compiler");
  });
  await run("real two-sketch compilation, byte reproducibility, immutable output and event codec", async () => {
    const events = [];
    const input = request("web-a", "void setup() { pinMode(6, 1); }\nvoid loop() { digitalWrite(6, 1); delay(10); }", "A.ino");
    const first = await build(input, { onEvent: event => events.push(event) }), repeat = await build(input);
    const second = await build(request("web-b", 'void setup() { Serial.println("ready"); }\nvoid loop() { int c = Serial.read(); if (c >= 0) Serial.write(uint8_t(c)); }', "B.ino"));
    assert(first.sha256 === repeat.sha256 && canonicalJSON(first.receipt) === canonicalJSON(repeat.receipt), "Repeated browser build differed");
    assert(first.sha256 === "a23bc8cc24d960dc60283e3d5dc9bd80d61a7d8c6cbe0f08f5248bc14848231a", "Sketch A differs from independently validated Node output");
    assert(second.sha256 === "ba26c3a28700b8ae177eb05c81434e35c16d8f6306bf5e9822f8c85adf6ea063", "Sketch B differs from independently validated Node output");
    const bytes = first.bytes; bytes[bytes.length - 1] ^= 1; assert(await sha256(first.bytes) === first.sha256, "Caller mutated retained output");
    checkEvents(events, "succeeded");
    const decoded = parseRuntimeEvent(serializeRuntimeEvent(events.at(-1)));
    assert(canonicalJSON(decoded.artifact.receipt) === canonicalJSON(first.receipt), "Serialized receipt changed");
    assert(await sha256(decoded.artifact.bytes) === first.sha256, "Serialized bytes changed");
  }, true);
  await run("real frontend diagnostics and original BOM byte columns, then fresh build", async () => {
    const events = [];
    const error = await rejects(() => controller.build(request("web-frontend", "\ufeffvoid setup() { missingFunction(); }\nvoid loop() {}"), resources,
      { onEvent: event => events.push(event) }), "compile_failed");
    const diagnostic = error.diagnostics.find(item => item.severity === "error");
    assert(diagnostic?.filename === "Sketch.ino" && diagnostic.line === 1 && diagnostic.column === 19, "Original source diagnostic mismatch");
    checkEvents(events, "failed"); assert(!events.some(event => event.phase === "linking"), "Frontend failure proceeded to link");
    await build(request("web-after-frontend"));
  }, true);
  await run("real linker rejects mutable state and unavailable runtime helpers", async () => {
    for (const [source, text] of [["volatile int x; void setup() { x = 1; } void loop() { ++x; }", "mutable storage"],
      ["void setup() {} void loop() { digitalWrite(6, millis() / 250); }", "__aeabi_uidiv"]]) {
      const error = await rejects(() => controller.build(request("web-link-error", source), resources), "link_failed");
      assert(error.diagnostics.some(item => item.severity === "error" && item.message.includes(text)), "Missing linker diagnostic");
    }
    await build(request("web-after-link"));
  }, true);
  await run("real compile cancellation, busy/stale rejection and fresh worker", async () => {
    const events = [];
    const pending = controller.build(request("web-cancel"), resources, { onEvent: event => {
      events.push(event);
      if (event.kind === "progress" && event.phase === "compiling") controller.cancel({ interfaceVersion: 1, kind: "cancel", buildID: "web-cancel" });
    } });
    assert(!controller.cancel({ interfaceVersion: 1, kind: "cancel", buildID: "stale" }), "Stale cancellation affected build");
    await rejects(() => controller.build(request("web-busy"), resources), "busy");
    await rejects(() => pending, "cancelled"); checkEvents(events, "cancelled");
    await build(request("web-after-cancel"));
  }, true);
  await run("real startup deadline, no late artifact and fresh build", async () => {
    const events = [];
    await rejects(() => controller.build({ ...request("web-deadline"), options: { deadlineMilliseconds: 1 } }, resources,
      { onEvent: event => events.push(event) }), "timed_out");
    checkEvents(events, "timed_out"); await build(request("web-after-deadline"));
    checkEvents(events, "timed_out");
  }, true);
  await run("real resource-integrity rejection and clean subsequent build", async () => {
    const service = resources.serviceBytes.slice(); service[service.length - 1] ^= 1;
    await rejects(() => controller.build(request("web-corrupt-service"), { ...resources, serviceBytes: service }), "invalid_service");
    const header = recipe.recipeAssets["Recipe/Arduino.h"].slice(); header[0] ^= 1;
    await rejects(() => controller.build(request("web-corrupt-recipe"), { ...resources,
      recipeAssets: { ...recipe.recipeAssets, "Recipe/Arduino.h": header } }), "invalid_recipe");
    await build(request("web-after-corrupt"));
  }, true);
  await run("application CSP prevents external resource access", async () => {
    let listener, timer;
    const policy = new Promise((resolve, reject) => {
      listener = event => { if (event.violatedDirective.startsWith("connect-src")) { clearTimeout(timer); resolve(); } };
      addEventListener("securitypolicyviolation", listener);
      timer = setTimeout(() => reject(new Error("Expected bounded CSP policy event")), 1000);
    });
    try {
      let denied = false;
      try { await fetch("https://firmingo.invalid/blocked-probe"); } catch { denied = true; }
      await policy; assert(denied, "External request did not reject");
    } finally { clearTimeout(timer); removeEventListener("securitypolicyviolation", listener); }
  });
  return { schema: 1, host: "standard browser module workers", qualification: "synthetic resident metadata NEVER DEPLOY", serviceAvailable: Boolean(serviceAvailable),
    userAgent: navigator.userAgent, secureContext: isSecureContext, cases, artifacts,
    passed: cases.filter(item => item.outcome === "passed").length, failed: cases.filter(item => item.outcome === "failed").length,
    skipped: cases.filter(item => item.outcome === "skipped").length, actualCompilerPasses: cases.filter(item => item.actualCompiler && item.outcome === "passed").length };
}

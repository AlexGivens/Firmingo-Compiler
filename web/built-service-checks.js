import { BuiltServiceController } from "./built-service-controller.js";
import { fetchBytes, loadRecipe } from "./resource-loading.js";
import { CompilerController } from "../src/index.js";
import { sha256 } from "../src/hash.js";

const check = (value, message) => { if (!value) throw new Error(message); };
const rejects = async (operation, code) => {
  try { await operation(); } catch (error) { check(error.code === code, `Expected ${code}, got ${error.code}: ${error.message}`); return; }
  throw new Error("Expected rejection: " + code);
};
const encode = bytes => btoa(String.fromCharCode(...bytes));

/** Fixed observable maintenance cases; protocol fixtures do not establish their execution. */
export const BUILT_WEB_CASES = Object.freeze([
  Object.freeze(["secure context and standard isolated module-worker primitives", false]),
  Object.freeze(["actual two sketches, three errors, byte repeat and fresh build", true]),
  Object.freeze(["wrong service anchor rejects before compilation", false]),
  Object.freeze(["corrupt recipe rejects before compilation", false]),
  Object.freeze(["busy and cancellation during real compilation", true]),
  Object.freeze(["fresh worker after compile cancellation", true]),
  Object.freeze(["startup deadline terminates before publication", false]),
  Object.freeze(["deadline during real compilation then fresh worker", true]),
  Object.freeze(["production controller retains its pins and external requests are blocked", false]),
]);

/** Real maintained-source checks, never a public SDK pin change or permission to execute returned Thumb code. */
export async function runBuiltWebChecks({ onCase = () => {} } = {}) {
  const config = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await fetchBytes("/candidate-config.json", 16384)));
  const runner = new BuiltServiceController(), cases = [], artifacts = [];
  let reference;
  const run = async (name, actualCompiler, operation) => {
    const started = performance.now();
    try { await operation(); cases.push({ name, outcome: "passed", actualCompiler, milliseconds: performance.now() - started }); }
    catch (error) { cases.push({ name, outcome: "failed", actualCompiler, code: error.code || "check_failed", message: error.message }); }
    onCase(cases.at(-1));
  };
  await run(...BUILT_WEB_CASES[0], async () => {
    check(isSecureContext && crypto.subtle && typeof Worker === "function", "Missing secure-context worker/hash primitives");
  });
  await run(...BUILT_WEB_CASES[1], async () => {
    const result = await runner.run(config); reference = result.builds[0].capsuleSHA256;
    check(result.builds.length === 2 && result.errorChecks.length === 3, "Missing real execution outcomes");
    for (const { elf, capsule, ...fields } of result.builds) {
      check(await sha256(capsule) === fields.capsuleSHA256 && await sha256(elf) === fields.linkedELFSHA256, "Worker artifact hash mismatch");
      artifacts.push({ ...fields, elfBase64: encode(elf), capsuleBase64: encode(capsule) });
    }
  });
  await run(...BUILT_WEB_CASES[2], async () => {
    let compiled = false;
    try { await runner.run({ ...config, identity: { ...config.identity, sha256: "0".repeat(64) } }, { onPhase: () => { compiled = true; } }); }
    catch (error) { check(error.message.includes("digest mismatch") && !compiled, "Untrusted bytes reached compilation"); return; }
    throw new Error("Wrong anchor accepted");
  });
  await run(...BUILT_WEB_CASES[3], async () => {
    let compiled = false;
    await rejects(() => runner.run(config, { corruptRecipe: true, onPhase: () => { compiled = true; } }), "invalid_recipe");
    check(!compiled, "Invalid recipe reached compilation");
  });
  await run(...BUILT_WEB_CASES[4], async () => {
    const abort = new AbortController(); let begin;
    const compiling = new Promise(resolve => { begin = resolve; });
    const pending = runner.run(config, { mode: "gpio", signal: abort.signal, onPhase: phase => { if (phase === "compiling") begin(); } });
    const observed = pending.then(() => ({ succeeded: true }), error => ({ error }));
    await Promise.race([compiling, pending]);
    await rejects(() => runner.run(config, { mode: "gpio" }), "busy");
    abort.abort(); const settled = await observed;
    check(settled.error?.code === "cancelled", "Compile-phase cancellation did not reject");
  });
  await run(...BUILT_WEB_CASES[5], async () => {
    const result = await runner.run(config, { mode: "gpio" });
    check(result.builds[0].capsuleSHA256 === reference, "Fresh cancellation recovery changed bytes");
  });
  await run(...BUILT_WEB_CASES[6], async () => {
    await rejects(() => runner.run(config, { mode: "gpio", timeout: 1 }), "timed_out");
  });
  await run(...BUILT_WEB_CASES[7], async () => {
    let compiled = false;
    await rejects(() => runner.run(config, { mode: "gpio", compilationTimeout: 1,
      onPhase: phase => { if (phase === "compiling") compiled = true; } }), "timed_out");
    check(compiled, "Deadline case never reached real compilation");
    check((await runner.run(config, { mode: "gpio" })).builds[0].capsuleSHA256 === reference, "Fresh deadline recovery changed bytes");
  });
  await run(...BUILT_WEB_CASES[8], async () => {
    const { recipeManifest, recipeAssets } = await loadRecipe();
    const serviceBytes = await fetchBytes("/candidate-service.wasm", config.identity.bytes);
    const request = { interfaceVersion: 1, kind: "build", buildID: "candidate-pin-rejection", source: { filename: "Sketch.ino", revision: "1", text: "void setup() {} void loop() {}" },
      target: { board: config.descriptor.board, profile: config.descriptor.profile, recipeIdentifier: config.descriptor.recipeIdentifier,
        recipeSHA256: config.descriptor.recipeSHA256, firmwareBuild: config.descriptor }, options: { deadlineMilliseconds: 60000 } };
    await rejects(() => new CompilerController().build(request, { recipeManifest, recipeAssets, serviceBytes }), "invalid_service");
    try { await fetch("https://example.invalid/blocked"); } catch { return; }
    throw new Error("External request escaped policy");
  });
  return { schema: 1, operation: "owned_service_web_checks", cases, artifacts, serviceIdentity: config.identity, descriptor: config.descriptor,
    passed: cases.filter(item => item.outcome === "passed").length, failed: cases.filter(item => item.outcome === "failed").length,
    skipped: 0, actualCompilerPasses: cases.filter(item => item.outcome === "passed" && item.actualCompiler).length,
    userAgent: navigator.userAgent, consumerPinsChanged: false, hardwareExecuted: false, distributionStatus: "unresolved" };
}

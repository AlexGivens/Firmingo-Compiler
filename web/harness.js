import { CompilerController, parseBuildRequest, LIMITS, verifyNanoRecipe, serializeRuntimeEvent } from "/src/index.js";
import { SERVICE } from "/runtime/pins.js";

import { fetchBytes, loadRecipe } from "./resource-loading.js";
export { fetchBytes, loadRecipe };

/** Reads only an explicitly selected immutable browser File, within production input caps. */
async function fileBytes(file, maximum) {
  if (!(file instanceof File) || file.size < 1 || file.size > maximum) throw new Error("Choose a bounded local input file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > maximum) throw new Error("Local input byte count changed");
  return bytes;
}

const decode = bytes => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
let active = null, artifact = null, terminal = null;
const controller = new CompilerController();
const element = id => document.getElementById(id);
let lines = [];
/** Bounded text output; never renders compiler strings as markup or includes source in routine progress. */
function show(value) {
  if (lines.length === 144) lines.shift();
  lines.push(typeof value === "string" ? value : JSON.stringify(value));
  element("output").textContent = lines.join("\n");
}
function buttons(busy) {
  element("build").disabled = busy; element("checks").disabled = busy;
  element("cancel").disabled = !busy || !active; element("download").disabled = busy || !artifact;
}

/** Minimal host controls use the same default browser worker and contract as wrappers. */
async function initialize() {
  const config = JSON.parse(decode(await fetchBytes("/harness-config.json", 4096)));
  if (config.schema !== 1 || typeof config.serviceAvailable !== "boolean") throw new Error("Invalid harness configuration");
  element("status").textContent = config.serviceAvailable ? "Pinned local development service available. Sample output must never be deployed."
    : "Choose a pinned local service before building. Browser checks will explicitly skip compilation without one.";
  buttons(false);
  element("build").addEventListener("click", async () => {
    artifact = null; terminal = null; lines = []; element("output").textContent = "";
    buttons(true); element("status").textContent = "Loading selected inputs…";
    try {
      const selectedRequest = element("request-file").files[0], selectedService = element("service-file").files[0];
      const requestBytes = selectedRequest ? await fileBytes(selectedRequest, LIMITS.jsonBytes) : await fetchBytes("/fixture-request.json", LIMITS.jsonBytes);
      const request = parseBuildRequest(decode(requestBytes));
      const serviceBytes = selectedService ? await fileBytes(selectedService, SERVICE.bytes) : await fetchBytes("/development-service.wasm", SERVICE.bytes);
      const resources = { ...await loadRecipe(), serviceBytes };
      active = request.buildID; buttons(true);
      artifact = await controller.build(request, resources, { onEvent: event => {
        if (event.kind === "progress") { element("status").textContent = event.phase; show({ kind: event.kind, phase: event.phase, sequence: event.sequence }); }
        if (event.kind === "diagnostic") show(event.diagnostic);
        if (event.kind === "result" && event.outcome === "succeeded") terminal = event;
      } });
      element("status").textContent = "Build compiled, linked and validated. No device action performed.";
      show({ capsuleBytes: artifact.bytes.length, capsuleSHA256: artifact.sha256, receipt: artifact.receipt });
    } catch (error) {
      element("status").textContent = error.code === "cancelled" ? "Build cancelled." : "Build failed.";
      show({ code: error.code || "host_failed", message: error.message });
      for (const diagnostic of error.diagnostics || []) show(diagnostic);
    } finally { active = null; buttons(false); }
  });
  element("cancel").addEventListener("click", () => {
    if (active) controller.cancel({ interfaceVersion: 1, kind: "cancel", buildID: active });
  });
  element("checks").addEventListener("click", async () => {
    artifact = null; terminal = null; lines = []; buttons(true); element("status").textContent = "Running bounded browser checks…";
    try {
      const { runWebChecks } = await import("./checks.js");
      const report = await runWebChecks({ serviceAvailable: config.serviceAvailable });
      show(report); element("status").textContent = `${report.passed} passed; ${report.skipped} skipped; ${report.failed} failed.`;
    } catch (error) { show({ message: error.message }); element("status").textContent = "Browser checks failed."; }
    finally { buttons(false); }
  });
  element("download").addEventListener("click", () => {
    if (!artifact || !terminal) return;
    // One explicit download preserves capsule/receipt/report in the versioned portable envelope.
    const url = URL.createObjectURL(new Blob([serializeRuntimeEvent(terminal)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = artifact.filename.slice(0, -4) + ".build.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  return config;
}

globalThis.firmingoHarnessReady = initialize();
globalThis.firmingoHarnessReady.catch(error => { element("status").textContent = "Harness unavailable."; show({ message: error.message }); });

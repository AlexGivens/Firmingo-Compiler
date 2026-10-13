import { compileModule, ManagedService } from "../runtime/ManagedService.js";
import { validateBuildRequest, validateFirmwareBuildDescriptor } from "../src/contract.js";
import { createNanoJobs, verifyNanoRecipe } from "../src/nano-recipe.js";
import { packageELF } from "../src/capsule.js";
import { dataIdentity, sha256 } from "../src/hash.js";

const check = (value, message) => { if (!value) throw new Error(message || "Service execution check failed"); };

/** Maintenance only: the same real production WASI/recipe/packaging checks across Node and web workers. */
export async function serviceExecutionChecks({ bytes, expectedSHA256, descriptor, recipeManifest, assets }, { mode = "all", onPhase = () => {} } = {}) {
  check(mode === "all" || mode === "gpio", "Unsupported maintenance check mode");
  descriptor = validateFirmwareBuildDescriptor(descriptor);
  await verifyNanoRecipe(recipeManifest, assets);
  const module = await compileModule(bytes, { bytes: bytes.length, sha256: expectedSHA256 });
  const build = async (name, text) => {
    const request = validateBuildRequest({ interfaceVersion: 1, kind: "build", buildID: "owned-service-" + name,
      source: { filename: "Sketch.ino", revision: name + ":review-1", text },
      target: { board: descriptor.board, profile: descriptor.profile, recipeIdentifier: descriptor.recipeIdentifier,
        recipeSHA256: descriptor.recipeSHA256, firmwareBuild: descriptor }, options: { deadlineMilliseconds: 60000 } });
    const { prepared } = await createNanoJobs(request);
    const service = await ManagedService.create(module, new Map(["Arduino.h", "Entry.cpp", "Module.ld"].map(name => [name, assets["Recipe/" + name]])));
    const result = service.run({ schema: 1, recipe: request.target.recipeIdentifier, board: request.target.board,
      profile: request.target.profile, filename: request.source.filename, translationUnit: prepared.translationUnit, apiAddress: descriptor.apiAddress }, phase => onPhase(phase));
    if (!result.succeeded) return { failed: true, diagnostics: result.diagnostics };
    const provenance = { compiler: "owned LLVM 22.1.8 ABI-two development service", recipeIdentifier: descriptor.recipeIdentifier,
      recipeSHA256: descriptor.recipeSHA256, toolchainSHA256: await dataIdentity({ schema: 1, serviceSHA256: expectedSHA256 }) };
    const packaged = await packageELF(result.elf, request, provenance);
    return { name, source: request.source, elf: result.elf, capsule: packaged.bytes,
      capsuleBytes: packaged.bytes.length, capsuleSHA256: packaged.sha256, linkedELFSHA256: await sha256(result.elf),
      sourceSHA256: prepared.sourceSHA256, receipt: packaged.receipt, memoryBytes: result.memoryBytes, diagnostics: result.diagnostics };
  };
  const gpio = "void setup() { pinMode(6, 1); }\nvoid loop() { digitalWrite(6, 1); delay(10); }\n";
  if (mode === "gpio") return { builds: [await build("gpio", gpio)], errorChecks: [] };
  const first = await build("gpio", gpio), repeat = await build("gpio", gpio);
  const second = await build("console", 'void setup() { Serial.println("ready"); }\nvoid loop() { int c = Serial.read(); if (c >= 0) Serial.write(uint8_t(c)); }\n');
  for (const item of [first, repeat, second]) check(!item.failed, JSON.stringify(item.diagnostics));
  check(await sha256(first.elf) === await sha256(repeat.elf), "ELF repeat mismatch"); check(first.capsuleSHA256 === repeat.capsuleSHA256, "Capsule repeat mismatch");
  check(first.capsuleSHA256 !== second.capsuleSHA256, "Different sources returned the same artifact");
  const errorChecks = [];
  for (const [name, source, expected] of [
    ["frontend", "void setup() { missingFunction(); }\nvoid loop() {}", "missingFunction"],
    ["mutable-storage", "volatile int x; void setup() { x = 1; } void loop() { ++x; }", "mutable storage"],
    ["runtime-helper", "void setup() {} void loop() { digitalWrite(6, millis() / 250); }", "__aeabi_uidiv"],
  ]) {
    const result = await build(name, source);
    check(result.failed === true, name);
    check(result.diagnostics.some(diagnostic => diagnostic.severity === "error" && diagnostic.message.includes(expected)), JSON.stringify(result.diagnostics));
    errorChecks.push({ name, result: "rejected without artifact", expectedDiagnostic: expected });
  }
  const fresh = await build("after-errors", gpio);
  check(!fresh.failed, JSON.stringify(fresh.diagnostics)); check(fresh.capsuleSHA256 === first.capsuleSHA256, "Fresh build after errors mismatch");
  return { builds: [first, second], errorChecks };
}

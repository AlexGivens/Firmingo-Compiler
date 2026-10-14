import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyOwnedServiceSources, exportServiceMaterials } from "../tools/service-source-materials.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), "firmingo-source-grant-"));
  try { callback(root); } finally { rmSync(root, { recursive: true }); }
}

test("owned grant preserves every pinned service input and upstream LLVM license", () => {
  const { manifest, materials } = verifyOwnedServiceSources();
  assert.equal(manifest.files.length, 23);
  assert.equal(manifest.files.filter(file => file.role === "patch").length, 13);
  assert.equal(manifest.contributionLicense, "GPL-3.0-only");
  assert.equal(materials.size, 27);
  assert.equal(hash(materials.get("LICENSE")), hash(readFileSync(new URL("../LICENSE", import.meta.url))));
});

test("grant verifier rejects changed licensing, incomplete inventory and source drift", () => fixture(root => {
  const source = join(root, "source"); cpSync(new URL("../service/source/", import.meta.url), source, { recursive: true });
  const grantPath = join(source, "manifest.json"), original = readFileSync(grantPath);
  for (const change of [grant => { grant.contributionLicense = "MIT"; }, grant => { grant.files.pop(); },
    grant => { grant.files[0].path = "../outside"; }, grant => { grant.licenseFiles[1].sha256 = "0".repeat(64); }]) {
    const grant = JSON.parse(original); change(grant); writeFileSync(grantPath, JSON.stringify(grant));
    assert.throws(() => verifyOwnedServiceSources(source), /grant|inventory|identity/);
  }
  writeFileSync(grantPath, original);
  writeFileSync(join(source, "Sources/ArduinoCompilerService.cpp"), "changed");
  assert.throws(() => verifyOwnedServiceSources(source), /bytes/);
}));

test("grant verifier rejects file/directory links and unlisted materials", () => fixture(root => {
  const source = join(root, "source"); cpSync(new URL("../service/source/", import.meta.url), source, { recursive: true });
  writeFileSync(join(source, "unlisted.cpp"), "unlisted");
  assert.throws(() => verifyOwnedServiceSources(source), /Unlisted/);
  rmSync(join(source, "unlisted.cpp"));
  const path = join(source, "Sources/ArduinoCompilerService.cpp"), bytes = readFileSync(path);
  const external = join(root, "external.cpp"); writeFileSync(external, bytes); rmSync(path); symlinkSync(external, path);
  assert.throws(() => verifyOwnedServiceSources(source), /Symlinked/);
  rmSync(path); writeFileSync(path, bytes);
  cpSync(join(source, "Sources"), join(root, "external-directory"), { recursive: true });
  rmSync(join(source, "Sources"), { recursive: true }); symlinkSync(join(root, "external-directory"), join(source, "Sources"));
  assert.throws(() => verifyOwnedServiceSources(source), /Symlinked/);
}));

test("review export has deterministic checked files, selected notices and explicit incomplete-source status", () => fixture(root => {
  const first = join(root, "first"), second = join(root, "second");
  const receipt = exportServiceMaterials(first);
  assert.deepEqual(receipt, exportServiceMaterials(second));
  assert.equal(receipt.binaryIncluded, false);
  assert.equal(receipt.completeCorrespondingSource, false);
  const bytes = readFileSync(join(first, "manifest.json"));
  assert.equal(hash(bytes), receipt.manifest.sha256);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.distributionStatus, "unresolved");
  for (const record of manifest.files) {
    const bytes = readFileSync(join(first, record.path));
    assert.equal(bytes.length, record.bytes);
    assert.equal(hash(bytes), record.sha256);
    assert.deepEqual(bytes, readFileSync(join(second, record.path)));
    assert.ok(!record.path.endsWith(".wasm"));
  }
  assert.throws(() => exportServiceMaterials(first), /EEXIST/);
}));

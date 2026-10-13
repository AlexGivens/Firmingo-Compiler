import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { auditService } from "../tools/audit-service.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const git = (root, args) => {
  const result = spawnSync("git", ["-c", "core.hooksPath=" + (process.platform === "win32" ? "NUL" : "/dev/null"), "-C", root, ...args],
    { encoding: "utf8", timeout: 15000, env: { ...process.env, GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
};
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-audit-test-")), root = join(directory, "reference"), llvm = join(directory, "llvm");
  for (const folder of [root, llvm]) { mkdirSync(folder); git(folder, ["init", "-b", "main"]); }
  const patch = "diff --git a/llvm/example.cpp b/llvm/example.cpp\n--- a/llvm/example.cpp\n+++ b/llvm/example.cpp\n@@ -1 +1 @@\n-base\n+patched\n";
  const contents = { "CompilerService/Sources/Fixture.cpp": "// synthetic source; NEVER DEPLOY\n", "CompilerService/Patches/0001-fixture.patch": patch,
    "CompilerService/configure.sh": "# synthetic configuration\n" };
  const records = [];
  for (const [path, text] of Object.entries(contents)) {
    mkdirSync(join(root, path, ".."), { recursive: true }); writeFileSync(join(root, path), text);
    records.push({ path, bytes: Buffer.byteLength(text), sha256: hash(text), role: path.endsWith(".patch") ? "patch" : "source" });
  }
  mkdirSync(join(llvm, "llvm")); writeFileSync(join(llvm, "llvm/example.cpp"), "base\n"); writeFileSync(join(llvm, "LICENSE.TXT"), "synthetic license fixture; NEVER DEPLOY\n");
  for (const folder of [root, llvm]) {
    git(folder, ["add", "."]); git(folder, ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "synthetic audit inputs"]);
  }
  const refCommit = git(root, ["rev-parse", "HEAD"]), llvmCommit = git(llvm, ["rev-parse", "HEAD"]);
  writeFileSync(join(llvm, "llvm/example.cpp"), "patched\n");
  // Valid tiny memory-only WASM metadata fixture; no service/compiler functions and no execution.
  const bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1, 7, 10, 1, 6, 109, 101, 109, 111, 114, 121, 2, 0]);
  const modulePath = join(directory, "fixture.wasm"); writeFileSync(modulePath, bytes);
  const receipt = { schemaVersion: 1, llvm: { version: "22.1.8", sourceRevision: llvmCommit,
    patches: [{ name: "0001-fixture.patch", sha256: hash(patch) }] }, tools: { compiler: "synthetic; NEVER DEPLOY" },
    configurationInputs: [{ name: "configure.sh", sha256: hash(contents["CompilerService/configure.sh"]) }],
    module: { byteCount: bytes.length, sha256: hash(bytes), imports: [], exports: [{ name: "memory", kind: "memory" }], linkMilliseconds: 1.25 } };
  const receiptBytes = Buffer.from(JSON.stringify(receipt)), receiptPath = join(directory, "receipt.json"); writeFileSync(receiptPath, receiptBytes);
  const license = readFileSync(join(llvm, "LICENSE.TXT"));
  const pins = { referenceRepository: "synthetic fixture; NEVER DEPLOY", referenceCommit: refCommit, llvmCommit, llvmVersion: "22.1.8", files: records,
    receipt: { bytes: receiptBytes.length, sha256: hash(receiptBytes) }, llvmLicense: { path: "LICENSE.TXT", bytes: license.length, sha256: hash(license) } };
  return { directory, root, llvm, receiptPath, modulePath, pins, servicePin: { bytes: bytes.length, sha256: hash(bytes) } };
}
function audit(f) { return auditService(f.root, f.llvm, f.receiptPath, f.modulePath, { pins: f.pins, servicePin: f.servicePin }); }

test("actual audit reconstructs exact reviewed source changes in an owned temporary tree and stays unresolved", () => {
  const f = fixture();
  try {
    const before = readFileSync(join(f.llvm, "llvm/example.cpp"));
    const first = audit(f), second = audit(f); assert.deepEqual(first, second);
    assert.equal(first.distributionStatus, "unresolved"); assert.equal(first.reproducedFromSource, false);
    assert.equal(first.patchedLLVMFiles.length, 1); assert.equal(first.module.memory.minimumPages, 1);
    assert(first.gaps.some(value => value.includes("sysroot")));
    assert.deepEqual(readFileSync(join(f.llvm, "llvm/example.cpp")), before);
    assert.equal(git(f.llvm, ["status", "--short"]), "M llvm/example.cpp");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("audit rejects mismatched source/patch/receipt/module bytes and symlinked source inputs", () => {
  const f = fixture();
  try {
    const path = join(f.root, f.pins.files[0].path), original = readFileSync(path);
    writeFileSync(path, "changed"); assert.throws(() => audit(f), /hash mismatch/); writeFileSync(path, original);
    const receipt = readFileSync(f.receiptPath); writeFileSync(f.receiptPath, "{}"); assert.throws(() => audit(f), /build receipt/); writeFileSync(f.receiptPath, receipt);
    const module = readFileSync(f.modulePath); writeFileSync(f.modulePath, Buffer.alloc(module.length)); assert.throws(() => audit(f), /module identity/); writeFileSync(f.modulePath, module);
    const target = join(f.directory, "source-copy"); writeFileSync(target, original); rmSync(path); symlinkSync(target, path);
    assert.throws(() => audit(f), /Symlinked/);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("audit detects missing patches, additional tracked/untracked edits and changes beyond patch context", () => {
  const f = fixture();
  try {
    const path = join(f.llvm, "llvm/example.cpp");
    writeFileSync(path, "base\n"); assert.throws(() => audit(f), /missing or additional/);
    writeFileSync(path, "patched\nextra\n"); assert.throws(() => audit(f), /differs from exact/);
    writeFileSync(path, "patched\n"); const extra = join(f.llvm, "extra.cpp"); writeFileSync(extra, "extra\n");
    assert.throws(() => audit(f), /additional/); rmSync(extra); assert.equal(audit(f).distributionStatus, "unresolved");
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("audit refuses untrusted source commits and unsafe pinned paths without executing sources", () => {
  const f = fixture();
  try {
    f.pins.referenceCommit = "0".repeat(40); assert.throws(() => audit(f), /reference source commit/);
    f.pins.referenceCommit = git(f.root, ["rev-parse", "HEAD"]);
    f.pins.files[0] = { ...f.pins.files[0], path: "../outside" }; assert.throws(() => audit(f), /Unsafe service input/);
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

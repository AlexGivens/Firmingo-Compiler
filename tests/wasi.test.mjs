import test from "node:test";
import assert from "node:assert/strict";
import { Workspace, OutputCapture, limits } from "../runtime/Workspace.js";
import { parseDiagnostics, ManagedService } from "../runtime/ManagedService.js";
import { memoryLimits, requireBoundedMemory } from "../runtime/ModuleMemory.js";
import { wasi } from "../third_party/browser_wasi_shim/dist/index.js";
const open = (workspace, path, flags = 0, rights = 0n) => workspace.path_open(0, path, flags, rights, 0n, 0);

/// Writable file descriptors reject sparse growth/allocation/set-size through every mutation route.
test("workspace bounds every descriptor resize and positioned write", () => {
  const workspace = new Workspace("/workspace");
  const handle = open(workspace, "output.o", wasi.OFLAGS_CREAT, BigInt(wasi.RIGHTS_FD_WRITE)).fd_obj;
  assert(handle); assert.equal(handle.fd_write(new Uint8Array([1, 2])).ret, 0);
  assert.equal(handle.fd_allocate(0n, BigInt(limits.fileBytes + 1)), wasi.ERRNO_FBIG);
  assert.equal(handle.fd_filestat_set_size(2n ** 63n), wasi.ERRNO_FBIG);
  assert.equal(handle.fd_pwrite(new Uint8Array([3]), BigInt(limits.fileBytes)).ret, wasi.ERRNO_FBIG);
  handle.fd_seek(2n ** 63n, wasi.WHENCE_SET);
  assert.equal(handle.fd_write(new Uint8Array([4])).ret, wasi.ERRNO_FBIG);
  assert.deepEqual(workspace.read("output.o"), new Uint8Array([1, 2]));
});
/// Compiler-created and directly inserted files share the same aggregate allocation budget.
test("workspace aggregate growth cannot exceed its per-build bound", () => {
  const workspace = new Workspace("/workspace");
  for (let index = 0; index < 4; index++) { workspace.insert(`file${index}`, new Uint8Array(limits.fileBytes)); }
  const handle = open(workspace, "next", wasi.OFLAGS_CREAT, BigInt(wasi.RIGHTS_FD_WRITE)).fd_obj;
  assert(handle); assert.equal(handle.fd_write(new Uint8Array([1])).ret, wasi.ERRNO_FBIG);
});
/// Immutable files remain immutable after child directory opens and direct descriptor mutator calls.
test("readonly capability survives child descriptors and direct resizing", () => {
  const files = new Map([["nested/Arduino.h", new Uint8Array([1, 2, 3])]]);
  const toolchain = new Workspace("/toolchain", files);
  const dir = open(toolchain, "nested", wasi.OFLAGS_DIRECTORY).fd_obj; assert(dir);
  assert.equal(dir.path_create_directory("extra"), wasi.ERRNO_ROFS);
  assert.equal(dir.path_unlink_file("Arduino.h"), wasi.ERRNO_ROFS);
  assert.equal(dir.path_open(0, "Arduino.h", wasi.OFLAGS_TRUNC, 0n, 0n, 0).ret, wasi.ERRNO_ROFS);
  const file = dir.path_open(0, "Arduino.h", 0, 0n, 0n, 0).fd_obj; assert(file);
  assert.equal(file.fd_allocate(0n, 100n), wasi.ERRNO_ROFS);
  assert.equal(file.fd_filestat_set_size(0n), wasi.ERRNO_ROFS);
  assert.equal(file.fd_pwrite(new Uint8Array([4]), 0n).ret, wasi.ERRNO_ROFS);
  assert.deepEqual(toolchain.read("nested/Arduino.h"), new Uint8Array([1, 2, 3]));
});
/// Canonical paths cannot traverse preopens or introduce aliases in writable source/output storage.
test("path traversal and ambiguous aliases fail before resolving an inode", () => {
  const workspace = new Workspace("/workspace");
  for (const path of ["../x", "a/../x", "/x", "a//x", "a/./x", "x\0", "a\\x", ""]) {
    assert.throws(() => workspace.insert(path, new Uint8Array([1])));
    assert.notEqual(open(workspace, path, wasi.OFLAGS_CREAT).ret, 0);
  }
  assert.equal(workspace.path_filestat_get(0, ".").ret, 0);
});
/// Descriptor domains do not permit linking immutable recipe inodes into the mutable workspace.
test("cross-capability links and excessive entry creation are rejected", () => {
  const toolchain = new Workspace("/toolchain", new Map([["header", new Uint8Array([1])]]));
  const workspace = new Workspace("/workspace");
  assert.equal(workspace.path_link("header", toolchain.path_lookup("header", 0).inode_obj, false), wasi.ERRNO_NOTCAPABLE);
  for (let index = 0; index < limits.entries; index++) { assert.equal(open(workspace, "f" + index, wasi.OFLAGS_CREAT).ret, 0); }
  assert.notEqual(open(workspace, "overflow", wasi.OFLAGS_CREAT).ret, 0);
});
/// Workspace instances and retained output copies cannot leak a previous source revision.
test("fresh workspace and owned output prevent stale data reuse", () => {
  const first = new Workspace("/workspace"); first.insert("file", new Uint8Array([1]));
  const copy = first.read("file"); copy[0] = 9; assert.equal(first.read("file")[0], 1);
  const second = new Workspace("/workspace"); assert.throws(() => second.read("file"));
});
/// Exact stderr bytes are bounded rather than silently truncated, including a final unterminated line.
test("output capture retains exact bytes and rejects excessive writes", () => {
  const output = new OutputCapture(); output.fd_write(new Uint8Array([0xff, 0, 65]));
  assert.deepEqual(output.bytes, new Uint8Array([0xff, 0, 65]));
  assert.throws(() => output.fd_write(new Uint8Array(65536)));
});
/// Source-mapped diagnostics retain unmatched linker lines and reject oversized positions/messages.
test("diagnostic parsing retains locations, severity and unmatched failure context", () => {
  const result = parseDiagnostics("Sketch.ino:2:4: error: bad call\nld.lld: error: undefined symbol\n>>> detail");
  assert.deepEqual(result[0], { severity: "error", message: "bad call", filename: "Sketch.ino", line: 2, column: 4 });
  assert.equal(result[1].severity, "error"); assert.equal(result[2].message, ">>> detail");
  assert.throws(() => parseDiagnostics("x:99999999999999999:1: error: bad"));
  assert.throws(() => parseDiagnostics("error: " + "x".repeat(4097)));
  assert.throws(() => parseDiagnostics("note: n\n".repeat(129)));
});

test("defined memory must have a hard wasm32 cap; truncated and noncanonical limits fail", () => {
  const prefix = [0,97,115,109,1,0,0,0];
  const valid = new Uint8Array([...prefix, 5,5,1,1,1,128,32]);
  assert.equal(memoryLimits(valid).maximum, 4096); requireBoundedMemory(valid);
  for (const payload of [[5,3,1,0,1], [5,5,1,1,1,129,32], [5,4,1,3,1,1], [5,4,1,1,2,1], [5,5,1,1,128,0,1], [5,4,2,1,1,1]]) {
    assert.throws(() => requireBoundedMemory(new Uint8Array([...prefix, ...payload])));
  }
  for (let end = 0; end < valid.length; end++) assert.throws(() => requireBoundedMemory(valid.subarray(0, end)));
});

test("nested creation cannot exceed the entry budget before an insertion fails", () => {
  const workspace = new Workspace("/workspace");
  assert.throws(() => workspace.insert(Array(65).fill("a").join("/"), new Uint8Array([1])));
  assert(workspace.dir.budget.entries <= limits.entries);
});

test("failed service status without diagnostic text supplies a bounded error and its actual stage", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const exports = { memory, malloc: () => 16, free: () => {}, arduino_compiler_service_compile: () => 5,
    arduino_compiler_service_link: () => { throw new Error("Must not link"); }, arduino_compiler_service_can_run_again: () => 0,
    arduino_compiler_service_last_diagnostics: () => 0, arduino_compiler_service_last_diagnostics_size: () => 0 };
  const service = new ManagedService(exports, new Workspace("/workspace"), new OutputCapture(), new OutputCapture());
  const result = service.run({ schema: 1, recipe: "nano-stateless-clang-22.1.8-v1-experimental", board: "nano_rp2040_connect", profile: "nano-managed-v1",
    filename: "Sketch.ino", apiAddress: 0x1002154c, translationUnit: '#include <Arduino.h>\n#line 1 "Sketch.ino"\nvoid setup() {} void loop() {}\n' });
  assert.equal(result.succeeded, false); assert.equal(result.elf, undefined);
  assert.equal(result.diagnostics[0].stage, "compiling"); assert.equal(result.diagnostics[0].severity, "error");
});

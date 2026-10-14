import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { consumerFile, consumerFiles, verifyConsumerPackage, buildConsumerPackage } from "../tools/consumer-package.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");

test("consumer inventory streams exact observed copies and normalizes local paths", () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-consumer-fixture-"));
  try {
    mkdirSync(join(root, "input")); mkdirSync(join(root, "input", "contract"));
    const data = Buffer.alloc(1024 * 1024 + 7, 0xa5);
    writeFileSync(join(root, "input", "contract", "data"), data);
    const expected = { bytes: data.length, sha256: hash(data) };
    assert.deepEqual(consumerFile(join(root, "input", "contract", "data"), join(root, "copy")), expected);
    assert.deepEqual(readFileSync(join(root, "copy")), data);
    assert.deepEqual(consumerFiles(join(root, "input")), [{ path: "contract/data", ...expected }]);
    assert.throws(() => consumerFile(join(root, "copy"), join(root, "copy")), /EEXIST/);
  } finally { rmSync(root, { recursive: true }); }
});

test("consumer tree rejects symlinks, empty directories, unsafe names and excessive counts", () => {
  for (const mutate of [root => symlinkSync("/tmp", join(root, "link")), root => mkdirSync(join(root, "empty")),
    root => writeFileSync(join(root, "bad name"), "bad"), root => {
      for (let i = 0; i < 65; i++) writeFileSync(join(root, String(i)), "bounded fixture");
    }]) {
    const root = mkdtempSync(join(tmpdir(), "firmingo-consumer-invalid-"));
    try { mutate(root); assert.throws(() => consumerFiles(root)); }
    finally { rmSync(root, { recursive: true }); }
  }
});

test("consumer anchors and closed metadata reject invented approval before any source execution", async () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-consumer-anchor-"));
  try {
    const bytes = Buffer.from('{"schema":1,"package":"firmingo-compiler-consumer","qualification":"qualified","files":[]}');
    writeFileSync(join(root, "manifest.json"), bytes);
    await assert.rejects(verifyConsumerPackage(root, "0".repeat(64)), /anchor/);
    await assert.rejects(verifyConsumerPackage(root, hash(bytes)), /Incompatible/);
  } finally { rmSync(root, { recursive: true }); }
});

test("consumer package requires an independently reviewed exact resident and leaves failed output absent", async () => {
  const root = mkdtempSync(join(tmpdir(), "firmingo-consumer-review-"));
  try {
    const output = join(root, "new-package");
    await assert.rejects(buildConsumerPackage(root, root, output));
    assert.throws(() => readFileSync(join(output, "manifest.json")), /ENOENT/);
  } finally { rmSync(root, { recursive: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyServiceNoticeReview } from "../tools/service-notice-review.mjs";

function fixture(callback) {
  const parent = mkdtempSync(join(tmpdir(), "firmingo-notice-review-"));
  const root = join(parent, "review");
  cpSync(new URL("../third_party/service-notice-review/", import.meta.url), root, { recursive: true });
  try { callback(root, parent); } finally { rmSync(parent, { recursive: true }); }
}

test("candidate notice review retains internal crypt and floating-point credits without distribution clearance", () => {
  const result = verifyServiceNoticeReview();
  assert.equal(result.sourceSelectionsVerified, false);
  assert.equal(result.manifest.distributionStatus, "unresolved");
  assert.equal(result.manifest.binaryIncluded, false);
  assert.equal(result.manifest.sourceExcerpts.length, 232);
  assert.equal(result.manifest.namedLicenseSources.length, 30);
  const internal = result.manifest.sourceExcerpts.filter(record => record.selection.startsWith("internal"));
  assert.ok(internal.some(record => record.sourcePath.endsWith("crypt_md5.c") && record.firstLine === 155));
  assert.ok(internal.some(record => record.sourcePath.endsWith("libcxx/src/charconv.cpp")));
  const text = new TextDecoder().decode(result.materials.get("FILE-NOTICES.txt"));
  assert.match(text, /Copyright \(c\) 2003 Poul-Henning Kamp/);
  assert.match(text, /Copyright 2018 Ulf Adams/);
  assert.match(text, /Copyright \(2022\) National Technology & Engineering/);
  assert.ok(result.manifest.sourceExcerpts.some(record => record.sourcePath.endsWith("__format/width_estimation_table.h")));
});

test("notice review refuses changed manifest, license, excerpt and extra file", () => fixture(root => {
  for (const name of ["manifest.json", "LICENSES.txt", "FILE-NOTICES.txt"]) {
    const path = join(root, name), original = readFileSync(path);
    writeFileSync(path, "changed");
    assert.throws(() => verifyServiceNoticeReview({ root }), /reviewed pin|reviewed identity/);
    writeFileSync(path, original);
  }
  writeFileSync(join(root, "extra.txt"), "extra");
  assert.throws(() => verifyServiceNoticeReview({ root }), /Unlisted/);
}));

test("notice review refuses file and root symlink aliases", () => fixture((root, parent) => {
  const path = join(root, "LICENSES.txt"), external = join(parent, "external.txt");
  writeFileSync(external, readFileSync(path)); rmSync(path); symlinkSync(external, path);
  assert.throws(() => verifyServiceNoticeReview({ root }), /Symlinked/);
  const alias = join(parent, "alias"); symlinkSync(root, alias);
  assert.throws(() => verifyServiceNoticeReview({ root: alias }), /Unsafe/);
}));

test("optional source checking requires the pinned source manifest before examining excerpts", () => fixture((root, parent) => {
  writeFileSync(join(parent, "manifest.json"), "{}");
  assert.throws(() => verifyServiceNoticeReview({ root, sourceRoot: parent }), /reviewed identity/);
}));

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIMITS } from "../src/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const run = argumentsList => spawnSync(process.execPath, ["tools/dev.mjs", ...argumentsList],
  { cwd: root, encoding: "utf8", timeout: 5000 });

test("developer validator reports input identity without claiming compilation", () => {
  const result = run(["validate-request", "tests/fixtures/synthetic-build-request.json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "valid_input_only");
  assert.ok(!result.stdout.includes("void setup"));
});

test("unknown commands and missing explicit input fail with a nonzero exit status", () => {
  for (const argumentsList of [["compile"], ["validate-request"], ["test", "extra"]]) {
    const result = run(argumentsList);
    assert.equal(result.status, 1, result.stdout);
    assert.ok(result.stderr.length > 0);
  }
});

test("CLI rejects malformed, non-UTF-8, oversized and directory inputs before validation", () => {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-contract-"));
  try {
    for (const bytes of [Buffer.from('{"interfaceVersion":1,"interfaceVersion":2}'),
      Buffer.from([0xff]), Buffer.alloc(LIMITS.jsonBytes + 1, 32)]) {
      const path = join(directory, "input.json"); writeFileSync(path, bytes);
      const result = run(["validate-request", path]);
      assert.equal(result.status, 1, result.stdout);
      assert.ok(!result.stdout.includes("valid_input_only"));
    }
    assert.equal(run(["validate-request", directory]).status, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("help identifies the explicit service input and unavailable bundled assets", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /explicitly provisioned pinned local service/);
});

test("developer preparation and independent packaging create explicit new outputs without overwriting", () => {
  const directory = mkdtempSync(join(tmpdir(), "firmingo-pipeline-"));
  try {
    const preparedPath = join(directory, "prepared");
    const prepared = run(["prepare-request", "tests/fixtures/synthetic-packaging-request.json", preparedPath]);
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.equal(JSON.parse(prepared.stdout).status, "prepared_source_only");
    assert.ok(readFileSync(join(preparedPath, "Sketch.cpp"), "utf8").startsWith("#include <Arduino.h>\n#line 1"));
    assert.equal(run(["prepare-request", "tests/fixtures/synthetic-packaging-request.json", preparedPath]).status, 1);
    const elf = join(directory, "linked.elf");
    const elfHex = readFileSync(join(root, "tests/fixtures/stateless.elf.hex"), "utf8").trim().split(/\s+/);
    writeFileSync(elf, Buffer.from(elfHex.map(pair => parseInt(pair, 16))));
    const output = join(directory, "package");
    const args = ["package-elf", "tests/fixtures/synthetic-packaging-request.json", elf,
      "tests/fixtures/declared-packaging-provenance.json", output];
    const packaged = run(args);
    assert.equal(packaged.status, 0, packaged.stderr);
    assert.equal(JSON.parse(packaged.stdout).status, "packaged_independent_elf");
    assert.equal(readFileSync(join(output, "Sketch.fms")).length, 264);
    assert.equal(JSON.parse(readFileSync(join(output, "receipt.json"))).provenanceStatus, "declared");
    assert.equal(run(args).status, 1);
    writeFileSync(elf, Buffer.alloc(100));
    args[4] = join(directory, "invalid-package");
    assert.equal(run(args).status, 1);
    assert.equal(existsSync(args[4]), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

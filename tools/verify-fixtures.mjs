import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

/** Checks independently recorded parser fixtures without reading any sibling checkout. */
export function verifyFixtures() {
  const root = new URL("../tests/fixtures/", import.meta.url);
  let count = 0;
  for (const file of ["provenance.json", "pipeline-provenance.json"]) {
    const manifest = JSON.parse(readFileSync(new URL(file, root)));
    for (const [name, facts] of Object.entries(manifest.files)) {
      if (!/^[a-z0-9][a-z0-9.-]*\.(json|hex)$/.test(name) || name.includes("..")) throw new Error("Unsafe fixture path");
      const bytes = readFileSync(new URL(name, root));
      if (bytes.length !== facts.bytes || createHash("sha256").update(bytes).digest("hex") !== facts.sha256) {
        throw new Error(`Fixture integrity mismatch: ${name}`);
      }
      count++;
    }
  }
  console.log(`Verified ${count} synthetic parser fixtures; NEVER DEPLOY`);
}

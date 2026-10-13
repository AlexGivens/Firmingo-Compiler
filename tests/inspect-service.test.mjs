import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspectService } from "../tools/inspect-service.mjs";

const recipe = JSON.parse(readFileSync(new URL("../service/recipe.json", import.meta.url)));
const encoded = value => { const bytes = []; do { bytes.push(value % 128 | (value > 127 ? 128 : 0)); value = Math.floor(value / 128); } while (value); return bytes; };
const section = (kind, payload) => [kind, ...encoded(payload.length), ...payload];
const name = value => { const bytes = [...new TextEncoder().encode(value)]; return [...encoded(bytes.length), ...bytes]; };

/** Hand-authored static metadata and dummy return body, NEVER DEPLOY; not instantiated by these checks. */
function fixture(exports = [...recipe.exports, "_initialize"], maximum = 4096) {
  const records = [...exports.map(value => [...name(value), 0, 0]), [...name("memory"), 2, 0]];
  return new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0,
    ...section(1, [1, 96, 0, 1, 127]), ...section(3, [1, 0]),
    ...section(5, maximum === null ? [1, 0, 1] : [1, 1, 1, ...encoded(maximum)]),
    ...section(7, [...encoded(records.length), ...records.flat()]), ...section(10, [1, 4, 0, 65, 2, 11])]);
}

test("owned service static output gate checks exact exported ABI shape and bounded memory without executing it", () => {
  const result = inspectService(fixture());
  assert.equal(result.instantiated, false); assert.equal(result.distributionStatus, "unresolved");
  assert.equal(result.declaredServiceABI, 2); assert.equal(result.memory.maximumPages, 4096);
  assert.equal(result.exports.length, 11); assert.equal(result.imports.length, 0);
});

test("owned service gate rejects missing/unexpected exports, malformed modules and unbounded/excessive memory", () => {
  for (const bytes of [fixture(recipe.exports), fixture([...recipe.exports, "_initialize", "unexpected"]),
    fixture(undefined, null), fixture(undefined, 4097), new Uint8Array(12)]) assert.throws(() => inspectService(bytes));
  const complete = fixture();
  for (let i = 0; i < complete.length; i++) assert.throws(() => inspectService(complete.slice(0, i)));
});

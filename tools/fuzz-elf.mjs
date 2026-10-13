import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseELF, PipelineError } from "../src/index.js";

/** Bounded seeded mutation of the production ELF parser, using only non-executable fixture bytes. */
export function fuzzELF() {
  const seed = 0x454c4631;
  let state = seed;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  const original = Uint8Array.from(readFileSync(new URL("../tests/fixtures/stateless.elf.hex", import.meta.url), "utf8")
    .trim().split(/\s+/), pair => parseInt(pair, 16));
  let accepted = 0;
  console.log(`ELF mutation seed=${seed} cases=5000; fixture bytes must never execute`);
  for (let index = 0; index < 5000; index++) {
    let input = original.slice();
    if (random() % 4 === 0) input = input.slice(0, random() % (input.length + 1));
    else for (let count = 0, changes = 1 + random() % 8; count < changes; count++) input[random() % input.length] ^= 1 << (random() % 8);
    try {
      let image;
      try { image = parseELF(input); }
      catch (error) { assert.ok(error instanceof PipelineError && error.code === "invalid_elf"); continue; }
      assert.ok(image.codeBytes >= 4 && image.codeBytes <= 3840 && image.codeBytes % 4 === 0);
      assert.equal(image.code.length, image.codeBytes);
      for (const entry of [image.setupAddress, image.loopAddress]) {
        assert.equal(entry % 2, 1);
        assert.ok(entry - 1 >= 0x10200100 && entry - 1 < 0x10200100 + image.codeBytes);
      }
      accepted++;
    } catch (error) {
      console.error(`FAILED seed=${seed} case=${index} bytes=${Buffer.from(input).toString("hex")}`);
      throw error;
    }
  }
  assert.ok(accepted > 0, "Corpus did not exercise valid ELF output");
  console.log(`Passed 5000 bounded ELF mutations (${accepted} valid layouts)`);
}

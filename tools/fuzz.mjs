import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ContractError, parseContractJSON } from "../src/index.js";

/** Bounded differential JSON mutation run; the seed is printed for exact reproduction. */
export function fuzz() {
  const seed = 0x464d474f;
  let state = seed;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  const bases = [readFileSync(new URL("../tests/fixtures/synthetic-build-request.json", import.meta.url), "utf8"),
    '{"interfaceVersion":1,"kind":"cancel","buildID":"build-1"}', '[]', '{}', '"\\u0056"'];
  const alphabet = '{}[]:,"\\ 0129true\n\t😀';
  let accepted = 0;
  console.log(`JSON mutation seed=${seed} cases=4000`);
  for (let index = 0; index < 4000; index++) {
    let input = bases[random() % bases.length];
    for (let count = 0, mutations = 1 + random() % 4; count < mutations; count++) {
      const offset = random() % (input.length + 1);
      const insert = alphabet[random() % alphabet.length];
      input = input.slice(0, offset) + insert + input.slice(offset + (random() % 2));
    }
    try {
      let parsed;
      try { parsed = parseContractJSON(input); }
      catch (error) { assert.ok(error instanceof ContractError); continue; }
      assert.equal(JSON.stringify(parsed), JSON.stringify(JSON.parse(input)));
      accepted++;
    } catch (error) {
      console.error(`FAILED seed=${seed} case=${index} input=${JSON.stringify(input)}`);
      throw error;
    }
  }
  assert.ok(accepted > 0, "Mutation corpus never exercised an accepted JSON input");
  console.log(`Passed 4000 bounded mutations (${accepted} valid JSON inputs)`);
}

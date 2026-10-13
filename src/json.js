import { ContractError } from "./errors.js";
import { LIMITS } from "./limits.js";

/** Bounded JSON parser that rejects duplicate decoded keys before values can be overwritten. */
export function parseContractJSON(text) {
  if (typeof text !== "string" || text.length > LIMITS.jsonBytes
      || new TextEncoder().encode(text).length > LIMITS.jsonBytes) {
    throw new ContractError("input_limit", "$", "JSON must be a bounded UTF-8 string");
  }
  let position = 0;
  let tokens = 0;
  const fail = () => { throw new ContractError("invalid_json", "$", "Malformed contract JSON"); };
  const token = () => {
    if (++tokens > LIMITS.jsonTokens) {
      throw new ContractError("input_limit", "$", "JSON token limit exceeded");
    }
  };
  const whitespace = () => {
    while (position < text.length && /[\x20\t\r\n]/.test(text[position])) position++;
  };
  const string = () => {
    token();
    const start = position++;
    while (position < text.length) {
      const char = text[position++];
      if (char === '"') {
        try { return JSON.parse(text.slice(start, position)); } catch { fail(); }
      }
      if (char === "\\") position++;
    }
    fail();
  };
  const value = depth => {
    if (depth > LIMITS.jsonDepth) {
      throw new ContractError("input_limit", "$", "JSON nesting limit exceeded");
    }
    whitespace();
    if (text[position] === '"') return string();
    token();
    const char = text[position];
    if (char === "{" || char === "[") {
      const object = char === "{";
      const result = object ? Object.create(null) : [];
      const close = object ? "}" : "]";
      const names = new Set();
      position++;
      whitespace();
      if (text[position] === close) { position++; return result; }
      while (position < text.length) {
        whitespace();
        let key;
        if (object) {
          if (text[position] !== '"') fail();
          key = string();
          if (names.has(key)) throw new ContractError("duplicate_key", "$", "Duplicate JSON field");
          names.add(key);
          whitespace();
          if (text[position++] !== ":") fail();
        }
        const item = value(depth + 1);
        if (object) result[key] = item;
        else result.push(item);
        whitespace();
        if (text[position] === close) { position++; return result; }
        if (text[position++] !== ",") fail();
      }
      fail();
    }
    for (const [literal, result] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(literal, position)) { position += literal.length; return result; }
    }
    // Integer literals only: Number() must not round a fractional version/address into an accepted integer.
    const number = text.slice(position).match(/^-?(?:0|[1-9][0-9]*)/);
    if (!number) fail();
    position += number[0].length;
    const parsed = Number(number[0]);
    if (!Number.isSafeInteger(parsed)) fail();
    return parsed;
  };
  const result = value(0);
  whitespace();
  if (position !== text.length) fail();
  return result;
}

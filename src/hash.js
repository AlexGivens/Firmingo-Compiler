import { portableSHA256 } from "../runtime/portable-sha256.js";

/** Compact sorted JSON for validated data; arrays preserve their semantic order. */
export function canonicalJSON(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJSON).join(",") + "]";
  return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonicalJSON(value[key])).join(",") + "}";
}

/** Hashes caller-independent bytes locally without a Node/native/network dependency. */
export async function sha256(bytes) {
  const result = globalThis.crypto?.subtle ? await globalThis.crypto.subtle.digest("SHA-256", bytes) : portableSHA256(bytes);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function dataIdentity(value) { return sha256(new TextEncoder().encode(canonicalJSON(value))); }

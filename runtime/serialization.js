import { validateRuntimeEvent } from "./messages.js";
import { parseContractJSON } from "../src/json.js";
import { PipelineError } from "../src/pipeline-error.js";

/** Encodes only bounded validated events; success bytes use canonical padded RFC 4648 base64. */
export function serializeRuntimeEvent(value) {
  validateRuntimeEvent(value);
  if (value.outcome !== "succeeded") return JSON.stringify(value);
  const bytes = value.artifact.bytes;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return JSON.stringify({ ...value, artifact: { ...value.artifact, bytes: btoa(binary) } });
}

/** Strictly decodes a portable event, without asserting publisher trust or authorizing deployment. */
export function parseRuntimeEvent(text) {
  if (typeof text !== "string" || new TextEncoder().encode(text).length > 32768)
    throw new PipelineError("invalid_response", "validating", "Serialized event exceeds bounds");
  const value = parseContractJSON(text);
  if (value?.outcome === "succeeded") {
    const encoded = value.artifact?.bytes;
    if (typeof encoded !== "string" || encoded.length > 5464 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
      throw new PipelineError("invalid_response", "validating", "Invalid binary event encoding");
    const binary = atob(encoded);
    if (btoa(binary) !== encoded) throw new PipelineError("invalid_response", "validating", "Noncanonical binary event encoding");
    value.artifact.bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  }
  return validateRuntimeEvent(value);
}
